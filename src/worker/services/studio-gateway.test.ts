// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { defaultLayout } from "@/client/studio/model/defaults";
import { normalizeLayout, clone } from "@/client/studio/model/schema";
import { moveGuests } from "@/client/studio/model/commands";
import { mutationBetween, mutationHash } from "@/shared/studio-mutations";
import { STUDIO_GUEST_COLUMNS, STUDIO_OBJECT_COLUMNS } from "@/shared/studio-sheet";
import { cellRequests, createStudioGateway, type SheetRead } from "./studio-gateway";
function fixture(){
 const layout=normalizeLayout({...defaultLayout(),guestList:[{id:"test-a",name:"Test A",tableId:"table-1",seatNumber:1},{id:"test-b",name:"Test B",tableId:"table-2",seatNumber:3}]});
 const headers=["extraPrivateColumn",...STUDIO_GUEST_COLUMNS.slice().reverse()];
 const rows=[headers,...layout.guestList.slice().reverse().map(g=>headers.map(k=>k==="extraPrivateColumn"?"UNMANAGED":String((g as unknown as Record<string,unknown>)[k]??"")))];
 const read:SheetRead={snapshot:{status:"ok",source:"Google Sheets",layout,revision:"test",fetchedAt:1},ranges:[{values:[]},{values:rows},{values:[STUDIO_OBJECT_COLUMNS,...layout.items.map(t=>STUDIO_OBJECT_COLUMNS.map(k=>String((t as unknown as Record<string,unknown>)[k]??"")))]}]};
 const next=moveGuests(layout,["test-a"],{tableId:"table-2",seatNumber:3}),operation=mutationBetween(layout,next);
 const tabs=[{sheetId:11,title:"StudioGuests"},{sheetId:12,title:"StudioObjects"},{sheetId:20,title:"Guests"},{sheetId:21,title:"RSVP"}];
 return {layout,read,next,operation,tabs,headers};
}
describe("Google Sheets cell batch generation",()=>{
 it("locates rows and headers by ID and writes only the four changed placement cells",()=>{
  const f=fixture(),requests=cellRequests(f.read,f.next,f.operation,f.tabs);
  expect(requests).toHaveLength(4);
  const cells=requests as {updateCells:{start:{sheetId:number;rowIndex:number;columnIndex:number};fields:string;rows:{values:unknown[]}[]}}[];
  expect(cells.every(r=>r.updateCells.start.sheetId===11&&r.updateCells.fields==="userEnteredValue")).toBe(true);
  expect(new Set(cells.map(r=>r.updateCells.start.columnIndex))).toEqual(new Set([f.headers.indexOf("tableId"),f.headers.indexOf("seatNumber")]));
  expect(new Set(cells.map(r=>r.updateCells.start.rowIndex))).toEqual(new Set([1,2]));
  expect(JSON.stringify(requests)).not.toContain("UNMANAGED");
 });
 it("unassignment clears cells without deleting the guest row",()=>{
  const f=fixture(),next=moveGuests(f.layout,["test-a"],{tableId:""}),op=mutationBetween(f.layout,next),requests=cellRequests(f.read,next,op,f.tabs);
  expect(requests).toHaveLength(2);expect(requests.every(r=>"updateCells" in r)).toBe(true);
  expect(requests.map(r=>(r.updateCells as {rows:{values:unknown[]}[]}).rows[0].values)).toEqual([[{}],[{}]]);
 });
 it("deletes removed guest rows in descending order, never a legacy tab",()=>{
  const f=fixture(),next=normalizeLayout({...clone(f.layout),guestList:[]}),requests=cellRequests(f.read,next,mutationBetween(f.layout,next),f.tabs);
  expect(requests).toEqual([2,1].map(row=>({deleteDimension:{range:{sheetId:11,dimension:"ROWS",startIndex:row,endIndex:row+1}}})));
 });
 it("uses literal string cells for formula-like guest input",()=>{
  const f=fixture(),next=clone(f.layout);next.guestList[0].name="=IMPORTXML(\"example\")";
  const r=cellRequests(f.read,next,mutationBetween(f.layout,next),f.tabs)[0] as {updateCells:{rows:{values:unknown[]}[]}};
  expect(r.updateCells.rows[0].values).toEqual([{userEnteredValue:{stringValue:next.guestList[0].name}}]);
 });
 it("includes both sides and the receipt in one upstream batch call",async()=>{
  const f=fixture();const calls:{url:string;body:Record<string,unknown>|null}[]=[];
  const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{const url=String(input);calls.push({url,body:init?.body?JSON.parse(String(init.body)):null});if(url.includes("?fields="))return Response.json({sheets:f.tabs.map(properties=>({properties}))});return Response.json({});});
  const gateway=createStudioGateway({spreadsheetId:"synthetic-only",getAccessToken:async()=>"test-token",fetcher,now:()=>1});
  await gateway.write(f.read,f.next,f.operation,await mutationHash(f.operation));
  const updates=calls.filter(c=>c.url.endsWith(":batchUpdate"));expect(updates).toHaveLength(1);
  const requests=updates[0].body!.requests as Record<string,unknown>[];
  expect(requests.filter(r=>"updateCells" in r)).toHaveLength(5);
  expect(requests.filter(r=>"addSheet" in r)).toHaveLength(1);
  expect(requests.filter(r=>"appendCells" in r)).toHaveLength(1);
  expect(JSON.stringify(requests.at(-1))).toContain(f.operation.id);
  expect(JSON.stringify(requests)).not.toContain("test-token");
 });
});
