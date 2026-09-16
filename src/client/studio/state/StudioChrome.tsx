import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type StudioPanel = "layout" | "guests" | "selected" | "layers";
interface Chrome {
  tab: StudioPanel;
  open: boolean;
  selectPanel: (tab: StudioPanel) => void;
  togglePanel: (tab: StudioPanel) => void;
  closePanel: () => void;
}
const ChromeContext = createContext<Chrome | null>(null);

/** Transient UI state only. Opening a panel never mutates the sheet or camera. */
export function StudioChromeProvider({children}: {children: ReactNode}) {
  const [panel, setPanel] = useState<{tab: StudioPanel; open: boolean}>({tab:"layout",open:false});
  const selectPanel = useCallback((tab: StudioPanel) => setPanel({tab,open:true}), []);
  const togglePanel = useCallback((tab: StudioPanel) => setPanel(p => ({tab,open:p.tab!==tab || !p.open})), []);
  const closePanel = useCallback(() => {
    const sidebar = document.querySelector(".studio-sidebar");
    if (sidebar?.contains(document.activeElement)) {
      document.querySelector<HTMLButtonElement>('.studio-panel-dock button[aria-expanded="true"]')?.focus({preventScroll:true});
    }
    setPanel(p => p.open ? {...p,open:false} : p);
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) closePanel();
    };
    document.addEventListener("keydown",key);
    return () => document.removeEventListener("keydown",key);
  }, [closePanel]);
  const value = useMemo(() => ({...panel,selectPanel,togglePanel,closePanel}), [panel,selectPanel,togglePanel,closePanel]);
  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}
export function useStudioChrome() {
  const value = useContext(ChromeContext);
  if (!value) throw Error("Studio chrome provider is missing.");
  return value;
}

/** Lock only the document behind the studio; tool sheets retain native scrolling.
 * Restore every changed inline value and the previous page position on route exit. */
export function useStudioScrollLock() {
  useEffect(() => {
    const html = document.documentElement, body = document.body;
    const x = window.scrollX, y = window.scrollY;
    const original = {htmlOverflow:html.style.overflow,htmlOverscroll:html.style.overscrollBehavior,
      overflow:body.style.overflow,position:body.style.position,top:body.style.top,width:body.style.width};
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.width = "100%";
    return () => {
      html.style.overflow = original.htmlOverflow;
      html.style.overscrollBehavior = original.htmlOverscroll;
      Object.assign(body.style,{overflow:original.overflow,position:original.position,top:original.top,width:original.width});
      window.scrollTo(x,y);
    };
  }, []);
}
