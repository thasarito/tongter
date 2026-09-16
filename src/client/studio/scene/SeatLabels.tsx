import { useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { seats } from "../model/geometry";
import { boxesOverlap } from "../model/labels";
import { occupant } from "../model/schema";
import { useStudio } from "../state/StudioProvider";
/** Measured screen-space labels. Mutate DOM transforms during camera movement,
 * not React state; never subscribe individual labels to their own render loops. */
export function SeatLabels(){
  const {layout,setModal}=useStudio(),invalidate=useThree(s=>s.invalidate);
  const refs=useRef(new Map<string,HTMLButtonElement>()),lines=useRef(new Map<string,SVGLineElement>()),count=useRef<HTMLDivElement>(null),last=useRef("");
  const entries=useMemo(()=>layout.items.filter(t=>t.kind==="table").flatMap(t=>seats(t).flatMap(p=>{const g=occupant(layout,{tableId:t.id,seatNumber:p.number});return g?[{key:`${t.id}:${p.number}`,table:t,seat:p.number,guest:g,position:new Vector3(p.world[0],1.15,p.world[1])}]:[];})),[layout]);
  const dataKey=useMemo(()=>entries.map(e=>`${e.key}|${e.table.label}|${e.guest.id}|${e.guest.name}|${e.position.toArray().join(",")}`).join(";"),[entries]);
  const vector=useMemo(()=>new Vector3(),[]);
  useFrame(({camera,size})=>{
    // Html portals mount after scene objects. Retry rather than caching a
    // projection before their DOM nodes have been attached.
    if(entries.some(e=>!refs.current.has(e.key)||!lines.current.has(e.key))){invalidate();return;}
    camera.updateMatrixWorld();
    const signature=camera.matrixWorld.elements.join(",")+camera.projectionMatrix.elements.join(",")+`${size.width}:${size.height}`+dataKey;
    if(signature===last.current)return;last.current=signature;
    const placed:{x:number;y:number;w:number;h:number}[]=[];let hidden=0;
    for(const e of entries){
      const el=refs.current.get(e.key)!,line=lines.current.get(e.key)!;
      vector.copy(e.position).project(camera);const ax=(vector.x+1)*size.width/2,ay=(1-vector.y)*size.height/2;
      if(vector.z< -1||vector.z>1||ax<0||ax>size.width||ay<0||ay>size.height){el.style.visibility="hidden";line.style.visibility="hidden";continue;}
      const w=el.offsetWidth||155,h=el.offsetHeight||42;let box:{x:number;y:number;w:number;h:number}|null=null;
      for(let ring=0;ring<8&&!box;ring++)for(const side of[1,-1]){
        const x=Math.max(4,Math.min(size.width-w-4,ax+side*(12+ring*12)-(side<0?w:0))),y=ay-h-12-ring*(h+6),candidate={x,y,w,h};
        if(x+w<=size.width-4&&y>=5&&y+h<size.height-30&&!placed.some(p=>boxesOverlap(candidate,p,5))){box=candidate;break;}
      }
      if(!box){el.style.visibility="hidden";line.style.visibility="hidden";hidden++;continue;}
      placed.push(box);el.style.visibility="visible";el.style.transform=`translate3d(${box.x}px,${box.y}px,0)`;line.style.visibility="visible";
      line.setAttribute("x1",String(ax));line.setAttribute("y1",String(ay));line.setAttribute("x2",String(Math.max(box.x,Math.min(box.x+w,ax))));line.setAttribute("y2",String(box.y+h));
    }
    if(count.current){count.current.textContent=hidden?`${hidden} more names · zoom in or use the seat map`:"";count.current.hidden=!hidden;}
  });
  return <Html fullscreen calculatePosition={(_object,_camera,size)=>[size.width/2,size.height/2]} style={{pointerEvents:"none"}} zIndexRange={[20,10]}>
    <div className="studio-projected-labels"><svg>{entries.map(e=><line key={e.key} ref={el=>{if(el)lines.current.set(e.key,el);else lines.current.delete(e.key);last.current="";invalidate();}} stroke="#789b69" strokeWidth="1"/>)}</svg>
      {entries.map(e=><button key={e.key} ref={el=>{if(el)refs.current.set(e.key,el);else refs.current.delete(e.key);last.current="";invalidate();}} data-guest-drag={e.guest.id} data-seat-table={e.table.id} data-seat-number={e.seat} onClick={()=>setModal({type:"seat",target:{tableId:e.table.id,seatNumber:e.seat}})} title={`Table ${e.table.label} · seat ${e.seat}`}><small>T{e.table.label} · SEAT {e.seat}</small>{e.guest.name}</button>)}
      <div className="studio-label-overflow" ref={count}/>
    </div>
  </Html>;
}
