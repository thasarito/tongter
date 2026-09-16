import { useRef, useState } from "react";
import { Link } from "react-router";
import type { ViewMode } from "../model/schema";
import { download, guestCsv, parseGuestImport } from "../model/exchange";
import { exportSeatingHtml } from "../model/printing";
import { useStudio } from "../state/StudioProvider";
export function StudioToolbar(){
  const {layout,view,setView,undo,redo,canUndo,canRedo,options,setOptions,setModal,notify,editable}=useStudio();
  const input=useRef<HTMLInputElement>(null),[files,setFiles]=useState(false);
  async function receive(file:File){try{if(!/\.csv$/i.test(file.name))throw Error("Only guest CSV files are accepted. JSON file import has been removed.");if(file.size>5_000_000)throw Error("CSV exceeds 5 MB.");const text=await file.text();if(/^[\s\uFEFF]*[\[{]/.test(text))throw Error("Expected CSV columns, not a JSON document.");setModal({type:"import",data:parseGuestImport(text,file.name)});}catch(cause){notify(cause instanceof Error?cause.message:"Unable to read CSV.");}}
  return <header className="studio-toolbar"><div className="studio-brand"><Link to="/admin" aria-label="Back to admin dashboard">←</Link><div><h1>The Glass House</h1><small>GOOGLE SHEETS · AUTOMATIC SAVING</small></div></div>
    <nav aria-label="Studio view" className="studio-view-tabs">{(["plan","model","inside"] as ViewMode[]).map(v=><button key={v} className={view===v?"active":""} aria-pressed={view===v} onClick={()=>setView(v)}>{{plan:"Floor plan",model:"3D model",inside:"Walk inside"}[v]}</button>)}</nav>
    <div className="studio-toolbar-actions"><button onClick={undo} disabled={!canUndo} aria-label="Undo">↶</button><button onClick={redo} disabled={!canRedo} aria-label="Redo">↷</button><button aria-pressed={options.guestNames} onClick={()=>setOptions(o=>({...o,guestNames:!o.guestNames}))}>Aa<span className="studio-desktop-text"> Names</span></button><button aria-expanded={files} onClick={()=>setFiles(!files)}>Files ▾</button></div>
    {files&&<div className="studio-file-menu"><button disabled={!editable} onClick={()=>{input.current?.click();setFiles(false);}}>Import guest CSV (preview)</button><button onClick={()=>{download("glass-house-guest-tables.csv",guestCsv(layout),"text/csv;charset=utf-8");setFiles(false);}}>Export guest-table CSV</button><button onClick={()=>{exportSeatingHtml(layout);setFiles(false);}}>Export printable seating HTML</button><button onClick={()=>setFiles(false)}>Close menu</button><p>Completed edits save to the Studio sheet tabs. Exports contain guest information. Invitation tokens and RSVP history are not modified.</p></div>}
    <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={e=>{const file=e.currentTarget.files?.[0];if(file)void receive(file);e.currentTarget.value="";}}/>
  </header>;
}
