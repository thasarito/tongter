// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { adminRoutes } from "./admin";
import { ADMIN_COOKIE, createAdminSession } from "../auth/admin-session";
import type { AppDependencies } from "../dependencies";
import type { WorkerBindings } from "../env";
import type { Snapshot } from "@/shared/types";
const now=()=>Date.parse("2026-01-01T00:00:00Z");
const env:WorkerBindings={GOOGLE_SHEET_ID:"",GOOGLE_CREDENTIALS_JSON:"",ADMIN_PASSPHRASE:"synthetic-test-only",ADMIN_SESSION_SECRET:"synthetic-test-session-secret-not-for-production"};
function fixture(){
  const snapshot:Snapshot={status:"ok",fetchedAt:now(),warnings:[],guests:[{guestId:"test-person",nameTh:"ทดสอบ",nameEn:"Test",groupId:"test-group",tableId:1,seatIndex:1,side:null,tags:[],token:"PRIVATE_TEST_TOKEN"}],groups:[],rsvps:[]};
  const repository={getSnapshot:vi.fn(async()=>snapshot),invalidate:vi.fn(),appendRsvp:vi.fn(async()=>{})};
  const dependencies:AppDependencies={repositoryFor:()=>repository,now};return {app:adminRoutes(dependencies),repository};
}
describe("GET /api/admin/studio/guests",()=>{
  it("requires a valid administrator session before loading the roster",async()=>{
    const {app,repository}=fixture(),response=await app.request("http://test/studio/guests",{},env);
    expect(response.status).toBe(401);expect(repository.getSnapshot).not.toHaveBeenCalled();
  });
  it("returns a no-store read-only DTO without private invitation tokens",async()=>{
    const {app,repository}=fixture(),token=await createAdminSession({secret:env.ADMIN_SESSION_SECRET,now});
    const response=await app.request("http://test/studio/guests",{headers:{Cookie:`${ADMIN_COOKIE}=${token}`}},env);
    expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("no-store");
    const text=await response.text();expect(text).not.toContain("PRIVATE_TEST_TOKEN");expect(JSON.parse(text).guests[0].sourceSeatNumber).toBe(1);
    expect(repository.appendRsvp).not.toHaveBeenCalled();expect(repository.invalidate).not.toHaveBeenCalled();
  });
});
