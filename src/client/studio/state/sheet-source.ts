import { ApiError } from "@/client/api/client";
import type { StudioSheetResponse, StudioSheetSnapshot } from "@/shared/studio-sheet";
import type { StudioMutation } from "@/shared/studio-mutations";
import { normalizeLayout } from "../model/schema";
export class SheetSaveError extends Error {constructor(message:string,public status:number,public snapshot?:StudioSheetSnapshot){super(message);}}
function snapshot(data:StudioSheetSnapshot):StudioSheetSnapshot {
  if(data.status!=="ok"||typeof data.revision!=="string"||!Number.isFinite(data.fetchedAt))throw Error("Invalid sheet response.");
  return {...data,layout:normalizeLayout(data.layout)};
}
export async function fetchStudioSheet(signal?:AbortSignal):Promise<StudioSheetResponse>{
  const timeout=AbortSignal.timeout(20_000),response=await fetch("/api/admin/studio/layout",{credentials:"include",cache:"no-store",signal:signal?AbortSignal.any([signal,timeout]):timeout});
  if(!response.ok)throw new ApiError(response.status,response.status===401?"Administrator session expired.":"Unable to load a complete, valid layout from Google Sheets.");
  const data=await response.json() as StudioSheetResponse;return data.status==="unconfigured"?data:snapshot(data);
}
export async function saveStudioSheet(operation:StudioMutation):Promise<StudioSheetSnapshot>{
  const response=await fetch("/api/admin/studio/mutations",{method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(operation),signal:AbortSignal.timeout(30_000)});
  const data=await response.json() as StudioSheetSnapshot&{error?:{message?:string};snapshot?:StudioSheetSnapshot};
  if(!response.ok)throw new SheetSaveError(data.error?.message??"Save not confirmed. Retry will check the existing operation first.",response.status,data.snapshot?snapshot(data.snapshot):undefined);
  return snapshot(data);
}
