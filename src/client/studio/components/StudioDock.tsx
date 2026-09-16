import { useStudioChrome, type StudioPanel } from "../state/StudioChrome";
const panels: {id:StudioPanel;label:string;path:string}[] = [
  {id:"layout",label:"Layout",path:"M3 3h18v18H3zM3 10h8V3m0 7v11m0-7h10"},
  {id:"guests",label:"Guests",path:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm7 .13a4 4 0 0 1 0 7.75"},
  {id:"selected",label:"Selected",path:"M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8z"},
  {id:"layers",label:"Layers",path:"m12 3 10 5-10 5L2 8l10-5zm-9 10 9 4 9-4M3 18l9 4 9-4"},
];
export function StudioDock() {
  const {tab,open,togglePanel} = useStudioChrome();
  return <nav className="studio-panel-dock" aria-label="Planning panels" data-studio-ui>
    {panels.map(panel => <button key={panel.id} id={`studio-panel-${panel.id}`} aria-label={`${panel.label} panel`}
      aria-expanded={open&&tab===panel.id} aria-controls="studio-planning-panel" className={open&&tab===panel.id?"active":""}
      onClick={()=>togglePanel(panel.id)}>
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={panel.path}/></svg>
      <span>{panel.label}</span>
    </button>)}
  </nav>;
}
