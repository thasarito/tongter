// @vitest-environment node
import { describe, expect, it } from "vitest";
import { adminRoutes } from "./admin";
import { ADMIN_COOKIE, verifyAdminSession } from "../auth/admin-session";
import type { AppDependencies } from "../dependencies";
import type { WorkerBindings } from "../env";

// A verifier for the explicitly requested preview password, not a session secret.
const hash="pbkdf2-sha256$100000$9bdff9b394f219b6786dc1ea771ba7c3$34d9acc60aa9a5a6a7c2886369f4ff6bf7763881164463a9898e312006545ddf";
const now=()=>Date.parse("2026-09-16T00:00:00Z");
const env:WorkerBindings&{ADMIN_PASSPHRASE_HASH:string}={GOOGLE_SHEET_ID:"",GOOGLE_CREDENTIALS_JSON:"",ADMIN_PASSPHRASE:"",ADMIN_PASSPHRASE_HASH:hash,ADMIN_SESSION_SECRET:"synthetic-signing-secret-for-tests-only"};
const deps:AppDependencies={now,repositoryFor:()=>({getSnapshot:async()=>({status:"ok",fetchedAt:now(),warnings:[],groups:[],guests:[],rsvps:[]}),invalidate(){},async appendRsvp(){}})};
const login=(passphrase:string,bindings=env)=>adminRoutes(deps).request("https://test/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({passphrase})},bindings);

describe("hashed administrator passphrase",()=>{
  it("accepts 122 with only its salted hash configured and issues a signed HttpOnly session",async()=>{
    const response=await login("122");expect(response.status).toBe(204);
    const cookie=response.headers.get("set-cookie")??"";expect(cookie).toContain("HttpOnly");expect(cookie).toContain("Secure");expect(cookie).toContain("SameSite=Lax");
    const token=cookie.match(new RegExp(`${ADMIN_COOKIE}=([^;]+)`))?.[1];expect(token).toBeTruthy();
    expect(await verifyAdminSession(token!,{secret:env.ADMIN_SESSION_SECRET,now})).toBe(true);
  });
  it("rejects a wrong password and replay of the stored verifier",async()=>{
    expect((await login("123")).status).toBe(401);expect((await login(hash)).status).toBe(401);
  });
  it("prefers the explicit hash over the old plaintext secret",async()=>{
    const bindings={...env,ADMIN_PASSPHRASE:"old-secret"};expect((await login("122",bindings)).status).toBe(204);expect((await login("old-secret",bindings)).status).toBe(401);
  });
  it("fails closed for malformed hashes and missing signing keys",async()=>{
    expect((await login("old-secret",{...env,ADMIN_PASSPHRASE:"old-secret",ADMIN_PASSPHRASE_HASH:"not-a-verifier"})).status).toBe(401);
    expect((await login("122",{...env,ADMIN_SESSION_SECRET:""})).status).not.toBe(204);
  });
  it("keeps existing plaintext-only environments compatible",async()=>{
    expect((await login("legacy",{...env,ADMIN_PASSPHRASE:"legacy",ADMIN_PASSPHRASE_HASH:""})).status).toBe(204);
  });
});
