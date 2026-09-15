const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function integrateHelm(state,input,dt){
 const forward={x:-Math.sin(state.yaw),z:-Math.cos(state.yaw)};
 let f=state.vx*forward.x+state.vz*forward.z;
 const side={x:-forward.z,z:forward.x};let lateral=state.vx*side.x+state.vz*side.z;
 let throttle=input.throttle||0;const max=input.boost?18:12;
 const accel=throttle<0&&f>.3?15:8;
 f+=throttle*accel*dt;
 f*=Math.exp(-(input.brake?8:throttle?0.15:0.9)*dt);
 f=clamp(f,-4,max);lateral*=Math.exp(-3.2*dt);
 const turn=(input.steer||0)*(1.65-Math.min(Math.abs(f)/18,1)*.8);
 state.yaw+=turn*dt;
 state.vx=forward.x*f+side.x*lateral;state.vz=forward.z*f+side.z*lateral;
 return state;
}
export class BoatController{
 constructor(R,world,spawn){this.R=R;this.world=world;this.body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(spawn.x,.35,spawn.z).setGravityScale(0).enabledTranslations(true,false,true).enabledRotations(false,true,false).setCcdEnabled(true).setLinearDamping(0).setAngularDamping(5));this.collider=world.createCollider(R.ColliderDesc.cuboid(.76,.6,1.82).setFriction(.1).setRestitution(.12).setDensity(1),this.body);this.teleport(spawn);}
 get position(){return this.body.translation();} get velocity(){return this.body.linvel();}get speed(){const v=this.velocity;return Math.hypot(v.x,v.z);}get forwardSpeed(){const v=this.velocity;return v.x*-Math.sin(this.yaw)+v.z*-Math.cos(this.yaw);}
 step(input,dt){const v=this.velocity;const state=integrateHelm({yaw:this.yaw,vx:v.x,vz:v.z},input,dt);this.yaw=state.yaw;this.body.setRotation({x:0,y:Math.sin(this.yaw/2),z:0,w:Math.cos(this.yaw/2)},true);this.body.setAngvel({x:0,y:0,z:0},true);this.body.setLinvel({x:state.vx,y:0,z:state.vz},true);}
 hold(){this.body.setLinvel({x:0,y:0,z:0},true);this.body.setAngvel({x:0,y:0,z:0},true);}
 snapshot(){return{position:{...this.position},velocity:{...this.velocity},yaw:this.yaw};}
 restore(s){this.teleport({...s.position,yaw:s.yaw});this.body.setLinvel(s.velocity,true);}
 teleport(p){this.yaw=p.yaw||0;this.body.setTranslation({x:p.x,y:.35,z:p.z},true);this.body.setRotation({x:0,y:Math.sin(this.yaw/2),z:0,w:Math.cos(this.yaw/2)},true);this.hold();}
}
