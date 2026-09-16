import { STUDIO_RANGES, STUDIO_GUEST_COLUMNS, STUDIO_OBJECT_COLUMNS, studioSheetSnapshot, type StudioSheetSnapshot } from "@/shared/studio-sheet";
import { managedRecord, same, type StudioMutation } from "@/shared/studio-mutations";
import type { StudioLayout } from "@/client/studio/model/schema";
import { createSheetsApi, type ValueRange } from "../google/sheets-api";
export const RECEIPT_TAB="_StudioSync";
export interface SheetRead {snapshot:StudioSheetSnapshot;ranges:ValueRange[]}
export interface Receipt {id:string;hash:string}
export interface StudioGateway {read:()=>Promise<SheetRead>;receipt:(id:string)=>Promise<Receipt|null>;write:(read:SheetRead,next:StudioLayout,operation:StudioMutation,hash:string)=>Promise<void>}
export class SheetWriteError extends Error {constructor(public definitive:boolean){super("Google Sheets did not acknowledge this update.");}}
interface Tab {sheetId:number;title:string}
interface Cell {userEnteredValue?:{stringValue?:string;numberValue?:number;boolValue?:boolean}}
function cell(value:unknown):Cell{return value===null||value===undefined||value===""?{}:{userEnteredValue:typeof value==="number"?{numberValue:value}:typeof value==="boolean"?{boolValue:value}:{stringValue:String(value)}};}
/** Current IDs/headers locate rows. Only changed managed cells are written;
 * legacy invitations and unrelated sheet columns never enter the request. */
export function cellRequests(read:SheetRead,next:StudioLayout,operation:StudioMutation,tabs:Tab[]):Record<string,unknown>[] {
  const requests:Record<string,unknown>[]=[],deletions:{sheetId:number;row:number}[]=[];
  for(const change of operation.changes){
    const isGuest=change.entity==="guest",title=isGuest?"StudioGuests":"StudioObjects",sheetId=tabs.find(t=>t.title===title)?.sheetId;
    if(sheetId===undefined)throw Error("Studio tab is missing.");
    const rows=read.ranges[isGuest?1:2].values??[],headers=rows[0]??[],idCol=headers.indexOf("id"),rowIndex=rows.findIndex((r,i)=>i>0&&r[idCol]===change.id);
    const columns=isGuest?STUDIO_GUEST_COLUMNS:STUDIO_OBJECT_COLUMNS;
    const current=managedRecord((isGuest?read.snapshot.layout.guestList:read.snapshot.layout.items).find(g=>g.id===change.id)??null);
    const value=managedRecord((isGuest?next.guestList:next.items).find(g=>g.id===change.id)??null);
    if(!value){if(rowIndex<1)throw Error("Deleted row was not found.");deletions.push({sheetId,row:rowIndex});continue;}
    if(!current){const values=headers.map(h=>columns.includes(h)?cell(value[h]):{});requests.push({appendCells:{sheetId,rows:[{values}],fields:"userEnteredValue"}});continue;}
    if(rowIndex<1)throw Error("Changed row was not found.");
    for(const key of columns){if(same(current[key],value[key]))continue;const columnIndex=headers.indexOf(key);if(columnIndex<0)throw Error("Required studio column is missing.");requests.push({updateCells:{start:{sheetId,rowIndex,columnIndex},rows:[{values:[cell(value[key])]}],fields:"userEnteredValue"}});}
  }
  for(const d of deletions.sort((a,b)=>a.sheetId-b.sheetId||b.row-a.row))requests.push({deleteDimension:{range:{sheetId:d.sheetId,dimension:"ROWS",startIndex:d.row,endIndex:d.row+1}}});
  return requests;
}
export function createStudioGateway(deps:{spreadsheetId:string;getAccessToken:()=>Promise<string>;fetcher?:typeof fetch;now?:()=>number}):StudioGateway {
  const fetcher=deps.fetcher??fetch,now=deps.now??Date.now,api=createSheetsApi({...deps,fetcher}),base=`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(deps.spreadsheetId)}`;
  async function metadata():Promise<Tab[]>{const token=await deps.getAccessToken();const r=await fetcher(base+"?fields=sheets(properties(sheetId,title))",{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw Error("Unable to read studio tab metadata.");const body=await r.json() as {sheets:{properties:Tab}[]};return body.sheets.map(t=>t.properties);}
  return {
    async read(){const ranges=await api.batchGet(STUDIO_RANGES,true);return {snapshot:await studioSheetSnapshot(ranges,now()),ranges};},
    async receipt(id){const tabs=await metadata();if(!tabs.some(t=>t.title===RECEIPT_TAB))return null;const [range]=await api.batchGet([`'${RECEIPT_TAB}'!A:D`],true);const rows=(range.values??[]).filter(r=>r[0]===id);if(rows.length>1&&rows.some(r=>r[1]!==rows[0][1]))throw Error("Inconsistent operation receipts.");return rows[0]?{id,hash:rows[0][1]}:null;},
    async write(read,next,operation,hash){
      const tabs=await metadata(),requests=cellRequests(read,next,operation,tabs);
      let receiptId=tabs.find(t=>t.title===RECEIPT_TAB)?.sheetId;
      if(receiptId===undefined){receiptId=1_600_000_000;while(tabs.some(t=>t.sheetId===receiptId))receiptId++;requests.unshift({addSheet:{properties:{sheetId:receiptId,title:RECEIPT_TAB,hidden:true,gridProperties:{rowCount:1000,columnCount:4}}}},{updateCells:{start:{sheetId:receiptId,rowIndex:0,columnIndex:0},rows:[{values:["operationId","sha256","savedAt","note"].map(cell)}],fields:"userEnteredValue"}});}
      requests.push({appendCells:{sheetId:receiptId,rows:[{values:[operation.id,hash,new Date(now()).toISOString(),"studio-v1"].map(cell)}],fields:"userEnteredValue"}});
      const token=await deps.getAccessToken();let response:Response;
      try{response=await fetcher(base+":batchUpdate",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({requests}),signal:AbortSignal.timeout(185_000)});}catch{throw new SheetWriteError(false);}
      if(!response.ok)throw new SheetWriteError(response.status>=400&&response.status<500);
    },
  };
}
