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
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /viewport-fit=cover/,
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#9c9d88",
  );
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    ),
  ).toBe("rgb(156, 157, 136)");

  const fullBleedShell = await page.evaluate(() => {
    const root = document.getElementById("root");
    const stage = document.querySelector("main");
    if (!root || !stage) throw new Error("Save the Date shell is missing");
    return {
      viewportHeight: window.innerHeight,
      rootHeight: root.getBoundingClientRect().height,
      stageTop: stage.getBoundingClientRect().top,
    };
  });
  expect(fullBleedShell.stageTop).toBe(0);
  expect(fullBleedShell.rootHeight).toBeGreaterThanOrEqual(
    fullBleedShell.viewportHeight,
  );

  await expect(
    page.getByRole("heading", { name: /Warissara.*Thasarit/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Warissara.*Thasarit/i }),
  ).toHaveAttribute("src", "/logo.svg");
  await expect(
    page.getByRole("button", { name: /เพิ่มลงปฏิทิน|add to calendar/i }),
  ).toBeVisible();
  expect(journeyRequests).toBe(0);

  const logoFile = await page.request.get("/logo.svg");
  await expect(logoFile).toBeOK();
  const logoMarkup = await logoFile.text();
  expect(logoMarkup).toContain("<path");
  expect(logoMarkup).not.toMatch(/<(?:image|text)\b/);

  const faviconFile = await page.request.get("/favicon.svg");
  await expect(faviconFile).toBeOK();
  const faviconMarkup = await faviconFile.text();
  expect(faviconMarkup).toContain("<path");
  expect(faviconMarkup).not.toContain("<text");

  await page
    .getByRole("button", { name: /เพิ่มลงปฏิทิน|add to calendar/i })
    .click();

  const calendarOverlay = page.getByRole("dialog", {
    name: /เลือกปฏิทินที่คุณใช้|choose your calendar/i,
  });
  await expect(calendarOverlay).toBeVisible();
  await expect(calendarOverlay).toHaveCSS("position", "absolute");

  const lockedViewport = await page.evaluate(() => {
    const stage = document.querySelector("main");
    if (!stage) throw new Error("Save the Date stage is missing");
    return {
      htmlLocked: document.documentElement.classList.contains("save-date-locked"),
      bodyLocked: document.body.classList.contains("save-date-locked"),
      htmlOverflow: getComputedStyle(document.documentElement).overflow,
      bodyOverflow: getComputedStyle(document.body).overflow,
      bodyPosition: getComputedStyle(document.body).position,
      stagePosition: getComputedStyle(stage).position,
    };
  });
  expect(lockedViewport).toEqual({
    htmlLocked: true,
    bodyLocked: true,
    htmlOverflow: "hidden",
    bodyOverflow: "hidden",
    bodyPosition: "fixed",
    stagePosition: "fixed",
  });

  await page.evaluate(() => window.scrollTo(0, 300));
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await expect(
    page.getByRole("link", { name: "Google Calendar" }),
  ).toHaveAttribute(
    "href",
    "/api/calendar/google?lang=th&openExternalBrowser=1",
  );
  await expect(
    page.getByRole("link", { name: /Apple Calendar.*Outlook/i }),
  ).toHaveAttribute(
    "href",
    "/?calendar=apple&lang=th&openExternalBrowser=1",
  );

  const googleCalendar = await page.request.get("/api/calendar/google?lang=th", {
    maxRedirects: 0,
  });
  expect(googleCalendar.status()).toBe(302);
  expect(googleCalendar.headers().location).toContain(
    "https://calendar.google.com/calendar/render?",
  );

  await page.goto("/?calendar=apple&lang=th");
  await expect(page).toHaveURL(/\/\?calendar=apple&lang=th$/);
  await expect(
    page.getByRole("heading", { name: /Warissara.*Thasarit/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Warissara.*Thasarit/i }),
  ).toHaveAttribute("src", "/logo.svg");
  await expect(page.getByText("15 · 11 · 2026")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "ดาวน์โหลดไฟล์ปฏิทิน" }),
  ).toHaveAttribute("href", "/api/calendar/download?lang=th");
  await expect(
    page.getByRole("link", { name: "ดาวน์โหลดไฟล์ปฏิทิน" }),
  ).toHaveAttribute("download", "warissara-thasarit-wedding.ics");

  const calendarFile = await page.request.get("/api/calendar/download?lang=th");
  await expect(calendarFile).toBeOK();
  expect(calendarFile.headers()["content-type"]).toContain(
    "application/octet-stream",
  );
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
