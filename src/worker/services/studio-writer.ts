import { applyMutation, managedRecord, mutationHash, same, StudioConflict, type StudioMutation } from "@/shared/studio-mutations";
import type { StudioSheetSnapshot } from "@/shared/studio-sheet";
import { SheetWriteError, type StudioGateway } from "./studio-gateway";
export interface PendingWrite {id:string;hash:string;sentAt:number}
export interface WriteJournal {get:()=>Promise<PendingWrite|undefined>;set:(value:PendingWrite)=>Promise<void>;clear:()=>Promise<void>}
const headers={"Cache-Control":"no-store"};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
export function writeConflict(message:string,snapshot:StudioSheetSnapshot,applied=false){return json({error:{code:"STUDIO_CONFLICT",message},snapshot,applied},409);}
/** The enclosing Durable Object serializes calls. Its persistent journal survives
 * eviction; the receipt shares the atomic Google cell batch with both swap sides. */
export class StudioWriterEngine {
  constructor(private gateway:StudioGateway,private journal:WriteJournal,private now:()=>number=Date.now){}
  async status(id:string):Promise<Response>{
    const receipt=await this.gateway.receipt(id);
    if(receipt){const pending=await this.journal.get();if(pending?.id===id)await this.journal.clear();return json({...((await this.gateway.read()).snapshot),operationId:id,replayed:true});}
    const pending=await this.journal.get();return json({status:pending?.id===id?"pending":"unknown",operationId:id},pending?.id===id?202:404);
  }
  async execute(operation:StudioMutation):Promise<Response>{
    const hash=await mutationHash(operation),existing=await this.gateway.receipt(operation.id);
    if(existing){if(existing.hash!==hash)return json({error:{code:"OPERATION_ID_REUSED",message:"This operation ID belongs to a different edit."}},409);const pending=await this.journal.get();if(pending?.id===operation.id)await this.journal.clear();return json({...((await this.gateway.read()).snapshot),operationId:operation.id,replayed:true});}
    const pending=await this.journal.get();
    if(pending){
      if(pending.id===operation.id&&pending.hash!==hash)return json({error:{code:"OPERATION_ID_REUSED",message:"This pending operation ID belongs to a different edit."}},409);
      const confirmed=await this.gateway.receipt(pending.id);
      if(confirmed){await this.journal.clear();}
      else if(this.now()-pending.sentAt<240_000){return json({error:{code:"SAVE_UNCERTAIN",message:"A previous sheet update is still being reconciled. Retry shortly; it will not be applied twice."}},503);}
      else {
        // Google documents a 180-second processing timeout. After a 240-second
        // guard and a fresh absent-receipt check, release an abandoned journal.
        // Re-read and validate all preconditions below, even for a different tab.
        await this.journal.clear();
      }
    }
    const read=await this.gateway.read();let next;
    try{next=applyMutation(read.snapshot.layout,operation);}catch(cause){if(cause instanceof StudioConflict)return writeConflict(cause.message,read.snapshot);throw cause;}
    if(!operation.changes.length)return json({...read.snapshot,operationId:operation.id});
    await this.journal.set({id:operation.id,hash,sentAt:this.now()});
    try{await this.gateway.write(read,next,operation,hash);}catch(cause){
      if(cause instanceof SheetWriteError&&cause.definitive){await this.journal.clear();return json({error:{code:"SHEET_WRITE_REJECTED",message:"Sheets rejected the update. Nothing was written; check editor permissions and retry."}},503);}
      const receipt=await this.gateway.receipt(operation.id).catch(()=>null);
      if(!receipt)return json({error:{code:"SAVE_UNCERTAIN",message:"Connection interrupted while saving. Your edit is retained; Retry will check the operation receipt first."}},503);
    }
    const receipt=await this.gateway.receipt(operation.id);
    if(!receipt||receipt.hash!==hash)return json({error:{code:"SAVE_UNCERTAIN",message:"The write receipt is not available yet. Retry to reconcile, not repeat the swap."}},503);
    const actual=(await this.gateway.read()).snapshot;await this.journal.clear();
    for(const change of operation.changes){
      const key=change.entity==="guest"?"guestList":"items",got=managedRecord(actual.layout[key].find(v=>v.id===change.id)??null),wanted=managedRecord(next[key].find(v=>v.id===change.id)??null);
      if(!got||!wanted){if(!same(got,wanted))return writeConflict("The sheet changed immediately after saving. The latest sheet is shown; review before retrying.",actual,true);continue;}
      const before=managedRecord(change.before);
      for(const field of Object.keys(wanted))if((!before||!same(before[field],wanted[field]))&&!same(got[field],wanted[field]))return writeConflict("The same cells changed immediately after saving. The latest sheet is shown.",actual,true);
    }
    return json({...actual,operationId:operation.id});
  }
}
