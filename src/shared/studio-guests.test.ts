import { describe, expect, it } from "vitest";
import { buildStudioGuestImport } from "./studio-guests";
import type { Snapshot } from "./types";
describe("administrator studio roster projection",()=>{
  it("exports explicit reference fields, never invite tokens or private messages",()=>{
    const snapshot:Snapshot={status:"ok",fetchedAt:123,warnings:[],groups:[{groupId:"synthetic",labelTh:"กลุ่มทดสอบ",labelEn:"Test group",token:"DO_NOT_EXPORT_GROUP_TOKEN"}],guests:[{guestId:"synthetic-1",nameTh:"ผู้ร่วมงานทดสอบ",nameEn:"Test Guest",groupId:"synthetic",tableId:8,seatIndex:4,side:"bride",tags:[],token:"DO_NOT_EXPORT_PERSONAL_TOKEN"}],rsvps:[{timestamp:"2026-01-01T00:00:00Z",groupId:"synthetic",guestId:"synthetic-1",attending:true,dietary:"Vegetarian",message:"DO_NOT_EXPORT_PRIVATE_MESSAGE",submittedBy:"test",lang:"th"}]};
    const dto=buildStudioGuestImport(snapshot),text=JSON.stringify(dto),g=dto.guests[0];
    expect(g.id).toBe("synthetic-1");expect(g.name).toBe("ผู้ร่วมงานทดสอบ");expect(g.rsvp).toBe("Confirmed");expect(g.sourceSeatNumber).toBe(4);expect(g.sourceTableId).toBe("site-table-8");
    expect(g).not.toHaveProperty("tableId");expect(g).not.toHaveProperty("seatNumber");expect(text).not.toContain("DO_NOT_EXPORT");expect(g).not.toHaveProperty("token");
  });
  it("preserves stale/unconfigured status for the import preview",()=>{
    for(const status of ["stale","unconfigured"] as const)expect(buildStudioGuestImport({status,fetchedAt:0,guests:[],groups:[],rsvps:[],warnings:[]}).status).toBe(status);
  });
});
