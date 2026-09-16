import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { footprint, type Point } from "../model/geometry";
import { conflicts } from "../model/geometry";
import type { StudioItem } from "../model/schema";
import { useStudio } from "../state/StudioProvider";
import { useGuestDrag } from "../interaction/GuestDragProvider";
import { GuestNameBadge, usePlanLabels } from "./GuestNameLabels";
import { PlanFurniture } from "./PlanFurniture";
import { exportPlanPng, exportPlanSvg } from "../model/printing";
interface Gesture {pointer:number;start:Point;item?:StudioItem;origin:Point;camera:[number,number,number,number]}
export default function FloorPlan(){
  const {layout,options,commit,notify,setSelected}=useStudio(),drag=useGuestDrag(),svg=useRef<SVGSVGElement>(null),gesture=useRef<Gesture|null>(null);
  const [camera,setCamera]=useState<[number,number,number,number]>([-17,-11,34,22]),[preview,setPreview]=useState<{id:string;x:number;z:number}|null>(null);
  const displayed=useMemo(()=>preview?{...layout,items:layout.items.map(t=>t.id===preview.id?{...t,x:preview.x,z:preview.z}:t)}:layout,[layout,preview]);
  const labels=usePlanLabels(displayed,options.guestNames&&options.furniture&&options.chairs);
  const floor=useMemo(()=>footprint(),[]),warnings=useMemo(()=>conflicts(layout),[layout]);
  function point(clientX:number,clientY:number):Point{const matrix=svg.current?.getScreenCTM();if(!matrix)return [0,0];const p=new DOMPoint(clientX,clientY).matrixTransform(matrix.inverse());return [p.x,p.y];}
  function zoom(factor:number){setCamera(([x,z,w,h])=>{const next=Math.max(7,Math.min(180,w*factor)),ratio=next/w;return [x+(w-next)/2,z+(h-h*ratio)/2,next,h*ratio];});}
  useEffect(()=>{const node=svg.current;if(!node)return;const wheel=(e:WheelEvent)=>{e.preventDefault();setCamera(([x,z,w,h])=>{const next=Math.max(7,Math.min(180,w*Math.exp(e.deltaY*.001))),r=next/w;return [x+(w-next)/2,z+(h-h*r)/2,next,h*r];});};node.addEventListener("wheel",wheel,{passive:false});return()=>node.removeEventListener("wheel",wheel);},[]);
  function begin(e:ReactPointerEvent<SVGElement>,item?:StudioItem){if(e.button!==0||drag.active)return;e.stopPropagation();if(item){setSelected(item.id);if(item.locked)return;}gesture.current={pointer:e.pointerId,start:point(e.clientX,e.clientY),item,origin:item?[item.x,item.z]:[camera[0],camera[1]],camera};svg.current?.setPointerCapture(e.pointerId);}
  function move(e:ReactPointerEvent<SVGSVGElement>){const g=gesture.current;if(!g||g.pointer!==e.pointerId)return;const p=point(e.clientX,e.clientY),dx=p[0]-g.start[0],dz=p[1]-g.start[1];if(g.item){const snap=(v:number)=>options.snap?Math.round(v*10)/10:v;setPreview({id:g.item.id,x:Math.max(-40,Math.min(40,snap(g.origin[0]+dx))),z:Math.max(-30,Math.min(30,snap(g.origin[1]+dz)))});}else setCamera(([x,z,w,h])=>[x-dx,z-dz,w,h]);}
  function finish(e:ReactPointerEvent<SVGSVGElement>,cancel=false){const g=gesture.current;if(!g||g.pointer!==e.pointerId)return;gesture.current=null;if(svg.current?.hasPointerCapture(e.pointerId))svg.current.releasePointerCapture(e.pointerId);if(preview&&!cancel){const p=preview;commit("Object moved",s=>({...s,items:s.items.map(t=>t.id===p.id?{...t,x:p.x,z:p.z}:t)}));}setPreview(null);}
  function fit(){const minX=Math.min(-16,...labels.map(l=>l.x-1)),minZ=Math.min(-11,...labels.map(l=>l.y-1)),maxX=Math.max(16,...labels.map(l=>l.x+l.w+1)),maxZ=Math.max(10,...labels.map(l=>l.y+l.h+1));setCamera([minX,minZ,maxX-minX,maxZ-minZ]);}
  return <div className="studio-plan" aria-label="Editable floor plan">
    <div className="studio-viewport-actions"><button onClick={()=>zoom(.8)} aria-label="Zoom in">+</button><button onClick={()=>zoom(1.25)} aria-label="Zoom out">−</button><button onClick={fit}>Fit labels</button><button onClick={()=>{if(svg.current)exportPlanSvg(svg.current);}}>SVG</button><button onClick={()=>{if(svg.current)void exportPlanPng(svg.current).catch(e=>notify(e instanceof Error?e.message:"PNG export failed"));}}>PNG</button></div>
    <svg ref={svg} viewBox={camera.join(" ")} onPointerDown={e=>begin(e)} onPointerMove={move} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onKeyDown={e=>{if(e.key==="Escape"){gesture.current=null;setPreview(null);}} aria-label="Glass House: 27.20 metres by 11.25 metres, with three curved bays" tabIndex={0}>
      <defs><pattern id="studio-meter-grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="#c9d2bc" strokeWidth={.02}/></pattern></defs>
      <rect x={-13.9} y={5.625} width={27.8} height={1.5} fill="#e3e3d7"/><rect x={-2.9} y={5.625} width={5.8} height={3} fill="#e3e3d7"/>
      <polygon points={floor.map(p=>p.join(",")).join(" ")} fill="#f7f6ed" stroke="#788e70" strokeWidth={.12}/>
      {options.grid&&<polygon points={floor.map(p=>p.join(",")).join(" ")} fill="url(#studio-meter-grid)" pointerEvents="none"/>}
      <text x={0} y={7.7} fontSize={.26} textAnchor="middle" fill="#879777">ENTRANCE · 5.80 m</text><text x={0} y={-10.1} textAnchor="middle" fontSize={.25} fill="#8e987e">27.20 m · schematic planning model</text>
      {options.furniture&&[...displayed.items].sort((a,b)=>Number(a.kind==="table")-Number(b.kind==="table")).map(item=><PlanFurniture key={item.id} item={item} layout={displayed} onMove={begin}/>)}
      {labels.map(label=><GuestNameBadge key={label.key} label={label}/>)}
    </svg>
    <p className="studio-canvas-hint">Drag empty space to pan · drag furniture to move · drag a guest grip/name onto a seat · {warnings.length} spatial warnings (not an egress approval)</p>
  </div>;
}
