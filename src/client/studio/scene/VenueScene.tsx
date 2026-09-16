import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Group, Object3D, PerspectiveCamera, Raycaster, Vector2 } from "three";
import { useStudio } from "../state/StudioProvider";
import { useGuestDrag } from "../interaction/GuestDragProvider";
import { download } from "../model/exchange";
import type { SeatTarget } from "../model/schema";
import { VenueShell } from "./VenueShell";
import { BanquetTable } from "./BanquetTable";
import { EventZone } from "./EventZone";
import { WalkController } from "./WalkController";
import { WalkMotion, type WalkDirection } from "./walk-motion";
import { SeatLabels } from "./SeatLabels";
function ScenePicker({furniture}:{furniture:RefObject<Group|null>}){
  const {camera,gl,invalidate}=useThree(),{registerScenePicker}=useGuestDrag(),{layout,options}=useStudio();
  const ray=useMemo(()=>new Raycaster(),[]),pointer=useMemo(()=>new Vector2(),[]);
  useEffect(()=>{
    registerScenePicker((x,y):SeatTarget|null=>{
      if(!furniture.current||!options.furniture)return null;const box=gl.domElement.getBoundingClientRect();if(!box.width||!box.height)return null;
      pointer.set((x-box.left)/box.width*2-1,-(y-box.top)/box.height*2+1);ray.setFromCamera(pointer,camera);
      for(const hit of ray.intersectObject(furniture.current,true)){
        let node:Object3D|null=hit.object,visible=true;while(node){if(!node.visible){visible=false;break;}node=node.parent;}if(!visible)continue;
        node=hit.object;let tableId:string|undefined;while(node&&!tableId){if(typeof node.userData.tableId==="string")tableId=node.userData.tableId;node=node.parent;}
        if(!tableId)continue;const list=hit.object.userData.seatNumbers as number[]|undefined;
        return {tableId,seatNumber:hit.instanceId!==undefined&&list?list[hit.instanceId]:null};
      }
      return null;
    });
    return()=>registerScenePicker(null);
  },[camera,gl,ray,pointer,furniture,options.furniture,registerScenePicker]);
  useEffect(()=>{gl.shadowMap.autoUpdate=false;gl.shadowMap.needsUpdate=true;invalidate();},[gl,invalidate,layout,options]);
  return null;
}
function ModelControls(){
  const {camera,invalidate,size}=useThree(),{modal}=useStudio(),{active}=useGuestDrag();
  useEffect(()=>{camera.position.set(24,23,29);if(size.width<size.height)camera.position.multiplyScalar(1.4);if(camera instanceof PerspectiveCamera){camera.fov=42;camera.updateProjectionMatrix();}camera.lookAt(0,1,-.5);invalidate();},[camera,invalidate,size.width,size.height]);
  return <OrbitControls makeDefault target={[0,1,-.5]} enableDamping dampingFactor={.08} minDistance={4} maxDistance={95} maxPolarAngle={Math.PI*.49} enabled={!modal&&!active}/>;
}
function SceneContents({motion}:{motion:WalkMotion}){
  const {layout,options,view}=useStudio(),furniture=useRef<Group>(null),inside=view==="inside";
  return <>
    <color attach="background" args={["#ecece0"]}/><hemisphereLight args={["#fff9e8","#889779",2.2]}/>
    <directionalLight position={[-12,24,18]} intensity={3.1} color="#fff0ce" castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} shadow-camera-near={.5} shadow-camera-far={80} shadow-normalBias={.035}/>
    <directionalLight position={[16,8,-15]} intensity={.7} color="#dfebdf"/>
    <VenueShell options={options} inside={inside}/>
    <group ref={furniture} visible={options.furniture}>{layout.items.map(item=>item.kind==="table"?<BanquetTable key={item.id} item={item}/>:<EventZone key={item.id} item={item}/>)}</group>
    <ScenePicker furniture={furniture}/>
    {inside?<WalkController motion={motion}/>:<ModelControls/>}
    {options.guestNames&&options.furniture&&options.chairs&&<SeatLabels/>}
  </>;
}
function WalkPad({motion,host}:{motion:WalkMotion;host:RefObject<HTMLDivElement|null>}){
  const {notify}=useStudio();
  const hold=(direction:WalkDirection)=>(e:React.PointerEvent<HTMLButtonElement>)=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);motion.press(`pad:${e.pointerId}`,direction);};
  const release=(e:React.PointerEvent<HTMLButtonElement>)=>motion.release(`pad:${e.pointerId}`);
  return <div className="studio-walk-pad"><small>HOLD TO WALK · DRAG TO LOOK<br/>WASD / ARROWS · SHIFT = FASTER</small>
    <div><button onPointerDown={hold("forward")} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} aria-label="Hold to walk forward">↑</button></div>
    <div>{(["left","back","right"] as const).map((d,i)=><button key={d} onPointerDown={hold(d)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} aria-label={`Hold to walk ${d}`}>{["←","↓","→"][i]}</button>)}</div>
    <select aria-label="Walking pace" defaultValue="1.6" onChange={e=>{motion.speed=Number(e.target.value);}}><option value=".8">Slow stroll</option><option value="1.6">Normal pace</option><option value="2.6">Brisk walk</option></select>
    <div><button onClick={()=>motion.reset()}>Reset</button><button onClick={()=>{const canvas=host.current?.querySelector("canvas");if(!canvas)return;if(document.pointerLockElement===canvas){void document.exitPointerLock();return;}try{const result=canvas.requestPointerLock();result?.catch(()=>notify("Mouse capture unavailable; drag the view to look instead."));}catch{notify("Mouse capture unavailable; drag the view to look instead.");}}}>Mouse look</button></div>
  </div>;
}
export default function VenueScene(){
  const {view,setView,notify}=useStudio(),[motion]=useState(()=>new WalkMotion()),host=useRef<HTMLDivElement>(null);
  useEffect(()=>()=>motion.stop(),[motion]);
  return <div ref={host} data-studio-canvas className="studio-three-view">
    <Canvas shadows dpr={[1,1.75]} frameloop={view==="inside"?"always":"demand"} camera={{position:[24,23,29],fov:42,near:.05,far:250}} gl={{antialias:true,preserveDrawingBuffer:true}} fallback={<div className="studio-render-fallback"><p>3D graphics are unavailable in this browser. Your draft is intact.</p><button onClick={()=>setView("plan")}>Return to floor plan</button></div>}>
      <SceneContents motion={motion}/>
    </Canvas>
    <div className="studio-viewport-actions"><button onClick={()=>setView("plan")}>Floor plan</button><button onClick={()=>{const canvas=host.current?.querySelector("canvas");if(!canvas)return;try{canvas.toBlob(blob=>{if(blob)download(`glass-house-${view}.png`,blob,"image/png");else notify("Unable to export this view.");},"image/png");}catch{notify("Unable to export this view.");}}}>PNG</button></div>
    {view==="inside"&&<WalkPad motion={motion} host={host}/>}
  </div>;
}
