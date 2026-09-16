import type { StudioItem, StudioLayout } from "./schema";
export type Point = [number, number];
export const VENUE = { width: 27.2, depth: 11.25, back: -5.625, front: 5.625, eave: 3.5, ridge: 7.5 } as const;
export const BAYS = [{ x: -9.2, r: 3 }, { x: 0, r: 3.6 }, { x: 9.2, r: 3 }] as const;
export const radians = (a: number) => a * Math.PI / 180;
export function footprint(steps = 40): Point[] {
  const p: Point[] = [[-13.6, VENUE.front], [13.6, VENUE.front], [13.6, VENUE.back], [12.2, VENUE.back]];
  for (let n = 2; n >= 0; n--) {
    const b = BAYS[n]; if (n < 2) p.push([b.x + b.r, VENUE.back]);
    for (let i = 1; i <= steps; i++) { const a = i / steps * Math.PI; p.push([b.x + b.r * Math.cos(a), VENUE.back - b.r * Math.sin(a)]); }
  }
  p.push([-13.6, VENUE.back], [-13.6, .625], [-9.8, .625], [-9.8, 3.425], [-13.6, 3.425]); return p;
}
export function pointInside(x: number, z: number, p: Point[] = footprint()): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [ax, az] = p[j], [bx, bz] = p[i];
    if (Math.abs((x - ax) * (bz - az) - (z - az) * (bx - ax)) < 1e-7 && (x - ax) * (x - bx) + (z - az) * (z - bz) <= 1e-7) return true;
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}
export function transform(p: Point, item: StudioItem): Point {
  const a = radians(item.rotation), c = Math.cos(a), s = Math.sin(a);
  return [item.x + p[0] * c - p[1] * s, item.z + p[0] * s + p[1] * c];
}
export const rectangle = (w: number, d: number, x = 0, z = 0): Point[] => [[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]];
export function localPolygon(o: StudioItem, chairs = false): Point[] {
  if (o.kind === "aisle") { const a = o.aisleWidth ?? 1.05; return [[-o.w/2,-o.d/2],[o.w/2,-o.d/2],[o.w/2,-o.d/2+a],[-o.w/2+a,-o.d/2+a],[-o.w/2+a,o.d/2],[-o.w/2,o.d/2]]; }
  const extra = o.kind === "table" && chairs ? .43 : 0;
  if ((o.kind === "table" && o.shape !== "rect") || o.kind === "band") return Array.from({ length: 48 }, (_, i) => [Math.cos(i/48*Math.PI*2)*(o.w/2+extra), Math.sin(i/48*Math.PI*2)*(o.d/2+extra)] as Point);
  return rectangle(o.w+extra*2, o.d+extra*2);
}
export const itemPolygon = (o: StudioItem, chairs = false) => localPolygon(o, chairs).map(p => transform(p, o));
function parts(o: StudioItem): Point[][] {
  if (o.kind !== "aisle") return [itemPolygon(o, true)];
  const a = o.aisleWidth ?? 1.05;
  return [rectangle(o.w,a,0,-o.d/2+a/2),rectangle(a,o.d-a,-o.w/2+a/2,a/2)].map(p => p.map(v => transform(v,o)));
}
function intersects(a: Point[], b: Point[]) {
  for (const p of [a,b]) for (let i=0;i<p.length;i++) {
    const q=p[i],r=p[(i+1)%p.length],nx=-(r[1]-q[1]),nz=r[0]-q[0];
    const aa=a.map(v=>v[0]*nx+v[1]*nz),bb=b.map(v=>v[0]*nx+v[1]*nz);
    if (Math.max(...aa)<=Math.min(...bb)+.002 || Math.max(...bb)<=Math.min(...aa)+.002) return false;
  }
  return true;
}
export function conflicts(s: StudioLayout): string[] {
  const warnings: string[] = [], floor=footprint();
  for (const o of s.items) {
    const p=itemPolygon(o,true); let outside=false;
    for(let i=0;i<p.length&&!outside;i++){const a=p[i],b=p[(i+1)%p.length],n=Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/.15));for(let k=0;k<=n;k++)if(!pointInside(a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n,floor)){outside=true;break;}}
    if(outside)warnings.push(`${o.kind === "table" ? "Table " : ""}${o.label}: footprint extends outside the room.`);
  }
  for(let i=0;i<s.items.length;i++)for(let j=i+1;j<s.items.length;j++)if(parts(s.items[i]).some(a=>parts(s.items[j]).some(b=>intersects(a,b))))warnings.push(`${s.items[i].label} / ${s.items[j].label}: footprints or chairs overlap.`);
  return warnings;
}
export interface SeatPosition { number: number; local: Point; world: Point; angle: number }
/** Stable legacy convention: local +X is seat 1; numbers increase clockwise. */
export function seats(t: StudioItem): SeatPosition[] {
  if(t.kind!=="table")return [];
  return Array.from({length:t.seats},(_,i)=>{
    const angle=i/t.seats*Math.PI*2, local: Point=[Math.cos(angle)*(t.w/2+.31),Math.sin(angle)*(t.d/2+.31)];
    return {number:i+1,local,world:transform(local,t),angle};
  });
}
