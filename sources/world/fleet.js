import * as THREE from 'three';
import {FLEET_ROUTES,routePoint,routeYaw,hullWaterClear,sweptHullWaterClear} from './water-space.js';
import {WakePool} from './wake-pool.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export class AmbientFleet{
 constructor(scene,R,world,settings,loader,onSound=()=>{}){Object.assign(this,{scene,R,world,settings,loader,onSound});this.items=[];this.time=0;this.lastHorn=-10;this.lastEngine=0;this.ready=false;this.wakes=new WakePool(scene,settings);}
 async load(){
  const models=new Map();await Promise.all(['cruise','yacht-one','yacht-two'].map(async kind=>{try{const [high,low]=await Promise.all([this.loader.loadAsync(`/models/fleet/v10/${kind}.glb`),this.loader.loadAsync(`/models/fleet/v10/low/${kind}.glb`)]);models.set(kind,{high:high.scene,low:low.scene});}catch(e){console.warn('Fleet asset unavailable',kind,e.message);}}));
  for(const route of FLEET_ROUTES){const assets=models.get(route.model);if(!assets)continue;const p=routePoint(route,route.phase),yaw=routeYaw(route,route.phase);
   const body=this.world.createRigidBody(this.R.RigidBodyDesc.dynamic().setTranslation(p.x,0,p.z).setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}).setGravityScale(0).enabledTranslations(true,false,true).enabledRotations(false,true,false).setCcdEnabled(true).setLinearDamping(.4).setAngularDamping(3));
   const collider=this.world.createCollider(this.R.ColliderDesc.cuboid(route.width*.43,1,route.length*.43).setCollisionGroups(0x00010001).setMass(route.kind==='cruise'?32:24).setFriction(.04).setRestitution(.04).setActiveEvents(this.R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(1),body);
   const group=new THREE.Group(),high=assets.high.clone(true),low=assets.low.clone(true);group.add(high,low);this.scene.add(group);group.position.set(p.x,0,p.z);group.rotation.y=yaw;high.visible=false;
   for(const model of [high,low]){model.scale.setScalar(route.modelScale);model.rotation.y=route.modelYaw;model.position.y=route.modelOffsetY;model.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});}
   const lamp=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),new THREE.MeshBasicMaterial({color:'#ffe4a4'}));lamp.position.set(0,route.lightY,0);lamp.visible=false;group.add(lamp);
   this.items.push({route,body,collider,group,high,low,lamp,phase:route.phase,previous:new THREE.Vector3(p.x,0,p.z),prevYaw:yaw,yaw,replyUntil:0,replyAt:0,replyPending:false,lastReply:-20,holdUntil:0,mooredUntil:0,lastMoor:-100,state:'cruising',lodHigh:false});
  }const yacht=FLEET_ROUTES.find(r=>r.id==='yacht-solstice'),berth=routePoint(yacht,0);for(const side of [-1,1]){const buoy=new THREE.Mesh(new THREE.CylinderGeometry(.22,.33,.48,10),new THREE.MeshStandardMaterial({color:'#f3e4c4',roughness:.7}));buoy.position.set(berth.x+side*3.2,.06,berth.z);this.scene.add(buoy);}this.ready=true;
 }
 beforeStep(dt,player){this.time+=dt;if(this.time-this.lastEngine>1.2){this.lastEngine=this.time;const audible=this.items.filter(i=>gap(i.body.translation(),player.position)<28&&Math.hypot(i.body.linvel().x,i.body.linvel().z)>.4).sort((a,b)=>gap(a.body.translation(),player.position)-gap(b.body.translation(),player.position))[0];if(audible)this.onSound('engine',audible.body.translation(),.16);}
  for(const i of this.items){const p=i.body.translation(),v=i.body.linvel(),q=i.body.rotation();i.previous.set(p.x,p.y,p.z);i.prevYaw=i.yaw;i.yaw=2*Math.atan2(q.y,q.w);i.body.resetForces(false);if(i.replyPending&&this.time>=i.replyAt){i.replyPending=false;this.onSound('horn-reply',p,.8);}
   const r=i.route,a=Math.atan2((p.z-r.center.z)/r.rz,(p.x-r.center.x)/r.rx),arc=Math.hypot(r.rx*Math.sin(a),r.rz*Math.cos(a)),target=routePoint(r,a+Math.min(.8,4/arc));
   const playerVelocity=player.velocity||{x:0,z:0},relative={x:player.position.x-p.x,z:player.position.z-p.z},dv={x:playerVelocity.x-v.x,z:playerVelocity.z-v.z},tt=clamp(-(relative.x*dv.x+relative.z*dv.z)/(dv.x*dv.x+dv.z*dv.z||1),0,2);
   const radius=r.length*.5+3;let yielding=Math.hypot(relative.x+dv.x*tt,relative.z+dv.z*tt)<radius||Math.hypot(relative.x,relative.z)<radius;
   for(const other of this.items)if(other!==i&&gap(p,other.body.translation())<(r.length+other.route.length)/2+3)yielding=true;
   // Evaluate the full swept hull before entering a fairway, dock or challenge.
   // Long bows can clip an enlarged island while a ship center remains clear.
   const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz)||1,heading=Math.atan2(-dx,-dz),turn=Math.atan2(Math.sin(heading-i.yaw),Math.cos(heading-i.yaw)),nextYaw=i.yaw+clamp(turn,-.45,.45);
   const currentClear=hullWaterClear(p,i.yaw,r),future={x:p.x+dx/d*r.speed,z:p.z+dz/d*r.speed},shoreRisk=!sweptHullWaterClear(p,future,i.yaw,nextYaw,r);
   if(r.id==='yacht-solstice'&&gap(p,routePoint(r,0))<3&&this.time-i.lastMoor>65){i.lastMoor=this.time;i.mooredUntil=this.time+10;}const rest=this.time<i.mooredUntil;
   if(yielding)i.holdUntil=this.time+1.2;const stopped=yielding||this.time<i.holdUntil||rest||(currentClear&&shoreRisk);
   const speed=stopped?0:shoreRisk?.6:r.speed,desired={x:dx/d*speed,z:dz/d*speed};
   const ax=(desired.x-v.x)*1.5,az=(desired.z-v.z)*1.5,mag=Math.hypot(ax,az)||1,limit=stopped?3:.8,mass=i.body.mass();
   i.body.addForce({x:ax*Math.min(1,limit/mag)*mass,y:0,z:az*Math.min(1,limit/mag)*mass},true);
   i.body.setAngvel({x:0,y:stopped?0:clamp(turn*1.8,-.45,.45),z:0},true);i.state=stopped?(rest?'at work':'yielding'):shoreRisk?'returning to route':'cruising';i.phase=a;
  }
 }
 update(alpha,player,waterTime){const ranked=[...this.items].sort((a,b)=>gap(a.body.translation(),player)-gap(b.body.translation(),player)),budget=this.settings.quality==='low'?2:4;
  for(const [index,i]of ranked.entries()){const p=i.body.translation(),v=i.body.linvel();i.group.position.lerpVectors(i.previous,new THREE.Vector3(p.x,p.y,p.z),alpha);const delta=Math.atan2(Math.sin(i.yaw-i.prevYaw),Math.cos(i.yaw-i.prevYaw));i.group.rotation.y=i.prevYaw+delta*alpha;i.group.rotation.z=this.settings.reduced?0:Math.sin(this.time*.7+i.route.phase)*.012;
   const distance=gap(p,player);
   // High and low geometry share silhouettes; switch only well away from the player.
   i.lodHigh=index<budget&&(distance<50||(i.lodHigh&&distance<60));i.high.visible=i.lodHigh;i.low.visible=!i.lodHigh;i.group.visible=distance<145;
   i.lamp.visible=this.time>=i.replyAt&&this.time<i.replyUntil&&Math.floor(this.time*5)%2===0;
   this.wakes.emit(i.route.id,{x:p.x+Math.sin(i.yaw)*i.route.length*.47,z:p.z+Math.cos(i.yaw)*i.route.length*.47},i.yaw,Math.hypot(v.x,v.z),i.route.width,this.time);
  }this.wakes.update(this.time,waterTime);
 }
 horn(player){if(this.time-this.lastHorn<3)return false;this.lastHorn=this.time;this.onSound('horn',player,1);
  const nearest=this.items.filter(i=>gap(i.body.translation(),player)<=30).sort((a,b)=>gap(a.body.translation(),player)-gap(b.body.translation(),player))[0];
  if(nearest&&this.time-nearest.lastReply>=10){nearest.lastReply=this.time;nearest.replyAt=this.time+.45;nearest.replyUntil=this.time+2.45;nearest.replyPending=true;}return true;
 }
 onTravel(){this.wakes.clear();for(const i of this.items){i.replyUntil=0;i.replyPending=false;i.previous.copy(i.body.translation());i.prevYaw=i.yaw;}this.lastHorn=this.time-3;}
 status(){return this.items.map(i=>({id:i.route.id,kind:i.route.kind,name:i.route.name,position:{...i.body.translation()},speed:Math.hypot(i.body.linvel().x,i.body.linvel().z),state:i.state}));}
 dispose(){this.wakes.dispose();for(const i of this.items){this.world.removeRigidBody(i.body);i.group.removeFromParent();}this.items=[];}
}
