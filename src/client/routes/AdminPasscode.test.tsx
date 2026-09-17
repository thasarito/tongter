import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, weddingApi } from "@/client/api/client";
import { LanguageProvider } from "@/client/app/LanguageProvider";
import { AdminQrRoute, AdminRoute } from "./AdminRoutes";
import AdminStudioRoute from "./AdminStudioRoute";

function renderLogin(element = <AdminRoute />) {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={element} />
          <Route path="/" element={<h1>Wedding home</h1>} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}
async function ready() {
  await screen.findByRole("heading", { name: "Enter Passcode" });
  return screen.getByRole("main");
}
function tap(code: string) {
  for (const digit of code) fireEvent.click(screen.getByRole("button", { name: digit }));
}
function progress(count: number) {
  expect(screen.getByRole("status")).toHaveTextContent(`${count} of 4 digits entered`);
}

describe("administrator passcode screen", () => {
  beforeEach(() => {
    vi.spyOn(weddingApi, "adminSummary").mockRejectedValue(new ApiError(401, "Unauthorized"));
    vi.spyOn(weddingApi, "adminQr").mockRejectedValue(new ApiError(401, "Unauthorized"));
    vi.spyOn(weddingApi, "adminLogin").mockImplementation(() => new Promise(() => {}));
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it.each([
    ["dashboard", () => <AdminRoute />],
    ["QR cards", () => <AdminQrRoute />],
    ["studio", () => <AdminStudioRoute />],
  ] as const)("uses the same four-dot keypad for %s", async (_name, route) => {
    renderLogin(route());
    const main = await ready();
    expect(main.querySelectorAll("[data-passcode-dot]")).toHaveLength(4);
    for (const digit of "1234567890") expect(screen.getByRole("button", { name: digit })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
    expect(main.querySelector("input")).toBeNull();
    expect(screen.queryByRole("button", { name: /sign in|open studio/i })).not.toBeInTheDocument();
    progress(0);
  });

  it("masks partial input without sending an incomplete passcode", async () => {
    renderLogin(); await ready(); tap("135");
    progress(3);
    expect(screen.getByRole("main")).not.toHaveTextContent("135");
    expect(weddingApi.adminLogin).not.toHaveBeenCalled();
  });

  it("submits on the fourth digit and blocks additional taps and keys while checking", async () => {
    renderLogin(); const main = await ready(); tap("1357");
    expect(weddingApi.adminLogin).toHaveBeenCalledWith("1357", expect.any(AbortSignal));
    expect(screen.getByText("Checking…")).toBeVisible();
    for (const digit of "1234567890") expect(screen.getByRole("button", { name: digit })).toBeDisabled();
    tap("9"); fireEvent.keyDown(main, { key: "9" }); fireEvent.keyDown(main, { key: "Enter" });
    expect(weddingApi.adminLogin).toHaveBeenCalledTimes(1);
    progress(4);
  });

  it("supports physical digits and Backspace without swallowing browser shortcuts", async () => {
    renderLogin(); const main = await ready();
    fireEvent.keyDown(main, { key: "1" });
    fireEvent.keyDown(main, { key: "1", repeat: true });
    fireEvent.keyDown(main, { key: "a" });
    fireEvent.keyDown(main, { key: "2", ctrlKey: true });
    fireEvent.keyDown(main, { key: "3", metaKey: true });
    fireEvent.keyDown(main, { key: "4", altKey: true });
    progress(1);
    fireEvent.keyDown(main, { key: "Backspace" }); progress(0);
    for (const key of "0135") fireEvent.keyDown(main, { key });
    expect(weddingApi.adminLogin).toHaveBeenCalledWith("0135", expect.any(AbortSignal));
  });

  it("changes Cancel to Delete while entering, then returns to Cancel when empty", async () => {
    renderLogin(); await ready(); tap("13");
    fireEvent.click(screen.getByRole("button", { name: "Delete" })); progress(1);
    fireEvent.click(screen.getByRole("button", { name: "Delete" })); progress(0);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("heading", { name: "Wedding home" })).toBeVisible();
    expect(weddingApi.adminLogin).not.toHaveBeenCalled();
  });

  it("allows Escape to leave a partially entered passcode", async () => {
    renderLogin(); const main = await ready(); tap("13");
    fireEvent.keyDown(main, { key: "Escape" });
    expect(screen.getByRole("heading", { name: "Wedding home" })).toBeVisible();
  });

  it("clears a rejected passcode, announces the error and allows an immediate retry", async () => {
    vi.mocked(weddingApi.adminLogin).mockRejectedValueOnce(new ApiError(401, "Unauthorized"));
    renderLogin(); await ready(); tap("1111");
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect passcode. Try again.");
    progress(0);
    expect(screen.getByRole("main")).toHaveFocus();
    tap("1"); progress(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    tap("357");
    expect(weddingApi.adminLogin).toHaveBeenLastCalledWith("1357", expect.any(AbortSignal));
  });

  it("distinguishes a connection failure from an incorrect passcode", async () => {
    vi.mocked(weddingApi.adminLogin).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderLogin(); await ready(); tap("1357");
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to connect. Please try again.");
    progress(0);
    expect(screen.getByRole("button", { name: "1" })).toBeEnabled();
  });

  it("refreshes the protected route after a successful login", async () => {
    vi.mocked(weddingApi.adminLogin).mockResolvedValueOnce(undefined);
    renderLogin(); await ready(); tap("1357");
    await waitFor(() => expect(weddingApi.adminSummary).toHaveBeenCalledTimes(2));
    expect(weddingApi.adminLogin).toHaveBeenCalledTimes(1);
  });

  it("aborts a pending request on Cancel and ignores a late resolution", async () => {
    let finish!: () => void;
    vi.mocked(weddingApi.adminLogin).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    renderLogin(); await ready(); tap("1357");
    const [, signal] = vi.mocked(weddingApi.adminLogin).mock.calls[0];
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(signal?.aborted).toBe(true);
    await act(async () => { finish(); });
    expect(screen.getByRole("heading", { name: "Wedding home" })).toBeVisible();
    expect(weddingApi.adminSummary).toHaveBeenCalledTimes(1);
  });

  it("accepts an exact four-digit paste without silently truncating other text", async () => {
    renderLogin(); const main = await ready();
    for (const value of ["12345", "x1357", "13-57"]) fireEvent.paste(main, { clipboardData: { getData: () => value } });
    progress(0);
    expect(weddingApi.adminLogin).not.toHaveBeenCalled();
    fireEvent.paste(main, { clipboardData: { getData: () => "0135" } });
    expect(weddingApi.adminLogin).toHaveBeenCalledWith("0135", expect.any(AbortSignal));
  });
});
