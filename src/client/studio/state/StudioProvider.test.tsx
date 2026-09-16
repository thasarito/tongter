import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { applyMutation, type StudioMutation } from "@/shared/studio-mutations";
import type { StudioSheetSnapshot } from "@/shared/studio-sheet";
import { moveGuests } from "../model/commands";
import { defaultLayout } from "../model/defaults";
import { clone, normalizeLayout, type StudioLayout } from "../model/schema";
import { StudioProvider, useStudio } from "./StudioProvider";
import { SheetSaveError } from "./sheet-source";

const queueKey = "tongter:studio:pending-v2";
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
    },
    x(id: string) { return view.result.current.layout.items.find(item => item.id === id)!.x; },
  };
}
beforeEach(() => localStorage.clear());
afterEach(cleanup);

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
    expect(view.x("table-1")).toBe(0);
    expect(view.result.current.canRedo).toBe(true);
    act(() => view.result.current.redo());
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
    act(() => view.result.current.commit("Move again", layout => moveGuests(layout, ["synthetic-1"], { tableId: "table-3", seatNumber: 1 })));
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
