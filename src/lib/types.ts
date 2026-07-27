/**
 * Pure data shapes for the guest list.
 *
 * Kept separate from sheets.ts because that module is `server-only` and pulls
 * in googleapis — these types are also needed by the standalone generator
 * scripts, which run under plain node.
 */

export type Side = "bride" | "groom";

export interface Guest {
  guestId: string;
  nameTh: string;
  nameEn: string;
  groupId: string;
  tableId: number;
  seatIndex: number;
  side: Side | null;
  tags: string[];
}

export interface Group {
  groupId: string;
  labelTh: string;
  labelEn: string;
  token: string;
}

export interface RsvpRow {
  timestamp: string;
  groupId: string;
  guestId: string;
  /** null means "not answered yet". */
  attending: boolean | null;
  dietary: string;
  message: string;
  submittedBy: string;
  lang: string;
}

export type SnapshotStatus = "ok" | "stale" | "unconfigured";

export interface Snapshot {
  status: SnapshotStatus;
  guests: Guest[];
  groups: Group[];
  rsvps: RsvpRow[];
  /** Epoch ms of the last successful fetch, 0 if never. */
  fetchedAt: number;
  /** Data problems in the sheet (bad seat refs, duplicate ids, orphans). */
  warnings: string[];
  /** Populated when a refresh failed and stale data is being served. */
  error?: string;
}

export const SHEET_TABS = {
  guests: "Guests",
  groups: "Groups",
  rsvp: "RSVP",
} as const;

export const GUEST_HEADERS = [
  "guest_id",
  "name_th",
  "name_en",
  "group_id",
  "table_id",
  "seat_index",
  "side",
  "tags",
] as const;

export const GROUP_HEADERS = [
  "group_id",
  "label_th",
  "label_en",
  "token",
] as const;

/** Also the column order used when appending. */
export const RSVP_HEADERS = [
  "timestamp",
  "group_id",
  "guest_id",
  "attending",
  "dietary",
  "message",
  "submitted_by",
  "lang",
] as const;
