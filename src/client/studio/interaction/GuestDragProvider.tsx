import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { moveGuests } from "../model/commands";
import type { SeatTarget } from "../model/schema";
import { useStudio } from "../state/StudioProvider";
import { rememberPanelScroll } from "./panel-scroll";
export type ScenePicker=(x:number,y:number)=>SeatTarget|null;
interface DragContextValue {active:boolean;target:SeatTarget|null;valid:boolean;registerScenePicker:(picker:ScenePicker|null)=>void}
const DragContext=createContext<DragContextValue>({active:false,target:null,valid:false,registerScenePicker:()=>{}});
const targetKey=(t:SeatTarget|null)=>t?`${t.tableId}:${t.seatNumber??"table"}`:"none";
interface Session {pointerId:number;handle:Element;ids:string[];x:number;y:number;startX:number;startY:number;active:boolean;focus:boolean;revision:number;restoreScroll:()=>void}
interface Feedback {active:boolean;target:SeatTarget|null;valid:boolean;message:string;x:number;y:number}
const idle:Feedback={active:false,target:null,valid:false,message:"",x:0,y:0};
const dragClasses=["studio-pointer-dragging","studio-mobile-guest-drag"];
export function GuestDragProvider({children}:{children:ReactNode}){
  const studio=useStudio(),latest=useRef(studio),session=useRef<Session|null>(null),picker=useRef<ScenePicker|null>(null),suppress=useRef(0);
  const [feedback,setFeedback]=useState<Feedback>(idle);
  useEffect(()=>{latest.current=studio;},[studio]);
  const registerScenePicker=useCallback((next:ScenePicker|null)=>{picker.current=next;},[]);
  useEffect(()=>{
    let restoreFrame=0;
    function at(x:number,y:number):SeatTarget|null {
      const el=document.elementFromPoint(x,y),target=el?.closest("[data-seat-table]");
      if(target){const n=target.getAttribute("data-seat-number");return {tableId:target.getAttribute("data-seat-table")??"",seatNumber:n?Number(n):null};}
      if(el?.closest("[data-studio-canvas]")&&latest.current.view==="model")return picker.current?.(x,y)??null;return null;
    }
    function clear(cancel=false){
      const s=session.current;session.current=null;document.body.classList.remove(...dragClasses);setFeedback(idle);if(!s)return;
      try{if(s.handle.hasPointerCapture(s.pointerId))s.handle.releasePointerCapture(s.pointerId);}catch{/* source may have unmounted */}
      if(s.active){
        suppress.current=performance.now()+400;if(cancel)latest.current.notify("Move cancelled. Assignments unchanged.");
        s.restoreScroll();cancelAnimationFrame(restoreFrame);
        // Restore once more after React/browser focus restoration. A subsequent
        // gesture cancels this frame so we never fight the next intentional scroll.
        restoreFrame=requestAnimationFrame(()=>{if(!session.current)s.restoreScroll();});
      }
    }
    function down(e:PointerEvent){
      if(session.current||e.button!==0)return;suppress.current=0;cancelAnimationFrame(restoreFrame);
      const el=e.target instanceof Element?e.target.closest("[data-guest-drag]"):null,id=el?.getAttribute("data-guest-drag");if(!el||!id)return;
      const state=latest.current;if(!state.editable){e.preventDefault();state.notify("Wait for the sheet connection before another move.");return;}
      const ids=el.hasAttribute("data-roster-drag")&&state.picked.includes(id)?state.picked:[id];if(ids.some(id=>!state.layout.guestList.some(g=>g.id===id)))return;
      e.preventDefault();e.stopPropagation();
      session.current={pointerId:e.pointerId,handle:el,ids,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,active:false,focus:false,revision:state.revision,restoreScroll:rememberPanelScroll(el)};
      try{el.setPointerCapture(e.pointerId);}catch{/* document still observes pointerup */}
    }
    function move(e:PointerEvent){
      const s=session.current;if(!s||s.pointerId!==e.pointerId)return;if(s.revision!==latest.current.revision){clear(true);return;}
      s.x=e.clientX;s.y=e.clientY;if(!s.active&&Math.hypot(s.x-s.startX,s.y-s.startY)<6)return;
      if(!s.active){
        s.active=true;s.focus=!document.querySelector("dialog[open]")&&(innerWidth<=760||(innerHeight<=520&&matchMedia("(pointer: coarse)").matches));
        // Change hit-testing before reading the target, not after React's next paint.
        // Keep the source mounted and captured: search, filters and scroll are untouched.
        if(s.focus)document.body.classList.add("studio-mobile-guest-drag");
      }
      e.preventDefault();e.stopPropagation();document.body.classList.add("studio-pointer-dragging");
      const selection=window.getSelection();if(selection?.anchorNode?.parentElement?.closest(".studio-root,.studio-modal"))selection.removeAllRanges();
      const target=at(s.x,s.y);let valid=false,message="Drop onto a chair, a table, or Unassigned.";
      if(target)try{moveGuests(latest.current.layout,s.ids,target);valid=true;message=!target.tableId?"Return to Unassigned":target.seatNumber?`Move / swap into seat ${target.seatNumber}`:`Assign ${s.ids.length} guest(s) to this table`;}catch(cause){message=cause instanceof Error?cause.message:"Invalid drop.";}
      setFeedback({active:true,target,valid,message,x:s.x,y:s.y});
      if(!s.focus){let el=document.elementFromPoint(s.x,s.y);while(el&&el!==document.body){const style=getComputedStyle(el);if(/auto|scroll/.test(style.overflowY)&&el.scrollHeight>el.clientHeight){const r=el.getBoundingClientRect();if(s.y<r.top+30)el.scrollTop-=12;else if(s.y>r.bottom-30)el.scrollTop+=12;break;}el=el.parentElement;}}
    }
    function up(e:PointerEvent){
      const s=session.current;if(!s||s.pointerId!==e.pointerId)return;if(!s.active){clear();return;}e.preventDefault();e.stopPropagation();
      if(s.revision!==latest.current.revision){clear(true);return;}
      // Resolve while the panel is still transparent; restoring it first would
      // catch a drop intended for a seat beneath the guest sheet.
      const target=at(e.clientX,e.clientY),ids=s.ids.slice();clear();if(!target){latest.current.notify("No seat selected. Assignments unchanged.");return;}
      latest.current.commit("Saving seating to Google Sheets…",layout=>moveGuests(layout,ids,target));latest.current.setPicked([]);
    }
    const cancel=()=>clear(true),pointerCancel=(e:PointerEvent)=>{if(session.current?.pointerId===e.pointerId)clear(true);};
    const key=(e:KeyboardEvent)=>{if(session.current&&e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation();clear(true);}};
    const click=(e:MouseEvent)=>{if(e.detail>0&&performance.now()<suppress.current){e.preventDefault();e.stopImmediatePropagation();}};
    const nativeDrag=(e:DragEvent)=>{if(e.target instanceof Element&&e.target.closest("[data-guest-drag]"))e.preventDefault();};
    const visibility=()=>{if(document.hidden)cancel();};
    document.addEventListener("pointerdown",down,{capture:true,passive:false});document.addEventListener("pointermove",move,{capture:true,passive:false});document.addEventListener("pointerup",up,true);document.addEventListener("pointercancel",pointerCancel,true);document.addEventListener("lostpointercapture",pointerCancel,true);document.addEventListener("click",click,true);document.addEventListener("keydown",key,true);document.addEventListener("dragstart",nativeDrag,true);document.addEventListener("visibilitychange",visibility);window.addEventListener("blur",cancel);window.addEventListener("resize",cancel);
    return()=>{cancelAnimationFrame(restoreFrame);const s=session.current;session.current=null;document.body.classList.remove(...dragClasses);try{if(s?.handle.hasPointerCapture(s.pointerId))s.handle.releasePointerCapture(s.pointerId);}catch{/* source detached */}document.removeEventListener("pointerdown",down,true);document.removeEventListener("pointermove",move,true);document.removeEventListener("pointerup",up,true);document.removeEventListener("pointercancel",pointerCancel,true);document.removeEventListener("lostpointercapture",pointerCancel,true);document.removeEventListener("click",click,true);document.removeEventListener("keydown",key,true);document.removeEventListener("dragstart",nativeDrag,true);document.removeEventListener("visibilitychange",visibility);window.removeEventListener("blur",cancel);window.removeEventListener("resize",cancel);};
  },[]);
  const value=useMemo(()=>({active:feedback.active,target:feedback.target,valid:feedback.valid,registerScenePicker}),[feedback.active,feedback.target,feedback.valid,registerScenePicker]);
  const host=typeof document!=="undefined"?(Array.from(document.querySelectorAll("dialog[open]")).at(-1)??document.body):null;
  return <DragContext.Provider value={value}>{children}{feedback.active&&host&&createPortal(<div className={`studio-drag-ghost ${feedback.valid?"":"invalid"}`} role="status" style={{left:Math.max(8,Math.min(innerWidth-270,feedback.x+16)),top:Math.max(8,Math.min(innerHeight-90,feedback.y-90))}}>{session.current?.ids.length===1?studio.layout.guestList.find(g=>g.id===session.current?.ids[0])?.name:`${session.current?.ids.length} guests`}<small>{feedback.message}</small></div>,host)}</DragContext.Provider>;
}
export const useGuestDrag=()=>useContext(DragContext);
export function useDropTarget(target:SeatTarget){const d=useGuestDrag();return {"data-seat-table":target.tableId,"data-seat-number":target.seatNumber??undefined,"data-drag-over":d.active&&targetKey(d.target)===targetKey(target)?(d.valid?"valid":"invalid"):undefined};}
export function GuestGrip({id,bulk=false}:{id:string;bulk?:boolean}){const {setModal,editable}=useStudio();return <button type="button" disabled={!editable} className="studio-grip" data-guest-drag={id} data-roster-drag={bulk?"":undefined} onClick={()=>setModal({type:"guest",id})} aria-label="Drag guest or open guest details" title="Drag to a seat; tap to edit">⠿</button>;}
