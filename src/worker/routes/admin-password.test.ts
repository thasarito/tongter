// @vitest-environment node
import { describe, expect, it } from "vitest";
import { adminRoutes } from "./admin";
import { ADMIN_COOKIE, verifyAdminSession } from "../auth/admin-session";
import type { AppDependencies } from "../dependencies";
import type { WorkerBindings } from "../env";

// Synthetic local-only PIN verifier, deliberately separate from deployment config.
const hash="pbkdf2-sha256$100000$00112233445566778899aabbccddeeff$dd5e96e6353c198145c1bfe95ee215bc096f4900e821a61c25d3c842fef75ea9";
const now=()=>Date.parse("2026-09-16T00:00:00Z");
const env:WorkerBindings&{ADMIN_PASSPHRASE_HASH:string}={GOOGLE_SHEET_ID:"",GOOGLE_CREDENTIALS_JSON:"",ADMIN_PASSPHRASE:"",ADMIN_PASSPHRASE_HASH:hash,ADMIN_SESSION_SECRET:"synthetic-signing-secret-for-tests-only"};
const deps:AppDependencies={now,repositoryFor:()=>({getSnapshot:async()=>({status:"ok",fetchedAt:now(),warnings:[],groups:[],guests:[],rsvps:[]}),invalidate(){},async appendRsvp(){}})};
const login=(passphrase:string,bindings=env)=>adminRoutes(deps).request("https://test/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({passphrase})},bindings);

describe("hashed administrator passphrase",()=>{
  it("accepts the synthetic PIN with only its salted hash configured and issues a signed HttpOnly session",async()=>{
    const response=await login("1357");expect(response.status).toBe(204);
    const cookie=response.headers.get("set-cookie")??"";expect(cookie).toContain("HttpOnly");expect(cookie).toContain("Secure");expect(cookie).toContain("SameSite=Lax");
    const token=cookie.match(new RegExp(`${ADMIN_COOKIE}=([^;]+)`))?.[1];expect(token).toBeTruthy();
    expect(await verifyAdminSession(token!,{secret:env.ADMIN_SESSION_SECRET,now})).toBe(true);
  });
  it("rejects a wrong password and replay of the stored verifier",async()=>{
    expect((await login("1234")).status).toBe(401);expect((await login(hash)).status).toBe(401);
  });
  it("prefers the explicit hash over the old plaintext secret",async()=>{
    const bindings={...env,ADMIN_PASSPHRASE:"old-secret"};expect((await login("1357",bindings)).status).toBe(204);expect((await login("old-secret",bindings)).status).toBe(401);
  });
  it("fails closed for malformed hashes and missing signing keys",async()=>{
    expect((await login("old-secret",{...env,ADMIN_PASSPHRASE:"old-secret",ADMIN_PASSPHRASE_HASH:"not-a-verifier"})).status).toBe(401);
    expect((await login("1357",{...env,ADMIN_SESSION_SECRET:""})).status).not.toBe(204);
  });
  it("keeps existing plaintext-only API environments compatible",async()=>{
    expect((await login("legacy",{...env,ADMIN_PASSPHRASE:"legacy",ADMIN_PASSPHRASE_HASH:""})).status).toBe(204);
  });
});
