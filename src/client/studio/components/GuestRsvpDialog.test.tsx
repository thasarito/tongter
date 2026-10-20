import { useEffect } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyMutation, type StudioMutation } from "@/shared/studio-mutations";
import type { StudioSheetSnapshot } from "@/shared/studio-sheet";
import { normalizeLayout, type StudioLayout } from "../model/schema";
import { StudioProvider, useStudio } from "../state/StudioProvider";
import { SheetSaveError } from "../state/sheet-source";
import { GuestRsvpDialog } from "./GuestRsvpDialog";

const fixture = () => normalizeLayout({
  version: 3, title: "RSVP test", units: "metres",
  items: [{ id: "table-1", kind: "table", shape: "oval", label: "5", x: 0, z: 0, w: 2, d: 1.2, h: .76, rotation: 0, seats: 10 }],
  guestList: [
    { id: "alice", name: "Alice", tableId: "table-1", seatNumber: 1 },
    { id: "bob", name: "Bob", tableId: "table-1", seatNumber: 2, rsvp: "Confirmed" },
  ],
});

function mount() {
  let sheet = fixture();
  const writes: { operation: StudioMutation; resolve: (value: StudioSheetSnapshot) => void; reject: (cause: Error) => void }[] = [];
  const save = (operation: StudioMutation) => new Promise<StudioSheetSnapshot>((resolve, reject) => writes.push({ operation, resolve, reject }));
  function Workspace() {
    const { hydrate, connect, modal, setModal, layout } = useStudio();
    useEffect(() => { hydrate(sheet); connect(save); setModal({ type: "rsvp", id: "alice" }); }, [hydrate, connect, setModal]);
    return <>
      <button onClick={() => setModal({ type: "rsvp", id: "alice" })}>Open RSVP</button>
      <output aria-label="Saved guest status">{layout.guestList.find(guest => guest.id === "alice")?.rsvp}</output>
      {modal?.type === "rsvp" && <GuestRsvpDialog id={modal.id} target={modal.target}/>}
    </>;
  }
  const view = render(<StudioProvider><Workspace/></StudioProvider>);
  return {
    writes, unmount: view.unmount,
    read: () => sheet,
    async acknowledge(index: number, remote?: (value: StudioLayout) => StudioLayout) {
      await act(async () => {
        if (remote) sheet = remote(sheet);
        sheet = applyMutation(sheet, writes[index].operation);
        writes[index].resolve({ status: "ok", source: "Google Sheets", layout: sheet, revision: String(index + 1), fetchedAt: 1 });
      });
    },
    async conflict(index: number) {
      await act(async () => {
        sheet = normalizeLayout({ ...sheet, guestList: sheet.guestList.map(guest => guest.id === "alice" ? { ...guest, notes: "Other organizer's note" } : guest) });
        writes[index].reject(new SheetSaveError("Another organizer changed the note.", 409, { status: "ok", source: "Google Sheets", layout: sheet, revision: "remote", fetchedAt: 1 }));
      });
    },
  };
}

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("guest RSVP popup", () => {
  it("confirms in one click, updates the table count, and retains declined seats", async () => {
    const sheet = mount();
    expect(screen.getByText("Confirmed 1/10")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "คอนเฟิร์มว่ามา" }));
    expect(screen.getByLabelText("Saved guest status")).toHaveTextContent("Confirmed");
    expect(screen.getByText("Confirmed 2/10")).toBeVisible();
    expect(document.querySelector("[data-sheet-confirmation]")).toBeNull();
    await sheet.acknowledge(0);
    fireEvent.click(screen.getByRole("button", { name: "คอนเฟิร์มว่าไม่มา" }));
    expect(screen.getByText("Confirmed 1/10")).toBeVisible();
    await sheet.acknowledge(1);
    expect(sheet.read().guestList[0]).toMatchObject({ rsvp: "Declined", tableId: "table-1", seatNumber: 1 });
    fireEvent.click(screen.getByRole("button", { name: "ติดต่อแล้ว รอคำตอบ" }));
    await sheet.acknowledge(2);
    expect(sheet.read().guestList[0].rsvp).toBe("Maybe");
    fireEvent.click(screen.getByRole("button", { name: "ยังไม่ได้ติดต่อ" }));
    await sheet.acknowledge(3);
    expect(sheet.read().guestList[0].rsvp).toBe("Pending");
  });

  it("keeps a newer note draft when a previous save acknowledges and flushes it on close", async () => {
    const sheet = mount(), note = screen.getByRole("textbox", { name: "หมายเหตุ" });
    fireEvent.change(note, { target: { value: "มากับแฟน " } });
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(sheet.writes).toHaveLength(1);
    fireEvent.change(note, { target: { value: "มากับแฟน และลูก" } });
    await sheet.acknowledge(0);
    expect(note).toHaveValue("มากับแฟน และลูก");
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(sheet.writes).toHaveLength(2);
    await sheet.acknowledge(1);
    expect(sheet.read().guestList[0].notes).toBe("มากับแฟน และลูก");
  });

  it("flushes the last keystrokes on Escape without requiring a Save button", async () => {
    const sheet = mount();
    fireEvent.change(screen.getByRole("textbox", { name: "หมายเหตุ" }), { target: { value: "รอคอนเฟิร์มอีกที" } });
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true, bubbles: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(sheet.writes).toHaveLength(1);
    await sheet.acknowledge(0);
    expect(sheet.read().guestList[0].notes).toBe("รอคอนเฟิร์มอีกที");
  });

  it("shows a failed save as pending and retains the recoverable note", async () => {
    const sheet = mount();
    fireEvent.change(screen.getByRole("textbox", { name: "หมายเหตุ" }), { target: { value: "สำคัญ: มากับแฟน" } });
    fireEvent.blur(screen.getByRole("textbox", { name: "หมายเหตุ" }));
    await act(async () => { sheet.writes[0].reject(new Error("Network unavailable")); });
    expect(screen.getByRole("alert")).toHaveTextContent("Network unavailable");
    expect(screen.getByRole("textbox", { name: "หมายเหตุ" })).toHaveValue("สำคัญ: มากับแฟน");
    expect(localStorage.getItem("tongter:studio:pending-v2")).toContain("สำคัญ: มากับแฟน");
  });

  it("keeps a conflicted note visible and lets an explicit retry save it against the current sheet", async () => {
    const sheet = mount(), note = screen.getByRole("textbox", { name: "หมายเหตุ" });
    fireEvent.change(note, { target: { value: "My note" } });
    fireEvent.blur(note);
    await sheet.conflict(0);
    expect(note).toHaveValue("My note");
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(sheet.writes).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "ลองบันทึกอีกครั้ง" }));
    expect(sheet.writes).toHaveLength(2);
    await sheet.acknowledge(1);
    expect(sheet.read().guestList[0].notes).toBe("My note");
  });

  it("journals the final note when navigation unmounts the entire studio before debounce", () => {
    const sheet = mount();
    fireEvent.change(screen.getByRole("textbox", { name: "หมายเหตุ" }), { target: { value: "Last words before Back" } });
    sheet.unmount();
    expect(localStorage.getItem("tongter:studio:pending-v2")).toContain("Last words before Back");
  });

  it("recovers a note rejected after the popup closed and can explicitly keep the sheet version", async () => {
    const sheet = mount();
    fireEvent.change(screen.getByRole("textbox", { name: "หมายเหตุ" }), { target: { value: "Note before closing" } });
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    await sheet.conflict(0);
    fireEvent.click(screen.getByRole("button", { name: "Open RSVP" }));
    expect(screen.getByRole("textbox", { name: "หมายเหตุ" })).toHaveValue("Note before closing");
    expect(sheet.writes).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "ใช้หมายเหตุล่าสุด" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(sheet.read().guestList[0].notes).toBe("Other organizer's note");
    fireEvent.click(screen.getByRole("button", { name: "Open RSVP" }));
    expect(screen.getByRole("textbox", { name: "หมายเหตุ" })).toHaveValue("Other organizer's note");
  });

  it("offers recovery when an in-flight note is rejected after reopening", async () => {
    const sheet = mount();
    fireEvent.change(screen.getByRole("textbox", { name: "หมายเหตุ" }), { target: { value: "Still saving" } });
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    fireEvent.click(screen.getByRole("button", { name: "Open RSVP" }));
    await sheet.conflict(0);
    expect(screen.getByRole("textbox", { name: "หมายเหตุ" })).toHaveValue("Still saving");
    expect(screen.getByRole("button", { name: "ใช้หมายเหตุล่าสุด" })).toBeVisible();
  });

  it("does not automatically overwrite a conflicted note while an independent status is saving", async () => {
    const sheet = mount(), note = screen.getByRole("textbox", { name: "หมายเหตุ" });
    fireEvent.change(note, { target: { value: "My note" } }); fireEvent.blur(note);
    fireEvent.click(screen.getByRole("button", { name: "คอนเฟิร์มว่ามา" }));
    await sheet.conflict(0);
    expect(sheet.writes).toHaveLength(2);
    fireEvent.change(note, { target: { value: "My note with more details" } });
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(JSON.parse(localStorage.getItem("tongter:studio:pending-v2")!).operations).toHaveLength(1);
    await sheet.acknowledge(1);
    expect(sheet.read().guestList[0]).toMatchObject({ rsvp: "Confirmed", notes: "Other organizer's note" });
    expect(screen.getByRole("button", { name: "ใช้หมายเหตุล่าสุด" })).toBeVisible();
  });
});
