import { useEffect, useRef, type ReactNode } from "react";
export function Modal({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current;if(dialog&&!dialog.open)dialog.showModal();return()=>{if(dialog?.open)dialog.close();};},[]);
  return <dialog ref={ref} className={`studio-modal ${wide?"wide":""}`} onCancel={e=>{e.preventDefault();onClose();}} aria-label={title}>
    <header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Close dialog">×</button></header>
    <div className="studio-modal-body">{children}</div>
  </dialog>;
}
