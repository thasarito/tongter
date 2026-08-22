/**
 * Exercises the layer the UI sits on: dietary parsing, the form contract, and
 * the view-model builders. Run: pnpm check:views
 *
 * These are the pieces a UI rework will lean on, so they are tested without
 * rendering anything.
 */
import {
  dietaryLabels,
  dietarySummary,
  isDietaryEmpty,
  parseDietary,
  serializeDietary,
  type DietaryOption,
} from "../src/shared/dietary.ts";
import {
  fields,
  fromRecord,
  parseRsvpForm,
  toSheetEntries,
  MAX_TEXT,
} from "../src/shared/rsvp-form.ts";
import { buildMockDataset } from "../src/shared/mock-dataset.ts";
import { guestsInGroup } from "../src/shared/guest-list.ts";
import {
  buildAdminView,
  buildQrSheetView,
  buildRsvpView,
  buildSearchView,
  buildSeatView,
} from "../src/shared/views/build.ts";
import type { Snapshot } from "../src/shared/types.ts";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "FAIL  "} ${label}${detail ? ` — ${detail}` : ""}`);
}

const OPTIONS: DietaryOption[] = [
  { id: "vegetarian", label: { th: "มังสวิรัติ", en: "Vegetarian" } },
  { id: "halal", label: { th: "ฮาลาล", en: "Halal" } },
  { id: "nut-allergy", label: { th: "แพ้ถั่ว", en: "Nut allergy" } },
];

const VIEW_OPTS = { lang: "th" as const, dietaryOptions: OPTIONS, allowDietaryOther: true };

const dataset = buildMockDataset({ readableTokens: true });
const snapshot: Snapshot = {
  status: "ok",
  guests: dataset.guests,
  groups: dataset.groups,
  rsvps: dataset.rsvps,
  fetchedAt: 1,
  warnings: [],
};

// ---------------------------------------------------------------------------
console.log("\n--- dietary parsing ---");

check("parses known ids", (() => {
  const s = parseDietary("vegetarian,halal", OPTIONS);
  return s.selected.join() === "vegetarian,halal" && s.other === "";
})());

check("keeps unrecognised text rather than dropping it", (() => {
  const s = parseDietary("แพ้กุ้ง", OPTIONS);
  return s.selected.length === 0 && s.other === "แพ้กุ้ง";
})());

check("splits known ids from free text", (() => {
  const s = parseDietary("halal, แพ้กุ้ง", OPTIONS);
  return s.selected.join() === "halal" && s.other === "แพ้กุ้ง";
})());

check("empty cell yields an empty selection",
  isDietaryEmpty(parseDietary("", OPTIONS)));

check("de-duplicates repeated ids", (() => {
  const s = parseDietary("halal,halal", OPTIONS);
  return s.selected.length === 1;
})());

check("ignores stray whitespace and blanks", (() => {
  const s = parseDietary("  halal , , vegetarian ", OPTIONS);
  return s.selected.join() === "halal,vegetarian";
})());

check("round-trips through the sheet format", (() => {
  const original = "vegetarian, แพ้กุ้ง";
  const again = serializeDietary(parseDietary(original, OPTIONS));
  return parseDietary(again, OPTIONS).other === "แพ้กุ้ง";
})());

check("labels resolve per language", (() => {
  const s = parseDietary("halal", OPTIONS);
  return dietaryLabels(s, OPTIONS, "th")[0] === "ฮาลาล" &&
    dietaryLabels(s, OPTIONS, "en")[0] === "Halal";
})());

// Removing an option from config must not erase answers already given.
check("an id with no matching option still shows", (() => {
  const s = { selected: ["retired-option"], other: "" };
  return dietaryLabels(s, OPTIONS, "th")[0] === "retired-option";
})());

check("summary joins options and free text",
  dietarySummary(parseDietary("halal, แพ้กุ้ง", OPTIONS), OPTIONS, "en") ===
    "Halal, แพ้กุ้ง");

// ---------------------------------------------------------------------------
console.log("\n--- rsvp form contract ---");

const group = dataset.groups[0];
const members = guestsInGroup(snapshot, group.groupId);

function baseForm(overrides: Record<string, string | string[]> = {}) {
  const record: Record<string, string | string[]> = {
    [fields.token]: group.token,
    [fields.lang]: "th",
    [fields.submittedBy]: "Tester",
  };
  for (const m of members) record[fields.attending(m.guestId)] = "yes";
  return fromRecord({ ...record, ...overrides });
}

check("parses a complete submission", (() => {
  const r = parseRsvpForm(baseForm(), members, OPTIONS);
  return r.ok && r.value.answers.length === members.length;
})());

check("missing token is rejected", (() => {
  const r = parseRsvpForm(baseForm({ [fields.token]: "" }), members, OPTIONS);
  return !r.ok && r.errorKey === "errorBody";
})());

// Partial submissions are the normal case: the journey walks a group one
// person at a time and lets anyone stop early.
check("a partly-filled form is accepted", (() => {
  const r = parseRsvpForm(
    baseForm({ [fields.attending(members[0].guestId)]: "" }),
    members,
    OPTIONS,
  );
  return r.ok && r.value.answers.length === members.length - 1;
})());

check("a skipped guest gets no row at all", (() => {
  const r = parseRsvpForm(
    baseForm({ [fields.attending(members[0].guestId)]: "" }),
    members,
    OPTIONS,
  );
  return r.ok && !r.value.answers.some((a) => a.guestId === members[0].guestId);
})());

check("one answer out of the whole group is enough", (() => {
  const only: Record<string, string | string[]> = {
    [fields.token]: group.token,
    [fields.attending(members[0].guestId)]: "yes",
  };
  const r = parseRsvpForm(fromRecord(only), members, OPTIONS);
  return r.ok && r.value.answers.length === 1;
})());

check("a garbage attending value is treated as unanswered", (() => {
  const r = parseRsvpForm(
    baseForm({ [fields.attending(members[0].guestId)]: "maybe" }),
    members,
    OPTIONS,
  );
  return r.ok && !r.value.answers.some((a) => a.guestId === members[0].guestId);
})());

check("a wholly empty form is rejected", (() => {
  const empty: Record<string, string | string[]> = { [fields.token]: group.token };
  const r = parseRsvpForm(fromRecord(empty), members, OPTIONS);
  return !r.ok && r.errorKey === "needOneAnswer";
})());

check("notes are captured per person", (() => {
  const r = parseRsvpForm(
    baseForm({ [fields.note(members[0].guestId)]: "see you there" }),
    members,
    OPTIONS,
  );
  return r.ok &&
    r.value.answers[0].note === "see you there" &&
    r.value.answers.slice(1).every((a) => a.note === "");
})());

check("empty membership is rejected",
  !parseRsvpForm(baseForm(), [], OPTIONS).ok);

// The security property: answers come from walking the sheet's membership, so
// extra guest ids in the request are simply never read.
check("guest ids outside the group are ignored", (() => {
  const outsider = dataset.guests.find((g) => g.groupId !== group.groupId)!;
  const r = parseRsvpForm(
    baseForm({ [fields.attending(outsider.guestId)]: "yes" }),
    members,
    OPTIONS,
  );
  return r.ok && !r.value.answers.some((a) => a.guestId === outsider.guestId);
})());

check("collects multiple dietary selections", (() => {
  const r = parseRsvpForm(
    baseForm({ [fields.dietary(members[0].guestId)]: ["halal", "nut-allergy"] }),
    members,
    OPTIONS,
  );
  return r.ok && r.value.answers[0].dietary.selected.length === 2;
})());

check("unknown dietary ids are discarded", (() => {
  const r = parseRsvpForm(
    baseForm({ [fields.dietary(members[0].guestId)]: ["halal", "not-an-option"] }),
    members,
    OPTIONS,
  );
  return r.ok && r.value.answers[0].dietary.selected.join() === "halal";
})());

check("free text is captured separately", (() => {
  const r = parseRsvpForm(
    baseForm({ [fields.dietaryOther(members[0].guestId)]: "แพ้กุ้ง" }),
    members,
    OPTIONS,
  );
  return r.ok && r.value.answers[0].dietary.other === "แพ้กุ้ง";
})());

check("over-long text is clamped", (() => {
  const r = parseRsvpForm(
    baseForm({ [fields.note(members[0].guestId)]: "x".repeat(MAX_TEXT + 500) }),
    members,
    OPTIONS,
  );
  return r.ok && r.value.answers[0].note.length === MAX_TEXT;
})());

check("sheet entries serialise the selection", (() => {
  const r = parseRsvpForm(
    baseForm({
      [fields.dietary(members[0].guestId)]: ["halal"],
      [fields.dietaryOther(members[0].guestId)]: "แพ้กุ้ง",
    }),
    members,
    OPTIONS,
  );
  if (!r.ok) return false;
  const entry = toSheetEntries(r.value)[0];
  return entry.dietary === "halal, แพ้กุ้ง" && entry.attending === true;
})());

// ---------------------------------------------------------------------------
console.log("\n--- search view ---");

check("empty query is idle", buildSearchView(snapshot, "", "th").state === "idle");
check("one character is too short", buildSearchView(snapshot, "ว", "th").state === "too-short");
check("nonsense yields no results",
  buildSearchView(snapshot, "zzzzqq", "th").state === "no-results");

const searchView = buildSearchView(snapshot, "วิว", "th");
check("a real name yields results", searchView.state === "results");
check("results carry a link", searchView.results.every((r) => r.href?.startsWith("/rsvp/")));
check("results carry table and name",
  searchView.results.every((r) => r.name.length > 0 && r.tableId > 0));

check("a guest whose group is missing gets no link", (() => {
  const orphaned: Snapshot = { ...snapshot, groups: [] };
  const v = buildSearchView(orphaned, "วิว", "th");
  return v.results.length > 0 && v.results.every((r) => r.href === null);
})());

// ---------------------------------------------------------------------------
console.log("\n--- rsvp view ---");

check("unknown token yields not-found",
  buildRsvpView(snapshot, "nope", VIEW_OPTS).kind === "not-found");

const rsvpView = buildRsvpView(snapshot, group.token, VIEW_OPTS);
check("known token yields a form", rsvpView.kind === "form");

if (rsvpView.kind === "form") {
  check("form lists every group member", rsvpView.guests.length === members.length);
  check("form exposes its own field names",
    rsvpView.guests[0].fieldNames.attending === fields.attending(members[0].guestId));
  check("form exposes dietary options", rsvpView.dietaryOptions.length === OPTIONS.length);
  check("options are label-resolved for the language",
    rsvpView.dietaryOptions[0].label === "มังสวิรัติ");
  check("previous answers are replayed",
    rsvpView.hasResponded && rsvpView.guests.every((g) => g.attending !== null));

  // A later row must beat an earlier one, matching the append-only semantics.
  const changed: Snapshot = {
    ...snapshot,
    rsvps: [
      ...snapshot.rsvps,
      {
        timestamp: "2020-01-01T00:00:00.000Z",
        groupId: group.groupId,
        guestId: members[0].guestId,
        attending: false,
        dietary: "halal",
        message: "changed my mind",
        submittedBy: "later",
        lang: "th",
      },
    ],
  };
  const replayed = buildRsvpView(changed, group.token, VIEW_OPTS);
  check("the latest row wins even with an older timestamp",
    replayed.kind === "form" && replayed.guests[0].attending === false);
  check("the latest dietary is parsed into a selection",
    replayed.kind === "form" && replayed.guests[0].dietary.selected.join() === "halal");
  check("the latest note is replayed on that person",
    replayed.kind === "form" && replayed.guests[0].note === "changed my mind");
}

// ---------------------------------------------------------------------------
console.log("\n--- seat view ---");

check("unknown token yields not-found",
  buildSeatView(snapshot, "nope", "th").kind === "not-found");

const seatView = buildSeatView(snapshot, group.token, "th", { celebrate: true });
check("known token yields a seat view", seatView.kind === "seat");

if (seatView.kind === "seat") {
  check("celebrate flag is carried", seatView.celebrate);
  check("group is listed", seatView.group.length === members.length);
  check("highlight covers the whole group", seatView.highlight.length === members.length);
  check("a focus seat is chosen", seatView.focus !== null);

  // The camera should never walk to a chair whose occupant declined.
  const allDeclined: Snapshot = {
    ...snapshot,
    rsvps: members.map((m) => ({
      timestamp: "2026-06-01T00:00:00.000Z",
      groupId: group.groupId,
      guestId: m.guestId,
      attending: false,
      dietary: "",
      message: "",
      submittedBy: "",
      lang: "th",
    })),
  };
  const declinedView = buildSeatView(allDeclined, group.token, "th");
  check("nobody attending means no focus seat",
    declinedView.kind === "seat" && declinedView.focus === null);
  check("declined guests are still listed",
    declinedView.kind === "seat" && declinedView.group.length === members.length);

  const preferred = members[members.length - 1];
  const prefView = buildSeatView(snapshot, group.token, "th", {
    preferGuestId: preferred.guestId,
  });
  check("an explicit guest can be focused",
    prefView.kind === "seat" && prefView.focus?.guestId === preferred.guestId);
}

// ---------------------------------------------------------------------------
console.log("\n--- admin view ---");

const admin = buildAdminView(snapshot, VIEW_OPTS);
check("counts add up to the guest list",
  admin.totals.attending + admin.totals.declined + admin.totals.noResponse ===
    dataset.guests.length,
  `${admin.totals.attending}+${admin.totals.declined}+${admin.totals.noResponse}`);
check("all ten tables are reported", admin.tables.length === 10);
check("table headcounts never exceed the seats",
  admin.tables.every((t) => t.attending + t.declined <= t.seats));
check("every group is reported", admin.groups.length === dataset.groups.length);
check("group state matches its counts",
  admin.groups.every((g) =>
    (g.answered === 0 && g.state === "none") ||
    (g.answered === g.total && g.state === "complete") ||
    (g.answered > 0 && g.answered < g.total && g.state === "partial")));
check("dietary totals only count attending guests",
  admin.dietaryTotals.every((d) => d.count > 0 && d.count <= admin.totals.attending));
check("seats total matches the plan", admin.totals.seatsTotal === 170);

const qr = buildQrSheetView(snapshot, "th", "https://example.test");
check("a QR card per group", qr.cards.length === dataset.groups.length);
check("card urls point at the group token",
  qr.cards.every((c) =>
    c.url === `https://example.test/rsvp/${c.token}?openExternalBrowser=1`));
check("cards list their members", qr.cards.every((c) => c.memberNames.length > 0));

console.log(
  failures === 0 ? "\nAll view checks passed.\n" : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
