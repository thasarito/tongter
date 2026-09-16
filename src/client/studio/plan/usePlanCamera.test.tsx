import type { PointerEvent as ReactPointerEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, renderHook, screen } from "@testing-library/react";
import { applyMutation, type StudioMutation } from "@/shared/studio-mutations";
import type { StudioSheetSnapshot } from "@/shared/studio-sheet";
import { defaultLayout } from "../model/defaults";
import { clone } from "../model/schema";
import { StudioProvider, useStudio } from "../state/StudioProvider";
import { usePlanCamera } from "./usePlanCamera";

const approve = () => fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
const event = (x: number, y: number) => ({
  button: 0, pointerId: 1, clientX: x, clientY: y, stopPropagation() {},
} as ReactPointerEvent<SVGSVGElement>);
function mount() {
  const view = renderHook(() => ({ studio: useStudio(), plan: usePlanCamera() }), { wrapper: StudioProvider });
  let sheet = defaultLayout();
  sheet.items = sheet.items.map(item => ({ ...item, x: 0, z: 0 }));
  const requests: { operation: StudioMutation; resolve: (value: StudioSheetSnapshot) => void }[] = [];
  act(() => {
    view.result.current.studio.hydrate(sheet);
    view.result.current.studio.connect(operation => new Promise<StudioSheetSnapshot>(resolve => requests.push({ operation, resolve })));
  });
  const captured = new Set<number>(), svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  Object.assign(svg, {
    getScreenCTM: () => ({ inverse: () => ({}) }),
    setPointerCapture: (id: number) => { captured.add(id); },
    hasPointerCapture: (id: number) => captured.has(id),
    releasePointerCapture: (id: number) => { captured.delete(id); },
  });
  view.result.current.plan.svg.current = svg;
  const begin = () => act(() => {
    const item = view.result.current.studio.layout.items.find(item => item.id === "table-2")!;
    view.result.current.plan.begin(event(0, 0), item);
    view.result.current.plan.move(event(3, 4));
  });
  return {
    ...view, requests, begin, captured,
    async confirm(index: number) {
      sheet = applyMutation(sheet, requests[index].operation);
      await act(async () => requests[index].resolve({ status: "ok", source: "Google Sheets", revision: String(index), fetchedAt: 1, layout: clone(sheet) }));
    },
  };
}
beforeEach(() => {
  localStorage.clear();
  // Identity projection lets the hook test pointer lifecycle without a browser SVG engine.
  vi.stubGlobal("DOMPoint", class {
    constructor(public x: number, public y: number) {}
    matrixTransform() { return this; }
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("table dragging during sheet synchronization", () => {
  it("finishes the second table drag when the first save completes mid-gesture", async () => {
    const view = mount();
    act(() => view.result.current.studio.commit("Move first", layout => ({ ...layout, items: layout.items.map(item => item.id === "table-1" ? { ...item, x: 1 } : item) })));
    approve();
    view.begin();
    expect(view.result.current.plan.preview).toMatchObject({ id: "table-2", x: 3, z: 4 });
    await view.confirm(0);
    expect(view.result.current.plan.preview).toMatchObject({ id: "table-2", x: 3, z: 4 });
    act(() => view.result.current.plan.finish(event(3, 4)));
    approve();
    expect(view.requests).toHaveLength(2);
    await view.confirm(1);
    expect(view.result.current.studio.layout.items.find(item => item.id === "table-2")).toMatchObject({ x: 3, z: 4 });
  });

  it("keeps a drag preview when a different object changes in a sheet refresh", () => {
    const view = mount();
    view.begin();
    const layout = clone(view.result.current.studio.layout);
    layout.items[0].x = 7;
    act(() => view.result.current.studio.hydrate(layout));
    expect(view.result.current.plan.preview).toMatchObject({ id: "table-2", x: 3, z: 4 });
    act(() => view.result.current.plan.finish(event(3, 4)));
    approve();
    expect(view.result.current.studio.layout.items[0].x).toBe(7);
    expect(view.result.current.studio.layout.items[1]).toMatchObject({ x: 3, z: 4 });
    expect(view.requests).toHaveLength(1);
  });

  it.each(["move", "lock", "delete"] as const)("cancels safely when a collaborator applies %s to the dragged table", change => {
    const view = mount();
    view.begin();
    const layout = clone(view.result.current.studio.layout);
    if (change === "move") layout.items[1].x = 9;
    if (change === "lock") layout.items[1].locked = true;
    if (change === "delete") layout.items = layout.items.filter(item => item.id !== "table-2");
    act(() => view.result.current.studio.hydrate(layout));
    expect(view.result.current.plan.preview).toBeNull();
    expect(view.captured.size).toBe(0);
    act(() => view.result.current.plan.finish(event(3, 4)));
    expect(view.requests).toHaveLength(0);
  });

  it("rechecks the dragged item at commit even before the refresh effect runs", () => {
    const view = mount();
    view.begin();
    const layout = clone(view.result.current.studio.layout);
    layout.items[1].x = 9;
    act(() => {
      view.result.current.studio.hydrate(layout);
      view.result.current.plan.finish(event(3, 4));
    });
    expect(view.result.current.studio.layout.items[1].x).toBe(9);
    expect(view.requests).toHaveLength(0);
  });
});
