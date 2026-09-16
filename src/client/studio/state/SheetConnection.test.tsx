import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { StudioSheetResponse, StudioSheetSnapshot } from "@/shared/studio-sheet";
import { defaultLayout } from "../model/defaults";
import { normalizeLayout } from "../model/schema";
import { StudioProvider, useStudio } from "./StudioProvider";
import { SheetConnection, SheetStatus } from "./SheetConnection";
const unauthorized=()=>{};
function snapshot(name="Current sheet guest"):StudioSheetSnapshot {
  return {status:"ok",source:"Google Sheets",revision:name,fetchedAt:1,layout:normalizeLayout({...defaultLayout(),guestList:[{id:"synthetic-1",name,tableId:"table-12",seatNumber:9},{id:"synthetic-2",name:"Waiting from sheet",tableId:"",seatNumber:null}]})};
}
function Probe(){const {layout,commit}=useStudio();return <><SheetStatus/><output data-testid="names">{layout.guestList.map(g=>g.name).join("|")}</output><output data-testid="seats">{JSON.stringify(layout.guestList.map(g=>[g.tableId,g.seatNumber]))}</output><button onClick={()=>commit("Local edit",s=>({...s,guestList:s.guestList.map((g,i)=>i?g:{...g,name:"Unsaved local edit"})}))}>Edit locally</button></>;}
function mount(loadSheet:()=>Promise<StudioSheetResponse>){return render(<StudioProvider><SheetConnection onUnauthorized={unauthorized} loadSheet={loadSheet}><Probe/></SheetConnection></StudioProvider>);}
beforeEach(()=>{localStorage.clear();});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe("sheet-authoritative studio startup and refresh",()=>{
  it("does not flash the old browser draft before the live sheet arrives",async()=>{
    const old=snapshot("Old local guest").layout;localStorage.setItem("tongter:glass-house-react:v1",JSON.stringify(old));
    let resolve!:(value:StudioSheetResponse)=>void;const promise=new Promise<StudioSheetResponse>(r=>{resolve=r;});mount(()=>promise);
    expect(screen.queryByTestId("names")).toBeNull();expect(screen.getByText("Loading your live seating sheet…")).toBeTruthy();
    await act(async()=>{resolve(snapshot());await promise;});
    expect(await screen.findByTestId("names")).toHaveTextContent("Current sheet guest");expect(screen.getByTestId("names")).not.toHaveTextContent("Old local guest");
    expect(screen.getByTestId("seats")).toHaveTextContent('[["table-12",9],["",null]]');
    expect(JSON.parse(localStorage.getItem("tongter:glass-house-react:before-sheet-sync")!).guestList[0].name).toBe("Old local guest");
  });
  it("refreshes clean views on focus without overwriting the recovery backup",async()=>{
    let current=snapshot();const load=vi.fn(async()=>current);mount(load);await screen.findByTestId("names");
    const backup=localStorage.getItem("tongter:glass-house-react:before-sheet-sync");current=snapshot("Changed directly in sheet");
    fireEvent(window,new Event("focus"));await waitFor(()=>expect(screen.getByTestId("names")).toHaveTextContent("Changed directly in sheet"));
    expect(load).toHaveBeenCalledTimes(2);expect(localStorage.getItem("tongter:glass-house-react:before-sheet-sync")).toBe(backup);
  });
  it("protects local edits from background refresh, then reloads only with confirmation",async()=>{
    let current=snapshot();mount(async()=>current);await screen.findByTestId("names");fireEvent.click(screen.getByText("Edit locally"));
    expect(screen.getByText("Local draft edits — not published to Sheets")).toBeTruthy();current=snapshot("Newer sheet guest");
    fireEvent(window,new Event("focus"));await screen.findByText(/The sheet has changed/);
    expect(screen.getByTestId("names")).toHaveTextContent("Unsaved local edit");
    const confirm=vi.spyOn(window,"confirm").mockReturnValue(false);fireEvent.click(screen.getByText("Reload sheet"));await waitFor(()=>expect(confirm).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("names")).toHaveTextContent("Unsaved local edit");await waitFor(()=>expect(screen.getByText("Reload sheet")).not.toBeDisabled());
    confirm.mockReturnValue(true);fireEvent.click(screen.getByText("Reload sheet"));await waitFor(()=>expect(screen.getByTestId("names")).toHaveTextContent("Newer sheet guest"));
    expect(JSON.parse(localStorage.getItem("tongter:glass-house-react:before-sheet-sync")!).guestList[0].name).toBe("Unsaved local edit");
  });
  it("fails visibly rather than showing a stale or default venue after a read error",async()=>{
    localStorage.setItem("tongter:glass-house-react:v1",JSON.stringify(snapshot("Old guest").layout));
    mount(async()=>{throw Error("Sheet validation failed");});await screen.findByRole("alert");expect(screen.queryByTestId("names")).toBeNull();
    expect(screen.getByText("Retry sheet connection")).not.toBeDisabled();
  });
  it("allows a local fixture only when the server explicitly identifies a demo environment",async()=>{
    mount(async()=>({status:"unconfigured",source:"Google Sheets",layout:null,fetchedAt:0,demo:true}));
    await screen.findByTestId("names");expect(screen.getByText(/Demo\/local draft/)).toBeTruthy();
  });
  it("does not silently use local data for a misconfigured real deployment",async()=>{
    mount(async()=>({status:"unconfigured",source:"Google Sheets",layout:null,fetchedAt:0,demo:false}));
    await screen.findByRole("alert");expect(screen.queryByTestId("names")).toBeNull();
  });
});
