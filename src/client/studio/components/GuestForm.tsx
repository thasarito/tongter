import { useState, type FormEvent } from "react";
import { moveGuests, saveGuest } from "../model/commands";
import { makeId, occupant, type SeatTarget, type StudioGuest } from "../model/schema";
import { useStudio } from "../state/StudioProvider";
import { Modal } from "./Modal";
export function GuestForm({id,target}:{id?:string;target?:SeatTarget}) {
  const {layout,commit,setModal}=useStudio(),old=layout.guestList.find(g=>g.id===id);
  const [error,setError]=useState(""),[tableId,setTableId]=useState(old?.tableId??target?.tableId??""),[seat,setSeat]=useState(String(old?.seatNumber??target?.seatNumber??""));
  const tables=layout.items.filter(t=>t.kind==="table"),table=tables.find(t=>t.id===tableId);
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const data=new FormData(e.currentTarget),newId=id||makeId(),reserve=data.has("reserve");
    const patch={id:newId,name:String(data.get("name")??""),host:String(data.get("host")??""),group:String(data.get("group")??""),status:String(data.get("status")??""),rsvp:String(data.get("rsvp")) as StudioGuest["rsvp"],notes:String(data.get("notes")??""),dietary:String(data.get("dietary")??""),vip:data.has("vip"),important:data.has("important"),reserve,tableId:"",seatNumber:null};
    try{const next=saveGuest(layout,patch);const destination={tableId:reserve?"":tableId,seatNumber:seat?Number(seat):null};const taken=destination.tableId&&destination.seatNumber?occupant(layout,destination):null;if(taken&&taken.id!==id)throw Error("That seat is occupied. Use the seat editor to swap or replace its occupant.");const result=reserve?next:moveGuests(next,[newId],destination);commit(old?"Guest updated":"Guest added",()=>result,()=>setModal(target?{type:"seat",target}:null));}
    catch(cause){setError(cause instanceof Error?cause.message:"Unable to save guest.");}}
  return <Modal title={old?"Edit guest":"Add guest"} onClose={()=>setModal(target?{type:"seat",target}:null)}><form onSubmit={submit} className="studio-form">
    <label>Name<input name="name" required maxLength={160} defaultValue={old?.name}/></label>
    <div className="studio-form-grid"><label>Side / host<input name="host" maxLength={80} defaultValue={old?.host}/></label><label>Group<input name="group" maxLength={160} defaultValue={old?.group}/></label><label>Invitation status<input name="status" maxLength={100} defaultValue={old?.status}/></label><label>RSVP<select name="rsvp" defaultValue={old?.rsvp??"Pending"}>{["Pending","Confirmed","Maybe","Declined"].map(v=><option key={v}>{v}</option>)}</select></label></div>
    <div className="studio-row">{(["vip","important","reserve"] as const).map(k=><label key={k}><input type="checkbox" name={k} defaultChecked={old?.[k]}/>{k}</label>)}</div>
    <div className="studio-form-grid"><label>Table<select value={tableId} onChange={e=>{setTableId(e.target.value);setSeat("");}}><option value="">Unassigned</option>{tables.map(t=><option key={t.id} value={t.id}>Table {t.label}</option>)}</select></label><label>Seat<select value={seat} onChange={e=>setSeat(e.target.value)} disabled={!table}><option value="">First available</option>{table&&Array.from({length:table.seats},(_,i)=>i+1).map(n=>{const g=occupant(layout,{tableId:table.id,seatNumber:n});return <option key={n} value={n} disabled={!!g&&g.id!==id}>Seat {n}{g&&g.id!==id?" · occupied":""}</option>;})}</select></label></div>
    {old?.sourceTableId&&<p className="studio-note">Original: {old.sourceTableLabel||old.sourceTableId} · seat {old.sourceSeatNumber??"—"}. This reference is retained.</p>}
    <label>Dietary<input name="dietary" maxLength={500} defaultValue={old?.dietary}/></label><label>Notes<textarea name="notes" rows={3} maxLength={4000} defaultValue={old?.notes}/></label>
    {error&&<p role="alert">{error}</p>}<footer>{old&&<button type="button" className="danger" onClick={()=>commit("Guest removed",s=>({...s,guestList:s.guestList.filter(g=>g.id!==old.id)}),()=>setModal(null))}>Remove guest</button>}<button className="primary" type="submit">Save guest</button></footer>
  </form></Modal>;
}
