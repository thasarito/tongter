/** Read-only live verification. Empty mutations probe the writer without changing
 * guest cells or creating receipts. Never log private bodies/cookies/screenshots. */
import { createHash,randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
import type { StudioSheetSnapshot } from "../src/shared/studio-sheet.ts";
const url=new URL(process.env.PREVIEW_URL??"http://invalid"),passphrase=process.env.STUDIO_PREVIEW_PASSPHRASE;
if(url.protocol!=="https:"||!/^pr-\d+-warissara-wedding\.[a-z0-9-]+\.workers\.dev$/.test(url.hostname)||!passphrase)throw Error("Expected a PR preview URL and administrator credential.");
function stable(v:unknown):unknown{if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object")return Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)]));return v;}
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
function check(v:unknown,m:string):asserts v{if(!v)throw Error(m);}
let stage="startup";const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:960},isMobile:mobile,hasTouch:mobile});
  try{
   stage="authentication";check((await context.request.get(new URL("/api/admin/studio/layout",url).href)).status()===401,"Unprotected layout");check((await context.request.post(new URL("/api/admin/login",url).href,{data:{passphrase}})).status()===204,"Login failed");
   await context.addInitScript(()=>localStorage.setItem("tongter:glass-house-react:v1",JSON.stringify({version:3,title:"Stale synthetic draft",units:"metres",items:[],guestList:[{id:"stale-test",name:"Stale synthetic guest"}]})));
   const page=await context.newPage();page.setDefaultTimeout(30_000);let pageErrors=0;page.on("pageerror",()=>{pageErrors++;});
   stage="live sheet load";const responsePromise=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/admin/studio/layout");await page.goto(new URL("/admin/studio",url).href,{waitUntil:"domcontentloaded"});const response=await responsePromise;
   check(response.status()===200&&response.headers()["cache-control"]==="no-store","Private sheet response failed");const snapshot=await response.json() as StudioSheetSnapshot;check(snapshot.status==="ok"&&snapshot.source==="Google Sheets","Not a live sheet");
   await page.getByRole("main",{name:"Glass House administrator planning studio"}).waitFor();await page.getByText("Live Google Sheet · autosave",{exact:true}).waitFor();
   const assigned=snapshot.layout.guestList.filter(g=>g.tableId),tables=snapshot.layout.items.filter(t=>t.kind==="table");
   stage="seat and name comparison";
   const actual=await page.locator('.studio-plan .studio-seat[data-guest-drag]').evaluateAll(nodes=>nodes.map(n=>({id:n.getAttribute('data-guest-drag'),tableId:n.getAttribute('data-seat-table'),seatNumber:Number(n.getAttribute('data-seat-number'))})).sort((a,b)=>String(a.id).localeCompare(String(b.id))));
   check(hash(actual)===hash(assigned.map(g=>({id:g.id,tableId:g.tableId,seatNumber:g.seatNumber})).sort((a,b)=>a.id.localeCompare(b.id))),"Seat mismatch");check(await page.locator('.studio-plan .studio-seat').count()===tables.reduce((n,t)=>n+t.seats,0),"Capacity mismatch");
   const names=await page.locator('.studio-plan .studio-name-badge').evaluateAll(nodes=>nodes.map(n=>({id:n.getAttribute('data-guest-drag'),name:Array.from(n.querySelectorAll('tspan')).map(t=>t.textContent??'').join('').replace(/\s/g,'')})).sort((a,b)=>String(a.id).localeCompare(String(b.id))));
   check(hash(names)===hash(assigned.map(g=>({id:g.id,name:g.name.replace(/\s/g,'')})).sort((a,b)=>a.id.localeCompare(b.id))),"Name mismatch");
   stage="geometry and JSON UI checks";const objects=await page.locator('.studio-plan [data-furniture]').evaluateAll(nodes=>nodes.map(n=>({id:n.getAttribute('data-furniture'),transform:n.parentElement?.getAttribute('transform')})).sort((a,b)=>String(a.id).localeCompare(String(b.id))));
   const expected=snapshot.layout.items.map(t=>({id:t.id,transform:`translate(${t.x} ${t.z}) rotate(${t.rotation})`})).sort((a,b)=>a.id.localeCompare(b.id));check(hash(objects)===hash(expected),"Geometry mismatch");check(await page.getByRole('button',{name:'Save JSON',exact:true}).count()===0,"JSON export remains visible");
   stage="read-only writer probe";const probe=await context.request.post(new URL('/api/admin/studio/mutations',url).href,{headers:{Origin:url.origin},data:{id:randomUUID(),changes:[]},timeout:90_000});check(probe.status()===200,"Writer unavailable");const result=await probe.json() as StudioSheetSnapshot;check(result.status==="ok"&&result.source==="Google Sheets","Writer response invalid");
   stage="sheet-authoritative reload";const reload=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/admin/studio/layout");await page.reload({waitUntil:'domcontentloaded'});check((await reload).status()===200,"Reload failed");await page.getByText("Live Google Sheet · autosave",{exact:true}).waitFor();check(pageErrors===0,"Browser error");
   console.log(`PASS live ${mobile?'mobile':'desktop'}: ${snapshot.layout.guestList.length} guests; ${assigned.length} seated; ${tables.length} tables. Sheet names, seats, geometry, reload and read-only writer probe verified. No guest data was logged.`);
  }finally{await context.close();}
 }
}catch{console.error(`Live studio verification failed during: ${stage}. No guest data was logged.`);process.exitCode=1;}finally{await browser.close();}
