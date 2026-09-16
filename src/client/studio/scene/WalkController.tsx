import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "three";
import { useStudio } from "../state/StudioProvider";
import { WalkMotion, type WalkDirection } from "./walk-motion";
const directions:Record<string,WalkDirection>={KeyW:"forward",KeyS:"back",KeyA:"left",KeyD:"right",ArrowUp:"forward",ArrowDown:"back",ArrowLeft:"left",ArrowRight:"right"};
const editing=()=>document.activeElement instanceof Element&&!!document.activeElement.closest("input,textarea,select,[contenteditable=true]");
export function WalkController({motion}:{motion:WalkMotion}){
  const {camera,gl,invalidate}=useThree(),{modal}=useStudio();
  useEffect(()=>{motion.enabled=!modal;motion.stop();},[motion,modal]);
  useEffect(()=>{
    const canvas=gl.domElement;canvas.tabIndex=0;canvas.setAttribute("aria-label","Walk inside. Drag to look, hold WASD or arrows to move.");
    if(camera instanceof PerspectiveCamera){camera.fov=68;camera.updateProjectionMatrix();}
    const apply=()=>{camera.position.set(motion.x,1.67,motion.z);camera.lookAt(motion.x+Math.sin(motion.yaw)*Math.cos(motion.pitch),1.67+Math.sin(motion.pitch),motion.z+Math.cos(motion.yaw)*Math.cos(motion.pitch));invalidate();};apply();
    let pointer:{id:number;x:number;y:number}|null=null;
    const stop=()=>{motion.stop();pointer=null;if(document.pointerLockElement===canvas)void document.exitPointerLock();};
    const down=(e:KeyboardEvent)=>{if(editing()||document.querySelector("dialog[open]")||e.metaKey||e.ctrlKey||e.altKey)return;const direction=directions[e.code];if(direction){e.preventDefault();motion.press(`key:${e.code}`,direction);}motion.fast=e.shiftKey;if(e.key==="Escape")stop();};
    const up=(e:KeyboardEvent)=>{motion.release(`key:${e.code}`);if(e.key==="Shift")motion.fast=false;};
    const startLook=(e:PointerEvent)=>{if(e.button!==0||!motion.enabled||pointer||document.pointerLockElement===canvas)return;canvas.focus({preventScroll:true});pointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);e.preventDefault();};
    const moveLook=(e:PointerEvent)=>{if(!pointer||pointer.id!==e.pointerId)return;motion.look(e.clientX-pointer.x,e.clientY-pointer.y);pointer.x=e.clientX;pointer.y=e.clientY;};
    const endLook=(e:PointerEvent)=>{if(pointer?.id===e.pointerId){pointer=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}};
    const mouse=(e:MouseEvent)=>{if(document.pointerLockElement===canvas)motion.look(e.movementX,e.movementY);};
    const focus=()=>{if(editing())stop();},visibility=()=>{if(document.hidden)stop();};
    const lock=()=>{if(document.pointerLockElement!==canvas)motion.stop();};
    document.addEventListener("keydown",down);document.addEventListener("keyup",up);document.addEventListener("mousemove",mouse);document.addEventListener("focusin",focus);document.addEventListener("visibilitychange",visibility);document.addEventListener("pointerlockchange",lock);window.addEventListener("blur",stop);
    canvas.addEventListener("pointerdown",startLook);canvas.addEventListener("pointermove",moveLook);canvas.addEventListener("pointerup",endLook);canvas.addEventListener("pointercancel",endLook);canvas.addEventListener("lostpointercapture",endLook);
    return()=>{stop();document.removeEventListener("keydown",down);document.removeEventListener("keyup",up);document.removeEventListener("mousemove",mouse);document.removeEventListener("focusin",focus);document.removeEventListener("visibilitychange",visibility);document.removeEventListener("pointerlockchange",lock);window.removeEventListener("blur",stop);canvas.removeEventListener("pointerdown",startLook);canvas.removeEventListener("pointermove",moveLook);canvas.removeEventListener("pointerup",endLook);canvas.removeEventListener("pointercancel",endLook);canvas.removeEventListener("lostpointercapture",endLook);};
  },[camera,gl,invalidate,motion]);
  useFrame((_,delta)=>{
    if(document.hidden||editing()||document.querySelector("dialog[open]")){motion.stop();return;}
    motion.update(delta);camera.position.set(motion.x,1.67,motion.z);camera.lookAt(motion.x+Math.sin(motion.yaw)*Math.cos(motion.pitch),1.67+Math.sin(motion.pitch),motion.z+Math.cos(motion.yaw)*Math.cos(motion.pitch));
  },-1);
  return null;
}
