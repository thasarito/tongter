import {
  buildWeddingCalendar,
  CALENDAR_FILENAME,
  googleCalendarUrl,
} from "@/shared/calendar";
import { serializeDietary, type DietarySelection } from "@/shared/dietary";
import { findGuestByPersonalToken, findGroupByToken, guestsInGroup } from "@/shared/guest-list";
import { isLang, type Lang } from "@/shared/i18n";
import {
  buildJourneyIntroView,
  buildRsvpView,
  buildSearchView,
  buildSeatView,
} from "@/shared/views";
import {
  allowDietaryOther,
  dietaryOptions,
  seatingDebug,
} from "@/shared/event-config";
import { Hono, type Context } from "hono";
import type { AppDependencies } from "../dependencies";
import { apiError } from "../contracts";
import type { WorkerBindings } from "../env";

function language(raw: string | undefined): Lang {
  return raw && isLang(raw) ? raw : "th";
}

function notFound(c: Context) {
  return c.json(apiError("NOT_FOUND", "Invitation not found."), 404);
}

export function publicRoutes(deps: AppDependencies) {
  return new Hono<{ Bindings: WorkerBindings }>()
    .get("/health", (c) => c.json({ ok: true }))
    .get("/calendar/google", (c) => {
      c.header("Cache-Control", "public, max-age=3600");
      return c.redirect(googleCalendarUrl(language(c.req.query("lang"))), 302);
    })
    .get("/calendar/wedding.ics", (c) => {
      const body = buildWeddingCalendar(language(c.req.query("lang")));
      c.header("Content-Type", "text/calendar; charset=utf-8");
      c.header(
        "Content-Disposition",
        `attachment; filename="${CALENDAR_FILENAME}"`,
      );
      c.header("Cache-Control", "public, max-age=3600");
      return c.body(body, 200);
    })
    .get("/journey", async (c) => {
      const snapshot = await deps.repositoryFor(c.env).getSnapshot();
      return c.json(buildJourneyIntroView(snapshot, language(c.req.query("lang"))), 200);
    })
    .get("/journey/:guestToken", async (c) => {
      const snapshot = await deps.repositoryFor(c.env).getSnapshot();
      const lang = language(c.req.query("lang"));
      const guest = findGuestByPersonalToken(snapshot, c.req.param("guestToken"));
      if (!guest) return notFound(c);
      const group = snapshot.groups.find((entry) => entry.groupId === guest.groupId);
      if (!group) return notFound(c);
      const view = buildRsvpView(snapshot, group.token, {
        lang,
        dietaryOptions,
        allowDietaryOther,
      });
      if (view.kind === "not-found") return notFound(c);
      return c.json({
        intro: buildJourneyIntroView(snapshot, lang),
        flow: { selfGuestId: guest.guestId, view },
      });
    })
    .post("/journey/person", async (c) => {
      const body = await c.req.json<{ guestId?: string; lang?: string }>().catch(() => ({}));
      const snapshot = await deps.repositoryFor(c.env).getSnapshot();
      const guest = snapshot.guests.find((entry) => entry.guestId === body.guestId);
      if (!guest) return notFound(c);
      const group = snapshot.groups.find((entry) => entry.groupId === guest.groupId);
      if (!group) return notFound(c);
      const view = buildRsvpView(snapshot, group.token, {
        lang: language(body.lang),
        dietaryOptions,
        allowDietaryOther,
      });
      if (view.kind === "not-found") return notFound(c);
      return c.json({ selfGuestId: guest.guestId, view });
    })
    .get("/search", async (c) => {
      const snapshot = await deps.repositoryFor(c.env).getSnapshot();
      return c.json(
        buildSearchView(snapshot, c.req.query("q") ?? "", language(c.req.query("lang"))),
        200,
      );
    })
    .get("/rsvp/:token", async (c) => {
      const snapshot = await deps.repositoryFor(c.env).getSnapshot();
      const lang = language(c.req.query("lang"));
      const view = buildRsvpView(snapshot, c.req.param("token"), {
        lang,
        dietaryOptions,
        allowDietaryOther,
      });
      if (view.kind === "not-found") return notFound(c);
      return c.json({
        intro: buildJourneyIntroView(snapshot, lang),
        view,
        choices: view.guests.map((guest) => ({ guestId: guest.guestId, name: guest.name })),
      });
    })
    .post("/rsvp/:token", async (c) => {
      const snapshot = await deps.repositoryFor(c.env).getSnapshot();
      const token = c.req.param("token");
      const group = findGroupByToken(snapshot, token);
      if (!group) return notFound(c);
      const members = guestsInGroup(snapshot, group.groupId);
      const allowed = new Set(members.map((guest) => guest.guestId));
      const body = await c.req.json<{
        submittedBy?: string;
        lang?: string;
        answers?: Array<{
          guestId?: string;
          attending?: boolean;
          dietary?: string[];
          dietaryOther?: string;
          note?: string;
        }>;
      }>().catch(() => ({}));
      const entries = (body.answers ?? [])
        .filter((answer) => answer.guestId && allowed.has(answer.guestId))
        .map((answer) => {
          const selection: DietarySelection = {
            selected: (answer.dietary ?? []).filter((id) => dietaryOptions.some((option) => option.id === id)),
            other: allowDietaryOther ? (answer.dietaryOther ?? "") : "",
          };
          return {
            guestId: answer.guestId!,
            attending: answer.attending === true,
            dietary: serializeDietary(selection),
            note: (answer.note ?? "").trim(),
          };
        });
      if (entries.length === 0) {
        return c.json(apiError("VALIDATION_ERROR", "Please answer for at least one guest."), 400);
      }
      try {
        await deps.repositoryFor(c.env).appendRsvp({
          groupId: group.groupId,
          submittedBy: body.submittedBy ?? "",
          lang: language(body.lang),
          entries,
        });
      } catch (error) {
        console.error("[rsvp] append failed", { name: error instanceof Error ? error.name : "unknown" });
        return c.json(apiError("RSVP_WRITE_FAILED", "Please try again."), 503);
      }
      const guest = entries.find((entry) => entry.guestId === body.submittedBy) ?? entries[0];
      return c.json(
        { ok: true, seatHref: `/seat/${token}?celebrate=1&guest=${guest.guestId}` },
        201,
      );
    })
    .get("/seat/:token", async (c) => {
      const snapshot = await deps.repositoryFor(c.env).getSnapshot();
      const view = buildSeatView(snapshot, c.req.param("token"), language(c.req.query("lang")), {
        celebrate: c.req.query("celebrate") === "1",
        preferGuestId: c.req.query("guest"),
      });
      if (view.kind === "not-found") return notFound(c);
      return c.json({ view, debug: seatingDebug }, 200);
    });
}
