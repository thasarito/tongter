// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { adminRoutes } from "./admin";
import { ADMIN_COOKIE, createAdminSession } from "../auth/admin-session";
import type { WorkerBindings } from "../env";
import { defaultLayout } from "@/client/studio/model/defaults";
import { normalizeLayout } from "@/client/studio/model/schema";
const now=()=>Date.parse("2026-01-01T00:00:00Z");
const env:WorkerBindings={GOOGLE_SHEET_ID:"synthetic-sheet",GOOGLE_CREDENTIALS_JSON:"",ADMIN_SESSION_SECRET:"synthetic-live-sheet-session-secret"};
function fixture(fail=false){
  const layout=normalizeLayout({...defaultLayout(),guestList:[{id:"test-first",name:"Sheet Guest A",tableId:"table-12",seatNumber:3},{id:"test-last",name:"Sheet Guest B",tableId:"table-12",seatNumber:9},{id:"test-waiting",name:"Waiting Guest",tableId:"",seatNumber:null}]});
  const repository={getSnapshot:vi.fn(async()=>({status:"unconfigured" as const,guests:[],groups:[],rsvps:[],fetchedAt:0,warnings:[]})),invalidate:vi.fn(),appendRsvp:vi.fn(async()=>{}),getStudioLayout:vi.fn(async()=>{if(fail)throw Error("PRIVATE_UPSTREAM_DETAIL");return {status:"ok" as const,layout,revision:"synthetic-revision",fetchedAt:now(),source:"Google Sheets" as const};})};
  const app=adminRoutes({repositoryFor:()=>repository,now});return {app,repository,layout};
}
async function authenticated(){const token=await createAdminSession({secret:env.ADMIN_SESSION_SECRET,now});return {Cookie:`${ADMIN_COOKIE}=${token}`};}
describe("GET /api/admin/studio/layout",()=>{
  it("rejects unauthenticated requests before reading Sheets",async()=>{const {app,repository}=fixture();const response=await app.request("http://test/studio/layout",{},env);expect(response.status).toBe(401);expect(repository.getStudioLayout).not.toHaveBeenCalled();});
  it("returns the sheet's complete layout, exact seats and unassigned guests",async()=>{const {app,repository,layout}=fixture();const response=await app.request("http://test/studio/layout",{headers:await authenticated()},env);expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("no-store");const data=await response.json();expect(data.source).toBe("Google Sheets");expect(data.layout).toEqual(layout);expect(data.layout.guestList.map((g:{seatNumber:number|null})=>g.seatNumber)).toEqual([3,9,null]);expect(repository.getSnapshot).not.toHaveBeenCalled();expect(repository.appendRsvp).not.toHaveBeenCalled();expect(repository.invalidate).not.toHaveBeenCalled();});
  it("reports a failed sheet read instead of returning a stale local/default layout",async()=>{const {app}=fixture(true);const response=await app.request("http://test/studio/layout",{headers:await authenticated()},env);expect(response.status).toBe(503);expect(response.headers.get("cache-control")).toBe("no-store");expect(await response.text()).not.toContain("PRIVATE_UPSTREAM_DETAIL");});
});
