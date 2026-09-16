import { makeId, normalizeLayout, type StudioItem, type StudioLayout } from "./schema";

/** Geometry only. Never seed a private roster into this public repository. */
export function defaultLayout(): StudioLayout {
  const pixels = [[1,808,377,15],[2,808,548,-14],[3,705,376,15],[4,706,548,-14],[5,611,374,14],[6,508,375,17],[7,508,457,0],[8,507,545,-14],[9,417,371,15],[10,414,455,5],[11,415,547,-14],[12,323,365,15],[13,331,435,14],[14,231,362,14],[15,237,430,14],[16,628,267,16],[17,567,208,16],[18,513,265,16],[19,311,245,16],[20,232,241,16]];
  const items: StudioItem[] = pixels.map(([n,x,y,r]) => ({ id:`table-${n}`,kind:"table",shape:"oval",label:String(n),x:(x-568)/884*27.2,z:(y-637)/351*11.25+5.625,w:2,d:1.2,h:.76,rotation:r,seats:10,guests:[],locked:false }));
  items.push(
    {id:"stage-1",kind:"stage",shape:"rect",label:"Stage",x:10.94,z:.12,w:2.55,d:6.5,h:.45,rotation:0,seats:0,locked:true,guests:[]},
    {id:"aisle-1",kind:"aisle",shape:"rect",label:"L-shaped aisle",x:4.58,z:2.565,w:10.25,d:6.12,h:.016,aisleWidth:1.05,rotation:0,seats:0,locked:true,guests:[]},
    {id:"band-1",kind:"band",shape:"oval",label:"Band",x:9.2,z:-7,w:4.4,d:1.9,h:.15,rotation:0,seats:0,locked:true,guests:[]},
    {id:"bar-1",kind:"bar",shape:"rect",label:"Bar",x:-10.45,z:4.28,w:1.15,d:1.5,h:1.05,rotation:0,seats:0,locked:true,guests:[]},
  );
  return normalizeLayout({version:3,title:"The Glass House · Reference wedding layout",units:"metres",items,guestList:[]});
}
export function newItem(kind: StudioItem["kind"], existing: StudioItem[]): StudioItem {
  const sizes: Record<StudioItem["kind"], [number,number,number]> = {table:[2,1.2,.76],stage:[3,6,.45],aisle:[6,5,.016],runner:[1.2,4,.016],band:[4,2,.15],bar:[2,.8,1.05],buffet:[3,.8,.9],dance:[4,4,.03]};
  const [w,d,h]=sizes[kind],label=kind==="table"?String(Math.max(0,...existing.filter(t=>t.kind==="table").map(t=>Number(t.label)||0))+1):kind;
  return {id:makeId(kind),kind,shape:kind==="table"?"oval":"rect",label,x:0,z:2,w,d,h,rotation:0,seats:kind==="table"?10:0,locked:false,guests:[],...(kind==="aisle"?{aisleWidth:1.05}:{})};
}
