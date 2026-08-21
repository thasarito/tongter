import {
  allowDietaryOther,
  dietaryOptions,
  siteUrl,
} from "@/shared/event-config";
import { isLang, type Lang } from "@/shared/i18n";
import { buildAdminView, buildQrSheetView } from "@/shared/views";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { AppDependencies } from "../dependencies";
import type { WorkerBindings } from "../env";
import {
  ADMIN_COOKIE,
  ADMIN_MAX_AGE_SECONDS,
  createAdminSession,
  passphraseMatches,
  verifyAdminSession,
} from "../auth/admin-session";
import { apiError } from "../contracts";

function language(raw: string | undefined): Lang {
  return raw && isLang(raw) ? raw : "th";
}

const loginSchema = z.object({ passphrase: z.string().min(1).max(500) });

export function adminRoutes(deps: AppDependencies) {
  return new Hono<{ Bindings: WorkerBindings }>()
    .post("/login", async (c) => {
      const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
      if (
        !parsed.success ||
        !c.env.ADMIN_PASSPHRASE ||
        !(await passphraseMatches(parsed.data.passphrase, c.env.ADMIN_PASSPHRASE))
      ) {
        return c.json(apiError("UNAUTHORIZED", "Invalid passphrase."), 401);
      }
      const token = await createAdminSession({
        secret: c.env.ADMIN_SESSION_SECRET,
        now: deps.now,
      });
      setCookie(c, ADMIN_COOKIE, token, {
        path: "/api/admin",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        maxAge: ADMIN_MAX_AGE_SECONDS,
      });
      return c.body(null, 204);
    })
    .use("*", async (c, next) => {
      const token = getCookie(c, ADMIN_COOKIE);
      if (
        !token ||
        !c.env.ADMIN_SESSION_SECRET ||
        !(await verifyAdminSession(token, {
          secret: c.env.ADMIN_SESSION_SECRET,
          now: deps.now,
        }))
      ) {
        return c.json(apiError("UNAUTHORIZED", "Authentication required."), 401);
      }
      await next();
    })
    .post("/logout", (c) => {
      deleteCookie(c, ADMIN_COOKIE, { path: "/api/admin", secure: true });
      return c.body(null, 204);
    })
    .post("/sync", (c) => {
      deps.repositoryFor(c.env).invalidate();
      return c.body(null, 204);
    })
    .get("/summary", async (c) => {
      const snapshot = await deps.repositoryFor(c.env).getSnapshot();
      return c.json(
        buildAdminView(snapshot, {
          lang: language(c.req.query("lang")),
          dietaryOptions,
          allowDietaryOther,
        }),
        200,
      );
    })
    .get("/qr", async (c) => {
      const snapshot = await deps.repositoryFor(c.env).getSnapshot();
      return c.json(
        buildQrSheetView(snapshot, language(c.req.query("lang")), siteUrl),
        200,
      );
    });
}
