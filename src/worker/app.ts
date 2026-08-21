import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import {
  productionDependencies,
  type AppDependencies,
} from "./dependencies";
import type { WorkerBindings } from "./env";
import { adminRoutes } from "./routes/admin";
import { publicRoutes } from "./routes/public";

export function createApp(deps: AppDependencies = productionDependencies) {
  return new Hono<{ Bindings: WorkerBindings }>()
    .use("/api/*", secureHeaders())
    .use(
      "/api/*",
      bodyLimit({
        maxSize: 64 * 1024,
        onError: (c) => c.json({ error: { code: "BODY_TOO_LARGE", message: "Request is too large." } }, 413),
      }),
    )
    .route("/api", publicRoutes(deps))
    .route("/api/admin", adminRoutes(deps));
}

export type AppType = ReturnType<typeof createApp>;
