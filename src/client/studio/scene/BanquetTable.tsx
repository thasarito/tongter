import { useMemo } from "react";
import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { Matrix4 } from "three";
import { radians, seats } from "../model/geometry";
import { occupant, type StudioItem } from "../model/schema";
import { useStudio } from "../state/StudioProvider";
import { InstancedBoxes, boxMatrix } from "./InstancedBoxes";
export function BanquetTable({item}:{item:StudioItem}){
  const {layout,options,selected,setSelected,setModal,view}=useStudio();
  const chairData=useMemo(()=>{
    const frames:Matrix4[]=[],cushions:Matrix4[]=[],numbers:number[]=[];
    for(const s of seats(item)){
      const root=boxMatrix({position:[s.local[0],0,s.local[1]],scale:[1,1,1],rotation:Math.PI/2-s.angle});
      const add=(x:number,y:number,z:number,w:number,h:number,d:number)=>{frames.push(root.clone().multiply(boxMatrix({position:[x,y,z],scale:[w,h,d]})));numbers.push(s.number);};
      for(const x of[-.17,.17])for(const z of[-.15,.15])add(x,.22,z,.026,.44,.026);
      for(const x of[-.2,.2])add(x,.72,.17,.025,.54,.025);
      for(const y of[.5,.76,.98])add(0,y,.17,.42,.025,.025);
      for(const x of[-.09,0,.09])add(x,.865,.17,.014,.23,.014);
      cushions.push(root.clone().multiply(boxMatrix({position:[0,.46,0],scale:[.4,.055,.37]})));
    }
    return {frames,cushions,numbers};
  },[item.w,item.d,item.seats]);
  const colors=useMemo(()=>seats(item).map(s=>occupant(layout,{tableId:item.id,seatNumber:s.number})?"#607d5b":"#eee7d4"),[layout,item]);
  const clickSeat=(numbers:number[])=>(e:ThreeEvent<MouseEvent>)=>{e.stopPropagation();if(view==="inside"||e.instanceId===undefined)return;setModal({type:"seat",target:{tableId:item.id,seatNumber:numbers[e.instanceId]}});};
  const circle=item.shape!=="rect";
  return <group position={[item.x,0,item.z]} rotation={[0,-radians(item.rotation),0]} userData={{tableId:item.id}}>
    <mesh position={[0,item.h-.04,0]} scale={circle?[item.w/2,1,item.d/2]:[1,1,1]} castShadow receiveShadow userData={{tableId:item.id}} onClick={e=>{e.stopPropagation();if(view!=="inside")setSelected(item.id);}}>
      {circle?<cylinderGeometry args={[1,1,.08,48]}/>:<boxGeometry args={[item.w,.08,item.d]}/>}<meshStandardMaterial color={selected===item.id?"#eef4df":"#fcfaf0"} roughness={.94}/>
    </mesh>
    <mesh position={[0,item.h-.16,0]} scale={circle?[item.w/2,1,item.d/2]:[1,1,1]} castShadow userData={{tableId:item.id}}>{circle?<cylinderGeometry args={[1,1,.22,48,1,true]}/>:<boxGeometry args={[item.w,.22,item.d]}/>}<meshStandardMaterial color="#f2f1e5" roughness={.95}/></mesh>
    <mesh position={[0,(item.h-.1)/2,0]} castShadow><cylinderGeometry args={[.095,.13,item.h-.1,12]}/><meshStandardMaterial color="#b1b29c" metalness={.45}/></mesh>
    <mesh position={[0,.04,0]}><cylinderGeometry args={[.27,.3,.06,16]}/><meshStandardMaterial color="#b1b29c" metalness={.45}/></mesh>
    <group visible={options.chairs}>
      <InstancedBoxes matrices={chairData.frames} color="#b7bba7" metalness={.65} userData={{tableId:item.id,seatNumbers:chairData.numbers}} onClick={clickSeat(chairData.numbers)}/>
      <InstancedBoxes matrices={chairData.cushions} colors={colors} metalness={0} userData={{tableId:item.id,seatNumbers:colors.map((_,i)=>i+1)}} onClick={clickSeat(colors.map((_,i)=>i+1))}/>
    </group>
    {options.tableLabels&&<Html center position={[0,item.h+.08,0]} style={{pointerEvents:"none"}} zIndexRange={[8,0]}><span className="studio-table-number">{item.label}</span></Html>}
  </group>;
}
