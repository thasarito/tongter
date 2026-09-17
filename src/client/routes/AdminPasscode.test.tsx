import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { ApiError, weddingApi } from "@/client/api/client";
import { LanguageProvider } from "@/client/app/LanguageProvider";
import { AdminQrRoute, AdminRoute } from "./AdminRoutes";
import AdminStudioRoute from "./AdminStudioRoute";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it.each([
  ["dashboard", () => <AdminRoute />],
  ["QR cards", () => <AdminQrRoute />],
  ["studio", () => <AdminStudioRoute />],
] as const)("provides a four-dot numeric keypad for %s", async (_name, route) => {
  vi.spyOn(weddingApi, "adminSummary").mockRejectedValue(new ApiError(401, "Unauthorized"));
  vi.spyOn(weddingApi, "adminQr").mockRejectedValue(new ApiError(401, "Unauthorized"));
  render(<LanguageProvider><MemoryRouter>{route()}</MemoryRouter></LanguageProvider>);
  expect(await screen.findByRole("heading", { name: "Enter Passcode" })).toBeVisible();
  expect(screen.getByRole("main").querySelectorAll("[data-passcode-dot]")).toHaveLength(4);
  for (const digit of "1234567890") expect(screen.getByRole("button", { name: digit, exact: true })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
});
