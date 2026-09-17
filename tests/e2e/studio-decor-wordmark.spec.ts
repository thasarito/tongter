import { expect, test } from "@playwright/test";
import { defaultLayout } from "../../src/client/studio/model/defaults";

test.use({ launchOptions: { args: ["--enable-unsafe-swiftshader"] } });
test.describe.configure({ timeout: 90_000 });

test("renders the script wordmark in the reference frame, not an empty texture", async ({ page, isMobile }, info) => {
  test.skip(isMobile, "Pixel region is calibrated to the fixed landscape PDF composition.");
  const errors: string[] = []; let writes = 0;
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/admin/studio/layout", route => route.fulfill({ json: {
    status: "ok", source: "Google Sheets", layout: defaultLayout(), revision: "wordmark-test", fetchedAt: Date.now(),
  } }));
  await page.route("**/api/admin/studio/mutations", route => { writes++; return route.fulfill({ status: 409, json: { error: { message: "Read-only capture" } } }); });
  await page.setViewportSize({ width: 1560, height: 1080 });
  await page.goto("/admin/studio");
  await page.getByLabel("Administrator passphrase").fill("local-e2e-passphrase");
  await page.getByRole("button", { name: "Open studio", exact: true }).click();
  await expect(page.locator(".studio-plan")).toBeVisible();
  await page.getByRole("button", { name: "View panel", exact: true }).click();
  await page.getByRole("button", { name: "3D model", exact: true }).click();
  const canvas = page.locator(".studio-three-view canvas");
  await expect(canvas).toHaveAttribute("data-camera-preset", "overview", { timeout: 30_000 });
  await page.getByRole("button", { name: "View panel", exact: true }).click();
  await page.getByRole("button", { name: "Match PDF framing", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-pdf-camera-page", "3");
  // This small region lies wholly on the backing panel, away from trusses,
  // flowers and the U-shaped swags. The first-pass blank texture had 0 ink pixels.
  await expect.poll(() => canvas.evaluate((node: HTMLCanvasElement) => {
    const gl = node.getContext("webgl2"); if (!gl || gl.isContextLost()) return 0;
    const w = Math.floor(node.width * .08), h = Math.floor(node.height * .04), pixels = new Uint8Array(w * h * 4);
    gl.readPixels(Math.floor(node.width * .46), Math.floor(node.height * (1 - .465)), w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let ink = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 70 && pixels[i + 1] < 70 && pixels[i + 2] < 70 && pixels[i + 3] > 0) ink++;
    return ink;
  }), { timeout: 20_000 }).toBeGreaterThan(12);
  await page.screenshot({ path: info.outputPath("decor-visible-wordmark.png") });
  expect(errors).toEqual([]); expect(writes).toBe(0);
});
