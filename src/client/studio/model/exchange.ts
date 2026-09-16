import { clone, makeId, normalizeLayout, type StudioLayout } from "./schema";
export interface GuestImport { rows: Record<string, unknown>[]; legacy: boolean; label: string }
export type ImportMode = "merge" | "replace";
const aliases: Record<string,string> = {id:"id",guestid:"id",name:"name",guestname:"name",host:"host",side:"host",group:"group",status:"status",rsvp:"rsvp",notes:"notes",note:"notes",dietary:"dietary",reserve:"reserve",important:"important",vip:"vip",heart:"heart",star:"star",tableid:"tableId",table:"tableLabel",tablelabel:"tableLabel",seat:"seatNumber",seatnumber:"seatNumber",sourcetableid:"sourceTableId",sourcetable:"sourceTableLabel",sourcetablelabel:"sourceTableLabel",sourceseat:"sourceSeatNumber",sourceseatnumber:"sourceSeatNumber",unmappedtableid:"unmappedTableId",unmappedtable:"unmappedTableLabel",unmappedtablelabel:"unmappedTableLabel",unmappedseat:"unmappedSeatNumber",unmappedseatnumber:"unmappedSeatNumber",csvescaped:"csvEscaped"};
const sourceLabels: Record<string,string>={L4:"Table 1 · L4",VIP2:"Table 2 · VIP2",L3:"Table 3 · L3",L1:"Table 4 · L1",VIP1:"Table 5 · VIP1",ROUND4:"Table 6 · ROUND4",ROUND5:"Table 7 · ROUND5",ROUND1:"Table 8 · ROUND1",ROUND2:"Table 9 · ROUND2",ROUND3:"Table 10 · ROUND3",HOLD:"Needs seats · HOLD",EXTRA:"Reserve · EXTRA"};
const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x);
const key=(s:string)=>s.trim().toLowerCase().replace(/[ _-]/g,"");
function boolean(value:unknown):boolean {
  if(typeof value==="boolean")return value;
  if(value==null||value==="")return false;
  const s=String(value).toLowerCase();if(["true","1","yes","y"].includes(s))return true;if(["false","0","no","n"].includes(s))return false;
  throw Error("Boolean columns must use true/false or yes/no.");
}
export function parseCsv(input:string):string[][] {
  const text=input.replace(/^\uFEFF/,""),rows:string[][]=[];let row:string[]=[],cell="",quoted=false,closed=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
    if(closed&&![",","\r","\n"].includes(c))throw Error("Unexpected text after a CSV quote.");
    if(c==='"'){if(cell||closed)throw Error("Invalid CSV quote.");quoted=true;}
    else if(c===","){row.push(cell);cell="";closed=false;}
    else if(c==="\r"||c==="\n"){if(c==="\r"&&text[i+1]==="\n")i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell="";closed=false;}
    else cell+=c;
  }
  if(quoted)throw Error("Unclosed quoted CSV cell.");
  if(cell||row.length||closed){row.push(cell);if(row.some(Boolean))rows.push(row);}
  return rows;
}
export function parseGuestImport(text:string,label:string):GuestImport {
  if(text.length>5_000_000)throw Error("Guest files must be smaller than 5 MB.");
  if(text.includes("\uFFFD"))throw Error("Invalid text encoding. Use UTF-8 CSV or JSON.");
  text=text.replace(/^\uFEFF/,"");let raw:unknown[],legacy=false;
  if(/\.json$/i.test(label)||text.trimStart().startsWith("[")||text.trimStart().startsWith("{")){
    const data:unknown=JSON.parse(text);
    if(Array.isArray(data))raw=data;
    else if(record(data)){
      const rows=data.guestList??data.guests;if(!Array.isArray(rows))throw Error("No guests array in JSON.");raw=rows;
      if(data.format&&!["glass-house-guest-tables","tong-ter-extracted-guests"].includes(String(data.format)))throw Error("Unsupported guest format.");
      if(data.format&&data.version!==1)throw Error("Unsupported guest file version.");
      legacy=data.format==="tong-ter-extracted-guests"||data.type==="tong-ter-reception-guests";
    }else throw Error("Invalid guest JSON.");
    legacy ||= raw.some(r=>record(r)&&/^(L[1-5]|VIP[12]|ROUND[1-5]|EXTRA|HOLD)$/i.test(String(r.tableId??"")));
  }else{
    const csv=parseCsv(text),head=csv.shift();if(!head)throw Error("CSV is empty.");
    const names=head.map(h=>aliases[key(h)]??"");
    if(!names.includes("id")&&!names.includes("name"))throw Error("CSV requires id or name.");
    if(new Set(names.filter(Boolean)).size!==names.filter(Boolean).length)throw Error("Duplicate CSV columns.");
    raw=csv.map((cells,i)=>{if(cells.length!==head.length)throw Error(`CSV row ${i+2} has the wrong number of columns.`);return Object.fromEntries(names.flatMap((name,j)=>name?[[name,cells[j]]]:[]));});
  }
  if(raw.length>5000)throw Error("At most 5,000 guest rows are supported.");
  const rows=raw.map((r,i)=>{
    if(!record(r))throw Error(`Invalid guest row ${i+1}.`);
    const out:Record<string,unknown>={};for(const [field,value] of Object.entries(r)){const name=aliases[key(field)];if(name)out[name]=value;}
    if(out.csvEscaped==="apostrophe-v1")for(const [k,v]of Object.entries(out))if(typeof v==="string"&&/^'[=+\-@\t\r]/.test(v))out[k]=v.slice(1);
    for(const k of ["reserve","important","vip"])if(k in out)out[k]=boolean(out[k]);
    for(const k of ["seatNumber","sourceSeatNumber","unmappedSeatNumber"])if(k in out)out[k]=out[k]==null||out[k]===""?null:Number(out[k]);
    if(!out.id)out.id=makeId();return out;
  });
  return {rows,legacy,label};
}
function resolve(s:StudioLayout,reference:unknown):string|null {
  const value=String(reference??"").trim();if(!value)return "";
  const tables=s.items.filter(t=>t.kind==="table"),exact=tables.find(t=>t.id===value);if(exact)return exact.id;
  const label=value.replace(/^table\s+/i,""),matches=tables.filter(t=>t.label.toLowerCase()===label.toLowerCase());
  return matches.length===1?matches[0].id:null;
}
/** Apply is also used for preview, and is recomputed against CURRENT state when
 * confirmed. Missing fields in merge mode preserve prior draft assignments. */
export function applyGuestImport(input:StudioLayout,payload:GuestImport,mode:ImportMode):{layout:StudioLayout;warnings:string[]} {
  const s=clone(input),warnings:string[]=[];if(mode==="replace")s.guestList=[];
  const seen=new Set<string>();
  for(const row of payload.rows){
    const patch={...row},id=String(patch.id),index=s.guestList.findIndex(g=>g.id===id),old=s.guestList[index];
    if(seen.has(id))throw Error(`Duplicate guest ID in import: ${id}`);seen.add(id);
    if(payload.legacy){
      const ref=String(patch.tableId??patch.tableLabel??"");patch.sourceTableId=patch.sourceTableId||ref;patch.sourceTableLabel=patch.sourceTableLabel||sourceLabels[ref]||ref;patch.sourceSeatNumber=patch.sourceSeatNumber??patch.seatNumber??null;
      patch.tableId=old?.tableId??"";patch.seatNumber=old?.seatNumber??null;patch.reserve=old?.reserve??patch.reserve??(ref==="EXTRA");
    }else if("tableId" in patch||"tableLabel" in patch){
      const ref=patch.tableId||patch.tableLabel,tableId=resolve(s,ref);
      if(tableId===null){patch.unmappedTableId=String(patch.tableId??"");patch.unmappedTableLabel=String(patch.tableLabel??ref);patch.unmappedSeatNumber=patch.seatNumber??null;patch.tableId="";patch.seatNumber=null;warnings.push(`${patch.name??id}: unknown table retained as an unmatched reference; left unassigned.`);}
      else{patch.tableId=tableId;if(!tableId||(!("seatNumber" in patch)&&tableId!==old?.tableId))patch.seatNumber=null;}
    }
    if(patch.reserve===true){patch.tableId="";patch.seatNumber=null;}
    // Import rows remain untrusted until the whole draft is validated below.
    const merged:Record<string,unknown>={...old,...patch};delete merged.csvEscaped;delete merged.tableLabel;
    if(index<0)s.guestList.push(merged as unknown as typeof s.guestList[number]);else s.guestList[index]=merged as unknown as typeof s.guestList[number];
  }
  if(payload.legacy)warnings.push("Original seating was retained as reference data; review and distribute source groups into this different venue plan.");
  return {layout:normalizeLayout(s),warnings};
}
const columns=["id","name","host","group","status","rsvp","table_id","table","seat","reserve","important","vip","heart","star","notes","dietary","source_table_id","source_table","source_seat","unmapped_table_id","unmapped_table","unmapped_seat","csv_escaped"];
export function guestCsv(s:StudioLayout):string {
  const quote=(v:unknown)=>'"'+String(v??"").replace(/"/g,'""')+'"';
  const safe=(v:unknown)=>typeof v==="string"&&/^[=+\-@\t\r]/.test(v)?"'"+v:v;
  return "\uFEFF"+[columns.map(quote).join(","),...s.guestList.map(g=>{const r:Record<string,unknown>={...g,table_id:g.tableId,table:s.items.find(t=>t.id===g.tableId)?.label??"",seat:g.seatNumber,source_table_id:g.sourceTableId,source_table:g.sourceTableLabel,source_seat:g.sourceSeatNumber,unmapped_table_id:g.unmappedTableId,unmapped_table:g.unmappedTableLabel,unmapped_seat:g.unmappedSeatNumber,csv_escaped:"apostrophe-v1"};return columns.map(k=>quote(safe(r[k]))).join(",");})].join("\r\n");
}
export const guestJson=(s:StudioLayout)=>JSON.stringify({format:"glass-house-guest-tables",version:1,guests:s.guestList},null,2);
export function download(name:string,content:string|Blob,type="application/json") {
  const url=URL.createObjectURL(content instanceof Blob?content:new Blob([content],{type})),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30_000);
}
