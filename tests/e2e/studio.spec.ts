import { expect,test,type Locator,type Page } from "@playwright/test";
import { normalizeLayout } from "../../src/client/studio/model/schema";
import { applyMutation,type StudioMutation } from "../../src/shared/studio-mutations";
test.use({launchOptions:{args:["--enable-unsafe-swiftshader"]}});
const fixture=()=>normalizeLayout({version:3,title:"Synthetic sheet verification",units:"metres",items:[{id:"table-1",kind:"table",shape:"oval",label:"1",x:0,z:0,w:2,d:1.2,h:.76,rotation:0,seats:10,locked:false}],guestList:[{id:"test-alice",name:"Alice",tableId:"table-1",seatNumber:1},{id:"test-bob",name:"Bob",tableId:"table-1",seatNumber:6}]});
async function openStudio(page:Page,scenario:"normal"|"conflict"|"lost"="normal"){
  let layout=fixture(),revision=0;const operations:StudioMutation[]=[],receipts=new Set<string>();
  const snapshot=()=>({status:"ok",source:"Google Sheets",layout,revision:String(revision),fetchedAt:Date.now()});
  await page.route("**/api/admin/studio/layout",route=>route.fulfill({json:snapshot()}));
  await page.route("**/api/admin/studio/mutations",async route=>{
    const operation=route.request().postDataJSON() as StudioMutation;operations.push(operation);
    if(scenario==="conflict"&&operations.length===1){layout.guestList[0].tableId="";layout.guestList[0].seatNumber=null;layout=normalizeLayout(layout);revision++;await route.fulfill({status:409,json:{error:{message:"The same guest changed elsewhere."},snapshot:snapshot()}});return;}
    if(!receipts.has(operation.id)){layout=applyMutation(layout,operation);receipts.add(operation.id);revision++;}
    if(scenario==="lost"&&operations.length===1){await route.abort("failed");return;}
    await route.fulfill({json:{...snapshot(),operationId:operation.id}});
  });
  await page.goto("/admin/studio");await page.getByLabel("Administrator passphrase").fill("local-e2e-passphrase");await page.getByRole("button",{name:"Open studio",exact:true}).click();
  await expect(page.locator('.studio-plan .studio-name-badge')).toHaveCount(2);return {operations,read:()=>layout};
}
const approve=(page:Page,name="Confirm & save")=>page.locator("[data-sheet-confirmation]").getByRole("button",{name,exact:true}).click();
const badge=(page:Page,id:string)=>page.locator(`.studio-plan .studio-name-badge[data-guest-drag="${id}"]`);
async function drag(page:Page,source:Locator,target:Locator,mobile:boolean,hold?:()=>Promise<void>){
  const a=await source.boundingBox(),b=await target.boundingBox();if(!a||!b)throw Error("Missing drag target");const start={x:a.x+a.width/2,y:a.y+a.height/2},end={x:b.x+b.width/2,y:b.y+b.height/2};
  if(mobile){const session=await page.context().newCDPSession(page);await session.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[start]});for(let i=1;i<=16;i++)await session.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:start.x+(end.x-start.x)*i/16,y:start.y+(end.y-start.y)*i/16}]});await hold?.();await session.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await session.detach();}
  else{await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:16});await hold?.();await page.mouse.up();}
}
test("saves one swap on drop with bounded feedback and no JSON controls",async({page,isMobile},testInfo)=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));const sheet=await openStudio(page);
  await page.getByRole("button",{name:"More panel",exact:true}).click();await expect(page.getByRole("button",{name:"Save JSON",exact:true})).toHaveCount(0);await expect(page.locator('.studio-more-tools input[type=file]')).toHaveAttribute("accept",".csv,text/csv");await page.getByRole("button",{name:"Close planning tools",exact:true}).click();
  await expect(badge(page,"test-alice").locator("text")).toHaveText("Alice");
  await drag(page,badge(page,"test-alice").locator("rect"),badge(page,"test-bob").locator("rect"),isMobile,async()=>{
    await expect(badge(page,"test-bob")).toHaveAttribute("data-drag-over","valid");expect(sheet.operations).toHaveLength(0);
    const metrics=await badge(page,"test-bob").evaluate(el=>({outline:getComputedStyle(el).outlineStyle,vector:getComputedStyle(el.querySelector('rect')!).vectorEffect,stroke:getComputedStyle(el.querySelector('rect')!).strokeWidth,selection:window.getSelection()?.toString()}));
    expect(metrics.outline).toBe("none");expect(metrics.vector).toBe("non-scaling-stroke");expect(metrics.stroke).toBe("2px");expect(metrics.selection).toBe("");const ghost=await page.locator('.studio-drag-ghost').boundingBox();expect(ghost!.width).toBeLessThanOrEqual(270);expect(ghost!.height).toBeLessThan(160);
    await testInfo.attach("bounded-drag-feedback",{body:await page.screenshot(),contentType:"image/png"});
  });
  const review=page.getByRole("dialog",{name:"Swap guest seats"});await expect(review).toBeVisible();
  await expect(review).toContainText("Alice");await expect(review).toContainText("Bob");await expect(review).toContainText("Table 1 · Seat 6");expect(sheet.operations).toHaveLength(0);
  await approve(page);
  await expect.poll(()=>sheet.read().guestList[0].seatNumber).toBe(6);await expect(badge(page,"test-alice")).toHaveAttribute("data-seat-number","6");await expect(page.locator('[aria-label="Sheet synchronization status"]')).toHaveAttribute('data-save-pending','false');expect(sheet.operations).toHaveLength(1);
  await page.getByRole("button",{name:"More panel",exact:true}).click();await page.getByRole("button",{name:"Undo",exact:true}).click();await approve(page);await expect.poll(()=>sheet.read().guestList[0].seatNumber).toBe(1);expect(sheet.operations).toHaveLength(2);await expect(page.getByRole("button",{name:"Redo",exact:true})).toBeEnabled();await page.reload();await expect(badge(page,"test-alice")).toHaveAttribute("data-seat-number","1");expect(errors).toEqual([]);
});
test("same-seat conflict preserves the other administrator's change",async({page,isMobile})=>{const sheet=await openStudio(page,"conflict");await drag(page,badge(page,"test-alice").locator("rect"),badge(page,"test-bob").locator("rect"),isMobile);await approve(page);await expect(badge(page,"test-alice")).toHaveCount(0);await expect(badge(page,"test-bob")).toHaveAttribute("data-seat-number","6");expect(sheet.operations).toHaveLength(1);await page.getByRole("button",{name:"More panel",exact:true}).click();await expect(page.getByRole("button",{name:"Undo",exact:true})).toBeDisabled();});
test("lost acknowledgement retries the same operation without double-swapping",async({page,isMobile})=>{const sheet=await openStudio(page,"lost");await drag(page,badge(page,"test-alice").locator("rect"),badge(page,"test-bob").locator("rect"),isMobile);await approve(page);await page.getByRole("button",{name:"Retry save",exact:true}).click();await approve(page,"Confirm retry");await expect(page.locator('[aria-label="Sheet synchronization status"]')).toHaveAttribute('data-save-pending','false');expect(sheet.operations).toHaveLength(2);expect(sheet.operations[0].id).toBe(sheet.operations[1].id);expect(sheet.read().guestList[0].seatNumber).toBe(6);await expect(badge(page,"test-alice")).toHaveAttribute("data-seat-number","6");});
test("loads the real R3F scene with name-only labels",async({page},testInfo)=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));await openStudio(page);await page.getByRole("button",{name:"View panel",exact:true}).click();await page.getByRole("button",{name:"3D model",exact:true}).click();await expect(page.locator(".studio-three-view canvas")).toBeVisible();const name=page.locator('.studio-seat-name-label[data-guest-drag="test-alice"]');await expect(name).toBeVisible({timeout:20_000});await expect(name).toHaveText("Alice");await expect(name.locator("small")).toHaveCount(0);await expect(page.locator(".studio-render-fallback:visible")).toHaveCount(0);
  await expect.poll(()=>page.locator(".studio-three-view canvas").evaluate((node:HTMLCanvasElement)=>{const gl=node.getContext("webgl2");if(!gl||gl.isContextLost())return false;const pixel=new Uint8Array(4),colors=new Set<string>();for(const x of [.2,.35,.5,.65,.8])for(const y of [.2,.35,.5,.65,.8]){gl.readPixels(Math.floor(x*node.width),Math.floor(y*node.height),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);colors.add(Array.from(pixel).join(","));}return colors.size>1;}),{timeout:15_000}).toBe(true);await testInfo.attach("r3f-sheet-labels",{body:await page.screenshot(),contentType:"image/png"});expect(errors).toEqual([]);
});
test("cancel and Escape leave a reviewed swap unapplied",async({page,isMobile})=>{
  const sheet=await openStudio(page);
  await drag(page,badge(page,"test-alice").locator("rect"),badge(page,"test-bob").locator("rect"),isMobile);
  const review=page.getByRole("dialog",{name:"Swap guest seats"});
  await expect(review.getByRole("button",{name:"Cancel",exact:true})).toBeFocused();
  await review.getByRole("button",{name:"Cancel",exact:true}).click();
  expect(sheet.operations).toHaveLength(0);await expect(badge(page,"test-alice")).toHaveAttribute("data-seat-number","1");
  await drag(page,badge(page,"test-alice").locator("rect"),badge(page,"test-bob").locator("rect"),isMobile);
  await page.keyboard.press("Escape");await expect(review).toBeHidden();expect(sheet.operations).toHaveLength(0);
});
test("cancelled guest edit retains the entered form values",async({page})=>{
  const sheet=await openStudio(page);
  await page.getByRole("button",{name:"Guests panel",exact:true}).click();
  await page.getByRole("button",{name:"+ Guest",exact:true}).click();
  const form=page.getByRole("dialog",{name:"Add guest",exact:true});
  await form.getByLabel("Name",{exact:true}).fill("Synthetic review guest");
  await form.getByRole("button",{name:"Save guest",exact:true}).click();
  const review=page.locator('[data-sheet-confirmation]');await expect(review).toContainText("Synthetic review guest");
  await review.getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(form.getByLabel("Name",{exact:true})).toHaveValue("Synthetic review guest");expect(sheet.operations).toHaveLength(0);
});
