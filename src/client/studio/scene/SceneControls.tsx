import { useCallback, useEffect, useMemo, useRef, type ComponentRef, type RefObject } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Group, Object3D, PerspectiveCamera, Raycaster, Vector2 } from "three";
import { useStudio } from "../state/StudioProvider";
import { useViewportActions } from "../state/StudioChrome";
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
  const {camera,invalidate,size}=useThree(),{modal}=useStudio(),{active}=useGuestDrag(),controls=useRef<ComponentRef<typeof OrbitControls>>(null);
  const fit=useCallback(()=>{
    camera.position.set(24,23,29);if(size.width<size.height)camera.position.multiplyScalar(1.4);
    if(camera instanceof PerspectiveCamera){camera.fov=42;camera.updateProjectionMatrix();}
    controls.current?.target.set(0,1,-.5);camera.lookAt(0,1,-.5);controls.current?.update();invalidate();
  },[camera,invalidate,size.width,size.height]);
  useEffect(fit,[fit]);
  function zoom(factor:number){const c=controls.current;if(!c)return;const offset=camera.position.clone().sub(c.target);offset.setLength(Math.min(95,Math.max(4,offset.length()*factor)));camera.position.copy(c.target).add(offset);c.update();invalidate();}
  useViewportActions({"zoom-in":()=>zoom(.8),"zoom-out":()=>zoom(1.25),fit});
  return <OrbitControls ref={controls} makeDefault target={[0,1,-.5]} enableDamping dampingFactor={.08} minDistance={4} maxDistance={95} maxPolarAngle={Math.PI*.49} enabled={!modal&&!active}/>;
}
