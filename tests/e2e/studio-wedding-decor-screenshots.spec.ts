import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { defaultLayout } from "../../src/client/studio/model/defaults";

test.use({ launchOptions: { args: ["--enable-unsafe-swiftshader"] } });
test.describe.configure({ timeout: 120_000 });

async function chooseView(page: Page, name: string) {
  await page.getByRole("button", { name: "View panel", exact: true }).click();
  await page.getByRole("button", { name, exact: true }).click();
}

async function chooseSetup(page: Page, mode: string) {
  await page.getByRole("button", { name: "More panel", exact: true }).click();
  const layers = page.locator(".studio-layer-settings");
  if (!(await layers.evaluate(node => (node as HTMLDetailsElement).open))) {
    await layers.locator("summary").click();
  }
  await expect(page.getByLabel("Wedding decorations", { exact: true })).toBeChecked();
  await page.getByLabel("Stage setup", { exact: true }).selectOption(mode);
  await page.getByRole("button", { name: "Close planning tools", exact: true }).click();
}

async function capture(page: Page, info: TestInfo, name: string) {
  await expect(page.locator(".studio-three-view canvas")).toBeVisible();
  await expect(page.locator(".studio-render-fallback:visible")).toHaveCount(0);
  await expect.poll(() => page.locator(".studio-three-view canvas").evaluate((canvas: HTMLCanvasElement) => {
    const gl = canvas.getContext("webgl2");
    if (!gl || gl.isContextLost()) return 0;
    const pixel = new Uint8Array(4), colors = new Set<string>();
    for (const x of [.2, .35, .5, .65, .8]) for (const y of [.2, .35, .5, .65, .8]) {
      gl.readPixels(Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      colors.add(Array.from(pixel).join(","));
    }
    return colors.size;
  }), { timeout: 20_000 }).toBeGreaterThan(3);
  // Let camera damping and the next shadow-map render settle before capture.
  await page.waitForTimeout(800);
  await info.attach(name, {
    body: await page.screenshot({ path: info.outputPath(`${name}.png`), animations: "disabled" }),
    contentType: "image/png",
  });
}

test("capture decorated reference venue without accessing private guest data", async ({ page, isMobile }, info) => {
  // Capture both viewport sizes in one session rather than duplicate this work
  // in the mobile project. The production application is not modified.
  test.skip(isMobile, "Desktop project captures both viewport sizes.");
  const layout = defaultLayout();
  const errors: string[] = [], writes: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/admin/studio/layout", route => route.fulfill({ json: {
    status: "ok", source: "Google Sheets", layout,
    revision: "public-reference-preview", fetchedAt: Date.now(),
  } }));
  await page.route("**/api/admin/studio/mutations", async route => {
    writes.push(route.request().method());
    await route.fulfill({ status: 409, json: { error: { message: "Screenshot capture must not write seating data." } } });
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/admin/studio");
  await page.getByLabel("Administrator passphrase").fill("local-e2e-passphrase");
  await page.getByRole("button", { name: "Open studio", exact: true }).click();
  await expect(page.locator(".studio-plan")).toBeVisible();
  expect(layout.guestList).toHaveLength(0);
  expect(layout.items.some(item => item.kind === "stage")).toBe(true);

  await chooseView(page, "3D model");
  await capture(page, info, "wedding-decor-desktop-overview");
  await chooseView(page, "Walk inside");
  // Use the real walk controls to approach the stage from the entrance.
  await page.keyboard.down("Shift");
  await page.keyboard.down("w");
  await page.waitForTimeout(6500);
  await page.keyboard.up("w");
  await page.keyboard.up("Shift");
  await capture(page, info, "wedding-decor-stage");
  await chooseSetup(page, "head-table");
  await capture(page, info, "wedding-decor-head-table");
  await chooseSetup(page, "cake-table");
  await capture(page, info, "wedding-decor-cake-table");

  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, info, "wedding-decor-mobile");
  await page.getByRole("button", { name: "More panel", exact: true }).click();
  const layers = page.locator(".studio-layer-settings");
  if (!(await layers.evaluate(node => (node as HTMLDetailsElement).open))) await layers.locator("summary").click();
  await page.getByLabel("Stage setup", { exact: true }).scrollIntoViewIfNeeded();
  await capture(page, info, "wedding-decor-mobile-controls");
  expect(writes).toHaveLength(0);
  expect(errors).toEqual([]);
});
