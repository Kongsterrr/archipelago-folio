import * as THREE from 'three';
import {box,cylinder,mesh,ring,label,material} from './geometry.js';
import {reefGroups,secretPlaces,cargoBay,cargoBerths,lamps,challenges,gates,WORLD_RADIUS} from '../config.js';
import {CHANNEL_POSTS} from './water-space.js';

export class Environment {
 constructor(scene,R,world,settings){Object.assign(this,{scene,R,world,settings});this.occluders=[];this.lamps=new Map();this.berths=new Map();this.signs=[];this.gateViews=[];this.createReefs();this.createArch();this.createCargo();this.createLamps();this.createStations();this.createGates();this.createChannels();}
 collider(x,z,hx,hz,yaw=0){return this.world.createCollider(this.R.ColliderDesc.cuboid(hx,2,hz).setTranslation(x,0,z).setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}).setFriction(.12).setRestitution(.12));}
 createReefs(){
  const rockGeometry=new THREE.IcosahedronGeometry(1,1),rock=new THREE.InstancedMesh(rockGeometry,material('#92a79c'),reefGroups.length*4),dummy=new THREE.Object3D();let index=0;rock.castShadow=true;rock.receiveShadow=true;
  for(const reef of reefGroups){
   const sand=cylinder(this.scene,reef.r,.6,'sand',[reef.x,0,reef.z],18);sand.castShadow=false;
   const shallow=mesh(this.scene,new THREE.CircleGeometry(reef.r+2,24),new THREE.MeshBasicMaterial({color:'#6b9991',transparent:true,opacity:.24,depthWrite:false}),[reef.x,-.065,reef.z]);shallow.rotation.x=-Math.PI/2;shallow.castShadow=false;
   for(let j=0;j<4;j++){const a=j*2.4;dummy.position.set(reef.x+Math.cos(a)*reef.r*.4,.5+j%2*.6,reef.z+Math.sin(a)*reef.r*.4);dummy.scale.set(reef.r*.45,1+j%2*.8,reef.r*.5);dummy.rotation.set(j*.2,a,j*.1);dummy.updateMatrix();rock.setMatrixAt(index++,dummy.matrix);}
   this.world.createCollider(this.R.ColliderDesc.cylinder(2,reef.r*.96).setTranslation(reef.x,0,reef.z).setFriction(.12));
  }this.scene.add(rock);
 }
 createArch(){
  const p=secretPlaces.arch,g=new THREE.Group();g.position.set(p.x,0,p.z);this.scene.add(g);
  for(const x of [-6,6]){const m=mesh(g,new THREE.IcosahedronGeometry(1,1),'#aab6a4',[x,2.5,0]);m.scale.set(2.1,3.2,2.2);this.collider(p.x+x,p.z,1.8,1.8);}
  const arch=mesh(g,new THREE.TorusGeometry(6,1.5,5,12,Math.PI),'#bdc4ad',[0,4,0]);arch.material=arch.material.clone();arch.material.transparent=true;this.occluders.push(arch);
  const text=label('SLOW · SECRET PASSAGE',{worldWidth:5.5,fontSize:23});text.position.set(0,2,5);g.add(text);
 }
 createCargo(){
  const {x,z,width,depth}=cargoBay,hx=width/2,hz=depth/2;
  const rail=(px,pz,w,d)=>{box(this.scene,[w,.38,d],'woodLight',[px,.32,pz]);this.collider(px,pz,w/2,d/2);for(let j=0;j<Math.max(w,d);j+=4){const along=j-Math.max(w,d)/2;cylinder(this.scene,.22,1.4,'wood',[px+(w>d?along:0),.35,pz+(d>w?along:0)]);}};
  rail(x,z-hz,width,1);rail(x-hx,z,1,depth);rail(x+hx,z,1,depth);rail(x-14,z+hz,12,1);rail(x+14,z+hz,12,1);
  for(const b of cargoBerths){
   const floor=mesh(this.scene,new THREE.PlaneGeometry(b.halfWidth*2,b.halfDepth*2),new THREE.MeshBasicMaterial({color:b.color,transparent:true,opacity:.32,depthWrite:false}),[b.x,.08,b.z]);floor.rotation.x=-Math.PI/2;floor.castShadow=false;
   for(const side of [-1,1]){box(this.scene,[.28,.36,4],b.color,[b.x+side*(b.halfWidth+.35),.3,b.z]);this.collider(b.x+side*(b.halfWidth+.35),b.z,.14,2);}
   const symbol=label(b.symbol,{width:96,height:96,worldWidth:2.3,color:b.color});symbol.position.set(b.x,3,b.z-2.8);this.scene.add(symbol);
   const light=mesh(this.scene,new THREE.SphereGeometry(.4,10,8),material('#a2b5a1',{emissive:'#000000'}).clone(),[b.x,1.1,b.z-3]);this.berths.set(b.id,light);
  }
 }
 createLamps(){for(const lamp of lamps){
  const root=new THREE.Group();root.position.set(lamp.x,0,lamp.z);this.scene.add(root);cylinder(root,1.3,.6,'navy',[0,.2,0]);ring(root,1.25,.15,'ivory',[0,.45,0]);cylinder(root,.13,3.6,'ivory',[0,2,0]);
  const glow=mesh(root,new THREE.SphereGeometry(.5,12,10),new THREE.MeshStandardMaterial({color:lamp.color,emissive:lamp.color,emissiveIntensity:0}),[0,4,0]);
  const text=label(`${lamp.symbol} ${lamp.name}`,{worldWidth:4,color:lamp.color,fontSize:33});text.position.set(0,5.4,0);root.add(text);this.lamps.set(lamp.id,{root,glow});this.world.createCollider(this.R.ColliderDesc.cylinder(2,1.25).setTranslation(lamp.x,0,lamp.z));
 }}
 createStations(){for(const c of challenges){const root=new THREE.Group();root.position.set(c.x,0,c.z);this.scene.add(root);cylinder(root,1.1,.55,'orange',[0,.15,0]);cylinder(root,.1,3,'ivory',[0,1.9,0]);const sign=label(c.name,{worldWidth:5.5,fontSize:34});sign.position.set(0,4,0);root.add(sign);const key=label('F · PLAY',{worldWidth:2.5,fontSize:30,background:'#fff5dd',color:'#254f62'});key.position.set(0,2.6,0);root.add(key);this.signs.push({root,sign,key,position:c});this.world.createCollider(this.R.ColliderDesc.cylinder(2,1).setTranslation(c.x,0,c.z));}}
 createGates(){gates.forEach((gate,index)=>{
  const root=new THREE.Group();root.position.set(gate.x,0,gate.z);root.rotation.y=Math.atan2(gate.nx,gate.nz);this.scene.add(root);const flags=[];
  for(const side of [-1,1]){cylinder(root,.7,.8,'orange',[side*gate.r,.3,0]);cylinder(root,.09,3.5,'ivory',[side*gate.r,2.2,0]);const flag=box(root,[1.5,1,.06],material('yellow').clone(),[side*gate.r+.7,3.5,0]);flags.push(flag);const px=gate.x+side*gate.r*gate.nz,pz=gate.z-side*gate.r*gate.nx;this.world.createCollider(this.R.ColliderDesc.cylinder(2,.65).setTranslation(px,0,pz));}
  const line=box(root,[gate.r*2,.015,.25],new THREE.MeshBasicMaterial({color:'#fff3c9',transparent:true,opacity:.22,depthWrite:false}),[0,.04,0]);line.castShadow=false;
  const number=label(String(index+1).padStart(2,'0'),{width:96,height:96,worldWidth:2.4,fontSize:51});number.position.set(0,3.3,0);root.add(number);this.gateViews.push({root,flags,line,number});
 });}
 createChannels(){
  // Small navigation posts create readable edges without blocking the fairways.
  const positions=CHANNEL_POSTS;
  const geo=new THREE.CylinderGeometry(.18,.24,1.5,8),m=material('teal');this.channelPosts=new THREE.InstancedMesh(geo,m,positions.length);const dummy=new THREE.Object3D();positions.forEach(([x,z],i)=>{dummy.position.set(x,.6,z);dummy.updateMatrix();this.channelPosts.setMatrixAt(i,dummy.matrix);});this.scene.add(this.channelPosts);
  for(const [x,z]of positions){ring(this.scene,.5,.1,'ivory',[x,.1,z]);this.world.createCollider(this.R.ColliderDesc.cylinder(1,.25).setTranslation(x,0,z));}
 }
 update(challenge,time,boat,nearAction=null){
  this.gateViews.forEach((g,index)=>{const active=challenge.kind==='buoy'&&challenge.active,passed=active&&index<challenge.index,next=active&&index===challenge.index;for(const f of g.flags)f.material.color.set(passed?'#70b59b':next?'#ffd364':'#e8ba77');g.line.material.opacity=next?.6:.16;g.number.visible=!active||next||passed;});
  for(const c of this.signs){const d=Math.hypot(boat.x-c.position.x,boat.z-c.position.z);c.sign.visible=d<55;c.key.visible=nearAction?.id===`challenge-${c.position.id}`;}
  for(const b of cargoBerths){const m=this.berths.get(b.id).material,done=challenge.kind==='cargo'&&challenge.delivered.has(b.id);m.color.set(done?'#9bd4a6':'#a2b5a1');m.emissive.set(done?'#7ddb8e':'#000000');m.emissiveIntensity=done?.5:0;}
  for(const lamp of lamps){const lit=challenge.kind==='lighthouse'&&challenge.sequence.slice(0,challenge.index).includes(lamp.id),m=this.lamps.get(lamp.id).glow.material;m.emissiveIntensity=lit?1.4:0;}
 }
}
