/** Read-only verification against a deployed PR preview. No screenshots, traces,
 * roster bodies, cookies or invitation tokens are logged or uploaded. */
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import type { StudioLayout } from "../src/client/studio/model/schema.ts";
import type { StudioSheetSnapshot } from "../src/shared/studio-sheet.ts";

const url=new URL(process.env.PREVIEW_URL??"http://invalid");
const passphrase=process.env.STUDIO_PREVIEW_PASSPHRASE;
if(url.protocol!=="https:"||!/^pr-\d+-warissara-wedding\.[a-z0-9-]+\.workers\.dev$/.test(url.hostname)||!passphrase)throw Error("Expected a PR preview URL and its administrator test credential.");
function stable(value:unknown):unknown {
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,stable(item)]));
  return value;
}
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
function check(condition:unknown,message:string):asserts condition{if(!condition)throw Error(message);}
let stage="browser startup";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try{
  for(const mobile of [false,true]){
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:960},isMobile:mobile,hasTouch:mobile,acceptDownloads:true});
    try{
      stage="unauthenticated endpoint protection";
      const denied=await context.request.get(new URL("/api/admin/studio/layout",url).href);
      check(denied.status()===401,"The layout endpoint is not protected.");
      stage="administrator authentication";
      const login=await context.request.post(new URL("/api/admin/login",url).href,{data:{passphrase}});
      check(login.status()===204,"Preview authentication failed.");
      // A stale on-device fixture must never take priority over the live workbook.
      await context.addInitScript(()=>localStorage.setItem("tongter:glass-house-react:v1",JSON.stringify({version:3,title:"Stale synthetic local fixture",units:"metres",items:[],guestList:[{id:"stale-synthetic",name:"Stale synthetic guest",tableId:"",seatNumber:null}]})));
      const page=await context.newPage();page.setDefaultTimeout(30_000);let pageErrors=0;page.on("pageerror",()=>{pageErrors++;});
      stage="first live sheet response";
      const responsePromise=page.waitForResponse(response=>new URL(response.url()).pathname==="/api/admin/studio/layout");
      await page.goto(new URL("/admin/studio",url).href,{waitUntil:"domcontentloaded"});
      const response=await responsePromise;
      check(response.status()===200,"Live sheet response was not successful.");
      const snapshot=await response.json() as StudioSheetSnapshot;
      check(snapshot.status==="ok"&&snapshot.source==="Google Sheets"&&Array.isArray(snapshot.layout?.guestList),"Preview is not using the real Google Sheet.");
      check(response.headers()["cache-control"]==="no-store","Private response is cacheable.");
      await page.getByRole("main",{name:"Glass House administrator planning studio"}).waitFor();
      await page.getByText("Live Google Sheet",{exact:true}).waitFor();
      const assigned=snapshot.layout.guestList.filter(g=>g.tableId),tables=snapshot.layout.items.filter(t=>t.kind==="table");
      stage="rendered chair assignment comparison";
      const rendered=await page.locator(".studio-plan .studio-seat[data-guest-drag]").evaluateAll(nodes=>nodes.map(node=>({id:node.getAttribute("data-guest-drag"),tableId:node.getAttribute("data-seat-table"),seatNumber:Number(node.getAttribute("data-seat-number"))})).sort((a,b)=>String(a.id).localeCompare(String(b.id))));
      const expected=assigned.map(g=>({id:g.id,tableId:g.tableId,seatNumber:g.seatNumber})).sort((a,b)=>a.id.localeCompare(b.id));
      check(hash(rendered)===hash(expected),"The rendered seat assignments differ from the live sheet response.");
      check(await page.locator(".studio-plan .studio-seat").count()===tables.reduce((sum,t)=>sum+t.seats,0),"The site has the wrong seat capacity.");
      stage="rendered name comparison";
      const names=await page.locator(".studio-plan .studio-name-badge").evaluateAll(nodes=>nodes.map(node=>({id:node.getAttribute("data-guest-drag"),name:Array.from(node.querySelectorAll("tspan")).map(span=>span.textContent??"").join("").replace(/\s/g,"")})).sort((a,b)=>String(a.id).localeCompare(String(b.id))));
      const expectedNames=assigned.map(g=>({id:g.id,name:g.name.replace(/\s/g,"")})).sort((a,b)=>a.id.localeCompare(b.id));
      check(hash(names)===hash(expectedNames),"The rendered guest names differ from the live sheet response.");
      stage="complete exported project comparison";
      const downloaded=page.waitForEvent("download");await page.getByRole("button",{name:"Save JSON",exact:true}).click();
      const download=await downloaded,stream=await download.createReadStream();check(stream,"No project export stream.");
      const parts:Buffer[]=[];for await(const chunk of stream)parts.push(Buffer.from(chunk));
      const exported=JSON.parse(Buffer.concat(parts).toString("utf8")) as StudioLayout;
      check(hash(exported)===hash(snapshot.layout),"The studio's complete project differs from the current sheet data.");
      await download.delete();
      stage="reload remains sheet authoritative";
      const afterReload=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/admin/studio/layout");await page.reload({waitUntil:"domcontentloaded"});check((await afterReload).status()===200,"Reload did not read Sheets.");await page.getByText("Live Google Sheet",{exact:true}).waitFor();
      check(pageErrors===0,"The live studio emitted a browser error.");
      console.log(`PASS live ${mobile?"mobile":"desktop"}: ${snapshot.layout.guestList.length} guests; ${assigned.length} assigned; ${snapshot.layout.guestList.length-assigned.length} unassigned; ${tables.length} tables; ${snapshot.layout.items.length} objects. Names, exact seats, full exported layout and reload match Sheets.`);
    }finally{await context.close();}
  }
}catch{
  // Never print an assertion diff or Playwright snapshot containing private names.
  console.error(`Live studio verification failed during: ${stage}. No guest data was logged.`);
  process.exitCode=1;
}finally{await browser.close();}
