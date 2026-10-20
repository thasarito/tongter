import { expect, test, type Page } from "@playwright/test";
import { enterAdminPasscode } from "./admin-login";
import { normalizeLayout } from "../../src/client/studio/model/schema";
import { applyMutation, type StudioMutation } from "../../src/shared/studio-mutations";

test.use({ launchOptions: { args: ["--enable-unsafe-swiftshader"] } });

async function openStudio(page: Page) {
  let layout = normalizeLayout({
    version: 3, title: "Synthetic RSVP verification", units: "metres",
    items: [{ id: "table-5", kind: "table", shape: "oval", label: "5", x: 0, z: 0, w: 2, d: 1.2, h: .76, rotation: 0, seats: 10 }],
    guestList: [
      { id: "alice", name: "Alice", tableId: "table-5", seatNumber: 1 },
      { id: "bob", name: "Bob", tableId: "table-5", seatNumber: 4, rsvp: "Confirmed" },
      { id: "chompoo", name: "ชมพู่", tableId: "table-5", seatNumber: 6, rsvp: "Maybe" },
      { id: "dan", name: "Dan", tableId: "table-5", seatNumber: 9, rsvp: "Declined" },
    ],
  });
  const operations: StudioMutation[] = [];
  const snapshot = () => ({ status: "ok", source: "Google Sheets", layout, revision: String(operations.length), fetchedAt: Date.now() });
  await page.route("**/api/admin/studio/layout", route => route.fulfill({ json: snapshot() }));
  await page.route("**/api/admin/studio/mutations", async route => {
    const operation = route.request().postDataJSON() as StudioMutation;
    operations.push(operation); layout = applyMutation(layout, operation);
    await route.fulfill({ json: { ...snapshot(), operationId: operation.id } });
  });
  await page.goto("/admin/studio"); await enterAdminPasscode(page);
  await expect(page.locator(".studio-plan .studio-name-badge")).toHaveCount(4);
  return { operations, read: () => layout };
}

const badge = (page: Page, id: string) => page.locator(`.studio-plan .studio-name-badge[data-guest-drag="${id}"]`);

test("tap a guest, autosave all four statuses and a note, and retain them after reload", async ({ page, isMobile }, testInfo) => {
  const sheet = await openStudio(page);
  await expect(page.locator('[data-table-confirmation="table-5"]')).toHaveText("Confirmed 1/10");
  await expect(badge(page, "alice").locator("rect")).toHaveAttribute("fill", "#fffef5");
  if (isMobile) await badge(page, "alice").tap(); else await badge(page, "alice").click();
  const dialog = page.getByRole("dialog", { name: "RSVP · Alice" });
  await expect(dialog).toBeVisible();
  if (!isMobile) {
    const bounds = await dialog.boundingBox(), viewport = page.viewportSize()!;
    expect(Math.abs(bounds!.x + bounds!.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(bounds!.y + bounds!.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(1);
  }
  await dialog.getByRole("button", { name: "คอนเฟิร์มว่ามา", exact: true }).click();
  await expect.poll(() => sheet.read().guestList[0].rsvp).toBe("Confirmed");
  await expect(page.locator('[data-table-confirmation="table-5"]')).toHaveText("Confirmed 2/10");
  await expect(badge(page, "alice").locator("rect")).toHaveAttribute("fill", "#e0eddf");
  await expect(page.locator("[data-sheet-confirmation]")).toHaveCount(0);
  await dialog.getByLabel("หมายเหตุ", { exact: true }).fill("มากับแฟน / รอแจ้งชื่ออีกที");
  await expect.poll(() => sheet.read().guestList[0].notes).toBe("มากับแฟน / รอแจ้งชื่ออีกที");
  await testInfo.attach("rsvp-popup", { body: await page.screenshot({ path: testInfo.outputPath("rsvp-popup.png") }), contentType: "image/png" });
  for (const [label, value, color] of [["ติดต่อแล้ว รอคำตอบ", "Maybe", "#fff1c8"], ["คอนเฟิร์มว่าไม่มา", "Declined", "#f8dfd9"], ["ยังไม่ได้ติดต่อ", "Pending", "#fffef5"]]) {
    await dialog.getByRole("button", { name: label, exact: true }).click();
    await expect.poll(() => sheet.read().guestList[0].rsvp).toBe(value);
    await expect(badge(page, "alice").locator("rect")).toHaveAttribute("fill", color);
    await expect(page.locator('[data-table-confirmation="table-5"]')).toHaveText("Confirmed 1/10");
  }
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.reload(); await expect(badge(page, "alice")).toHaveAttribute("data-rsvp", "Pending");
  await badge(page, "alice").click();
  await expect(dialog.getByLabel("หมายเหตุ", { exact: true })).toHaveValue("มากับแฟน / รอแจ้งชื่ออีกที");
  expect(sheet.read().guestList[0]).toMatchObject({ tableId: "table-5", seatNumber: 1 });
});

test("popup fits small phones and landscape with touch-sized actions", async ({ page }, testInfo) => {
  await openStudio(page); await badge(page, "alice").click();
  const dialog = page.getByRole("dialog", { name: "RSVP · Alice" });
  for (const size of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    const metrics = await dialog.evaluate(node => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, overflow: node.scrollWidth > node.clientWidth,
        buttons: Array.from(node.querySelectorAll(".studio-rsvp-options button"), button => button.getBoundingClientRect().height) };
    });
    expect(metrics.x).toBeGreaterThanOrEqual(0); expect(metrics.y).toBeGreaterThanOrEqual(0);
    expect(metrics.x + metrics.width).toBeLessThanOrEqual(size.width + 1); expect(metrics.y + metrics.height).toBeLessThanOrEqual(size.height + 1);
    expect(metrics.overflow).toBe(false); expect(metrics.buttons.every(height => height >= 44)).toBe(true);
    await testInfo.attach(`rsvp-${size.width}x${size.height}`, { body: await page.screenshot({ path: testInfo.outputPath(`rsvp-${size.width}x${size.height}.png`) }), contentType: "image/png" });
  }
});

test("declined guest keeps their seat through the full editor and roster opens RSVP directly", async ({ page }) => {
  const sheet = await openStudio(page); await badge(page, "dan").click();
  await page.getByRole("button", { name: "รายละเอียดแขก", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Edit guest", exact: true });
  await form.getByLabel("Notes", { exact: true }).fill("Unable to travel");
  await form.getByRole("button", { name: "Save guest", exact: true }).click();
  await page.locator("[data-sheet-confirmation]").getByRole("button", { name: "Confirm", exact: true }).click();
  await expect.poll(() => sheet.read().guestList[3].notes).toBe("Unable to travel");
  expect(sheet.read().guestList[3]).toMatchObject({ rsvp: "Declined", tableId: "table-5", seatNumber: 9 });
  await page.getByRole("button", { name: "Guests panel", exact: true }).click();
  await page.getByRole("combobox", { name: "Show", exact: true }).selectOption("all");
  const name = page.locator('.studio-roster-row .studio-rsvp-name').filter({ hasText: "Dan" });
  await expect(name).toHaveCSS("background-color", "rgb(248, 223, 217)");
  await name.click(); await expect(page.getByRole("dialog", { name: "RSVP · Dan" })).toBeVisible();
});

test("3D name labels show RSVP colors and open the same popup", async ({ page }) => {
  await openStudio(page);
  await page.getByRole("button", { name: "View panel", exact: true }).click();
  await page.getByRole("button", { name: "3D model", exact: true }).click();
  const name = page.locator('.studio-seat-name-label[data-guest-drag="bob"]');
  await expect(name).toBeVisible({ timeout: 20_000 });
  await expect(name).toHaveCSS("background-color", "rgb(224, 237, 223)");
  // Room overview intentionally shows distant tables. Zoom into this compact
  // fixture so adjacent chair labels can be tapped individually.
  await page.getByRole("button", { name: "View panel", exact: true }).click();
  for (let step = 0; step < 6; step++) await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Close planning tools", exact: true }).click();
  await name.click(); await expect(page.getByRole("dialog", { name: "RSVP · Bob" })).toBeVisible();
});
