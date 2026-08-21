import { buildMockDataset } from "@/shared/mock-dataset";
import type { Snapshot } from "@/shared/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import type { WorkerBindings } from "../env";
import type { SnapshotRepository } from "../services/snapshot";

const dataset = buildMockDataset({ readableTokens: true });
const snapshot: Snapshot = {
  status: "ok",
  ...dataset,
  fetchedAt: 1_700_000_000_000,
  warnings: [],
};
const env: WorkerBindings = {
  GOOGLE_SHEET_ID: "",
  GOOGLE_CREDENTIALS_JSON: "",
  ADMIN_PASSPHRASE: "open sesame",
  ADMIN_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
};

describe("administrator API", () => {
  let repository: SnapshotRepository;

  beforeEach(() => {
    repository = {
      getSnapshot: vi.fn(async () => snapshot),
      invalidate: vi.fn(),
      appendRsvp: vi.fn(),
    };
  });

  const app = () => createApp({
    repositoryFor: () => repository,
    now: () => 1_700_000_000_000,
  });

  async function loginCookie() {
    const response = await app().request(
      "/api/admin/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passphrase: "open sesame" }),
      },
      env,
    );
    expect(response.status).toBe(204);
    return response.headers.get("set-cookie")!;
  }

  it("rejects a bad passphrase without setting a cookie", async () => {
    const response = await app().request(
      "/api/admin/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passphrase: "wrong" }),
      },
      env,
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("sets a secure scoped cookie and serves the dashboard", async () => {
    const cookie = await loginCookie();
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/api/admin");

    const response = await app().request(
      "/api/admin/summary?lang=en",
      { headers: { cookie } },
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      totals: { seatsTotal: 170, groupsTotal: dataset.groups.length },
    });
  });

  it("rejects protected routes without a session", async () => {
    const response = await app().request("/api/admin/summary", {}, env);
    expect(response.status).toBe(401);
  });

  it("invalidates the repository and logs out", async () => {
    const cookie = await loginCookie();
    const sync = await app().request(
      "/api/admin/sync",
      { method: "POST", headers: { cookie } },
      env,
    );
    expect(sync.status).toBe(204);
    expect(repository.invalidate).toHaveBeenCalledOnce();

    const logout = await app().request(
      "/api/admin/logout",
      { method: "POST", headers: { cookie } },
      env,
    );
    expect(logout.status).toBe(204);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
