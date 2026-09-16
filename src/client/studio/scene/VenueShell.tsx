import { useEffect, useMemo } from "react";
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Shape } from "three";
import { BAYS, VENUE, footprint, type Point } from "../model/geometry";
import type { ViewOptions } from "../model/schema";
import { InstancedBoxes, beamMatrix } from "./InstancedBoxes";
export function floorShape(points:Point[]):Shape {const shape=new Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();return shape;}
export function VenueShell({options,inside}:{options:ViewOptions;inside:boolean}){
  const shape=useMemo(()=>floorShape(footprint(48)),[]);
  const height=inside||options.walls==="full"?VENUE.eave:.55;
  const walls=useMemo(()=>{
    const p=footprint(18);p.splice(1,0,[-2.9,VENUE.front],[2.9,VENUE.front]);
    const panels:{x:number;z:number;width:number;rotation:number}[]=[],bars=[];
    for(let i=0;i<p.length;i++){
      const a=p[i],b=p[(i+1)%p.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(a[1]===VENUE.front&&b[1]===VENUE.front&&Math.abs(a[0])<=2.9&&Math.abs(b[0])<=2.9)continue;
      bars.push(beamMatrix([a[0],height,a[1]],[b[0],height,b[1]],.07));
      const count=Math.max(1,Math.ceil(length/1.45));
      for(let j=0;j<count;j++){
        const x=a[0]+(b[0]-a[0])*j/count,z=a[1]+(b[1]-a[1])*j/count,nx=a[0]+(b[0]-a[0])*(j+1)/count,nz=a[1]+(b[1]-a[1])*(j+1)/count;
        bars.push(beamMatrix([x,0,z],[x,height,z],.075));panels.push({x:(x+nx)/2,z:(z+nz)/2,width:length/count-.05,rotation:-Math.atan2(nz-z,nx-x)});
      }
    }
    for(const x of[-6.2,-3.6,3.6,6.2])for(const z of[-4.625,4.625])bars.push(beamMatrix([x,0,z],[x,height,z],.17));
    return {bars,panels};
  },[height]);
  const roof=useMemo(()=>{
    const bars=[],vertices:number[]=[],indices:number[]=[];
    const point=(x:number,theta:number,inner=0):[number,number,number]=>[x,VENUE.eave+4*Math.sin(theta)-inner,VENUE.depth/2*Math.cos(theta)];
    for(let k=0;k<17;k++){const x=-13.6+27.2*k/16;for(let j=0;j<24;j++){const a=j*Math.PI/24,b=(j+1)*Math.PI/24;bars.push(beamMatrix(point(x,a),point(x,b),.065),beamMatrix(point(x,a,.25),point(x,b,.25),.05),beamMatrix(point(x,a,j%2?0:.25),point(x,b,j%2?.25:0),.03));}}
    for(let i=0;i<=12;i++)bars.push(beamMatrix(point(-13.7,i*Math.PI/12),point(13.7,i*Math.PI/12),.06));
    for(let k=0;k<2;k++)for(let j=0;j<=48;j++)vertices.push(...point(k?13.7:-13.7,j*Math.PI/48));
    for(let j=0;j<48;j++)indices.push(j,j+1,j+49,j+1,j+50,j+49);
    for(const bay of BAYS){const base=vertices.length/3;vertices.push(bay.x,VENUE.eave+1.15,VENUE.back+.3);for(let j=0;j<=18;j++){const a=j*Math.PI/18,p:[number,number,number]=[bay.x+bay.r*Math.cos(a),VENUE.eave,VENUE.back-bay.r*Math.sin(a)];vertices.push(...p);bars.push(beamMatrix([bay.x,VENUE.eave+1.15,VENUE.back+.3],p,.05));if(j)indices.push(base,base+j,base+j+1);}}
    // End glazing closes the otherwise open main barrel vault.
    for(const x of[-13.6,13.6]){const base=vertices.length/3;vertices.push(x,VENUE.eave,0);for(let j=0;j<=48;j++)vertices.push(...point(x,j*Math.PI/48));for(let j=1;j<=48;j++)indices.push(base,base+j,base+j+1);for(let z=-4.8;z<=4.8;z+=1.2)bars.push(beamMatrix([x,VENUE.eave,z],[x,VENUE.eave+4*Math.sqrt(Math.max(0,1-(z/(VENUE.depth/2))**2)),z],.06));}
    const geometry=new BufferGeometry();geometry.setAttribute("position",new Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return {geometry,bars};
  },[]);
  useEffect(()=>()=>roof.geometry.dispose(),[roof]);
  return <group>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.18,0]} receiveShadow><extrudeGeometry args={[shape,{depth:.18,bevelEnabled:false}]}/><meshStandardMaterial color="#b0afa2" roughness={.96}/></mesh>
    <InstancedBoxes matrices={walls.bars}/>
    {walls.panels.map((p,i)=><mesh key={i} position={[p.x,height/2,p.z]} rotation={[0,p.rotation,0]}><boxGeometry args={[p.width,height-.08,.025]}/><meshStandardMaterial color="#bdd5cc" transparent opacity={.17} depthWrite={false} roughness={.12} metalness={.15}/></mesh>)}
    <group visible={inside||options.roof!=="cut"}><InstancedBoxes matrices={roof.bars}/></group>
    <mesh visible={inside||options.roof==="full"} geometry={roof.geometry}><meshStandardMaterial color="#d8e3d6" transparent opacity={.23} depthWrite={false} side={DoubleSide} roughness={.13}/></mesh>
    <group visible={options.garden}>
      <mesh position={[0,-.3,0]} receiveShadow><boxGeometry args={[100,.15,100]}/><meshStandardMaterial color="#dedfd1" roughness={1}/></mesh>
      <mesh position={[0,-.1,6.4]} receiveShadow><boxGeometry args={[27.8,.15,1.6]}/><meshStandardMaterial color="#d1d1be"/></mesh>
      {[0,1,2].map(n=><mesh key={n} position={[0,-.1-n*.07,7.2+n*.45]} receiveShadow><boxGeometry args={[5.8,.12,.5]}/><meshStandardMaterial color="#d7d3c1"/></mesh>)}
      {[[-11.7,2,.8,2.8],[-4,7.8,.6,2.5],[3.7,7.4,.7,2.6],[-16,-8,1.9,6],[16,-8,2,6.3]].map(([x,z,r,h],i)=><group key={i} position={[x,0,z]}><mesh position={[0,h/2,0]} castShadow><cylinderGeometry args={[.07,.12,h,7]}/><meshStandardMaterial color="#8e8065"/></mesh><mesh position={[0,h,0]} scale={[r,r*1.1,r]} castShadow><icosahedronGeometry args={[1,1]}/><meshStandardMaterial color="#80986c" roughness={1}/></mesh></group>)}
    </group>
    <gridHelper visible={options.grid} args={[40,40,"#97ad87","#c7d4bb"]} position={[0,.02,0]}/>
  </group>;
}
