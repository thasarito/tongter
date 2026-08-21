import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, expect, it } from "vitest";
import App from "./App";

describe("App routing", () => {
  it("loads the wedding journey from the Worker API on the home route", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ok",
          guests: [],
          sideCounts: { bride: 0, groom: 0 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    render(<App />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/journey?lang=th", {
        credentials: "include",
      }),
    );
    fetchMock.mockRestore();
  });

  it("shows the admin login when the dashboard API requires authentication", async () => {
    window.history.replaceState({}, "", "/admin");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 401 }));

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Admin" })).toBeInTheDocument();
    fetchMock.mockRestore();
    window.history.replaceState({}, "", "/");
  });
});
