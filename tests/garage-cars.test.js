import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {GarageCarController,GARAGE_CARS,garageSpawn} from '../sources/core/garage-car.js';
import {IslandWalkWorld,localToWorld} from '../sources/core/character.js';
import {PlayerController} from '../sources/core/player.js';
import {landPrimaryAction} from '../sources/core/project-exhibits.js';
import * as THREE from 'three';
import {CameraRig,cameraAzimuth} from '../sources/core/camera.js';
import {islands} from '../sources/config.js';
const layout=JSON.parse(fs.readFileSync(new URL('../static/models/walk-layout.json',import.meta.url))).islands.find(i=>i.id==='about');
const island=islands.find(i=>i.id==='about');
async function fixture(){await R.init();const world=new R.World({x:0,y:0,z:0});world.timestep=1/60;const walk=new IslandWalkWorld(R,world,island,layout);const cars=GARAGE_CARS.map(c=>new GarageCarController(R,world,walk,garageSpawn(walk,c.bay),c));return{world,walk,cars,close(){for(const car of cars)car.dispose();world.free();}};}
const tick=(f,car,input,count)=>{for(let n=0;n<count;n++){car.step(input,1/60);f.world.step();car.afterStep();}};

test('all real garage bays fit whole cars and provide a safe walking dismount',async()=>{const f=await fixture();try{for(const car of f.cars){assert.ok(car.clearPose(car.position,car.yaw));assert.ok(car.dismountPoint());assert.equal(f.walk.clear(car.position,.24),false);assert.equal(car.parked,true);}}finally{f.close();}});
test('driving out through garage opening and reversing returns without teleporting or inter-car overlap',async()=>{const f=await fixture();try{for(const car of f.cars){car.park(false);tick(f,car,{throttle:1,steer:0},66);assert.ok(Math.hypot(car.position.x-car.spawn.x,car.position.z-car.spawn.z)>4.8);assert.ok(car.clearPose(car.position,car.yaw));tick(f,car,{throttle:-1,steer:0},140);assert.ok(car.clearPose(car.position,car.yaw));car.park(true);car.teleport(car.spawn);}}finally{f.close();}});
test('full footprint rejects the other parked car, house and pier and reset chooses another free bay',async()=>{const f=await fixture();try{const[a,b]=f.cars;assert.equal(a.clearPose(b.position,b.yaw),false);assert.equal(a.clearPose(localToWorld(island,layout.interiors.find(i=>i.landmarkId==='jack-house').bounds),island.rotation),false);assert.equal(a.clearPose(localToWorld(island,{x:0,z:(layout.dock.startZ+layout.dock.endZ)/2}),island.rotation),false);b.teleport(a.spawn);const safe=a.safeReset();assert.ok(safe);assert.ok(a.clearPose(safe,safe.yaw));assert.ok(Math.hypot(safe.x-a.spawn.x,safe.z-a.spawn.z)>3);assert.equal(a.dismountPoint()&&f.walk.clear(a.dismountPoint()),true);}finally{f.close();}});
test('car-wall contact retains last valid position and can reverse away',async()=>{const f=await fixture();try{const car=f.cars[0];car.park(false);tick(f,car,{throttle:-1,steer:0},180);const p={...car.position};assert.ok(car.clearPose(p,car.yaw));assert.ok(Math.hypot(p.x-car.spawn.x,p.z-car.spawn.z)>.15);tick(f,car,{throttle:1,steer:0},55);assert.ok(Math.hypot(car.position.x-p.x,car.position.z-p.z)>2);}finally{f.close();}});
for(const fps of[30,60,120])test(`car parking, fixed-step movement and release at ${fps} FPS`,async()=>{const f=await fixture();try{const car=f.cars[0];car.park(false);let acc=0;for(let n=0;n<fps;n++){acc+=1/fps;while(acc>=1/60-1e-9){tick(f,car,{throttle:1,steer:0},1);acc-=1/60;}car.updateVisual(1/fps,false,Math.max(0,acc*60));}assert.ok(Math.abs(Math.hypot(car.position.x-car.spawn.x,car.position.z-car.spawn.z)-4.5117)<.03);car.park(true);const p={...car.position},yaw=car.yaw,angle=car.wheelAngle;for(let n=0;n<fps*2;n++){tick(f,car,{throttle:0,steer:0},1);car.updateVisual(1/fps,false,(n%7)/7);assert.deepEqual({...car.position},p);assert.equal(car.yaw,yaw);assert.equal(car.wheelAngle,angle);assert.equal(car.speed,0);}}finally{f.close();}});
test('car actor, E priority, pause, travel and island camera retain existing vehicles',()=>{const character={enable(){},teleport(){},walkWorld:{}};const p=new PlayerController({},character);p.mode='walking';const car={id:'911',label:'Porsche 911'};assert.equal(landPrimaryAction({player:p,nearCar:car,nearStation:{kind:'read'}}).kind,'mount-car');p.pauseReasons.add('read');assert.equal(p.rideCar(car),false);p.pauseReasons.clear();assert.ok(p.rideCar(car));assert.equal(p.activeActor,car);assert.equal(landPrimaryAction({player:p}).kind,'dismount-car');assert.equal(cameraAzimuth({locomotion:'car',landAzimuth:Math.PI}),Math.PI);assert.equal(p.rideCar(car),false);p.pauseReasons.add('hidden');assert.equal(p.leaveCar({}),false);p.pauseReasons.clear();assert.ok(p.leaveCar({x:0,z:0}));assert.equal(p.activeActor,character);p.rideCar(car);p.toSailing();assert.equal(p.mode,'sailing');assert.equal(p.activeVehicle,null);assert.equal(p.car,car);});

test('portrait car framing keeps all full car bounds clear of the expanded minimap',()=>{
 for(const config of GARAGE_CARS)for(const zoom of[0,1,2])for(const yaw of[0,Math.PI/2,Math.PI,Math.PI*1.5]){
  const camera=new THREE.PerspectiveCamera(),rig=new CameraRig(camera,{walkZoom:zoom},390,844);
  rig.update(1/60,{position:{x:0,y:.85,z:0},yaw,locomotion:'car',landAzimuth:Math.PI},true);camera.updateMatrixWorld(true);
  const points=[];for(const x of[-config.width/2,config.width/2])for(const z of[-(config.length??4.7)/2,(config.length??4.7)/2])for(const y of[.85,.85+config.height]){
   const v=new THREE.Vector3(x,y-.85,z).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);v.y+=.85;v.project(camera);points.push({x:(v.x+1)*195,y:(1-v.y)*422});
  }
  assert.ok(points.every(p=>p.x>5&&p.x<385&&p.y>195&&p.y<490),JSON.stringify({config:config.id,zoom,yaw,points}));
 }
});
