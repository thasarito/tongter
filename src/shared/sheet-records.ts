import { parseAttending } from "./guest-list.ts";
import type { Group, Guest, RsvpRow, Side, Snapshot } from "./types.ts";
import { isValidSeat } from "./venue.ts";

function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[\s_-]/g, "");
}

function toRecords(values: string[][] | undefined): Record<string, string>[] {
  if (!values || values.length < 2) return [];
  const headers = values[0].map(normaliseHeader);
  return values.slice(1).flatMap((row) => {
    if (row.every((cell) => !cell?.trim())) return [];
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) record[header] = (row[index] ?? "").trim();
    });
    return [record];
  });
}

function parseSide(raw: string): Side | null {
  const value = raw.toLowerCase();
  if (value === "bride" || value === "เจ้าสาว" || value === "b") return "bride";
  if (value === "groom" || value === "เจ้าบ่าว" || value === "g") return "groom";
  return null;
}

function parseGuests(records: Record<string, string>[], warnings: string[]): Guest[] {
  const seen = new Set<string>();
  const seatTaken = new Map<string, string>();
  const tokenOwner = new Map<string, string>();

  return records.flatMap((record, index) => {
    const rowNo = index + 2;
    const guestId = record.guestid;
    const nameTh = record.nameth ?? "";
    const nameEn = record.nameen ?? "";
    if (!guestId) {
      warnings.push(`Guests row ${rowNo}: missing guest_id, row skipped`);
      return [];
    }
    if (seen.has(guestId)) {
      warnings.push(`Guests row ${rowNo}: duplicate guest_id "${guestId}", row skipped`);
      return [];
    }
    if (!nameTh && !nameEn) warnings.push(`Guests row ${rowNo}: no name in either language`);

    const tableId = Number(record.tableid);
    const seatIndex = Number(record.seatindex);
    if (!Number.isFinite(tableId) || !Number.isFinite(seatIndex)) {
      warnings.push(`Guests row ${rowNo} ("${nameTh || nameEn}"): table_id/seat_index not numeric`);
      return [];
    }
    if (!isValidSeat(tableId, seatIndex)) {
      warnings.push(`Guests row ${rowNo} ("${nameTh || nameEn}"): seat T${tableId}#${seatIndex} does not exist`);
      return [];
    }

    const seatKey = `${tableId}:${seatIndex}`;
    const previous = seatTaken.get(seatKey);
    if (previous) {
      warnings.push(`Guests row ${rowNo}: seat T${tableId}#${seatIndex} already assigned to "${previous}"`);
    }
    seatTaken.set(seatKey, nameTh || nameEn || guestId);
    seen.add(guestId);
    if (!record.groupid) {
      warnings.push(`Guests row ${rowNo} ("${nameTh || nameEn}"): missing group_id`);
    }

    const token = (record.token ?? "").trim();
    const previousTokenOwner = token && tokenOwner.get(token);
    if (previousTokenOwner) {
      warnings.push(`Guests row ${rowNo}: personal token for "${nameTh || nameEn}" is identical to "${previousTokenOwner}" — regenerate it`);
    } else if (token) {
      tokenOwner.set(token, nameTh || nameEn || guestId);
    }

    return [{
      guestId,
      nameTh,
      nameEn,
      groupId: record.groupid ?? "",
      tableId,
      seatIndex,
      side: parseSide(record.side ?? ""),
      tags: (record.tags ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
      token,
    }];
  });
}

function parseGroups(records: Record<string, string>[], warnings: string[]): Group[] {
  const seenIds = new Set<string>();
  const tokenOwners = new Map<string, string>();
  return records.flatMap((record, index) => {
    const rowNo = index + 2;
    if (!record.groupid) {
      warnings.push(`Groups row ${rowNo}: missing group_id, row skipped`);
      return [];
    }
    if (seenIds.has(record.groupid)) {
      warnings.push(`Groups row ${rowNo}: duplicate group_id "${record.groupid}", row skipped`);
      return [];
    }
    if (!record.token) {
      warnings.push(`Groups row ${rowNo} ("${record.groupid}"): missing token — its QR link will not work`);
      return [];
    }
    const previous = tokenOwners.get(record.token);
    if (previous) {
      warnings.push(`Groups row ${rowNo}: token for "${record.groupid}" is identical to "${previous}" — regenerate it`);
      return [];
    }
    seenIds.add(record.groupid);
    tokenOwners.set(record.token, record.groupid);
    return [{
      groupId: record.groupid,
      labelTh: record.labelth ?? "",
      labelEn: record.labelen ?? "",
      token: record.token,
    }];
  });
}

function parseRsvps(records: Record<string, string>[]): RsvpRow[] {
  return records.map((record) => ({
    timestamp: record.timestamp ?? "",
    groupId: record.groupid ?? "",
    guestId: record.guestid ?? "",
    attending: parseAttending(record.attending ?? ""),
    dietary: record.dietary ?? "",
    message: record.message ?? "",
    submittedBy: record.submittedby ?? "",
    lang: record.lang ?? "",
  }));
}

export function snapshotFromBatchValues(
  valueRanges: Array<{ values?: string[][] }> | undefined,
  fetchedAt: number,
): Snapshot {
  const warnings: string[] = [];
  const [guestRange, groupRange, rsvpRange] = valueRanges ?? [];
  const guests = parseGuests(toRecords(guestRange?.values), warnings);
  const groups = parseGroups(toRecords(groupRange?.values), warnings);
  const rsvps = parseRsvps(toRecords(rsvpRange?.values));
  const groupIds = new Set(groups.map((group) => group.groupId));
  for (const guest of guests) {
    if (guest.groupId && !groupIds.has(guest.groupId)) {
      warnings.push(`Guest "${guest.nameTh || guest.nameEn}" references unknown group_id "${guest.groupId}"`);
    }
  }
  for (const group of groups) {
    if (!guests.some((guest) => guest.groupId === group.groupId)) {
      warnings.push(`Group "${group.groupId}" has no guests`);
    }
  }
  return { status: "ok", guests, groups, rsvps, fetchedAt, warnings };
}
