import { describe, expect, it } from "vitest";
import { sampleJoystick } from "./joystick";
import { WalkMotion } from "./walk-motion";

describe("analogue walk joystick",()=>{
  it("has no drift in its radial dead zone",()=>{for(const [x,y]of [[0,0],[1,-1],[4,0]]){const s=sampleJoystick(x,y,40);expect(s.right).toBe(0);expect(s.forward).toBe(0);}});
  it("maps up to forward and right to strafe",()=>{expect(sampleJoystick(0,-40,40)).toMatchObject({right:0,forward:1,knobX:0,knobY:-40});expect(sampleJoystick(40,0,40).right).toBe(1);expect(sampleJoystick(0,40,40).forward).toBe(-1);});
  it("clamps a finger outside the ring and normalizes diagonal travel",()=>{const s=sampleJoystick(400,-400,40);expect(Math.hypot(s.knobX,s.knobY)).toBeCloseTo(40);expect(Math.hypot(s.right,s.forward)).toBeCloseTo(1);});
  it("has proportional speed between the dead zone and rim",()=>{const slow=sampleJoystick(0,-14,40),fast=sampleJoystick(0,-32,40);expect(slow.forward).toBeGreaterThan(0);expect(slow.forward).toBeLessThan(fast.forward);expect(fast.forward).toBeLessThan(1);});
  it("ignores invalid dimensions and coordinates",()=>{for(const [x,y,r]of [[NaN,0,40],[0,Infinity,40],[1,1,0],[1,1,-1]])expect(sampleJoystick(x,y,r)).toMatchObject({right:0,forward:0,knobX:0,knobY:0});});
  it("integrates partial deflection at the same frame-independent pace",()=>{const a=new WalkMotion(()=>true),b=new WalkMotion(()=>true);a.setAnalog("stick",0,.5);b.setAnalog("stick",0,.5);for(let i=0;i<60;i++)a.update(1/30);for(let i=0;i<288;i++)b.update(1/144);expect(a.x).toBeCloseTo(b.x,2);expect(a.x+11.2).toBeGreaterThan(1);expect(a.x+11.2).toBeLessThan(1.6);});
  it("combines the keyboard and joystick without faster diagonals",()=>{const a=new WalkMotion(()=>true),b=new WalkMotion(()=>true);a.press("key","forward");b.press("key","forward");b.setAnalog("stick",1,0);for(let i=0;i<120;i++){a.update(1/60);b.update(1/60);}expect(Math.hypot(a.x+11.2,a.z+1.65)).toBeCloseTo(Math.hypot(b.x+11.2,b.z+1.65),5);});
  it("clears analogue input and stops when disabled or blurred",()=>{const m=new WalkMotion(()=>true);m.setAnalog("stick",0,1);m.update(.04);m.stop();const x=m.x;m.update(.04);expect(m.x).toBe(x);expect(m.held.size).toBe(0);m.enabled=false;m.setAnalog("stick",1,1);expect(m.held.size).toBe(0);});
  it("release clears the stick without dropping held keyboard input",()=>{const m=new WalkMotion(()=>true);m.press("key","forward");m.setAnalog("stick",1,0);m.setAnalog("stick",0,0);expect([...m.held.keys()]).toEqual(["key"]);});
});
