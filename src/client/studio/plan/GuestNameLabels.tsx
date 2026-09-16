import { useMemo } from "react";
import { labelLayout, type LabelBox } from "../model/labels";
import type { StudioLayout } from "../model/schema";
import { useStudio } from "../state/StudioProvider";
import { useDropTarget } from "../interaction/GuestDragProvider";
export function usePlanLabels(layout:StudioLayout,enabled:boolean) {
  return useMemo(()=>{
    if(!enabled)return [];
    const ctx=document.createElement("canvas").getContext("2d");
    if(ctx)ctx.font="500 32px Arial, sans-serif";
    return labelLayout(layout,s=>ctx?ctx.measureText(s).width/32*.185:Array.from(s).length*.12);
  },[layout,enabled]);
}
export function GuestNameBadge({label,onSelect}:{label:LabelBox;onSelect?:()=>void}) {
  const {setModal}=useStudio(),target={tableId:label.tableId,seatNumber:label.seatNumber},drop=useDropTarget(target);
  const open=()=>onSelect?onSelect():setModal({type:"seat",target});
  return <g className="studio-name-badge" {...drop} data-guest-drag={label.guestId} data-anchor-x={label.anchor[0]} data-anchor-z={label.anchor[1]} role="button" tabIndex={0} aria-label={`Seat ${label.seatNumber}: ${label.name}. Drag to move, or activate to edit.`} onPointerDown={e=>e.stopPropagation()} onClick={open} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}}}>
    <title>{label.name}</title>
    <rect x={label.x} y={label.y} width={label.w} height={label.h} rx={.07} fill="#fffef5" stroke="#9aac8b" strokeWidth={.022}/>
    <text textAnchor="middle" fontSize={.185} fill="#35513c" fontFamily="Arial,sans-serif" fontWeight={500} pointerEvents="none">{label.lines.map((line,i)=><tspan key={i} x={label.anchor[0]} y={label.y+.24+i*.24}>{line}</tspan>)}</text>
  </g>;
}
