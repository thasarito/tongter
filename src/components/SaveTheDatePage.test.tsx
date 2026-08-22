import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/client/app/LanguageProvider";
import SaveTheDatePage from "./SaveTheDatePage";

interface TestLiff {
  init: ReturnType<typeof vi.fn>;
  isInClient: ReturnType<typeof vi.fn>;
  openWindow: ReturnType<typeof vi.fn>;
}

function setWindowLiff(liff: TestLiff | undefined) {
  Object.defineProperty(window, "liff", {
    configurable: true,
    value: liff,
  });
}

function renderPage() {
  return render(
    <LanguageProvider>
      <SaveTheDatePage lang="en" />
    </LanguageProvider>,
  );
}

function openCalendarChoices() {
  const trigger = screen.getByRole("button", { name: "Add to calendar" });
  fireEvent.click(trigger);
  return trigger;
}

describe("SaveTheDatePage viewport behavior", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove("save-date-locked");
    document.body.classList.remove("save-date-locked");
    setWindowLiff(undefined);
    vi.unstubAllEnvs();
  });

  it("locks document scrolling only while the route is mounted", () => {
    const view = renderPage();

    expect(document.documentElement).toHaveClass("save-date-locked");
    expect(document.body).toHaveClass("save-date-locked");

    view.unmount();

    expect(document.documentElement).not.toHaveClass("save-date-locked");
    expect(document.body).not.toHaveClass("save-date-locked");
  });

  it("opens calendar choices as an in-card overlay", () => {
    renderPage();

    const trigger = openCalendarChoices();

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("dialog", { name: "Choose your calendar" }),
    ).toHaveAttribute("aria-hidden", "false");
  });

  it("routes Google through its API and Apple through a browser handoff page", () => {
    renderPage();
    openCalendarChoices();

    const google = screen.getByRole("link", { name: "Google Calendar" });
    const apple = screen.getByRole("link", {
      name: "Apple Calendar / Outlook",
    });

    expect(google).toHaveAttribute(
      "href",
      "/api/calendar/google?lang=en&openExternalBrowser=1",
    );
    expect(apple).toHaveAttribute(
      "href",
      "/calendar/apple?lang=en&openExternalBrowser=1",
    );
    expect(apple).not.toHaveAttribute("download");
  });

  it("uses LIFF to open the Apple handoff page outside the LIFF browser", async () => {
    vi.stubEnv("VITE_LIFF_ID", "1234567890-test");
    const liff: TestLiff = {
      init: vi.fn(async () => undefined),
      isInClient: vi.fn(() => true),
      openWindow: vi.fn(),
    };
    setWindowLiff(liff);
    renderPage();

    await waitFor(() =>
      expect(liff.init).toHaveBeenCalledWith({ liffId: "1234567890-test" }),
    );
    openCalendarChoices();
    fireEvent.click(
      screen.getByRole("link", { name: "Apple Calendar / Outlook" }),
    );

    expect(liff.openWindow).toHaveBeenCalledWith({
      url: "http://localhost:3000/calendar/apple?lang=en&openExternalBrowser=1",
      external: true,
    });
  });
});
