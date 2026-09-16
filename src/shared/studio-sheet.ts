import { normalizeLayout, type StudioLayout } from "@/client/studio/model/schema";

export const STUDIO_RANGES = ["StudioMeta!A1:B100", "StudioGuests!A:U", "StudioObjects!A:N"];
export const STUDIO_GUEST_COLUMNS = ["id","name","host","group","status","rsvp","notes","dietary","heart","star","sourceTableId","sourceTableLabel","unmappedTableId","unmappedTableLabel","reserve","important","vip","tableId","seatNumber","sourceSeatNumber","unmappedSeatNumber"];
export const STUDIO_OBJECT_COLUMNS = ["id","kind","shape","label","x","z","w","d","h","rotation","seats","locked","aisleWidth"];
export interface StudioSheetSnapshot {
  status: "ok";
  source: "Google Sheets";
  layout: StudioLayout;
  revision: string;
  fetchedAt: number;
  sourceFile?: string;
  sourceSha256?: string;
}
export interface StudioSheetUnavailable {
  status:"unconfigured";source:"Google Sheets";layout:null;fetchedAt:number;
  /** Local/mock test environments only; never silently enable this on live failure. */
  demo?:boolean;
}
export type StudioSheetResponse = StudioSheetSnapshot | StudioSheetUnavailable;
interface Values {values?:string[][]}
function records(range:Values|undefined,required:string[],tab:string):Record<string,string>[] {
  const [headers,...rows]=range?.values??[];
  if(!headers)throw Error(`${tab}: missing header row.`);
  const keys=headers.map(h=>h.trim());
  if(required.some(k=>!keys.includes(k))||new Set(keys.filter(Boolean)).size!==keys.filter(Boolean).length)throw Error(`${tab}: missing or duplicate columns.`);
  return rows.filter(row=>row.some(cell=>cell.trim()!=="")).map(row=>Object.fromEntries(keys.filter(Boolean).map(k=>[k,row[keys.indexOf(k)]??""])));
}
function flag(raw:string,field:string):boolean {
  const value=raw.trim().toLowerCase();if(value==="true"||value==="1")return true;if(value==="false"||value==="0"||value==="")return false;
  throw Error(`${field}: expected TRUE or FALSE.`);
}
function numeric(raw:string,field:string,nullable=false):number|null {
  if(raw.trim()===""){if(nullable)return null;throw Error(`${field}: a number is required.`);}
  const value=Number(raw);if(!Number.isFinite(value)||!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim()))throw Error(`${field}: invalid number.`);return value;
}
/** Read-only projection from native Sheets tabs. Historical tables never become
 * current seats; the obsolete compacted per-table guest-name cache is ignored. */
export function layoutFromStudioRanges(ranges:Values[]):{layout:StudioLayout;sourceFile:string;sourceSha256:string} {
  const metaRows=records(ranges[0],["key","value"],"StudioMeta"),meta=new Map<string,string>();
  for(const row of metaRows){if(!row.key||meta.has(row.key))throw Error("StudioMeta: duplicate or empty key.");meta.set(row.key,row.value);}
  if(meta.get("syncStatus")!=="complete")throw Error("Studio sheet update is not complete.");
  if(meta.get("version")!=="3"||meta.get("units")!=="metres")throw Error("Unsupported studio sheet version or units.");
  const guestList=records(ranges[1],STUDIO_GUEST_COLUMNS,"StudioGuests").map((row,i)=>{
    const out:Record<string,unknown>=Object.fromEntries(STUDIO_GUEST_COLUMNS.map(k=>[k,row[k]]));
    for(const k of ["reserve","important","vip"])out[k]=flag(row[k],`StudioGuests row ${i+2}, ${k}`);
    for(const k of ["seatNumber","sourceSeatNumber","unmappedSeatNumber"])out[k]=numeric(row[k],`StudioGuests row ${i+2}, ${k}`,true);
    if(Boolean(row.tableId)!==(out.seatNumber!==null))throw Error(`StudioGuests row ${i+2}: current table and seat must be both set or both blank.`);
    return out;
  });
  const items=records(ranges[2],STUDIO_OBJECT_COLUMNS,"StudioObjects").map((row,i)=>{
    const out:Record<string,unknown>=Object.fromEntries(STUDIO_OBJECT_COLUMNS.map(k=>[k,row[k]]));
    for(const k of ["x","z","w","d","h","rotation","seats"])out[k]=numeric(row[k],`StudioObjects row ${i+2}, ${k}`);
    out.locked=flag(row.locked,`StudioObjects row ${i+2}, locked`);
    if(row.aisleWidth.trim())out.aisleWidth=numeric(row.aisleWidth,"aisleWidth");else delete out.aisleWidth;
    out.guests=[];return out;
  });
  if(items.length===0)throw Error("StudioObjects contains no layout objects.");
  const layout=normalizeLayout({version:3,title:meta.get("title"),units:meta.get("units"),guestSource:JSON.parse(meta.get("guestSource")||"{}"),guestList,items});
  return {layout,sourceFile:meta.get("sourceFile")??"",sourceSha256:meta.get("sourceSha256")??""};
}
export async function studioSheetSnapshot(ranges:Values[],now:number):Promise<StudioSheetSnapshot> {
  const data=layoutFromStudioRanges(ranges);
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(data.layout)));
  const revision=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
  return {status:"ok",source:"Google Sheets",...data,revision,fetchedAt:now};
}
