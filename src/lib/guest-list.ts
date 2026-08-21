import type { Group, Guest, RsvpRow, Snapshot } from "./types.ts";

/**
 * Pure queries over a guest-list snapshot.
 *
 * Separate from sheets.ts (which is `server-only` and pulls in googleapis) so
 * this logic can be exercised directly by the check scripts — it is the part
 * that decides who sits where and whose answer counts, so it needs to be
 * testable without a network or a React runtime.
 */

const TRUTHY = new Set(["yes", "y", "true", "1", "ใช่", "มา", "attending"]);
const FALSY = new Set(["no", "n", "false", "0", "ไม่", "ไม่มา", "declined"]);

export function parseAttending(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (TRUTHY.has(v)) return true;
  if (FALSY.has(v)) return false;
  return null;
}

export function findGroupByToken(
  snapshot: Snapshot,
  token: string,
): Group | undefined {
  if (!token) return undefined;
  return snapshot.groups.find((g) => g.token === token);
}

export function guestsInGroup(snapshot: Snapshot, groupId: string): Guest[] {
  return snapshot.guests
    .filter((g) => g.groupId === groupId)
    .sort((a, b) => a.tableId - b.tableId || a.seatIndex - b.seatIndex);
}

/**
 * Collapses the append-only log into current state: for each guest, the last
 * row in the sheet wins.
 *
 * Position, not timestamp, is the authority. The RSVP tab is only ever appended
 * to, so physical order is the true chronology, whereas the timestamp column is
 * ordinary text that anyone can mistype — and a single row bearing a future
 * date would otherwise pin that guest's answer permanently, silently ignoring
 * every later change they make. The timestamp stays informational.
 *
 * This does mean sorting the RSVP tab corrupts the answers, which is why the
 * sheet marks it as a protected range.
 */
export function latestRsvpByGuest(snapshot: Snapshot): Map<string, RsvpRow> {
  const latest = new Map<string, RsvpRow>();
  for (const row of snapshot.rsvps) {
    if (!row.guestId) continue;
    latest.set(row.guestId, row);
  }
  return latest;
}

export function displayName(guest: Guest, lang: "th" | "en"): string {
  if (lang === "en") return guest.nameEn || guest.nameTh;
  return guest.nameTh || guest.nameEn;
}

/**
 * Finds a guest by their personal invite token (the `/i/<token>` links).
 *
 * Blank tokens never match, so guests without one cannot be reached by
 * submitting an empty token.
 */
export function findGuestByToken(
  snapshot: Snapshot,
  token: string,
): Guest | undefined {
  if (!token) return undefined;
  return snapshot.guests.find((g) => g.token && g.token === token);
}
