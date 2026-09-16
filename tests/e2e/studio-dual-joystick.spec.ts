import { expect, test, type Locator, type Page } from "@playwright/test";
import { normalizeLayout } from "../../src/client/studio/model/schema";

test.use({ launchOptions: { args: ["--enable-unsafe-swiftshader"] } });
test.describe.configure({ timeout: 60_000 });
const moveStick = (page: Page) => page.getByRole("group", { name: "Walk joystick", exact: true });
const lookStick = (page: Page) => page.getByRole("group", { name: "Look joystick", exact: true });
async function chooseView(page: Page, name: string) {
  await page.getByRole("button", { name: "View panel", exact: true }).click();
  await page.getByRole("button", { name, exact: true }).click();
}
async function openWalk(page: Page) {
  const layout = normalizeLayout({ version: 3, title: "Synthetic dual controls", units: "metres", items: [{ id: "table-1", kind: "table", shape: "oval", label: "1", x: 0, z: 0, w: 2, d: 1.2, h: .76, rotation: 0, seats: 10, locked: false }], guestList: [{ id: "test-alice", name: "Alice", tableId: "table-1", seatNumber: 1 }] });
  const writes: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/admin/studio/layout", route => route.fulfill({ json: { status: "ok", source: "Google Sheets", layout, revision: "dual-test", fetchedAt: Date.now() } }));
  await page.route("**/api/admin/studio/mutations", async route => { writes.push(route.request().postData() ?? ""); await route.fulfill({ status: 409, json: { error: { message: "Camera controls must not write seating data." } } }); });
  await page.goto("/admin/studio");
  await page.getByLabel("Administrator passphrase").fill("local-e2e-passphrase");
  await page.getByRole("button", { name: "Open studio", exact: true }).click();
  await expect(page.locator(".studio-plan .studio-name-badge")).toHaveCount(1);
  await chooseView(page, "Walk inside");
  await expect(page.locator(".studio-three-view canvas")).toBeVisible();
  return { writes, errors };
}
async function center(stick: Locator) {
  const box = await stick.boundingBox();
  if (!box) throw Error("Joystick is not visible");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
// Observe the real WebGL image without exposing a test-only camera API.
const frame = (page: Page) => page.locator(".studio-three-view canvas").evaluate((canvas: HTMLCanvasElement) => {
  const gl = canvas.getContext("webgl2");
  if (!gl || gl.isContextLost()) throw Error("Expected a real WebGL renderer");
  const pixel = new Uint8Array(4), samples: number[] = [];
  for (const x of [.15, .3, .5, .7, .85]) for (const y of [.2, .4, .6, .8]) {
    gl.readPixels(Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    samples.push(...pixel);
  }
  return samples.join(",");
});
async function settledFrame(page: Page) {
  let previous = "", stable = 0;
  await expect.poll(async () => { const current = await frame(page); stable = current === previous ? stable + 1 : 0; previous = current; return stable; }, { timeout: 15_000, intervals: [150] }).toBeGreaterThanOrEqual(3);
  return previous;
}
async function neutral(stick: Locator) {
  await expect(stick).toHaveAttribute("data-active", "false");
  await expect(stick.locator(".studio-joystick-knob")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
}
async function startOne(page: Page, stick: Locator, mobile: boolean) {
  const start = await center(stick), end = { x: start.x + 33, y: start.y - 12 };
  if (mobile) {
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [end] });
    return async () => { await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await session.detach(); };
  }
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 3 });
  return async () => { await page.mouse.up(); };
}

test("walk mode replaces settings with two bounded thumb controls", async ({ page }, testInfo) => {
  const state = await openWalk(page);
  await expect(moveStick(page)).toBeVisible(); await expect(lookStick(page)).toBeVisible();
  await expect(page.locator(".studio-walk-settings")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Walking pace" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mouse look", exact: true })).toHaveCount(0);
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(async () => {
      const left = await moveStick(page).boundingBox(), right = await lookStick(page).boundingBox(), dock = await page.locator(".studio-bottom-bar").boundingBox();
      return !!left && !!right && !!dock && left.x >= 0 && right.x + right.width <= viewport.width && left.y >= 0 && right.y >= 0 && left.x + left.width < right.x && left.y + left.height < dock.y && right.y + right.height < dock.y;
    }).toBe(true);
    await expect(moveStick(page)).toHaveCSS("touch-action", "none"); await expect(lookStick(page)).toHaveCSS("touch-action", "none");
    await testInfo.attach(`dual-controls-${viewport.width}`, { body: await page.screenshot({ path: testInfo.outputPath(`dual-controls-${viewport.width}.png`) }), contentType: "image/png" });
  }
  await chooseView(page, "Floor plan");
  await expect(page.locator(".studio-joystick")).toHaveCount(0);
  expect(state.writes).toEqual([]); expect(state.errors).toEqual([]);
});

test("holding the right stick keeps looking without repeated pointer moves", async ({ page, isMobile }) => {
  const state = await openWalk(page); await expect(lookStick(page)).toBeVisible();
  const before = await settledFrame(page), end = await startOne(page, lookStick(page), isMobile);
  await expect(lookStick(page)).toHaveAttribute("data-active", "true");
  await expect.poll(() => frame(page), { timeout: 15_000 }).not.toBe(before);
  const held = await frame(page);
  await expect.poll(() => frame(page), { timeout: 15_000 }).not.toBe(held);
  await neutral(moveStick(page)); await end(); await neutral(lookStick(page));
  await settledFrame(page);
  expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual({ x: 0, y: 0 });
  expect(state.writes).toEqual([]); expect(state.errors).toEqual([]);
});

test("two fingers move and look independently and either can release first", async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile, "Requires simultaneous touchscreen input");
  const state = await openWalk(page); await expect(lookStick(page)).toBeVisible();
  const session = await page.context().newCDPSession(page);
  const left = { ...await center(moveStick(page)), id: 1 }, right = { ...await center(lookStick(page)), id: 2 };
  const moving = { ...left, y: left.y - 34 }, looking = { ...right, x: right.x + 30 };
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [left] });
  await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [moving] });
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [moving, right] });
  await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [moving, looking] });
  await expect(moveStick(page)).toHaveAttribute("data-active", "true"); await expect(lookStick(page)).toHaveAttribute("data-active", "true");
  const both = await frame(page); await expect.poll(() => frame(page), { timeout: 15_000 }).not.toBe(both);
  // End only the right finger. The left must retain pointer capture and movement.
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [moving] });
  await neutral(lookStick(page)); await expect(moveStick(page)).toHaveAttribute("data-active", "true");
  const walking = await frame(page); await expect.poll(() => frame(page), { timeout: 15_000 }).not.toBe(walking);
  // Reacquire the look stick, then release only movement.
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [moving, right] });
  await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [moving, looking] });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [looking] });
  await neutral(moveStick(page)); await expect(lookStick(page)).toHaveAttribute("data-active", "true");
  const turning = await frame(page); await expect.poll(() => frame(page), { timeout: 15_000 }).not.toBe(turning);
  await session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }); await session.detach();
  await neutral(moveStick(page)); await neutral(lookStick(page)); await settledFrame(page);
  await testInfo.attach("dual-controls-restored", { body: await page.screenshot({ path: testInfo.outputPath("dual-controls-restored.png") }), contentType: "image/png" });
  expect(state.writes).toEqual([]); expect(state.errors).toEqual([]);
});

test("interrupted look input clears on blur, Escape, resize and opening panels", async ({ page, isMobile }) => {
  const state = await openWalk(page); await expect(lookStick(page)).toBeVisible();
  for (const reason of ["blur", "Escape", "resize"] as const) {
    const end = await startOne(page, lookStick(page), isMobile);
    await expect(lookStick(page)).toHaveAttribute("data-active", "true");
    if (reason === "Escape") await page.keyboard.press("Escape");
    else await page.evaluate(event => window.dispatchEvent(new Event(event)), reason);
    await end(); await neutral(moveStick(page)); await neutral(lookStick(page));
  }
  const end = await startOne(page, lookStick(page), isMobile);
  // Keyboard activation opens the panel while the look pointer is still held.
  const guests = page.getByRole("button", { name: "Guests panel", exact: true });
  await guests.focus(); await page.keyboard.press("Enter");
  await expect(moveStick(page)).toBeHidden(); await expect(lookStick(page)).toBeHidden();
  await end(); await page.getByRole("button", { name: "Close planning tools", exact: true }).click();
  await neutral(moveStick(page)); await neutral(lookStick(page)); await settledFrame(page);
  await chooseView(page, "Floor plan"); await chooseView(page, "Walk inside");
  await neutral(moveStick(page)); await neutral(lookStick(page));
  expect(state.writes).toEqual([]); expect(state.errors).toEqual([]);
});
