import * as THREE from 'three';
import {box,cylinder,mesh,ring,label,material} from './geometry.js';
import {cargoStarts,cargoBerths,cargoBay} from '../config.js';

export class PropManager {
 constructor(scene,R,world,{settings,feedback,onSecret=()=>{}}){
  Object.assign(this,{scene,R,world,settings,feedback,onSecret});this.items=[];this.byCollider=new Map();
  const buoys=[[-10,62],[12,53],[-17,40],[23,25],[-50,34],[-54,-51],[48,-58],[37,-88]];
  const crates=[[-76,16],[-67,-37],[42,57],[63,-52],[16,82]];
  const balls=[[1,78],[16,38],[-41,55],[45,23],[-43,-91],[83,-44]];
  buoys.forEach(([x,z],i)=>this.add('buoy',`buoy-${i}`,x,z));
  crates.forEach(([x,z],i)=>this.add('crate',`crate-${i}`,x,z));
  cargoStarts.forEach(({id,x,z})=>this.add('crate',id,x,z,true));
  balls.forEach(([x,z],i)=>this.add('ball',`ball-${i}`,x,z));
  this.add('duck','duck-0',-11,66);this.add('duck','duck-1',86,58);
 }
 add(kind,id,x,z,cargo=false){
  const root=new THREE.Group(),R=this.R,berth=cargoBerths.find(b=>b.id===id),color=berth?.color||'#d39b67';
  if(kind==='buoy'){
   cylinder(root,.65,.65,'orange',[0,.1,0]);ring(root,.67,.13,'ivory',[0,.17,0]);cylinder(root,.07,1.8,'navy',[0,1.1,0]);mesh(root,new THREE.SphereGeometry(.19,8,6),'yellow',[0,2.05,0]);box(root,[.8,.4,.05],'ivory',[.35,1.65,0]);
  }else if(kind==='crate'){
   box(root,[2.1,1.3,2.1],color,[0,.35,0]);
   for(const y of [-.18,.82])for(const z of [-1.075,1.075])box(root,[2.16,.12,.08],'wood',[0,y,z]);
   for(const x of [-.73,.73])box(root,[.12,1.35,2.15],'woodLight',[x,.35,0]);
   const stamp=label(berth?.symbol||'↑',{width:96,height:96,worldWidth:.9,background:'#fff5dd',color:'#254f62',fontSize:62});stamp.position.set(0,1.07,0);root.add(stamp);
  }else if(kind==='ball'){
   mesh(root,new THREE.SphereGeometry(.9,16,10),['orange','teal','yellow','pink'][Number(id.at(-1))%4],[0,.2,0]);ring(root,.885,.09,'ivory',[0,.2,0]);
  }else{
   const yellow=material('yellow');mesh(root,new THREE.SphereGeometry(.78,14,10),yellow,[0,.15,0]).scale.set(1,.75,1.25);
   mesh(root,new THREE.SphereGeometry(.5,12,8),yellow,[0,.8,-.5]);box(root,[.55,.15,.5],'orange',[0,.73,-.96]);
   for(const x of [-.29,.29])mesh(root,new THREE.SphereGeometry(.065,6,6),'navy',[x,.94,-.85]);
  }
  root.position.set(x,.35,z);this.scene.add(root);
  const body=this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x,.35,z).setGravityScale(0).enabledTranslations(true,false,true).enabledRotations(false,true,false).setCcdEnabled(true).setLinearDamping(kind==='crate'?1.15:.7).setAngularDamping(2));
  const shape=kind==='crate'?R.ColliderDesc.cuboid(1.115,.8,1.115):R.ColliderDesc.ball(kind==='buoy'?.65:.85);
  const collider=this.world.createCollider(shape.setMass(kind==='crate'?2.1:.4).setFriction(.14).setRestitution(kind==='crate'?.08:.35).setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(.1),body);
  const item={id,kind,cargo,root,body,collider,home:{x,z},previous:new THREE.Vector3(x,.35,z),delivered:false};this.items.push(item);this.byCollider.set(collider.handle,item);body.sleep();return item;
 }
 beforeStep(boat){
  for(const item of this.items){const p=item.body.translation();item.previous.set(p.x,p.y,p.z);if(item.delivered)continue;
   if(item.kind==='buoy'){
    const dx=p.x-item.home.x,dz=p.z-item.home.z,v=item.body.linvel();item.body.resetForces(false);
    if(Math.hypot(dx,dz)>.16||Math.hypot(v.x,v.z)>.1)item.body.addForce({x:-dx*.5-v.x*.3,y:0,z:-dz*.5-v.z*.3},true);
   }
   if(!item.cargo&&Math.hypot(p.x,p.z)>167&&Math.hypot(p.x-boat.x,p.z-boat.z)>12)this.resetItem(item);
  }
 }
 afterStep(queue,boatCollider,boatPosition){
  queue.drainContactForceEvents(e=>{
   const a=e.collider1(),b=e.collider2();if(a!==boatCollider.handle&&b!==boatCollider.handle)return;
   const other=this.byCollider.get(a===boatCollider.handle?b:a),force=e.totalForceMagnitude();if(force<1)return;
   const p=other?.body.translation()||boatPosition;
   this.feedback.splash(p,{strength:Math.min(1.8,.4+force/100),kind:other?.kind==='crate'?'wood':other?.kind==='duck'?'duck':'water',key:`${a}:${b}`});
   if(other?.kind==='duck')this.onSecret('duck');
  });
 }
 update(alpha,time,reduced){for(const item of this.items){const p=item.body.translation();item.root.position.lerpVectors(item.previous,new THREE.Vector3(p.x,p.y,p.z),alpha);item.root.position.y+=reduced?0:Math.sin(time*2+item.home.x)*.06;item.root.quaternion.copy(item.body.rotation());}}
 cargoData(){return this.items.filter(i=>i.cargo).map(i=>{const p=i.body.translation(),q=i.body.rotation(),v=i.body.linvel();return{id:i.id,x:p.x,z:p.z,yaw:2*Math.atan2(q.y,q.w),speed:Math.hypot(v.x,v.z),halfSize:1.115,angularSpeed:Math.abs(i.body.angvel().y)};});}
 deliver(id){const item=this.items.find(i=>i.id===id);if(!item)return;item.delivered=true;item.body.setLinvel({x:0,y:0,z:0},true);item.body.setAngvel({x:0,y:0,z:0},true);item.collider.setEnabled(false);item.body.sleep();}
 resetItem(item,point=item.home){item.delivered=false;item.collider.setEnabled(true);item.body.setTranslation({x:point.x,y:.35,z:point.z},true);item.body.setRotation({x:0,y:0,z:0,w:1},true);item.body.setLinvel({x:0,y:0,z:0},true);item.body.setAngvel({x:0,y:0,z:0},true);item.body.resetForces(false);item.previous.set(point.x,.35,point.z);item.root.position.copy(item.previous);item.body.sleep();}
 resetCargo(){for(const item of this.items)if(item.cargo)this.resetItem(item);}
 resetNear(point){for(const item of this.items){const p=item.body.translation();if(Math.hypot(p.x-point.x,p.z-point.z)<5)this.resetItem(item);}}
 outOfBounds(){return this.items.find(i=>i.cargo&&!i.delivered&&(Math.abs(i.body.translation().x-cargoBay.x)>cargoBay.width/2+3||Math.abs(i.body.translation().z-cargoBay.z)>cargoBay.depth/2+3));}
 recoverCargo(item,boat){
  this.world.propagateModifiedBodyPositionsToColliders();this.world.updateSceneQueries();
  const candidates=[item.home];for(const z of [-34,-42,-49])for(const x of [-45,-37,-29,-21,-15])candidates.push({x,z});
  const free=candidates.find(p=>Math.hypot(p.x-boat.x,p.z-boat.z)>4.5&&!this.world.intersectionWithShape({x:p.x,y:.35,z:p.z},{x:0,y:0,z:0,w:1},new this.R.Cuboid(1.4,.85,1.4),undefined,0x00010001,item.collider,item.body));
  if(free)this.resetItem(item,free);return !!free;
 }
 snapshot(){return this.items.map(i=>({id:i.id,position:{...i.body.translation()},rotation:{...i.body.rotation()},velocity:{...i.body.linvel()},angularVelocity:{...i.body.angvel()},sleeping:i.body.isSleeping(),delivered:i.delivered}));}
 restore(snapshot){for(const s of snapshot||[]){const i=this.items.find(i=>i.id===s.id);if(!i)continue;i.body.setTranslation(s.position,true);i.body.setRotation(s.rotation,true);i.body.setLinvel(s.velocity,true);i.body.setAngvel(s.angularVelocity,true);i.delivered=s.delivered;i.collider.setEnabled(!s.delivered);i.previous.set(s.position.x,s.position.y,s.position.z);if(s.sleeping)i.body.sleep();}}
}
