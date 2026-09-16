import type { ViewMode } from "../model/schema";
import { useStudio } from "../state/StudioProvider";
import { useStudioChrome } from "../state/StudioChrome";
import type { ViewportAction } from "../state/viewport-actions";
export function StudioViewPanel(){
  const {view,setView,notify}=useStudio(),{viewport,closePanel}=useStudioChrome();
  function action(key:ViewportAction){if(!viewport.run(key))notify("The view is still loading. Try again when it appears.");}
  return <section className="studio-view-panel">
    <p className="studio-eyebrow">CHANGE YOUR PERSPECTIVE</p>
    <nav className="studio-view-tabs" aria-label="Studio view">{(["plan","model","inside"] as ViewMode[]).map(v=><button key={v} aria-pressed={view===v} className={view===v?"active":""} onClick={()=>{setView(v);closePanel();}}>{{plan:"Floor plan",model:"3D model",inside:"Walk inside"}[v]}</button>)}</nav>
    <div className="studio-view-actions"><button disabled={view==="inside"} onClick={()=>action("zoom-in")} aria-label="Zoom in">＋</button><button disabled={view==="inside"} onClick={()=>action("zoom-out")} aria-label="Zoom out">−</button><button onClick={()=>action("fit")}>{view==="plan"?"Fit labels":view==="inside"?"Reset position":"Fit room"}</button></div>
    <p className="studio-note">{view==="inside"?"Close this panel to use both joysticks. Left thumb moves; right thumb looks. You can still drag the scene to look.":view==="model"?"Drag the scene to orbit. Pinch to zoom. Guest grips still move guests rather than the camera.":"Drag empty space to pan, pinch to zoom, or drag a guest grip directly onto a seat. The tools fade away during mobile guest dragging."}</p>
  </section>;
}
