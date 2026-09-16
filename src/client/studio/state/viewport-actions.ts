export type ViewportAction = "zoom-in" | "zoom-out" | "fit" | "svg" | "png";
export type ViewportHandlers = Partial<Record<ViewportAction, () => void>>;
/** Commands belong to the mounted renderer, not to a second hidden toolbar.
 * No React state, layout mutation or camera remount is needed to move the UI. */
export class ViewportActions {
  private readonly handlers = new Map<ViewportAction, () => void>();
  register(actions: ViewportHandlers) {
    const entries = Object.entries(actions) as [ViewportAction, () => void][];
    for (const [key, handler] of entries) this.handlers.set(key, handler);
    return () => { for (const [key, handler] of entries) if (this.handlers.get(key) === handler) this.handlers.delete(key); };
  }
  run(action: ViewportAction) { const handler = this.handlers.get(action); if (!handler) return false; handler(); return true; }
}
