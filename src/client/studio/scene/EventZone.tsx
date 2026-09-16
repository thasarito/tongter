import { useMemo } from "react";
import { localPolygon, radians } from "../model/geometry";
import type { StudioItem } from "../model/schema";
import { useStudio } from "../state/StudioProvider";
import { floorShape } from "./VenueShell";
const palette={table:"#f7f4e6",stage:"#718777",aisle:"#d9caab",runner:"#d9caab",band:"#afc09f",bar:"#80916d",buffet:"#b6a482",dance:"#cdb182"};
export function EventZone({item}:{item:StudioItem}){
  const {setSelected,view}=useStudio(),shape=useMemo(()=>floorShape(localPolygon(item)),[item]);
  return <group position={[item.x,.012,item.z]} rotation={[0,-radians(item.rotation),0]}>
    <mesh rotation={[-Math.PI/2,0,0]} castShadow receiveShadow onClick={e=>{e.stopPropagation();if(view!=="inside")setSelected(item.id);}}><extrudeGeometry args={[shape,{depth:item.h,bevelEnabled:false}]}/><meshStandardMaterial color={palette[item.kind]} roughness={.9}/></mesh>
    {item.kind==="stage"&&<mesh position={[item.w/2-.08,item.h+1.2,0]}><boxGeometry args={[.05,2.4,Math.max(.2,item.d-.25)]}/><meshStandardMaterial color="#f7f5e9"/></mesh>}
    {["bar","buffet"].includes(item.kind)&&<mesh position={[0,item.h+.025,0]}><boxGeometry args={[item.w+.06,.05,item.d+.06]}/><meshStandardMaterial color="#e7e2cf" roughness={.7}/></mesh>}
  </group>;
}
