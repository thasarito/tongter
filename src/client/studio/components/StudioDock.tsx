import { useLayoutEffect, useRef } from "react";
import { useStudioChrome, type StudioPanel } from "../state/StudioChrome";
import { SheetStatus } from "../state/SheetConnection";
const panels:{id:StudioPanel;label:string;path:string}[]=[
  {id:"layout",label:"Layout",path:"M3 3h18v18H3zM3 10h8V3m0 7v11m0-7h10"},
  {id:"guests",label:"Guests",path:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm7 .13a4 4 0 0 1 0 7.75"},
  {id:"view",label:"View",path:"m12 2 9 5v10l-9 5-9-5V7l9-5zm0 10 9-5m-9 5L3 7m9 5v10"},
  {id:"selected",label:"Selected",path:"M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8z"},
  {id:"more",label:"More",path:"M5 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm7 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm7 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"},
];
export function StudioDock(){
  const {tab,open,togglePanel,selectPanel}=useStudioChrome(),bar=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const node=bar.current,root=node?.closest<HTMLElement>(".studio-root");if(!node||!root)return;
    const measure=()=>root.style.setProperty("--studio-dock-height",`${Math.ceil(node.getBoundingClientRect().height)}px`);
    const observer=new ResizeObserver(measure);observer.observe(node);measure();
    return()=>{observer.disconnect();root.style.removeProperty("--studio-dock-height");};
  },[]);
  return <div ref={bar} className="studio-bottom-bar" data-studio-ui>
    <SheetStatus compact onDetails={()=>selectPanel("more")}/>
    <nav className="studio-panel-dock" aria-label="Planning panels">
      {panels.map(panel=><button key={panel.id} id={`studio-panel-${panel.id}`} aria-label={`${panel.label} panel`} aria-expanded={open&&tab===panel.id} aria-controls="studio-planning-panel" className={`${open&&tab===panel.id?"active ":""}${panel.id==="view"?"studio-view-dock":""}`} onClick={()=>togglePanel(panel.id)}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={panel.path}/></svg><span>{panel.label}</span>
      </button>)}
    </nav>
  </div>;
}
