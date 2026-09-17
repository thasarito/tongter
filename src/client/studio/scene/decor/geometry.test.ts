import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { curtainPoint, decorPosition, decorTransform, flowerHeads, noDecorRaycast, roundClothPoint, stageTiers, swagPoint } from "./geometry";
const stage={x:10.94,z:.12,w:2.55,d:6.5,h:.45,rotation:0};
describe("PDF decoration geometry",()=>{
  it("adds three real treads inside the sheet-backed stage bounds",()=>{
    for(const dimensions of [stage,{...stage,w:.3,d:.3,h:.01},{...stage,w:6,d:12,h:1.2}]){
      const tiers=stageTiers(dimensions);expect(tiers).toHaveLength(3);
      expect(tiers[0].width).toBe(dimensions.d);expect(tiers[0].depth).toBe(dimensions.w);
      expect(tiers[2].height).toBeCloseTo(dimensions.h);
      for(const [i,tier]of tiers.entries()){
        expect(tier.depth).toBeGreaterThan(0);expect(tier.width).toBeGreaterThan(0);
        expect(tier.front).toBeLessThanOrEqual(dimensions.w/2);
        expect(tier.front-tier.depth).toBeCloseTo(-dimensions.w/2);
        if(i)expect(tier.front).toBeLessThan(tiers[i-1].front);
      }
    }
  });
  it("moves and rotates the whole decorated assembly with its stage",()=>{
    for(const rotation of [0,90,180,-31]){
      const s={...stage,x:4,z:-2,rotation},t=decorTransform(s),g=new Group();
      g.position.set(...t.position);g.rotation.set(...t.rotation);g.scale.set(...t.scale);g.updateMatrixWorld(true);
      const actual=g.localToWorld(new Vector3(1,2,.5)).toArray(),expected=decorPosition(s,[1,2,.5]);
      actual.forEach((n,i)=>expect(n).toBeCloseTo(expected[i]));
    }
    expect(decorTransform({...stage,d:3.25,w:1.275}).scale).toEqual([.5,.5,.5]);
  });
  it("gives curtains pleated depth, floor pooling and a tall suspension point",()=>{
    const shape={width:.8,height:3.6,pool:.4};
    expect(curtainPoint(.5,0,shape)[1]).toBe(3.6);
    expect(curtainPoint(.5,1,shape)[1]).toBeLessThan(.05);
    const depths=Array.from({length:41},(_,i)=>curtainPoint(i/40,.5,shape)[2]);
    expect(Math.max(...depths)-Math.min(...depths)).toBeGreaterThan(.04);
    expect(curtainPoint(.5,1,shape)[2]).toBeGreaterThan(.30);
  });
  it("hangs the center of each swag below the anchors without a solid triangle",()=>{
    const shape={width:3.15,height:3.58,sag:2.56,band:.18};
    expect(swagPoint(.5,.5,shape)[1]).toBeLessThan(swagPoint(0,.5,shape)[1]-2);
    expect(swagPoint(.5,.5,shape)[1]).toBeGreaterThan(.5);
    expect(swagPoint(0,0,shape)[0]).toBeCloseTo(-1.575);
    expect(swagPoint(1,0,shape)[0]).toBeCloseTo(1.575);
  });
  it("closes the round cake-table cloth seam and keeps every surface point finite",()=>{
    for(let j=0;j<=32;j++){
      const v=j/32,a=roundClothPoint(0,v),b=roundClothPoint(1,v);
      a.forEach((n,k)=>expect(n).toBeCloseTo(b[k]));
      for(let i=0;i<=64;i++)for(const p of [roundClothPoint(i/64,v),curtainPoint(i/64,v,{height:3.6,width:.8}),swagPoint(i/64,v,{width:3,height:3.5,sag:2.5})])expect(p.every(Number.isFinite)).toBe(true);
    }
  });
  it("uses deterministic small blossoms, with a hard count budget",()=>{
    const clump={center:[0,1,0] as [number,number,number],radius:[.4,.8,.25] as [number,number,number],count:100,seed:41};
    const before=structuredClone(clump),heads=flowerHeads(clump);
    expect(heads).toEqual(flowerHeads(clump));expect(heads).not.toEqual(flowerHeads({...clump,seed:42}));
    expect(heads).toHaveLength(100);expect(flowerHeads({...clump,count:1e6})).toHaveLength(500);
    expect(flowerHeads({...clump,count:NaN})).toHaveLength(0);
    for(const head of heads){expect(head.radius).toBeLessThan(.075);expect(head.position[1]).toBeGreaterThanOrEqual(.2);expect(head.position[1]).toBeLessThanOrEqual(1.8);}
    expect(clump).toEqual(before);
  });
  it("lets picking rays through the decorative meshes",()=>{
    const geometry=new BoxGeometry(),material=new MeshBasicMaterial(),mesh=new Mesh(geometry,material);
    mesh.updateMatrixWorld(true);const ray=new Raycaster(new Vector3(0,0,3),new Vector3(0,0,-1));
    expect(ray.intersectObject(mesh)).not.toHaveLength(0);
    mesh.raycast=noDecorRaycast;expect(ray.intersectObject(mesh)).toHaveLength(0);
    geometry.dispose();material.dispose();
  });
});
