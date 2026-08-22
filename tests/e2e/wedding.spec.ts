import { expect, test } from "@playwright/test";

test("serves the save-the-date landing and Worker API from one origin", async ({ page }) => {
  const health = await page.request.get("/api/health");
  await expect(health).toBeOK();
  await expect(health.json()).resolves.toEqual({ ok: true });

  let journeyRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/journey") journeyRequests += 1;
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Warissara.*Thasarit/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /เพิ่มลงปฏิทิน|add to calendar/i }),
  ).toBeVisible();
  expect(journeyRequests).toBe(0);

  await page
    .getByRole("button", { name: /เพิ่มลงปฏิทิน|add to calendar/i })
    .click();
  await expect(page.getByRole("link", { name: "Google Calendar" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Apple Calendar.*Outlook/i }),
  ).toHaveAttribute("href", "/warissara-thasarit-wedding.ics");

  const calendarFile = await page.request.get("/warissara-thasarit-wedding.ics");
  await expect(calendarFile).toBeOK();
  expect(await calendarFile.text()).toContain(
    "DTSTART;TZID=Asia/Bangkok:20261115T180000",
  );
});

test("opens a printed group invitation directly", async ({ page }) => {
  await page.goto("/rsvp/demo001");
  await expect(
    page.getByRole("heading", { name: /หาชื่อของคุณ|find your name/i }),
  ).toBeVisible();
});

test("submits a partial group RSVP and reveals the seat", async ({ page }) => {
  await page.goto("/rsvp/demo001");
  await page.getByRole("searchbox", { name: /หาชื่อของคุณ|find your name/i }).fill("View");
  await page.getByRole("button", { name: /วิว/i }).click();
  await page.getByRole("radio", { name: /เข้าร่วมงาน|attending/i }).check();
  await page.getByRole("button", { name: /เสร็จสิ้น|finish here/i }).click();

  await expect(page).toHaveURL(/\/seat\/demo001\?celebrate=1/);
  await expect(page.getByText(/ขอบคุณสำหรับการตอบรับ|thank you for responding/i)).toBeVisible();
});

test("authenticates the admin dashboard and opens QR cards", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("Passphrase").fill("local-e2e-passphrase");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "RSVP dashboard" })).toBeVisible();
  await page.getByRole("link", { name: /QR cards for all/i }).click();
  await expect(page.getByRole("heading", { name: "QR cards" })).toBeVisible();
});
