import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError } from "@/client/api/client";
import type { StudioMutation } from "@/shared/studio-mutations";
import type { StudioSheetResponse, StudioSheetSnapshot } from "@/shared/studio-sheet";
import { useGuestDrag } from "../interaction/GuestDragProvider";
import { useStudio } from "./StudioProvider";
import { fetchStudioSheet, saveStudioSheet, SheetSaveError } from "./sheet-source";
import "../styles/sheet-source.css";
interface Connection {snapshot:StudioSheetSnapshot|null;busy:boolean;error:string;reload:()=>void}
const ConnectionContext=createContext<Connection|null>(null);
export function SheetConnection({children,onUnauthorized,loadSheet=fetchStudioSheet,saveSheet=saveStudioSheet}:{children:ReactNode;onUnauthorized:()=>void;loadSheet?:(signal?:AbortSignal)=>Promise<StudioSheetResponse>;saveSheet?:(op:StudioMutation)=>Promise<StudioSheetSnapshot>}){
  const studio=useStudio(),drag=useGuestDrag(),latest=useRef({studio,drag}),mounted=useRef(false),request=useRef<AbortController|null>(null),reading=useRef(false),generation=useRef(0);
  const [ready,setReady]=useState(false),[snapshot,setSnapshot]=useState<StudioSheetSnapshot|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{latest.current={studio,drag};},[studio,drag]);
  const write=useCallback(async(op:StudioMutation)=>{
    generation.current++;request.current?.abort();
    try{const value=await saveSheet(op);if(mounted.current){setSnapshot(value);setError("");}return value;}
    catch(cause){if(cause instanceof SheetSaveError){if(cause.snapshot&&mounted.current)setSnapshot(cause.snapshot);if(cause.status===401)onUnauthorized();}throw cause;}
  },[saveSheet,onUnauthorized]);
  const refresh=useCallback(async()=>{
    const current=latest.current;if(!mounted.current||reading.current||current.studio.pending||current.drag.active||current.studio.modal)return;
    reading.current=true;setBusy(true);const serial=++generation.current,controller=new AbortController();request.current=controller;
    try{
      const value=await loadSheet(controller.signal);if(!mounted.current||serial!==generation.current)return;
      if(value.status!=="ok"){setError("Google Sheets is not configured. No old browser draft is shown instead.");return;}
      if(latest.current.studio.pending||latest.current.drag.active||latest.current.studio.modal)return;
      latest.current.studio.hydrate(value.layout);latest.current.studio.connect(write);setSnapshot(value);setReady(true);setError("");
    }catch(cause){if(!mounted.current||serial!==generation.current)return;if(cause instanceof ApiError&&cause.status===401){onUnauthorized();return;}setError(cause instanceof Error?cause.message:"Sheet refresh failed.");}
    finally{reading.current=false;if(mounted.current)setBusy(false);}
  },[loadSheet,write,onUnauthorized]);
  useEffect(()=>{
    mounted.current=true;void refresh();const tick=()=>{if(!document.hidden)void refresh();};const timer=window.setInterval(tick,30_000);window.addEventListener("focus",tick);
    return()=>{mounted.current=false;generation.current++;reading.current=false;request.current?.abort();clearInterval(timer);window.removeEventListener("focus",tick);};
  },[refresh]);
  if(!ready)return <div className="studio-root studio-sheet-loading" role="status"><h1>Loading your live seating sheet…</h1><p>Google Sheets supplies the guests, exact seats and table positions.</p>{error&&<p role="alert">{error}</p>}<button disabled={busy} onClick={()=>void refresh()}>{busy?"Reading Sheets…":"Retry sheet connection"}</button><small>No stale browser draft is substituted.</small></div>;
  return <ConnectionContext.Provider value={{snapshot,busy,error,reload:()=>void refresh()}}>{children}</ConnectionContext.Provider>;
}
export function SheetStatus(){
  const value=useContext(ConnectionContext),studio=useStudio();if(!value)return null;
  const {snapshot,busy,error,reload}=value,problem=studio.syncError||error;
  return <section className={`studio-sheet-status ${problem?"warning":""}`} aria-label="Sheet synchronization status" data-sheet-revision={snapshot?.revision} data-save-pending={studio.pending}>
    <div><strong>{studio.busy?"Saving to Google Sheets…":problem?"Sheet connection needs attention":"Live Google Sheet · autosave"}</strong><span>{problem||(snapshot?`${studio.layout.guestList.length} guests · ${studio.layout.guestList.filter(g=>g.tableId).length} seated · ${studio.layout.items.filter(t=>t.kind==="table").length} tables · checked ${new Date(snapshot.fetchedAt).toLocaleTimeString()}`:"Connecting…")}</span></div>
    {studio.pending?<button disabled={studio.busy} onClick={studio.retry}>{studio.busy?"Saving…":"Retry save"}</button>:<button onClick={reload} disabled={busy}>{busy?"Checking…":"Reload sheet"}</button>}
  </section>;
}
