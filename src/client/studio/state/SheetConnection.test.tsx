import { afterEach,beforeEach,describe,it,expect,vi } from "vitest";
import { act,cleanup,fireEvent,render,screen,waitFor } from "@testing-library/react";
import { defaultLayout } from "../model/defaults";
import { normalizeLayout,clone } from "../model/schema";
import { applyMutation,mutationBetween,type StudioMutation } from "@/shared/studio-mutations";
import type { StudioSheetSnapshot,StudioSheetResponse } from "@/shared/studio-sheet";
import { StudioProvider,useStudio } from "./StudioProvider";
import { SheetConnection,SheetStatus } from "./SheetConnection";
import { SheetSaveError } from "./sheet-source";
const approve=()=>fireEvent.click(screen.getByRole("button",{name:"Confirm"}));
const unauthorized=()=>{};
function snapshot(name="Current sheet guest"):StudioSheetSnapshot{return {status:"ok",source:"Google Sheets",revision:name,fetchedAt:1,layout:normalizeLayout({...defaultLayout(),guestList:[{id:"synthetic-1",name,tableId:"table-12",seatNumber:9},{id:"synthetic-2",name:"Waiting from sheet"}]})};}
function Probe(){const s=useStudio();return <><SheetStatus/><output data-testid="names">{s.layout.guestList.map(g=>g.name).join("|")}</output><output data-testid="seats">{s.layout.guestList.map(g=>g.seatNumber).join(",")}</output><button disabled={!s.editable} onClick={()=>s.commit("Name edited",v=>({...v,guestList:v.guestList.map((g,i)=>i?g:{...g,name:"Edited in studio"})}))}>Edit</button><button disabled={!s.editable} onClick={()=>s.commit("Second name edited",v=>({...v,guestList:v.guestList.map((g,i)=>i===1?{...g,name:"Second guest edited"}:g)}))}>Edit second</button><button disabled={!s.canUndo} onClick={s.undo}>Undo</button><span>{s.notice}</span></>;}
function mount(loadSheet:()=>Promise<StudioSheetResponse>,saveSheet:(op:StudioMutation)=>Promise<StudioSheetSnapshot>){return render(<StudioProvider><SheetConnection onUnauthorized={unauthorized} loadSheet={loadSheet} saveSheet={saveSheet}><Probe/></SheetConnection></StudioProvider>);}
beforeEach(()=>localStorage.clear());afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe("sheet autosave",()=>{
 it("does not show or upload a stale local draft",async()=>{localStorage.setItem("tongter:glass-house-react:v1",JSON.stringify(snapshot("Old private draft").layout));let resolve!:(v:StudioSheetSnapshot)=>void;const load=new Promise<StudioSheetSnapshot>(r=>{resolve=r;}),save=vi.fn(async()=>snapshot());mount(()=>load,save);expect(screen.queryByTestId("names")).toBeNull();await act(async()=>resolve(snapshot()));expect(await screen.findByTestId("names")).toHaveTextContent("Current sheet guest");expect(save).not.toHaveBeenCalled();});
 it("autosaves once without disabling edits while awaiting acknowledgement",async()=>{let resolve!:(v:StudioSheetSnapshot)=>void;const response=new Promise<StudioSheetSnapshot>(r=>{resolve=r;}),save=vi.fn((op:StudioMutation)=>{void op;return response;});mount(async()=>snapshot(),save);await screen.findByTestId("names");fireEvent.click(screen.getByText("Edit"));approve();expect(screen.getByTestId("names")).toHaveTextContent("Edited in studio");expect(screen.getByText("Edit")).not.toBeDisabled();expect(save).toHaveBeenCalledOnce();const result=snapshot();result.layout=applyMutation(result.layout,save.mock.calls[0][0]);await act(async()=>resolve(result));await waitFor(()=>expect(localStorage.getItem("tongter:studio:pending-v2")).toBeNull());expect(localStorage.getItem("tongter:studio:pending-v2")).toBeNull();});
 it("retains the original operation ID on network retry",async()=>{const ops:StudioMutation[]=[];const save=vi.fn(async(op:StudioMutation)=>{ops.push(op);if(ops.length===1)throw Error("Network interrupted");return {...snapshot(),layout:applyMutation(snapshot().layout,op)};});mount(async()=>snapshot(),save);await screen.findByTestId("names");fireEvent.click(screen.getByText("Edit"));approve();await screen.findByText("Retry save");expect(localStorage.getItem("tongter:studio:pending-v2")).not.toBeNull();fireEvent.click(screen.getByText("Retry save"));approve();await waitFor(()=>expect(localStorage.getItem("tongter:studio:pending-v2")).toBeNull());expect(ops[0].id).toBe(ops[1].id);});
 it("shows the authoritative snapshot after a same-field conflict",async()=>{const newer=snapshot("Changed by another admin");mount(async()=>snapshot(),async()=>{throw new SheetSaveError("Name changed elsewhere",409,newer);});await screen.findByTestId("names");fireEvent.click(screen.getByText("Edit"));approve();await waitFor(()=>expect(screen.getByTestId("names")).toHaveTextContent("Changed by another admin"));expect(screen.getByText("Undo")).toBeDisabled();expect(localStorage.getItem("tongter:studio:pending-v2")).toBeNull();});
 it("refreshes clean views without creating writes or undo entries",async()=>{let current=snapshot();const save=vi.fn(async()=>current);mount(async()=>current,save);await screen.findByTestId("names");current=snapshot("Edited directly in Sheets");fireEvent(window,new Event("focus"));await waitFor(()=>expect(screen.getByTestId("names")).toHaveTextContent("Edited directly in Sheets"));expect(save).not.toHaveBeenCalled();expect(screen.getByText("Undo")).toBeDisabled();});
 it("migrates and recovers a legacy pending operation after reload",async()=>{const original=snapshot(),next=clone(original.layout);next.guestList[0].name="Recovered edit";const op=mutationBetween(original.layout,next);localStorage.setItem("tongter:studio:pending-v1",JSON.stringify(op));const save=vi.fn(async(operation:StudioMutation)=>{void operation;return {...original,layout:next};});mount(async()=>original,save);await waitFor(()=>expect(screen.getByTestId("names")).toHaveTextContent("Recovered edit"));expect(save.mock.calls[0][0].id).toBe(op.id);expect(localStorage.getItem("tongter:studio:pending-v2")).toBeNull();});
 it("ignores a delayed pre-save refresh even after the entire edit queue drains",async()=>{
  let resolveRead!:(value:StudioSheetResponse)=>void;const oldRead=new Promise<StudioSheetResponse>(resolve=>{resolveRead=resolve;});let reads=0;
  const operations:StudioMutation[]=[],replies:((value:StudioSheetSnapshot)=>void)[]=[];
  const save=(operation:StudioMutation)=>{operations.push(operation);return new Promise<StudioSheetSnapshot>(resolve=>replies.push(resolve));};
  mount(()=>++reads===1?Promise.resolve(snapshot()):oldRead,save);await screen.findByTestId("names");
  fireEvent(window,new Event("focus"));expect(reads).toBe(2);
  fireEvent.click(screen.getByText("Edit"));approve();fireEvent.click(screen.getByText("Edit second"));approve();
  const first=snapshot();first.layout=applyMutation(first.layout,operations[0]);await act(async()=>replies[0](first));
  expect(screen.getByTestId("names")).toHaveTextContent("Edited in studio|Second guest edited");
  const second={...first,layout:applyMutation(first.layout,operations[1])};await act(async()=>replies[1](second));
  expect(localStorage.getItem("tongter:studio:pending-v2")).toBeNull();
  await act(async()=>resolveRead(snapshot()));
  expect(screen.getByTestId("names")).toHaveTextContent("Edited in studio|Second guest edited");
 });
 it("fails visibly rather than falling back to default data",async()=>{mount(async()=>{throw Error("Sheet unavailable");},async()=>snapshot());await screen.findByRole("alert");expect(screen.queryByTestId("names")).toBeNull();});
});

describe("manual sheet connection reviews",()=>{
 it("confirms read-only reload but never prompts for a focus refresh",async()=>{
  let reads=0;const save=vi.fn(async()=>snapshot());
  mount(async()=>{reads++;return snapshot();},save);await screen.findByTestId("names");
  fireEvent.click(screen.getByRole("button",{name:"Reload sheet"}));
  expect(screen.getByRole("dialog").textContent).toBe("Reload Google SheetsCancelConfirm");expect(reads).toBe(1);
  approve();await waitFor(()=>expect(reads).toBe(2));
  fireEvent(window,new Event("focus"));await waitFor(()=>expect(reads).toBe(3));
  expect(screen.queryByRole("dialog")).toBeNull();expect(save).not.toHaveBeenCalled();
 });
 it("cancelled reload and a focus event during a review perform no read",async()=>{
  let reads=0;mount(async()=>{reads++;return snapshot();},async()=>snapshot());await screen.findByTestId("names");
  fireEvent.click(screen.getByRole("button",{name:"Reload sheet"}));fireEvent(window,new Event("focus"));
  expect(reads).toBe(1);fireEvent.click(screen.getByRole("button",{name:"Cancel"}));expect(reads).toBe(1);
 });
});
