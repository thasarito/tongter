import { useMemo, useState } from "react";
import { moveGuests, replaceSeat } from "../model/commands";
import { diagramLabels } from "../model/labels";
import { seats } from "../model/geometry";
import { occupant, tableGuests, type SeatTarget } from "../model/schema";
import { useStudio } from "../state/StudioProvider";
import { GuestGrip, useDropTarget } from "../interaction/GuestDragProvider";
import { GuestNameBadge } from "../plan/GuestNameLabels";
import { PlanSeat } from "../plan/PlanFurniture";
import { exportSeatingHtml } from "../model/printing";
import { Modal } from "./Modal";

function SeatRow({target,selected,onSelect}:{target:SeatTarget;selected:boolean;onSelect:()=>void}){
  const {layout}=useStudio(),g=occupant(layout,target),drop=useDropTarget(target);
  return <div className={`studio-seat-row ${selected?"selected":""} ${g?"occupied":""}`} {...drop}>
    {g&&<GuestGrip id={g.id}/>}
    <button onClick={onSelect} aria-pressed={selected}><b>{target.seatNumber}</b><span>{g?.name??"Empty — assign guest"}<small>{g?[g.host,g.group].filter(Boolean).join(" · "):"No guest assigned"}</small></span></button>
  </div>;
}

export function SeatEditor({target}:{target:SeatTarget}) {
  const {layout,commit,setModal,options,undo,redo,canUndo,canRedo}=useStudio();
  const table=layout.items.find(t=>t.id===target.tableId&&t.kind==="table");
  const [number,setNumber]=useState(target.seatNumber??1),[candidate,setCandidate]=useState(""),[query,setQuery]=useState(""),[all,setAll]=useState(false),[autoNext,setAutoNext]=useState(true),[error,setError]=useState("");
  const effective=table?Math.max(1,Math.min(number,table.seats)):1,seatTarget={tableId:target.tableId,seatNumber:effective};
  const current=occupant(layout,seatTarget),chosen=layout.guestList.find(g=>g.id===candidate);
  const labels=useMemo(()=>{
    if(!table)return [];
    const ctx=document.createElement("canvas").getContext("2d");if(ctx)ctx.font="500 32px Arial,sans-serif";
    return diagramLabels(layout,table,s=>ctx?ctx.measureText(s).width/32*.185:Array.from(s).length*.11);
  },[layout,table]);
  if(!table)return <Modal title="Table unavailable" onClose={()=>setModal(null)}><p>This table was removed. Its guests are kept in the guest book.</p></Modal>;
  const positions=seats(table),half=Math.hypot(table.w,table.d)/2+.9;
  const minX=Math.min(-half,...labels.map(l=>l.x-.2)),maxX=Math.max(half,...labels.map(l=>l.x+l.w+.2));
  const minY=Math.min(-half,...labels.map(l=>l.y-.2)),maxY=Math.max(half,...labels.map(l=>l.y+l.h+.2));
  const select=(n:number)=>{setNumber(n);setCandidate("");setError("");};
  const candidates=layout.guestList.filter(g=>(all||(!g.tableId&&!g.reserve&&g.rsvp!=="Declined"))&&`${g.name} ${g.host} ${g.group}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  function apply(){
    if(!chosen||!table)return;
    try{
      const replace=!!current&&!chosen.tableId&&current.id!==chosen.id;
      if(replace&&!confirm(`${chosen.name} will take seat ${effective}; ${current.name} returns to Unassigned. Neither record is deleted. Continue?`))return;
      const next=replace?replaceSeat(layout,chosen.id,seatTarget):moveGuests(layout,[chosen.id],seatTarget);
      commit(current?"Seats updated; Undo is available":"Guest assigned",()=>next);setCandidate("");setError("");
      if(autoNext){const free=seats(table).filter(p=>!occupant(next,{tableId:table.id,seatNumber:p.number}));setNumber((free.find(p=>p.number>effective)||free[0])?.number??effective);}
    }catch(cause){setError(cause instanceof Error?cause.message:"Unable to assign guest.");}
  }
  return <Modal title={`Around Table ${table.label}`} wide onClose={()=>setModal(null)}>
    <div className="studio-row">
      <label>Table<select value={table.id} onChange={e=>setModal({type:"seat",target:{tableId:e.target.value,seatNumber:1}})}>{layout.items.filter(t=>t.kind==="table").map(t=><option key={t.id} value={t.id}>Table {t.label} · {tableGuests(layout,t.id).length}/{t.seats}</option>)}</select></label>
      <button disabled={!canUndo} onClick={undo}>↶ Undo</button><button disabled={!canRedo} onClick={redo}>↷ Redo</button><button onClick={()=>exportSeatingHtml(layout,table.id)}>Export this table</button>
    </div>
    <div className="studio-seat-editor"><section>
      <p className="studio-note">Green = assigned · cream = empty. Click a chair/name or drag between seats. Seat 1 starts on the table's local right; numbering rotates with it.</p>
      <svg className="studio-seat-diagram" viewBox={`${minX} ${minY} ${maxX-minX} ${maxY-minY}`} aria-label={`Table ${table.label} seat map`}>
        {options.guestNames&&labels.map(label=><GuestNameBadge key={label.key} label={label} onSelect={()=>select(label.seatNumber)}/>)}
        <g transform={`rotate(${table.rotation})`}>
          {table.shape==="rect"?<rect x={-table.w/2} y={-table.d/2} width={table.w} height={table.d} rx={.08} fill="#e5eadb" stroke="#aebca1" strokeWidth={.025}/>:<ellipse rx={table.w/2} ry={table.d/2} fill="#e5eadb" stroke="#aebca1" strokeWidth={.025}/>}
          {positions.map(p=><PlanSeat key={p.number} table={table} number={p.number} layout={layout} onSelect={()=>select(p.number)}/>)}
        </g>
        <text y={.1} textAnchor="middle" fontSize={.35} fill="#657b59">{table.label}</text>
      </svg>
      <h3>Who sits where</h3><div className="studio-seat-list">{positions.map(p=><SeatRow key={p.number} target={{tableId:table.id,seatNumber:p.number}} selected={p.number===effective} onSelect={()=>select(p.number)}/>)}</div>
    </section><section className="studio-seat-assignment">
      <h3>Seat {effective}</h3>
      <div className="studio-current-guest"><strong>{current?.name??"Ready for a guest"}</strong><small>{current?[current.host,current.group].filter(Boolean).join(" · "):"Empty seat"}</small>{current&&<div className="studio-row"><button onClick={()=>setModal({type:"guest",id:current.id,target:seatTarget})}>Edit guest</button><button onClick={()=>commit("Guest unassigned; record retained",s=>moveGuests(s,[current.id],{tableId:""}))}>Clear seat</button></div>}</div>
      <label><input type="checkbox" checked={autoNext} onChange={e=>setAutoNext(e.target.checked)}/> Go to next empty seat after assigning</label>
      <input type="search" aria-label="Search guests for seat" placeholder="Search a name, side or group" value={query} onChange={e=>setQuery(e.target.value)}/>
      <label><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/> Include seated guests for moving / swapping</label>
      <div className="studio-candidates">{candidates.slice(0,250).map(g=><div className={candidate===g.id?"selected":""} key={g.id}><GuestGrip id={g.id}/><button onClick={()=>{setCandidate(g.id);setError("");}} disabled={g.reserve||g.rsvp==="Declined"||g.id===current?.id}>{g.name}<small>{g.tableId?`${layout.items.find(t=>t.id===g.tableId)?.label} · seat ${g.seatNumber}`:"Unassigned"} · {g.group}</small></button></div>)}{candidates.length>250&&<p>Showing 250 matches. Refine the search.</p>}</div>
      {chosen&&<p>{chosen.name} → seat {effective}{current?chosen.tableId?" · swap with current occupant":" · replacement needs confirmation":""}</p>}{error&&<p role="alert">{error}</p>}
      <button className="primary" disabled={!chosen||chosen.reserve||chosen.rsvp==="Declined"||chosen.id===current?.id} onClick={apply}>{current?(chosen?.tableId?"Swap seats":"Replace occupant…"):`Assign to seat ${effective}`}</button>
      <button disabled={!!current} onClick={()=>setModal({type:"guest",target:seatTarget})}>+ Add a new guest here</button>
    </section></div>
  </Modal>;
}
