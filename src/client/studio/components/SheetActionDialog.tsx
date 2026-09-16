import { useEffect, useRef, useState } from "react";
import type { SheetConfirmation } from "../state/sheet-confirmation";
import "../styles/sheet-confirmation.css";

const PAGE_SIZE = 12;
export function SheetActionDialog({ review, onConfirm, onCancel }: {
  review: SheetConfirmation;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null);
  const [page, setPage] = useState(0);
  const { summary, error, id } = review;
  const pages = Math.max(1, Math.ceil(summary.rows.length / PAGE_SIZE));
  const visible = summary.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  useEffect(() => {
    const node = dialog.current, opener = document.activeElement;
    if (!node) return;
    if(document.pointerLockElement)void document.exitPointerLock();
    node.showModal();
    cancel.current?.focus({ preventScroll: true });
    // Native dialog handles the top layer and focus containment, including when
    // this review sits above a guest/seat editor. Do not unmount the parent form.
    return () => {
      if (node.open) node.close();
      queueMicrotask(() => {
        if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
      });
    };
  }, []);
  return <dialog ref={dialog} className={`studio-modal studio-sheet-confirm ${summary.tone}`}
    aria-labelledby={`sheet-review-title-${id}`} aria-describedby={`sheet-review-description-${id}`}
    data-sheet-confirmation
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onCancel(id); }}
    onKeyDown={event => { if (event.key === "Escape") event.stopPropagation(); }}>
    <header className="studio-sheet-confirm-header">
      <div><p className="studio-sheet-confirm-eyebrow">Google Sheets · {summary.tone === "read" ? "Read-only action" : "Review action"}</p>
        <h2 id={`sheet-review-title-${id}`}>{summary.title}</h2></div>
      <button type="button" aria-label="Close confirmation" onClick={() => onCancel(id)}>×</button>
    </header>
    <div className="studio-sheet-confirm-body">
      <p id={`sheet-review-description-${id}`}>{summary.description}</p>
      {!!summary.stats.length && <dl className="studio-sheet-confirm-stats">{summary.stats.map(stat =>
        <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>}
      {!!summary.warnings.length && <div className="studio-sheet-confirm-warning" role="note">{summary.warnings.map(warning => <p key={warning}>{warning}</p>)}</div>}
      {visible.map(row => <section className="studio-sheet-confirm-record" key={row.key}>
        <header><h3>{row.name}</h3><span className={`studio-sheet-confirm-badge ${row.action.toLowerCase()}`}>{row.action}</span></header>
        <dl>{row.details.map(detail => <div className="studio-sheet-confirm-field" key={detail.field}>
          <dt>{detail.field}</dt><dd><span className="studio-sheet-confirm-before"><small>Before</small>{detail.before}</span>
            <span className="studio-sheet-confirm-after"><small>After</small>{detail.after}</span></dd>
        </div>)}</dl>
      </section>)}
      {pages > 1 && <nav className="studio-sheet-confirm-pages" aria-label="Review all changes">
        <button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button>
        <span aria-live="polite">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, summary.rows.length)} of {summary.rows.length} changes</span>
        <button type="button" disabled={page + 1 === pages} onClick={() => setPage(value => value + 1)}>Next</button>
      </nav>}
      {error && <p className="studio-sheet-confirm-warning" role="alert">{error} Cancel and review the action again. Nothing from this action was queued.</p>}
      <p className="studio-sheet-confirm-note">{summary.footnote}</p>
    </div>
    <footer className="studio-sheet-confirm-footer">
      <button ref={cancel} type="button" onClick={() => onCancel(id)}>Cancel</button>
      <button type="button" className={summary.tone === "danger" ? "danger" : "primary"} disabled={!!error} onClick={() => onConfirm(id)}>{summary.confirmLabel}</button>
    </footer>
  </dialog>;
}
