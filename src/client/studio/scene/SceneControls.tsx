import { useEffect, useMemo, type RefObject } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Group, Object3D, PerspectiveCamera, Raycaster, Vector2 } from "three";
import { useStudio } from "../state/StudioProvider";
import { useGuestDrag } from "../interaction/GuestDragProvider";
import type { SeatTarget } from "../model/schema";

export function ScenePicker({furniture}:{furniture:RefObject<Group|null>}){
  const {camera,gl,invalidate}=useThree(),{registerScenePicker}=useGuestDrag(),{layout,options}=useStudio();
  const ray=useMemo(()=>new Raycaster(),[]),pointer=useMemo(()=>new Vector2(),[]);
  useEffect(()=>{
    registerScenePicker((x,y):SeatTarget|null=>{
      if(!furniture.current||!options.furniture)return null;
      const box=gl.domElement.getBoundingClientRect();if(!box.width||!box.height)return null;
      pointer.set((x-box.left)/box.width*2-1,-(y-box.top)/box.height*2+1);ray.setFromCamera(pointer,camera);
      for(const hit of ray.intersectObject(furniture.current,true)){
        let node:Object3D|null=hit.object,visible=true;
        while(node){if(!node.visible){visible=false;break;}node=node.parent;}if(!visible)continue;
        node=hit.object;let tableId:string|undefined;
        while(node&&!tableId){if(typeof node.userData.tableId==="string")tableId=node.userData.tableId;node=node.parent;}
        // A visible event zone must block objects behind it, not become a drop-through target.
        if(!tableId)return null;
        const list=hit.object.userData.seatNumbers as number[]|undefined;
        return {tableId,seatNumber:hit.instanceId!==undefined&&list?list[hit.instanceId]:null};
      }
      return null;
    });
    return()=>registerScenePicker(null);
  },[camera,gl,ray,pointer,furniture,options.furniture,registerScenePicker]);
  useEffect(()=>{gl.shadowMap.autoUpdate=false;gl.shadowMap.needsUpdate=true;invalidate();},[gl,invalidate,layout,options]);
  return null;
}
export function ModelControls(){
  const {camera,invalidate,size}=useThree(),{modal}=useStudio(),{active}=useGuestDrag();
  useEffect(()=>{
    camera.position.set(24,23,29);if(size.width<size.height)camera.position.multiplyScalar(1.4);
    if(camera instanceof PerspectiveCamera){camera.fov=42;camera.updateProjectionMatrix();}
    camera.lookAt(0,1,-.5);invalidate();
  },[camera,invalidate,size.width,size.height]);
  return <OrbitControls makeDefault target={[0,1,-.5]} enableDamping dampingFactor={.08} minDistance={4} maxDistance={95} maxPolarAngle={Math.PI*.49} enabled={!modal&&!active}/>;
}
