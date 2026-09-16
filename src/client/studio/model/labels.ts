import { seats, type Point } from "./geometry";
import { occupant, type StudioItem, type StudioLayout } from "./schema";
export interface LabelBox { key: string; tableId: string; seatNumber: number; guestId: string; name: string; lines: string[]; anchor: Point; x: number; y: number; w: number; h: number }
export const boxesOverlap = (a: Pick<LabelBox,"x"|"y"|"w"|"h">,b: Pick<LabelBox,"x"|"y"|"w"|"h">,gap=.05) => a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;
export function wrapName(value: string,max: number,measure: (s:string)=>number): string[] {
  const chars=typeof Intl.Segmenter==="function"?Array.from(new Intl.Segmenter(undefined,{granularity:"grapheme"}).segment(value),s=>s.segment):Array.from(value);
  const lines:string[]=[];let line="";
  for(const c of chars){if(line&&measure(line+c)>max){lines.push(line.trimEnd());line=c.trimStart();}else line+=c;}
  if(line)lines.push(line);return lines.length?lines:[""];
}
/** Name-only badges are centered on the actual chair. Seat numbers remain in
 * identity/drop metadata, never prefixed to visible names. Unlike the original
 * callouts, labels do not drift into side columns or distant overflow rails. */
export function labelLayout(s: StudioLayout,measure: (text:string)=>number): LabelBox[] {
  const labels:LabelBox[]=[];
  for(const t of s.items.filter(t=>t.kind==="table"))for(const seat of seats(t)){
    const g=occupant(s,{tableId:t.id,seatNumber:seat.number});if(!g)continue;
    const lines=wrapName(g.name,1.42,measure),w=Math.max(.45,...lines.map(measure))+.2,h=lines.length*.24+.16;
    labels.push({key:`${t.id}:${seat.number}`,tableId:t.id,seatNumber:seat.number,guestId:g.id,name:g.name,lines,anchor:seat.world,x:seat.world[0]-w/2,y:seat.world[1]-h/2,w,h});
  }
  return labels;
}
export function diagramLabels(layout: StudioLayout,table: StudioItem,measure:(s:string)=>number=s=>Array.from(s).length*.11): LabelBox[] {
  return labelLayout({...layout,items:[table]},measure).map(label=>({...label,x:label.x-table.x,y:label.y-table.z,anchor:[label.anchor[0]-table.x,label.anchor[1]-table.z] as Point}));
}
