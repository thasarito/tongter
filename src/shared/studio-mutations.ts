import { z } from "zod";
import { clone, guestSchema, itemSchema, normalizeLayout, type StudioLayout } from "@/client/studio/model/schema";
const id=z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const changeSchema=z.discriminatedUnion("entity",[
  z.object({entity:z.literal("guest"),id,before:guestSchema.nullable(),after:guestSchema.nullable()}).strict(),
  z.object({entity:z.literal("item"),id,before:itemSchema.nullable(),after:itemSchema.nullable()}).strict(),
]);
export const mutationSchema=z.object({id:z.string().regex(/^[A-Za-z0-9_-]{12,100}$/),changes:z.array(changeSchema).max(5200)}).strict().superRefine((m,ctx)=>{
  const used=new Set<string>();
  for(const c of m.changes){const key=c.entity+":"+c.id;if(used.has(key)||(!c.before&&!c.after)||[c.before,c.after].some(v=>v&&v.id!==c.id))ctx.addIssue({code:"custom",message:"Invalid or duplicate entity change."});used.add(key);}
});
export type StudioMutation=z.output<typeof mutationSchema>;
export type StudioChange=StudioMutation["changes"][number];
export class StudioConflict extends Error {
  constructor(message="The same guest, seat or object changed elsewhere. Your edit was not saved."){super(message);this.name="StudioConflict";}
}
export function stable(value:unknown):string {
  if(value===undefined)return "null";
  if(value===null||typeof value!=="object")return JSON.stringify(value);
  if(Array.isArray(value))return "["+value.map(stable).join(",")+"]";
  return "{"+Object.entries(value as Record<string,unknown>).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+":"+stable(v)).join(",")+"}";
}
export const same=(a:unknown,b:unknown)=>stable(a)===stable(b);
export function managedRecord(value:unknown):Record<string,unknown>|null {
  if(value===null)return null;const result={...(value as Record<string,unknown>)};delete result.guests;return result;
}
export function mutationBetween(before:StudioLayout,after:StudioLayout,operationId:string=crypto.randomUUID()):StudioMutation {
  const a=normalizeLayout(before),b=normalizeLayout(after),changes:StudioChange[]=[];
  if(a.title!==b.title||!same(a.guestSource,b.guestSource))throw Error("Project metadata is managed in StudioMeta, not overwritten by the editor.");
  for(const entity of ["guest","item"] as const){
    const left=entity==="guest"?a.guestList:a.items,right=entity==="guest"?b.guestList:b.items;
    const old=new Map(left.map(v=>[v.id,v])),next=new Map(right.map(v=>[v.id,v]));
    for(const key of new Set([...old.keys(),...next.keys()])){
      const prev=old.get(key)??null,value=next.get(key)??null;
      if(!same(managedRecord(prev),managedRecord(value)))changes.push(changeSchema.parse({entity,id:key,before:prev,after:value}));
    }
  }
  return mutationSchema.parse({id:operationId,changes});
}
export function inverseMutation(operation:StudioMutation,id:string=crypto.randomUUID()):StudioMutation {
  return {id,changes:operation.changes.map(c=>({...c,before:c.after,after:c.before})) as StudioChange[]};
}
export function applyMutation(current:StudioLayout,input:StudioMutation):StudioLayout {
  const operation=mutationSchema.parse(input),next=clone(current);
  for(const change of operation.changes){
    const list:Record<string,unknown>[]=(change.entity==="guest"?next.guestList:next.items) as unknown as Record<string,unknown>[];
    const index=list.findIndex(v=>v.id===change.id),live=index<0?null:managedRecord(list[index]);
    const before=managedRecord(change.before),after=managedRecord(change.after);
    if(!before){if(live)throw new StudioConflict("That record was added elsewhere. Refresh before editing it.");list.push(clone(change.after) as unknown as Record<string,unknown>);continue;}
    if(!live)throw new StudioConflict("That guest or table was deleted elsewhere.");
    if(!after){if(!same(live,before))throw new StudioConflict("That record changed elsewhere and was not deleted.");list.splice(index,1);continue;}
    const fields=new Set([...Object.keys(before),...Object.keys(after)].filter(k=>!same(before[k],after[k])));
    const placement=change.entity==="guest"&&(fields.has("tableId")||fields.has("seatNumber"));
    if(placement){fields.add("tableId");fields.add("seatNumber");if(after.tableId&&((live.reserve&&!fields.has("reserve"))||(live.rsvp==="Declined"&&!fields.has("rsvp"))||after.reserve||after.rsvp==="Declined"))throw new StudioConflict("That guest is now reserve or declined. Review their record first.");}
    if(change.entity==="item"&&live.locked&&["x","z","w","d","rotation","h"].some(k=>fields.has(k))&&!fields.has("locked"))throw new StudioConflict("That object is now locked.");
    for(const field of fields){if(!same(live[field],before[field]))throw new StudioConflict();if(after[field]===undefined)delete list[index][field];else list[index][field]=clone(after[field]);}
  }
  try{return normalizeLayout(next);}catch{throw new StudioConflict("The target seat, capacity or guest eligibility changed. Your edit was not saved.");}
}
export async function mutationHash(operation:StudioMutation):Promise<string>{
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(stable(mutationSchema.parse(operation))));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
}
