import { useEffect, useRef, useState, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { Group } from "three";
import { useStudio } from "../state/StudioProvider";
import { useStudioChrome } from "../state/StudioChrome";
import { download } from "../model/exchange";
import { VenueShell } from "./VenueShell";
import { BanquetTable } from "./BanquetTable";
import { EventZone } from "./EventZone";
import { WalkController } from "./WalkController";
import { WalkMotion } from "./walk-motion";
import { WalkJoystick } from "./WalkJoystick";
import { SeatLabels } from "./SeatLabels";
import { ModelControls, ScenePicker } from "./SceneControls";

function SceneContents({motion}:{motion:WalkMotion}){
  const {layout,options,view}=useStudio(),furniture=useRef<Group>(null),inside=view==="inside";
  return <>
    <color attach="background" args={["#ecece0"]}/>
    <hemisphereLight args={["#fff9e8","#889779",2.2]}/>
    <directionalLight position={[-12,24,18]} intensity={3.1} color="#fff0ce" castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} shadow-camera-near={.5} shadow-camera-far={80} shadow-normalBias={.035} onUpdate={light=>light.shadow.camera.updateProjectionMatrix()}/>
    <directionalLight position={[16,8,-15]} intensity={.7} color="#dfebdf"/>
    <VenueShell options={options} inside={inside}/>
    <group ref={furniture} visible={options.furniture}>{layout.items.map(item=>item.kind==="table"?<BanquetTable key={item.id} item={item}/>:<EventZone key={item.id} item={item}/>)}</group>
    <ScenePicker furniture={furniture}/>
    {inside?<WalkController motion={motion}/>:<ModelControls/>}
    {options.guestNames&&options.furniture&&options.chairs&&<SeatLabels/>}
  </>;
}
function WalkControls({motion,host}:{motion:WalkMotion;host:RefObject<HTMLDivElement|null>}){
  const {notify,modal}=useStudio(),{open}=useStudioChrome(),[resetVersion,setResetVersion]=useState(0);
  function toggleMouse(){
    const canvas=host.current?.querySelector("canvas");if(!canvas)return;
    if(document.pointerLockElement===canvas){void document.exitPointerLock();return;}
    try{const result=canvas.requestPointerLock();result?.catch(()=>notify("Mouse capture unavailable; drag the view to look instead."));}
    catch{notify("Mouse capture unavailable; drag the view to look instead.");}
  }
  return <>
    <WalkJoystick motion={motion} disabled={open||!!modal} resetVersion={resetVersion}/>
    {!open&&<details className="studio-walk-settings" data-studio-ui onToggle={()=>motion.stop()}>
      <summary>Walk settings</summary>
      <label>Walking pace<select aria-label="Walking pace" defaultValue="1.6" onChange={e=>{motion.speed=Number(e.target.value);}}><option value=".8">Slow stroll</option><option value="1.6">Normal pace</option><option value="2.6">Brisk walk</option></select></label>
      <button onClick={()=>{motion.reset();setResetVersion(n=>n+1);}}>Reset position</button>
      <button className="studio-mouse-look" onClick={toggleMouse}>Mouse look</button>
      <small>Hold WASD / arrows. Escape releases mouse capture.</small>
    </details>}
  </>;
}
export default function VenueScene(){
  const {view,setView,notify}=useStudio(),[motion]=useState(()=>new WalkMotion()),host=useRef<HTMLDivElement>(null);
  useEffect(()=>()=>motion.stop(),[motion]);
  function exportImage(){const canvas=host.current?.querySelector("canvas");if(!canvas)return;try{canvas.toBlob(blob=>{if(blob)download(`glass-house-${view}.png`,blob,"image/png");else notify("Unable to export this view.");},"image/png");}catch{notify("Unable to export this view.");}}
  return <div ref={host} data-studio-canvas className="studio-three-view">
    <Canvas style={{touchAction:"none"}} shadows dpr={[1,1.75]} frameloop={view==="inside"?"always":"demand"} camera={{position:[24,23,29],fov:42,near:.05,far:250}} gl={{antialias:true,preserveDrawingBuffer:true}} fallback={<div className="studio-render-fallback"><p>3D graphics are unavailable in this browser. Your draft is intact.</p><button onClick={()=>setView("plan")}>Return to floor plan</button></div>}>
      <SceneContents motion={motion}/>
    </Canvas>
    <div className="studio-viewport-actions" data-studio-ui><button onClick={()=>setView("plan")}>Floor plan</button><button onClick={exportImage}>PNG</button></div>
    {view==="inside"&&<WalkControls motion={motion} host={host}/>}
  </div>;
}
