import { describe, expect, it } from "vitest";
import { mutationBetween } from "@/shared/studio-mutations";
import { defaultLayout } from "./defaults";
import { clone, normalizeLayout } from "./schema";
import { moveGuests, removeItem } from "./commands";
import { summarizeSheetMutation, summarizeSheetReload, summarizeSheetRetry } from "./sheet-action-summary";
import { compactSheetAction } from "./compact-sheet-action";

const fixture = () => normalizeLayout({ ...defaultLayout(), guestList: [
  { id: "alice", name: "Alice", tableId: "table-1", seatNumber: 1 },
  { id: "bob", name: "Bob", tableId: "table-2", seatNumber: 2 },
] });
describe("compact sheet action wording", () => {
  it("retains the destination seat without changing the internal review", () => {
    const before = fixture(), after = moveGuests(before, ["alice"], { tableId: "table-3", seatNumber: 4 });
    const summary = summarizeSheetMutation(before, mutationBetween(before, after)), original = structuredClone(summary);
    expect(compactSheetAction(summary)).toBe("Move Alice to Table 3 · Seat 4");
    expect(summary).toEqual(original);
  });
  it("summarizes both deletion and seat release without confusing them", () => {
    const before = fixture(), after = removeItem(before, "table-1");
    const text = compactSheetAction(summarizeSheetMutation(before, mutationBetween(before, after)));
    expect(text).toContain("Remove Table 1"); expect(text).toMatch(/[Uu]nassign Alice/);
    expect(text).not.toContain("Remove Alice");
  });
  it("uses lock/unlock as the action instead of a boolean diff", () => {
    const before = fixture(), after = clone(before); after.items[0].locked = true;
    expect(compactSheetAction(summarizeSheetMutation(before, mutationBetween(before, after)))).toBe("Lock Table 1");
    expect(compactSheetAction(summarizeSheetMutation(after, mutationBetween(after, before)))).toBe("Unlock Table 1");
  });
  it("keeps undo and redo intent when shortening a swap", () => {
    const before = fixture(), after = moveGuests(before, ["alice"], { tableId: "table-2", seatNumber: 2 });
    const operation = mutationBetween(before, after);
    expect(compactSheetAction(summarizeSheetMutation(before, operation, "undo"))).toBe("Undo: Swap Alice and Bob");
    expect(compactSheetAction(summarizeSheetMutation(before, operation, "redo"))).toBe("Redo: Swap Alice and Bob");
  });
  it("keeps import and retry intent instead of listing their record changes", () => {
    const before = fixture(), after = clone(before); after.guestList[0].vip = true;
    const operation = mutationBetween(before, after);
    expect(compactSheetAction(summarizeSheetMutation(before, operation, "commit", "Replace roster from CSV"))).toBe("Replace the guest roster from CSV");
    expect(compactSheetAction(summarizeSheetRetry(before, [operation]))).toBe("Retry 1 pending save");
    expect(compactSheetAction(summarizeSheetReload())).toBe("Reload Google Sheets");
  });
  it("includes clearing assignments in the reference-layout action", () => {
    const before = fixture(), after = moveGuests(before, ["alice", "bob"], { tableId: "" });
    const summary = summarizeSheetMutation(before, mutationBetween(before, after), "commit", "Restore reference layout");
    expect(compactSheetAction(summary)).toBe("Restore reference layout and unassign 2 guests");
  });
});
