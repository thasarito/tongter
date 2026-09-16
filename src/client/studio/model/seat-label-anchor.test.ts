import { describe,expect,it } from "vitest";
import { defaultLayout } from "./defaults";
import { normalizeLayout } from "./schema";
import { labelLayout,diagramLabels } from "./labels";
import { seats } from "./geometry";
const fixture=()=>normalizeLayout({...defaultLayout(),guestList:[{id:"synthetic-anchor",name:"Guest Name",tableId:"table-1",seatNumber:7}]});
describe("name-only labels anchored directly on their chair",()=>{
  it("centers the full name on its real floor-plan seat rather than displacing it",()=>{
    const s=fixture(),label=labelLayout(s,t=>t.length*.1)[0],point=seats(s.items[0])[6].world;
    expect(label.lines.join(" ")).toBe("Guest Name");expect(label.x+label.w/2).toBeCloseTo(point[0]);expect(label.y+label.h/2).toBeCloseTo(point[1]);expect(label.seatNumber).toBe(7);
  });
  it("uses the rotated seat center in the close-up map too",()=>{
    const s=fixture();s.items[0].rotation=90;const t=s.items[0],label=diagramLabels(s,t)[0],point=seats(t)[6].world;
    expect(label.lines.join(" ")).toBe("Guest Name");expect(label.x+label.w/2).toBeCloseTo(point[0]-t.x);expect(label.y+label.h/2).toBeCloseTo(point[1]-t.z);
  });
});
