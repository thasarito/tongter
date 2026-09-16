import { displayName, latestRsvpByGuest } from "./guest-list";
import type { Snapshot, SnapshotStatus } from "./types";

export interface StudioGuestImport {
  format: "glass-house-guest-tables";
  version: 1;
  status: SnapshotStatus;
  fetchedAt: number;
  guests: {
    id: string;
    name: string;
    host: string;
    group: string;
    rsvp: "Pending" | "Confirmed" | "Declined";
    dietary: string;
    sourceTableId: string;
    sourceTableLabel: string;
    sourceSeatNumber: number;
  }[];
}

/**
 * Admin-only DTO. Deliberately excludes personal/group invitation tokens and
 * RSVP messages. Never spread a Snapshot, Guest or Group into this response.
 * The site's 10-table plan and the studio's 20-table draft are different plans.
 * Omit tableId/seatNumber: first import is unassigned; subsequent merge imports
 * preserve draft assignments instead of silently unseating matching guests.
 */
export function buildStudioGuestImport(snapshot: Snapshot): StudioGuestImport {
  const groups = new Map(snapshot.groups.map(group => [group.groupId, group]));
  const latest = latestRsvpByGuest(snapshot);
  return {
    format: "glass-house-guest-tables",
    version: 1,
    status: snapshot.status,
    fetchedAt: snapshot.fetchedAt,
    guests: snapshot.guests.map(guest => {
      const group = groups.get(guest.groupId);
      const rsvp = latest.get(guest.guestId);
      return {
        id: guest.guestId,
        name: displayName(guest, "th") || guest.guestId,
        host: guest.side === "bride" ? "Bride" : guest.side === "groom" ? "Groom" : "",
        group: group?.labelTh || group?.labelEn || guest.groupId,
        rsvp: rsvp?.attending === true ? "Confirmed" : rsvp?.attending === false ? "Declined" : "Pending",
        dietary: rsvp?.dietary || "",
        sourceTableId: `site-table-${guest.tableId}`,
        sourceTableLabel: `Live site · Table ${guest.tableId}`,
        // The Guests sheet's seat_index is already 1-based.
        sourceSeatNumber: guest.seatIndex,
      };
    }),
  };
}
