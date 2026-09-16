import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { NEUTRAL_JOYSTICK, sampleJoystick } from "./joystick";
import type { WalkMotion } from "./walk-motion";
const INPUT="joystick";

/** A single captured finger moves; another finger is free to look on the canvas. */
export function WalkJoystick({motion,disabled=false,resetVersion=0}:{motion:WalkMotion;disabled?:boolean;resetVersion?:number}) {
  const base=useRef<HTMLDivElement>(null),pointer=useRef<number|null>(null);
  const [thumb,setThumb]=useState(NEUTRAL_JOYSTICK),[active,setActive]=useState(false);
  const release=useCallback((immediate=false)=>{
    const id=pointer.current;pointer.current=null;
    motion.release(INPUT);if(immediate)motion.stop();
    setThumb(NEUTRAL_JOYSTICK);setActive(false);
    if(id!==null&&base.current?.hasPointerCapture(id))base.current.releasePointerCapture(id);
  },[motion]);
  useEffect(()=>{if(disabled)release(true);},[disabled,release]);
  useEffect(()=>{release(true);},[resetVersion,release]);
  useEffect(()=>{
    const stop=()=>release(true),visibility=()=>{if(document.hidden)stop();};
    window.addEventListener("blur",stop);window.addEventListener("resize",stop);document.addEventListener("visibilitychange",visibility);
    return()=>{motion.release(INPUT);window.removeEventListener("blur",stop);window.removeEventListener("resize",stop);document.removeEventListener("visibilitychange",visibility);};
  },[motion,release]);
  function sample(e:PointerEvent<HTMLDivElement>){
    const r=e.currentTarget.getBoundingClientRect(),radius=Math.max(1,Math.min(r.width,r.height)/2-25);
    const value=sampleJoystick(e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2,radius);
    motion.setAnalog(INPUT,value.right,value.forward);setThumb(value);
  }
  function down(e:PointerEvent<HTMLDivElement>){
    if(disabled||!motion.enabled||pointer.current!==null||e.button!==0)return;
    e.preventDefault();e.stopPropagation();e.currentTarget.focus({preventScroll:true});
    pointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);setActive(true);sample(e);
  }
  function move(e:PointerEvent<HTMLDivElement>){if(pointer.current!==e.pointerId)return;e.preventDefault();e.stopPropagation();sample(e);}
  function up(e:PointerEvent<HTMLDivElement>){if(pointer.current===e.pointerId){e.preventDefault();release();}}
  function cancel(e:PointerEvent<HTMLDivElement>){if(pointer.current===e.pointerId)release(true);}
  return <div className="studio-joystick-wrap" hidden={disabled} data-studio-ui>
    <div ref={base} className="studio-joystick" role="group" aria-label="Walk joystick" aria-describedby="studio-joystick-help" tabIndex={0} data-active={active}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel}
      onContextMenu={e=>e.preventDefault()} onKeyDown={e=>{if(e.key==="Escape")release(true);}}>
      <span className="studio-joystick-knob" aria-hidden="true" style={{transform:`translate(${thumb.knobX}px,${thumb.knobY}px)`}}/>
    </div>
    <small>MOVE · DRAG SCENE TO LOOK</small>
    <span id="studio-joystick-help" className="studio-joystick-help">Drag the stick to walk in any direction. Push farther to move faster. Release to stop. Use a second finger on the scene to look around. Keyboard: W A S D or arrow keys, Shift for a faster pace.</span>
  </div>;
}
