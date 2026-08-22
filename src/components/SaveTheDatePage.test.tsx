import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LanguageProvider } from "@/client/app/LanguageProvider";
import SaveTheDatePage from "./SaveTheDatePage";

function renderPage() {
  return render(
    <LanguageProvider>
      <SaveTheDatePage lang="en" />
    </LanguageProvider>,
  );
}

describe("SaveTheDatePage viewport behavior", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove("save-date-locked");
    document.body.classList.remove("save-date-locked");
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

    const trigger = screen.getByRole("button", { name: "Add to calendar" });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("dialog", { name: "Choose your calendar" }),
    ).toHaveAttribute("aria-hidden", "false");
  });
});
