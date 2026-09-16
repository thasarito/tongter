import { useLayoutEffect, useMemo, useRef } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Color, InstancedMesh, Matrix4, Object3D, Quaternion, Vector3 } from "three";
export interface BoxInstance { position:[number,number,number]; scale:[number,number,number]; rotation?:number }
export function boxMatrix({position,scale,rotation=0}:BoxInstance):Matrix4 {
  const object=new Object3D();object.position.set(...position);object.rotation.y=rotation;object.scale.set(...scale);object.updateMatrix();return object.matrix.clone();
}
export function beamMatrix(a:[number,number,number],b:[number,number,number],width=.06):Matrix4 {
  const from=new Vector3(...a),to=new Vector3(...b),delta=to.clone().sub(from);
  const q=new Quaternion().setFromUnitVectors(new Vector3(0,1,0),delta.clone().normalize());
  return new Matrix4().compose(from.add(to).multiplyScalar(.5),q,new Vector3(width,delta.length(),width));
}
/** One draw call per material; the mesh owns its declarative geometry/material. */
export function InstancedBoxes({matrices,color="#354039",colors,metalness=.35,userData,onClick}:{matrices:Matrix4[];color?:string;colors?:string[];metalness?:number;userData?:Record<string,unknown>;onClick?:(e:ThreeEvent<MouseEvent>)=>void}){
  const ref=useRef<InstancedMesh>(null),invalidate=useThree(s=>s.invalidate),tint=useMemo(()=>new Color(),[]);
  useLayoutEffect(()=>{const mesh=ref.current;if(!mesh)return;matrices.forEach((m,i)=>{mesh.setMatrixAt(i,m);if(colors)mesh.setColorAt(i,tint.set(colors[i]??color));});mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();invalidate();},[matrices,colors,color,tint,invalidate]);
  if(!matrices.length)return null;
  return <instancedMesh key={matrices.length} ref={ref} args={[undefined,undefined,matrices.length]} castShadow receiveShadow userData={userData} onClick={onClick}>
    <boxGeometry/><meshStandardMaterial color={colors?"white":color} roughness={.62} metalness={metalness}/>
  </instancedMesh>;
}
