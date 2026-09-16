import { useMemo } from "react";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { seats } from "../model/geometry";
import { occupant } from "../model/schema";
import { useStudio } from "../state/StudioProvider";

/** Name-only badges stay on their exact chairs. Compact pixel sizing also covers
 * short landscape viewports. Full names remain in the seat editor and accessibility tree. */
export function SeatLabels(){
  const {layout,setModal,view}=useStudio(),compact=useThree(s=>s.size.width<=760||s.size.height<=500),walking=view==="inside";
  const entries=useMemo(()=>layout.items.filter(t=>t.kind==="table").flatMap(t=>seats(t).flatMap(p=>{
    const guest=occupant(layout,{tableId:t.id,seatNumber:p.number});
    return guest?[{key:`${t.id}:${p.number}`,table:t,seat:p.number,guest,position:[p.world[0],.75,p.world[1]] as [number,number,number]}]:[];
  })),[layout]);
  return <>{entries.map(entry=><Html key={entry.key} center position={entry.position} distanceFactor={compact?undefined:16} zIndexRange={[20,10]} style={{pointerEvents:"none"}}>
    <button type="button" className="studio-seat-name-label" data-walking={walking} data-compact={compact} data-guest-drag={walking?undefined:entry.guest.id} data-seat-table={entry.table.id} data-seat-number={entry.seat} tabIndex={walking?-1:0} aria-label={`${entry.guest.name}, Table ${entry.table.label}, seat ${entry.seat}. Drag to move or click to edit.`} title={entry.guest.name} onClick={()=>{if(!walking)setModal({type:"seat",target:{tableId:entry.table.id,seatNumber:entry.seat}});}}><span className="studio-seat-label-text">{entry.guest.name}</span></button>
  </Html>)}</>;
}
