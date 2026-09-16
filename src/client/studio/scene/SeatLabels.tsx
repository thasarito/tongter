import { useMemo } from "react";
import { Html } from "@react-three/drei";
import { seats } from "../model/geometry";
import { occupant } from "../model/schema";
import { useStudio } from "../state/StudioProvider";

/** Camera-facing name badges anchored immediately above each occupied chair.
 * drei owns projection and lifecycle; there is no displaced screen-space packing,
 * seat-number prefix, leader line, or hidden overflow list. */
export function SeatLabels(){
  const {layout,setModal}=useStudio();
  const entries=useMemo(()=>layout.items.filter(t=>t.kind==="table").flatMap(t=>seats(t).flatMap(p=>{
    const guest=occupant(layout,{tableId:t.id,seatNumber:p.number});
    return guest?[{key:`${t.id}:${p.number}`,table:t,seat:p.number,guest,position:[p.world[0],.75,p.world[1]] as [number,number,number]}]:[];
  })),[layout]);
  return <>{entries.map(entry=><Html key={entry.key} center position={entry.position} distanceFactor={16} zIndexRange={[20,10]}>
    <button type="button" className="studio-seat-name-label" data-guest-drag={entry.guest.id} data-seat-table={entry.table.id} data-seat-number={entry.seat} aria-label={`${entry.guest.name}, Table ${entry.table.label}, seat ${entry.seat}. Drag to move or click to edit.`} title={entry.guest.name} onClick={()=>setModal({type:"seat",target:{tableId:entry.table.id,seatNumber:entry.seat}})}>{entry.guest.name}</button>
  </Html>)}</>;
}
