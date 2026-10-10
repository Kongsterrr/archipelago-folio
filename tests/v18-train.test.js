import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {IslandController} from '../sources/world/island.js';
import {islands} from '../sources/config.js';
import {islandMapGeometry} from '../sources/core/minimap.js';
import {sampleTrainPath,trainPathLength,sampleTrainMotion,trainDuration} from '../sources/core/train-path.js';

const path={type:'racetrack',center:[0,5.8,-11.75],halfStraight:16,radius:2.7};
const train={path,speed:2,rootY:5.8,surfaceY:5.8,cars:[{name:'anim_train_engine',offset:0,halfLength:1.4,halfWidth:.71},{name:'anim_train_car_1',offset:3.2,halfLength:1.2,halfWidth:.69}]};
const length=trainPathLength(path),duration=trainDuration(train);
const close=(a,b,message='',epsilon=1e-8)=>assert.ok(Math.abs(a-b)<epsilon,`${message}: ${a} != ${b}`);
const wrap=value=>(value%length+length)%length;
const spatialDistance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

function fixture(t){
 const district={id:'amtrak',x:0,y:0,z:-10.05,rotation:.23,animation:{train}};
 const island={id:'experience',x:-76,z:8,rotation:Math.PI/2,districts:[district]};
 const outer=new THREE.Group(),model=new THREE.Group(),group=new THREE.Group();
 outer.position.set(island.x,0,island.z);outer.rotation.y=island.rotation;outer.add(model);
 group.name='district_amtrak';group.position.set(district.x,0,district.z);group.rotation.y=district.rotation;model.add(group);
 for(const car of train.cars){
  const object=new THREE.Group(),point=sampleTrainMotion(train,0,duration,car.offset);
  object.name=car.name;object.position.set(point.x,point.y,point.z);object.rotation.y=point.yaw;group.add(object);
 }
 const controller=new IslandController(island,outer);controller.bind(model);
 t.after(()=>controller.release());
 return{island,outer,model,group,controller,child:controller.children[0]};
}

// Recover travelled distance from geometry, independently of the path sampler.
function distanceOnTrack(point){
 const x=point.x-path.center[0],z=point.z-path.center[2],h=path.halfStraight,r=path.radius;
 if(Math.abs(z-r)<1e-7&&x>=-h-1e-7&&x<=h+1e-7)return wrap(x+h);
 if(x>h)return 2*h+r*Math.atan2(x-h,z);
 if(Math.abs(z+r)<1e-7&&x>=-h-1e-7&&x<=h+1e-7)return 2*h+Math.PI*r+h-x;
 return 4*h+Math.PI*r+r*Math.atan2(-x-h,-z);
}

test('rear railway has exact straight and semicircular geometry with uniform metre-based travel',()=>{
 close(length,64+2*Math.PI*2.7,'track length');
 close(duration,40.48230016469244,'one lap at 2m/s');
 const h=16,r=2.7,arc=Math.PI*r;
 for(const[d,x,z]of[[0,-h,r],[32,h,r],[32+arc/2,h+r,0],[32+arc,h,-r],[64+arc,-h,-r],[64+arc*1.5,-h-r,0],[length,-h,r]]){
  const p=sampleTrainPath(path,d);close(p.x,x,'X');close(p.y,5.8,'elevated rail plane');close(p.z,path.center[2]+z,'Z');close(Math.hypot(p.tangentX,p.tangentZ),1,'unit tangent');
 }
 let measured=0,before=sampleTrainPath(path,0);
 for(let i=1;i<=10000;i++){const point=sampleTrainPath(path,length*i/10000);measured+=spatialDistance(before,point);before=point;}
 close(measured,length,'numerically measured loop arc length',.0001);
 for(const d of[4,18,33,36,43,62,77]){
  const a=sampleTrainPath(path,d),b=sampleTrainPath(path,d+.001);
  close(spatialDistance(a,b),.001,'metre travel is constant on straights and turns',1e-8);
 }
});

test('joins, negative car offsets and the lap wrap retain continuous positions and tangents',()=>{
 const arc=Math.PI*path.radius;
 for(const boundary of[0,32,32+arc,64+arc,length]){
  const a=sampleTrainPath(path,boundary-1e-6),b=sampleTrainPath(path,boundary+1e-6);
  assert.ok(spatialDistance(a,b)<2.01e-6,'no positional jump at path join');
  assert.ok(Math.hypot(a.tangentX-b.tangentX,a.tangentZ-b.tangentZ)<1e-6,'no direction jump at path join');
 }
 for(const d of[-length*3-2.7,-2.7,0,32,44,length+3]){
  const a=sampleTrainPath(path,d),b=sampleTrainPath(path,d+length*4);
  close(a.x,b.x,'wrapped X');close(a.z,b.z,'wrapped Z');close(a.tangentX,b.tangentX,'wrapped heading');
 }
 const target={};assert.equal(sampleTrainPath(path,3,target),target,'runtime can reuse its output object');
});

test('engine and carriage follow independent tangent poses and preserve their arc-length spacing',t=>{
 const f=fixture(t);f.controller.activate('amtrak');close(f.child.duration,duration);
 let elapsed=0;
 for(const time of[0,.05,1,15.9,16.2,18.1,20.4,23,37,39,40.4]){
  f.controller.update(time-elapsed,f.island,time);elapsed=time;
  const cars=f.child.trainCars.map(node=>node.object),engineDistance=distanceOnTrack(cars[0].position),carDistance=distanceOnTrack(cars[1].position);
  close(wrap(engineDistance-carDistance),train.cars[1].offset,'car gap along the track');
  close(wrap(engineDistance),wrap(time*2),'engine arc length');
  for(const car of cars){
   const distance=distanceOnTrack(car.position),ahead=sampleTrainPath(path,distance+.000001),behind=sampleTrainPath(path,distance-.000001),tx=ahead.x-behind.x,tz=ahead.z-behind.z,n=Math.hypot(tx,tz);
   close(-Math.sin(car.rotation.y),tx/n,'model -Z faces the travelled tangent',1e-6);
   close(-Math.cos(car.rotation.y),tz/n,'model -Z faces the travelled tangent',1e-6);
   close(car.position.y,5.8,'cars stay on the rail plane');
  }
 }
 f.controller.activate('amtrak');f.controller.update(16.2,f.island,0);
 const [engine,car]=f.child.trainCars.map(node=>node.object);
 assert.ok(Math.abs(Math.sin(engine.rotation.y-car.rotation.y))>.1,'cars turn separately while straddling a straight/turn join');
});

test('pause, reduced motion, completion and replay keep deterministic authored train poses',t=>{
 const f=fixture(t),snapshot=()=>f.child.trainCars.map(n=>[...n.object.position.toArray(),...n.object.quaternion.toArray()]);
 const home=snapshot();f.controller.activate('amtrak');f.controller.update(18,f.island,18);
 const moving=snapshot(),elapsed=f.child.elapsed;f.controller.update(0,f.island,900,true,false,'amtrak');
 assert.deepEqual(snapshot(),moving,'read focus freezes both car transforms');close(f.child.elapsed,elapsed,'read focus freezes action time');
 f.controller.update(.1,f.island,900,false,true);assert.deepEqual(snapshot(),home,'reduced motion restores authored poses');
 f.controller.activate('amtrak');f.controller.update(duration-.005,f.island,0);const nearHome=f.child.trainCars.map(n=>n.object.position.clone());
 f.controller.update(.01,f.island,0);assert.deepEqual(snapshot(),home,'completing one lap restores the exact rest pose');
 f.child.trainCars.forEach((n,i)=>assert.ok(n.object.position.distanceTo(nearHome[i])<.011,'completion is continuous through the lap seam'));
 f.controller.activate('amtrak');f.controller.update(0,f.island,0);assert.deepEqual(snapshot(),home,'replay starts from the same poses');
 f.controller.update(.5,f.island,.5);assert.notDeepEqual(snapshot(),home,'replay advances');
});

test('full engine and carriage envelopes remain separate through the tight turns and their joins',()=>{
 for(let i=0;i<2000;i++){
  const distance=length*i/2000,a=sampleTrainPath(path,distance),b=sampleTrainPath(path,distance-train.cars[1].offset);
  const axes=[[a.tangentX,a.tangentZ],[-a.tangentZ,a.tangentX],[b.tangentX,b.tangentZ],[-b.tangentZ,b.tangentX]];
  const separation=Math.max(...axes.map(([x,z])=>{
   const extent=(pose,car)=>car.halfLength*Math.abs(pose.tangentX*x+pose.tangentZ*z)+car.halfWidth*Math.abs(-pose.tangentZ*x+pose.tangentX*z);
   return Math.abs((b.x-a.x)*x+(b.z-a.z)*z)-extent(a,train.cars[0])-extent(b,train.cars[1]);
  }));
  assert.ok(separation>.05,`car bodies overlap or lose coupling clearance at ${distance}m: ${separation}m`);
 }
});

test('pedestrian yielding protects the trailing car through island/district transforms and respects gallery height',t=>{
 const f=fixture(t);f.controller.activate('amtrak');
 const trailing=f.group.getObjectByName('anim_train_car_1').getWorldPosition(new THREE.Vector3());
 const head=f.group.getObjectByName('anim_train_engine').getWorldPosition(new THREE.Vector3());
 assert.ok(head.distanceTo(trailing)>2.2,'the visitor is beyond the head-only safety radius');
 f.controller.pedestrian={...trailing};f.controller.update(1/60,f.island,0);
 assert.equal(f.child.elapsed,0,'a visitor beside the trailing carriage holds the entire train');
 f.controller.pedestrian={...trailing,y:trailing.y-2};f.controller.update(1/60,f.island,0);
 assert.ok(f.child.elapsed>0,'a visitor on the lower street does not stop the elevated gallery train');
 f.controller.activate('amtrak');f.controller.pedestrian=null;f.controller.update(10,f.island,0);
 const ahead=sampleTrainPath(path,24),world=f.group.localToWorld(new THREE.Vector3(ahead.x,ahead.y,ahead.z));
 f.controller.pedestrian={...world};f.controller.update(2,f.island,0);
 close(f.child.elapsed,10,'lookahead covers a larger simulation step without passing through a visitor');
});

test('viewing beside the gallery fence leaves the train running while entering the rail lane stops it',t=>{
 const f=fixture(t);f.controller.activate('amtrak');f.controller.update(8,f.island,0);
 const local=sampleTrainPath(path,16),viewer=f.group.localToWorld(new THREE.Vector3(local.x,local.y,local.z+1.3));
 f.controller.pedestrian={...viewer};f.controller.update(1/60,f.island,0);
 assert.ok(f.child.elapsed>8,'safe platform viewer is outside the car envelope and capsule margin');
 const rail=f.group.localToWorld(new THREE.Vector3(local.x,local.y,local.z)),before=f.child.elapsed;
 f.controller.pedestrian={...rail};f.controller.update(1/60,f.island,0);
 close(f.child.elapsed,before,'visitor actually in the railway lane stops dispatch');
});

test('both gallery fence corners remain clear throughout the turning train sweep',t=>{
 const f=fixture(t);f.controller.activate('amtrak');
 // Fence at global Z=-17.95 has a .06m half-width; Jack's capsule adds .22m.
 const viewerZ=-17.95+.06+.22-f.island.districts[0].z;
 for(const x of[-16,0,16]){
  const viewer=f.group.localToWorld(new THREE.Vector3(x,5.8,viewerZ));f.controller.pedestrian={...viewer};
  for(let n=0;n<360;n++){
   f.child.elapsed=n/360*duration;const before=f.child.elapsed;
   f.controller.update(1/60,f.island,0);
   assert.ok(f.child.elapsed>before,`legal viewer at fence X=${x} held the train at ${before}s`);
  }
 }
});

test('minimap stadium points use the same path through both parent rotations',t=>{
 const f=fixture(t),map=islandMapGeometry(f.island,{districts:f.island.districts}),points=map.tracks[0].points;
 assert.equal(points.length,129);
 points.forEach((point,index)=>{
  const p=sampleTrainPath(path,length*index/(points.length-1)),world=f.group.localToWorld(new THREE.Vector3(p.x,p.y,p.z));
  close(point.x,world.x,'map X aligns with railway');close(point.z,world.z,'map Z aligns with railway');
 });
 close(points[0].x,points.at(-1).x,'closed map loop');close(points[0].z,points.at(-1).z,'closed map loop');
});

test('legacy ellipse metadata retains its phase, node height and action duration',t=>{
 const old={trackCentre:[2,0,-3],trackRadii:[8.8,5.8],initialAngle:.2,duration:10},island={id:'amtrak',x:0,z:0,rotation:0,animation:{train:old}};
 const model=new THREE.Group(),node=new THREE.Group();node.name='anim_train';node.position.set(10.8,1.05,-3);model.add(node);
 const controller=new IslandController(island,model);controller.bind(model);t.after(()=>controller.release());
 controller.activate();controller.update(2.5,island,0);const angle=.2+Math.PI/2;
 close(controller.duration,10);close(node.position.x,2+Math.cos(angle)*8.8);close(node.position.z,-3+Math.sin(angle)*5.8);close(node.position.y,1.05);
 close(node.rotation.y,Math.atan2(Math.sin(angle)*8.8,-Math.cos(angle)*5.8));
 const before=node.position.clone();controller.update(0,island,99);assert.deepEqual(node.position,before);
});

test('legacy Amtrak protects its default track before a model is bound',()=>{
 const island={id:'amtrak',x:0,z:0,rotation:0},controller=new IslandController(island,new THREE.Group());
 controller.activate();controller.pedestrian={x:8.8,z:-1.4};controller.update(1,island,0);
 assert.equal(controller.elapsed,0,'the legacy track guard does not depend on finding model nodes');
 controller.pedestrian={x:0,z:0};controller.update(1,island,0);assert.equal(controller.elapsed,1);
 const shifted=new IslandController({...island,animation:{train:{trackCentre:[4,0,-8],trackRadii:[3,2],duration:12}}},new THREE.Group());
 shifted.activate();shifted.pedestrian={x:7,z:-8};shifted.update(1,island,0);
 assert.equal(shifted.duration,12);assert.equal(shifted.elapsed,0,'unbound legacy metadata also governs timing and yielding');
});

test('high and low exported trains share authored poses, materials and clear gallery operation',async t=>{
 const json=async file=>JSON.parse(await fs.readFile(new URL(file,import.meta.url),'utf8'));
 const layout=(await json('../static/models/walk-layout.json')).islands.find(i=>i.id==='experience'),island=islands.find(i=>i.id==='experience');
 const expected=layout.districts.find(d=>d.id==='amtrak').animation.train;
 assert.ok(expected.path&&expected.cars.length===2,'the final asset has the rear railway contract');
 const materialSets=[];
 for(const quality of['high','low']){
  const prefix=quality==='low'?'low/':'',metadata=(await json(`../static/models/${prefix}manifest.json`)).models.find(m=>m.id==='experience');
  assert.deepEqual(metadata.districts.find(d=>d.id==='amtrak').animation.train,expected,`${quality}: manifest and walk geometry agree`);
  const bytes=await fs.readFile(new URL(`../static/models/${prefix}experience.glb`,import.meta.url));
  const scene=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
  const outer=new THREE.Group();outer.position.set(island.x,0,island.z);outer.rotation.y=island.rotation;outer.add(scene);outer.updateMatrixWorld(true);
  const controller=new IslandController(island,outer);controller.bind(scene);t.after(()=>controller.release());
  const child=controller.children.find(c=>c.island.id==='amtrak'),materials=new Map();assert.equal(child.trainCars.length,2);
  for(const car of expected.cars){
   const node=scene.getObjectByName(car.name),pose=sampleTrainMotion(expected,0,trainDuration(expected),car.offset);
   assert.equal(node.parent.name,'district_amtrak',`${quality}: each car has its own independent district transform`);
   assert.ok(node.position.distanceTo(new THREE.Vector3(pose.x,pose.y,pose.z))<1e-5,`${quality}: authored position matches action start`);
   const forward=new THREE.Vector3(0,0,-1).applyQuaternion(node.quaternion);
   close(forward.x,pose.tangentX,'authored tangent X',1e-5);close(forward.z,pose.tangentZ,'authored tangent Z',1e-5);
   node.traverse(mesh=>{if(!mesh.isMesh)return;for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.set(material.name,material.color.getHexString());
    const vertices=mesh.geometry.attributes.position;
    for(let n=0;n<vertices.count;n++){
     const p=node.worldToLocal(new THREE.Vector3().fromBufferAttribute(vertices,n).applyMatrix4(mesh.matrixWorld));
     assert.ok(Math.abs(p.x)<=car.halfWidth+.002&&Math.abs(p.z)<=car.halfLength+.002,`${quality}: safety metadata encloses the visible ${car.name}`);
    }
   });
  }
  materialSets.push([...materials].sort(([a],[b])=>a.localeCompare(b)));
  const map=islandMapGeometry(island,layout).tracks[0].points;
  map.forEach((p,n)=>{const q=layout.trainTrack.points[n],world=outer.localToWorld(new THREE.Vector3(...q));close(p.x,world.x,'actual map X',1e-5);close(p.z,world.z,'actual map Z',1e-5);});
  for(const x of[-16,0,16]){
   controller.activate('amtrak');const viewer=outer.localToWorld(new THREE.Vector3(x,5.8,-17.67));controller.pedestrian={...viewer};
   const duration=trainDuration(expected),step=duration/240;
   for(let n=0;n<240;n++){
    controller.update(step,island,n*step);
    for(const car of child.trainCars){
     const pose=sampleTrainMotion(expected,child.elapsed,child.duration,car.trainOffset),forward=new THREE.Vector3(0,0,-1).applyQuaternion(car.object.quaternion);
     assert.ok(car.object.position.distanceTo(new THREE.Vector3(pose.x,pose.y,pose.z))<1e-5,`${quality}: loaded car follows the path`);
     close(forward.x,pose.tangentX,`${quality}: loaded car faces travel X`,1e-5);close(forward.z,pose.tangentZ,`${quality}: loaded car faces travel Z`,1e-5);
    }
   }
   close(child.elapsed,duration,`${quality}: gallery fence visitor never interrupts a complete lap`,1e-6);
  }
 }
 assert.deepEqual(materialSets[0],materialSets[1],'quality switch preserves train material colors');
});
