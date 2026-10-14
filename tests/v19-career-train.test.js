import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {CareerTrainController,CAREER_TRAIN,CAREER_TRAIN_MOTION} from '../sources/core/career-train.js';
import {CareerTrainVisual} from '../sources/world/career-train.js';
import {sampleTrainPath,trainPathLength} from '../sources/core/train-path.js';
import {careerRailway} from '../scripts/lib/career-railway-layout.mjs';

const DT=1/60,close=(a,b,epsilon=1e-7)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
const fixture=(options)=>new CareerTrainController(careerRailway(),options);
function arrive(train,options={}){
 let previous=train.distance;
 for(let n=0;n<30000;n++){
  train.step(DT,options);assert.ok(train.distance>=previous,'path progress never reverses');assert.ok(train.distance-previous<=CAREER_TRAIN.cruiseSpeed*DT+.00001,'no motion teleport');previous=train.distance;
  if(train.state==='stopped')return;
 }assert.fail(`train failed to arrive: ${JSON.stringify(train.status())}`);
}
async function model(){const bytes=await fs.readFile(new URL('../static/models/career-train.glb',import.meta.url));return(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;}

test('passenger chooses each chronological departure and the train waits after every exit',()=>{
 const train=fixture();assert.equal(train.currentStation.id,'harbor');assert.equal(train.state,'stopped');assert.equal(train.continue(),false);
 assert.equal(train.board('visionx'),false);assert.equal(train.board('harbor'),true);
 for(const stop of['visionx','beaconfire','amtrak','harbor']){
  assert.equal(train.nextStation.id,stop);assert.equal(train.continue(),true);assert.equal(train.leave(),false,'no moving dismount');assert.equal(train.call('harbor'),false,'occupied train cannot be recalled');
  arrive(train);assert.equal(train.currentStation.id,stop);assert.equal(train.leave(),true);
  const distance=train.distance;train.step(120);close(train.distance,distance);assert.equal(train.passenger,false);
  assert.equal(train.board(stop),true);
 }
 assert.ok(train.distance>train.length,'the final return wraps continuously into a second lap');
});

test('an empty call follows the one-way route, skips intermediate stops and never auto-boards',()=>{
 const train=fixture();assert.equal(train.call('amtrak'),true);assert.equal(train.mission,'call');assert.ok(train.eta>0);assert.equal(train.currentStation,null);
 arrive(train);assert.equal(train.currentStation.id,'amtrak');assert.equal(train.passenger,false);
 assert.equal(train.call('visionx'),true);const before=train.distance,target=train.targetDistance;arrive(train);assert.equal(train.currentStation.id,'visionx');assert.ok(train.distance>before);close(train.distance,target);
 train.board('visionx');assert.equal(train.nextStation.id,'beaconfire');
});

test('cancellation returns empty, while a requested harbor return carries the passenger without teleporting',()=>{
 const train=fixture();train.board();train.continue();train.step(6);const distance=train.distance;
 train.cancelRide();close(train.distance,distance);assert.equal(train.passenger,false);assert.equal(train.mission,'return');assert.equal(train.targetStationId,'harbor');
 const harborTarget=train.targetDistance;arrive(train);assert.equal(train.currentStation.id,'harbor');assert.ok(train.distance>distance);close(train.distance,harborTarget);
 train.call('beaconfire');train.step(3);const redirect=train.distance;train.call('visionx');close(train.distance,redirect);arrive(train);assert.equal(train.currentStation.id,'visionx');
 train.board();train.continue();train.step(2);const occupiedReturn=train.distance;train.returnToHarbor();close(train.distance,occupiedReturn);assert.equal(train.passenger,true);arrive(train);assert.equal(train.currentStation.id,'harbor');assert.equal(train.passenger,true,'integration validates a platform exit after the real return trip');
});

test('all pause causes preserve route and stop intent while resumption accelerates gradually',()=>{
 const train=fixture();train.board();train.continue();train.step(4);assert.ok(train.speed>1);
 const distance=train.distance,target=train.targetDistance;train.step(60,{paused:true});close(train.distance,distance);close(train.previousDistance,distance);close(train.speed,0);close(train.targetDistance,target);
 assert.equal(train.leave(),false);train.step(0,{paused:false});train.step(DT);assert.ok(train.speed>0&&train.speed<=CAREER_TRAIN.acceleration*DT+.00001);
 const a=fixture(),b=fixture();a.board();b.board();a.continue();b.continue();a.step(8);for(let n=0;n<480;n++)b.step(DT);close(a.distance,b.distance,1e-6);
});

test('V20 compact tour meets its motion budget and brakes continuously to zero at each station',()=>{
 const train=fixture();train.board();let seconds=0;const legs=[];
 for(const stop of['visionx','beaconfire','amtrak','harbor']){
  assert.equal(train.continue(),true);let frames=0;
  while(train.state!=='stopped'&&frames<6000){
   const speed=train.speed,distance=train.distance;train.step(DT);frames++;
   assert.ok(train.speed-speed<=CAREER_TRAIN_MOTION.acceleration*DT+1e-8,'departure accelerates continuously');
   assert.ok(speed-train.speed<=CAREER_TRAIN_MOTION.braking*DT+1e-8,'the final stop cannot truncate a moving carriage');
   assert.ok(train.distance-distance<=CAREER_TRAIN_MOTION.cruiseSpeed*DT+1e-8);
  }
  assert.equal(train.currentStation?.id,stop);close(train.speed,0);close(train.distance,train.targetDistance);
  legs.push(frames*DT);seconds+=frames*DT;
 }
 assert.ok(seconds>=35&&seconds<=38,`compact loop took ${seconds.toFixed(3)}s: ${legs}`);
 close(train.railway.cruiseSpeed,CAREER_TRAIN_MOTION.cruiseSpeed);close(train.railway.curveSpeed,CAREER_TRAIN_MOTION.curveSpeed);
});

test('V20 opaque station preparation clears route state and never interpolates across the move',()=>{
 const train=fixture();train.call('amtrak');train.step(3);train.cancelRide();train.step(DT);
 const before=train.distance;assert.equal(train.parkAtStation('visionx'),true);
 assert.ok(train.distance>=before);close(train.previousDistance,train.distance);close(train.targetDistance,train.distance);
 assert.equal(train.currentStation.id,'visionx');assert.equal(train.mission,null);assert.equal(train.targetStationId,null);assert.equal(train.passenger,false);close(train.speed,0);
 assert.deepEqual(train.velocity,{x:0,y:0,z:0});assert.deepEqual(train.carPose(1,0),train.carPose(1,1));
 train.board();const stopped=train.distance;assert.equal(train.parkAtStation('harbor'),false,'an occupied carriage cannot be relocated');close(train.distance,stopped);
});

test('motion uses smooth grade and independent car poses through turns, including lap interpolation',()=>{
 const island={x:-76,y:2,z:8,rotation:1.17},train=fixture({island});train.call('amtrak');
 let tilted=false,different=false,maxSpeed=0;
 for(let n=0;n<6000&&train.state!=='stopped';n++){
  train.step(DT);const a=train.carPose(0),b=train.carPose(1);tilted ||=Math.abs(a.pitch)>.02;different ||=Math.abs(a.yaw-b.yaw)>.1;maxSpeed=Math.max(maxSpeed,train.speed);
  const local=sampleTrainPath(train.path,train.distance-CAREER_TRAIN.coachOffset),co=Math.cos(island.rotation),si=Math.sin(island.rotation);
  close(b.x,island.x+local.x*co+local.z*si);close(b.y,island.y+local.y);close(b.z,island.z-local.x*si+local.z*co);
  const midpoint=train.carPose(1,.5),start=train.carPose(1,0),end=train.carPose(1,1),halfStep=CAREER_TRAIN.cruiseSpeed*DT/2+1e-6;assert.ok(Math.hypot(midpoint.x-start.x,midpoint.z-start.z)<=halfStep);assert.ok(Math.hypot(end.x-midpoint.x,end.z-midpoint.z)<=halfStep);
 }
 assert.ok(tilted&&different&&maxSpeed>3,'tour includes grades, separate turning cars and a cruise section');
 train.previousDistance=train.length-.02;train.distance=train.length+.02;const a=train.carPose(0,0),b=train.carPose(0,1);assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<.041,'wrap never interpolates backward around the whole path');
});

test('independently sampled car envelopes stay separated around every tight curve',()=>{
 const train=fixture();
 for(let d=0;d<train.length;d+=.1){
  train.distance=train.previousDistance=d;
  const cars=[0,1].map(i=>{const p=train.carPose(i);return{...p,...CAREER_TRAIN.cars[i],forward:[-Math.sin(p.yaw),-Math.cos(p.yaw)],right:[Math.cos(p.yaw),-Math.sin(p.yaw)]};}),[a,b]=cars;
  let gap=-Infinity;
  for(const axis of[a.forward,a.right,b.forward,b.right]){
   const radius=car=>car.halfLength*Math.abs(car.forward[0]*axis[0]+car.forward[1]*axis[1])+car.halfWidth*Math.abs(car.right[0]*axis[0]+car.right[1]*axis[1]);
   gap=Math.max(gap,Math.abs((b.x-a.x)*axis[0]+(b.z-a.z)*axis[1])-radius(a)-radius(b));
  }
  assert.ok(gap>.10,`car body envelopes overlap or pinch the coupling at ${d}: ${gap}`);
 }
});

for(const crossingIndex of[0,1])test(`occupied crossing ${crossingIndex+1} stops the leading bumper before the pedestrian lane, then releases smoothly`,()=>{
 const train=fixture(),crossing=train.railway.crossings[crossingIndex],p=sampleTrainPath(train.path,crossing.distance);
 train.call('amtrak');let waited=false;
 for(let n=0;n<12000;n++){train.step(DT,{pedestrians:[{x:p.x,y:p.y,z:p.z}]});if(train.state==='waiting-crossing'){waited=true;break;}}
 assert.ok(waited,'the route yields at the actual pedestrian crossing');
 assert.ok(train.distance+CAREER_TRAIN.cars[0].halfLength<=crossing.distance-crossing.width/2-.30,'nose remains behind the crossing boundary');
 const stop=train.distance;train.step(4,{pedestrians:[p]});close(train.distance,stop);
 train.step(DT,{pedestrians:[]});assert.equal(train.state,'moving');assert.ok(train.speed<=CAREER_TRAIN.acceleration*DT+.00001);arrive(train);
});

test('a visitor on the platform or another vertical level does not stop an empty call',()=>{
 for(const level of['platform','below']){
  const train=fixture(),station=train.stations[1],point=level==='platform'?station.boarding:{...sampleTrainPath(train.path,15),y:-4};train.call('visionx');arrive(train,{pedestrians:[point]});assert.equal(train.currentStation.id,'visionx');
 }
});

test('late pedestrian entry or contact with the trailing coach stops without pushing through',()=>{
 const train=fixture();train.call('amtrak');train.distance=train.railway.stations[2].distance-13;train.previousDistance=train.distance;train.speed=CAREER_TRAIN.cruiseSpeed;
 const start=train.distance,p=sampleTrainPath(train.path,start+CAREER_TRAIN.cars[0].halfLength+.37+.12);
 for(let n=0;n<60;n++)train.step(DT,{pedestrians:[p]});
 assert.ok(train.distance-start<=.13,'emergency sweep clamps movement within remaining capsule clearance');assert.equal(train.state,'waiting-crossing');close(train.speed,0);
 train.step(DT,{pedestrians:[]});const coach=sampleTrainPath(train.path,train.distance-CAREER_TRAIN.coachOffset),distance=train.distance;
 train.step(DT,{pedestrians:[coach]});close(train.distance,distance);assert.equal(train.speed,0,'trailing carriage has its own protection');
});

test('the detailed asset fits its body envelopes and preserves open coach seating and animated wheels',async()=>{
 const scene=await model();scene.updateMatrixWorld(true);const manifest=JSON.parse(await fs.readFile(new URL('../static/models/career-train-manifest.json',import.meta.url),'utf8'));
 assert.ok(manifest.bytes<=350000);assert.ok(manifest.triangles>10000,'model includes visible construction detail');
 for(const spec of CAREER_TRAIN.cars){
  const car=scene.getObjectByName(spec.name);assert.ok(car);const box=new THREE.Box3();
  car.traverse(mesh=>{if(!mesh.isMesh)return;const vertices=mesh.geometry.attributes.position;for(let n=0;n<vertices.count;n++)box.expandByPoint(car.worldToLocal(new THREE.Vector3().fromBufferAttribute(vertices,n).applyMatrix4(mesh.matrixWorld)));});
  assert.ok(Math.max(Math.abs(box.min.x),Math.abs(box.max.x))<spec.halfWidth+.002,`${spec.name} width ${box.min.x},${box.max.x}`);
  assert.ok(Math.max(Math.abs(box.min.z),Math.abs(box.max.z))<spec.halfLength+.002,`${spec.name} length ${box.min.z},${box.max.z}`);
  assert.ok(Math.abs(box.min.y)<.01,'wheels sit on the rail surface');
  if(spec.offset)assert.ok(box.max.y<1.6,'the coach is open above its low rail and bench backs');
 }
 const names=[];scene.traverse(o=>{if(!o.isMesh&&/^train-wheel-/.test(o.name))names.push(o.name);});assert.equal(names.length,10);
});

test('the actual wheel treads cover both shared rails through all curves and grades',async t=>{
 const train=fixture(),view=new CareerTrainVisual(new THREE.Scene(),train);t.after(()=>view.dispose());view.bind(await model());
 const railPoint=(distance,side)=>{const q=sampleTrainPath(train.path,distance),h=Math.hypot(q.tangentX,q.tangentZ),offset=side*train.railway.train.gauge/2;return new THREE.Vector3(q.x-q.tangentZ/h*offset,q.y,q.z+q.tangentX/h*offset);};
 for(let distance=0;distance<train.length;distance+=.5){
  train.distance=train.previousDistance=distance;view.update(1);
  for(const wheel of view.wheels){
   const object=wheel.object,car=object.parent,index=view.cars.indexOf(car),side=Math.sign(object.position.x),center=distance-CAREER_TRAIN.cars[index].offset-object.position.z;
   let low=center-.4,high=center+.4;
   for(let n=0;n<12;n++){const middle=(low+high)/2,p=car.worldToLocal(railPoint(middle,side));if(p.z>object.position.z)low=middle;else high=middle;}
   const contact=car.worldToLocal(railPoint((low+high)/2,side)),lateral=Math.abs(contact.x-object.position.x),vertical=Math.abs(contact.y-(object.position.y-wheel.radius));
   assert.ok(lateral<=.145,`${object.name} misses its rail laterally by ${lateral} at ${distance}`);
   assert.ok(vertical<.004,`${object.name} floats above its rail by ${vertical} at ${distance}`);
  }
 }
});

test('visual replacement preserves distance, passenger ownership, wheel phase, and graded seat orientation',async t=>{
 const scene=new THREE.Scene(),train=fixture(),view=new CareerTrainVisual(scene,train);t.after(()=>view.dispose());view.bind(await model());
 const avatar=new THREE.Mesh(new THREE.BoxGeometry(.3,.6,.3),new THREE.MeshBasicMaterial()),anchor=view.mountPoint;anchor.add(avatar);let disposed=false;avatar.geometry.addEventListener('dispose',()=>{disposed=true;});
 train.board();train.continue();train.step(8);view.update(.5);const seat=train.seatPose(.5);assert.ok(anchor.position.distanceTo(new THREE.Vector3(seat.x,seat.y,seat.z))<1e-7);
 const distance=train.distance,phase=view.wheels[0].object.rotation.x;view.bind(await model());assert.equal(view.mountPoint,anchor);assert.equal(avatar.parent,anchor);assert.equal(disposed,false);close(train.distance,distance);
 view.update(.5);close(view.wheels[0].object.rotation.x,phase);assert.equal(view.coupling.visible,true);assert.ok(view.coupling.scale.y>.2&&view.coupling.scale.y<1.5);
 for(let index=0;index<2;index++){const car=view.cars[index],pose=train.carPose(index,.5),forward=new THREE.Vector3(0,0,-1).applyQuaternion(car.quaternion);close(forward.y,Math.sin(pose.pitch));close(Math.atan2(-forward.x,-forward.z),Math.atan2(Math.sin(pose.yaw),Math.cos(pose.yaw)));}
 train.step(1,{paused:true});view.update(0,{frozen:true});const before=anchor.matrixWorld.clone();view.update(.7,{frozen:true});assert.deepEqual(anchor.matrixWorld.elements,before.elements);
});

test('crossing gates warn ahead of the engine, remain closed for the coach and release quality resources',t=>{
 const train=fixture(),spec=train.railway.crossings[0];spec.gates=[{node:'gate',axis:'z',openAngle:Math.PI/2,closedAngle:0}];spec.signals=[{node:'lamp'}];
 const scene=new THREE.Scene(),view=new CareerTrainVisual(scene,train);t.after(()=>view.dispose());
 const original=new THREE.MeshStandardMaterial({emissive:'#310d08',emissiveIntensity:.12}),island=new THREE.Group(),gate=new THREE.Group(),lamp=new THREE.Mesh(new THREE.SphereGeometry(.1),original);
 gate.name='gate';gate.rotation.z=Math.PI/2;lamp.name='lamp';island.add(gate,lamp);view.bindCrossings(island);const clone=lamp.material;assert.notEqual(clone,original);
 const at=distance=>{train.distance=train.previousDistance=distance;view.update(1);};
 at(spec.distance-15);close(gate.rotation.z,Math.PI/2);close(clone.emissiveIntensity,.12);
 at(spec.distance-13);close(gate.rotation.z,Math.PI/2);assert.equal(view.crossings[0].warning,'amber');
 at(spec.distance-9);assert.ok(gate.rotation.z>0&&gate.rotation.z<Math.PI/2);
 at(spec.distance-6);close(gate.rotation.z,0);assert.equal(view.crossings[0].warning,'red');
 at(spec.distance+7);assert.equal(gate.rotation.z,0,'coach is still crossing');
 train.step(0,{paused:true});const held=gate.rotation.z;view.update(.2,{frozen:true});close(gate.rotation.z,held);
 at(spec.distance+13);close(gate.rotation.z,Math.PI/2);close(clone.emissiveIntensity,.12);assert.equal(original.emissiveIntensity,.12,'shared island material remains untouched');
 let disposed=false;clone.addEventListener('dispose',()=>{disposed=true;});view.bindCrossings(null);assert.equal(lamp.material,original);assert.ok(disposed);close(gate.rotation.z,Math.PI/2);
});

test('both exported island qualities expose the actual animated crossing gates and lamps',async t=>{
 const train=fixture(),view=new CareerTrainVisual(new THREE.Scene(),train);t.after(()=>view.dispose());
 for(const quality of['','low/']){
  const bytes=await fs.readFile(new URL(`../static/models/${quality}experience.glb`,import.meta.url)),island=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
  view.bindCrossings(island);assert.equal(view.crossings.length,train.railway.crossings.length);
  for(const crossing of view.crossings){
   assert.equal(crossing.gates.length,2);assert.equal(crossing.signals.length,2);
   train.distance=train.previousDistance=crossing.spec.distance-6;view.update(1);assert.ok(crossing.gates.every(g=>Math.abs(g.object.rotation.z)<1e-7));assert.equal(crossing.warning,'red');
   train.distance=train.previousDistance=crossing.spec.distance+14;view.update(1);assert.ok(crossing.gates.every(g=>Math.abs(g.object.rotation.z-Math.PI/2)<1e-7));assert.equal(crossing.warning,'off');
  }
 }
});
