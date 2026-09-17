import { expect, type Page } from "@playwright/test";

// Synthetic local-only credential from .dev.vars.test, never the deployed code.
export const E2E_ADMIN_PASSCODE = "1357";
export async function enterAdminPasscode(page: Page, code = E2E_ADMIN_PASSCODE) {
  await expect(page.getByRole("heading", { name: "Enter Passcode" })).toBeVisible();
  for (const digit of code) await page.getByRole("button", { name: digit, exact: true }).click();
}
