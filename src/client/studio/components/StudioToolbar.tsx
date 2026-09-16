import { useRef, useState } from "react";
import { Link } from "react-router";
import { parseLayout, type ViewMode } from "../model/schema";
import { download, guestCsv, guestJson, parseGuestImport } from "../model/exchange";
import { exportSeatingHtml } from "../model/printing";
import { useStudio } from "../state/StudioProvider";
export interface StudioToolbarProps {importSiteGuests:()=>Promise<void>;siteBusy:boolean}
export function StudioToolbar({importSiteGuests,siteBusy}:StudioToolbarProps){
  const {layout,view,setView,undo,redo,canUndo,canRedo,options,setOptions,setModal,notify}=useStudio(),input=useRef<HTMLInputElement>(null),mode=useRef<"layout"|"guests">("layout"),[files,setFiles]=useState(false);
  function selectFile(kind:"layout"|"guests"){mode.current=kind;input.current?.click();setFiles(false);}
  async function receive(file:File){try{if(file.size>5_000_000)throw Error("Files must be smaller than 5 MB.");const text=await file.text();setModal(mode.current==="layout"?{type:"layout",layout:parseLayout(text)}:{type:"import",data:parseGuestImport(text,file.name)});}catch(cause){notify(cause instanceof Error?cause.message:"Unable to read file.");}}
  return <header className="studio-toolbar"><div className="studio-brand"><Link to="/admin" aria-label="Back to admin dashboard">←</Link><div><h1>The Glass House</h1><small>REACT PLANNING STUDIO · LOCAL DRAFT</small></div></div>
    <nav aria-label="Studio view" className="studio-view-tabs">{(["plan","model","inside"] as ViewMode[]).map(v=><button key={v} className={view===v?"active":""} aria-pressed={view===v} onClick={()=>setView(v)}>{{plan:"Floor plan",model:"3D model",inside:"Walk inside"}[v]}</button>)}</nav>
    <div className="studio-toolbar-actions"><button onClick={undo} disabled={!canUndo} aria-label="Undo">↶</button><button onClick={redo} disabled={!canRedo} aria-label="Redo">↷</button><button aria-pressed={options.guestNames} onClick={()=>setOptions(o=>({...o,guestNames:!o.guestNames}))}>Aa<span className="studio-desktop-text"> Names</span></button><button className="primary" onClick={()=>download("glass-house-layout.json",JSON.stringify(layout,null,2))}>Save JSON</button><button aria-expanded={files} onClick={()=>setFiles(!files)}>Files ▾</button></div>
    {files&&<div className="studio-file-menu"><button onClick={()=>selectFile("layout")}>Import standalone / studio layout JSON</button><button onClick={()=>selectFile("guests")}>Import guest CSV / JSON (preview)</button><button disabled={siteBusy} onClick={()=>{setFiles(false);void importSiteGuests();}}>{siteBusy?"Loading site guests…":"Import live site guests (preview)"}</button><button onClick={()=>{download("glass-house-guest-tables.csv",guestCsv(layout),"text/csv;charset=utf-8");setFiles(false);}}>Export guest-table CSV</button><button onClick={()=>{download("glass-house-guest-tables.json",guestJson(layout));setFiles(false);}}>Export guest-table JSON</button><button onClick={()=>{exportSeatingHtml(layout);setFiles(false);}}>Export printable seating HTML</button><button onClick={()=>setFiles(false)}>Close menu</button><p>Exports contain guest information. Studio edits do not change live RSVP or Sheets data.</p></div>}
    <input ref={input} type="file" accept=".json,.csv,text/csv,application/json" hidden onChange={e=>{const file=e.currentTarget.files?.[0];if(file)void receive(file);e.currentTarget.value="";}}/>
  </header>;
}
