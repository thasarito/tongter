import "server-only";

import { google, type sheets_v4 } from "googleapis";
import { serverEnv } from "./config";
import { parseAttending } from "./guest-list";
import { isMockMode, mockAppend, mockSnapshot } from "./mock-data";
import {
  SHEET_TABS,
  type Group,
  type Guest,
  type RsvpRow,
  type Side,
  type Snapshot,
} from "./types";
import { isValidSeat } from "./venue";

/**
 * Google Sheets is the only store — there is no database.
 *
 * That choice is deliberate (the couple wants to edit the guest list in a
 * spreadsheet), but it needs care to survive a wedding day:
 *
 *  - Reads go through one batchGet and a short-lived process cache. Sheets
 *    allows roughly 60 reads/min/user; 170 guests opening pages at once would
 *    blow straight past that uncached.
 *  - If a refresh fails, the last good snapshot is served with status "stale"
 *    rather than erroring the page.
 *  - Writes are append-only and serialised, so two people in the same group
 *    submitting simultaneously can never clobber each other.
 */

// Data shapes live in types.ts so the generator scripts, which run under plain
// node, can use them without pulling in googleapis.
export type {
  Group,
  Guest,
  RsvpRow,
  Side,
  Snapshot,
  SnapshotStatus,
} from "./types";
export { GROUP_HEADERS, GUEST_HEADERS, RSVP_HEADERS, SHEET_TABS } from "./types";

// Pure snapshot queries live in guest-list.ts so the check scripts can run them
// without this module's server-only and googleapis imports.
export {
  displayName,
  findGroupByToken,
  guestsInGroup,
  latestRsvpByGuest,
  parseAttending,
} from "./guest-list";

const CACHE_TTL_MS = 45_000;

// ---------------------------------------------------------------------------
// Row parsing
// ---------------------------------------------------------------------------

/** `Guest ID`, `guest_id` and `guestId` all normalise to `guestid`. */
function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_-]/g, "");
}

/**
 * Maps a sheet's rows to objects keyed by header name, so the couple can
 * reorder or add columns without breaking the site.
 */
function toRecords(values: string[][] | undefined): Record<string, string>[] {
  if (!values || values.length < 2) return [];
  const headers = values[0].map(normaliseHeader);
  return values.slice(1).flatMap((row) => {
    // Skip fully blank rows, which Sheets returns generously.
    if (row.every((cell) => !cell?.trim())) return [];
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h) record[h] = (row[i] ?? "").trim();
    });
    return [record];
  });
}

function parseSide(raw: string): Side | null {
  const v = raw.toLowerCase();
  if (v === "bride" || v === "เจ้าสาว" || v === "b") return "bride";
  if (v === "groom" || v === "เจ้าบ่าว" || v === "g") return "groom";
  return null;
}

function parseGuests(records: Record<string, string>[], warnings: string[]): Guest[] {
  const seen = new Set<string>();
  const seatTaken = new Map<string, string>();

  return records.flatMap((r, i) => {
    const rowNo = i + 2; // +1 for the header, +1 for 1-based rows
    const guestId = r.guestid;
    const nameTh = r.nameth ?? "";
    const nameEn = r.nameen ?? "";

    if (!guestId) {
      warnings.push(`Guests row ${rowNo}: missing guest_id, row skipped`);
      return [];
    }
    if (seen.has(guestId)) {
      warnings.push(`Guests row ${rowNo}: duplicate guest_id "${guestId}", row skipped`);
      return [];
    }
    if (!nameTh && !nameEn) {
      warnings.push(`Guests row ${rowNo}: no name in either language`);
    }

    const tableId = Number(r.tableid);
    const seatIndex = Number(r.seatindex);
    if (!Number.isFinite(tableId) || !Number.isFinite(seatIndex)) {
      warnings.push(`Guests row ${rowNo} ("${nameTh || nameEn}"): table_id/seat_index not numeric`);
      return [];
    }
    if (!isValidSeat(tableId, seatIndex)) {
      warnings.push(
        `Guests row ${rowNo} ("${nameTh || nameEn}"): seat T${tableId}#${seatIndex} does not exist`,
      );
      return [];
    }

    const seatKey = `${tableId}:${seatIndex}`;
    const previous = seatTaken.get(seatKey);
    if (previous) {
      warnings.push(
        `Guests row ${rowNo}: seat T${tableId}#${seatIndex} already assigned to "${previous}"`,
      );
    }
    seatTaken.set(seatKey, nameTh || nameEn || guestId);
    seen.add(guestId);

    if (!r.groupid) {
      warnings.push(`Guests row ${rowNo} ("${nameTh || nameEn}"): missing group_id`);
    }

    return [
      {
        guestId,
        nameTh,
        nameEn,
        groupId: r.groupid ?? "",
        tableId,
        seatIndex,
        side: parseSide(r.side ?? ""),
        tags: (r.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
      },
    ];
  });
}

function parseGroups(records: Record<string, string>[], warnings: string[]): Group[] {
  const seenIds = new Set<string>();
  const seenTokens = new Map<string, string>();

  return records.flatMap((r, i) => {
    const rowNo = i + 2;
    const groupId = r.groupid;
    const token = r.token;

    if (!groupId) {
      warnings.push(`Groups row ${rowNo}: missing group_id, row skipped`);
      return [];
    }
    if (seenIds.has(groupId)) {
      warnings.push(`Groups row ${rowNo}: duplicate group_id "${groupId}", row skipped`);
      return [];
    }
    if (!token) {
      warnings.push(`Groups row ${rowNo} ("${groupId}"): missing token — its QR link will not work`);
      return [];
    }
    // A shared token would let one group see and edit another's RSVP.
    const tokenOwner = seenTokens.get(token);
    if (tokenOwner) {
      warnings.push(
        `Groups row ${rowNo}: token for "${groupId}" is identical to "${tokenOwner}" — regenerate it`,
      );
      return [];
    }
    seenIds.add(groupId);
    seenTokens.set(token, groupId);

    return [
      {
        groupId,
        labelTh: r.labelth ?? "",
        labelEn: r.labelen ?? "",
        token,
      },
    ];
  });
}

function parseRsvps(records: Record<string, string>[]): RsvpRow[] {
  return records.map((r) => ({
    timestamp: r.timestamp ?? "",
    groupId: r.groupid ?? "",
    guestId: r.guestid ?? "",
    attending: parseAttending(r.attending ?? ""),
    dietary: r.dietary ?? "",
    message: r.message ?? "",
    submittedBy: r.submittedby ?? "",
    lang: r.lang ?? "",
  }));
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

let clientPromise: Promise<sheets_v4.Sheets> | null = null;

function getClient(): Promise<sheets_v4.Sheets> {
  if (clientPromise) return clientPromise;

  const { credentialsPath, credentialsJson } = serverEnv();
  const scopes = ["https://www.googleapis.com/auth/spreadsheets"];

  const auth = credentialsJson
    ? new google.auth.GoogleAuth({ credentials: JSON.parse(credentialsJson), scopes })
    : new google.auth.GoogleAuth({ keyFile: credentialsPath, scopes });

  clientPromise = auth
    .getClient()
    .then((authClient) =>
      google.sheets({ version: "v4", auth: authClient as never }),
    )
    .catch((err) => {
      // Do not cache a failed client: the key may be fixed without a restart.
      clientPromise = null;
      throw err;
    });

  return clientPromise;
}

function isConfigured(): boolean {
  const { sheetId, credentialsPath, credentialsJson } = serverEnv();
  return Boolean(sheetId && (credentialsPath || credentialsJson));
}

function isRetryable(err: unknown): boolean {
  const status = (err as { code?: number; status?: number })?.code ??
    (err as { status?: number })?.status;
  return status === 429 || status === 500 || status === 502 || status === 503;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === attempts - 1) throw err;
      // 400ms, 800ms, 1600ms — enough to ride out a burst past the quota.
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Cached snapshot
// ---------------------------------------------------------------------------

interface CacheEntry {
  snapshot: Snapshot;
  inflight: Promise<Snapshot> | null;
}

// Survives hot reloads in dev, where the module is re-evaluated on every edit.
const globalCache = globalThis as unknown as { __weddingSheetCache?: CacheEntry };

function cache(): CacheEntry {
  globalCache.__weddingSheetCache ??= {
    snapshot: {
      status: "unconfigured",
      guests: [],
      groups: [],
      rsvps: [],
      fetchedAt: 0,
      warnings: [],
    },
    inflight: null,
  };
  return globalCache.__weddingSheetCache;
}

async function fetchSnapshot(): Promise<Snapshot> {
  const { sheetId } = serverEnv();
  const sheets = await getClient();

  // One request for all three tabs, rather than three.
  const res = await withRetry(() =>
    sheets.spreadsheets.values.batchGet({
      spreadsheetId: sheetId,
      ranges: [
        `${SHEET_TABS.guests}!A1:Z`,
        `${SHEET_TABS.groups}!A1:Z`,
        `${SHEET_TABS.rsvp}!A1:Z`,
      ],
    }),
  );

  const [guestValues, groupValues, rsvpValues] = (res.data.valueRanges ?? []).map(
    (r) => (r.values as string[][] | undefined) ?? undefined,
  );

  const warnings: string[] = [];
  const guests = parseGuests(toRecords(guestValues), warnings);
  const groups = parseGroups(toRecords(groupValues), warnings);
  const rsvps = parseRsvps(toRecords(rsvpValues));

  // Cross-tab integrity: a guest pointing at a group that does not exist can
  // never be reached by either the QR link or the name search.
  const groupIds = new Set(groups.map((g) => g.groupId));
  const orphans = guests.filter((g) => g.groupId && !groupIds.has(g.groupId));
  for (const o of orphans) {
    warnings.push(
      `Guest "${o.nameTh || o.nameEn}" references unknown group_id "${o.groupId}"`,
    );
  }
  const emptyGroups = groups.filter(
    (g) => !guests.some((guest) => guest.groupId === g.groupId),
  );
  for (const g of emptyGroups) {
    warnings.push(`Group "${g.groupId}" has no guests`);
  }

  return {
    status: "ok",
    guests,
    groups,
    rsvps,
    fetchedAt: Date.now(),
    warnings,
  };
}

/**
 * Returns the current sheet contents, cached for CACHE_TTL_MS.
 *
 * Never throws: a failed refresh degrades to the previous snapshot marked
 * "stale" so pages keep rendering.
 */
export async function getSnapshot(
  opts: { force?: boolean } = {},
): Promise<Snapshot> {
  if (isMockMode()) return mockSnapshot();

  const entry = cache();

  if (!isConfigured()) {
    return { ...entry.snapshot, status: "unconfigured" };
  }

  const fresh = Date.now() - entry.snapshot.fetchedAt < CACHE_TTL_MS;
  if (!opts.force && fresh && entry.snapshot.fetchedAt > 0) {
    return entry.snapshot;
  }

  // Collapse concurrent refreshes into one API call.
  entry.inflight ??= fetchSnapshot()
    .then((snapshot) => {
      entry.snapshot = snapshot;
      return snapshot;
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      if (entry.snapshot.fetchedAt > 0) {
        entry.snapshot = { ...entry.snapshot, status: "stale", error: message };
        return entry.snapshot;
      }
      // Nothing cached yet — surface an empty, clearly-broken snapshot.
      return {
        status: "stale" as const,
        guests: [],
        groups: [],
        rsvps: [],
        fetchedAt: 0,
        warnings: [],
        error: message,
      };
    })
    .finally(() => {
      entry.inflight = null;
    });

  return entry.inflight;
}

/** Drops the cache so the next read hits Sheets. Used by the admin Sync button. */
export function invalidateSnapshot(): void {
  cache().snapshot = { ...cache().snapshot, fetchedAt: 0 };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface RsvpSubmission {
  groupId: string;
  submittedBy: string;
  lang: string;
  message: string;
  entries: { guestId: string; attending: boolean; dietary: string }[];
}

// Serialises appends. Sheets has no transactions, so two overlapping
// append calls can interleave; chaining them keeps rows intact.
let writeQueue: Promise<unknown> = Promise.resolve();

export async function appendRsvp(submission: RsvpSubmission): Promise<void> {
  if (isMockMode()) {
    const timestamp = new Date().toISOString();
    mockAppend(
      submission.entries.map((entry) => ({
        timestamp,
        groupId: submission.groupId,
        guestId: entry.guestId,
        attending: entry.attending,
        dietary: entry.dietary,
        message: submission.message,
        submittedBy: submission.submittedBy,
        lang: submission.lang,
      })),
    );
    return;
  }

  if (!isConfigured()) {
    throw new Error("Google Sheets is not configured (GOOGLE_SHEET_ID missing)");
  }

  const run = async () => {
    const { sheetId } = serverEnv();
    const sheets = await getClient();
    const timestamp = new Date().toISOString();

    const rows = submission.entries.map((entry) => [
      timestamp,
      submission.groupId,
      entry.guestId,
      entry.attending ? "yes" : "no",
      entry.dietary,
      submission.message,
      submission.submittedBy,
      submission.lang,
    ]);

    await withRetry(() =>
      sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${SHEET_TABS.rsvp}!A:H`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: rows },
      }),
    );

    // The cached snapshot no longer reflects the sheet.
    invalidateSnapshot();
  };

  // Keep the chain alive even if this write fails, so one error does not
  // permanently wedge every later submission.
  const result = writeQueue.then(run, run);
  writeQueue = result.catch(() => undefined);
  return result;
}
