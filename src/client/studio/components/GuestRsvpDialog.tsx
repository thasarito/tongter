import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { rsvpOptions } from "../model/rsvp";
import type { SeatTarget, StudioGuest } from "../model/schema";
import { useStudio, type StudioModal } from "../state/StudioProvider";
import { clearRsvpNoteDraft, readRsvpNoteDraft, storeRsvpNoteDraft } from "../state/rsvp-note-draft";
import { Modal } from "./Modal";
import { TableConfirmation } from "./TableConfirmation";

export function GuestRsvpDialog({ id, target }: { id: string; target?: SeatTarget }) {
  const { layout, setModal, saveGuestRsvp, editable, pending, syncError, busy, retry } = useStudio();
  const guest = layout.guestList.find(value => value.id === id);
  const table = layout.items.find(item => item.id === guest?.tableId && item.kind === "table");
  const [restoredDraft] = useState(() => readRsvpNoteDraft(id));
  const [notes, setNotes] = useState(restoredDraft ?? guest?.notes ?? "");
  const [recovery, setRecovery] = useState(restoredDraft !== null && restoredDraft.trim() !== (guest?.notes ?? ""));
  const [dirty, setDirty] = useState(false), [error, setError] = useState("");
  const draft = useRef(notes), unsaved = useRef(false), focused = useRef(false);
  const submittedNote = useRef<string | null>(restoredDraft?.trim() ?? null), needsReview = useRef(false);
  const conflicted = notes.trim() !== (guest?.notes ?? "") && (recovery || !!syncError && submittedNote.current !== null && submittedNote.current !== guest?.notes);
  needsReview.current = conflicted;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const save = useCallback((rsvp?: StudioGuest["rsvp"], acceptConflict = false) => {
    clearTimer();
    if (needsReview.current && !acceptConflict) {
      setError("หมายเหตุนี้ยังไม่ได้บันทึก เลือกลองบันทึกอีกครั้ง หรือใช้หมายเหตุล่าสุดก่อนปิด");
      return false;
    }
    const includeNote = unsaved.current || needsReview.current;
    if (!includeNote && rsvp === undefined) return true;
    try {
      saveGuestRsvp(id, { ...(rsvp === undefined ? {} : { rsvp }), ...(includeNote ? { notes: draft.current } : {}) });
      if (includeNote) submittedNote.current = draft.current.trim();
      unsaved.current = false;
      setDirty(false); setRecovery(false); setError("");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "บันทึกไม่ได้ กรุณาลองอีกครั้ง");
      return false;
    }
  }, [clearTimer, id, saveGuestRsvp]);

  // Acknowledgements must not replace text entered since the submitted note.
  useEffect(() => {
    if (!pending && !syncError && guest?.notes === submittedNote.current) submittedNote.current = null;
    if (!unsaved.current && !focused.current && !syncError && !recovery) {
      draft.current = guest?.notes ?? "";
      setNotes(draft.current);
    }
  }, [guest?.notes, pending, syncError, recovery]);

  // Flush before the provider's passive unmount cleanup. Client-side Back does
  // not emit blur/pagehide; the per-guest draft also survives a rejected write.
  useLayoutEffect(() => () => {
    if (unsaved.current && !needsReview.current) save();
  }, [save]);

  useEffect(() => {
    const leaving = (event: BeforeUnloadEvent) => {
      if (!unsaved.current) return;
      save();
      event.preventDefault(); event.returnValue = "";
    };
    const hide = () => { save(); };
    window.addEventListener("beforeunload", leaving);
    window.addEventListener("pagehide", hide);
    return () => {
      clearTimer();
      window.removeEventListener("beforeunload", leaving);
      window.removeEventListener("pagehide", hide);
    };
  }, [clearTimer, save]);

  const leave = (next: StudioModal = target ? { type: "seat", target } : null) => {
    if (save()) setModal(next);
  };
  const changeNotes = (value: string) => {
    draft.current = value; setNotes(value);
    storeRsvpNoteDraft(id, value);
    unsaved.current = value.trim() !== (guest?.notes ?? "");
    setDirty(unsaved.current); setError(""); clearTimer();
    if (unsaved.current) timer.current = setTimeout(() => save(), 500);
  };

  if (!guest) return <Modal title="Guest unavailable" onClose={() => setModal(null)}><p>ไม่พบแขกคนนี้ในรายชื่อแล้ว</p></Modal>;
  const problem = error || syncError || (conflicted ? "พบหมายเหตุที่ยังไม่ได้บันทึก ตรวจสอบก่อนบันทึกอีกครั้ง" : "");
  const statusText = problem ? "ยังบันทึกไม่สำเร็จ" : dirty ? "กำลังรอให้พิมพ์เสร็จ…" : pending ? "กำลังบันทึก…" : "บันทึกอัตโนมัติ";

  return <Modal title={`RSVP · ${guest.name}`} className="studio-rsvp-modal" onClose={() => leave()}>
    <div className="studio-rsvp-context">
      <span>{table ? `Table ${table.label} · Seat ${guest.seatNumber}` : "ยังไม่ได้จัดโต๊ะ"}</span>
      {table && <TableConfirmation tableId={table.id}/>}
    </div>
    <fieldset className="studio-rsvp-options" disabled={!editable}>
      <legend>สถานะการมาร่วมงาน</legend>
      {rsvpOptions.map(option => <button key={option.value} type="button" data-rsvp={option.value}
        aria-label={option.label} aria-pressed={guest.rsvp === option.value} onClick={() => save(option.value)}>
        <span className="studio-rsvp-dot" aria-hidden="true"/>
        <span>{option.label}</span>
        <span className="studio-rsvp-check" aria-hidden="true">{guest.rsvp === option.value ? "✓" : ""}</span>
      </button>)}
    </fieldset>
    <label className="studio-rsvp-note" htmlFor="studio-rsvp-note">หมายเหตุ</label>
    <textarea id="studio-rsvp-note" rows={3} maxLength={4000} value={notes} disabled={!editable}
      placeholder="เช่น มากับแฟน / รอคอนเฟิร์มอีกที" onChange={event => changeNotes(event.target.value)}
      onFocus={() => { focused.current = true; }} onBlur={() => { focused.current = false; save(); }}/>
    <div className="studio-rsvp-save" role="status" aria-live="polite" data-error={!!problem}>
      <span aria-hidden="true">{problem ? "!" : dirty || pending ? "◌" : "✓"}</span>{statusText}
    </div>
    {problem && <div className="studio-rsvp-error"><p role="alert">{problem}</p>
      {conflicted && <p className="studio-rsvp-latest">หมายเหตุล่าสุด: {guest.notes || "—"}</p>}
      {(dirty || pending || conflicted) && <button type="button" disabled={busy} onClick={() => { if (unsaved.current || needsReview.current) save(undefined, true); else retry(); }}>ลองบันทึกอีกครั้ง</button>}
      {conflicted && <button type="button" onClick={() => {
        clearRsvpNoteDraft(id); unsaved.current = false; needsReview.current = false;
        setModal(target ? { type: "seat", target } : null);
      }}>ใช้หมายเหตุล่าสุด</button>}
    </div>}
    <footer>
      <button type="button" onClick={() => leave({ type: "guest", id, target })}>รายละเอียดแขก</button>
      {table && <button type="button" onClick={() => leave({ type: "seat", target: { tableId: table.id, seatNumber: guest.seatNumber } })}>จัดที่นั่ง</button>}
    </footer>
  </Modal>;
}
