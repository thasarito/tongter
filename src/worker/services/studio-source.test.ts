// @vitest-environment node
import { expect, it, vi } from "vitest";
import { defaultLayout } from "@/client/studio/model/defaults";
import { STUDIO_GUEST_COLUMNS, STUDIO_OBJECT_COLUMNS, STUDIO_RANGES } from "@/shared/studio-sheet";
import { createSnapshotRepository } from "./snapshot";
import { createSheetsApi } from "../google/sheets-api";
function ranges(){const items=defaultLayout().items;return [{values:[["key","value"],["syncStatus","complete"],["version","3"],["title","Synthetic"],["units","metres"]]},{values:[[...STUDIO_GUEST_COLUMNS]]},{values:[[...STUDIO_OBJECT_COLUMNS],...items.map(item=>STUDIO_OBJECT_COLUMNS.map(key=>{const v=item[key as keyof typeof item];return v==null?"":String(v);}))]}];}
it("rereads the studio tabs on every sequential request instead of reusing the legacy cache",async()=>{
  const api={batchGet:vi.fn(async()=>ranges()),append:vi.fn(async()=>{})};const repository=createSnapshotRepository({api,now:()=>123});
  await repository.getStudioLayout!();await repository.getStudioLayout!();
  expect(api.batchGet).toHaveBeenCalledTimes(2);expect(api.batchGet).toHaveBeenNthCalledWith(1,STUDIO_RANGES,true);expect(api.append).not.toHaveBeenCalled();
});
it("reads raw decimal and boolean cell values without losing precision",async()=>{
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({valueRanges:[{values:[[7.384615384615384,false,true,"Thai text"]]}]}),{status:200}));
  const api=createSheetsApi({spreadsheetId:"synthetic",getAccessToken:async()=>"synthetic-token",fetcher:fetcher as unknown as typeof fetch});
  const data=await api.batchGet(["StudioObjects!A:N"],true);
  expect(data[0].values?.[0]).toEqual(["7.384615384615384","false","true","Thai text"]);
  const first=fetcher.mock.calls[0] as unknown as [string,RequestInit];expect(new URL(first[0]).searchParams.get("valueRenderOption")).toBe("UNFORMATTED_VALUE");
});
