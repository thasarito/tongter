import { useMemo } from "react";
import { conflicts, footprint } from "../model/geometry";
import { useStudio } from "../state/StudioProvider";
import { GuestNameBadge, usePlanLabels } from "./GuestNameLabels";
import { PlanFurniture } from "./PlanFurniture";
import { exportPlanPng, exportPlanSvg } from "../model/printing";
import { usePlanCamera } from "./usePlanCamera";
export default function FloorPlan(){
  const {layout,options,notify}=useStudio(),camera=usePlanCamera(),preview=camera.preview;
  const displayed=useMemo(()=>{
    if(!preview)return layout;
    return {...layout,items:layout.items.map(t=>t.id===preview.id?{...t,x:preview.x,z:preview.z}:t)};
  },[layout,preview]);
  const labels=usePlanLabels(displayed,options.guestNames&&options.furniture&&options.chairs),floor=useMemo(()=>footprint(),[]),warnings=useMemo(()=>conflicts(layout),[layout]);
  return <div className="studio-plan" aria-label="Editable floor plan">
    <div className="studio-viewport-actions">
      <button onClick={()=>camera.zoom(.8)} aria-label="Zoom in">+</button><button onClick={()=>camera.zoom(1.25)} aria-label="Zoom out">−</button><button onClick={()=>camera.fit(labels)}>Fit labels</button>
      <button onClick={()=>{if(camera.svg.current)exportPlanSvg(camera.svg.current);}}>SVG</button>
      <button onClick={()=>{if(camera.svg.current)void exportPlanPng(camera.svg.current).catch(e=>notify(e instanceof Error?e.message:"PNG export failed"));}}>PNG</button>
    </div>
    <svg ref={camera.svg} viewBox={camera.camera.join(" ")} onPointerDown={e=>camera.begin(e)} onPointerMove={camera.move} onPointerUp={e=>camera.finish(e)} onPointerCancel={e=>camera.finish(e,true)} onKeyDown={e=>{if(e.key==="Escape")camera.cancel();}} aria-label="Glass House: 27.20 metres by 11.25 metres, with three curved bays" tabIndex={0}>
      <defs><pattern id="studio-meter-grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="#c9d2bc" strokeWidth={.02}/></pattern></defs>
      <rect x={-13.9} y={5.625} width={27.8} height={1.5} fill="#e3e3d7"/><rect x={-2.9} y={5.625} width={5.8} height={3} fill="#e3e3d7"/>
      <polygon points={floor.map(p=>p.join(",")).join(" ")} fill="#f7f6ed" stroke="#788e70" strokeWidth={.12}/>
      {options.grid&&<polygon points={floor.map(p=>p.join(",")).join(" ")} fill="url(#studio-meter-grid)" pointerEvents="none"/>}
      <text x={0} y={7.7} fontSize={.26} textAnchor="middle" fill="#879777">ENTRANCE · 5.80 m</text><text x={0} y={-10.1} textAnchor="middle" fontSize={.25} fill="#8e987e">27.20 m · schematic planning model</text>
      {options.furniture&&[...displayed.items].sort((a,b)=>Number(a.kind==="table")-Number(b.kind==="table")).map(item=><PlanFurniture key={item.id} item={item} layout={displayed} onMove={camera.begin}/>)}
      {labels.map(label=><GuestNameBadge key={label.key} label={label}/>)}
    </svg>
    <p className="studio-canvas-hint">Drag empty space to pan · pinch to zoom · drag furniture to move · {warnings.length} spatial warnings (not an egress approval)</p>
  </div>;
}
