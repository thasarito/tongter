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
/** Global packing, not independent packing per table. Overflow is placed beyond
 * all prior badges when nearby positions are exhausted, never left overlapping. */
export function labelLayout(s: StudioLayout,measure: (text:string)=>number): LabelBox[] {
  const placed:LabelBox[]=[];
  for(const t of s.items.filter(t=>t.kind==="table").slice().sort((a,b)=>a.id.localeCompare(b.id)))for(const seat of seats(t)){
    const g=occupant(s,{tableId:t.id,seatNumber:seat.number});if(!g)continue;
    const lines=wrapName(`${seat.number} · ${g.name}`,1.42,measure),w=Math.max(.65,...lines.map(measure))+.2,h=lines.length*.24+.16;
    const dx=seat.world[0]-t.x,dz=seat.world[1]-t.z,side=Math.abs(dx)>Math.abs(dz)?[Math.sign(dx)||1,0]:[0,Math.sign(dz)||1];
    const l:LabelBox={key:`${t.id}:${seat.number}`,tableId:t.id,seatNumber:seat.number,guestId:g.id,name:g.name,lines,anchor:seat.world,x:seat.world[0]-w/2+side[0]*(w/2+.34),y:seat.world[1]-h/2+side[1]*(h/2+.34),w,h};
    let n=0;while(placed.some(b=>boxesOverlap(l,b))&&n++<90){l.x+=side[0]*.12;l.y+=side[1]*.12;}
    if(placed.some(b=>boxesOverlap(l,b)))l.x=Math.max(14,...placed.map(b=>b.x+b.w))+.15;
    placed.push(l);
  }
  return placed;
}
export function diagramLabels(layout: StudioLayout,table: StudioItem,measure:(s:string)=>number=s=>Array.from(s).length*.11): LabelBox[] {
  const positions=seats(table),outside=Math.max(.5,...positions.map(p=>Math.abs(p.world[0]-table.x)))+.65;
  const map=new Map(labelLayout({...layout,items:[table]},measure).map(l=>[l.seatNumber,l]));
  const list=positions.flatMap(s=>{const l=map.get(s.number);return l?[{...l,anchor:[s.world[0]-table.x,s.world[1]-table.z] as Point}]:[];});
  for(const right of [false,true]){
    const side=list.filter(l=>(l.anchor[0]>=0)===right).sort((a,b)=>a.anchor[1]-b.anchor[1]);let y=-side.reduce((sum,l)=>sum+l.h+.12,0)/2;
    for(const l of side){l.x=right?outside:-outside-l.w;l.y=y;y+=l.h+.12;}
  }
  return list;
}
