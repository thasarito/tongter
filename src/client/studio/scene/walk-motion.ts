import { footprint, pointInside } from "../model/geometry";
export type WalkDirection="forward"|"back"|"left"|"right";
const axes:Record<WalkDirection,[number,number]>={forward:[0,1],back:[0,-1],left:[-1,0],right:[1,0]};
const floor=footprint(64);
/** Renderer-independent time-based movement. No camera bob or key-repeat jumps. */
export class WalkMotion {
  x=-11.2;z=-1.65;yaw=Math.PI/2;pitch=.035;targetYaw=Math.PI/2;targetPitch=.035;
  vx=0;vz=0;speed=1.6;fast=false;enabled=true;
  readonly held=new Map<string,[number,number]>();
  constructor(private readonly canMove=(x:number,z:number)=>[[0,0],[.16,0],[-.16,0],[0,.16],[0,-.16]].every(([dx,dz])=>pointInside(x+dx,z+dz,floor))){}
  press(key:string,direction:WalkDirection){if(this.enabled)this.held.set(key,axes[direction]);}
  setAnalog(key:string,right:number,forward:number){
    if(!this.enabled||!Number.isFinite(right)||!Number.isFinite(forward)||Math.hypot(right,forward)<.001){this.release(key);return;}
    const scale=Math.max(1,Math.hypot(right,forward));this.held.set(key,[right/scale,forward/scale]);
  }
  release(key:string){this.held.delete(key);}
  look(dx:number,dy:number){if(!this.enabled)return;this.targetYaw-=dx*.0028;this.targetPitch=Math.max(-1.05,Math.min(1.15,this.targetPitch-dy*.0025));}
  stop(){this.held.clear();this.vx=this.vz=0;this.fast=false;this.targetYaw=this.yaw;this.targetPitch=this.pitch;}
  reset(){this.stop();this.x=-11.2;this.z=-1.65;this.yaw=this.targetYaw=Math.PI/2;this.pitch=this.targetPitch=.035;}
  get moving(){return this.held.size>0||Math.abs(this.vx)+Math.abs(this.vz)>.001||Math.abs(this.targetYaw-this.yaw)+Math.abs(this.targetPitch-this.pitch)>.00001;}
  update(delta:number):boolean {
    if(!this.enabled||!Number.isFinite(delta)||delta<=0)return false;
    const before=[this.x,this.z,this.yaw,this.pitch],total=Math.min(delta,.05),steps=Math.ceil(total*120),dt=total/steps;
    let right=0,forward=0;for(const [r,f]of this.held.values()){right+=r;forward+=f;}
    const norm=Math.hypot(right,forward);if(norm>1){right/=norm;forward/=norm;}
    for(let i=0;i<steps;i++){
      const look=1-Math.exp(-22*dt);this.yaw+=(this.targetYaw-this.yaw)*look;this.pitch+=(this.targetPitch-this.pitch)*look;
      if(Math.abs(this.targetYaw-this.yaw)<.00001)this.yaw=this.targetYaw;if(Math.abs(this.targetPitch-this.pitch)<.00001)this.pitch=this.targetPitch;
      const speed=this.speed*(this.fast?1.65:1),sin=Math.sin(this.yaw),cos=Math.cos(this.yaw),tx=(sin*forward-cos*right)*speed,tz=(cos*forward+sin*right)*speed;
      const lambda=norm?12:18,decay=Math.exp(-lambda*dt),dx=tx*dt+(this.vx-tx)*(1-decay)/lambda,dz=tz*dt+(this.vz-tz)*(1-decay)/lambda;
      this.vx=tx+(this.vx-tx)*decay;this.vz=tz+(this.vz-tz)*decay;
      if(this.canMove(this.x+dx,this.z+dz)){this.x+=dx;this.z+=dz;}else{
        if(this.canMove(this.x+dx,this.z))this.x+=dx;else this.vx=0;
        if(this.canMove(this.x,this.z+dz))this.z+=dz;else this.vz=0;
      }
      if(!norm&&Math.abs(this.vx)<.001)this.vx=0;if(!norm&&Math.abs(this.vz)<.001)this.vz=0;
    }
    return before.some((n,i)=>n!==[this.x,this.z,this.yaw,this.pitch][i]);
  }
}
