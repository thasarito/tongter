import { buildMockDataset } from "./mock-dataset";
import type { RsvpRow, Snapshot } from "./types";

/**
 * MOCK_SHEET=1 swaps the Google Sheet for generated fixture data.
 *
 * Exists so the whole flow — search, group RSVP, seat reveal — can be exercised
 * before the couple has created their sheet, and so the site can be demoed
 * without exposing the real guest list. Never enable in production.
 */

// Readable tokens so demo links are /rsvp/demo001, /rsvp/demo002, ...
const fixture = buildMockDataset({ readableTokens: true });

/** Responses submitted during a mock session, kept in memory only. */
const sessionRsvps: RsvpRow[] = [];

export function isMockMode(): boolean {
  return process.env.MOCK_SHEET === "1";
}

export function mockSnapshot(): Snapshot {
  return {
    status: "ok",
    guests: fixture.guests,
    groups: fixture.groups,
    // Session responses come last so they win the "latest row wins" collapse.
    rsvps: [...fixture.rsvps, ...sessionRsvps],
    fetchedAt: Date.now(),
    warnings: [],
  };
}

export function mockAppend(rows: RsvpRow[]): void {
  sessionRsvps.push(...rows);
}
