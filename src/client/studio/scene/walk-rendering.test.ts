import { describe, expect, it, vi } from "vitest";
import { WalkMotion } from "./walk-motion";

describe("on-demand walking render lifecycle",()=>{
  it("wakes for pointer, joystick and keyboard input, then unsubscribes cleanly",()=>{
    const motion=new WalkMotion(()=>true),wake=vi.fn(),unsubscribe=motion.subscribe(wake);
    motion.press("key","forward");motion.setAnalog("stick",1,0);motion.release("key");motion.look(20,-5);
    expect(wake).toHaveBeenCalledTimes(4);
    unsubscribe();motion.look(20,0);motion.reset();expect(wake).toHaveBeenCalledTimes(4);
  });
  it("keeps scheduling until deceleration ends, with no permanent idle loop",()=>{
    const motion=new WalkMotion(()=>true);motion.setAnalog("stick",0,1);
    for(let i=0;i<90;i++)motion.update(1/60);
    motion.release("stick");expect(motion.moving).toBe(true);
    let frames=0;while(motion.moving&&frames<300){motion.update(1/60);frames++;}
    expect(frames).toBeGreaterThan(1);expect(frames).toBeLessThan(300);expect(motion.moving).toBe(false);
    const wake=vi.fn();motion.subscribe(wake);motion.stop();motion.stop();motion.setAnalog("stick",0,0);expect(wake).not.toHaveBeenCalled();
    motion.reset();expect(wake).toHaveBeenCalledOnce();
  });
  it("stopping an active controller emits one final frame and leaves no input",()=>{
    const motion=new WalkMotion(()=>true),wake=vi.fn();motion.press("key","forward");motion.subscribe(wake);
    motion.stop();motion.stop();expect(wake).toHaveBeenCalledOnce();expect(motion.moving).toBe(false);expect(motion.held.size).toBe(0);
    motion.enabled=false;motion.press("key","forward");motion.look(30,20);motion.setAnalog("stick",1,1);expect(wake).toHaveBeenCalledOnce();
  });
});
