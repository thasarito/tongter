import { Suspense } from "react";
import { useTexture } from "@react-three/drei";
import { DoubleSide } from "three";
import type { DecorationMode, StudioItem } from "../../model/schema";
import { Fabric } from "./Fabric";
import { Flowers, BerryTopping } from "./Flowers";
import { DECOR_COLORS, decorTransform, noDecorRaycast, type Vec3, type FlowerClump } from "./geometry";

export function DecorBox({position,size,color=DECOR_COLORS.fabric}:{position:Vec3;size:Vec3;color?:string}){
  return <mesh position={position} raycast={noDecorRaycast} castShadow receiveShadow><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.92}/></mesh>;
}
export function Candle({position,height=.32}:{position:Vec3;height?:number}){
  return <group position={position}>
    <mesh position={[0,height/2,0]} raycast={noDecorRaycast}><cylinderGeometry args={[.018,.022,height,10]}/><meshStandardMaterial color="#fcf2dd" roughness={.9}/></mesh>
    <mesh position={[0,height+.012,0]} scale={[1,1.8,1]} raycast={noDecorRaycast}><sphereGeometry args={[.009,6,4]}/><meshBasicMaterial color="#ffdf9c" toneMapped={false}/></mesh>
    <mesh position={[0,.015,0]} raycast={noDecorRaycast}><cylinderGeometry args={[.036,.045,.025,12]}/><meshStandardMaterial color="#b5a27b" metalness={.55} roughness={.38}/></mesh>
  </group>;
}
/** The existing path-only wedding wordmark is the same script mark as the PDF. */
export function WeddingWordmark({position,width=.78}:{position:Vec3;width?:number}){
  const map=useTexture("/logo.svg");
  return <mesh name="decor-wedding-wordmark" position={position} raycast={noDecorRaycast}>
    <planeGeometry args={[width,width*276/759]}/><meshBasicMaterial map={map} transparent side={DoubleSide} depthWrite={false} toneMapped={false}/>
  </mesh>;
}
const stageFlowers:FlowerClump[]=[
  {center:[-1.85,.22,.40],radius:[.57,.20,.29],count:240,seed:12},
  {center:[-1.57,.76,.04],radius:[.30,.53,.20],count:220,seed:24},
  {center:[-1.35,1.54,-.13],radius:[.26,.52,.21],count:260,seed:37,tone:"lime"},
  {center:[-1.29,2.03,-.14],radius:[.13,.30,.13],count:100,seed:41,tone:"blush"},
  {center:[-1.37,.69,.20],radius:[.41,.18,.24],count:160,seed:52,tone:"blush"},
  {center:[1.21,.22,.40],radius:[.54,.20,.27],count:220,seed:64},
  {center:[1.64,.68,.04],radius:[.32,.37,.22],count:230,seed:73,tone:"blush"},
  {center:[1.51,1.15,-.11],radius:[.18,.48,.17],count:160,seed:85},
  {center:[1.95,.46,.16],radius:[.34,.24,.20],count:160,seed:97,tone:"lime"},
  {center:[-.40,4.63,.25],radius:[.74,.23,.30],count:300,seed:104,tone:"blush"},
  {center:[.34,4.59,.21],radius:[.60,.24,.29],count:290,seed:118,tone:"lime"},
  {center:[.18,4.10,.25],radius:[.14,.50,.13],count:140,seed:131},
];
const headFlowers:FlowerClump[]=[
  {center:[-.85,.84,.53],radius:[.29,.14,.18],count:100,seed:212,tone:"blush"},
  {center:[-1.02,.55,.59],radius:[.11,.29,.12],count:60,seed:222},
  {center:[.89,.82,.44],radius:[.15,.12,.14],count:60,seed:232},
];
export function DrapedTable({width=2.2,depth=.72,height=.78}:{width?:number;depth?:number;height?:number}){
  return <group name="decor-draped-table">
    <DecorBox position={[0,height-.025,0]} size={[width,.05,depth]}/>
    <Fabric position={[0,0,depth/2+.01]} width={width+.08} height={height} pool={.10} opacity={1}/>
    <Fabric position={[0,0,-depth/2-.01]} rotation={[0,Math.PI,0]} width={width+.08} height={height} pool={.08} opacity={1}/>
    {[-1,1].map(sign=><Fabric key={sign} position={[sign*width/2,0,0]} rotation={[0,sign*Math.PI/2,0]} width={depth+.05} height={height} pool={.09} opacity={1}/>)}
    {[0,.095].map((drop,i)=><Fabric key={i} kind="swag" position={[0,0,depth/2+.05+i*.025]} width={width} height={height-drop} sag={height*.40} band={.13} opacity={.91}/>)}
  </group>;
}
function BridalChair({x}:{x:number}){
  return <group position={[x,0,-.65]}>
    <DecorBox position={[0,.43,0]} size={[.49,.055,.43]} color="#ae754c"/>
    {[-.22,.22].flatMap(s=>[-.19,.19].map(z=><DecorBox key={`${s}-${z}`} position={[s,.23,z]} size={[.032,.46,.032]} color="#91603e"/>))}
    {[-.24,.24].map(s=><DecorBox key={s} position={[s,.73,-.20]} size={[.035,.61,.035]} color="#ac794f"/>)}
    <DecorBox position={[0,1.02,-.20]} size={[.51,.085,.035]} color="#b78257"/>
    <Fabric kind="swag" position={[0,0,-.17]} width={.47} height={.96} sag={.15} band={.21}/>
  </group>;
}
function HeadTable(){
  return <group name="decor-head-table" position={[0,0,.32]}>
    <BridalChair x={-.42}/><BridalChair x={.42}/><DrapedTable/>
    <Flowers clumps={headFlowers}/>
    {[-.98,-.79,.70,.91].map((x,i)=><Candle key={x} position={[x,.79,.22]} height={i%2?.52:.66}/>)}
    {[-.42,.03,.46].map(x=><Candle key={x} position={[x,.79,.27]} height={.09}/>)}
  </group>;
}
function CakeTable(){
  return <group name="decor-cake-table" position={[0,0,.35]}>
    <Fabric kind="round" width={1.12} height={.78} opacity={1}/>
    <mesh position={[0,.78,0]} raycast={noDecorRaycast}><cylinderGeometry args={[.57,.57,.035,48]}/><meshStandardMaterial color={DECOR_COLORS.fabric}/></mesh>
    <mesh position={[0,.842,0]} raycast={noDecorRaycast}><cylinderGeometry args={[.47,.47,.09,48]}/><meshStandardMaterial color="#efe5ca" roughness={.96}/></mesh>
    {/* The reference is a low, berry-topped cake, not a tiered wedding cake. */}
    <BerryTopping/>
  </group>;
}
export function StageDecor({stage,mode}:{stage:StudioItem;mode:DecorationMode}){
  return <group name="decor-stage-assembly" {...decorTransform(stage)}>
    <DecorBox position={[0,1.20,-1.10]} size={[5.08,2.4,.055]} color={DECOR_COLORS.board}/>
    <Suspense fallback={null}><WeddingWordmark position={[0,1.80,-1.063]} width={.78}/></Suspense>
    {/* Layered catenary swags keep the center open around the wordmark. */}
    {[0,.12,.25,.38].map((drop,i)=><Fabric key={i} kind="swag" position={[0,0,-.86+i*.03]} width={3.15+i*.09} height={3.58-drop} sag={2.56} band={.18} opacity={.73}/>)}
    <Fabric position={[-1.30,0,-.73]} width={.74} height={3.58} lean={.08} pool={.52}/>
    <Fabric position={[1.30,0,-.67]} width={.90} height={3.60} lean={-.38} pool={.62}/>
    <Fabric position={[-2.23,0,-.49]} width={.45} height={2.95} lean={.43} pool={.34} opacity={.64}/>
    <Fabric position={[2.13,0,-.48]} width={.48} height={3.65} lean={-.34} pool={.48} opacity={.61}/>
    <Fabric kind="swag" position={[-1.72,0,-.51]} width={1.38} height={3.55} sag={2.02} band={.24} tilt={.18} opacity={.63}/>
    <Fabric kind="swag" position={[1.66,0,-.43]} width={1.47} height={3.63} sag={2.06} band={.29} tilt={.28} opacity={.65}/>
    {[-1.85,-.59,.76,2].map((x,i)=><Fabric key={i} kind="swag" position={[x,0,.10]} width={1.8} height={5.12-i%2*.2} sag={1.07+i%2*.2} band={.24} opacity={.57}/>)}
    <Flowers clumps={stageFlowers}/>
    {mode==="head-table"&&<HeadTable/>}{mode==="cake-table"&&<CakeTable/>}
  </group>;
}
