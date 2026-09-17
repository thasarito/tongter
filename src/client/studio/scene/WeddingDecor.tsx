import { DoubleSide, Shape } from "three";
import type { StudioItem } from "../model/schema";

export type DecorationMode = "stage" | "head-table" | "cake-table";

function FlowerCluster({position,scale=1}:{position:[number,number,number];scale?:number}){
  const flowers:[number,number,number,string,number][]=[
    [0,0,0,"#f7f3e8",.23],[.24,.1,.02,"#ead7d5",.2],[-.2,.16,-.02,"#f2e7df",.19],[.08,.31,.03,"#cfd8bf",.18],[-.13,.34,.01,"#f4eee8",.16],[.33,.28,-.02,"#d9c2c6",.15],
  ];
  return <group position={position} scale={scale}>
    {flowers.map(([x,y,z,color,r],i)=><mesh key={i} position={[x,y,z]} castShadow><sphereGeometry args={[r,10,8]}/><meshStandardMaterial color={color} roughness={.95}/></mesh>)}
    <mesh position={[.02,.12,-.08]} rotation={[0,0,.35]}><boxGeometry args={[.08,.9,.05]}/><meshStandardMaterial color="#6f7c5d" roughness={1}/></mesh>
    <mesh position={[-.18,.18,-.06]} rotation={[0,0,-.45]}><boxGeometry args={[.07,.72,.04]}/><meshStandardMaterial color="#748368" roughness={1}/></mesh>
  </group>;
}
function Candle({position,height=.38}:{position:[number,number,number];height?:number}){
  return <group position={position}><mesh position={[0,height/2,0]} castShadow><cylinderGeometry args={[.025,.028,height,10]}/><meshStandardMaterial color="#f4ead6" roughness={.8}/></mesh><mesh position={[0,height+.035,0]}><sphereGeometry args={[.035,8,6]}/><meshStandardMaterial color="#ffd79d" emissive="#ffb557" emissiveIntensity={1.4}/></mesh></group>;
}
function DrapedBackdrop({centerZ,width=6.6}:{centerZ:number;width?:number}){
  const shape=new Shape();shape.moveTo(-.48,0);shape.bezierCurveTo(-.35,.9,-.12,1.55,0,2.25);shape.bezierCurveTo(.12,1.55,.35,.9,.48,0);shape.lineTo(-.48,0);
  return <group position={[10.8,0,centerZ]} rotation={[0,Math.PI/2,0]}>
    {[-width*.38,-width*.12,width*.12,width*.38].map((x,i)=><mesh key={i} position={[x,1.4,0]} scale={[1.15,1.2,1]} castShadow><shapeGeometry args={[shape]}/><meshStandardMaterial color="#f4f1e8" side={DoubleSide} transparent opacity={.78} roughness={1}/></mesh>)}
    <mesh position={[0,2.2,-.08]}><boxGeometry args={[width,.08,.08]}/><meshStandardMaterial color="#ded9ce" roughness={1}/></mesh>
  </group>;
}
function StageFlowers({z}:{z:number}){
  return <><FlowerCluster position={[9.65,.1,z-2.15]} scale={1.55}/><FlowerCluster position={[9.55,.08,z+2.1]} scale={1.35}/><FlowerCluster position={[10.15,3.95,z-.2]} scale={1.15}/><FlowerCluster position={[10.0,4.25,z+.72]} scale={.9}/></>;
}
function HeadTable({stage}:{stage:StudioItem}){
  const z=stage.z;
  return <group>
    <mesh position={[stage.x-1.4,.76,z]} castShadow><boxGeometry args={[2.8,.09,.78]}/><meshStandardMaterial color="#f4eee8" roughness={1}/></mesh>
    <mesh position={[stage.x-1.4,.39,z]} castShadow><boxGeometry args={[2.86,.72,.82]}/><meshStandardMaterial color="#eee5de" roughness={1}/></mesh>
    <FlowerCluster position={[stage.x-2.6,.82,z-.23]} scale={.72}/><FlowerCluster position={[stage.x-.42,.82,z+.22]} scale={.62}/>
    {[-2.1,-1.72,-1.1,-.72].map((x,i)=><Candle key={i} position={[stage.x+x,.82,z+(i%2?.28:-.26)]} height={i%2?.5:.36}/>) }
  </group>;
}
function CakeTable({stage}:{stage:StudioItem}){
  return <group position={[stage.x-1.4,0,stage.z]}>
    <mesh position={[0,.43,0]} castShadow><cylinderGeometry args={[.63,.72,.84,36]}/><meshStandardMaterial color="#eee7df" roughness={1}/></mesh>
    <mesh position={[0,.88,0]} castShadow><cylinderGeometry args={[.42,.44,.12,36]}/><meshStandardMaterial color="#f7f3ed" roughness={.95}/></mesh>
    <mesh position={[0,1.02,0]} castShadow><cylinderGeometry args={[.3,.33,.16,30]}/><meshStandardMaterial color="#e5ddd4" roughness={.9}/></mesh>
    <FlowerCluster position={[.56,.08,.36]} scale={.55}/><Candle position={[-.62,.04,.18]} height={.34}/><Candle position={[.65,.04,-.26]} height={.28}/>
  </group>;
}
function EntranceDecor(){
  return <group position={[-11.15,0,-4.15]} rotation={[0,.15,0]}>
    <mesh position={[0,1.08,0]} castShadow><boxGeometry args={[1.45,2.15,.09]}/><meshStandardMaterial color="#d8d6d0" metalness={.08} roughness={.35}/></mesh>
    <mesh position={[0,1.08,-.055]}><boxGeometry args={[1.28,1.98,.025]}/><meshStandardMaterial color="#f3f1ed" metalness={.65} roughness={.12}/></mesh>
    <FlowerCluster position={[.52,.05,.22]} scale={.72}/>{[-.63,-.42,-.2].map((x,i)=><Candle key={i} position={[x,.01,.25]} height={.2+i*.08}/>)}
    <mesh position={[2.0,.4,.1]} castShadow><boxGeometry args={[2.35,.78,.72]}/><meshStandardMaterial color="#eee5dc" roughness={1}/></mesh>
    <FlowerCluster position={[2.82,.78,.12]} scale={.52}/>
    <mesh position={[3.65,1.12,.12]} castShadow><boxGeometry args={[.95,2.25,.08]}/><meshStandardMaterial color="#f4f0e7" roughness={1}/></mesh>
  </group>;
}
function GardenBackdrop(){
  return <group position={[-7.2,0,7.65]} rotation={[0,-.3,0]}>
    <mesh position={[-.9,1.75,0]}><boxGeometry args={[.08,3.5,.08]}/><meshStandardMaterial color="#d7d2c8"/></mesh><mesh position={[1.05,1.5,0]}><boxGeometry args={[.08,3,.08]}/><meshStandardMaterial color="#d7d2c8"/></mesh>
    <mesh position={[.08,2.25,0]} rotation={[0,0,-.3]}><boxGeometry args={[2.5,.035,.04]}/><meshStandardMaterial color="#eee9e0" transparent opacity={.76}/></mesh>
    <mesh position={[.08,1.6,.01]} rotation={[0,0,.25]}><boxGeometry args={[2.8,.035,.04]}/><meshStandardMaterial color="#f4f1ea" transparent opacity={.72}/></mesh>
    <FlowerCluster position={[.55,.05,.08]} scale={1.05}/>
  </group>;
}
export function WeddingDecor({items,mode}:{items:StudioItem[];mode:DecorationMode}){
  const stage=items.find(item=>item.kind==="stage");
  if(!stage)return null;
  return <group name="wedding-decor" raycast={()=>null}>
    <DrapedBackdrop centerZ={stage.z}/><StageFlowers z={stage.z}/>
    {mode==="head-table"&&<HeadTable stage={stage}/>} {mode==="cake-table"&&<CakeTable stage={stage}/>} 
    <EntranceDecor/><GardenBackdrop/>
  </group>;
}
