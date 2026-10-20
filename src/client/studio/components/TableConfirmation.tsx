import { confirmedAtTable } from "../model/rsvp";
import { useStudio } from "../state/StudioProvider";

export function TableConfirmation({ tableId, className = "" }: { tableId: string; className?: string }) {
  const { layout } = useStudio();
  const table = layout.items.find(item => item.id === tableId && item.kind === "table");
  if (!table) return null;
  return <span className={`studio-table-confirmation ${className}`} aria-label={`Table ${table.label}: Confirmed ${confirmedAtTable(layout, tableId)}/${table.seats}`}>
    Confirmed {confirmedAtTable(layout, tableId)}/{table.seats}
  </span>;
}
