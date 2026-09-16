import type { SheetActionSummary, SheetChangeRow } from "./sheet-action-summary";

function describe(row: SheetChangeRow): string {
  const seat = row.details.find(detail => detail.field === "Seat");
  if (row.action === "Move" && row.key.startsWith("guest:") && seat) {
    return `Move ${row.name} to ${seat.after}`;
  }
  const lock = row.details.length === 1 && row.details[0].field === "Locked" ? row.details[0] : null;
  if (row.action === "Update" && lock) return `${lock.after === "Yes" ? "Lock" : "Unlock"} ${row.name}`;
  return `${row.action} ${row.name}`;
}

/** Presentation only: keep the full review untouched for exact-mutation revalidation. */
export function compactSheetAction(summary: SheetActionSummary): string {
  const { rows, title } = summary;
  const prefix = title.match(/^(Undo|Redo): /)?.[0] ?? "";
  const action = title.slice(prefix.length);
  if (!rows.length || /^(Retry |Reload |Import |Replace the guest roster)/.test(action)) return title;
  if (action === "Restore the reference layout") {
    const count = rows.filter(row => row.action === "Unassign").length;
    return `${prefix}Restore reference layout${count ? ` and unassign ${count} guest${count === 1 ? "" : "s"}` : ""}`;
  }
  if (action === "Swap guest seats" && rows.length === 2) return `${prefix}Swap ${rows[0].name} and ${rows[1].name}`;
  if (rows.length === 1) return prefix + describe(rows[0]);

  // Summarize bulk work by action, never by rendering a growing list of records.
  // Keep removals distinct from releasing seats, including when deleting a table.
  const clauses: string[] = [];
  for (const verb of ["Remove", "Unassign", "Add", "Move", "Update"] as const) {
    for (const entity of ["guest", "item"] as const) {
      const group = rows.filter(row => row.action === verb && row.key.startsWith(`${entity}:`));
      if (group.length === 1) clauses.push(describe(group[0]));
      else if (group.length) clauses.push(`${verb} ${group.length} ${entity === "guest" ? "guests" : "objects"}`);
    }
  }
  return clauses.length ? prefix + clauses.map((clause, index) => index ? clause[0].toLowerCase() + clause.slice(1) : clause).join("; ") : title;
}
