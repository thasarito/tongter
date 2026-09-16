// @vitest-environment node
import { describe,it,expect,vi } from "vitest";
import { defaultLayout } from "@/client/studio/model/defaults";
import { normalizeLayout,clone } from "@/client/studio/model/schema";
import { moveGuests } from "@/client/studio/model/commands";
import { mutationBetween } from "@/shared/studio-mutations";
import { StudioWriterEngine,type PendingWrite } from "./studio-writer";
import { SheetWriteError,type StudioGateway } from "./studio-gateway";
function fixture(){
 let layout=normalizeLayout({...defaultLayout(),guestList:[{id:"test-a",name:"Synthetic A",tableId:"table-1",seatNumber:1},{id:"test-b",name:"Synthetic B",tableId:"table-1",seatNumber:2}]}),pending:PendingWrite|undefined;
 const receipts=new Map<string,string>();let time=1_000_000;
 const gateway:StudioGateway={read:async()=>({snapshot:{status:"ok",source:"Google Sheets",layout:clone(layout),revision:String(time),fetchedAt:time},ranges:[]}),receipt:async id=>receipts.has(id)?{id,hash:receipts.get(id)!}:null,write:vi.fn(async(_read,next,op,hash)=>{layout=next;receipts.set(op.id,hash);})};
 const engine=new StudioWriterEngine(gateway,{get:async()=>pending,set:async v=>{pending=v;},clear:async()=>{pending=undefined;}},()=>time);
 const operation=mutationBetween(layout,moveGuests(layout,["test-a"],{tableId:"table-1",seatNumber:2}));
 return {gateway,engine,operation,getLayout:()=>layout,setLayout:(v:typeof layout)=>{layout=v;},receipts,getPending:()=>pending,advance:()=>{time+=241_000;}};
}
describe("durable receipt-based sheet writer",()=>{
 it("writes and reads back an atomic swap",async()=>{const f=fixture(),r=await f.engine.execute(f.operation);expect(r.status).toBe(200);expect(f.getLayout().guestList[0].seatNumber).toBe(2);expect(f.getPending()).toBeUndefined();});
 it("a retried successful operation cannot swap guests back",async()=>{const f=fixture();await f.engine.execute(f.operation);const r=await f.engine.execute(f.operation);expect(r.status).toBe(200);expect((await r.json()).replayed).toBe(true);expect(f.gateway.write).toHaveBeenCalledOnce();expect(f.getLayout().guestList[0].seatNumber).toBe(2);});
 it("reconciles a lost response from the atomic receipt",async()=>{const f=fixture(),write=f.gateway.write;f.gateway.write=vi.fn(async(...args)=>{await write(...args);throw new SheetWriteError(false);});expect((await f.engine.execute(f.operation)).status).toBe(200);expect(f.getPending()).toBeUndefined();});
 it("blocks another write while an ambiguous write is unresolved",async()=>{const f=fixture();f.gateway.write=vi.fn(async()=>{throw new SheetWriteError(false);});expect((await f.engine.execute(f.operation)).status).toBe(503);const other={...f.operation,id:crypto.randomUUID()};expect((await f.engine.execute(other)).status).toBe(503);expect(f.gateway.write).toHaveBeenCalledOnce();expect(f.getPending()?.id).toBe(f.operation.id);});
 it("rejects reused IDs with altered contents",async()=>{const f=fixture();await f.engine.execute(f.operation);expect((await f.engine.execute({...f.operation,changes:[]})).status).toBe(409);expect(f.gateway.write).toHaveBeenCalledOnce();});
 it("returns current state on conflict without writing",async()=>{const f=fixture();f.setLayout(moveGuests(f.getLayout(),["test-a"],{tableId:"table-2",seatNumber:1}));const r=await f.engine.execute(f.operation);expect(r.status).toBe(409);expect((await r.json()).snapshot.layout).toEqual(f.getLayout());expect(f.gateway.write).not.toHaveBeenCalled();});
 it("no-op verification never creates receipt tabs or changes data",async()=>{const f=fixture();expect((await f.engine.execute({id:crypto.randomUUID(),changes:[]})).status).toBe(200);expect(f.gateway.write).not.toHaveBeenCalled();expect(f.receipts.size).toBe(0);});
 it("a definitive Google rejection clears the uncertain journal",async()=>{const f=fixture();f.gateway.write=vi.fn(async()=>{throw new SheetWriteError(true);});expect((await f.engine.execute(f.operation)).status).toBe(503);expect(f.getPending()).toBeUndefined();});
 it("status confirms a receipt without reapplying a swap",async()=>{const f=fixture();await f.engine.execute(f.operation);expect((await f.engine.status(f.operation.id)).status).toBe(200);expect((await f.engine.status("unseen-operation")).status).toBe(404);expect(f.gateway.write).toHaveBeenCalledOnce();});
});
