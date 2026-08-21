/**
 * Exercises the guest-list logic that decides who sits where and whose answer
 * counts. Run: pnpm check:logic
 */
import { buildMockDataset } from "../src/shared/mock-dataset.ts";
import {
  displayName,
  findGroupByToken,
  guestsInGroup,
  latestRsvpByGuest,
  parseAttending,
} from "../src/shared/guest-list.ts";
import { searchGuests } from "../src/shared/search.ts";
import { isValidSeat } from "../src/shared/venue.ts";
import type { RsvpRow, Snapshot } from "../src/shared/types.ts";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "FAIL  "} ${label}${detail ? ` — ${detail}` : ""}`);
}

const dataset = buildMockDataset({ readableTokens: true });
const snapshot: Snapshot = {
  status: "ok",
  guests: dataset.guests,
  groups: dataset.groups,
  rsvps: dataset.rsvps,
  fetchedAt: 1,
  warnings: [],
};

console.log("\n--- dataset integrity ---");
check("covers all 170 seats", dataset.guests.length === 170, `got ${dataset.guests.length}`);
check("every guest has a valid seat",
  dataset.guests.every((g) => isValidSeat(g.tableId, g.seatIndex)));
check("no two guests share a seat",
  new Set(dataset.guests.map((g) => `${g.tableId}:${g.seatIndex}`)).size === 170);
check("guest ids are unique",
  new Set(dataset.guests.map((g) => g.guestId)).size === dataset.guests.length);
check("group tokens are unique",
  new Set(dataset.groups.map((g) => g.token)).size === dataset.groups.length);
check("every guest belongs to a real group", (() => {
  const ids = new Set(dataset.groups.map((g) => g.groupId));
  return dataset.guests.every((g) => ids.has(g.groupId));
})());
check("every group has at least one guest",
  dataset.groups.every((grp) => dataset.guests.some((g) => g.groupId === grp.groupId)));

console.log("\n--- token lookup ---");
const firstGroup = dataset.groups[0];
check("valid token resolves", findGroupByToken(snapshot, firstGroup.token)?.groupId === firstGroup.groupId);
check("unknown token returns undefined", findGroupByToken(snapshot, "not-a-token") === undefined);
check("empty token returns undefined", findGroupByToken(snapshot, "") === undefined);

console.log("\n--- group membership ---");
const members = guestsInGroup(snapshot, firstGroup.groupId);
check("group has members", members.length > 0, `${members.length} member(s)`);
check("members are sorted by table then seat",
  members.every((m, i) => i === 0 ||
    m.tableId > members[i - 1].tableId ||
    (m.tableId === members[i - 1].tableId && m.seatIndex > members[i - 1].seatIndex)));
check("unknown group has no members", guestsInGroup(snapshot, "grp-does-not-exist").length === 0);

console.log("\n--- attending parser ---");
for (const [input, expected] of [
  ["yes", true], ["YES", true], ["y", true], ["true", true], ["1", true], ["ใช่", true],
  ["no", false], ["N", false], ["false", false], ["0", false], ["ไม่มา", false],
  ["", null], ["maybe", null], ["  yes  ", true],
] as [string, boolean | null][]) {
  check(`parseAttending(${JSON.stringify(input)}) = ${expected}`,
    parseAttending(input) === expected, `got ${parseAttending(input)}`);
}

console.log("\n--- append-only log collapse ---");
{
  const guestId = dataset.guests[0].guestId;
  const groupId = dataset.guests[0].groupId;
  const row = (timestamp: string, attending: boolean, dietary = ""): RsvpRow => ({
    timestamp, groupId, guestId, attending, dietary,
    message: "", submittedBy: "test", lang: "th",
  });

  const declinedThenAccepted: Snapshot = {
    ...snapshot,
    rsvps: [row("2026-11-01T09:00:00.000Z", false), row("2026-11-02T09:00:00.000Z", true, "vegan")],
  };
  const latest = latestRsvpByGuest(declinedThenAccepted);
  check("later row wins", latest.get(guestId)?.attending === true);
  check("that row's other fields come with it", latest.get(guestId)?.dietary === "vegan");

  // A group writes every member's row with one identical timestamp, so ties
  // can only be resolved by position.
  const sameSecond: Snapshot = {
    ...snapshot,
    rsvps: [row("2026-11-01T09:00:00.000Z", true), row("2026-11-01T09:00:00.000Z", false)],
  };
  check("identical timestamps resolve to the later row",
    latestRsvpByGuest(sameSecond).get(guestId)?.attending === false);

  // The one that bit us live: a fixture row dated in the future must not
  // outrank a real submission appended after it.
  const staleFutureRow: Snapshot = {
    ...snapshot,
    rsvps: [row("2027-12-31T00:00:00.000Z", true), row("2026-01-01T00:00:00.000Z", false, "changed")],
  };
  check("a future-dated earlier row does not win",
    latestRsvpByGuest(staleFutureRow).get(guestId)?.attending === false);
  check("position beats timestamp entirely",
    latestRsvpByGuest(staleFutureRow).get(guestId)?.dietary === "changed");

  check("rows without a guest id are ignored",
    latestRsvpByGuest({ ...snapshot, rsvps: [{ ...row("2026-11-01T09:00:00.000Z", true), guestId: "" }] }).size === 0);

  const unanswered = dataset.guests.find(
    (g) => !dataset.rsvps.some((r) => r.guestId === g.guestId),
  );
  check("guests who never responded are absent from the map",
    unanswered !== undefined && !latestRsvpByGuest(snapshot).has(unanswered.guestId));
}

console.log("\n--- name search ---");
{
  const target = dataset.guests.find((g) => g.nameTh.includes("วิว"))!;
  check("finds a Thai nickname",
    searchGuests(dataset.guests, "วิว").some((m) => m.guest.guestId === target.guestId));
  check("finds by romanised spelling",
    searchGuests(dataset.guests, "View").length > 0);
  check("is case insensitive",
    searchGuests(dataset.guests, "view").length === searchGuests(dataset.guests, "VIEW").length);

  // The kinship prefix is the point: someone called พี่วิว on the plan will
  // type just วิว.
  const prefixed = dataset.guests.find((g) => /^(พี่|น้อง|ป้า|ลุง|คุณ)วิว$/.test(g.nameTh));
  check("sees through a kinship prefix",
    prefixed !== undefined &&
      searchGuests(dataset.guests, "วิว").some((m) => m.guest.guestId === prefixed.guestId));
  check("exact match outranks partial", (() => {
    const results = searchGuests(dataset.guests, "วิว");
    return results.length > 1 ? results[0].score >= results[1].score : true;
  })());

  check("one character returns nothing", searchGuests(dataset.guests, "ว").length === 0);
  check("empty query returns nothing", searchGuests(dataset.guests, "").length === 0);
  check("whitespace-only query returns nothing", searchGuests(dataset.guests, "   ").length === 0);
  check("nonsense returns nothing", searchGuests(dataset.guests, "zzzzqq").length === 0);
  check("results are capped", searchGuests(dataset.guests, "วิว", 3).length <= 3);
}

console.log("\n--- display name fallback ---");
{
  const g = { ...dataset.guests[0], nameTh: "ก", nameEn: "" };
  check("english falls back to thai", displayName(g, "en") === "ก");
  const h = { ...dataset.guests[0], nameTh: "", nameEn: "Ann" };
  check("thai falls back to english", displayName(h, "th") === "Ann");
}

console.log(
  failures === 0 ? "\nAll logic checks passed.\n" : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
