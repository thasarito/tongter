import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError } from "@/client/api/client";
import type { StudioSheetResponse, StudioSheetSnapshot } from "@/shared/studio-sheet";
import { useGuestDrag } from "../interaction/GuestDragProvider";
import { download } from "../model/exchange";
import { normalizeLayout } from "../model/schema";
import { useStudio } from "./StudioProvider";
import { fetchStudioSheet } from "./sheet-source";
import "../styles/sheet-source.css";

const PREVIOUS_DRAFT="tongter:glass-house-react:before-sheet-sync";
interface Connection {
  snapshot:StudioSheetSnapshot|null;busy:boolean;error:string;dirty:boolean;pending:boolean;
  reload:()=>void;previousDraft:()=>void;
}
const ConnectionContext=createContext<Connection|null>(null);
export function SheetConnection({children,onUnauthorized,loadSheet=fetchStudioSheet}:{children:ReactNode;onUnauthorized:()=>void;loadSheet?:(signal?:AbortSignal)=>Promise<StudioSheetResponse>}) {
  const studio=useStudio(),drag=useGuestDrag();
  const latest=useRef({studio,drag}),mounted=useRef(false),sequence=useRef(0);
  const request=useRef<AbortController|null>(null),busyRef=useRef(false),loaded=useRef(false),applied=useRef<string|null>(null);
  const [ready,setReady]=useState(false),[snapshot,setSnapshot]=useState<StudioSheetSnapshot|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{latest.current={studio,drag};},[studio,drag]);
  const refresh=useCallback(async(force=false)=>{
    if(busyRef.current||!mounted.current)return;
    busyRef.current=true;setBusy(true);
    const serial=++sequence.current,controller=new AbortController();request.current=controller;
    try{
      const data=await loadSheet(controller.signal);
      if(!mounted.current||serial!==sequence.current)return;
      if(data.status==="unconfigured"){
        if(data.demo){loaded.current=true;setReady(true);setError("Demo/local draft — Google Sheets is not connected in this environment.");}
        else setError("Google Sheets is not configured for this deployment. No old browser draft was shown instead.");
        return;
      }
      const validated={...data,layout:normalizeLayout(data.layout)},text=JSON.stringify(validated.layout);
      const current=latest.current.studio,currentText=JSON.stringify(current.layout);
      const unchanged=applied.current===null||currentText===applied.current;
      setSnapshot(validated);setError("");
      const safe=unchanged&&!current.modal&&!latest.current.drag.active;
      if(!loaded.current||safe||force){
        if(force&&!unchanged&&!confirm("Reload the live sheet? Your local edits will be backed up on this device, not written to Sheets."))return;
        if(currentText!==text){
          // Preserve the old local draft on initial migration or explicit discard.
          // Routine clean refreshes must not overwrite that recovery copy.
          if(!loaded.current||(force&&!unchanged)){
            try{localStorage.setItem(PREVIOUS_DRAFT,currentText);}catch{/* JSON export remains available */}
          }
          current.commit("Loaded the current Google Sheet: guests, seats and geometry.",()=>validated.layout);
        }
        applied.current=text;
      }
      loaded.current=true;setReady(true);
    }catch(cause){
      if(!mounted.current||serial!==sequence.current)return;
      if(cause instanceof ApiError&&cause.status===401){onUnauthorized();return;}
      setError(cause instanceof Error?cause.message:"Sheet refresh failed. The last displayed data is now stale.");
    }finally{
      if(mounted.current&&serial===sequence.current){busyRef.current=false;setBusy(false);}
    }
  },[loadSheet,onUnauthorized]);
  useEffect(()=>{
    mounted.current=true;void refresh();
    const tick=()=>{if(!document.hidden)void refresh();};
    const timer=window.setInterval(tick,30_000);window.addEventListener("focus",tick);
    return()=>{mounted.current=false;sequence.current++;busyRef.current=false;request.current?.abort();clearInterval(timer);window.removeEventListener("focus",tick);};
  },[refresh]);
  const dirty=applied.current!==null&&JSON.stringify(studio.layout)!==applied.current;
  const pending=!!snapshot&&JSON.stringify(snapshot.layout)!==applied.current;
  const previousDraft=()=>{
    try{const raw=localStorage.getItem(PREVIOUS_DRAFT);if(!raw){studio.notify("No previous local draft was saved on this device.");return;}download("glass-house-previous-local-draft.json",raw);}
    catch{studio.notify("Previous local storage is unavailable.");}
  };
  if(!ready)return <div className="studio-root studio-sheet-loading" role="status">
    <h1>Loading your live seating sheet…</h1><p>The current guests, exact seats and table positions come from Google Sheets.</p>
    {error&&<p role="alert">{error}</p>}
    <button disabled={busy} onClick={()=>void refresh(true)}>{busy?"Reading Sheets…":"Retry sheet connection"}</button>
    <small>Your previous browser draft is not used as a fallback.</small>
  </div>;
  return <ConnectionContext.Provider value={{snapshot,busy,error,dirty,pending,reload:()=>void refresh(true),previousDraft}}>{children}</ConnectionContext.Provider>;
}
export function SheetStatus(){
  const value=useContext(ConnectionContext);if(!value)return null;
  const {snapshot,busy,error,dirty,pending,reload,previousDraft}=value;
  return <section className={`studio-sheet-status ${dirty||pending||error?"warning":""}`} aria-label="Sheet synchronization status">
    <div><strong>{error?"Sheet connection needs attention":dirty?"Local draft edits — not published to Sheets":"Live Google Sheet"}</strong>
      <span>{error||(pending?"The sheet has changed. Reload when ready; your local changes were not overwritten.":snapshot?`${snapshot.layout.guestList.length} guests · ${snapshot.layout.guestList.filter(g=>g.tableId).length} seated · ${snapshot.layout.items.filter(t=>t.kind==="table").length} tables · checked ${new Date(snapshot.fetchedAt).toLocaleTimeString()}`:"Demo/local fixture")}</span>
    </div>
    <button onClick={reload} disabled={busy}>{busy?"Checking…":"Reload sheet"}</button>
    <button onClick={previousDraft} title="Download the local draft saved before loading the sheet">Previous draft</button>
  </section>;
}
