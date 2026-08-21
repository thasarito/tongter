import { Hono } from "hono";

export function createApp() {
  return new Hono().get("/api/health", (c) => {
    c.header("Cache-Control", "no-store");
    return c.json({ ok: true } as const, 200);
  });
}

export type AppType = ReturnType<typeof createApp>;
