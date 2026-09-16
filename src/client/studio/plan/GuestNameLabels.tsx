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
  const endX=Math.max(label.x,Math.min(label.x+label.w,label.anchor[0])),endY=Math.max(label.y,Math.min(label.y+label.h,label.anchor[1]));
  const open=()=>onSelect?onSelect():setModal({type:"seat",target});
  return <g className="studio-name-badge" {...drop} data-guest-drag={label.guestId} role="button" tabIndex={0} aria-label={`Seat ${label.seatNumber}: ${label.name}. Drag to move, or activate to edit.`} onClick={open} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}}}>
    <title>{label.name} · Seat {label.seatNumber}</title><path d={`M${label.anchor.join(" ")}L${endX} ${endY}`} fill="none" stroke="#7e9875" strokeWidth={.018} pointerEvents="none"/>
    <rect x={label.x} y={label.y} width={label.w} height={label.h} rx={.07} fill="#fffef5" stroke="#9aac8b" strokeWidth={.022}/>
    <text fontSize={.185} fill="#35513c" fontFamily="Arial,sans-serif" fontWeight={500} pointerEvents="none">{label.lines.map((line,i)=><tspan key={i} x={label.x+.1} y={label.y+.24+i*.24}>{line}</tspan>)}</text>
  </g>;
}
