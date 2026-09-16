import { lazy, Suspense, useState } from "react";
import type { StudioGuestImport } from "@/shared/studio-guests";
import { ApiError } from "@/client/api/client";
import { StudioProvider, useStudio } from "./state/StudioProvider";
import { SheetConnection, SheetStatus } from "./state/SheetConnection";
import { GuestDragProvider } from "./interaction/GuestDragProvider";
import { parseGuestImport } from "./model/exchange";
import FloorPlan from "./plan/FloorPlan";
import { StudioToolbar } from "./components/StudioToolbar";
import { StudioSidebar } from "./components/StudioSidebar";
import { SeatEditor } from "./components/SeatEditor";
import { GuestForm } from "./components/GuestForm";
import { ImportDialog } from "./components/ImportDialog";
import { Modal } from "./components/Modal";
import { SceneErrorBoundary } from "./scene/SceneErrorBoundary";
import "./studio.css";
const VenueScene=lazy(()=>import("./scene/VenueScene"));
interface Props {loadSiteGuests:()=>Promise<StudioGuestImport>;onUnauthorized:()=>void}
function DialogHost(){
  const {modal,setModal,commit}=useStudio();if(!modal)return null;
  if(modal.type==="seat")return <SeatEditor key={modal.target.tableId} target={modal.target}/>;
  if(modal.type==="guest")return <GuestForm key={modal.id??`new:${modal.target?.tableId}:${modal.target?.seatNumber}`} id={modal.id} target={modal.target}/>;
  if(modal.type==="import")return <ImportDialog data={modal.data}/>;
  return <Modal title="Replace current project?" onClose={()=>setModal(null)}><p>This file contains {modal.layout.items.length} objects and {modal.layout.guestList.length} guests. It replaces both furniture and guests in your local draft.</p><p className="studio-note">Use guest CSV/JSON import to keep the furniture. Replacement is undoable and does not publish to Google Sheets.</p><footer><button onClick={()=>setModal(null)}>Cancel</button><button className="primary" onClick={()=>{commit("Layout imported; Undo is available",()=>modal.layout);setModal(null);}}>Import this layout</button></footer></Modal>;
}
function Workspace({loadSiteGuests,onUnauthorized}:Props){
  const {view,setView,notice,saved,setModal,notify}=useStudio(),[siteBusy,setSiteBusy]=useState(false);
  async function importSiteGuests(){
    if(siteBusy)return;setSiteBusy(true);
    try{const source=await loadSiteGuests();if(source.status==="unconfigured"||!source.guests.length){notify("No legacy invitation guests are available.");return;}setModal({type:"import",data:parseGuestImport(JSON.stringify(source),"Legacy invitation roster.json")});notify("This legacy invitation roster is separate from the live StudioGuests tab. Importing it creates local draft changes only.");}
    catch(cause){if(cause instanceof ApiError&&cause.status===401){notify("Session expired. Sign in again; your saved draft is retained.");onUnauthorized();}else notify("Unable to load the legacy invitation roster. The current layout is unchanged.");}
    finally{setSiteBusy(false);}
  }
  return <main className="studio-root" aria-label="Glass House administrator planning studio">
    <StudioToolbar importSiteGuests={importSiteGuests} siteBusy={siteBusy}/>
    <SheetStatus/>
    <div className="studio-workspace"><StudioSidebar/><section className="studio-viewport" aria-label="Venue planner">
      {view==="plan"?<FloorPlan/>:<SceneErrorBoundary onPlan={()=>setView("plan")}><Suspense fallback={<div className="studio-render-fallback">Loading the 3D scene… The guest draft stays in memory.</div>}><VenueScene/></Suspense></SceneErrorBoundary>}
    </section></div>
    <footer className="studio-status"><span role="status" aria-live="polite">{notice}</span><small>{saved}</small></footer>
    <DialogHost/>
  </main>;
}
export default function GlassHouseStudio(props:Props){
  return <StudioProvider><GuestDragProvider><SheetConnection onUnauthorized={props.onUnauthorized}><Workspace {...props}/></SheetConnection></GuestDragProvider></StudioProvider>;
}
