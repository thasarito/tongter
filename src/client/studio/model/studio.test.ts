import { describe, expect, it } from "vitest";
import { defaultLayout } from "./defaults";
import { clone, guestSchema, normalizeLayout, occupant, parseLayout, type StudioLayout } from "./schema";
import { distributeGuests, moveGuests, removeItem, replaceSeat } from "./commands";
import { applyGuestImport, guestCsv, guestJson, parseGuestImport } from "./exchange";
import { labelLayout, wrapName } from "./labels";
import { pointInside, seats } from "./geometry";
import { historyReducer, type Timeline } from "../state/StudioProvider";
import { WalkMotion } from "../scene/walk-motion";

// Synthetic records only; never copy the private reception roster into tests.
function fixture(count=3):StudioLayout{return normalizeLayout({...defaultLayout(),guestList:Array.from({length:count},(_,i)=>guestSchema.parse({id:`test-${i}`,name:`Test Guest ${i}`,host:"Test",group:"Synthetic"}))});}
const target=(seatNumber:number,tableId="table-1")=>({tableId,seatNumber});

describe("studio project model",()=>{
  it("ships geometry but no private roster",()=>{const s=defaultLayout();expect(s.items.filter(t=>t.kind==="table")).toHaveLength(20);expect(s.items.reduce((n,t)=>n+t.seats,0)).toBe(200);expect(s.guestList).toEqual([]);});
  it("migrates legacy per-table names with seat gaps",()=>{const old=defaultLayout();old.items[0].guests=["First","","Third"];const legacy={version:2,items:old.items};const s=normalizeLayout(legacy);expect(s.guestList.map(g=>g.seatNumber)).toEqual([1,3]);expect(s.items[0].guests[1]).toBe("");});
  it("preserves explicit seat numbers through layout JSON",()=>{const s=moveGuests(fixture(),["test-0"],target(7));expect(parseLayout(JSON.stringify(s))).toEqual(s);});
  it("does not mutate input during a move or swap",()=>{const s=fixture(),before=clone(s);moveGuests(s,["test-0"],target(7));expect(s).toEqual(before);});
  it("swaps both people atomically across tables",()=>{let s=moveGuests(fixture(),["test-0"],target(7));s=moveGuests(s,["test-1"],target(2,"table-2"));const n=moveGuests(s,["test-1"],target(7));expect(occupant(n,target(7))?.id).toBe("test-1");expect(occupant(n,target(2,"table-2"))?.id).toBe("test-0");});
  it("rejects displacement by an unassigned guest, but explicit replacement retains both records",()=>{const s=moveGuests(fixture(),["test-0"],target(7));expect(()=>moveGuests(s,["test-1"],target(7))).toThrow(/occupied/);const n=replaceSeat(s,"test-1",target(7));expect(n.guestList).toHaveLength(3);expect(n.guestList[0].tableId).toBe("");expect(occupant(n,target(7))?.id).toBe("test-1");});
  it("rejects an over-capacity bulk move without a partial assignment",()=>{const s=fixture(11),before=clone(s);expect(()=>moveGuests(s,s.guestList.map(g=>g.id),{tableId:"table-1"})).toThrow(/full/);expect(s).toEqual(before);});
  it("keeps existing same-table seats during group placement",()=>{const s=moveGuests(fixture(),["test-0"],target(7));const n=moveGuests(s,["test-0","test-1"],{tableId:"table-1"});expect(occupant(n,target(7))?.id).toBe("test-0");expect(occupant(n,target(1))?.id).toBe("test-1");});
  it("blocks reserve and declined seating",()=>{const s=fixture();s.guestList[0].reserve=true;s.guestList[1].rsvp="Declined";expect(()=>moveGuests(s,["test-0"],target(1))).toThrow(/reserve/);expect(()=>moveGuests(s,["test-1"],target(1))).toThrow(/declined/);});
  it("splits groups in the chosen destination order",()=>{const s=fixture(12),n=distributeGuests(s,s.guestList.map(g=>g.id),["table-2","table-1"]);expect(n.guestList[0].tableId).toBe("table-2");expect(n.guestList[10].tableId).toBe("table-1");expect(n.guestList[10].seatNumber).toBe(1);});
  it("deleting a table returns guests to unassigned",()=>{const s=moveGuests(fixture(),["test-0"],target(7)),n=removeItem(s,"table-1");expect(n.guestList).toHaveLength(3);expect(n.guestList[0].tableId).toBe("");expect(n.guestList[0].seatNumber).toBeNull();});
  it("rejects reduced capacity, duplicated IDs, duplicate seats and nonfinite coordinates",()=>{let s=moveGuests(fixture(),["test-0"],target(7));s.items[0].seats=6;expect(()=>normalizeLayout(s)).toThrow(/capacity/);s=fixture();s.guestList[1].id=s.guestList[0].id;expect(()=>normalizeLayout(s)).toThrow(/Duplicate guest/);s=moveGuests(fixture(),["test-0"],target(7));s.guestList[1].tableId="table-1";s.guestList[1].seatNumber=7;expect(()=>normalizeLayout(s)).toThrow(/twice/);s=fixture();s.items[0].x=NaN;expect(()=>normalizeLayout(s)).toThrow();});
  it("undo and redo retain both members of an exact-seat swap",()=>{let s=moveGuests(fixture(),["test-0"],target(1));s=moveGuests(s,["test-1"],target(2));const h:Timeline={past:[],future:[],present:s,message:"",revision:0};const next=historyReducer(h,{type:"commit",label:"swap",update:draft=>moveGuests(draft,["test-1"],target(1))});expect(historyReducer(next,{type:"undo"}).present).toEqual(s);expect(historyReducer(historyReducer(next,{type:"undo"}),{type:"redo"}).present).toEqual(next.present);});
  it("a rejected transaction does not add a history entry",()=>{const s=fixture(),h:Timeline={past:[],future:[],present:s,message:"",revision:0},n=historyReducer(h,{type:"commit",label:"bad",update:draft=>moveGuests(draft,["test-0"],target(99))});expect(n.present).toBe(s);expect(n.past).toEqual([]);expect(n.revision).toBe(0);});
});

describe("CSV and site roster compatibility",()=>{
  it("round-trips Thai text, formulas, multiline notes and exact seats",()=>{const s=moveGuests(fixture(),["test-0"],target(7));s.guestList[0].name="ทดสอบ ผู้ร่วมงาน";s.guestList[0].notes='=formula, "quoted"\nsecond line';const n=applyGuestImport(fixture(),parseGuestImport(guestCsv(s),"guests.csv"),"replace").layout;expect(n.guestList).toEqual(s.guestList);expect(guestCsv(s)).toContain("apostrophe-v1");});
  it("round-trips guest JSON",()=>{const s=moveGuests(fixture(),["test-0"],target(4));expect(applyGuestImport(fixture(),parseGuestImport(guestJson(s),"guests.json"),"replace").layout.guestList).toEqual(s.guestList);});
  it("merges read-only site updates without erasing draft seats",()=>{const s=moveGuests(fixture(),["test-0"],target(7)),data={format:"glass-house-guest-tables",version:1,guests:[{id:"test-0",name:"Updated name",sourceTableId:"site-table-9",sourceSeatNumber:3}]};const n=applyGuestImport(s,parseGuestImport(JSON.stringify(data),"site.json"),"merge").layout;expect(n.guestList).toHaveLength(3);expect(occupant(n,target(7))?.name).toBe("Updated name");expect(n.guestList[0].sourceSeatNumber).toBe(3);});
  it("legacy ten-table placements remain separate source references",()=>{const n=applyGuestImport(fixture(),parseGuestImport(JSON.stringify([{id:"legacy-1",name:"Legacy Test",tableId:"L4",seatNumber:24}]),"old.json"),"merge").layout.guestList.at(-1)!;expect(n.tableId).toBe("");expect(n.sourceTableId).toBe("L4");expect(n.sourceSeatNumber).toBe(24);});
  it("retains unmatched table references without silently mapping them",()=>{const p=parseGuestImport('id,name,table,seat\nx,Test,Unknown room,2',"test.csv"),result=applyGuestImport(fixture(),p,"merge");expect(result.warnings).toHaveLength(1);expect(result.layout.guestList.at(-1)?.unmappedTableLabel).toBe("Unknown room");});
  it("rejects malformed CSV and duplicate import IDs",()=>{expect(()=>parseGuestImport('id,name\nx,"open quote',"bad.csv")).toThrow(/Unclosed/);const p=parseGuestImport('id,name\nx,First\nx,Second',"duplicate.csv");expect(()=>applyGuestImport(fixture(),p,"merge")).toThrow(/Duplicate guest/);});
});

describe("label geometry and walking",()=>{
  it("retains exact numbered chairs under table rotation",()=>{const t={...defaultLayout().items[0],x:5,z:6,rotation:90};const p=seats(t)[0];expect(p.number).toBe(1);expect(p.world[0]).toBeCloseTo(5);expect(p.world[1]).toBeCloseTo(7.31);});
  // Updated requirement: fixed on-seat names replace the former displaced packing.
  it("keeps every name centered on its assigned seat without number prefixes",()=>{let s=fixture(200);s.guestList.forEach((g,i)=>{g.tableId=`table-${Math.floor(i/10)+1}`;g.seatNumber=i%10+1;g.name=`Synthetic guest ${i} · ทดสอบ`;});s=normalizeLayout(s);const labels=labelLayout(s,t=>Array.from(t).length*.1);expect(labels).toHaveLength(200);for(const label of labels){const t=s.items.find(t=>t.id===label.tableId)!,p=seats(t)[label.seatNumber-1],g=s.guestList.find(g=>g.id===label.guestId)!;expect(label.x+label.w/2).toBeCloseTo(p.world[0]);expect(label.y+label.h/2).toBeCloseTo(p.world[1]);expect(label.lines.join("").replace(/\s/g,"")).toBe(g.name.replace(/\s/g,""));}});
  it("wraps rather than truncates long Unicode names",()=>{const name="ทดสอบชื่อผู้ร่วมงานยาวมาก ABCDEFGHIJKLMNOPQRSTUVWXYZ";expect(wrapName(name,1.2,s=>Array.from(s).length*.1).join("").replace(/\s/g,"")).toBe(name.replace(/\s/g,""));});
  it("excludes the courtyard notch from walking space",()=>{expect(pointInside(-11.5,2)).toBe(false);expect(pointInside(0,0)).toBe(true);expect(pointInside(0,-8)).toBe(true);});
  it("travels at the same pace at 30 and 144 frames per second",()=>{const a=new WalkMotion(()=>true),b=new WalkMotion(()=>true);a.press("w","forward");b.press("w","forward");for(let i=0;i<60;i++)a.update(1/30);for(let i=0;i<288;i++)b.update(1/144);expect(a.x).toBeCloseTo(b.x,2);});
  it("normalizes diagonal walking and clears held keys on stop",()=>{const a=new WalkMotion(()=>true),b=new WalkMotion(()=>true);a.press("w","forward");b.press("w","forward");b.press("d","right");for(let i=0;i<60;i++){a.update(1/60);b.update(1/60);}expect(Math.hypot(b.x+11.2,b.z+1.65)).toBeCloseTo(a.x+11.2,2);b.stop();const x=b.x,z=b.z;b.update(1/60);expect([b.x,b.z,b.held.size]).toEqual([x,z,0]);});
});
