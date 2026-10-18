import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {CareerTrainController,CAREER_TRAIN,CAREER_TRAIN_MOTION} from '../sources/core/career-train.js';
import {CareerTrainVisual} from '../sources/world/career-train.js';
import {sampleTrainPath,trainPathLength,trainPlanLength,trainDistanceAtPlan,trainTrackPoints,sampleTrainMotion} from '../sources/core/train-path.js';
import {careerRailway} from '../scripts/lib/career-railway-layout.mjs';

const DT=1/60,close=(a,b,epsilon=1e-7)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
const fixture=options=>new CareerTrainController(careerRailway(),options);
function arrive(train,options={}){
 for(let n=0;n<12000;n++){
  const before=train.distance,odometer=train.odometer;train.step(DT,options);
  assert.ok(Math.abs(train.distance-before)<=train.motion.cruiseSpeed*DT+1e-6,'no movement teleport');assert.ok(train.odometer>=odometer);
  if(!train.closed)assert.ok(train.distance>=train.minDistance-1e-8&&train.distance<=train.maxDistance+1e-8,'cabin remains between terminal stops');
  if(train.state==='stopped')return(n+1)*DT;
 }assert.fail(`train failed to arrive: ${JSON.stringify(train.status())}`);
}
function legacyRailway(){
 const path={center:[0,.95,0],halfStraight:16,radius:8};
 return{path,stations:['harbor','visionx','beaconfire','amtrak'].map((id,i)=>({id,distance:[6,29,62,90][i]})),crossings:[]};
}
async function model(){const bytes=await fs.readFile(new URL('../static/models/career-train.glb',import.meta.url));return(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;}

test('open funicular sampling clamps both endpoints and measures physical arc length',()=>{
 const railway=careerRailway(),path=railway.path,length=trainPathLength(path),first=sampleTrainPath(path,0),last=sampleTrainPath(path,length);
 assert.equal(path.closed,false);close(length,45.13131878764413);close(trainPlanLength(path),40.03162132982823);
 for(const [d,want]of[[-100,first],[length+100,last]])assert.deepEqual(sampleTrainPath(path,d),want);
 assert.deepEqual([first.x,first.y,first.z],path.from);for(const[k,i]of[['x',0],['y',1],['z',2]])close(last[k],path.to[i]);
 close(trainDistanceAtPlan(path,trainPlanLength(path)/2),length/2);close(first.pitch,27.500954992363763*Math.PI/180);
 const points=trainTrackPoints({path});assert.equal(points.length,129);assert.deepEqual(points[0],first);assert.deepEqual(points.at(-1),last);
 assert.ok(Math.abs(points.at(-1).z-points[0].z)>40,'map cannot join upper terminal back to lower terminal');
});

test('authored open plan segments clamp while legacy stadium and ellipse motion still wrap',()=>{
 const path={closed:false,planSegments:[{type:'line',from:[0,0],to:[0,-10],start:0,end:10}],elevation:[{start:0,end:10,y0:2,y1:7,ease:0}]},length=trainPathLength(path);
 close(sampleTrainPath(path,length).z,-10);close(sampleTrainPath(path,length+2).y,7);close(sampleTrainPath(path,-2).z,0);
 const stadium=legacyRailway().path,L=trainPathLength(stadium);assert.deepEqual(sampleTrainPath(stadium,-2),sampleTrainPath(stadium,L-2));assert.deepEqual(sampleTrainPath(stadium,L),sampleTrainPath(stadium,0));
 const legacy={trackCentre:[3,0,-8],trackRadii:[4,2]},a=sampleTrainMotion(legacy,0,12),b=sampleTrainMotion(legacy,12,12);close(a.x,b.x);close(a.z,b.z);
});

test('single cabin ascends chronologically, descends directly and meets the 24.6 second motion budget',()=>{
 const train=fixture();assert.equal(train.currentStation.id,'harbor');assert.equal(train.continue(),false);assert.equal(train.board('visionx'),false);assert.equal(train.board(),true);
 let seconds=0;const legs=[];
 for(const stop of['visionx','beaconfire','amtrak','harbor']){
  assert.equal(train.nextStation.id,stop);assert.equal(train.continue(),true);assert.equal(train.leave(),false);assert.equal(train.call('harbor'),false);
  let frames=0;
  while(train.state!=='stopped'&&frames<3000){const speed=train.speed;train.step(DT);frames++;assert.ok(train.speed-speed<=CAREER_TRAIN_MOTION.acceleration*DT+1e-8);assert.ok(speed-train.speed<=CAREER_TRAIN_MOTION.braking*DT+1e-8,'arrival reaches zero smoothly');}
  assert.equal(train.currentStation?.id,stop);close(train.speed,0);close(train.distance,train.targetDistance);legs.push(frames*DT);seconds+=frames*DT;
 }
 assert.ok(seconds>24.4&&seconds<24.8,`${seconds}: ${legs}`);close(train.distance,train.minDistance);close(train.odometer,2*(train.maxDistance-train.minDistance),1e-5);close(train.wheelDistance,0,1e-5);
 assert.equal(train.passenger,true);const stopped=train.distance;train.step(60);close(train.distance,stopped);assert.equal(train.nextStation.id,'visionx');
});

test('an empty call works in either direction without boarding or visiting intermediate stops',()=>{
 const train=fixture();assert.equal(train.call('amtrak'),true);assert.ok(train.eta>0);arrive(train);assert.equal(train.passenger,false);
 assert.equal(train.call('visionx'),true);const before=train.distance;assert.equal(train.direction,-1);arrive(train);assert.equal(train.currentStation.id,'visionx');assert.ok(train.distance<before);
 assert.equal(train.board(),true);assert.equal(train.direction,1);assert.equal(train.nextStation.id,'beaconfire');
});

test('a moving return brakes at the configured rate before reversing with a stable cabin heading',()=>{
 const train=fixture();train.call('amtrak');train.step(3);close(train.speed,train.motion.cruiseSpeed);const distance=train.distance,yaw=train.yaw;
 train.cancelRide();assert.equal(train.state,'reversing');assert.equal(train.direction,1);assert.equal(train.targetStationId,'harbor');assert.equal(train.distance,distance);
 let braking=0,last=train.distance;
 while(train.direction===1&&braking<180){const old=train.speed;train.step(DT);braking++;close(train.yaw,yaw);assert.ok(old-train.speed<=train.motion.braking*DT+1e-8);if(train.direction===1){assert.ok(train.distance>=last);last=train.distance;}else assert.ok(train.speed<=train.motion.acceleration*DT+1e-8);}
 const expectedFrames=Math.ceil(train.motion.cruiseSpeed/train.motion.braking/DT);assert.ok(braking>=expectedFrames&&braking<=expectedFrames+2,`reversal took ${braking} frames`);close(last-distance,train.motion.cruiseSpeed**2/(2*train.motion.braking),.001);assert.equal(train.direction,-1);arrive(train);assert.equal(train.currentStation.id,'harbor');
});

test('returns requested close to the upper terminal stop before the endpoint and reverse without snapping',()=>{
 const train=fixture();train.call('amtrak');while(train.maxDistance-train.distance>1)train.step(DT);const start=train.distance;
 train.returnToHarbor();assert.equal(train.reversing,true);let maximum=start;
 while(train.reversing){const speed=train.speed;train.step(DT);maximum=Math.max(maximum,train.distance);assert.ok(speed-train.speed<=train.motion.braking*DT+1e-8);assert.ok(maximum<=train.maxDistance+1e-8);}
 arrive(train);assert.equal(train.currentStation.id,'harbor');
});

test('pause preserves return intent and resumes a pending reversal in the correct direction from rest',()=>{
 const train=fixture();train.call('amtrak');train.step(3);train.returnToHarbor();train.step(.5);const distance=train.distance,target=train.targetDistance;
 train.step(60,{paused:true});close(train.distance,distance);close(train.previousDistance,distance);close(train.speed,0);close(train.targetDistance,target);assert.equal(train.reversing,true);
 assert.equal(train.board(),false);train.step(DT,{paused:false});assert.equal(train.direction,-1);assert.ok(train.distance<distance);assert.ok(train.speed<=train.motion.acceleration*DT+1e-8);arrive(train);
 const a=fixture(),b=fixture();a.call('amtrak');b.call('amtrak');a.step(8);for(let n=0;n<480;n++)b.step(DT);close(a.distance,b.distance,1e-6);
});

test('opaque preparation clears every motion/interpolation field without adding odometry or wheel spin',()=>{
 const train=fixture();train.call('amtrak');train.step(3);train.cancelRide();train.step(.5);const odometer=train.odometer,wheels=train.wheelDistance;
 assert.equal(train.parkAtStation('amtrak'),true);close(train.distance,train.maxDistance);close(train.previousDistance,train.distance);close(train.targetDistance,train.distance);assert.equal(train.direction,-1);
 assert.equal(train.reversing,false);assert.equal(train.reverseDirection,null);assert.equal(train.targetStationId,null);assert.equal(train.mission,null);close(train.speed,0);close(train.odometer,odometer);close(train.wheelDistance,wheels);close(train.previousWheelDistance,wheels);
 assert.deepEqual(train.velocity,{x:0,y:0,z:0});assert.deepEqual(train.carPose(0,0),train.carPose(0,1));train.board();assert.equal(train.parkAtStation('harbor'),false);
});

test('level cabin and downhill-facing seat retain their world pose in both travel directions',()=>{
 const island={x:-76,y:2,z:8,rotation:1.17},train=fixture({island});assert.equal(train.cars.length,1);assert.equal(train.passengerCarIndex,0);
 for(const distance of[train.minDistance,20,train.maxDistance])for(const direction of[-1,1]){
  train.previousDistance=train.distance=distance;train.direction=direction;const car=train.carPose(0),rail=sampleTrainPath(train.path,distance),seat=train.seatPose();
  close(car.pitch,0);close(car.bodyPitch,0);close(car.trackPitch,rail.pitch);close(car.y,island.y+rail.y);close(seat.y,car.y+CAREER_TRAIN.seatPosition[1]);close(seat.pitch,0);close(seat.yaw,car.yaw+Math.PI);close(train.position.y,car.y+1.65);
 }
});

for(const direction of[1,-1])test(`pedestrian protection sweeps toward direction ${direction} and releases from rest`,()=>{
 const train=fixture();if(direction<0)train.parkAtStation('amtrak');train.call(direction>0?'amtrak':'harbor');train.step(3);
 const pedestrianDistance=train.distance+direction*7,p=sampleTrainPath(train.path,pedestrianDistance);p.y+=train.spec.floorY;
 let stopped=false;for(let n=0;n<1200;n++){train.step(DT,{pedestrians:[p]});if(train.state==='waiting-crossing'){stopped=true;break;}}
 assert.equal(stopped,true);const distance=train.distance;assert.equal(train.intersectsPedestrian(distance,p),false);train.step(2,{pedestrians:[p]});close(train.distance,distance);close(train.speed,0);
 train.step(DT,{pedestrians:[]});assert.equal(train.state,'moving');assert.ok(train.speed<=train.motion.acceleration*DT+1e-8);arrive(train);
});

test('a platform visitor or person on another terrace does not block the cabin',()=>{
 for(const kind of['platform','other-level']){const train=fixture(),point=kind==='platform'?train.stations[1].boarding:{...sampleTrainPath(train.path,20),y:-10};train.call('amtrak');arrive(train,{pedestrians:[point]});assert.equal(train.currentStation.id,'amtrak');}
});

test('legacy closed controller still travels forward across its seam and keeps crossings safe',()=>{
 const railway=legacyRailway(),train=new CareerTrainController(railway);train.board();
 for(const id of['visionx','beaconfire','amtrak','harbor']){const before=train.distance;assert.equal(train.nextStation.id,id);train.continue();arrive(train);assert.ok(train.distance>before);assert.equal(train.direction,1);}
 assert.ok(train.distance>train.length);train.previousDistance=train.length-.02;train.distance=train.length+.02;const a=train.carPose(0,0),b=train.carPose(0,1);assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<.041);
 const crossingTrain=new CareerTrainController(legacyRailway()),q=sampleTrainPath(crossingTrain.path,16);q.y+=crossingTrain.spec.floorY;
 crossingTrain.railway.crossings=[{distance:16,width:4,y:q.y,polygon:[[q.x-2,q.z-2],[q.x+2,q.z-2],[q.x+2,q.z+2],[q.x-2,q.z+2]]}];crossingTrain.call('amtrak');
 for(let n=0;n<1200&&crossingTrain.state!=='waiting-crossing';n++)crossingTrain.step(DT,{pedestrians:[q]});
 assert.equal(crossingTrain.state,'waiting-crossing');assert.ok(crossingTrain.distance+crossingTrain.cars[0].halfLength<14-.3);arrive(crossingTrain);
});

test('detailed cabin asset fits the shared envelope and exposes four independently animated wheels',async()=>{
 const scene=await model();scene.updateMatrixWorld(true);const manifest=JSON.parse(await fs.readFile(new URL('../static/models/career-train-manifest.json',import.meta.url),'utf8'));
 assert.ok(manifest.bytes<=350000);
 for(const spec of CAREER_TRAIN.cars){const car=scene.getObjectByName(spec.name);assert.ok(car);const box=new THREE.Box3();car.traverse(mesh=>{if(!mesh.isMesh)return;const positions=mesh.geometry.attributes.position;for(let n=0;n<positions.count;n++)box.expandByPoint(car.worldToLocal(new THREE.Vector3().fromBufferAttribute(positions,n).applyMatrix4(mesh.matrixWorld)));});assert.ok(Math.max(Math.abs(box.min.x),Math.abs(box.max.x))<spec.halfWidth+.025);assert.ok(Math.max(Math.abs(box.min.z),Math.abs(box.max.z))<spec.halfLength+.025);assert.ok(box.max.y>3,'full cabin has usable headroom');}
 const names=[];scene.traverse(o=>{if(!o.isMesh&&/^train-wheel-/.test(o.name))names.push(o.name);});assert.equal(names.length,4);
});

test('visual replacement preserves single Jack, reverse wheel phase and level passenger mount',async t=>{
 const scene=new THREE.Scene(),train=fixture(),view=new CareerTrainVisual(scene,train);t.after(()=>view.dispose());view.bind(await model());
 const avatar=new THREE.Mesh(new THREE.BoxGeometry(.3,.6,.3),new THREE.MeshBasicMaterial()),anchor=view.mountPoint;anchor.add(avatar);let disposed=false;avatar.geometry.addEventListener('dispose',()=>{disposed=true;});
 train.parkAtStation('amtrak');train.board();train.continue();train.step(3);view.update(.5);const seat=train.seatPose(.5);assert.ok(anchor.position.distanceTo(new THREE.Vector3(seat.x,seat.y,seat.z))<1e-7);close(anchor.rotation.x,0);
 const distance=train.distance,phase=view.wheels[0].object.rotation.x;view.bind(await model());assert.equal(view.mountPoint,anchor);assert.equal(avatar.parent,anchor);assert.equal(disposed,false);close(train.distance,distance);view.update(.5);close(view.wheels[0].object.rotation.x,phase);assert.equal(view.cars.length,1);assert.equal(view.coupling.visible,false);
 train.step(1,{paused:true});view.update(0,{frozen:true});const before=anchor.matrixWorld.clone();view.update(.7,{frozen:true});assert.deepEqual(anchor.matrixWorld.elements,before.elements);
});

test('a late empty-call target inside braking distance is reached by a smooth stop and reversal',()=>{
 const train=fixture();train.call('amtrak');const station=train.stations[1];while(station.distance-train.distance>1.5)train.step(DT);close(train.speed,train.motion.cruiseSpeed);
 train.call('visionx');assert.equal(train.reversing,true);let overshot=false,reversed=false;
 for(let n=0;n<1000&&train.state!=='stopped';n++){const speed=train.speed;train.step(DT);assert.ok(speed-train.speed<=train.motion.braking*DT+1e-8,'retarget cannot snap to a nearby platform');overshot ||=train.distance>station.distance;reversed ||=train.direction===-1;}
 assert.ok(overshot&&reversed);assert.equal(train.currentStation.id,'visionx');close(train.distance,station.distance);
});

test('repeated cancel and pause during a reversal preserve its destination and cannot remount a passenger',()=>{
 const train=fixture();train.board();train.continue();train.step(3);train.cancelRide();train.step(.2);const before=train.distance;
 train.cancelRide();train.step(0,{paused:true});train.cancelRide();assert.equal(train.distance,before);assert.equal(train.targetStationId,'harbor');assert.equal(train.passenger,false);
 train.step(DT,{paused:false});assert.equal(train.direction,-1);assert.ok(train.distance<before);arrive(train);assert.equal(train.currentStation.id,'harbor');assert.equal(train.passenger,false);
});

test('legacy multi-car specifications retain independent offsets and select their authored passenger car',()=>{
 const cars=[{name:'engine',offset:0,halfLength:1.85,halfWidth:.93,wheelRadius:.42},{name:'coach',offset:4.3,halfLength:1.8,halfWidth:.93,wheelRadius:.36}],spec={...CAREER_TRAIN,cars,passengerCarIndex:1,floorY:.6,seatPosition:[0,1.12,-.65],seatYawOffset:0};
 const train=new CareerTrainController({...legacyRailway(),train:{spec}});train.distance=train.previousDistance=40;
 const a=train.carPose(0),b=train.carPose(1),expected=sampleTrainPath(train.path,40-4.3);assert.ok(Math.abs(a.yaw-b.yaw)>.1);close(b.x,expected.x);close(b.z,expected.z);close(train.position.x,b.x);close(train.position.y,b.y+.6);
});

test('legacy crossing animation keeps gates and cloned signal materials correct through release and replacement',t=>{
 const railway=legacyRailway(),q=sampleTrainPath(railway.path,16),spec={distance:16,width:4,y:q.y,gates:[{node:'gate',axis:'z',openAngle:Math.PI/2,closedAngle:0}],signals:[{node:'lamp'}]};railway.crossings=[spec];
 const train=new CareerTrainController(railway),scene=new THREE.Scene(),view=new CareerTrainVisual(scene,train);t.after(()=>view.dispose());
 const original=new THREE.MeshStandardMaterial({emissive:'#310d08',emissiveIntensity:.12}),island=new THREE.Group(),gate=new THREE.Group(),lamp=new THREE.Mesh(new THREE.SphereGeometry(.1),original);gate.name='gate';gate.rotation.z=Math.PI/2;lamp.name='lamp';island.add(gate,lamp);view.bindCrossings(island);const clone=lamp.material;assert.notEqual(clone,original);
 const at=distance=>{train.distance=train.previousDistance=distance;view.update(1);};at(1);close(gate.rotation.z,Math.PI/2);at(7);assert.ok(gate.rotation.z>0&&gate.rotation.z<Math.PI/2);at(10);close(gate.rotation.z,0);assert.equal(view.crossings[0].warning,'red');at(19);close(gate.rotation.z,0);at(28);close(gate.rotation.z,Math.PI/2);close(clone.emissiveIntensity,.12);
 let disposed=false;clone.addEventListener('dispose',()=>{disposed=true;});view.bindCrossings(null);assert.equal(lamp.material,original);assert.ok(disposed);close(gate.rotation.z,Math.PI/2);
});
