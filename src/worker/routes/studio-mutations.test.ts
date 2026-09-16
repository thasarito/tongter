// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { adminRoutes } from "./admin";
import { ADMIN_COOKIE, createAdminSession } from "../auth/admin-session";
import { defaultLayout } from "@/client/studio/model/defaults";
const now=()=>Date.parse("2026-09-16T00:00:00Z");
const secret="synthetic-studio-write-session-secret";
async function setup(){
  const layout=defaultLayout();
  const write=vi.fn(async()=>Response.json({status:"ok",source:"Google Sheets",revision:"test",fetchedAt:now(),layout}));
  const env={GOOGLE_SHEET_ID:"synthetic-sheet",GOOGLE_CREDENTIALS_JSON:"synthetic-credentials",ADMIN_PASSPHRASE:"test",ADMIN_SESSION_SECRET:secret,STUDIO_WRITER:{idFromName:vi.fn((name:string)=>name),get:()=>({fetch:write})}};
  const repository={getSnapshot:vi.fn(),invalidate:vi.fn(),appendRsvp:vi.fn()};
  const app=adminRoutes({repositoryFor:()=>repository,now});
  const session=await createAdminSession({secret,now});
  const headers={Cookie:`${ADMIN_COOKIE}=${session}`,"Content-Type":"application/json",Origin:"http://test"};
  return {app,env,write,headers,layout};
}
describe("studio autosave write boundary",()=>{
  it("authenticates before reaching the shared sheet writer",async()=>{const f=await setup();const r=await f.app.request("http://test/studio/mutations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:"synthetic-operation",changes:[]})},f.env);expect(r.status).toBe(401);expect(f.write).not.toHaveBeenCalled();});
  it("forwards an authenticated valid operation to the per-sheet coordinator",async()=>{const f=await setup();const r=await f.app.request("http://test/studio/mutations",{method:"POST",headers:f.headers,body:JSON.stringify({id:"synthetic-operation",changes:[]})},f.env);expect(r.status).toBe(200);expect(r.headers.get("cache-control")).toBe("no-store");expect(f.write).toHaveBeenCalledOnce();expect((await r.json()).layout).toEqual(f.layout);});
  it("rejects cross-origin writes even with a valid session",async()=>{const f=await setup();const r=await f.app.request("http://test/studio/mutations",{method:"POST",headers:{...f.headers,Origin:"https://different.example"},body:JSON.stringify({id:"synthetic-operation",changes:[]})},f.env);expect(r.status).toBe(403);expect(f.write).not.toHaveBeenCalled();});
  it("rejects malformed writes before any sheet mutation",async()=>{const f=await setup();const r=await f.app.request("http://test/studio/mutations",{method:"POST",headers:f.headers,body:'{"changes":"not an array"}'},f.env);expect(r.status).toBe(400);expect(f.write).not.toHaveBeenCalled();});
});
