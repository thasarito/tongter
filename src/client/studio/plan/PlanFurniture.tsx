import type { PointerEvent as ReactPointerEvent } from "react";
import { localPolygon, seats } from "../model/geometry";
import { occupant, tableGuests, type StudioItem, type StudioLayout } from "../model/schema";
import { useStudio } from "../state/StudioProvider";
import { useDropTarget } from "../interaction/GuestDragProvider";
const colors:Record<StudioItem["kind"],string>={table:"#fffdf5",stage:"#738c7c",aisle:"#ded0af",runner:"#ded0af",band:"#dce5d0",bar:"#95aa87",buffet:"#c3b58f",dance:"#d5bd92"};
export function PlanSeat({table,number,layout,onSelect}:{table:StudioItem;number:number;layout:StudioLayout;onSelect?:()=>void}){
  const {setModal}=useStudio(),seat=seats(table)[number-1],target={tableId:table.id,seatNumber:number},g=occupant(layout,target),drop=useDropTarget(target);
  const open=()=>onSelect?onSelect():setModal({type:"seat",target});
  return <g transform={`translate(${seat.local.join(" ")})`} {...drop} data-guest-drag={g?.id} className="studio-seat" role="button" tabIndex={0} aria-label={`Table ${table.label}, seat ${number}: ${g?.name??"Empty"}`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();open();}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();open();}}}>
    <title>{g?.name??"Empty seat"} · Table {table.label} · Seat {number}</title>
    <rect x={-.2} y={-.18} width={.4} height={.36} rx={.07} transform={`rotate(${seat.angle*180/Math.PI-90})`} fill={g?"#446f56":"#fffaf0"} stroke="#95a782" strokeWidth={.025}/>
    <text transform={`rotate(${-table.rotation})`} y={.06} textAnchor="middle" fontSize={.16} fontWeight={600} fill={g?"white":"#657a57"} pointerEvents="none">{number}</text>
  </g>;
}
export function PlanFurniture({item,layout,onMove}:{item:StudioItem;layout:StudioLayout;onMove:(event:ReactPointerEvent<SVGElement>,item:StudioItem)=>void}) {
  const {options,selected,setSelected}=useStudio(),drop=useDropTarget({tableId:item.id});
  return <g transform={`translate(${item.x} ${item.z}) rotate(${item.rotation})`} className={`studio-plan-item ${selected===item.id?"selected":""}`}>
    {item.kind==="table"&&options.chairs&&seats(item).map(s=><PlanSeat key={s.number} table={item} number={s.number} layout={layout}/>)}
    <polygon points={localPolygon(item).map(p=>p.join(",")).join(" ")} fill={colors[item.kind]} stroke={selected===item.id?"#a47b37":"#a6b496"} strokeWidth={selected===item.id ? .07 : .025} {...(item.kind==="table"?drop:{})} data-furniture={item.id} onPointerDown={e=>onMove(e,item)} onClick={()=>setSelected(item.id)} tabIndex={0} role="button" aria-label={`Select ${item.kind} ${item.label}`} onKeyDown={e=>{if(e.key==="Enter")setSelected(item.id);}}/>
    {options.tableLabels&&<g transform={`rotate(${-item.rotation})`} pointerEvents="none"><text textAnchor="middle" y={.04} fontSize={item.kind==="table" ? .34 : .27} fill={item.kind==="stage"?"white":"#536f4d"}>{item.label}</text>{item.kind==="table"&&<text textAnchor="middle" y={.31} fontSize={.1} fill="#8c967d">{tableGuests(layout,item.id).length} / {item.seats} SEATED</text>}</g>}
  </g>;
}
