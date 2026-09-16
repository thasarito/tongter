/** Preserve the source sheet's reading position around a captured guest drag.
 * Pointer cancellation/focus restoration can otherwise scroll a still-focused
 * search field into view even though the panel was never unmounted. */
export function rememberPanelScroll(handle:Element):()=>void {
  const panel=handle.closest<HTMLElement>(".studio-sidebar-scroll");
  if(!panel)return()=>{};
  const top=panel.scrollTop,left=panel.scrollLeft;
  return()=>{if(panel.isConnected){panel.scrollTop=top;panel.scrollLeft=left;}};
}
