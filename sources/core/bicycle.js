import * as THREE from 'three';
import {QuadBikeController, quadFootprintClear} from './quad-bike.js';

// Campus cycling is a grounded vehicle: no side-slip, spring motion or idle wobble.
export function integrateBicycleDrive(state,input,dt){
 let speed=state.vx*-Math.sin(state.yaw)+state.vz*-Math.cos(state.yaw);
 const throttle=THREE.MathUtils.clamp(input.throttle||0,-1,1);
 const toward=(a,b,d)=>a+THREE.MathUtils.clamp(b-a,-d,d);
 if(input.brake)speed=toward(speed,0,20*dt);
 else if(!throttle)speed=toward(speed,0,10*dt);
 else if(speed*throttle<0)speed=toward(speed,0,14*dt);
 else speed=toward(speed,throttle*(throttle<0?(input.boost?4:2):(input.boost?10:5)),(input.boost?7:4.5)*dt);
 const steer=THREE.MathUtils.clamp(input.steer||0,-1,1);
 const turn=steer*Math.sign(speed)*Math.min(Math.abs(speed)/1.2,1)*1.8/(1+Math.abs(speed)/18);
 const yaw=state.yaw+turn*dt;
 return{yaw,vx:-Math.sin(yaw)*speed,vz:-Math.cos(yaw)*speed};
}
export const BICYCLE=Object.freeze({
 localSpawn:Object.freeze({x:3.2,z:18.3,yaw:0}),modelScale:1,
 collisionHalfWidth:.30,collisionHalfLength:.70,wheelRadius:.274,
 riderAnchor:[0,0,0],integrateDrive:integrateBicycleDrive,
});
export const bicycleFootprintClear=(walk,p,yaw)=>quadFootprintClear(walk,p,yaw,BICYCLE.collisionHalfWidth,BICYCLE.collisionHalfLength);

export class BicycleController extends QuadBikeController{
 constructor(R,world,walk,spawn){
  super(R,world,walk,spawn,BICYCLE);
  this.group.name='Jack campus bicycle';this.visual.name='bicycle-model-frame';this.mountPoint.name='bicycle-rider-seat';
  this.crankAngle=0;this.previousCrankAngle=0;this.previousWheelAngle=0;this.distanceTravelled=0;
 }
 setModel(model,quality='high'){
  const wheelPivots=['front','rear'].map(side=>model.getObjectByName('bicycle-wheel-'+side));
  const steeringNode=model.getObjectByName('bicycle-steering'),crankNode=model.getObjectByName('bicycle-crank');
  const pedals=['left','right'].map(side=>model.getObjectByName('bicycle-pedal-'+side));
  const contacts=['saddle-top','grip-left','grip-right','pedal-contact-left','pedal-contact-right'].map(name=>model.getObjectByName('bicycle-'+name));
  // A failed quality swap must leave the current ride and contact frame intact.
  if([...wheelPivots,steeringNode,crankNode,...pedals,...contacts].some(node=>!node))throw new Error('Bicycle articulation is incomplete.');
  let rig={};model.traverse(o=>{if(o.userData.bicycleRig)rig=o.userData.bicycleRig;});
  if(this.model){
   this.visual.remove(this.model);
   const materials=new Set(),textures=new Set();
   this.model.traverse(o=>{if(o.isMesh){o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}}});
   for(const m of materials)m.dispose();for(const t of textures)t.dispose();
  }
  this.model=model;this.quality=quality;this.visual.add(model);
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  Object.assign(this,{rig,wheelPivots,steeringNode,crankNode,pedals});
  this.updateVisual(0,true);
 }
 step(input,dt){
  this.previousWheelAngle=this.wheelAngle||0;this.previousCrankAngle=this.crankAngle||0;
  super.step(input,dt);
 }
 afterStep(){
  if(this.parked)return;
  const prior=this.wheelAngle||0;
  super.afterStep();
  const travelled=((this.wheelAngle||0)-prior)*BICYCLE.wheelRadius;
  // Cadence follows actual contact motion; a blocked bike cannot pedal in place.
  this.distanceTravelled+=Math.abs(travelled);
  this.crankAngle+=(travelled/4.5)*Math.PI*2;
 }
 hold(){
  super.hold();
  this.previousWheelAngle=this.wheelAngle||0;this.previousCrankAngle=this.crankAngle||0;
 }
 updateVisual(dt,frozen=false,alpha=1){
  // Reuse the tested grounded chassis and parking interpolation, then articulate
  // this model in its own frame rather than applying the quad wheel convention.
  const wheels=this.wheelPivots;this.wheelPivots=[];
  super.updateVisual(dt,frozen,alpha);this.wheelPivots=wheels;
  if(!this.model)return;
  const t=frozen||this.parked?1:THREE.MathUtils.clamp(alpha,0,1);
  const angle=THREE.MathUtils.lerp(this.previousWheelAngle||0,this.wheelAngle||0,t);
  const crank=THREE.MathUtils.lerp(this.previousCrankAngle||0,this.crankAngle||0,t);
  // Source geometry already faces -Z, and rolling forward is -X rotation.
  for(const wheel of this.wheelPivots)wheel.rotation.x=-angle*BICYCLE.wheelRadius/(this.rig.wheelRadius||BICYCLE.wheelRadius);
  this.steeringNode.rotation.y=(this.steering||0)*.26;
  this.crankNode.rotation.x=-crank;
  for(const pedal of this.pedals)pedal.rotation.x=crank;
  this.visualCrankAngle=crank;this.group.updateWorldMatrix(true,true);
 }
 contactTargets(){
  this.group.updateWorldMatrix(true,true);
  const point=name=>{
   const node=this.model?.getObjectByName(name);if(!node)throw new Error('Missing bicycle contact: '+name);
   return this.group.worldToLocal(node.getWorldPosition(new THREE.Vector3())).toArray();
  };
  const saddle=point('bicycle-saddle-top');
  return{gripYaw:this.steeringNode.rotation.y,pelvis:[saddle[0],saddle[1]+(this.rig.pelvisOffset??.08),saddle[2]],grips:{Left:point('bicycle-grip-left'),Right:point('bicycle-grip-right')},feet:{Left:point('bicycle-pedal-contact-left'),Right:point('bicycle-pedal-contact-right')}};
 }
 status(){return{position:{...this.position},heading:this.yaw,parked:this.parked,quality:this.quality,wheelAngle:this.wheelAngle||0,crankAngle:this.crankAngle||0,wheels:this.wheelPivots?.length||0,spawn:{...this.spawn},distance:this.distanceTravelled||0};}
}
