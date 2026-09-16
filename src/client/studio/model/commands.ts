import { clone, guestSchema, makeId, normalizeLayout, occupant, tableGuests, type SeatTarget, type StudioGuest, type StudioLayout } from "./schema";
function selected(s: StudioLayout, ids: string[]) {
  if(!ids.length || new Set(ids).size!==ids.length)throw Error("Select distinct guests first.");
  const guests=ids.map(id=>s.guestList.find(g=>g.id===id));
  if(guests.some(g=>!g))throw Error("A selected guest no longer exists.");
  return guests as StudioGuest[];
}
/** Atomic exact-seat move / swap, or table-level first-free assignment. */
export function moveGuests(input: StudioLayout, ids: string[], target: SeatTarget): StudioLayout {
  const s=clone(input), guests=selected(s,ids);
  if(!target.tableId){for(const g of guests){g.tableId="";g.seatNumber=null;}return normalizeLayout(s);}
  const t=s.items.find(t=>t.kind==="table"&&t.id===target.tableId);
  if(!t)throw Error("Choose an existing table.");
  if(guests.some(g=>g.reserve||g.rsvp==="Declined"))throw Error("Activate reserve / declined guests before assigning them.");
  if(target.seatNumber!=null){
    if(ids.length!==1)throw Error("Drop a single guest onto a numbered seat; drop a group onto the table.");
    if(!Number.isInteger(target.seatNumber)||target.seatNumber<1||target.seatNumber>t.seats)throw Error("That seat is outside the table's capacity.");
    const g=guests[0],other=occupant(s,target);
    if(other&&other.id!==g.id){
      if(!g.tableId)throw Error("That seat is occupied. Pick an empty seat or use Replace in the seat editor.");
      other.tableId=g.tableId;other.seatNumber=g.seatNumber;
    }
    g.tableId=t.id;g.seatNumber=target.seatNumber;
  }else{
    for(const g of guests)if(g.tableId!==t.id){g.tableId=t.id;g.seatNumber=null;}
  }
  return normalizeLayout(s);
}
export function replaceSeat(s: StudioLayout,id: string,target: SeatTarget): StudioLayout {
  const other=occupant(s,target);
  return moveGuests(other&&other.id!==id?moveGuests(s,[other.id],{tableId:""}):s,[id],target);
}
export function distributeGuests(input: StudioLayout,ids: string[],tables: string[]): StudioLayout {
  if(!tables.length||new Set(tables).size!==tables.length)throw Error("Select distinct destination tables.");
  const s=moveGuests(input,ids,{tableId:""}),guests=selected(s,ids);
  if(guests.some(g=>g.reserve||g.rsvp==="Declined"))throw Error("Activate reserve / declined guests first.");
  const spaces: SeatTarget[]=[];
  for(const id of tables){const t=s.items.find(t=>t.kind==="table"&&t.id===id);if(!t)throw Error("Unknown table.");const used=new Set(tableGuests(s,id).map(g=>g.seatNumber));for(let n=1;n<=t.seats;n++)if(!used.has(n))spaces.push({tableId:id,seatNumber:n});}
  if(spaces.length<ids.length)throw Error(`${spaces.length} free seats for ${ids.length} guests. Nothing was changed.`);
  guests.forEach((g,i)=>{g.tableId=spaces[i].tableId;g.seatNumber=spaces[i].seatNumber??null;});return normalizeLayout(s);
}
export function saveGuest(input: StudioLayout,patch: Partial<StudioGuest>&{name:string}): StudioLayout {
  const s=clone(input),index=s.guestList.findIndex(g=>g.id===patch.id),old=s.guestList[index];
  const g=guestSchema.parse({...old,...patch,id:patch.id||makeId()});
  if(g.reserve){g.tableId="";g.seatNumber=null;}
  if(old&&patch.tableId!==undefined&&patch.tableId!==old.tableId&&patch.seatNumber===undefined)g.seatNumber=null;
  if(index<0)s.guestList.push(g);else s.guestList[index]=g;return normalizeLayout(s);
}
export function removeItem(s: StudioLayout,id: string): StudioLayout {
  const item=s.items.find(i=>i.id===id);if(item?.locked)throw Error("Unlock the object before deleting it.");
  return normalizeLayout({...s,items:s.items.filter(i=>i.id!==id),guestList:s.guestList.map(g=>g.tableId===id?{...g,tableId:"",seatNumber:null}:g)});
}
