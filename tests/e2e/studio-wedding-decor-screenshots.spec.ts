import { writeFile } from "node:fs/promises";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { defaultLayout } from "../../src/client/studio/model/defaults";

test.use({ launchOptions: { args: ["--enable-unsafe-swiftshader"] } });
test.describe.configure({ timeout: 120_000 });

async function chooseView(page: Page, name: string) {
  await page.getByRole("button", { name: "View panel", exact: true }).click();
  await page.getByRole("button", { name, exact: true }).click();
}

async function layersPanel(page: Page) {
  await page.getByRole("button", { name: "More panel", exact: true }).click();
  const layers = page.locator(".studio-layer-settings");
  if (!(await layers.evaluate(node => (node as HTMLDetailsElement).open))) await layers.locator("summary").click();
  return layers;
}

async function chooseSetup(page: Page, mode: string, pdfPage: number) {
  const layers = await layersPanel(page);
  await expect(page.getByLabel("Wedding decorations", { exact: true })).toBeChecked();
  const setup = layers.locator("label").filter({ hasText: "Stage setup" }).locator("select");
  await setup.selectOption(mode);
  await expect(setup).toHaveValue(mode);
  await page.getByRole("button", { name: "Close planning tools", exact: true }).click();
  await expect(page.locator(".studio-three-view canvas")).toHaveAttribute("data-pdf-camera-page", String(pdfPage));
}

async function capture(page: Page, info: TestInfo, name: string, canvasOnly = true) {
  const canvas = page.locator(".studio-three-view canvas");
  await expect(canvas).toBeVisible();
  await expect(page.locator(".studio-render-fallback:visible")).toHaveCount(0);
  await expect.poll(() => canvas.evaluate((node: HTMLCanvasElement) => {
    const gl = node.getContext("webgl2");
    if (!gl || gl.isContextLost()) return 0;
    const pixel = new Uint8Array(4), colors = new Set<string>();
    for (const x of [.2, .35, .5, .65, .8]) for (const y of [.2, .35, .5, .65, .8]) {
      gl.readPixels(Math.floor(x * node.width), Math.floor(y * node.height), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      colors.add(Array.from(pixel).join(","));
    }
    return colors.size;
  }), { timeout: 20_000 }).toBeGreaterThan(3);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const body = canvasOnly
    ? Buffer.from((await canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL("image/png"))).split(",")[1], "base64")
    : await page.screenshot({ animations: "disabled" });
  await writeFile(info.outputPath(`${name}.png`), body);
  await info.attach(name, { body, contentType: "image/png" });
  return body;
}

test("capture decorated reference venue without accessing private guest data", async ({ page, isMobile }, info) => {
  test.skip(isMobile, "Desktop project also captures the responsive portrait viewport.");
  const layout = defaultLayout();
  const errors: string[] = [], writes: string[] = [];
  page.on("pageerror", error => { errors.push(error.message); console.error("decor pageerror:", error.message); });
  page.on("console", message => { if (message.type() === "error") console.error("decor browser:", message.text()); });
  page.on("requestfailed", request => console.error("decor request failed:", request.url(), request.failure()?.errorText));
  await page.route("**/api/admin/studio/layout", route => route.fulfill({ json: {
    status: "ok", source: "Google Sheets", layout,
    revision: "public-reference-preview", fetchedAt: Date.now(),
  } }));
  await page.route("**/api/admin/studio/mutations", async route => {
    writes.push(route.request().method());
    await route.fulfill({ status: 409, json: { error: { message: "Screenshot capture must not write seating data." } } });
  });
  await page.setViewportSize({ width: 1560, height: 1080 });
  await page.goto("/admin/studio");
  await page.getByLabel("Administrator passphrase").fill("local-e2e-passphrase");
  await page.getByRole("button", { name: "Open studio", exact: true }).click();
  await expect(page.locator(".studio-plan")).toBeVisible();
  expect(layout.guestList).toHaveLength(0);
  const started = Date.now();
  await chooseView(page, "3D model");
  const canvas = page.locator(".studio-three-view canvas");
  try {
    // The detailed reference fixture compiles physical cloth and instanced flower
    // shaders on CPU SwiftShader. Wait for actual controls readiness, not a sleep.
    await expect(canvas).toHaveAttribute("data-camera-preset", "overview", { timeout: 30_000 });
  } catch (cause) {
    console.error("decor startup diagnostics:", JSON.stringify({ errors, text: await page.locator("body").innerText() }));
    await page.screenshot({ path: info.outputPath("decor-startup-failure.png") });
    throw cause;
  }
  console.log("decor scene ready in ms:", Date.now() - started);
  expect(errors).toEqual([]);
  await capture(page, info, "wedding-decor-desktop-overview", false);
  const layers = await layersPanel(page);
  await layers.locator("label").filter({ hasText: "Roof" }).locator("select").selectOption("frame");
  await layers.locator("label").filter({ hasText: "Walls" }).locator("select").selectOption("full");
  await page.getByRole("button", { name: "Close planning tools", exact: true }).click();
  await page.getByRole("button", { name: "View panel", exact: true }).click();
  await page.getByRole("button", { name: "Match PDF framing", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-camera-preset", "pdf");
  await expect(canvas).toHaveAttribute("data-pdf-camera-page", "3");
  const a = await capture(page, info, "wedding-decor-stage");
  await chooseSetup(page, "head-table", 4);
  const b = await capture(page, info, "wedding-decor-head-table");
  await chooseSetup(page, "cake-table", 5);
  const c = await capture(page, info, "wedding-decor-cake-table");
  expect(a.equals(b)).toBe(false); expect(b.equals(c)).toBe(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(canvas).toHaveAttribute("data-pdf-camera-page", "5");
  await capture(page, info, "wedding-decor-mobile");
  const mobileLayers = await layersPanel(page);
  await mobileLayers.locator("label").filter({ hasText: "Stage setup" }).locator("select").scrollIntoViewIfNeeded();
  await capture(page, info, "wedding-decor-mobile-controls", false);
  await page.getByRole("button", { name: "Close planning tools", exact: true }).click();
  await page.getByRole("button", { name: "View panel", exact: true }).click();
  await page.getByRole("button", { name: "Fit room", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-camera-preset", "overview");
  await page.getByRole("button", { name: "Close planning tools", exact: true }).click();
  await chooseView(page, "Walk inside");
  await expect(page.getByRole("group", { name: "Walk joystick", exact: true })).toBeVisible();
  expect(writes).toHaveLength(0); expect(errors).toEqual([]);
});
