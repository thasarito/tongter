import { expect, test, type Page } from "@playwright/test";
import { normalizeLayout } from "../../src/client/studio/model/schema";

test.use({ launchOptions: { args: ["--enable-unsafe-swiftshader"] } });
async function open(page: Page) {
  const layout = normalizeLayout({version:3,title:"Synthetic mobile scene",units:"metres",items:[{id:"table-1",kind:"table",shape:"oval",label:"1",x:0,z:0,w:2,d:1.2,h:.76,rotation:0,seats:10,locked:false}],guestList:[{id:"mobile-alice",name:"Alice",tableId:"table-1",seatNumber:1},{id:"mobile-thai",name:"แขกทดสอบชื่อยาวสำหรับมือถือ",tableId:"table-1",seatNumber:6}]});
  await page.route("**/api/admin/studio/layout", route => route.fulfill({json:{status:"ok",source:"Google Sheets",layout,revision:"mobile-test",fetchedAt:Date.now()}}));
  await page.goto("/admin/studio");
  await page.getByLabel("Administrator passphrase").fill("local-e2e-passphrase");
  await page.getByRole("button",{name:"Open studio",exact:true}).click();
  await expect(page.locator(".studio-plan .studio-name-badge")).toHaveCount(2);
  await page.getByRole("button",{name:"3D model",exact:true}).click();
  await expect(page.locator(".studio-three-view canvas")).toBeVisible();
  await expect(page.locator('.studio-seat-name-label[data-guest-drag="mobile-alice"]')).toBeVisible({timeout:20_000});
}

test("scene fills the viewport rather than sharing a scrolling page with tool panels",async({page})=>{
  await open(page);
  const bounds=await page.locator(".studio-three-view canvas").boundingBox();
  const screen=page.viewportSize()!;
  expect(bounds!.x).toBeLessThanOrEqual(1);
  expect(bounds!.y).toBeLessThanOrEqual(1);
  expect(bounds!.width).toBeGreaterThanOrEqual(screen.width-2);
  expect(bounds!.height).toBeGreaterThanOrEqual(screen.height-2);
  expect(await page.locator(".studio-three-view canvas").evaluate(el=>getComputedStyle(el).touchAction)).toBe("none");
});

test("walk mode has an on-screen analogue joystick",async({page})=>{
  await open(page);
  await page.getByRole("button",{name:"Walk inside",exact:true}).click();
  await expect(page.getByRole("group",{name:"Walk joystick",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Hold to walk forward",exact:true})).toHaveCount(0);
});
