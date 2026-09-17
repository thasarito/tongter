import { useEffect, useRef } from "react";
import { compactSheetAction } from "../model/compact-sheet-action";
import type { SheetConfirmation } from "../state/sheet-confirmation";
import "../styles/sheet-confirmation.css";

export function SheetActionDialog({ review, onConfirm, onCancel }: {
  review: SheetConfirmation;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null);
  const { summary, error, id } = review;
  useEffect(() => {
    const node = dialog.current, opener = document.activeElement;
    if (!node) return;
    if (document.pointerLockElement) void document.exitPointerLock();
    node.showModal();
    cancel.current?.focus({ preventScroll: true });
    // Keep parent forms mounted and preserve native modal focus containment.
    return () => {
      if (node.open) node.close();
      queueMicrotask(() => {
        if (opener instanceof HTMLElement && opener.isConnected && !node.open) opener.focus({ preventScroll: true });
      });
    };
  }, []);
  return <dialog ref={dialog} className={`studio-modal studio-sheet-confirm ${summary.tone}`}
    aria-labelledby={`sheet-review-title-${id}`} aria-describedby={error ? `sheet-review-error-${id}` : undefined}
    data-sheet-confirmation
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onCancel(id); }}
    onKeyDown={event => { if (event.key === "Escape") event.stopPropagation(); }}>
    <div className="studio-sheet-confirm-body">
      <h2 id={`sheet-review-title-${id}`}>{compactSheetAction(summary)}</h2>
      {error && <p id={`sheet-review-error-${id}`} role="alert">{error} Cancel and try again.</p>}
    </div>
    <footer className="studio-sheet-confirm-footer">
      <button ref={cancel} type="button" onClick={() => onCancel(id)}>Cancel</button>
      <button type="button" className={summary.tone === "danger" ? "danger" : "primary"} disabled={!!error} onClick={() => onConfirm(id)}>Confirm</button>
    </footer>
  </dialog>;
}
