import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { defaultLayout } from "../model/defaults";
import { normalizeLayout, parseLayout, defaultOptions, clone, type StudioLayout, type SeatTarget, type ViewMode, type ViewOptions } from "../model/schema";
import type { GuestImport } from "../model/exchange";
export interface Timeline { past: StudioLayout[]; present: StudioLayout; future: StudioLayout[]; message: string; revision: number }
export type HistoryAction = {type:"commit";label:string;update:(s:StudioLayout)=>StudioLayout}|{type:"undo"}|{type:"redo"}|{type:"notice";message:string};
export function historyReducer(h:Timeline,action:HistoryAction):Timeline {
  if(action.type==="notice")return {...h,message:action.message};
  if(action.type==="undo"){const previous=h.past.at(-1);return previous?{past:h.past.slice(0,-1),present:previous,future:[h.present,...h.future],message:"Undone",revision:h.revision+1}:h;}
  if(action.type==="redo"){const [next,...future]=h.future;return next?{past:[...h.past,h.present].slice(-60),present:next,future,message:"Redone",revision:h.revision+1}:h;}
  try{
    const next=normalizeLayout(action.update(clone(h.present)));
    if(JSON.stringify(next)===JSON.stringify(h.present))return {...h,message:"No change needed."};
    return {past:[...h.past,h.present].slice(-60),present:next,future:[],message:action.label,revision:h.revision+1};
  }catch(cause){return {...h,message:cause instanceof Error?cause.message:"Unable to apply change."};}
}
const STORAGE="tongter:glass-house-react:v1";
function initial():Timeline {
  let present=defaultLayout(),message="Import a saved layout or site guests to begin. No private guest data is bundled.";
  try{const raw=localStorage.getItem(STORAGE);if(raw){present=parseLayout(raw);message="Restored the browser draft.";}}catch{message="Saved draft could not be read. Import a JSON backup; the old storage entry is left untouched.";}
  return {past:[],present,future:[],message,revision:0};
}
export type StudioModal = {type:"seat";target:SeatTarget}|{type:"guest";id?:string;target?:SeatTarget}|{type:"import";data:GuestImport}|{type:"layout";layout:StudioLayout}|null;
interface StudioContextValue {
  layout:StudioLayout; notice:string; revision:number; saved:string; selected:string|null; setSelected:(id:string|null)=>void;
  view:ViewMode; setView:(v:ViewMode)=>void; options:ViewOptions; setOptions:(v:ViewOptions|((v:ViewOptions)=>ViewOptions))=>void;
  modal:StudioModal; setModal:(v:StudioModal)=>void; picked:string[]; setPicked:(v:string[]|((v:string[])=>string[]))=>void;
  commit:(label:string,update:(s:StudioLayout)=>StudioLayout)=>void; undo:()=>void; redo:()=>void; canUndo:boolean;canRedo:boolean;
  notify:(message:string)=>void;
}
const StudioContext=createContext<StudioContextValue|null>(null);
export function StudioProvider({children}:{children:ReactNode}) {
  const [history,dispatch]=useReducer(historyReducer,undefined,initial),[selected,setSelected]=useState<string|null>(null),[view,setView]=useState<ViewMode>("plan"),[options,setOptions]=useState<ViewOptions>(defaultOptions),[modal,setModal]=useState<StudioModal>(null),[picked,setPicked]=useState<string[]>([]),[saved,setSaved]=useState("Export JSON for a durable backup.");
  const writtenRevision=useRef(0);
  const commit=useCallback((label:string,update:(s:StudioLayout)=>StudioLayout)=>dispatch({type:"commit",label,update}),[]);
  const undo=useCallback(()=>dispatch({type:"undo"}),[]),redo=useCallback(()=>dispatch({type:"redo"}),[]),notify=useCallback((message:string)=>dispatch({type:"notice",message}),[]);
  useEffect(()=>{
    if(history.revision===writtenRevision.current)return;
    try{localStorage.setItem(STORAGE,JSON.stringify(history.present));writtenRevision.current=history.revision;setSaved("Saved on this device · export JSON to back up");}
    catch{setSaved("Local storage unavailable or full · export a JSON backup");}
  },[history.present,history.revision]);
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{if(e.target instanceof Element&&e.target.closest("input,select,textarea,[contenteditable=true]"))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?redo():undo();}};
    window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);
  },[undo,redo]);
  const value=useMemo(()=>({layout:history.present,notice:history.message,revision:history.revision,saved,selected,setSelected,view,setView,options,setOptions,modal,setModal,picked,setPicked,commit,undo,redo,canUndo:!!history.past.length,canRedo:!!history.future.length,notify}),[history,saved,selected,view,options,modal,picked,commit,undo,redo,notify]);
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}
export function useStudio(){const value=useContext(StudioContext);if(!value)throw Error("StudioProvider is required.");return value;}
