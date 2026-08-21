import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const introResponse = new Response(
  JSON.stringify({
    status: "ok",
    guests: [],
    sideCounts: { bride: 0, groom: 0 },
  }),
  { status: 200, headers: { "content-type": "application/json" } },
);

describe("App routing", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    document.cookie = "wedding-lang=th; Path=/";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/");
  });

  it("shows the public save-the-date page without loading guest data", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(introResponse.clone());

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /Warissara.*Thasarit/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("15 · 11 · 2026")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "เพิ่มลงปฏิทิน" }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reveals calendar-provider choices from one primary action", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(introResponse.clone());

    render(<App />);

    fireEvent.click(
      await screen.findByRole("button", { name: "เพิ่มลงปฏิทิน" }),
    );

    const googleLink = screen.getByRole("link", { name: "Google Calendar" });
    expect(googleLink.getAttribute("href")).toContain(
      "dates=20261115T110000Z%2F20261115T150000Z",
    );
    expect(
      screen.getByRole("link", { name: /Apple Calendar.*Outlook/i }),
    ).toHaveAttribute("href", "/warissara-thasarit-wedding.ics");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the admin login when the dashboard API requires authentication", async () => {
    window.history.replaceState({}, "", "/admin");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 401 }),
    );

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Admin" })).toBeInTheDocument();
  });
});
