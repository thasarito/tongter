// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { defaultLayout } from "@/client/studio/model/defaults";
import { normalizeLayout } from "@/client/studio/model/schema";
import { moveGuests } from "@/client/studio/model/commands";
import { mutationBetween, mutationHash } from "@/shared/studio-mutations";
import { StudioWriterEngine, type PendingWrite } from "./studio-writer";
import type { StudioGateway } from "./studio-gateway";
async function setup(age:number){
 let layout=normalizeLayout({...defaultLayout(),guestList:[{id:"test-a",name:"Test A",tableId:"table-1",seatNumber:1}]});
 const operation=mutationBetween(layout,moveGuests(layout,["test-a"],{tableId:"table-2",seatNumber:2}));
 const now=1_000_000;let pending:PendingWrite|undefined={id:operation.id,hash:await mutationHash(operation),sentAt:now-age};
 const receipts=new Map<string,string>();
 const gateway:StudioGateway={read:async()=>({snapshot:{status:"ok",source:"Google Sheets",layout,revision:"test",fetchedAt:now},ranges:[]}),receipt:async id=>receipts.has(id)?{id,hash:receipts.get(id)!}:null,write:vi.fn(async(_read,next,op,hash)=>{layout=next;receipts.set(op.id,hash);})};
 const engine=new StudioWriterEngine(gateway,{get:async()=>pending,set:async p=>{pending=p;},clear:async()=>{pending=undefined;}},()=>now);
 return {engine,gateway,operation,read:()=>layout};
}
describe("abandoned ambiguous-save recovery",()=>{
 it("lets another operation proceed after the upstream timeout window and an absent receipt",async()=>{const f=await setup(241_000);const result=await f.engine.execute({...f.operation,id:crypto.randomUUID()});expect(result.status).toBe(200);expect(f.gateway.write).toHaveBeenCalledOnce();expect(f.read().guestList[0].tableId).toBe("table-2");});
 it("still blocks another operation during the upstream processing window",async()=>{const f=await setup(100_000);const result=await f.engine.execute({...f.operation,id:crypto.randomUUID()});expect(result.status).toBe(503);expect(f.gateway.write).not.toHaveBeenCalled();});
 it("does not permit a pending ID to be reused with a different payload even after timeout",async()=>{const f=await setup(241_000);const result=await f.engine.execute({...f.operation,changes:[]});expect(result.status).toBe(409);expect(f.gateway.write).not.toHaveBeenCalled();});
});
