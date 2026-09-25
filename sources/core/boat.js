const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const BOAT_SPEED={cruise:12,boost:24,reverse:4,boostReverse:8};
export function integrateHelm(state,input,dt,tuning=BOAT_SPEED){
 const speeds=tuning.speeds||tuning;
 const normalAcceleration=tuning.normalAcceleration??8,boostAcceleration=tuning.boostAcceleration??16,brakeAcceleration=tuning.brakeAcceleration??15;
 const forward={x:-Math.sin(state.yaw),z:-Math.cos(state.yaw)};
 let f=state.vx*forward.x+state.vz*forward.z;
 const previousForwardSpeed=f;
 const side={x:-forward.z,z:forward.x};let lateral=state.vx*side.x+state.vz*side.z;
 let throttle=input.throttle||0;
 const accel=throttle<0&&f>.3?brakeAcceleration:input.boost?boostAcceleration:normalAcceleration;
 f+=throttle*accel*dt;
 f*=Math.exp(-(input.brake?8:throttle?0.15:0.9)*dt);
 // Let boost momentum decay instead of instantly clamping the boat to cruise speed.
 const previousSpeed=Math.hypot(state.vx,state.vz);
 const ceiling=input.boost?speeds.boost:Math.max(speeds.cruise,previousSpeed-9*dt);
 const reverseLimit=input.boost?speeds.boostReverse:Math.max(speeds.reverse,previousForwardSpeed<0?Math.abs(previousForwardSpeed)-9*dt:speeds.reverse);
 f=clamp(f,-reverseLimit,ceiling);lateral*=Math.exp(-3.2*dt);
 const turn=(input.steer||0)*(1.65-Math.min(Math.abs(f)/18,1)*.8);
 state.yaw+=turn*dt;
 state.vx=forward.x*f+side.x*lateral;state.vz=forward.z*f+side.z*lateral;
 const speed=Math.hypot(state.vx,state.vz),limit=f<0?reverseLimit:ceiling;
 if(speed>limit){state.vx*=limit/speed;state.vz*=limit/speed;}
 return state;
}
export class BoatController{
 constructor(R,world,spawn){this.R=R;this.world=world;this.body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(spawn.x,.35,spawn.z).setGravityScale(0).enabledTranslations(true,false,true).enabledRotations(false,true,false).setCcdEnabled(true).setLinearDamping(0).setAngularDamping(5));this.collider=world.createCollider(R.ColliderDesc.cuboid(.76,.6,1.82).setCollisionGroups(0x00010001).setFriction(.1).setRestitution(.12).setDensity(1).setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS|R.ActiveEvents.COLLISION_EVENTS).setContactForceEventThreshold(1),this.body);this.teleport(spawn);}
 get position(){return this.body.translation();} get velocity(){return this.body.linvel();}get speed(){const v=this.velocity;return Math.hypot(v.x,v.z);}get forwardSpeed(){const v=this.velocity;return v.x*-Math.sin(this.yaw)+v.z*-Math.cos(this.yaw);}
 step(input,dt){if(this.parked){this.hold();return;}const v=this.velocity;const state=integrateHelm({yaw:this.yaw,vx:v.x,vz:v.z},input,dt);this.yaw=state.yaw;this.body.setRotation({x:0,y:Math.sin(this.yaw/2),z:0,w:Math.cos(this.yaw/2)},true);this.body.setAngvel({x:0,y:0,z:0},true);this.body.setLinvel({x:state.vx,y:0,z:state.vz},true);}
 park(value){this.parked=value;this.hold();this.body.setBodyType(value?this.R.RigidBodyType.KinematicPositionBased:this.R.RigidBodyType.Dynamic,true);this.body.setNextKinematicTranslation(this.position);}
 hold(){this.body.setLinvel({x:0,y:0,z:0},true);this.body.setAngvel({x:0,y:0,z:0},true);}
 snapshot(){return{position:{...this.position},velocity:{...this.velocity},yaw:this.yaw};}
 restore(s){this.teleport({...s.position,yaw:s.yaw});this.body.setLinvel(s.velocity,true);}
 teleport(p){this.yaw=p.yaw||0;this.body.setTranslation({x:p.x,y:.35,z:p.z},true);this.body.setRotation({x:0,y:Math.sin(this.yaw/2),z:0,w:Math.cos(this.yaw/2)},true);this.hold();}
}
