import { expect, it } from "vitest";
import { defaultLayout } from "./defaults";
import { applyGuestImport, parseGuestImport } from "./exchange";
it("retains legacy HOLD rows whose unset source seat is encoded as zero",()=>{
  const payload=parseGuestImport(JSON.stringify([{id:"synthetic-hold",name:"Waiting Test",tableId:"HOLD",seatNumber:0}]),"original.json");
  const guest=applyGuestImport(defaultLayout(),payload,"merge").layout.guestList[0];
  expect(guest.tableId).toBe("");expect(guest.seatNumber).toBeNull();expect(guest.sourceTableId).toBe("HOLD");expect(guest.sourceSeatNumber).toBeNull();
});
