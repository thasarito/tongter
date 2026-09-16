import { describe, expect, it } from "vitest";
import { mutationBetween } from "@/shared/studio-mutations";
import { defaultLayout } from "./defaults";
import { clone, normalizeLayout } from "./schema";
import { moveGuests, removeItem } from "./commands";
import { summarizeSheetMutation, summarizeSheetReload, summarizeSheetRetry } from "./sheet-action-summary";
const fixture = () => normalizeLayout({ ...defaultLayout(), guestList: [
  { id: "test-a", name: "Alice", tableId: "table-1", seatNumber: 1 },
  { id: "test-b", name: "Bob", tableId: "table-2", seatNumber: 2 },
] });
describe("readable sheet action summaries", () => {
  it("describes both sides of a swap using table labels and exact seats", () => {
    const before = fixture(), after = moveGuests(before, ["test-a"], { tableId: "table-2", seatNumber: 2 });
    const summary = summarizeSheetMutation(before, mutationBetween(before, after));
    expect(summary.title).toBe("Swap guest seats"); expect(summary.rows).toHaveLength(2);
    expect(summary.rows[0].details).toContainEqual({ field: "Seat", before: "Table 1 · Seat 1", after: "Table 2 · Seat 2" });
    expect(summary.rows[1].details).toContainEqual({ field: "Seat", before: "Table 2 · Seat 2", after: "Table 1 · Seat 1" });
  });
  it("distinguishes removing an object from deleting its assigned guests", () => {
    const before = fixture(), after = removeItem(before, "table-1");
    const summary = summarizeSheetMutation(before, mutationBetween(before, after));
    expect(summary.tone).toBe("danger"); expect(summary.warnings.join(" ")).toContain("Their records are kept");
    expect(summary.warnings.join(" ")).not.toContain("guest record(s) will be removed");
  });
  it("shows changed dimensions with units and leaves derived caches out", () => {
    const before = fixture(), after = clone(before); after.items[0].x = 2; after.items[0].rotation = 45;
    const summary = summarizeSheetMutation(before, mutationBetween(before, after));
    expect(summary.rows).toHaveLength(1);
    expect(summary.rows[0].details.find(detail => detail.field === "Position")?.after).toContain("X 2 m");
    expect(summary.rows[0].details).toContainEqual({ field: "Rotation", before: "15°", after: "45°" });
    expect(summary.rows[0].details.some(detail => detail.field === "guests")).toBe(false);
  });
  it("shows full Unicode values, boolean changes, and explicit blank fields", () => {
    const before = fixture(), after = clone(before); after.guestList[0].notes = "ข้อความทดสอบ".repeat(30); after.guestList[0].vip = true;
    const summary = summarizeSheetMutation(before, mutationBetween(before, after));
    expect(summary.rows[0].details).toContainEqual({ field: "Notes", before: "Not set", after: after.guestList[0].notes });
    expect(summary.rows[0].details).toContainEqual({ field: "VIP", before: "No", after: "Yes" });
  });
  it("keeps all bulk rows available rather than silently truncating the review", () => {
    const before = fixture(), after = normalizeLayout({ ...before, guestList: Array.from({ length: 120 }, (_, index) => ({ id: `bulk-${index}`, name: `Test ${index}` })) });
    const summary = summarizeSheetMutation(before, mutationBetween(before, after), "commit", "Replace roster from CSV");
    expect(summary.title).toBe("Replace the guest roster from CSV");
    expect(summary.rows).toHaveLength(122); expect(summary.warnings.join(" ")).toContain("2 guest record(s)");
  });
  it("labels undo, queued retries, and read-only reloads distinctly", () => {
    const before = fixture(), after = clone(before); after.guestList[0].vip = true;
    const op = mutationBetween(before, after);
    expect(summarizeSheetMutation(before, op, "undo").title).toMatch(/^Undo:/);
    const retry = summarizeSheetRetry(before, [op, { ...op, id: "another-operation" }]);
    expect(retry.rows).toHaveLength(2); expect(new Set(retry.rows.map(row => row.key)).size).toBe(2);
    expect(summarizeSheetReload().description).toContain("read-only");
    expect(summarizeSheetReload().rows).toHaveLength(0);
  });
});
