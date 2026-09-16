import { ApiError } from "@/client/api/client";
import type { StudioSheetResponse } from "@/shared/studio-sheet";
import { normalizeLayout } from "../model/schema";

export async function fetchStudioSheet(signal?:AbortSignal):Promise<StudioSheetResponse> {
  const timeout=AbortSignal.timeout(20_000);
  const response=await fetch("/api/admin/studio/layout",{
    credentials:"include",cache:"no-store",signal:signal?AbortSignal.any([signal,timeout]):timeout,
  });
  if(!response.ok)throw new ApiError(response.status,response.status===401?"Administrator session expired.":"Unable to load a complete, valid layout from Google Sheets. Your previous draft has not been substituted.");
  const data=await response.json() as StudioSheetResponse;
  if(data.status==="unconfigured")return data;
  if(data.status!=="ok"||typeof data.revision!=="string"||!Number.isFinite(data.fetchedAt))throw Error("Invalid studio sheet response.");
  return {...data,layout:normalizeLayout(data.layout)};
}
