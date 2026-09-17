import { useEffect, useMemo } from "react";
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from "three";
import { curtainPoint, swagPoint, roundClothPoint, noDecorRaycast, DECOR_COLORS, type Vec3 } from "./geometry";

interface FabricProps {
  kind?: "curtain" | "swag" | "round"; position?: Vec3; rotation?: Vec3;
  width: number; height: number; sag?: number; band?: number; lean?: number;
  pool?: number; tilt?: number; opacity?: number; gather?: number;
}
/** Pleated, double-sided cloth surfaces, rather than flat triangular stand-ins. */
export function Fabric({kind="curtain",position,rotation,width,height,sag=1,band=.24,lean=0,pool=.4,tilt=0,opacity=.94,gather=.65}:FabricProps){
  const geometry=useMemo(()=>{
    const nu=64,nv=32,positions:number[]=[],indices:number[]=[];
    for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){
      const u=i/nu,v=j/nv;
      positions.push(...(kind==="swag"?swagPoint(u,v,{width,height,sag,band,tilt}):kind==="round"?roundClothPoint(u,v,width/2,height):curtainPoint(u,v,{width,height,lean,pool,gather})));
    }
    for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+nu+1;indices.push(a,b,a+1,b,b+1,a+1);}
    const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
  },[kind,width,height,sag,band,lean,pool,tilt,gather]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh name={`decor-fabric-${kind}`} position={position} rotation={rotation} geometry={geometry} raycast={noDecorRaycast}>
    <meshPhysicalMaterial color={DECOR_COLORS.fabric} roughness={.88} sheen={.45} sheenRoughness={.9} sheenColor="#ffffff" side={DoubleSide} transparent={opacity<1} opacity={opacity} depthWrite={opacity===1}/>
  </mesh>;
}
