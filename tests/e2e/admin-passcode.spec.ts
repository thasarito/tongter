import { expect, test } from "@playwright/test";
import { enterAdminPasscode } from "./admin-login";

test("all protected routes share the uncluttered numeric screen", async ({ page }) => {
  for (const route of ["/admin", "/admin/qr", "/admin/studio"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { name: "Enter Passcode" })).toBeVisible();
    await expect(page.locator("[data-passcode-dot]")).toHaveCount(4);
    await expect(page.locator("input")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Administrator tools" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
    await expect(page.locator(".passcode-key")).toHaveCount(10);
  }
});

test("cream-and-gold circles fit phones, desktop and landscape without clipping", async ({ page }, testInfo) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Enter Passcode" })).toBeVisible();
  for (const size of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    const metrics = await page.evaluate(() => {
      const screen = document.querySelector(".passcode-screen")!;
      return {
        top: screen.getBoundingClientRect().top,
        height: screen.getBoundingClientRect().height,
        background: getComputedStyle(screen).backgroundColor,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        keys: Array.from(document.querySelectorAll(".passcode-key"), key => {
          const box = key.getBoundingClientRect();
          return { x: box.x, y: box.y, width: box.width, height: box.height };
        }),
      };
    });
    expect(metrics.top).toBe(0);
    expect(metrics.height).toBeGreaterThanOrEqual(size.height);
    expect(metrics.background).toBe("rgb(251, 248, 243)");
    expect(metrics.horizontalOverflow).toBe(false);
    for (const key of metrics.keys) {
      expect(key.width).toBeGreaterThanOrEqual(44);
      expect(Math.abs(key.width - key.height)).toBeLessThan(1);
      expect(key.x).toBeGreaterThanOrEqual(0);
      expect(key.y).toBeGreaterThanOrEqual(0);
      expect(key.x + key.width).toBeLessThanOrEqual(size.width);
      expect(key.y + key.height).toBeLessThanOrEqual(size.height);
    }
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeInViewport();
    await testInfo.attach(`passcode-${size.width}x${size.height}`, {
      body: await page.screenshot({ path: testInfo.outputPath(`passcode-${size.width}x${size.height}.png`) }),
      contentType: "image/png",
    });
  }
});

test("touch keypad retries after a wrong code and unlocks without a submit button", async ({ page }) => {
  await page.goto("/admin");
  await enterAdminPasscode(page, "0000");
  await expect(page.getByRole("alert")).toHaveText("Incorrect passcode. Try again.");
  await expect(page.getByRole("status")).toContainText("0 of 4 digits entered");
  await enterAdminPasscode(page);
  await expect(page.getByRole("heading", { name: "RSVP dashboard" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Administrator tools" })).toBeVisible();
});

test("physical digits and Backspace unlock, while Escape cancels partial input", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Enter Passcode" })).toBeVisible();
  await page.keyboard.type("13");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Enter Passcode" })).toBeVisible();
  await page.keyboard.type("13");
  await page.keyboard.press("Backspace");
  await expect(page.getByRole("status")).toContainText("1 of 4 digits entered");
  await page.keyboard.type("357");
  await expect(page.getByRole("heading", { name: "RSVP dashboard" })).toBeVisible();
});

test("keyboard activation works on buttons and reduced motion disables the error shake", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/admin");
  const one = page.getByRole("button", { name: "1", exact: true });
  await one.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("1 of 4 digits entered");
  const remove = page.getByRole("button", { name: "Delete", exact: true });
  await remove.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("status")).toContainText("0 of 4 digits entered");
  await enterAdminPasscode(page, "0000");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".passcode-dots")).toHaveCSS("animation-name", "none");
});
