import {
  buildWeddingCalendar,
  CALENDAR_FILENAME,
  googleCalendarUrl,
} from "@/shared/calendar";
import { serializeDietary } from "@/shared/dietary";
import {
  displayName,
  findGroupByToken,
  findGuestByToken,
  guestsInGroup,
} from "@/shared/guest-list";
import { isLang, type Lang } from "@/shared/i18n";
import {
  buildJourneyIntroView,
  buildRsvpView,
  buildSearchView,
  buildSeatView,
} from "@/shared/views";
import { allowDietaryOther, dietaryOptions } from "@/shared/event-config";
import { Hono } from "hono";
import type { AppDependencies } from "../dependencies";
import { apiError, personFlowSchema, rsvpSubmissionSchema } from "../contracts";
import type { WorkerBindings } from "../env";

const notFound = () => apiError("NOT_FOUND", "Invitation not found.");

function language(raw: string | undefined): Lang {
  return raw && isLang(raw) ? raw : "th";
}

export function publicRoutes(deps: AppDependencies) {
  return new Hono<{ Bindings: WorkerBindings }>()
    .get("/health", (c) => {
      c.header("Cache-Control", "no-store");
      return c.json({ ok: true } as const, 200);
    })
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
    .post("/journey/person", async (c) => {
      const parsed = personFlowSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) {
        return c.json(apiError("INVALID_PERSON", "Please choose a guest."), 400);
      }
      const snapshot = await deps.repositoryFor(c.env).getSnapshot();
      const guest = snapshot.guests.find(
        (candidate) => candidate.guestId === parsed.data.guestId,
      );
      const group = guest
        ? snapshot.groups.find((candidate) => candidate.groupId === guest.groupId)
        : undefined;
      const view = group?.token
        ? buildRsvpView(snapshot, group.token, {
            lang: parsed.data.lang,
            dietaryOptions,
            allowDietaryOther,
          })
        : null;
      return guest && view?.kind === "form"
        ? c.json({ view, selfGuestId: guest.guestId }, 200)
        : c.json(notFound(), 404);
    })
    .get("/search", async (c) => {
      const snapshot = await deps.repositoryFor(c.env).getSnapshot();
      return c.json(
        buildSearchView(snapshot, c.req.query("q") ?? "", language(c.req.query("lang"))),
        200,
      );
    })
    .get("/journey/:guestToken", async (c) => {
      const lang = language(c.req.query("lang"));
      const snapshot = await deps.repositoryFor(c.env).getSnapshot();
      const guest = findGuestByToken(snapshot, c.req.param("guestToken"));
      const group = guest
        ? snapshot.groups.find((candidate) => candidate.groupId === guest.groupId)
        : undefined;
      const view = group?.token
        ? buildRsvpView(snapshot, group.token, { lang, dietaryOptions, allowDietaryOther })
        : null;
      if (!guest || !view || view.kind !== "form") {
        return c.json(notFound(), 404);
      }
      return c.json({
        intro: buildJourneyIntroView(snapshot, lang),
        flow: { view, selfGuestId: guest.guestId },
      }, 200);
    })
    .get("/rsvp/:groupToken", async (c) => {
      const lang = language(c.req.query("lang"));
      const snapshot = await deps.repositoryFor(c.env).getSnapshot();
      const group = findGroupByToken(snapshot, c.req.param("groupToken"));
      if (!group) return c.json(notFound(), 404);
      const view = buildRsvpView(snapshot, group.token, {
        lang,
        dietaryOptions,
        allowDietaryOther,
      });
      if (view.kind !== "form") return c.json(notFound(), 404);
      const choices = guestsInGroup(snapshot, group.groupId).map((guest) => ({
        guestId: guest.guestId,
        name: displayName(guest, lang),
      }));
      return c.json({
        intro: buildJourneyIntroView(snapshot, lang),
        choices,
        view,
      }, 200);
    })
    .post("/rsvp/:groupToken", async (c) => {
      if (!c.req.header("content-type")?.toLowerCase().startsWith("application/json")) {
        return c.json(apiError("UNSUPPORTED_MEDIA_TYPE", "JSON is required."), 415);
      }
      const parsed = rsvpSubmissionSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) {
        return c.json(apiError("INVALID_RSVP", "Please check your answers."), 400);
      }
      const repository = deps.repositoryFor(c.env);
      const snapshot = await repository.getSnapshot();
      const group = findGroupByToken(snapshot, c.req.param("groupToken"));
      if (!group) return c.json(notFound(), 404);
      const memberIds = new Set(guestsInGroup(snapshot, group.groupId).map((guest) => guest.guestId));
      const entries = parsed.data.answers
        .filter((answer) => memberIds.has(answer.guestId))
        .map((answer) => ({
          guestId: answer.guestId,
          attending: answer.attending,
          dietary: serializeDietary({
            selected: answer.dietary,
            other: answer.dietaryOther,
          }),
          note: answer.note.trim(),
        }));
      if (!memberIds.has(parsed.data.submittedBy) || entries.length === 0) {
        return c.json(apiError("INVALID_RSVP", "Please check your answers."), 400);
      }
      try {
        await repository.appendRsvp({
          groupId: group.groupId,
          submittedBy: parsed.data.submittedBy,
          lang: parsed.data.lang,
          entries,
        });
      } catch (error) {
        console.error("[rsvp] append failed", {
          name: error instanceof Error ? error.name : "UnknownError",
        });
        return c.json(apiError("RSVP_WRITE_FAILED", "Please try again."), 503);
      }
      const guest = encodeURIComponent(parsed.data.submittedBy);
      return c.json({
        ok: true as const,
        seatHref: `/seat/${group.token}?celebrate=1&guest=${guest}`,
      }, 201);
    })
    .get("/seat/:groupToken", async (c) => {
      const snapshot = await deps.repositoryFor(c.env).getSnapshot();
      const view = buildSeatView(
        snapshot,
        c.req.param("groupToken"),
        language(c.req.query("lang")),
        {
          celebrate: c.req.query("celebrate") === "1",
          preferGuestId: c.req.query("guest"),
        },
      );
      return view.kind === "not-found"
        ? c.json(notFound(), 404)
        : c.json({ view, debug: c.req.query("debug") === "1" }, 200);
    });
}
