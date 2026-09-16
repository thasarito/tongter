import { useRef, useState } from "react";
import { Link } from "react-router";
import { download, guestCsv, parseGuestImport } from "../model/exchange";
import { exportSeatingHtml } from "../model/printing";
import { useStudio } from "../state/StudioProvider";
import { useStudioChrome } from "../state/StudioChrome";
import { SheetDetails } from "../state/SheetConnection";
/** Secondary actions now live in More, not above the canvas. */
export function StudioToolbar(){
  const {layout,view,undo,redo,canUndo,canRedo,options,setOptions,setModal,notify,editable}=useStudio(),{viewport}=useStudioChrome();
  const input=useRef<HTMLInputElement>(null),[files,setFiles]=useState(false);
  async function receive(file:File){try{if(!/\.csv$/i.test(file.name))throw Error("Only guest CSV files are accepted. JSON file import has been removed.");if(file.size>5_000_000)throw Error("CSV exceeds 5 MB.");const text=await file.text();if(text.trimStart().startsWith("[")||text.trimStart().startsWith("{"))throw Error("Expected CSV columns, not a JSON document.");setModal({type:"import",data:parseGuestImport(text,file.name)});}catch(cause){notify(cause instanceof Error?cause.message:"Unable to read CSV.");}}
  return <section className="studio-more-tools"><h2>The Glass House</h2><Link className="studio-back-link" to="/admin" aria-label="Back to admin dashboard">← Admin dashboard</Link>
    <div className="studio-more-actions"><button onClick={undo} disabled={!canUndo} aria-label="Undo">↶ Undo</button><button onClick={redo} disabled={!canRedo} aria-label="Redo">↷ Redo</button><button aria-label="Guest names" aria-pressed={options.guestNames} onClick={()=>setOptions(o=>({...o,guestNames:!o.guestNames}))}>Aa Names</button></div>
    <SheetDetails/>
    <button className="studio-files-toggle" aria-expanded={files} onClick={()=>setFiles(!files)}>Files ▾</button>
    {files&&<div className="studio-file-menu"><button disabled={!editable} onClick={()=>{input.current?.click();setFiles(false);}}>Import guest CSV (preview)</button><button onClick={()=>{download("glass-house-guest-tables.csv",guestCsv(layout),"text/csv;charset=utf-8");setFiles(false);}}>Export guest-table CSV</button><button onClick={()=>{exportSeatingHtml(layout);setFiles(false);}}>Export printable seating HTML</button><div className="studio-visual-exports"><button disabled={view!=="plan"} onClick={()=>{if(!viewport.run("svg"))notify("Wait for the floor plan to load.");}}>SVG</button><button onClick={()=>{if(!viewport.run("png"))notify("Wait for the view to load.");}}>PNG</button></div><button onClick={()=>setFiles(false)}>Close menu</button><p>Exports contain guest information. SVG is available in Floor plan; PNG captures the current scene. Completed edits save to the Studio sheet tabs.</p></div>}
    <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={e=>{const file=e.currentTarget.files?.[0];if(file)void receive(file);e.currentTarget.value="";}}/>
  </section>;
}
