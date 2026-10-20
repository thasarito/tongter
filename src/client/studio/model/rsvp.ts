import type { StudioGuest, StudioLayout } from "./schema";

interface RsvpOption {
  value: StudioGuest["rsvp"];
  label: string;
  shortLabel: string;
  background: string;
  border: string;
  color: string;
}

// Keep the existing sheet/import values. "Maybe" is the contacted, awaiting-reply state.
export const rsvpOptions: readonly RsvpOption[] = [
  { value: "Confirmed", label: "คอนเฟิร์มว่ามา", shortLabel: "มา", background: "#e0eddf", border: "#8eac85", color: "#2b593b" },
  { value: "Maybe", label: "ติดต่อแล้ว รอคำตอบ", shortLabel: "รอคำตอบ", background: "#fff1c8", border: "#cbb36c", color: "#705817" },
  { value: "Declined", label: "คอนเฟิร์มว่าไม่มา", shortLabel: "ไม่มา", background: "#f8dfd9", border: "#cc9a8e", color: "#8b4035" },
  { value: "Pending", label: "ยังไม่ได้ติดต่อ", shortLabel: "ยังไม่ได้ติดต่อ", background: "#fffef5", border: "#9aac8b", color: "#35513c" },
];

export const rsvpAppearance = (status: StudioGuest["rsvp"]): RsvpOption => rsvpOptions.find(option => option.value === status) ?? rsvpOptions[3];

export function confirmedAtTable(layout: StudioLayout, tableId: string): number {
  return layout.guestList.filter(guest => guest.tableId === tableId && guest.rsvp === "Confirmed").length;
}
