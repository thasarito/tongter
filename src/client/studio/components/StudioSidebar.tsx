import { useMemo } from "react";
import { defaultLayout, newItem } from "../model/defaults";
import { conflicts } from "../model/geometry";
import { kinds, tableGuests, type ViewOptions } from "../model/schema";
import { useStudio } from "../state/StudioProvider";
import { useStudioChrome } from "../state/StudioChrome";
import { GuestRoster } from "./GuestRoster";
import { ObjectInspector } from "./ObjectInspector";
import { StudioToolbar } from "./StudioToolbar";
import { StudioViewPanel } from "./StudioViewPanel";
function SceneLayers(){
  const {options,setOptions}=useStudio();
  const switches:[keyof Pick<ViewOptions,"furniture"|"chairs"|"guestNames"|"tableLabels"|"grid"|"snap"|"garden"|"decorations">,string][]=[["furniture","Furniture & zones"],["chairs","Chairs"],["guestNames","Guest-name labels"],["tableLabels","Table labels"],["grid","1 m grid"],["snap","Snap furniture to 0.1 m"],["garden","Garden context"],["decorations","Wedding decorations"]];
  return <details className="studio-layer-settings"><summary>Scene layers</summary><label>Roof<select value={options.roof} onChange={e=>setOptions(o=>({...o,roof:e.target.value as ViewOptions["roof"]}))}><option value="cut">Cut away</option><option value="frame">Steel frame</option><option value="full">Glass + frame</option></select></label><label>Walls<select value={options.walls} onChange={e=>setOptions(o=>({...o,walls:e.target.value as ViewOptions["walls"]}))}><option value="low">Low cutaway</option><option value="full">Full height</option></select></label>{switches.map(([key,label])=><label className="studio-check" key={key}>{label}<input type="checkbox" checked={options[key]} onChange={e=>{const checked=e.target.checked;setOptions(o=>({...o,[key]:checked}));}}/></label>)}{options.decorations&&<label>Stage setup<select value={options.decorationMode} onChange={e=>setOptions(o=>({...o,decorationMode:e.target.value as ViewOptions["decorationMode"]}))}><option value="stage">Stage only</option><option value="head-table">Head table</option><option value="cake-table">Cake table</option></select></label>}<p className="studio-note">27.20 × 11.25 m main rectangle and three curved bays. Heights and chair clearances are schematic, not a survey or approval of capacity. Wedding decorations are a visual layer inspired by the supplied art-direction presentation and do not write to Google Sheets.</p></details>;
}
export function StudioSidebar(){
  const {layout,selected,setSelected,commit,view,editable}=useStudio(),{tab,open,selectPanel,closePanel}=useStudioChrome();
  const warnings=useMemo(()=>conflicts(layout),[layout]);
  const inspect=(id:string)=>{setSelected(id);selectPanel("selected");};
  return <aside id="studio-planning-panel" className={`studio-sidebar ${open?"open":""}`} aria-label="Planning tools" hidden={!open} data-studio-ui>
    <header className="studio-panel-heading"><div><span className="studio-sheet-handle" aria-hidden="true"/><h2>{{layout:"Room layout",guests:"Guest book",view:"Your perspective",selected:"Selected object",more:"Tools & settings"}[tab]}</h2></div><button onClick={closePanel} aria-label="Close planning tools">×</button></header>
    <div className="studio-sidebar-scroll">{tab==="guests"?<GuestRoster/>:tab==="selected"?<ObjectInspector/>:tab==="view"?<StudioViewPanel/>:tab==="more"?<><StudioToolbar/><SceneLayers/></>:<section><p className="studio-eyebrow">YOUR CELEBRATION, IN SPACE</p><h2>A room for everyone.</h2><div className="studio-stats"><div><strong>{layout.items.filter(t=>t.kind==="table").length}</strong><small>tables</small></div><div><strong>{layout.items.filter(t=>t.kind==="table").reduce((n,t)=>n+t.seats,0)}</strong><small>seats</small></div><div><strong>{layout.guestList.filter(g=>g.tableId).length}</strong><small>assigned</small></div></div>
      <p className="studio-note">Google Sheets is the shared source. Review each change before saving. Confirmed changes sync automatically; keep this tab open until all saves finish.</p><h3>Add to the room</h3><div className="studio-palette">{kinds.map(kind=><button disabled={!editable} key={kind} onClick={()=>{const item=newItem(kind,layout.items);commit("Object added",s=>({...s,items:[...s.items,item]}),()=>inspect(item.id));}}>+ {kind}</button>)}</div>
      <h3>Tables</h3><div className="studio-table-grid">{layout.items.filter(t=>t.kind==="table").map(t=><button key={t.id} className={selected===t.id?"active":""} onClick={()=>inspect(t.id)}>{t.label}<small>{tableGuests(layout,t.id).length}/{t.seats}</small></button>)}</div><h3>Event zones</h3>{layout.items.filter(t=>t.kind!=="table").map(t=><button className="studio-zone-row" key={t.id} onClick={()=>inspect(t.id)}>{t.label}{t.locked?" · locked":""}</button>)}
      <details><summary>{warnings.length} spatial checks</summary><p className="studio-note">Estimated footprint overlaps only. Confirm circulation with the venue.</p>{warnings.map((message,i)=><p className="studio-warning" key={i}>{message}</p>)}</details><button disabled={!editable} onClick={()=>{commit("Saving reference layout; guests retained",s=>({...s,items:defaultLayout().items,guestList:s.guestList.map(g=>({...g,tableId:"",seatNumber:null}))}));}}>Restore reference layout</button><p className="studio-note">{view==="plan"?"Drag furniture in the plan or edit numeric dimensions.":"Select objects in 3D; use the floor plan for furniture dragging."}</p>
    </section>}</div>
  </aside>;
}
