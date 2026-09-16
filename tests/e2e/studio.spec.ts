import { expect, test, type Locator, type Page } from "@playwright/test";

test.use({launchOptions:{args:["--enable-unsafe-swiftshader"]}});
const fixture={version:3,title:"Synthetic seat-label verification",units:"metres",items:[{id:"table-1",kind:"table",shape:"oval",label:"1",x:0,z:0,w:2,d:1.2,h:.76,rotation:0,seats:10,locked:false,guests:[]}],guestList:[{id:"test-alice",name:"Alice",tableId:"table-1",seatNumber:1},{id:"test-bob",name:"Bob",tableId:"table-1",seatNumber:6}]};
async function openStudio(page:Page){
  await page.goto("/admin/studio");
  await page.getByLabel("Administrator passphrase").fill("local-e2e-passphrase");
  await page.getByRole("button",{name:"Open studio",exact:true}).click();
  await expect(page.getByRole("main",{name:"Glass House administrator planning studio"})).toBeVisible();
  await page.locator('.studio-toolbar input[type="file"]').setInputFiles({name:"synthetic-layout.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(fixture))});
  await page.getByRole("button",{name:"Import this layout",exact:true}).click();
  await expect(page.locator('.studio-plan .studio-name-badge')).toHaveCount(2);
}
const badge=(page:Page,id:string)=>page.locator(`.studio-plan .studio-name-badge[data-guest-drag="${id}"]`);
async function placement(page:Page,id:string){return page.evaluate(id=>{const raw=localStorage.getItem("tongter:glass-house-react:v1");if(!raw)return null;const s=JSON.parse(raw);return s.guestList.find((g:{id:string})=>g.id===id)?.seatNumber;},id);}
async function drag(page:Page,source:Locator,target:Locator,mobile:boolean){
  const a=await source.boundingBox(),b=await target.boundingBox();if(!a||!b)throw Error("Missing drag target");
  const start={x:a.x+a.width/2,y:a.y+a.height/2},end={x:b.x+b.width/2,y:b.y+b.height/2};
  if(mobile){
    const session=await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[start]});
    for(let i=1;i<=16;i++)await session.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:start.x+(end.x-start.x)*i/16,y:start.y+(end.y-start.y)*i/16}]});
    await session.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await session.detach();
  }else{await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:16});await page.mouse.up();}
}

test("keeps name-only labels over their seats, supports swaps, and restores the saved draft",async({page,isMobile},testInfo)=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await openStudio(page);
  await expect(badge(page,"test-alice").locator("text")).toHaveText("Alice");
  await expect(badge(page,"test-alice").locator("path")).toHaveCount(0);
  const anchored=await badge(page,"test-alice").evaluate(el=>{const rect=el.querySelector("rect")!;return Math.abs(Number(rect.getAttribute("x"))+Number(rect.getAttribute("width"))/2-Number(el.getAttribute("data-anchor-x")))<.001&&Math.abs(Number(rect.getAttribute("y"))+Number(rect.getAttribute("height"))/2-Number(el.getAttribute("data-anchor-z")))<.001;});expect(anchored).toBe(true);
  await drag(page,badge(page,"test-alice").locator("rect"),badge(page,"test-bob").locator("rect"),isMobile);
  await expect.poll(()=>placement(page,"test-alice")).toBe(6);await expect.poll(()=>placement(page,"test-bob")).toBe(1);
  await page.getByRole("button",{name:"Undo",exact:true}).click();await expect.poll(()=>placement(page,"test-alice")).toBe(1);
  await badge(page,"test-alice").click();
  const dialog=page.getByRole("dialog",{name:"Around Table 1"});await expect(dialog).toBeVisible();
  await expect(dialog.locator('.studio-name-badge[data-guest-drag="test-alice"] text')).toHaveText("Alice");
  await expect(dialog.locator('.studio-seat[data-guest-drag="test-alice"] text')).toHaveCount(0);
  await dialog.getByRole("button",{name:"Close dialog",exact:true}).click();
  await page.reload();await expect(badge(page,"test-alice").locator("text")).toHaveText("Alice");await expect.poll(()=>placement(page,"test-alice")).toBe(1);
  await testInfo.attach("seat-centered-labels",{body:await page.screenshot(),contentType:"image/png"});
  expect(errors).toEqual([]);
});

test("loads the real R3F scene and name-only Html labels",async({page},testInfo)=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await openStudio(page);await page.getByRole("button",{name:"3D model",exact:true}).click();
  await expect(page.locator(".studio-three-view canvas")).toBeVisible();
  const name=page.locator('.studio-seat-name-label[data-guest-drag="test-alice"]');
  await expect(name).toBeVisible({timeout:20_000});await expect(name).toHaveText("Alice");await expect(name.locator("small")).toHaveCount(0);
  await expect(page.locator(".studio-render-fallback")).toHaveCount(0);
  await testInfo.attach("r3f-seat-labels",{body:await page.screenshot(),contentType:"image/png"});
  expect(errors).toEqual([]);
});
