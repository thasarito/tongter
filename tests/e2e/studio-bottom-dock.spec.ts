import { expect, test, type Page, type Locator } from "@playwright/test";
import { normalizeLayout } from "../../src/client/studio/model/schema";
import { applyMutation, type StudioMutation } from "../../src/shared/studio-mutations";
async function open(page:Page){
  let layout=normalizeLayout({version:3,title:"Synthetic bottom navigation",units:"metres",items:[{id:"table-1",kind:"table",shape:"oval",label:"1",x:0,z:0,w:2,d:1.2,h:.76,rotation:0,seats:10,locked:false}],guestList:[{id:"test-alice",name:"Alice",tableId:"table-1",seatNumber:1},...Array.from({length:35},(_,i)=>({id:`waiting-${i}`,name:`Waiting ${String(i).padStart(2,"0")}`,sourceTableId:"family",sourceTableLabel:"Original family",sourceSeatNumber:i+1}))]});
  let revision=0;const writes:StudioMutation[]=[],errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  const snapshot=()=>({status:"ok",source:"Google Sheets",layout,revision:String(revision),fetchedAt:Date.now()});
  await page.route("**/api/admin/studio/layout",route=>route.fulfill({json:snapshot()}));
  await page.route("**/api/admin/studio/mutations",async route=>{const op=route.request().postDataJSON() as StudioMutation;writes.push(op);layout=applyMutation(layout,op);revision++;await route.fulfill({json:{...snapshot(),operationId:op.id}});});
  await page.goto("/admin/studio");await page.getByLabel("Administrator passphrase").fill("local-e2e-passphrase");await page.getByRole("button",{name:"Open studio",exact:true}).click();await expect(page.locator(".studio-plan .studio-name-badge")).toHaveCount(1);return {writes,errors,read:()=>layout};
}
const panel=(page:Page)=>page.locator(".studio-sidebar"),opacity=(el:Locator)=>el.evaluate(e=>Number(getComputedStyle(e).opacity));
async function prepare(page:Page){await page.getByRole("button",{name:"Guests panel",exact:true}).click();await page.getByRole("searchbox",{name:"Search guest book"}).fill("Waiting");await page.getByLabel("Original group",{exact:true}).selectOption("family");const source=page.locator('.studio-roster [data-guest-drag="waiting-12"]');await source.scrollIntoViewIfNeeded();return source;}
async function startDrag(page:Page,source:Locator,mobile:boolean){
  const b=await source.boundingBox();if(!b)throw Error("Guest grip not visible");const start={x:b.x+b.width/2,y:b.y+b.height/2};
  const session=mobile?await page.context().newCDPSession(page):null;
  if(session)await session.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[start]});else{await page.mouse.move(start.x,start.y);await page.mouse.down();}
  return {start,async move(x:number,y:number){if(session)await session.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x,y}]});else await page.mouse.move(x,y);},async end(cancel=false){if(session){await session.send("Input.dispatchTouchEvent",{type:cancel?"touchCancel":"touchEnd",touchPoints:[]});await session.detach();}else{if(cancel)await page.keyboard.press("Escape");await page.mouse.up();}}};
}
test("the viewport has no top toolbar and all navigation lives in the bottom dock",async({page},testInfo)=>{
  const sheet=await open(page);await expect(page.locator(".studio-toolbar")).toHaveCount(0);const dock=page.getByRole("navigation",{name:"Planning panels"});await expect(dock.getByRole("button")).toHaveCount(5);
  for(const name of ["Layout panel","Guests panel","View panel","Selected panel","More panel"])await expect(dock.getByRole("button",{name,exact:true})).toBeVisible();
  await expect(page.locator(".studio-viewport-actions")).toHaveCount(0);const bounds=await page.locator(".studio-bottom-bar").boundingBox();expect(bounds!.y).toBeGreaterThan(page.viewportSize()!.height-150);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await testInfo.attach("bottom-dock",{body:await page.screenshot({path:testInfo.outputPath("bottom-dock.png")}),contentType:"image/png"});expect(sheet.errors).toEqual([]);
});
test("View controls move the existing plan camera without editing sheet data",async({page})=>{
  const sheet=await open(page),svg=page.locator('.studio-plan>svg'),before=await svg.getAttribute("viewBox");await page.getByRole("button",{name:"View panel",exact:true}).click();await page.getByRole("button",{name:"Zoom in",exact:true}).click();await expect(svg).not.toHaveAttribute("viewBox",before!);await page.getByRole("button",{name:"Fit labels",exact:true}).click();await page.getByRole("button",{name:"Floor plan",exact:true}).click();await expect(panel(page)).toBeHidden();expect(sheet.writes).toHaveLength(0);expect(sheet.errors).toEqual([]);
});
test("More exposes files, layers and sheet reload without returning a top toolbar",async({page})=>{
  const sheet=await open(page);await page.getByRole("button",{name:"More panel",exact:true}).click();await expect(page.getByRole("button",{name:"Undo",exact:true})).toBeDisabled();await expect(page.getByRole("button",{name:"Redo",exact:true})).toBeDisabled();await page.getByRole("button",{name:"Files ▾",exact:true}).click();await expect(page.locator('.studio-more-tools input[type=file]')).toHaveAttribute('accept','.csv,text/csv');await expect(page.getByRole("button",{name:"Export guest-table CSV",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"SVG",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"PNG",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Save JSON",exact:true})).toHaveCount(0);await page.getByRole("button",{name:"Reload sheet",exact:true}).click();
  const review=page.locator('[data-sheet-confirmation]');await expect(review).toContainText('read-only');expect(sheet.writes).toHaveLength(0);await review.getByRole('button',{name:'Confirm reload',exact:true}).click();await expect(review).toBeHidden();
  await expect(page.locator('.studio-toolbar')).toHaveCount(0);expect(sheet.writes).toHaveLength(0);
});
test("real guest dragging fades mobile tools and can target a seat beneath the sheet",async({page,isMobile},testInfo)=>{
  const sheet=await open(page),source=await prepare(page),target=page.locator('.studio-plan .studio-seat[data-seat-table="table-1"][data-seat-number="8"]'),b=await target.boundingBox();if(!b)throw Error("Seat missing");const point={x:b.x+b.width/2,y:b.y+b.height/2},bounds=await panel(page).boundingBox();
  if(isMobile){expect(point.y).toBeGreaterThan(bounds!.y);expect(point.y).toBeLessThan(bounds!.y+bounds!.height);}
  const drag=await startDrag(page,source,isMobile);await drag.move(drag.start.x+2,drag.start.y);expect(await page.evaluate(()=>document.body.classList.contains('studio-mobile-guest-drag'))).toBe(false);
  for(let i=1;i<=12;i++)await drag.move(drag.start.x+(point.x-drag.start.x)*i/12,drag.start.y+(point.y-drag.start.y)*i/12);
  await expect.poll(()=>opacity(panel(page))).toBe(isMobile?0:1);
  if(isMobile){await expect.poll(()=>opacity(page.locator('.studio-bottom-bar'))).toBe(0);expect(await panel(page).evaluate(el=>getComputedStyle(el).pointerEvents)).toBe('none');expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.closest('[data-seat-table]')?.getAttribute('data-seat-number'),point)).toBe('8');}
  expect(await page.locator('.studio-plan').evaluate(el=>getComputedStyle(el).opacity)).toBe('1');await expect(target).toHaveAttribute('data-drag-over','valid');expect(sheet.writes).toHaveLength(0);await expect(source).toBeAttached();
  await testInfo.attach("drag-focus",{body:await page.screenshot({path:testInfo.outputPath("drag-focus.png")}),contentType:"image/png"});await drag.end();
  const review=page.locator('[data-sheet-confirmation]');await expect(review).toContainText('Waiting 12');await expect(review).toContainText('Table 1 · Seat 8');expect(sheet.writes).toHaveLength(0);await review.getByRole('button',{name:'Confirm & save',exact:true}).click();
  await expect.poll(()=>sheet.read().guestList.find(g=>g.id==='waiting-12')?.seatNumber).toBe(8);expect(sheet.writes).toHaveLength(1);await expect.poll(()=>opacity(panel(page))).toBe(1);await expect(page.getByRole('searchbox',{name:'Search guest book'})).toHaveValue('Waiting');await expect(page.getByLabel('Original group',{exact:true})).toHaveValue('family');expect(await page.evaluate(()=>scrollY)).toBe(0);expect(sheet.errors).toEqual([]);
});
test("cancel restores the original panel search and scroll without a save",async({page,isMobile})=>{
  const sheet=await open(page),source=await prepare(page),scroll=await page.locator('.studio-sidebar-scroll').evaluate(el=>el.scrollTop),drag=await startDrag(page,source,isMobile);await drag.move(drag.start.x+30,drag.start.y-25);await expect(page.locator('.studio-drag-ghost')).toBeVisible();await drag.end(true);await expect.poll(()=>opacity(panel(page))).toBe(1);await expect(page.getByRole('searchbox',{name:'Search guest book'})).toHaveValue('Waiting');await expect(page.getByLabel('Original group',{exact:true})).toHaveValue('family');expect(await page.locator('.studio-sidebar-scroll').evaluate(el=>el.scrollTop)).toBe(scroll);expect(await page.evaluate(()=>document.body.classList.contains('studio-mobile-guest-drag'))).toBe(false);expect(sheet.writes).toHaveLength(0);await expect(source).toBeAttached();expect(sheet.errors).toEqual([]);
});
test("blur and reduced-motion settings cannot leave tools faded",async({page,isMobile})=>{
  await page.emulateMedia({reducedMotion:'reduce'});const sheet=await open(page),source=await prepare(page),drag=await startDrag(page,source,isMobile);await drag.move(drag.start.x+20,drag.start.y-20);expect(await panel(page).evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await drag.end(true);await expect.poll(()=>opacity(panel(page))).toBe(1);expect(await page.evaluate(()=>document.body.classList.contains('studio-mobile-guest-drag'))).toBe(false);expect(sheet.writes).toHaveLength(0);expect(sheet.errors).toEqual([]);
});
