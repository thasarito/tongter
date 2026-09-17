import { Suspense } from "react";
import type { DecorationMode, StudioItem } from "../model/schema";
import { Fabric } from "./decor/Fabric";
import { Flowers } from "./decor/Flowers";
import { Candle, DecorBox, DrapedTable, StageDecor, WeddingWordmark } from "./decor/StageDecor";
import { noDecorRaycast, type FlowerClump } from "./decor/geometry";
export type { DecorationMode } from "../model/schema";

const entryFlowers:FlowerClump[]=[
  {center:[.5,.25,.18],radius:[.32,.23,.21],count:100,seed:310,tone:"blush"},
  {center:[2.83,.84,.16],radius:[.24,.16,.22],count:85,seed:320,tone:"blush"},
];
const gardenFlowers:FlowerClump[]=[
  {center:[.6,.24,.25],radius:[.66,.23,.31],count:240,seed:410},
  {center:[.75,.86,.05],radius:[.24,.65,.19],count:240,seed:420,tone:"lime"},
  {center:[.80,1.58,.03],radius:[.13,.30,.15],count:120,seed:430,tone:"blush"},
];
const tableFlowers:FlowerClump[]=[{center:[0,.19,0],radius:[.13,.12,.11],count:35,seed:510,tone:"blush"}];
function EntranceDecor(){
  return <group name="decor-entrance" position={[-11.15,0,-4.15]} rotation={[0,.15,0]}>
    <DecorBox position={[0,1.08,0]} size={[1.02,2.16,.06]} color="#c4bcad"/>
    <mesh position={[0,1.08,.04]} raycast={noDecorRaycast}><planeGeometry args={[.92,2.07]}/><meshStandardMaterial color="#d0d3d1" metalness={.82} roughness={.18}/></mesh>
    <Fabric position={[-.50,0,.065]} width={.30} height={2.20} lean={-.10} pool={.26}/>
    <Fabric position={[.50,0,.065]} width={.30} height={2.20} lean={.13} pool={.24}/>
    <Fabric kind="swag" position={[0,0,.08]} width={1.06} height={2.21} sag={.10} band={.16}/>
    <Suspense fallback={null}><WeddingWordmark position={[0,.95,.08]} width={.62}/></Suspense>
    {[-.54,-.34,-.17].map((x,i)=><Candle key={x} position={[x,.02,.26]} height={.16+i*.085}/>)}
    <group position={[2.0,0,.1]}><DrapedTable width={2.35}/><DecorBox position={[-.64,.98,0]} size={[.30,.38,.28]}/><DecorBox position={[-.16,.9,.08]} size={[.26,.23,.03]} color="#cfc6b6"/></group>
    <DecorBox position={[3.65,1.10,.12]} size={[.95,2.2,.06]}/>
    {/* Abstract seating-chart lines only; never publish real names or invitations. */}
    {Array.from({length:18},(_,i)=><DecorBox key={i} position={[3.65,1.84-i*.076,.156]} size={[i%6===0?.5:.32,.005,.005]} color="#a8a093"/>)}
    <Flowers clumps={entryFlowers}/>
  </group>;
}
function GardenBackdrop(){
  return <group name="decor-garden" position={[-7.2,0,7.65]} rotation={[0,-.3,0]}>
    <DecorBox position={[-1.02,1.7,-.10]} size={[.028,3.4,.028]} color="#cbc3b4"/>
    <DecorBox position={[1.04,1.35,-.10]} size={[.028,2.7,.028]} color="#cbc3b4"/>
    <Fabric position={[-1.02,0,0]} width={.70} height={3.45} lean={.20} pool={.48}/>
    <Fabric position={[1.04,0,0]} width={.54} height={2.72} lean={-.24} pool={.35}/>
    {[0,.35,.65].map((drop,i)=><Fabric key={i} kind="swag" position={[0,0,.03+i*.04]} width={2.06} height={3.1-drop} sag={.84} band={.28} tilt={-.73} opacity={.76}/>)}
    <Flowers clumps={gardenFlowers}/>
  </group>;
}
function TableFlowers({table}:{table:StudioItem}){
  const scale=Math.min(.9,table.w/1.5,table.d/.9);
  return <group name="decor-table-centerpiece" position={[table.x,table.h+.02,table.z]} rotation={[0,-table.rotation*Math.PI/180,0]} scale={scale}>
    <mesh position={[0,.06,0]} raycast={noDecorRaycast}><cylinderGeometry args={[.045,.06,.12,12]}/><meshStandardMaterial color="#d4cbb4" metalness={.3} roughness={.5}/></mesh>
    <Flowers clumps={tableFlowers}/><Candle position={[-.24,0,0]} height={.16}/><Candle position={[.22,0,.04]} height={.23}/>
  </group>;
}
/** View-only meshes. No layout state, collision/picking targets, or Sheets writes. */
export function WeddingDecor({items,mode,furniture=true,garden=true}:{items:StudioItem[];mode:DecorationMode;furniture?:boolean;garden?:boolean}){
  const stage=items.find(item=>item.kind==="stage");
  return <group name="wedding-decor">
    {furniture&&<>{stage&&<StageDecor stage={stage} mode={mode}/>}<EntranceDecor/>{items.filter(item=>item.kind==="table").map(table=><TableFlowers key={table.id} table={table}/>)}</>}
    {garden&&<GardenBackdrop/>}
  </group>;
}
