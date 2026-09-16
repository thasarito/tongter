// @vitest-environment node
import { describe, expect, it } from "vitest";
import { defaultLayout } from "@/client/studio/model/defaults";
import { guestSchema } from "@/client/studio/model/schema";
import { STUDIO_GUEST_COLUMNS, STUDIO_OBJECT_COLUMNS, layoutFromStudioRanges, studioSheetSnapshot } from "./studio-sheet";
function fixture(){
  const raw=defaultLayout();raw.items[11].x=-8.4;raw.items[11].guests=["WRONG COMPACTED CACHE"];
  const guests=[guestSchema.parse({id:"test-one",name:"Synthetic A",tableId:"table-12",seatNumber:3,sourceTableId:"OLD",sourceSeatNumber:24}),guestSchema.parse({id:"test-two",name:"Synthetic B",tableId:"table-12",seatNumber:9}),guestSchema.parse({id:"test-waiting",name:"Synthetic waiting",tableId:"",seatNumber:null,reserve:true})];
  const str=(value:unknown)=>value==null?"":String(value);
  return [{values:[["key","value"],["syncStatus","complete"],["version","3"],["title","From Sheets"],["units","metres"],["guestSource",JSON.stringify({archive:"test.json",snapshot:"Test",note:"Historical"})]]},{values:[[...STUDIO_GUEST_COLUMNS],...guests.map(g=>STUDIO_GUEST_COLUMNS.map(k=>str(g[k as keyof typeof g])))]},{values:[[...STUDIO_OBJECT_COLUMNS,"guests_json"],...raw.items.map(o=>[...STUDIO_OBJECT_COLUMNS.map(k=>str(o[k as keyof typeof o])),JSON.stringify(o.guests)])]}];
}
describe("authoritative studio sheet decoding",()=>{
  it("uses current guest seats and preserves gaps, unassigned records, names and historical fields",()=>{const {layout}=layoutFromStudioRanges(fixture());expect(layout.guestList).toHaveLength(3);expect(layout.guestList.map(g=>g.seatNumber)).toEqual([3,9,null]);expect(layout.guestList[0].sourceSeatNumber).toBe(24);expect(layout.guestList[2].reserve).toBe(true);expect(layout.items[11].guests[0]).toBe("");expect(layout.items[11].guests[2]).toBe("Synthetic A");expect(layout.items[11].guests[8]).toBe("Synthetic B");expect(layout.items[11].x).toBe(-8.4);});
  it("preserves exact decimal coordinate strings and FALSE booleans",()=>{const ranges=fixture();ranges[2].values[2][4]="7.384615384615384";const {layout}=layoutFromStudioRanges(ranges);expect(layout.items[1].x).toBe(7.384615384615384);expect(layout.guestList[0].reserve).toBe(false);});
  it("fails closed while a multi-tab update is in progress",()=>{const ranges=fixture();ranges[0].values[1][1]="writing";expect(()=>layoutFromStudioRanges(ranges)).toThrow(/not complete/);});
  it("rejects partial table/seat edits instead of guessing a seat",()=>{const ranges=fixture();ranges[1].values[1][STUDIO_GUEST_COLUMNS.indexOf("seatNumber")]="";expect(()=>layoutFromStudioRanges(ranges)).toThrow(/both set/);});
  it("rejects duplicate seats and unknown current table IDs",()=>{const ranges=fixture();ranges[1].values[2][STUDIO_GUEST_COLUMNS.indexOf("seatNumber")]="3";expect(()=>layoutFromStudioRanges(ranges)).toThrow(/twice/);ranges[1].values[2][STUDIO_GUEST_COLUMNS.indexOf("tableId")]="does-not-exist";expect(()=>layoutFromStudioRanges(ranges)).toThrow(/Unknown/);});
  it("does not silently load an empty layout when headers/tabs are absent",()=>{expect(()=>layoutFromStudioRanges([])).toThrow(/missing/);const ranges=fixture();ranges[1].values[0]=["wrong"];expect(()=>layoutFromStudioRanges(ranges)).toThrow(/columns/);});
  it("strips invitation-token columns from the served layout",()=>{const ranges=fixture();ranges[1].values[0].push("token");ranges[1].values[1].push("SYNTHETIC_PRIVATE_TOKEN");expect(JSON.stringify(layoutFromStudioRanges(ranges))).not.toContain("SYNTHETIC_PRIVATE_TOKEN");});
  it("changes its content revision only when the actual sheet data changes",async()=>{const ranges=fixture();const first=await studioSheetSnapshot(ranges,1),same=await studioSheetSnapshot(ranges,2);expect(first.revision).toBe(same.revision);ranges[1].values[1][1]="Changed in Sheets";const updated=await studioSheetSnapshot(ranges,3);expect(updated.revision).not.toBe(first.revision);expect(updated.source).toBe("Google Sheets");});
});
