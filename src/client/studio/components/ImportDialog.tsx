import { useMemo, useState } from "react";
import { applyGuestImport, type GuestImport, type ImportMode } from "../model/exchange";
import { useStudio } from "../state/StudioProvider";
import { Modal } from "./Modal";
export function ImportDialog({data}:{data:GuestImport}){
  const {layout,commit,setModal,editable}=useStudio(),[mode,setMode]=useState<ImportMode>("merge");
  const preview=useMemo(()=>{try{return {result:applyGuestImport(layout,data,mode),error:""};}catch(e){return {result:null,error:e instanceof Error?e.message:"Invalid import"};}},[layout,data,mode]);
  const added=data.rows.filter(row=>!layout.guestList.some(g=>g.id===row.id)).length;
  return <Modal title="Review guest CSV import" onClose={()=>setModal(null)}>
    <p>{data.label} · {data.rows.length} rows</p><label>Import mode<select value={mode} onChange={e=>setMode(e.target.value as ImportMode)}><option value="merge">Merge by ID; keep other guests</option><option value="replace">Replace roster; keep furniture</option></select></label>
    <p className="studio-note">{added} new IDs · {data.rows.length-added} existing IDs. Missing placement columns preserve seats during merge. Original references are not current assignments.</p>
    {preview.error?<p role="alert">{preview.error}</p>:<p>{preview.result?.layout.guestList.length} guests after import. Continue to review the exact changes before saving to StudioGuests.</p>}
    {preview.result?.warnings.slice(0,20).map((warning,i)=><p className="studio-note" key={i}>{warning}</p>)}
    <div className="studio-import-preview">{data.rows.slice(0,12).map((r,i)=><p key={i}>{String(r.name??r.id)} <small>{String(r.host??"")} · {String(r.group??"")}</small></p>)}</div>
    <footer><button onClick={()=>setModal(null)}>Cancel</button><button className="primary" disabled={!preview.result||!editable} onClick={()=>commit(mode==="replace"?"Replace guest roster from CSV":"Merge guest changes from CSV",current=>applyGuestImport(current,data,mode).layout,()=>setModal(null))}>Review sheet changes</button></footer>
  </Modal>;
}
