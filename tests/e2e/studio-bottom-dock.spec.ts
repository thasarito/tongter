import { expect, test } from "@playwright/test";
import { normalizeLayout } from "../../src/client/studio/model/schema";

test("the viewport has no top toolbar and all navigation lives in the bottom dock", async ({page}) => {
  const layout=normalizeLayout({version:3,title:"Synthetic bottom navigation",units:"metres",items:[{id:"table-1",kind:"table",shape:"oval",label:"1",x:0,z:0,w:2,d:1.2,h:.76,rotation:0,seats:10,locked:false}],guestList:[{id:"test-alice",name:"Alice",tableId:"table-1",seatNumber:1}]});
  await page.route("**/api/admin/studio/layout",route=>route.fulfill({json:{status:"ok",source:"Google Sheets",layout,revision:"bottom-dock-test",fetchedAt:Date.now()}}));
  await page.goto("/admin/studio");
  await page.getByLabel("Administrator passphrase").fill("local-e2e-passphrase");
  await page.getByRole("button",{name:"Open studio",exact:true}).click();
  await expect(page.locator(".studio-plan .studio-name-badge")).toHaveCount(1);
  await expect(page.locator(".studio-toolbar")).toHaveCount(0);
  const dock=page.getByRole("navigation",{name:"Planning panels"});
  await expect(dock.getByRole("button")).toHaveCount(5);
  for(const name of ["Layout panel","Guests panel","View panel","Selected panel","More panel"]){await expect(dock.getByRole("button",{name,exact:true})).toBeVisible();}
  await expect(page.locator(".studio-viewport-actions")).toHaveCount(0);
  const bounds=await page.locator(".studio-bottom-bar").boundingBox();
  expect(bounds!.y).toBeGreaterThan(page.viewportSize()!.height-150);
});
