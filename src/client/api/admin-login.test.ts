import { afterEach, expect, it, vi } from "vitest";
import { ApiError, weddingApi } from "./client";

afterEach(() => vi.restoreAllMocks());

it("forwards cancellation while keeping the existing credentialed login contract", async () => {
  const controller = new AbortController();
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
  await expect(weddingApi.adminLogin("1357", controller.signal)).resolves.toBeUndefined();
  expect(fetchMock).toHaveBeenCalledWith("/api/admin/login", {
    method: "POST", credentials: "include", signal: controller.signal,
    headers: { "content-type": "application/json" }, body: JSON.stringify({ passphrase: "1357" }),
  });
});

it("retains the response status needed to distinguish wrong PINs from network errors", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
  await expect(weddingApi.adminLogin("0000")).rejects.toBeInstanceOf(ApiError);
});
