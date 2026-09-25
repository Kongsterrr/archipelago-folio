import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {WakePool} from './wake-pool.js';
import {islands,toWorld} from '../config.js';
import {waterClear,clearSegment,oceanHeight} from './water-space.js';
export const SEA_LIFE=[{id:'dolphin',name:'Bottlenose dolphins',hint:'Watch the open water east of the welcome channel.'},{id:'shark',name:'Ocean neighbours',hint:'A dorsal fin sometimes breaks the surface of the outer sea.'},{id:'fish',name:'Shoals of colour',hint:'Slow down near shallow coastal water.'},{id:'turtle',name:'Unhurried travellers',hint:'Look around the garden coast and the quiet cove.'}];
export const HABITATS=[{kind:'dolphin',x:25,z:35,rx:10,rz:6,count:3},{kind:'shark',x:147,z:0,rx:4,rz:20,count:1},{kind:'shark',x:-147,z:-10,rx:4,rz:18,count:1},{kind:'turtle',x:39,z:57,rx:3,rz:3,count:1},{kind:'turtle',x:-35,z:63,rx:2.5,rz:3,count:1}];
export const SHOALS=[{x:12,z:43},{x:-37,z:30},{x:38,z:43}];
export function birdPose(index,time,reduced=false){
 const island=islands[index%islands.length],pier=island.pier||{width:3,startZ:7.9,endZ:15.8,deckY:.85},perchedCount=Math.min(8,islands.length*2),fly=index>=perchedCount&&!reduced;
 const tier=Math.floor(index/islands.length),side=tier%2?1:-1,perch=toWorld(island,side*(pier.width/2-.12),pier.startZ+(pier.endZ-pier.startZ)*(.23+.27*tier));
 const orbit=Math.max(21,(island.r||21)*.85),phase=time*.13+index;
 return {islandId:island.id,fly,x:fly?island.x+Math.cos(phase)*orbit:perch.x,y:fly?16+index%3*2:pier.deckY+.42,z:fly?island.z+Math.sin(phase)*orbit*.85:perch.z,yaw:fly?-phase:island.rotation,roll:fly?-.15:0};
}
const angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function mergedModel(model){
 model.updateMatrixWorld(true);const geometries=[];let material;
 model.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone();
  // Decode quantized accessors before transforming/merging: WebGPU requires aligned strides.
  for(const key of Object.keys(g.attributes)){if(!['position','normal','color'].includes(key)){g.deleteAttribute(key);continue;}const a=g.getAttribute(key),values=new Float32Array(a.count*a.itemSize);for(let n=0;n<a.count;n++)for(let k=0;k<a.itemSize;k++)values[n*a.itemSize+k]=a.getComponent(n,k);g.setAttribute(key,new THREE.BufferAttribute(values,a.itemSize));}
  g.applyMatrix4(o.matrixWorld);geometries.push(g.index?g.toNonIndexed():g);material??=o.material;
 });return{geometry:mergeGeometries(geometries,false),material};
}
export class MarineLife{
 constructor(scene,settings,loader,discovery,onSound=()=>{}){Object.assign(this,{scene,settings,loader,discovery,onSound});this.items=[];this.time=0;this.wakes=new WakePool(scene,settings,90);this.seen=new Map();this.lastCompanion=-100;this.companionUntil=0;this.lastObserve=-10;this.lastBird=-20;this.ready=false;this.dummy=new THREE.Object3D();}
 async load(){const models=new Map();await Promise.all(['dolphin','shark','turtle','tropicalfish','seagull'].map(async kind=>{try{const high=(await this.loader.loadAsync(`/models/fauna/${kind}.glb`)).scene,low=['tropicalfish','seagull'].includes(kind)?null:(await this.loader.loadAsync(`/models/fauna/low/${kind}.glb`)).scene;models.set(kind,{high,low});}catch(e){console.warn('Sea life asset unavailable',kind,e.message);}}));
  for(const h of HABITATS)for(let n=0;n<h.count;n++){if(!models.has(h.kind))continue;const group=new THREE.Group(),high=models.get(h.kind).high.clone(true),low=models.get(h.kind).low.clone(true);group.add(high,low);low.visible=false;const phase=n*2.1;let p={x:h.x+Math.cos(phase)*h.rx,z:h.z+Math.sin(phase)*h.rz};if(!waterClear(p,1,{activities:true,docks:h.kind==='shark'}))p={x:h.x,z:h.z};
   const pivots=[];group.traverse(o=>{if(o.name.startsWith('anim_'))pivots.push({object:o,rotation:o.rotation.clone()});if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});group.position.set(p.x,0,p.z);this.scene.add(group);this.items.push({h,n,group,high,low,p:{...p},previous:{...p},yaw:0,phase,pivots,visible:false});}
  const fish=models.get('tropicalfish')?.high;if(fish){const flat=mergedModel(fish);this.fish=new THREE.InstancedMesh(flat.geometry,new THREE.MeshBasicMaterial({color:'#79bcc0',vertexColors:true,transparent:true,opacity:.6,depthWrite:false}),36);this.fish.frustumCulled=false;this.scene.add(this.fish);this.fishPositions=[];for(let n=0;n<36;n++){const h=SHOALS[Math.floor(n/12)],a=n*2.399,r=.5+n%4*.3;this.fishPositions.push({x:h.x+Math.cos(a)*r,z:h.z+Math.sin(a)*r,h,phase:a,yaw:a,previous:null});}}
  const gull=models.get('seagull')?.high;if(gull){const flat=mergedModel(gull);this.birds=new THREE.InstancedMesh(flat.geometry,flat.material,12);this.birds.frustumCulled=false;this.scene.add(this.birds);}
  this.ready=true;
 }
 step(dt,player){this.time+=dt;const p=player.position,v=player.velocity,speed=Math.hypot(v.x,v.z),dolphins=this.items.filter(i=>i.h.kind==='dolphin');
  if(player.canCompanion!==false&&!this.settings.reduced&&speed>1&&speed<9&&this.time-this.lastCompanion>45&&this.time>=this.companionUntil&&dolphins.some(i=>Math.hypot(i.p.x-p.x,i.p.z-p.z)<16)){this.companionUntil=this.time+8;this.lastCompanion=this.companionUntil;}
  for(const i of this.items){i.previous={...i.p};i.phase+=dt*(i.h.kind==='turtle'?.13:i.h.kind==='shark'?.17:.28)*(this.settings.reduced?.4:1);let target={x:i.h.x+Math.cos(i.phase)*i.h.rx,z:i.h.z+Math.sin(i.phase)*i.h.rz};let pace=i.h.kind==='dolphin'?3.5:i.h.kind==='shark'?2:.6;
   if(player.canCompanion!==false&&i.h.kind==='dolphin'&&i.n<2&&this.time<this.companionUntil&&speed<12){const side=i.n?1:-1,heading=player.yaw;target={x:p.x-Math.sin(heading)*5+Math.cos(heading)*side*4,z:p.z-Math.cos(heading)*5-Math.sin(heading)*side*4};pace=Math.min(8,speed+2);}
   if(i.h.kind==='shark'&&Math.hypot(p.x-i.p.x,p.z-i.p.z)<12)target={x:i.p.x+(i.p.x-p.x),z:i.p.z+(i.p.z-p.z)};
   const dx=target.x-i.p.x,dz=target.z-i.p.z,dist=Math.hypot(dx,dz)||1,step=Math.min(dist,pace*dt),next={x:i.p.x+dx/dist*step,z:i.p.z+dz/dist*step};
   if(waterClear(next,i.h.kind==='turtle'?.7:1.3,{activities:true,docks:i.h.kind==='shark'})&&clearSegment(i.p,next,.4)){i.p=next;i.yaw+=angle(Math.atan2(-dx,-dz),i.yaw)*Math.min(1,dt*3);}
  }
  for(const [n,f]of (this.fishPositions||[]).entries()){f.previous={x:f.x,z:f.z};f.phase+=dt*.5*(this.settings.reduced?.3:1);const close=Math.hypot(p.x-f.h.x,p.z-f.h.z)<6,spread=close&&!this.settings.reduced?4:1.5,a=f.phase+n*.4;const target={x:f.h.x+Math.cos(a)*spread,z:f.h.z+Math.sin(a)*spread*.6},dx=target.x-f.x,dz=target.z-f.z,rate=1-Math.exp(-dt*(close?3:1));const next={x:f.x+dx*rate,z:f.z+dz*rate};if(waterClear(next,.35,{activities:true})&&clearSegment(f,next,.2)){f.x=next.x;f.z=next.z;f.yaw=Math.atan2(-dx,-dz);}}
  for(const species of SEA_LIFE){const count=this.seen.get(species.id)||0;if(this.observed?.has(species.id)){this.seen.set(species.id,count+dt);if(count+dt>=1)this.discovery?.observe(species.id);}else this.seen.set(species.id,0);}
  if(this.time-this.lastBird>18&&!this.settings.reduced){this.lastBird=this.time;const island=islands.find(i=>Math.hypot(i.x-p.x,i.z-p.z)<32);if(island)this.onSound('gull',{x:island.x,z:island.z},.35);}
 }
 update(alpha,player,camera,waterTime,occluders=[]){const reduced=this.settings.reduced,low=this.settings.quality==='low';
  for(const i of this.items){const x=THREE.MathUtils.lerp(i.previous.x,i.p.x,alpha),z=THREE.MathUtils.lerp(i.previous.z,i.p.z,alpha),distance=Math.hypot(player.x-x,player.z-z);i.group.visible=distance<100;i.high.visible=distance<(low?22:45);i.low.visible=!i.high.visible;
   const breach=i.h.kind==='dolphin'&&!reduced?Math.pow(Math.max(0,Math.sin(this.time*.75+i.n*1.5)),12)*.8:0,y=oceanHeight(x,z,waterTime)+(i.h.kind==='shark'?-.18:i.h.kind==='turtle'?.04:-.08)+breach;
   i.group.position.set(x,y,z);if(distance<50)this.wakes.emit(i.h.kind+i.h.x+i.n,{x:x+Math.sin(i.yaw)*.65,z:z+Math.cos(i.yaw)*.65},i.yaw,Math.hypot(i.p.x-i.previous.x,i.p.z-i.previous.z)*60,.65,this.time);i.group.rotation.set(breach>0?Math.cos(this.time*.75+i.n*1.5)*.18:0,i.yaw,0);
   if(distance<45)for(const pivot of i.pivots){pivot.object.rotation.copy(pivot.rotation);if(!reduced){if(pivot.object.name.includes('tail'))pivot.object.rotation[i.h.kind==='dolphin'?'x':'y']+=Math.sin(this.time*5+i.n)*.2;else pivot.object.rotation.z+=Math.sin(this.time*3+i.n)*.16;}}
  }
  this.wakes.update(this.time,waterTime);
  if(this.fish)for(let n=0;n<36;n++){const f=this.fishPositions[n],a=f.previous||f,x=THREE.MathUtils.lerp(a.x,f.x,alpha),z=THREE.MathUtils.lerp(a.z,f.z,alpha);this.dummy.position.set(x,oceanHeight(x,z,waterTime)+.025,z);this.dummy.rotation.set(0,f.yaw,0);const show=Math.hypot(x-player.x,z-player.z)<48&&(!low||n%2===0);this.dummy.scale.set(show?1:0,.055,show?1:0);this.dummy.updateMatrix();this.fish.setMatrixAt(n,this.dummy.matrix);}if(this.fish)this.fish.instanceMatrix.needsUpdate=true;
  if(this.birds)for(let n=0;n<12;n++){const pose=birdPose(n,this.time,reduced);this.dummy.position.set(pose.x,pose.y,pose.z);this.dummy.rotation.set(0,pose.yaw,pose.roll);const distance=Math.hypot(pose.x-player.x,pose.z-player.z);this.dummy.scale.setScalar(distance<80&&(!low||n%2===0)?.8:0);this.dummy.updateMatrix();this.birds.setMatrixAt(n,this.dummy.matrix);}if(this.birds)this.birds.instanceMatrix.needsUpdate=true;
  if(this.time-this.lastObserve>.15){this.lastObserve=this.time;this.observed=new Set();const check=(kind,point)=>{if(this.observed.has(kind)||Math.hypot(point.x-player.x,point.z-player.z)>35)return;const ndc=point.clone().project(camera);if(ndc.z<0||ndc.z>1||Math.abs(ndc.x)>.9||Math.abs(ndc.y)>.85)return;const direction=point.clone().sub(camera.position),distance=direction.length(),ray=new THREE.Raycaster(camera.position,direction.normalize(),0,distance-.6);if(!ray.intersectObjects(occluders,true).length)this.observed.add(kind);};for(const i of this.items)if(i.group.visible)check(i.h.kind,i.group.position);for(const [n,f]of (this.fishPositions||[]).entries())if(!low||n%2===0)check('fish',new THREE.Vector3(f.x,oceanHeight(f.x,f.z,waterTime)+.03,f.z));}
 }
 onTravel(){if(this.companionUntil>this.time)this.lastCompanion=this.time;this.companionUntil=0;this.wakes.clear();this.observed=new Set();this.seen.clear();for(const i of this.items)i.previous={...i.p};}
 status(){return{companionActive:this.time<this.companionUntil,animals:this.items.map(i=>({kind:i.h.kind,position:{...i.p}})),fish:this.fishPositions?.length||0};}
}
