import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ViewportActions, type ViewportHandlers } from "./viewport-actions";
export type StudioPanel = "layout" | "guests" | "view" | "selected" | "more";
interface Chrome {
  tab: StudioPanel; open: boolean; viewport: ViewportActions;
  selectPanel: (tab: StudioPanel) => void; togglePanel: (tab: StudioPanel) => void; closePanel: () => void;
}
const ChromeContext = createContext<Chrome | null>(null);
export function StudioChromeProvider({children}: {children: ReactNode}) {
  const [panel,setPanel] = useState<{tab:StudioPanel;open:boolean}>({tab:"layout",open:false});
  const [viewport] = useState(()=>new ViewportActions());
  const selectPanel = useCallback((tab:StudioPanel)=>setPanel({tab,open:true}),[]);
  const togglePanel = useCallback((tab:StudioPanel)=>setPanel(p=>({tab,open:p.tab!==tab||!p.open})),[]);
  const closePanel = useCallback(()=>{
    if(document.querySelector(".studio-sidebar")?.contains(document.activeElement))document.querySelector<HTMLButtonElement>('.studio-panel-dock button[aria-expanded="true"]')?.focus({preventScroll:true});
    setPanel(p=>p.open?{...p,open:false}:p);
  },[]);
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!document.querySelector("dialog[open]")&&!document.body.classList.contains("studio-pointer-dragging"))closePanel();};
    document.addEventListener("keydown",key);return()=>document.removeEventListener("keydown",key);
  },[closePanel]);
  const value=useMemo(()=>({...panel,viewport,selectPanel,togglePanel,closePanel}),[panel,viewport,selectPanel,togglePanel,closePanel]);
  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}
export function useStudioChrome(){const value=useContext(ChromeContext);if(!value)throw Error("Studio chrome provider is missing.");return value;}
export function useViewportActions(actions:ViewportHandlers){const {viewport}=useStudioChrome();useEffect(()=>viewport.register(actions),[viewport,actions]);}
export function useStudioScrollLock(){
  useEffect(()=>{
    const html=document.documentElement,body=document.body,x=window.scrollX,y=window.scrollY;
    const original={htmlOverflow:html.style.overflow,htmlOverscroll:html.style.overscrollBehavior,overflow:body.style.overflow,position:body.style.position,top:body.style.top,width:body.style.width};
    html.style.overflow="hidden";html.style.overscrollBehavior="none";body.style.overflow="hidden";body.style.position="fixed";body.style.top=`-${y}px`;body.style.width="100%";
    return()=>{html.style.overflow=original.htmlOverflow;html.style.overscrollBehavior=original.htmlOverscroll;Object.assign(body.style,{overflow:original.overflow,position:original.position,top:original.top,width:original.width});window.scrollTo(x,y);};
  },[]);
}
