import { describe, expect, it, vi } from "vitest";
import { ViewportActions } from "./viewport-actions";
describe("bottom-panel viewport commands",()=>{
 it("routes actions to the currently mounted view",()=>{const bus=new ViewportActions(),zoom=vi.fn();expect(bus.run("zoom-in")).toBe(false);const clean=bus.register({"zoom-in":zoom});expect(bus.run("zoom-in")).toBe(true);expect(zoom).toHaveBeenCalledOnce();clean();expect(bus.run("zoom-in")).toBe(false);});
 it("old view cleanup cannot unregister a new view",()=>{const bus=new ViewportActions(),old=vi.fn(),next=vi.fn();const clean=bus.register({fit:old});bus.register({fit:next});clean();bus.run("fit");expect(next).toHaveBeenCalledOnce();expect(old).not.toHaveBeenCalled();});
 it("camera handlers and exports register independently",()=>{const bus=new ViewportActions(),fit=vi.fn(),png=vi.fn();const clean=bus.register({fit});bus.register({png});clean();expect(bus.run("fit")).toBe(false);expect(bus.run("png")).toBe(true);expect(png).toHaveBeenCalledOnce();});
});
