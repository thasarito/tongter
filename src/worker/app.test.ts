import { describe, expect, it } from "vitest";
import { createApp } from "./app";

describe("worker app", () => {
  it("returns a cache-safe health response", async () => {
    const response = await createApp().request("/api/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true });
  });
});
