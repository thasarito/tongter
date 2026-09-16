import { lazy, Suspense, useEffect } from "react";
import type { StudioGuestImport } from "@/shared/studio-guests";
import { StudioProvider, useStudio } from "./state/StudioProvider";
import { SheetConnection } from "./state/SheetConnection";
import { StudioChromeProvider, useStudioChrome, useStudioScrollLock } from "./state/StudioChrome";
import { GuestDragProvider } from "./interaction/GuestDragProvider";
import FloorPlan from "./plan/FloorPlan";
import { StudioSidebar } from "./components/StudioSidebar";
import { StudioDock } from "./components/StudioDock";
import { SeatEditor } from "./components/SeatEditor";
import { GuestForm } from "./components/GuestForm";
import { ImportDialog } from "./components/ImportDialog";
import { SceneErrorBoundary } from "./scene/SceneErrorBoundary";
import "./studio.css";
import "./styles/drag-feedback.css";
import "./styles/immersive.css";
import "./styles/touch.css";
import "./styles/bottom-dock.css";
const VenueScene=lazy(()=>import("./scene/VenueScene"));
interface Props {onUnauthorized:()=>void;loadSiteGuests?:()=>Promise<StudioGuestImport>}
function DialogHost(){const {modal}=useStudio();if(!modal)return null;if(modal.type==="seat")return <SeatEditor key={modal.target.tableId} target={modal.target}/>;if(modal.type==="guest")return <GuestForm key={modal.id??`new:${modal.target?.tableId}:${modal.target?.seatNumber}`} id={modal.id} target={modal.target}/>;return <ImportDialog data={modal.data}/>;}
function Workspace(){
  const {view,setView,notice,saved,pending}=useStudio(),{open,closePanel}=useStudioChrome();
  useStudioScrollLock();useEffect(()=>closePanel(),[view,closePanel]);
  return <main className="studio-root studio-immersive studio-dock-layout" aria-label="Glass House administrator planning studio" data-saving={pending} data-view={view} data-panel-open={open}>
    <div className="studio-workspace"><StudioSidebar/><section className="studio-viewport" aria-label="Venue planner">
      {view==="plan"?<FloorPlan/>:<SceneErrorBoundary onPlan={()=>setView("plan")}><Suspense fallback={<div className="studio-render-fallback">Loading the 3D scene…</div>}><VenueScene/></Suspense></SceneErrorBoundary>}
    </section></div><StudioDock/>
    <footer className="studio-status"><span role="status" aria-live="polite">{notice}</span><small>{saved}</small></footer><DialogHost/>
  </main>;
}
export default function GlassHouseStudio(props:Props){return <StudioProvider><StudioChromeProvider><GuestDragProvider><SheetConnection onUnauthorized={props.onUnauthorized}><Workspace/></SheetConnection></GuestDragProvider></StudioChromeProvider></StudioProvider>;}
