import {
  dietaryLabels,
  dietaryOptionLabel,
  parseDietary,
  type DietaryOption,
} from "../dietary.ts";
import {
  displayName,
  findGroupByToken,
  guestsInGroup,
  latestRsvpByGuest,
} from "../guest-list.ts";
import type { Lang } from "../i18n.ts";
import { searchGuests } from "../search.ts";
import type { Group, Snapshot } from "../types.ts";
import { TABLES, TOTAL_SEATS } from "../venue.ts";
import { fields } from "../rsvp-form.ts";
import type {
  AdminView,
  JourneyIntroView,
  QrSheetView,
  RsvpView,
  SearchView,
  SeatPageView,
} from "./types.ts";

/** Options a builder needs that do not come from the snapshot. */
export interface ViewOptions {
  lang: Lang;
  dietaryOptions: readonly DietaryOption[];
  allowDietaryOther: boolean;
}

function groupLabelFor(group: Group | undefined, lang: Lang): string {
  if (!group) return "";
  return lang === "en"
    ? group.labelEn || group.labelTh
    : group.labelTh || group.labelEn;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export function buildSearchView(
  snapshot: Snapshot,
  rawQuery: string,
  lang: Lang,
): SearchView {
  const query = rawQuery.trim();
  const base = { status: snapshot.status, query };

  if (query.length === 0) return { ...base, state: "idle", results: [] };
  if (query.length < 2) return { ...base, state: "too-short", results: [] };

  const groupsById = new Map(snapshot.groups.map((g) => [g.groupId, g]));

  const results = searchGuests(snapshot.guests, query).map(({ guest }) => {
    const group = groupsById.get(guest.groupId);
    return {
      guestId: guest.guestId,
      name: displayName(guest, lang),
      tableId: guest.tableId,
      seatIndex: guest.seatIndex,
      groupLabel: groupLabelFor(group, lang),
      // A guest whose group row is missing or tokenless cannot be routed
      // anywhere; the UI shows them without a link rather than 404ing later.
      href: group?.token ? `/rsvp/${group.token}` : null,
    };
  });

  return {
    ...base,
    state: results.length > 0 ? "results" : "no-results",
    results,
  };
}

// ---------------------------------------------------------------------------
// Group RSVP
// ---------------------------------------------------------------------------

export function buildRsvpView(
  snapshot: Snapshot,
  token: string,
  options: ViewOptions,
): RsvpView {
  const group = findGroupByToken(snapshot, token);
  if (!group) return { kind: "not-found", status: snapshot.status };

  const { lang, dietaryOptions, allowDietaryOther } = options;
  const members = guestsInGroup(snapshot, group.groupId);
  const latest = latestRsvpByGuest(snapshot);

  // Who submitted last, for pre-filling that field. Notes are per person and
  // come from each guest's own latest row instead.
  const groupRows = snapshot.rsvps.filter((r) => r.groupId === group.groupId);
  const lastRow = groupRows.at(-1);

  return {
    kind: "form",
    status: snapshot.status,
    token,
    groupLabel: groupLabelFor(group, lang),
    hasResponded: groupRows.length > 0,
    submittedBy: lastRow?.submittedBy ?? "",
    allowDietaryOther,
    dietaryOptions: dietaryOptions.map((o) => ({
      id: o.id,
      label: dietaryOptionLabel(o, lang),
    })),
    fieldNames: {
      token: fields.token,
      lang: fields.lang,
      submittedBy: fields.submittedBy,
    },
    guests: members.map((guest) => {
      const previous = latest.get(guest.guestId);
      return {
        guestId: guest.guestId,
        name: displayName(guest, lang),
        tableId: guest.tableId,
        seatIndex: guest.seatIndex,
        attending: previous?.attending ?? null,
        dietary: parseDietary(previous?.dietary ?? "", dietaryOptions),
        note: previous?.message ?? "",
        fieldNames: {
          attending: fields.attending(guest.guestId),
          dietary: fields.dietary(guest.guestId),
          dietaryOther: fields.dietaryOther(guest.guestId),
          note: fields.note(guest.guestId),
        },
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Seat reveal
// ---------------------------------------------------------------------------

export function buildSeatView(
  snapshot: Snapshot,
  token: string,
  lang: Lang,
  opts: { celebrate?: boolean; preferGuestId?: string } = {},
): SeatPageView {
  const group = findGroupByToken(snapshot, token);
  if (!group) return { kind: "not-found", status: snapshot.status };

  const members = guestsInGroup(snapshot, group.groupId);
  const latest = latestRsvpByGuest(snapshot);

  const withAnswers = members.map((guest) => ({
    guestId: guest.guestId,
    name: displayName(guest, lang),
    tableId: guest.tableId,
    seatIndex: guest.seatIndex,
    attending: latest.get(guest.guestId)?.attending ?? null,
  }));

  // Anyone who declined is still listed, but the walk should not end at an
  // empty chair.
  const attending = withAnswers.filter((g) => g.attending !== false);
  const focus =
    attending.find((g) => g.guestId === opts.preferGuestId) ??
    attending[0] ??
    null;

  return {
    kind: "seat",
    status: snapshot.status,
    token,
    celebrate: opts.celebrate ?? false,
    focus: focus
      ? {
          guestId: focus.guestId,
          name: focus.name,
          tableId: focus.tableId,
          seatIndex: focus.seatIndex,
        }
      : null,
    group: withAnswers,
    highlight: withAnswers.map((g) => ({
      tableId: g.tableId,
      seatIndex: g.seatIndex,
    })),
  };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export function buildAdminView(
  snapshot: Snapshot,
  options: ViewOptions,
): AdminView {
  const { lang, dietaryOptions } = options;
  const latest = latestRsvpByGuest(snapshot);

  let attending = 0;
  let declined = 0;
  for (const guest of snapshot.guests) {
    const answer = latest.get(guest.guestId)?.attending;
    if (answer === true) attending += 1;
    else if (answer === false) declined += 1;
  }

  const tables = TABLES.map((table) => {
    const seated = snapshot.guests.filter((g) => g.tableId === table.id);
    return {
      tableId: table.id,
      shape: table.shape,
      seats: table.seats,
      named: seated.length,
      attending: seated.filter((g) => latest.get(g.guestId)?.attending === true).length,
      declined: seated.filter((g) => latest.get(g.guestId)?.attending === false).length,
    };
  });

  // Only people actually coming matter to the caterer.
  const dietary: AdminView["dietary"] = [];
  const optionCounts = new Map<string, number>();
  for (const guest of snapshot.guests) {
    const row = latest.get(guest.guestId);
    if (row?.attending !== true) continue;
    const selection = parseDietary(row.dietary, dietaryOptions);
    const notes = dietaryLabels(selection, dietaryOptions, lang);
    if (notes.length === 0) continue;
    dietary.push({ name: displayName(guest, lang), notes });
    for (const id of selection.selected) {
      optionCounts.set(id, (optionCounts.get(id) ?? 0) + 1);
    }
  }

  const dietaryTotals = dietaryOptions
    .map((o) => ({ label: dietaryOptionLabel(o, lang), count: optionCounts.get(o.id) ?? 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  // One message per group: last row in sheet order wins.
  const messagesByGroup = new Map<string, { from: string; text: string; at: string }>();
  for (const row of snapshot.rsvps) {
    if (!row.message.trim()) continue;
    messagesByGroup.set(row.groupId, {
      from: row.submittedBy || row.groupId,
      text: row.message,
      at: row.timestamp,
    });
  }

  const groups = snapshot.groups.map((group) => {
    const members = guestsInGroup(snapshot, group.groupId);
    const answered = members.filter((m) => latest.has(m.guestId)).length;
    return {
      groupId: group.groupId,
      label: groupLabelFor(group, lang) || group.groupId,
      memberNames: members.map((m) => displayName(m, lang)),
      answered,
      total: members.length,
      state:
        answered === 0
          ? ("none" as const)
          : answered < members.length
            ? ("partial" as const)
            : ("complete" as const),
      token: group.token,
      href: `/rsvp/${group.token}`,
    };
  });

  return {
    status: snapshot.status,
    fetchedAt: snapshot.fetchedAt,
    warnings: snapshot.warnings,
    totals: {
      attending,
      declined,
      noResponse: snapshot.guests.length - attending - declined,
      seatsNamed: snapshot.guests.length,
      seatsTotal: TOTAL_SEATS,
      groupsReplied: new Set(snapshot.rsvps.map((r) => r.groupId)).size,
      groupsTotal: snapshot.groups.length,
    },
    tables,
    dietary,
    dietaryTotals,
    messages: [...messagesByGroup.values()],
    groups,
  };
}

export function buildQrSheetView(
  snapshot: Snapshot,
  lang: Lang,
  siteUrl: string,
): QrSheetView {
  return {
    status: snapshot.status,
    cards: snapshot.groups.map((group) => {
      const target = new URL(`/rsvp/${group.token}`, siteUrl);
      target.searchParams.set("openExternalBrowser", "1");

      return {
        groupId: group.groupId,
        label: groupLabelFor(group, lang) || group.groupId,
        memberNames: guestsInGroup(snapshot, group.groupId).map((m) =>
          displayName(m, lang),
        ),
        token: group.token,
        url: target.toString(),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Guest journey
// ---------------------------------------------------------------------------

/**
 * Everything the journey needs before a guest has identified themselves.
 *
 * The whole name list ships to the browser so the picker can drift and filter
 * without a round trip per keystroke. It is trimmed to display fields only —
 * seats, groups and personal tokens stay on the server until a guest is chosen.
 */
export function buildJourneyIntroView(
  snapshot: Snapshot,
  lang: Lang,
): JourneyIntroView {
  const sideCounts = { bride: 0, groom: 0 };
  const guests = snapshot.guests
    .filter((g) => g.nameTh || g.nameEn)
    .map((g) => {
      if (g.side) sideCounts[g.side] += 1;
      const name = displayName(g, lang);
      return {
        guestId: g.guestId,
        name,
        nameTh: g.nameTh,
        nameEn: g.nameEn,
        initial: name.trim().slice(0, 1),
        side: g.side,
      };
    });

  return { status: snapshot.status, guests, sideCounts };
}
