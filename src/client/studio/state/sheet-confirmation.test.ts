import { describe, expect, it, vi } from "vitest";
import { summarizeSheetReload } from "../model/sheet-action-summary";
import { SheetConfirmationGate } from "./sheet-confirmation";

describe("sheet confirmation gate", () => {
  it("waits for explicit approval and consumes it only once", () => {
    const gate = new SheetConfirmationGate(() => {}), execute = vi.fn();
    gate.request(summarizeSheetReload(), execute);
    const id = gate.current!.id;
    expect(execute).not.toHaveBeenCalled();
    gate.confirm("stale-review");
    expect(execute).not.toHaveBeenCalled();
    gate.confirm(id); gate.confirm(id);
    expect(execute).toHaveBeenCalledOnce();
    expect(gate.current).toBeNull();
  });
  it("cancels without executing and does not replace a pending review", () => {
    const gate = new SheetConfirmationGate(() => {}), first = vi.fn(), second = vi.fn();
    expect(gate.request(summarizeSheetReload(), first)).toBe(true);
    expect(gate.request(summarizeSheetReload(), second)).toBe(false);
    gate.cancel(gate.current!.id);
    expect(first).not.toHaveBeenCalled(); expect(second).not.toHaveBeenCalled();
    expect(gate.current).toBeNull();
  });
  it("requires a new review after failed revalidation", () => {
    const gate = new SheetConfirmationGate(() => {}), execute = vi.fn(() => { throw Error("Seat changed"); });
    gate.request(summarizeSheetReload(), execute); const id = gate.current!.id;
    gate.confirm(id); gate.confirm(id);
    expect(gate.current!.error).toBe("Seat changed"); expect(execute).toHaveBeenCalledOnce();
    gate.cancel(id); expect(gate.current).toBeNull();
  });
  it("freezes the displayed summary against subsequent caller mutations", () => {
    const gate = new SheetConfirmationGate(() => {}), summary = summarizeSheetReload();
    gate.request(summary, () => {}); summary.title = "Something else";
    expect(gate.current!.summary.title).toBe("Reload Google Sheets");
  });
});
