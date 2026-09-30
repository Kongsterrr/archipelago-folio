import * as THREE from 'three';
import {QuadBikeController,quadFootprintClear,overlaps} from './quad-bike.js';
import {dockLocal,pointInPolygon} from './dock.js';
import {bicycleTireEnvelope} from './bicycle-surface.js';
import {localToWorld} from './character.js';

export const GARAGE_CARS=Object.freeze([
 {id:'911',label:'Porsche 911',bay:0,width:2.061,height:1.264,wheelRadius:.355,seatBack:.13,seatDrop:.025,torsoLean:.16,headPitch:0},
 {id:'g63',label:'Mercedes G63',bay:1,width:2.199,height:2.107,wheelRadius:.427,seatDrop:.035,seatBack:.08,torsoLean:.165,headPitch:-.02},
 {id:'ferrari',label:'Ferrari Purosangue',bay:2,width:2.320,height:1.599,length:4.7,wheelRadius:.38,assetVersion:'15.2'},
 {id:'raptor',label:'Ford Raptor',bay:3,width:2.430,height:2.180,length:5.2,wheelRadius:.46,assetVersion:'15.2'},
]);

// A grounded signed speed with strong tire grip; no boat-like sideways drift.
export function integrateCarDrive(state,input,dt){
 let speed=state.vx*-Math.sin(state.yaw)+state.vz*-Math.cos(state.yaw);
 const throttle=THREE.MathUtils.clamp(input.throttle||0,-1,1);
 const toward=(a,b,d)=>a+THREE.MathUtils.clamp(b-a,-d,d);
 if(input.brake||!throttle)speed=toward(speed,0,26*dt);
 else if(speed*throttle<0)speed=toward(speed,0,24*dt);
 else speed=toward(speed,throttle*(throttle<0?(input.boost?6:3):(input.boost?16:8)),(input.boost?14:9)*dt);
 const steer=THREE.MathUtils.clamp(input.steer||0,-1,1);
 const yaw=state.yaw+speed/2.7*Math.tan(steer*.72)/(1+Math.abs(speed)/40)*dt;
 return {yaw,vx:-Math.sin(yaw)*speed,vz:-Math.cos(yaw)*speed};
}
export function carSpec(config){return {modelScale:1,planarDrive:true,collisionHalfWidth:config.width/2,collisionHalfLength:(config.length??4.7)/2,collisionHalfHeight:config.height*.46,collisionY:config.height*.5,wheelRadius:config.wheelRadius,riderAnchor:[0,0,0],integrateDrive:integrateCarDrive};}
export function garageCarAssetURL(id,quality='high'){const config=GARAGE_CARS.find(car=>car.id===id);return `/models/${quality==='low'?'low/':''}car-${id}.glb?v=${config?.assetVersion??'15.1.1'}`;}
export function garageSpawn(walk,bay){const slot=walk.layout.garageBays[bay];const p=localToWorld(walk.island,{x:slot.x,z:slot.z,yaw:Math.PI});p.y=walk.groundAt(p);return p;}
const dispose=model=>{const materials=new Set(),textures=new Set();model?.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}}});for(const m of materials)m.dispose();for(const t of textures)t.dispose();};

export class GarageCarController extends QuadBikeController{
 constructor(R,world,walk,spawn,config){
  super(R,world,walk,spawn,carSpec(config));
  Object.assign(this,{id:config.id,label:config.label,config});this.group.name=config.label;this.mountPoint.name=config.id+'-driver';
  (walk.vehicles??=new Set()).add(this);this.previousWheelAngle=0;this.previousSteering=0;
 }
 allowsPose(point,yaw){
  // Cars stay on the island, outside the pedestrian house and off the pier.
  const local=dockLocal(point,this.walkWorld.island),angle=yaw-this.walkWorld.island.rotation;
  const box={...local,yaw:angle,w:this.spec.collisionHalfWidth+.04,l:this.spec.collisionHalfLength+.04};
  const house=this.walkWorld.layout.interiors?.find(i=>i.landmarkId==='jack-house')?.bounds;
  if(house&&overlaps(box,{...house,yaw:0,w:house.width/2,l:house.depth/2}))return false;
  const c=Math.cos(angle),s=Math.sin(angle),shore=this.walkWorld.layout.shore||this.walkWorld.island.shore;
  for(const x of[-box.w,0,box.w])for(const z of[-box.l,0,box.l])if(!pointInPolygon({x:local.x+x*c+z*s,z:local.z-x*s+z*c},shore))return false;
  return true;
 }
 clearPose(point,yaw=point.yaw??this.yaw){return quadFootprintClear(this.walkWorld,point,yaw,this.spec.collisionHalfWidth,this.spec.collisionHalfLength,this);}
 safeReset(){
  const bays=this.walkWorld.layout.garageBays||[];
  for(const index of[this.config.bay,...bays.map((_,i)=>i).filter(i=>i!==this.config.bay)]){
   const p=garageSpawn(this.walkWorld,index);if(this.clearPose(p,p.yaw))return p;
  }
  return this.clearPose(this.position,this.yaw)?{...this.position,yaw:this.yaw}:null;
 }
 setModel(model,quality='high'){
  const wheels=['front-left','front-right','rear-left','rear-right'].map(name=>model.getObjectByName('car-wheel-'+name));
  if(wheels.some(w=>!w))throw Error('Incomplete car wheel rig.');
  let rig=null;model.traverse(o=>{if(o.userData.carRig)rig=o.userData.carRig;});
  if(!rig?.pelvis||!rig.grips?.Left||!rig.feet?.Right)throw Error('Missing driver contact anchors.');
  const old=this.model;
  // Move the seated pelvis back inside each cabin, retaining the actual wheel
  // and foot contacts. The SUV drop keeps Jack below its complete roof.
  this.visual.add(model);this.model=model;this.rig={...rig,torsoLean:this.config.torsoLean??rig.torsoLean,headPitch:this.config.headPitch??rig.headPitch,pelvis:rig.pelvis.map((v,n)=>v+(n===2?(this.config.seatBack||0):0)-(n===1?(this.config.seatDrop||0):0))};this.quality=quality;this.wheelPivots=wheels;
  this.roof=[];const calibrated=new Set();
  model.traverse(o=>{
   if(o.name==='car-roof-cutaway'||o.name==='car-roof')this.roof.push(o);
   if(!o.isMesh)return;
   o.castShadow=true;o.receiveShadow=true;
   for(const material of Array.isArray(o.material)?o.material:[o.material])if(!calibrated.has(material)){
    calibrated.add(material);material.userData.garageOriginalMetalness??=material.metalness;
    material.metalness=material.userData.garageOriginalMetalness*.3;material.envMapIntensity=.9;
   }
  });
  // The atlas paints the source roof silver. Tint that panel to graphite while
  // retaining the body's mapped roughness, metal response and environment strength.
  // Dark paint plus a separate matte override made the previous roof look flat black.
  const roofMaterials=new Map();
  for(const roof of this.id==='g63'?this.roof:[])roof.traverse(o=>{
   if(!o.isMesh)return;
   const finish=source=>{
    if(!roofMaterials.has(source)){
     const material=source.clone();material.name='g63-graphite-roof';
     material.color.set('#71777b');
     roofMaterials.set(source,material);
    }
    return roofMaterials.get(source);
   };
   o.material=Array.isArray(o.material)?o.material.map(finish):finish(o.material);
  });
  this.steeringNodes=['left','right'].map(side=>model.getObjectByName('car-steer-front-'+side));
  for(const node of this.steeringNodes)if(node)node.userData.restRotation=node.quaternion.clone();
  this.wheelRadii=wheels.map(w=>rig.wheelRadii?.[w.name]||rig.wheelRadius||this.spec.wheelRadius);
  this.tireEnvelopes=wheels.map((w,n)=>bicycleTireEnvelope(w,this.wheelRadii[n]));
  this.tireCenters=wheels.map(w=>{model.updateWorldMatrix(true,true);return this.group.worldToLocal(w.getWorldPosition(new THREE.Vector3()));});
  if(old){this.visual.remove(old);dispose(old);}this.updateVisual(0,true);
 }
 // Occupancy changes the driver state only; every supplied roof stays intact.
 setOccupied(value){this.occupied=value;for(const roof of this.roof||[])roof.visible=true;}
 contactTargets(){return this.rig;}
 accessPoints(){
  const p=this.position,c=Math.cos(this.yaw),s=Math.sin(this.yaw),seatZ=this.rig?.pelvis?.[2]??0;
  return [-1,1].map(sign=>{const x=sign*(this.spec.collisionHalfWidth+.38),z=seatZ;return{x:p.x+x*c+z*s,y:p.y,z:p.z-x*s+z*c};});
 }
 mountDistance(point){return Math.min(...this.accessPoints().map(p=>Math.hypot(point.x-p.x,point.z-p.z)));}
 dismountPoint(){
  for(const offset of[0,.35,.7,1.15])for(const access of this.accessPoints())for(const along of[0,.55,-.55]){
   const center=this.position,dx=access.x-center.x,dz=access.z-center.z,len=Math.hypot(dx,dz);
   const p={x:access.x+dx/len*offset-Math.sin(this.yaw)*along,z:access.z+dz/len*offset-Math.cos(this.yaw)*along};p.y=this.walkWorld.groundAt(p);
   if(this.walkWorld.clear(p,.24)&&Math.abs(p.y-center.y)<.25&&this.walkWorld.visible({...center,y:p.y},p))return{...p,yaw:this.yaw};
  }
  return null;
 }
 step(input,dt){this.previousWheelAngle=this.wheelAngle||0;this.previousSteering=this.steering||0;super.step(input,dt);}
 hold(){super.hold();this.previousWheelAngle=this.wheelAngle||0;this.previousSteering=this.steering||0;}
 updateVisual(dt,frozen=false,alpha=1){
  const wheels=this.wheelPivots;this.wheelPivots=[];super.updateVisual(dt,frozen,alpha);this.wheelPivots=wheels;
  if(!this.model)return;
  const t=frozen||this.parked?1:THREE.MathUtils.clamp(alpha,0,1),angle=THREE.MathUtils.lerp(this.previousWheelAngle||0,this.wheelAngle||0,t);
  // The source 911 has smaller front tires. Each rolls through the same
  // travelled distance using its own fitted rolling radius.
  for(let n=0;n<wheels.length;n++)wheels[n].rotation.x=-angle*this.spec.wheelRadius/this.wheelRadii[n];
  const steer=THREE.MathUtils.lerp(this.previousSteering||0,this.steering||0,t);
  for(const n of this.steeringNodes||[])if(n)n.quaternion.copy(n.userData.restRotation).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),steer*.60));
  // Finish surfaces share the exported navigation heights. Support all four
  // tires together, without per-frame spring motion or independent wheel drift.
  if(this.tireCenters?.length){
   const c=Math.cos(this.group.rotation.y),s=Math.sin(this.group.rotation.y);let lift=0;
   for(let n=0;n<this.tireCenters.length;n++){const p=this.tireCenters[n],q={x:this.group.position.x+p.x*c+p.z*s,z:this.group.position.z-p.x*s+p.z*c};lift=Math.max(lift,this.walkWorld.groundAt(q)-this.group.position.y+this.tireEnvelopes[n].radius-p.y);}
   this.group.position.y+=lift+.003;
  }
  this.setOccupied(this.occupied);this.group.updateWorldMatrix(true,true);
 }
 status(){return{id:this.id,label:this.label,position:{...this.position},heading:this.yaw,parked:this.parked,quality:this.quality,wheelAngle:this.wheelAngle||0,wheels:this.wheelPivots.length,spawn:{...this.spawn},occupied:!!this.occupied};}
 dispose(){this.walkWorld.vehicles?.delete(this);super.dispose();}
}
