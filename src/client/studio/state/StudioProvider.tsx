import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { applyMutation, inverseMutation, mutationBetween, mutationSchema, same, StudioConflict, type StudioMutation } from "@/shared/studio-mutations";
import type { StudioSheetSnapshot } from "@/shared/studio-sheet";
import { defaultLayout } from "../model/defaults";
import { normalizeLayout, defaultOptions, clone, type StudioLayout, type SeatTarget, type ViewMode, type ViewOptions } from "../model/schema";
import type { GuestImport } from "../model/exchange";
import { SheetSaveError } from "./sheet-source";
import { summarizeSheetMutation, summarizeSheetRetry, type SheetActionSummary } from "../model/sheet-action-summary";
import { SheetConfirmationGate, type SheetConfirmation } from "./sheet-confirmation";
import { SheetActionDialog } from "../components/SheetActionDialog";
export interface Timeline {past:StudioMutation[];present:StudioLayout;future:StudioMutation[];message:string;revision:number}
export type HistoryAction={type:"commit";label:string;update:(s:StudioLayout)=>StudioLayout}|{type:"undo"}|{type:"redo"}|{type:"notice";message:string}|{type:"hydrate";layout:StudioLayout};
export function historyReducer(h:Timeline,a:HistoryAction):Timeline {
  if(a.type==="notice")return {...h,message:a.message};
  if(a.type==="hydrate")return {...h,present:normalizeLayout(a.layout),revision:h.revision+1};
  try{
    if(a.type==="undo"){const op=h.past.at(-1);return op?{...h,past:h.past.slice(0,-1),present:applyMutation(h.present,inverseMutation(op)),future:[op,...h.future],revision:h.revision+1,message:"Undo applied"}:h;}
    if(a.type==="redo"){const [op,...future]=h.future;return op?{...h,past:[...h.past,op].slice(-60),present:applyMutation(h.present,{...op,id:crypto.randomUUID()}),future,revision:h.revision+1,message:"Redo applied"}:h;}
    const present=normalizeLayout(a.update(clone(h.present))),operation=mutationBetween(h.present,present);
    if(!operation.changes.length)return {...h,message:"No change needed."};
    return {past:[...h.past,operation].slice(-60),present,future:[],message:a.label,revision:h.revision+1};
  }catch(cause){return {...h,message:cause instanceof Error?cause.message:"Unable to apply change."};}
}
export type StudioModal={type:"seat";target:SeatTarget}|{type:"guest";id?:string;target?:SeatTarget}|{type:"import";data:GuestImport}|null;
type Saver=(operation:StudioMutation)=>Promise<StudioSheetSnapshot>;
const PENDING_KEY="tongter:studio:pending-v2";
const LEGACY_PENDING_KEY="tongter:studio:pending-v1";
function readPendingQueue():StudioMutation[] {
  const raw=localStorage.getItem(PENDING_KEY);
  if(!raw){const legacy=localStorage.getItem(LEGACY_PENDING_KEY);return legacy?[mutationSchema.parse(JSON.parse(legacy))]:[];}
  const value:unknown=JSON.parse(raw);
  if(!value||typeof value!=="object"||!("version" in value)||value.version!==2||!("operations" in value)||!Array.isArray(value.operations))throw Error("Invalid saved queue.");
  const operations=value.operations.map((operation:unknown)=>mutationSchema.parse(operation));
  if(new Set(operations.map(operation=>operation.id)).size!==operations.length)throw Error("Duplicate saved operation IDs.");
  return operations;
}
interface StudioContextValue {
  layout:StudioLayout;notice:string;revision:number;saved:string;selected:string|null;setSelected:(id:string|null)=>void;
  view:ViewMode;setView:(v:ViewMode)=>void;options:ViewOptions;setOptions:(v:ViewOptions|((v:ViewOptions)=>ViewOptions))=>void;
  modal:StudioModal;setModal:(v:StudioModal)=>void;picked:string[];setPicked:(v:string[]|((v:string[])=>string[]))=>void;
  commit:(label:string,update:(s:StudioLayout)=>StudioLayout,onConfirmed?:(layout:StudioLayout)=>void)=>void;undo:()=>void;redo:()=>void;canUndo:boolean;canRedo:boolean;notify:(message:string)=>void;
  reviewing:boolean;isReviewing:()=>boolean;reviewSheetAction:(summary:SheetActionSummary,execute:()=>void)=>void;
  hydrate:(layout:StudioLayout)=>void;connect:(save:Saver)=>void;retry:()=>void;busy:boolean;pending:boolean;pendingCount:number;editable:boolean;syncError:string;
}
const StudioContext=createContext<StudioContextValue|null>(null);
export function StudioProvider({children}:{children:ReactNode}){
  const [history,setHistory]=useState<Timeline>(()=>({past:[],future:[],present:defaultLayout(),message:"Loading Google Sheets…",revision:0}));
  const [review,setReview]=useState<SheetConfirmation|null>(null),[approval]=useState(()=>new SheetConfirmationGate(setReview));
  const latest=useRef(history),saver=useRef<Saver|null>(null),queue=useRef<StudioMutation[]>([]),inflight=useRef(false),paused=useRef(false),mounted=useRef(true),recovered=useRef(false),restoringRef=useRef(false);
  const [connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[pendingCount,setPendingCount]=useState(0),[syncError,setSyncError]=useState(""),[restoring,setRestoring]=useState(false);
  const [selected,setSelected]=useState<string|null>(null),[view,setView]=useState<ViewMode>("plan"),[options,setOptions]=useState<ViewOptions>(defaultOptions),[modal,setModal]=useState<StudioModal>(null),[picked,setPicked]=useState<string[]>([]);
  const publish=useCallback((value:Timeline)=>{latest.current=value;if(mounted.current)setHistory(value);},[]);
  const notify=useCallback((message:string)=>publish({...latest.current,message}),[publish]);
  const isReviewing=useCallback(()=>!!approval.current,[approval]);
  const reviewSheetAction=useCallback((summary:SheetActionSummary,execute:()=>void)=>{
    if(!approval.request(summary,execute))notify("Finish reviewing the current action first.");
  },[approval,notify]);
  const persistQueue=useCallback(()=>{
    setPendingCount(queue.current.length);
    try{
      if(queue.current.length)localStorage.setItem(PENDING_KEY,JSON.stringify({version:2,operations:queue.current}));
      else localStorage.removeItem(PENDING_KEY);
      // Do not remove the old journal until the replacement was successfully persisted.
      localStorage.removeItem(LEGACY_PENDING_KEY);
    }catch{notify("Keep this tab open until all changes are saved; local recovery storage is unavailable.");}
  },[notify]);
  const reconcile=useCallback((snapshot:StudioSheetSnapshot,rejection?:string)=>{
    let present=normalizeLayout(snapshot.layout);
    const remaining:StudioMutation[]=[],conflicts:string[]=rejection?[rejection]:[];
    // The head is confirmed (or definitively rejected). Read the CURRENT tail, not
    // a pre-request snapshot: further edits can arrive while the save is awaiting Sheets.
    for(const operation of queue.current.slice(1)){
      try{present=applyMutation(present,operation);remaining.push(operation);}
      catch(cause){if(!(cause instanceof StudioConflict))throw cause;conflicts.push(cause.message);}
    }
    const before=latest.current,changed=!same(before.present,present);
    const warning=conflicts.length?`${conflicts.length} change(s) were not saved: ${conflicts[0]} Independent queued edits were kept. Undo history was reset to avoid restoring a conflicting edit.`:"";
    queue.current=remaining;
    restoringRef.current=false;setRestoring(false);
    // An ordinary acknowledgement changes sync status, not document identity.
    // Keeping the layout reference/revision avoids cancelling the next active drag.
    publish({...before,present:changed?present:before.present,revision:before.revision+(changed?1:0),
      ...(warning?{past:[],future:[]}:{}),
      message:warning||(remaining.length?"Changes queued · you can keep editing.":"Saved to Google Sheets.")});
    if(warning)setSyncError(warning);
    persistQueue();
  },[publish,persistQueue]);
  const run=useCallback(async()=>{
    const write=saver.current;if(!queue.current.length||!write||inflight.current||paused.current||!mounted.current)return;
    inflight.current=true;setBusy(true);setSyncError("");
    try{
      // Exactly one request is in flight. Never rewrite a submitted operation or its
      // ID: an unacknowledged write may already have committed on the server.
      while(queue.current.length&&mounted.current){
        const operation=queue.current[0];let snapshot:StudioSheetSnapshot,rejection:string|undefined;
        try{snapshot=await write(operation);}
        catch(cause){
          if(!mounted.current)return;
          if(cause instanceof SheetSaveError&&cause.snapshot){snapshot=cause.snapshot;rejection=cause.message;}
          else{paused.current=true;setSyncError(cause instanceof Error?cause.message:"Save not confirmed. Retry uses the same operation ID.");break;}
        }
        if(!mounted.current)return;
        try{reconcile(snapshot,rejection);}
        catch(cause){paused.current=true;setSyncError(cause instanceof Error?cause.message:"Unable to reconcile the sheet response. Pending edits were kept.");break;}
      }
    }finally{inflight.current=false;if(mounted.current)setBusy(false);}
  },[reconcile]);
  const hydrate=useCallback((layout:StudioLayout)=>{if(queue.current.length)return;publish(historyReducer(latest.current,{type:"hydrate",layout}));},[publish]);
  const connect=useCallback((write:Saver)=>{
    saver.current=write;setConnected(true);
    if(!recovered.current){
      recovered.current=true;
      try{
        queue.current=readPendingQueue();
        if(queue.current.length){
          // On reload only, confirm the journal head's receipt before projecting its
          // tail: the freshly loaded sheet may already contain that first operation.
          restoringRef.current=true;setRestoring(true);persistQueue();void run();
        }
      }catch{setSyncError("The stored pending queue is invalid or unavailable. It was not sent to Sheets.");}
    }
  },[persistQueue,run]);
  const perform=useCallback((action:HistoryAction,onConfirmed?:(layout:StudioLayout)=>void)=>{
    if(approval.current){notify("Finish reviewing the current action first.");return;}
    if(!saver.current||restoringRef.current){notify(restoringRef.current?"Confirming the previous session's pending edits before resuming.":"Wait for the sheet connection before editing.");return;}
    const before=latest.current,after=historyReducer(before,action);
    if(after.revision===before.revision){publish(after);return;}
    try{
      const operation=mutationBetween(before.present,after.present);if(!operation.changes.length){publish(after);return;}
      const intent=action.type==="undo"||action.type==="redo"?action.type:"commit",label=action.type==="commit"?action.label:"";
      const summary=summarizeSheetMutation(before.present,operation,intent,label);
      reviewSheetAction(summary,()=>{
        if(!mounted.current||!saver.current||restoringRef.current)throw Error("The sheet connection changed while you reviewed this action.");
        const current=latest.current;
        if(!same(current.past,before.past)||!same(current.future,before.future))throw Error("Earlier saves changed the undo history while you were reviewing.");
        // Apply the exact reviewed mutation, never rerun an updater that might
        // pick a different seat, regenerate IDs or restore a stale whole layout.
        const present=applyMutation(current.present,operation);
        const refreshed=summarizeSheetMutation(current.present,mutationBetween(current.present,present,operation.id),intent,label);
        if(!same(summary,refreshed))throw Error("The action details changed while you were reviewing.");
        queue.current.push(operation);
        publish({...after,present,revision:current.revision+1});persistQueue();void run();
        try{onConfirmed?.(present);}catch{notify("The change was queued, but the editor could not update its selection.");}
      });
    }catch(cause){notify(cause instanceof Error?cause.message:"Unable to prepare the save.");}
  },[approval,reviewSheetAction,notify,publish,persistQueue,run]);
  const commit=useCallback((label:string,update:(s:StudioLayout)=>StudioLayout,onConfirmed?:(layout:StudioLayout)=>void)=>perform({type:"commit",label,update},onConfirmed),[perform]);
  const undo=useCallback(()=>perform({type:"undo"}),[perform]),redo=useCallback(()=>perform({type:"redo"}),[perform]);
  const resume=useCallback(()=>{paused.current=false;void run();},[run]);
  const retry=useCallback(()=>{
    if(!queue.current.length||inflight.current)return;
    const operations=queue.current.slice();
    reviewSheetAction(summarizeSheetRetry(latest.current.present,operations),()=>{
      if(!same(operations,queue.current))throw Error("The pending saves changed while you were reviewing.");
      resume();
    });
  },[reviewSheetAction,resume]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{if(e.target instanceof Element&&e.target.closest("input,select,textarea,[contenteditable=true]"))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();if(e.shiftKey)redo();else undo();}};
    const leave=(e:BeforeUnloadEvent)=>{if(queue.current.length){e.preventDefault();e.returnValue="";}};
    const online=()=>{if(queue.current.length)resume();};window.addEventListener("keydown",key);window.addEventListener("beforeunload",leave);window.addEventListener("online",online);
    return()=>{window.removeEventListener("keydown",key);window.removeEventListener("beforeunload",leave);window.removeEventListener("online",online);};
  },[undo,redo,resume]);
  const pending=pendingCount>0,reviewing=!!review,editable=connected&&!restoring&&!reviewing;
  const saved=restoring?"Confirming recovered edits…":pending?(busy?`Saving to Google Sheets · ${pendingCount} pending · keep editing`: `${pendingCount} changes pending · retry available · keep editing`):connected?"Google Sheets · automatic saving":"Connecting to Google Sheets…";
  const value=useMemo(()=>({layout:history.present,notice:history.message,revision:history.revision,saved,selected,setSelected,view,setView,options,setOptions,modal,setModal,picked,setPicked,commit,undo,redo,canUndo:editable&&!!history.past.length,canRedo:editable&&!!history.future.length,notify,hydrate,connect,retry,busy,pending,pendingCount,editable,syncError,reviewing,isReviewing,reviewSheetAction}),[history,saved,selected,view,options,modal,picked,commit,undo,redo,notify,hydrate,connect,retry,busy,pending,pendingCount,editable,syncError,reviewing,isReviewing,reviewSheetAction]);
  return <StudioContext.Provider value={value}>{children}{review&&<SheetActionDialog key={review.id} review={review} onConfirm={id=>approval.confirm(id)} onCancel={id=>approval.cancel(id)}/>}</StudioContext.Provider>;
}
export function useStudio(){const value=useContext(StudioContext);if(!value)throw Error("StudioProvider is required.");return value;}
