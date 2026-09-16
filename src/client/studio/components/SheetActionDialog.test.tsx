import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { SheetActionSummary, SheetChangeRow } from "../model/sheet-action-summary";
import { SheetActionDialog } from "./SheetActionDialog";

const move = (): SheetActionSummary => ({
  title: "Move Alice", description: "Review the before-and-after details below.",
  confirmLabel: "Confirm & save", tone: "normal", stats: [{ label: "Guests", value: 1 }],
  rows: [{ key: "guest:alice", name: "Alice", action: "Move", details: [
    { field: "Seat", before: "Table 1 · Seat 1", after: "Table 2 · Seat 3" },
  ] }], warnings: [], footnote: "Only these changes will enter the save queue.",
});
function mount(summary = move(), error = "") {
  const onConfirm = vi.fn(), onCancel = vi.fn();
  render(<SheetActionDialog review={{ id: "review-1", summary, error }} onConfirm={onConfirm} onCancel={onCancel}/>);
  return { onConfirm, onCancel, dialog: screen.getByRole("dialog") };
}
afterEach(cleanup);

describe("compact sheet confirmation", () => {
  it("shows just a specific action and two buttons", () => {
    const { dialog, onConfirm } = mount();
    expect(dialog).toHaveAccessibleName("Move Alice to Table 2 · Seat 3");
    expect(dialog.textContent).toBe("Move Alice to Table 2 · Seat 3CancelConfirm");
    expect(within(dialog).getAllByRole("button")).toHaveLength(2);
    expect(dialog.querySelector("dl, nav, table, small")).toBeNull();
    expect(screen.getByRole("button", { name: "Cancel", exact: true })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Confirm", exact: true }));
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith("review-1");
  });

  it("names both guests in a swap without displaying the diff", () => {
    const summary = move(); summary.title = "Swap guest seats";
    summary.rows.push({ key: "guest:bob", name: "Bob", action: "Move", details: [
      { field: "Seat", before: "Table 2 · Seat 3", after: "Table 1 · Seat 1" },
    ] });
    const { dialog } = mount(summary);
    expect(dialog.textContent).toBe("Swap Alice and BobCancelConfirm");
  });

  it("keeps a bulk deletion to one action, regardless of row count", () => {
    const summary = move(); summary.title = "Update 120 records"; summary.tone = "danger";
    summary.rows = Array.from({ length: 120 }, (_, index): SheetChangeRow => ({
      key: `guest:${index}`, name: `Guest ${index}`, action: "Remove", details: [],
    }));
    summary.stats = [{ label: "Guests", value: 120 }];
    summary.warnings = ["120 guest record(s) will be removed from the live roster, not just unassigned."];
    const { dialog } = mount(summary);
    expect(dialog.textContent).toBe("Remove 120 guestsCancelConfirm");
    expect(screen.getByRole("button", { name: "Confirm", exact: true })).toHaveClass("danger");
  });

  it("Cancel and Escape still cancel the same review without saving", () => {
    const { dialog, onConfirm, onCancel } = mount();
    fireEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }));
    expect(onCancel).toHaveBeenCalledWith("review-1");
    fireEvent(dialog, new Event("cancel", { cancelable: true, bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("shows an actionable error only when confirmation is blocked", () => {
    const { dialog, onConfirm } = mount(move(), "The seat changed.");
    expect(screen.getByRole("alert")).toHaveTextContent("The seat changed.");
    expect(screen.getByRole("alert")).toHaveTextContent("Cancel and try again.");
    expect(dialog).toHaveAccessibleDescription("The seat changed. Cancel and try again.");
    const confirm = screen.getByRole("button", { name: "Confirm", exact: true });
    expect(confirm).toBeDisabled(); fireEvent.click(confirm); expect(onConfirm).not.toHaveBeenCalled();
  });

  it("renders long Unicode names as text, not markup or truncated badges", () => {
    const summary = move(), name = "แขกทดสอบชื่อยาว <img src=x onerror=alert(1)>";
    summary.title = `Move ${name}`; summary.rows[0].name = name;
    const { dialog } = mount(summary);
    expect(dialog).toHaveAccessibleName(`Move ${name} to Table 2 · Seat 3`);
    expect(dialog.querySelector("img")).toBeNull();
  });
});
