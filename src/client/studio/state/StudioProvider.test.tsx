import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, renderHook, screen } from "@testing-library/react";
import { applyMutation, type StudioMutation } from "@/shared/studio-mutations";
import type { StudioSheetSnapshot } from "@/shared/studio-sheet";
import { moveGuests } from "../model/commands";
import { defaultLayout } from "../model/defaults";
import { clone, normalizeLayout, type StudioLayout } from "../model/schema";
import { StudioProvider, useStudio } from "./StudioProvider";
import { SheetSaveError } from "./sheet-source";
import { clearRsvpNoteDraft, readRsvpNoteDraft, storeRsvpNoteDraft } from "./rsvp-note-draft";

const approve = () => fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
const queueKey = "tongter:studio:pending-v2";
const noteDraftKey = (id: string) => `tongter:studio:rsvp-note-v1:${id}`;
function connection() {
  let layout = normalizeLayout({
    ...defaultLayout(),
    items: defaultLayout().items.map(item => ({ ...item, x: 0, z: 0 })),
    guestList: [
      { id: "synthetic-1", name: "First guest", tableId: "table-1", seatNumber: 1 },
      { id: "synthetic-2", name: "Second guest", tableId: "table-2", seatNumber: 1 },
    ],
  });
  const receipts = new Set<string>();
  const requests: {
    operation: StudioMutation;
    resolve: (snapshot: StudioSheetSnapshot) => void;
    reject: (cause: Error) => void;
  }[] = [];
  const snapshot = (): StudioSheetSnapshot => ({
    status: "ok", source: "Google Sheets", revision: String(receipts.size),
    fetchedAt: 1, layout: clone(layout),
  });
  const save = (operation: StudioMutation) => new Promise<StudioSheetSnapshot>((resolve, reject) => {
    requests.push({ operation, resolve, reject });
  });
  const apply = (index: number) => {
    const operation = requests[index].operation;
    if (!receipts.has(operation.id)) {
      layout = applyMutation(layout, operation);
      receipts.add(operation.id);
    }
    return snapshot();
  };
  return {
    requests, snapshot, save, apply,
    remote(update: (value: StudioLayout) => StudioLayout) { layout = normalizeLayout(update(clone(layout))); },
    async confirm(index: number) { await act(async () => { requests[index].resolve(apply(index)); }); },
    async reject(index: number, error: Error) { await act(async () => { requests[index].reject(error); }); },
  };
}
function mount(writer: ReturnType<typeof connection>) {
  const view = renderHook(() => useStudio(), { wrapper: StudioProvider });
  act(() => {
    view.result.current.hydrate(writer.snapshot().layout);
    view.result.current.connect(writer.save);
  });
  return {
    ...view,
    move(id: string, x: number) {
      act(() => view.result.current.commit("Object moved", layout => ({
        ...layout, items: layout.items.map(item => item.id === id ? { ...item, x } : item),
      })));
      approve();
    },
    x(id: string) { return view.result.current.layout.items.find(item => item.id === id)!.x; },
  };
}
beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("recoverable RSVP note drafts", () => {
  it("keeps raw text per guest and rejects oversized stored drafts", () => {
    expect(readRsvpNoteDraft("synthetic-1")).toBeNull();
    expect(storeRsvpNoteDraft("synthetic-1", "  Draft with spaces  ")).toBe(true);
    expect(storeRsvpNoteDraft("synthetic-2", "")).toBe(true);
    expect(readRsvpNoteDraft("synthetic-1")).toBe("  Draft with spaces  ");
    expect(readRsvpNoteDraft("synthetic-2")).toBe("");
    localStorage.setItem(noteDraftKey("synthetic-1"), "x".repeat(4001));
    expect(readRsvpNoteDraft("synthetic-1")).toBeNull();
    expect(storeRsvpNoteDraft("synthetic-1", "x".repeat(4000))).toBe(true);
    expect(readRsvpNoteDraft("synthetic-1")).toHaveLength(4000);
  });

  it("clears matching normalized text while retaining newer drafts", () => {
    storeRsvpNoteDraft("synthetic-1", "  New note  ");
    clearRsvpNoteDraft("synthetic-1", "Old note");
    expect(readRsvpNoteDraft("synthetic-1")).toBe("  New note  ");
    clearRsvpNoteDraft("synthetic-1", "New note");
    expect(readRsvpNoteDraft("synthetic-1")).toBeNull();
    storeRsvpNoteDraft("synthetic-1", "Discard explicitly");
    clearRsvpNoteDraft("synthetic-1");
    expect(readRsvpNoteDraft("synthetic-1")).toBeNull();
  });

  it("handles unavailable draft storage without interrupting the editor", () => {
    const unavailable = () => { throw Error("Storage unavailable"); };
    const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(unavailable);
    try {
      expect(readRsvpNoteDraft("synthetic-1")).toBeNull();
      expect(() => clearRsvpNoteDraft("synthetic-1", "Expected note")).not.toThrow();
    } finally { read.mockRestore(); }
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(unavailable);
    try { expect(storeRsvpNoteDraft("synthetic-1", "Keep typing")).toBe(false); }
    finally { write.mockRestore(); }
    const remove = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(unavailable);
    try { expect(() => clearRsvpNoteDraft("synthetic-1")).not.toThrow(); }
    finally { remove.mockRestore(); }
  });
});

describe("nonblocking sheet saves", () => {
  it("keeps the second table move visible before and after the first save response", async () => {
    const writer = connection(), view = mount(writer);
    view.move("table-1", 1);
    view.move("table-2", 2);
    expect(view.x("table-2")).toBe(2);
    expect(view.result.current.editable).toBe(true);
    expect(writer.requests).toHaveLength(1);
    await writer.confirm(0);
    expect(view.x("table-2")).toBe(2);
    expect(writer.requests).toHaveLength(2);
    expect(view.result.current.pending).toBe(true);
    await writer.confirm(1);
    expect(writer.snapshot().layout.items.find(item => item.id === "table-2")!.x).toBe(2);
    expect(view.result.current.pending).toBe(false);
    expect(localStorage.getItem(queueKey)).toBeNull();
  });

  it("keeps the newest position when the same table is moved repeatedly", async () => {
    const writer = connection(), view = mount(writer);
    view.move("table-1", 1);
    view.move("table-1", 2);
    await writer.confirm(0);
    expect(view.x("table-1")).toBe(2);
    const change = writer.requests[1].operation.changes[0];
    expect(change.before).toMatchObject({ x: 1 });
    expect(change.after).toMatchObject({ x: 2 });
    await writer.confirm(1);
    expect(view.x("table-1")).toBe(2);
  });

  it("does not invalidate an active gesture when an acknowledgement changes no visible data", async () => {
    const writer = connection(), view = mount(writer);
    view.move("table-1", 1);
    const layout = view.result.current.layout, revision = view.result.current.revision;
    await writer.confirm(0);
    expect(view.result.current.layout).toBe(layout);
    expect(view.result.current.revision).toBe(revision);
  });

  it("allows guarded undo and redo while earlier changes are still saving", async () => {
    const writer = connection(), view = mount(writer);
    view.move("table-1", 1);
    expect(view.result.current.canUndo).toBe(true);
    act(() => view.result.current.undo());
    approve();
    expect(view.x("table-1")).toBe(0);
    expect(view.result.current.canRedo).toBe(true);
    act(() => view.result.current.redo());
    approve();
    expect(view.x("table-1")).toBe(1);
    await writer.confirm(0);
    await writer.confirm(1);
    await writer.confirm(2);
    expect(writer.snapshot().layout.items[0].x).toBe(1);
    expect(view.result.current.pending).toBe(false);
  });

  it("queues a seat swap followed by another move without losing either guest", async () => {
    const writer = connection(), view = mount(writer);
    act(() => view.result.current.commit("Swap", layout => moveGuests(layout, ["synthetic-1"], { tableId: "table-2", seatNumber: 1 })));
    approve();
    act(() => view.result.current.commit("Move again", layout => moveGuests(layout, ["synthetic-1"], { tableId: "table-3", seatNumber: 1 })));
    approve();
    await writer.confirm(0);
    expect(view.result.current.layout.guestList[0].tableId).toBe("table-3");
    await writer.confirm(1);
    expect(writer.snapshot().layout.guestList.map(guest => guest.tableId)).toEqual(["table-3", "table-1"]);
  });

  it("retains later edits during a network error and retries the identical operation", async () => {
    const writer = connection(), view = mount(writer);
    view.move("table-1", 1);
    await writer.reject(0, Error("Network interrupted"));
    view.move("table-2", 2);
    expect(view.x("table-2")).toBe(2);
    expect(view.result.current.editable).toBe(true);
    expect(writer.requests).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(queueKey)!).operations).toHaveLength(2);
    act(() => view.result.current.retry());
    approve();
    expect(writer.requests[1].operation).toEqual(writer.requests[0].operation);
    await writer.confirm(1);
    expect(view.x("table-2")).toBe(2);
    await writer.confirm(2);
    expect(view.result.current.pending).toBe(false);
  });

  it("preserves independent queued edits when the head and its dependent move conflict", async () => {
    const writer = connection(), view = mount(writer);
    view.move("table-1", 1);
    view.move("table-1", 2);
    view.move("table-2", 2);
    writer.remote(layout => ({ ...layout, items: layout.items.map(item => item.id === "table-1" ? { ...item, x: 9 } : item) }));
    await writer.reject(0, new SheetSaveError("Table changed elsewhere", 409, writer.snapshot()));
    expect(view.x("table-1")).toBe(9);
    expect(view.x("table-2")).toBe(2);
    expect(writer.requests).toHaveLength(2);
    expect(writer.requests[1].operation.changes[0].id).toBe("table-2");
    expect(view.result.current.syncError).toContain("not saved");
    expect(view.result.current.canUndo).toBe(false);
    await writer.confirm(1);
    expect(view.x("table-2")).toBe(2);
    expect(view.result.current.pending).toBe(false);
    expect(view.result.current.syncError).toContain("not saved");
  });

  it("merges unrelated remote fields without overwriting pending table positions", async () => {
    const writer = connection(), view = mount(writer);
    view.move("table-1", 1);
    view.move("table-2", 2);
    writer.remote(layout => ({ ...layout, guestList: layout.guestList.map((guest, index) => index ? guest : { ...guest, name: "Renamed remotely" }) }));
    await writer.confirm(0);
    expect(view.result.current.layout.guestList[0].name).toBe("Renamed remotely");
    expect(view.x("table-2")).toBe(2);
    await writer.confirm(1);
    expect(writer.snapshot().layout.guestList[0].name).toBe("Renamed remotely");
  });

  it("drops only conflicting pending operations after a successful acknowledgement", async () => {
    const writer = connection(), view = mount(writer);
    view.move("table-1", 1);
    view.move("table-2", 2);
    view.move("table-3", 3);
    writer.remote(layout => ({ ...layout, items: layout.items.map(item => item.id === "table-2" ? { ...item, x: 9 } : item) }));
    await writer.confirm(0);
    expect(view.x("table-2")).toBe(9);
    expect(view.x("table-3")).toBe(3);
    expect(writer.requests[1].operation.changes[0].id).toBe("table-3");
    await writer.confirm(1);
    expect(view.result.current.pending).toBe(false);
  });

  it("recovers the whole queue after a lost acknowledgement using the original receipt ID", async () => {
    const writer = connection(), first = mount(writer);
    first.move("table-1", 1);
    first.move("table-2", 2);
    writer.apply(0); // Sheets committed, but this browser never received the response.
    const id = writer.requests[0].operation.id;
    first.unmount();
    const recovered = mount(writer);
    expect(writer.requests[1].operation.id).toBe(id);
    await writer.confirm(1);
    expect(recovered.x("table-2")).toBe(2);
    await writer.confirm(2);
    expect(recovered.result.current.pending).toBe(false);
    expect(writer.snapshot().layout.items.slice(0, 2).map(item => item.x)).toEqual([1, 2]);
    expect(localStorage.getItem(queueKey)).toBeNull();
  });

  it("ignores hydration while any queued write is still unconfirmed", async () => {
    const writer = connection(), view = mount(writer), stale = writer.snapshot();
    view.move("table-1", 1);
    view.move("table-2", 2);
    act(() => view.result.current.hydrate(stale.layout));
    expect(view.x("table-2")).toBe(2);
    await writer.confirm(0);
    act(() => view.result.current.hydrate(stale.layout));
    expect(view.x("table-2")).toBe(2);
    await writer.confirm(1);
  });
});

describe("RSVP detail autosave", () => {
  it("queues status and notes immediately while preserving a declined guest's exact seat", async () => {
    const writer = connection(), view = mount(writer);
    act(() => view.result.current.saveGuestRsvp("synthetic-1", { rsvp: "Declined", notes: "Called today" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(view.result.current.layout.guestList[0]).toMatchObject({
      rsvp: "Declined", notes: "Called today", tableId: "table-1", seatNumber: 1,
    });
    expect(writer.requests).toHaveLength(1);
    expect(writer.requests[0].operation.changes).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(queueKey)!).operations[0]).toEqual(writer.requests[0].operation);
    expect(view.result.current.canUndo).toBe(true);
    await writer.confirm(0);
    expect(writer.snapshot().layout.guestList[0]).toMatchObject({
      rsvp: "Declined", notes: "Called today", tableId: "table-1", seatNumber: 1,
    });
    expect(view.result.current.pending).toBe(false);
    expect(localStorage.getItem(queueKey)).toBeNull();
    act(() => view.result.current.undo());
    expect(screen.getByRole("dialog")).toHaveTextContent("Undo:");
    expect(writer.requests).toHaveLength(1);
    approve();
    await writer.confirm(1);
    expect(writer.snapshot().layout.guestList[0]).toMatchObject({ rsvp: "Pending", notes: "", seatNumber: 1 });
  });

  it("does not enqueue unchanged or empty patches", () => {
    const writer = connection(), view = mount(writer), before = view.result.current.layout;
    act(() => {
      view.result.current.saveGuestRsvp("synthetic-1", {});
      view.result.current.saveGuestRsvp("synthetic-1", { rsvp: "Pending", notes: "   " });
    });
    expect(view.result.current.layout).toBe(before);
    expect(writer.requests).toHaveLength(0);
    expect(view.result.current.canUndo).toBe(false);
    expect(localStorage.getItem(queueKey)).toBeNull();
  });

  it("patches the latest guest without reverting newer name, dietary or seat edits", async () => {
    const writer = connection(), view = mount(writer), save = view.result.current.saveGuestRsvp;
    act(() => {
      view.result.current.commit("Guest updated", layout => ({
        ...layout, guestList: layout.guestList.map(guest => guest.id === "synthetic-1"
          ? { ...guest, name: "Latest name", dietary: "Vegetarian", notes: "Existing note", tableId: "table-3", seatNumber: 4 }
          : guest),
      }));
    });
    approve();
    act(() => save("synthetic-1", { rsvp: "Confirmed" }));
    expect(view.result.current.layout.guestList[0]).toMatchObject({
      name: "Latest name", dietary: "Vegetarian", notes: "Existing note", tableId: "table-3", seatNumber: 4, rsvp: "Confirmed",
    });
    await writer.confirm(0);
    const change = writer.requests[1].operation.changes[0];
    expect(change.before).toMatchObject({ name: "Latest name", notes: "Existing note", seatNumber: 4, rsvp: "Pending" });
    expect(change.after).toMatchObject({ name: "Latest name", notes: "Existing note", seatNumber: 4, rsvp: "Confirmed" });
    await writer.confirm(1);
    expect(writer.snapshot().layout.guestList[0].name).toBe("Latest name");
  });

  it("retains newer notes and status while earlier note saves acknowledge", async () => {
    const writer = connection(), view = mount(writer);
    act(() => {
      view.result.current.saveGuestRsvp("synthetic-1", { notes: "First note" });
      view.result.current.saveGuestRsvp("synthetic-1", { notes: "Newest note" });
      view.result.current.saveGuestRsvp("synthetic-1", { rsvp: "Confirmed" });
    });
    expect(writer.requests).toHaveLength(1);
    writer.remote(layout => ({
      ...layout, guestList: layout.guestList.map(guest => guest.id === "synthetic-1" ? { ...guest, name: "Remote name" } : guest),
    }));
    await writer.confirm(0);
    expect(view.result.current.layout.guestList[0]).toMatchObject({ notes: "Newest note", rsvp: "Confirmed", name: "Remote name" });
    expect(writer.requests[1].operation.changes[0].before).toMatchObject({ notes: "First note" });
    await writer.confirm(1);
    expect(view.result.current.layout.guestList[0]).toMatchObject({ notes: "Newest note", rsvp: "Confirmed" });
    await writer.confirm(2);
    expect(writer.snapshot().layout.guestList[0]).toMatchObject({ notes: "Newest note", rsvp: "Confirmed", name: "Remote name" });
    expect(view.result.current.pending).toBe(false);
  });

  it("preserves independent status changes when a note conflicts", async () => {
    const writer = connection(), view = mount(writer);
    act(() => {
      view.result.current.saveGuestRsvp("synthetic-1", { notes: "First local note" });
      view.result.current.saveGuestRsvp("synthetic-1", { notes: "Later local note" });
      view.result.current.saveGuestRsvp("synthetic-1", { rsvp: "Confirmed" });
    });
    writer.remote(layout => ({
      ...layout, guestList: layout.guestList.map(guest => guest.id === "synthetic-1" ? { ...guest, notes: "Remote note" } : guest),
    }));
    await writer.reject(0, new SheetSaveError("Note changed elsewhere", 409, writer.snapshot()));
    expect(view.result.current.layout.guestList[0]).toMatchObject({ notes: "Remote note", rsvp: "Confirmed" });
    expect(view.result.current.syncError).toContain("not saved");
    expect(view.result.current.canUndo).toBe(false);
    expect(writer.requests).toHaveLength(2);
    await writer.confirm(1);
    expect(writer.snapshot().layout.guestList[0]).toMatchObject({ notes: "Remote note", rsvp: "Confirmed" });
  });

  it("recovers an autosaved note and later status after a lost acknowledgement", async () => {
    const writer = connection(), first = mount(writer);
    act(() => {
      first.result.current.saveGuestRsvp("synthetic-1", { notes: "Keep this note" });
      first.result.current.saveGuestRsvp("synthetic-1", { rsvp: "Confirmed" });
    });
    writer.apply(0);
    const operation = writer.requests[0].operation;
    first.unmount();
    const recovered = mount(writer);
    expect(writer.requests[1].operation).toEqual(operation);
    expect(() => recovered.result.current.saveGuestRsvp("synthetic-1", { notes: "Too early" })).toThrow(/previous session/);
    await writer.confirm(1);
    expect(recovered.result.current.layout.guestList[0]).toMatchObject({ notes: "Keep this note", rsvp: "Confirmed" });
    await writer.confirm(2);
    expect(recovered.result.current.pending).toBe(false);
    expect(writer.snapshot().layout.guestList[0]).toMatchObject({ notes: "Keep this note", rsvp: "Confirmed" });
    expect(localStorage.getItem(queueKey)).toBeNull();
  });

  it("throws synchronously while disconnected or reviewing an unrelated change", () => {
    const disconnected = renderHook(() => useStudio(), { wrapper: StudioProvider });
    expect(() => disconnected.result.current.saveGuestRsvp("synthetic-1", { notes: "Wait" })).toThrow(/sheet connection/);
    disconnected.unmount();
    const writer = connection(), view = mount(writer);
    act(() => view.result.current.commit("Move", layout => ({ ...layout, items: layout.items.map(item => item.id === "table-1" ? { ...item, x: 3 } : item) })));
    expect(() => view.result.current.saveGuestRsvp("synthetic-1", { notes: "Wait" })).toThrow(/review/);
    expect(writer.requests).toHaveLength(0);
    expect(view.result.current.layout.guestList[0].notes).toBe("");
    expect(localStorage.getItem(queueKey)).toBeNull();
  });

  it("rejects missing guests, invalid values and fields outside RSVP or notes", () => {
    const writer = connection(), view = mount(writer), before = view.result.current.layout;
    expect(() => view.result.current.saveGuestRsvp("missing-guest", { notes: "No guest" })).toThrow(/guest no longer exists/);
    for (const patch of [
      { tableId: "table-3" }, { rsvp: "Unexpected" }, { notes: "x".repeat(4001) },
      { notes: 123 }, { rsvp: undefined }, { notes: undefined }, null, [],
    ]) {
      expect(() => view.result.current.saveGuestRsvp("synthetic-1", patch as never)).toThrow();
    }
    expect(view.result.current.layout).toBe(before);
    expect(writer.requests).toHaveLength(0);
    expect(view.result.current.canUndo).toBe(false);
    expect(localStorage.getItem(queueKey)).toBeNull();
  });

  it("retains a rejected note draft after the RSVP editor closes", async () => {
    const writer = connection(), view = mount(writer), notes = "Call again tomorrow  ";
    act(() => {
      view.result.current.setModal({ type: "rsvp", id: "synthetic-1" });
      view.result.current.saveGuestRsvp("synthetic-1", { notes });
      view.result.current.setModal(null);
    });
    expect(localStorage.getItem(noteDraftKey("synthetic-1"))).toBe(notes);
    writer.remote(layout => ({
      ...layout, guestList: layout.guestList.map(guest => guest.id === "synthetic-1" ? { ...guest, notes: "Changed elsewhere" } : guest),
    }));
    await writer.reject(0, new SheetSaveError("Note changed elsewhere", 409, writer.snapshot()));
    expect(view.result.current.modal).toBeNull();
    expect(view.result.current.pending).toBe(false);
    expect(localStorage.getItem(queueKey)).toBeNull();
    expect(localStorage.getItem(noteDraftKey("synthetic-1"))).toBe(notes);
  });

  it("clears only the matching note draft after its successful acknowledgement", async () => {
    const writer = connection(), view = mount(writer);
    act(() => {
      view.result.current.saveGuestRsvp("synthetic-1", { notes: "  Saved first note  " });
      view.result.current.saveGuestRsvp("synthetic-2", { notes: "Second note" });
    });
    expect(localStorage.getItem(noteDraftKey("synthetic-1"))).toBe("  Saved first note  ");
    expect(localStorage.getItem(noteDraftKey("synthetic-2"))).toBe("Second note");
    await writer.confirm(0);
    expect(localStorage.getItem(noteDraftKey("synthetic-1"))).toBeNull();
    expect(localStorage.getItem(noteDraftKey("synthetic-2"))).toBe("Second note");
    await writer.confirm(1);
    expect(localStorage.getItem(noteDraftKey("synthetic-2"))).toBeNull();
  });

  it("preserves a newer unsent draft when an earlier note save acknowledges", async () => {
    const writer = connection(), view = mount(writer);
    act(() => view.result.current.saveGuestRsvp("synthetic-1", { notes: "Submitted note" }));
    // The popup records each keystroke before its debounce queues another save.
    localStorage.setItem(noteDraftKey("synthetic-1"), "Newer typing still in the editor ");
    await writer.confirm(0);
    expect(view.result.current.pending).toBe(false);
    expect(writer.snapshot().layout.guestList[0].notes).toBe("Submitted note");
    expect(localStorage.getItem(noteDraftKey("synthetic-1"))).toBe("Newer typing still in the editor ");
  });

  it("does not overwrite a recovered draft for unchanged notes or a status-only save", async () => {
    const writer = connection(), view = mount(writer), draft = "Recovered note needing review";
    localStorage.setItem(noteDraftKey("synthetic-1"), draft);
    act(() => {
      view.result.current.saveGuestRsvp("synthetic-1", {});
      view.result.current.saveGuestRsvp("synthetic-1", { notes: "   " });
      view.result.current.saveGuestRsvp("synthetic-1", { rsvp: "Confirmed", notes: "" });
    });
    expect(writer.requests).toHaveLength(1);
    expect(localStorage.getItem(noteDraftKey("synthetic-1"))).toBe(draft);
    await writer.confirm(0);
    expect(localStorage.getItem(noteDraftKey("synthetic-1"))).toBe(draft);
  });
});

describe("sheet action review", () => {
  const requestMove = (view: ReturnType<typeof mount>, id = "table-2", x = 2) => {
    act(() => view.result.current.commit("Object moved", layout => ({
      ...layout, items: layout.items.map(item => item.id === id ? { ...item, x } : item),
    })));
  };
  it("shows a compact action without changing the document, history or save journal", () => {
    const writer = connection(), view = mount(writer), before = view.result.current.layout;
    requestMove(view);
    expect(screen.getByRole("dialog", { name: "Move Table 2" }).textContent).toBe("Move Table 2CancelConfirm");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(view.result.current.layout).toBe(before);
    expect(view.result.current.canUndo).toBe(false);
    expect(writer.requests).toHaveLength(0);
    expect(localStorage.getItem(queueKey)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(view.result.current.layout).toBe(before);
    expect(writer.requests).toHaveLength(0);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("does not rerun the updater and defers post-confirm callbacks", () => {
    const writer = connection(), view = mount(writer);
    let updates = 0, completed = 0;
    act(() => view.result.current.commit("Move", layout => {
      updates++;
      return { ...layout, items: layout.items.map(item => item.id === "table-1" ? { ...item, x: 3 } : item) };
    }, () => { completed++; }));
    expect(updates).toBe(1);
    expect(completed).toBe(0);
    approve();
    expect(updates).toBe(1);
    expect(completed).toBe(1);
    expect(writer.requests).toHaveLength(1);
  });
  it("Escape and Cancel dismiss the review without enqueuing a mutation", () => {
    const writer = connection(), view = mount(writer);
    requestMove(view);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true, bubbles: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    requestMove(view);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(view.x("table-2")).toBe(0);
    expect(writer.requests).toHaveLength(0);
  });
  it("preserves a review while the previous save finishes, then queues its exact change", async () => {
    const writer = connection(), view = mount(writer);
    view.move("table-1", 1);
    requestMove(view);
    await writer.confirm(0);
    expect(screen.getByRole("dialog", { name: "Move Table 2" })).toBeInTheDocument();
    expect(view.x("table-2")).toBe(0);
    approve();
    expect(view.x("table-2")).toBe(2);
    expect(writer.requests).toHaveLength(2);
    expect(view.result.current.editable).toBe(true);
    await writer.confirm(1);
  });
  it("keeps unrelated remote edits while confirming the reviewed mutation", () => {
    const writer = connection(), view = mount(writer);
    requestMove(view);
    const newer = clone(view.result.current.layout);
    newer.guestList[0].name = "Remote rename";
    act(() => view.result.current.hydrate(newer));
    approve();
    expect(view.result.current.layout.guestList[0].name).toBe("Remote rename");
    expect(view.x("table-2")).toBe(2);
    expect(writer.requests).toHaveLength(1);
    expect(writer.requests[0].operation.changes).toHaveLength(1);
  });
  it("rejects stale reviewed details instead of silently saving a different action", () => {
    const writer = connection(), view = mount(writer);
    requestMove(view);
    const newer = clone(view.result.current.layout);
    newer.items[1].x = 9;
    act(() => view.result.current.hydrate(newer));
    approve();
    expect(screen.getByRole("alert")).toHaveTextContent("Cancel and try again.");
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    expect(view.x("table-2")).toBe(9);
    expect(writer.requests).toHaveLength(0);
  });
  it("cancels a reviewed undo without changing existing history", async () => {
    const writer = connection(), view = mount(writer);
    view.move("table-1", 1);
    await writer.confirm(0);
    act(() => view.result.current.undo());
    expect(screen.getByRole("dialog")).toHaveTextContent("Undo:");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(view.x("table-1")).toBe(1);
    expect(view.result.current.canUndo).toBe(true);
    expect(view.result.current.canRedo).toBe(false);
    expect(writer.requests).toHaveLength(1);
  });
});
