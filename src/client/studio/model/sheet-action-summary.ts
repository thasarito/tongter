import type { StudioChange, StudioMutation } from "@/shared/studio-mutations";
import type { StudioGuest, StudioItem, StudioLayout } from "./schema";

export interface SheetChangeDetail { field: string; before: string; after: string }
export interface SheetChangeRow {
  key: string;
  name: string;
  action: "Add" | "Remove" | "Move" | "Unassign" | "Update";
  details: SheetChangeDetail[];
}
export interface SheetActionSummary {
  title: string;
  description: string;
  confirmLabel: string;
  tone: "normal" | "danger" | "read";
  stats: { label: string; value: number }[];
  rows: SheetChangeRow[];
  warnings: string[];
  footnote: string;
}
const fieldNames: Record<string, string> = {
  name: "Name", host: "Side / host", group: "Group", status: "Invitation status", rsvp: "RSVP",
  reserve: "Reserve", important: "Important guest", vip: "VIP", heart: "Heart", star: "Star",
  notes: "Notes", dietary: "Dietary requirements", label: "Label", kind: "Object type", shape: "Shape",
  w: "Width", d: "Depth", h: "Height", rotation: "Rotation", seats: "Seat capacity", locked: "Locked",
  aisleWidth: "Aisle width", sourceTableId: "Original table ID", sourceTableLabel: "Original table label",
  sourceSeatNumber: "Original seat", unmappedTableId: "Unmapped table ID",
  unmappedTableLabel: "Unmapped table label", unmappedSeatNumber: "Unmapped seat",
};
const metric = new Set(["x", "z", "w", "d", "h", "aisleWidth"]);
function valueText(value: unknown, field: string): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    const rounded = Math.round(value * 1000) / 1000;
    const number = `${Math.abs(rounded - value) > 1e-9 ? "≈" : ""}${rounded}`;
    return number + (metric.has(field) ? " m" : field === "rotation" ? "°" : "");
  }
  return String(value);
}
const placementKey = (guest: StudioGuest | null) => guest?.tableId ? `${guest.tableId}:${guest.seatNumber}` : "";
const itemName = (item: StudioItem) => item.kind === "table" ? `Table ${item.label}` : item.label || item.kind;
function placement(guest: StudioGuest | null, items: Map<string, StudioItem>): string {
  if (!guest) return "No record";
  if (!guest.tableId) return "Unassigned";
  return `Table ${items.get(guest.tableId)?.label || guest.tableId} · Seat ${guest.seatNumber ?? "not set"}`;
}
function position(item: StudioItem | null): string {
  return item ? `X ${valueText(item.x, "x")} · Z ${valueText(item.z, "z")}` : "No object";
}
function rowFor(change: StudioChange, beforeItems: Map<string, StudioItem>, afterItems: Map<string, StudioItem>): SheetChangeRow {
  const record = change.after ?? change.before!;
  const details: SheetChangeDetail[] = [];
  const changed = (keys: string[]) => keys.some(key => Reflect.get(change.before ?? {}, key) !== Reflect.get(change.after ?? {}, key));
  let action: SheetChangeRow["action"] = !change.before ? "Add" : !change.after ? "Remove" : "Update";
  if (change.entity === "guest") {
    if (changed(["tableId", "seatNumber"])) {
      details.push({ field: "Seat", before: placement(change.before, beforeItems), after: placement(change.after, afterItems) });
      if (change.before && change.after) action = change.after.tableId ? "Move" : "Unassign";
    }
  } else if (changed(["x", "z"])) {
    details.push({ field: "Position", before: position(change.before), after: position(change.after) });
    if (change.before && change.after) action = "Move";
  }
  const keys = new Set([...Object.keys(change.before ?? {}), ...Object.keys(change.after ?? {})]);
  for (const key of keys) {
    if (["id", "guests", "x", "z", "tableId", "seatNumber"].includes(key) || !changed([key])) continue;
    const before = Reflect.get(change.before ?? {}, key), after = Reflect.get(change.after ?? {}, key);
    // Add/remove reviews show meaningful record details, not dozens of blank defaults.
    if ((!change.before || !change.after) && ["", null, undefined, false].includes(before ?? after)) continue;
    details.push({ field: fieldNames[key] ?? key, before: valueText(before, key), after: valueText(after, key) });
  }
  if (action === "Remove") details.unshift({ field: "Record", before: "In the live sheet", after: "Removed" });
  return { key: `${change.entity}:${change.id}`, name: change.entity === "guest" ? (record as StudioGuest).name : itemName(record as StudioItem), action, details };
}
/** Describe the actual mutation, not just a button label. This never changes data. */
export function summarizeSheetMutation(layout: StudioLayout, operation: StudioMutation, intent: "commit" | "undo" | "redo" = "commit", label = ""): SheetActionSummary {
  const beforeItems = new Map(layout.items.map(item => [item.id, item]));
  const afterItems = new Map(beforeItems);
  for (const change of operation.changes) if (change.entity === "item") {
    if (change.before) beforeItems.set(change.id, change.before);
    if (change.after) afterItems.set(change.id, change.after);
    else afterItems.delete(change.id);
  }
  const rows = operation.changes.map(change => rowFor(change, beforeItems, afterItems));
  const guests = operation.changes.filter(change => change.entity === "guest");
  const objects = operation.changes.length - guests.length;
  const removedGuests = guests.filter(change => !change.after).length;
  const removedObjects = operation.changes.filter(change => change.entity === "item" && !change.after).length;
  const unassigned = guests.filter(change => change.before?.tableId && change.after && !change.after.tableId).length;
  const warnings: string[] = [];
  if (removedGuests) warnings.push(`${removedGuests} guest record(s) will be removed from the live roster, not just unassigned.`);
  if (removedObjects) warnings.push(`${removedObjects} table / event object(s) will be removed from the live layout.`);
  if (unassigned) warnings.push(`${unassigned} guest(s) will return to Unassigned. Their records are kept.`);
  const swap = guests.length === 2 && !objects && guests.every(change => change.before?.tableId && change.after?.tableId)
    && placementKey(guests[0].before) === placementKey(guests[1].after)
    && placementKey(guests[1].before) === placementKey(guests[0].after)
    && placementKey(guests[0].before) !== placementKey(guests[0].after);
  let title = rows.length === 1 ? `${rows[0].action} ${rows[0].name}` : swap ? "Swap guest seats" : `Update ${rows.length} records`;
  if (/reference layout/i.test(label)) title = "Restore the reference layout";
  else if (/CSV/i.test(label)) title = /replace/i.test(label) ? "Replace the guest roster from CSV" : "Import guest changes from CSV";
  if (intent !== "commit") title = `${intent === "undo" ? "Undo" : "Redo"}: ${title}`;
  return {
    title, description: "Review the before-and-after details below. This action will update the live Google Sheets seating plan.",
    confirmLabel: "Confirm & save", tone: removedGuests || removedObjects || unassigned ? "danger" : "normal",
    stats: [...(guests.length ? [{ label: "Guests", value: guests.length }] : []), ...(objects ? [{ label: "Objects", value: objects }] : [])],
    rows, warnings,
    footnote: "Only these changes will enter the save queue. You can keep editing while Sheets syncs. Cancelling does not stop earlier confirmed saves.",
  };
}
export function summarizeSheetRetry(layout: StudioLayout, operations: StudioMutation[]): SheetActionSummary {
  const summaries = operations.map(operation => summarizeSheetMutation(layout, operation));
  return {
    title: `Retry ${operations.length} pending save${operations.length === 1 ? "" : "s"}`,
    description: "Resume these previously confirmed changes in order. Existing operation IDs are reused so an interrupted save is not applied twice.",
    confirmLabel: "Confirm retry", tone: "normal", stats: [{ label: "Pending saves", value: operations.length }],
    rows: summaries.flatMap((summary, index) => summary.rows.map(row => ({ ...row, key: `${operations[index].id}:${row.key}`, name: `${index + 1}. ${row.name}` }))),
    warnings: [], footnote: "Cancelling this retry does not discard previously confirmed changes. Automatic reconnection may still resume them.",
  };
}
export function summarizeSheetReload(): SheetActionSummary {
  return {
    title: "Reload Google Sheets", description: "This is a read-only action. Fetch the latest guests, exact seats and table positions from the live sheet into this view.",
    confirmLabel: "Confirm reload", tone: "read", stats: [], rows: [], warnings: [],
    footnote: "No spreadsheet cells, invitation links or RSVP history will be changed. Pending edits are never overwritten by a reload.",
  };
}
