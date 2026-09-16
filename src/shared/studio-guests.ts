import { displayName, latestRsvpByGuest } from "./guest-list";
import type { Snapshot, SnapshotStatus } from "./types";

export interface StudioGuestImport {
  format: "glass-house-guest-tables";
  version: 1;
  status: SnapshotStatus;
  fetchedAt: number;
  guests: {
    id: string; name: string; host: string; group: string;
    rsvp: "Pending" | "Confirmed" | "Declined";
    dietary: string;
    sourceTableId: string; sourceTableLabel: string; sourceSeatNumber: number;
  }[];
}

/** Administrator-only projection. Never spread a Guest/Group/Snapshot here:
 * invitation tokens and private RSVP messages must not enter a studio export.
 * Omitted tableId/seatNumber means imports do not erase existing draft seats. */
export function buildStudioGuestImport(snapshot: Snapshot): StudioGuestImport {
  const groups = new Map(snapshot.groups.map(group => [group.groupId, group]));
  const latest = latestRsvpByGuest(snapshot);
  return {
    format: "glass-house-guest-tables",
    version: 1,
    status: snapshot.status,
    fetchedAt: snapshot.fetchedAt,
    guests: snapshot.guests.map((guest): StudioGuestImport["guests"][number] => {
      const group = groups.get(guest.groupId), rsvp = latest.get(guest.guestId);
      return {
        id: guest.guestId,
        name: displayName(guest, "th") || guest.guestId,
        host: guest.side === "bride" ? "Bride" : guest.side === "groom" ? "Groom" : "",
        group: group?.labelTh || group?.labelEn || guest.groupId,
        rsvp: rsvp?.attending === true ? "Confirmed" : rsvp?.attending === false ? "Declined" : "Pending",
        dietary: rsvp?.dietary || "",
        sourceTableId: `site-table-${guest.tableId}`,
        sourceTableLabel: `Live site · Table ${guest.tableId}`,
        sourceSeatNumber: guest.seatIndex,
      };
    }),
  };
}
