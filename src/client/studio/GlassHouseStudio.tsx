import { lazy, Suspense } from "react";
import type { StudioGuestImport } from "@/shared/studio-guests";
import { StudioProvider, useStudio } from "./state/StudioProvider";
import { SheetConnection, SheetStatus } from "./state/SheetConnection";
import { GuestDragProvider } from "./interaction/GuestDragProvider";
import FloorPlan from "./plan/FloorPlan";
import { StudioToolbar } from "./components/StudioToolbar";
import { StudioSidebar } from "./components/StudioSidebar";
import { SeatEditor } from "./components/SeatEditor";
import { GuestForm } from "./components/GuestForm";
import { ImportDialog } from "./components/ImportDialog";
import { SceneErrorBoundary } from "./scene/SceneErrorBoundary";
import "./studio.css";
import "./styles/drag-feedback.css";
const VenueScene=lazy(()=>import("./scene/VenueScene"));
interface Props {onUnauthorized:()=>void;loadSiteGuests?:()=>Promise<StudioGuestImport>}
function DialogHost(){const {modal}=useStudio();if(!modal)return null;if(modal.type==="seat")return <SeatEditor key={modal.target.tableId} target={modal.target}/>;if(modal.type==="guest")return <GuestForm key={modal.id??`new:${modal.target?.tableId}:${modal.target?.seatNumber}`} id={modal.id} target={modal.target}/>;return <ImportDialog data={modal.data}/>;}
function Workspace(){
  const {view,setView,notice,saved,pending}=useStudio();
  return <main className="studio-root" aria-label="Glass House administrator planning studio" data-saving={pending}>
    <StudioToolbar/><SheetStatus/>
    <div className="studio-workspace"><StudioSidebar/><section className="studio-viewport" aria-label="Venue planner">
      {view==="plan"?<FloorPlan/>:<SceneErrorBoundary onPlan={()=>setView("plan")}><Suspense fallback={<div className="studio-render-fallback">Loading the 3D scene…</div>}><VenueScene/></Suspense></SceneErrorBoundary>}
    </section></div><footer className="studio-status"><span role="status" aria-live="polite">{notice}</span><small>{saved}</small></footer><DialogHost/>
  </main>;
}
export default function GlassHouseStudio(props:Props){return <StudioProvider><GuestDragProvider><SheetConnection onUnauthorized={props.onUnauthorized}><Workspace/></SheetConnection></GuestDragProvider></StudioProvider>;}
