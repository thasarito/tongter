import { footprint, pointInside } from "../model/geometry";
export type WalkDirection="forward"|"back"|"left"|"right";
const axes:Record<WalkDirection,[number,number]>={forward:[0,1],back:[0,-1],left:[-1,0],right:[1,0]};
const floor=footprint(64);
const LOOK_YAW_SPEED=1.65,LOOK_PITCH_SPEED=1.15;
/** Renderer-independent time-based movement. Input wakes an on-demand renderer;
 * completed movement does not keep consuming GPU/battery while a panel is open. */
export class WalkMotion {
  x=-11.2;z=-1.65;yaw=Math.PI/2;pitch=.035;targetYaw=Math.PI/2;targetPitch=.035;
  vx=0;vz=0;speed=1.6;fast=false;enabled=true;
  readonly held=new Map<string,[number,number]>();
  readonly lookHeld=new Map<string,[number,number]>();
  private readonly listeners=new Set<()=>void>();
  constructor(private readonly canMove=(x:number,z:number)=>[[0,0],[.16,0],[-.16,0],[0,.16],[0,-.16]].every(([dx,dz])=>pointInside(x+dx,z+dz,floor))){}
  subscribe(listener:()=>void){this.listeners.add(listener);return()=>{this.listeners.delete(listener);};}
  private wake(){for(const listener of this.listeners)listener();}
  press(key:string,direction:WalkDirection){if(this.enabled){this.held.set(key,axes[direction]);this.wake();}}
  setAnalog(key:string,right:number,forward:number){
    if(!this.enabled||!Number.isFinite(right)||!Number.isFinite(forward)||Math.hypot(right,forward)<.001){this.release(key);return;}
    const scale=Math.max(1,Math.hypot(right,forward));this.held.set(key,[right/scale,forward/scale]);this.wake();
  }
  release(key:string,immediate=false){
    const removed=this.held.delete(key),stopVelocity=immediate&&!this.held.size&&(this.vx!==0||this.vz!==0);
    if(stopVelocity)this.vx=this.vz=0;
    if(removed||stopVelocity)this.wake();
  }
  /** Look is a held angular velocity, not a pointer delta. A second pointer must
   * never overwrite or release the movement stick's input. */
  setLookAnalog(key:string,right:number,up:number){
    const length=Math.hypot(right,up);
    if(!this.enabled||!Number.isFinite(length)||length<.001){this.releaseLook(key);return;}
    const scale=Math.max(1,length);this.lookHeld.set(key,[right/scale,up/scale]);this.wake();
  }
  releaseLook(key:string){
    if(!this.lookHeld.delete(key))return;
    if(!this.lookHeld.size){this.targetYaw=this.yaw;this.targetPitch=this.pitch;}
    this.wake();
  }
  look(dx:number,dy:number){if(!this.enabled||!Number.isFinite(dx)||!Number.isFinite(dy)||(!dx&&!dy))return;this.targetYaw-=dx*.0028;this.targetPitch=Math.max(-1.05,Math.min(1.15,this.targetPitch-dy*.0025));this.wake();}
  stop(){const active=this.moving;this.held.clear();this.lookHeld.clear();this.vx=this.vz=0;this.fast=false;this.targetYaw=this.yaw;this.targetPitch=this.pitch;if(active)this.wake();}
  reset(){this.stop();this.x=-11.2;this.z=-1.65;this.yaw=this.targetYaw=Math.PI/2;this.pitch=this.targetPitch=.035;this.wake();}
  get moving(){return this.held.size>0||this.lookHeld.size>0||Math.abs(this.vx)+Math.abs(this.vz)>.001||Math.abs(this.targetYaw-this.yaw)+Math.abs(this.targetPitch-this.pitch)>.00001;}
  update(delta:number):boolean {
    if(!this.enabled||!Number.isFinite(delta)||delta<=0)return false;
    const before=[this.x,this.z,this.yaw,this.pitch],total=Math.min(delta,.05),steps=Math.ceil(total*120),dt=total/steps;
    let right=0,forward=0;for(const [r,f]of this.held.values()){right+=r;forward+=f;}
    const norm=Math.hypot(right,forward);if(norm>1){right/=norm;forward/=norm;}
    let turn=0,up=0;for(const [r,u]of this.lookHeld.values()){turn+=r;up+=u;}
    const lookNorm=Math.max(1,Math.hypot(turn,up));turn/=lookNorm;up/=lookNorm;
    for(let i=0;i<steps;i++){
      this.targetYaw-=turn*LOOK_YAW_SPEED*dt;
      this.targetPitch=Math.max(-1.05,Math.min(1.15,this.targetPitch+up*LOOK_PITCH_SPEED*dt));
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
