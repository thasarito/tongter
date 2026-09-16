import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Point } from "../model/geometry";
import type { StudioItem } from "../model/schema";
import type { LabelBox } from "../model/labels";
import { useStudio } from "../state/StudioProvider";
import { useGuestDrag } from "../interaction/GuestDragProvider";
type Camera=[number,number,number,number];
interface Preview {id:string;x:number;z:number}
interface Gesture {pointer:number;start:Point;item?:StudioItem;origin:Point;camera:Camera;inverse:DOMMatrix}
interface Pinch {distance:number;anchor:Point;camera:Camera;inverse:DOMMatrix}
const project=(x:number,y:number,m:DOMMatrix):Point=>{const p=new DOMPoint(x,y).matrixTransform(m);return [p.x,p.y];};
const dragFields=["kind","shape","x","z","w","d","h","rotation","seats","locked","aisleWidth"] as const;
const unchangedItem=(before:StudioItem,current:StudioItem|undefined)=>!!current&&dragFields.every(field=>before[field]===current[field]);
export function usePlanCamera(){
  const {layout,modal,options,commit,setSelected,editable,notify}=useStudio(),drag=useGuestDrag();
  const svg=useRef<SVGSVGElement>(null),gesture=useRef<Gesture|null>(null),pinch=useRef<Pinch|null>(null),pointers=useRef(new Map<number,Point>()),pending=useRef<Preview|null>(null);
  const [camera,setCamera]=useState<Camera>([-17,-11,34,22]),[preview,setPreview]=useState<Preview|null>(null);
  const cameraRef=useRef<Camera>(camera);
  function updateCamera(next:Camera){cameraRef.current=next;setCamera(next);}
  function cancel(){
    gesture.current=null;pinch.current=null;pending.current=null;setPreview(null);
    for(const pointer of pointers.current.keys()){
      try{if(svg.current?.hasPointerCapture(pointer))svg.current.releasePointerCapture(pointer);}catch{/* the SVG may have unmounted */}
    }
    pointers.current.clear();
  }
  useEffect(()=>{cancel();},[modal]);
  useEffect(()=>{
    const item=gesture.current?.item;
    // A save acknowledgement or unrelated collaborator edit must not interrupt
    // the next drag. Only invalidate a changed/deleted/locked drag target.
    if(item&&!unchangedItem(item,layout.items.find(current=>current.id===item.id)))cancel();
  },[layout]);
  useEffect(()=>{const blur=()=>cancel();window.addEventListener("blur",blur);return()=>window.removeEventListener("blur",blur);},[]);
  function zoom(factor:number){const [x,z,w,h]=cameraRef.current,next=Math.max(7,Math.min(180,w*factor)),ratio=next/w;updateCamera([x+(w-next)/2,z+(h-h*ratio)/2,next,h*ratio]);}
  useEffect(()=>{const node=svg.current;if(!node)return;const wheel=(e:WheelEvent)=>{e.preventDefault();if(!gesture.current&&!pinch.current)zoom(Math.exp(e.deltaY*.001));};node.addEventListener("wheel",wheel,{passive:false});return()=>node.removeEventListener("wheel",wheel);},[]);
  function begin(e:ReactPointerEvent<SVGElement>,item?:StudioItem){
    if(e.button!==0||drag.active)return;
    if(item&&!editable){notify("Wait for the sheet connection or session recovery before moving objects.");return;}
    e.stopPropagation();const matrix=svg.current?.getScreenCTM();if(!matrix)return;
    const inverse=matrix.inverse();pointers.current.set(e.pointerId,[e.clientX,e.clientY]);svg.current?.setPointerCapture(e.pointerId);
    if(pointers.current.size===2){
      gesture.current=null;pending.current=null;setPreview(null);const [a,b]=[...pointers.current.values()];
      pinch.current={distance:Math.max(1,Math.hypot(a[0]-b[0],a[1]-b[1])),anchor:project((a[0]+b[0])/2,(a[1]+b[1])/2,inverse),camera:cameraRef.current,inverse};return;
    }
    if(pointers.current.size>2)return;
    if(item){setSelected(item.id);if(item.locked)return;}
    gesture.current={pointer:e.pointerId,start:project(e.clientX,e.clientY,inverse),item,origin:item?[item.x,item.z]:[cameraRef.current[0],cameraRef.current[1]],camera:cameraRef.current,inverse};
  }
  function move(e:ReactPointerEvent<SVGSVGElement>){
    if(pointers.current.has(e.pointerId))pointers.current.set(e.pointerId,[e.clientX,e.clientY]);
    const p=pinch.current;
    if(p&&pointers.current.size>=2){
      const [a,b]=[...pointers.current.values()],distance=Math.max(1,Math.hypot(a[0]-b[0],a[1]-b[1])),width=Math.max(7,Math.min(180,p.camera[2]*p.distance/distance)),ratio=width/p.camera[2];
      const middle=project((a[0]+b[0])/2,(a[1]+b[1])/2,p.inverse);
      updateCamera([p.anchor[0]-(middle[0]-p.camera[0])*ratio,p.anchor[1]-(middle[1]-p.camera[1])*ratio,width,p.camera[3]*ratio]);return;
    }
    const g=gesture.current;if(!g||g.pointer!==e.pointerId)return;
    // Use the initial transform: reading a moving view's inverse causes pan jitter.
    const point=project(e.clientX,e.clientY,g.inverse),dx=point[0]-g.start[0],dz=point[1]-g.start[1];
    if(g.item){const snap=(v:number)=>options.snap?Math.round(v*10)/10:v;const next={id:g.item.id,x:Math.max(-40,Math.min(40,snap(g.origin[0]+dx))),z:Math.max(-30,Math.min(30,snap(g.origin[1]+dz)))};pending.current=next;setPreview(next);}
    else updateCamera([g.camera[0]-dx,g.camera[1]-dz,g.camera[2],g.camera[3]]);
  }
  function finish(e:ReactPointerEvent<SVGSVGElement>,aborted=false){
    const g=gesture.current,p=pending.current;pointers.current.delete(e.pointerId);
    if(svg.current?.hasPointerCapture(e.pointerId))svg.current.releasePointerCapture(e.pointerId);
    if(pinch.current){pinch.current=null;gesture.current=null;pending.current=null;setPreview(null);return;}
    if(!g||g.pointer!==e.pointerId)return;gesture.current=null;pending.current=null;setPreview(null);
    if(p&&!aborted)commit("Object moved",s=>{
      // Recheck synchronously too: pointerup can arrive before the refresh effect.
      if(!g.item||!unchangedItem(g.item,s.items.find(item=>item.id===p.id)))throw Error("That object changed during the drag. Its latest position was kept.");
      return {...s,items:s.items.map(t=>t.id===p.id?{...t,x:p.x,z:p.z}:t)};
    });
  }
  function fit(labels:LabelBox[]){const x=Math.min(-16,...labels.map(l=>l.x-1)),z=Math.min(-11,...labels.map(l=>l.y-1)),right=Math.max(16,...labels.map(l=>l.x+l.w+1)),bottom=Math.max(10,...labels.map(l=>l.y+l.h+1));updateCamera([x,z,right-x,bottom-z]);}
  return {svg,camera,preview,begin,move,finish,cancel,zoom,fit};
}
