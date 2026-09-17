import { useLayoutEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { Color, Euler, InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { flowerHeads, noDecorRaycast, type FlowerClump, type Vec3 } from "./geometry";

const palettes={ivory:["#f8f5e9","#ecebdc","#c0cd98","#dfc6cb"],blush:["#dfbec5","#e7cdd2","#eee0df","#f7f1e6"],lime:["#adbb7b","#c6cf9f","#dfe3c0","#f6f4e8"]};
interface Instance { matrix:Matrix4; color:string }
function matrix(position:Vec3,scale:Vec3,rotation:Vec3):Matrix4 {
  return new Matrix4().compose(new Vector3(...position),new Quaternion().setFromEuler(new Euler(...rotation)),new Vector3(...scale));
}
function FlowerInstances({instances,leaves=false}:{instances:Instance[];leaves?:boolean}){
  const ref=useRef<InstancedMesh>(null),invalidate=useThree(s=>s.invalidate);
  useLayoutEffect(()=>{
    const mesh=ref.current;if(!mesh)return;
    const color=new Color();instances.forEach((p,i)=>{mesh.setMatrixAt(i,p.matrix);mesh.setColorAt(i,color.set(p.color));});
    mesh.count=instances.length;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.computeBoundingSphere();invalidate();
  },[instances,invalidate]);
  if(!instances.length)return null;
  return <instancedMesh ref={ref} name={leaves?"decor-leaves":"decor-petals"} args={[undefined,undefined,instances.length]} raycast={noDecorRaycast} castShadow>
    <sphereGeometry args={[1,6,4]}/><meshStandardMaterial roughness={.93}/>
  </instancedMesh>;
}
/** Thousands of small petals in two batched draws per arrangement. No frames or lights per flower. */
export function Flowers({clumps}:{clumps:FlowerClump[]}){
  const {petals,leaves}=useMemo(()=>{
    const petals:Instance[]=[],leaves:Instance[]=[];
    for(const clump of clumps){
      const colors=palettes[clump.tone??"ivory"];
      for(const [i,head] of flowerHeads(clump).entries()){
        const [x,y,z]=head.position,r=head.radius;
        const tint=colors[Math.min(3,Math.floor(head.tint*4))];
        // A flower is a rosette of cupped petals, not one large sphere.
        for(let p=0;p<6;p++){
          const a=head.turn+p*Math.PI/3,dx=Math.cos(a),dy=Math.sin(a);
          petals.push({matrix:matrix([x+dx*r*.46,y+dy*r*.46,z+.008],[r*.62,r*.35,r*.18],[.25*Math.sin(head.turn),.22*Math.cos(head.turn),a]),color:tint});
        }
        petals.push({matrix:matrix([x,y,z+.012],[r*.3,r*.3,r*.25],[0,0,head.turn]),color:head.tint<.2?"#b8ac79":tint});
        if(i%3===0){
          leaves.push({matrix:matrix([x-r*.5,y-r*.7,z-.035],[r*.38,r*1.9,r*.1],[.25,.5,head.turn]),color:i%15===0?"#482b34":"#839164"});
        }
      }
    }
    return {petals,leaves};
  },[clumps]);
  return <group name="decor-florals"><FlowerInstances instances={leaves} leaves/><FlowerInstances instances={petals}/></group>;
}

export function BerryTopping(){
  const instances=useMemo(()=>Array.from({length:105},(_,i)=>{
    const a=i*2.39996,r=.43*Math.sqrt(i/105);
    return {matrix:matrix([r*Math.cos(a),.905,r*Math.sin(a)],[.025,.022,.025],[0,0,0]),color:i%3?"#252128":"#353044"};
  }),[]);
  return <FlowerInstances instances={instances}/>;
}
