import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {islands} from '../sources/config.js';
import {IslandWalkWorld,CharacterController,localToWorld} from '../sources/core/character.js';
import {dockLocal} from '../sources/core/dock.js';
import {BicycleController,BICYCLE,bicycleFootprintClear} from '../sources/core/bicycle.js';
import {PlayerController,BoardingController} from '../sources/core/player.js';
import {Game} from '../sources/game.js';

const DT=1/60,education=islands.find(island=>island.id==='education');
const layout=JSON.parse(fs.readFileSync(new URL('../static/models/walk-layout.json',import.meta.url))).islands.find(island=>island.id==='education');
const drive={throttle:1,steer:0},noInput={throttle:0,steer:0};
await R.init();

function fixture(){
 const world=new R.World({x:0,y:0,z:0});world.timestep=DT;
 const walk=new IslandWalkWorld(R,world,education,layout),spawn=localToWorld(education,{...BICYCLE.localSpawn,y:layout.groundY});
 const bike=new BicycleController(R,world,walk,spawn);
 world.propagateModifiedBodyPositionsToColliders();world.updateSceneQueries();
 return{world,walk,bike,spawn,dispose(){bike.dispose();world.free();}};
}
function tick(f,input=noInput){f.bike.step(input,DT);f.world.step();f.bike.afterStep();}
function relocate(f,x,z,yaw=0){
 const p=localToWorld(education,{x,z,yaw,y:layout.groundY});
 assert.ok(bicycleFootprintClear(f.walk,p,p.yaw),`valid bicycle staging point ${x}, ${z}`);
 f.bike.teleport(p);f.bike.park(false);return p;
}
const near=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);

// A small named articulation fixture isolates controller timing; imported mesh
// preservation and rider contacts are covered by the asset/rider tests.
function articulation(){
 const model=new THREE.Group();model.userData.bicycleRig={wheelRadius:BICYCLE.wheelRadius};
 const add=(name,parent=model)=>{const node=new THREE.Group();node.name=name;parent.add(node);return node;};
 const steering=add('bicycle-steering');add('bicycle-wheel-front',steering);add('bicycle-wheel-rear');
 const crank=add('bicycle-crank'),left=add('bicycle-pedal-left',crank),right=add('bicycle-pedal-right',crank);
 add('bicycle-pedal-contact-left',left).position.set(-.145,.02,0);add('bicycle-pedal-contact-right',right).position.set(.145,.02,0);
 add('bicycle-grip-left',steering).position.set(-.2,.85,-.17);add('bicycle-grip-right',steering).position.set(.2,.85,-.17);
 add('bicycle-saddle-top').position.set(0,.565,.1);
 return model;
}

test('bicycle parks immediately inland of Education bridge, with both landing paths and an islandward exit clear',()=>{
 const f=fixture();try{
  const local=dockLocal(f.spawn,education);
  assert.ok(local.z<layout.dock.startZ&&local.z>layout.dock.startZ-3,'parking belongs to the bridgehead plaza rather than the pier water');
  assert.ok(local.x>2&&local.x<5,'parking leaves the bridge centerline open');
  for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8)assert.ok(bicycleFootprintClear(f.walk,f.spawn,angle));
  for(let z=local.z;z>12;z-=.2)assert.ok(bicycleFootprintClear(f.walk,localToWorld(education,{x:local.x,z}),education.rotation));
  for(const berth of layout.berths)for(let z=berth.landing.z;z>=18;z-=.2)assert.ok(f.walk.clear(localToWorld(education,{x:berth.landing.x,z}),.24));
  assert.equal(f.bike.group.getObjectByName('quad-chibi-footrests'),undefined,'no ATV geometry is added to the bicycle');
  assert.ok(f.bike.dismountPoint(),'initial parking leaves a safe place to stand');
 }finally{f.dispose();}
});

test('boosting into the actual Education shoreline stops the full bicycle and reversing leaves the edge',()=>{
 const f=fixture();try{
  relocate(f,23.5,0,-Math.PI/2);
  let rescues=0;const teleport=f.bike.teleport.bind(f.bike);f.bike.teleport=(...args)=>{rescues++;return teleport(...args);};
  for(let n=0;n<300;n++){tick(f,{...drive,boost:true});assert.ok(bicycleFootprintClear(f.walk,f.bike.position,f.bike.yaw));}
  const contact={...f.bike.position};assert.ok(contact.x>25&&contact.x<27);assert.equal(rescues,0);
  const crank=f.bike.crankAngle;for(let n=0;n<30;n++)tick(f,{...drive,boost:true});near(f.bike.crankAngle,crank);
  for(let n=0;n<80;n++)tick(f,{throttle:-1,steer:0});
  assert.ok(f.bike.position.x<contact.x-1.8,'reverse escapes without teleporting to the parking space');assert.equal(rescues,0);
 }finally{f.dispose();}
});

for(const steer of[0,.2])test(`Hamerschlag contact ${steer?'at an angle':'head on'} blocks penetration and lets the bicycle reverse out`,()=>{
 const f=fixture();try{
  relocate(f,12,-4);let rescues=0;const teleport=f.bike.teleport.bind(f.bike);f.bike.teleport=(...args)=>{rescues++;return teleport(...args);};
  for(let n=0;n<100;n++)tick(f,{...drive,steer:n<10?steer:0});
  const contact={...f.bike.position},local=dockLocal(contact,education);
  assert.ok(local.z>-7.2+BICYCLE.collisionHalfLength-.02,'front wheel remains outside the actual rotunda wall');
  assert.ok(bicycleFootprintClear(f.walk,contact,f.bike.yaw));assert.equal(rescues,0);
  const cadence=f.bike.crankAngle;for(let n=0;n<30;n++)tick(f,drive);near(f.bike.crankAngle,cadence,1e-4);
  for(let n=0;n<65;n++)tick(f,{throttle:-1,steer:0});
  assert.ok(f.bike.position.z>contact.z+1.5);assert.equal(rescues,0);assert.ok(f.bike.dismountPoint());
 }finally{f.dispose();}
});

// This follows the existing campus circulation with ordinary production throttle
// and steering. No per-corner teleports or direct position writes are used.
const campusLoop=[[3.2,18.3],[0,12],[0,10.8],[-12.1,10.8],[-12.1,3.5],[-10.6,3.5],[-10.6,-3],[-17,-3],[-17,-8.5],[-10.6,-8.5],[-10.6,-16.5],[-2.6,-16.5],[-2.6,-18.5],[2.6,-18.5],[2.6,-14],[4.3,-14],[4.3,-7],[7,-5.8],[9,-5.8],[9,-2.35],[5.5,-2.35],[5.5,10.8],[0,10.8],[0,18],[3.2,18.3]];
for(const reverse of[false,true])test(`actual bicycle completes Education ${reverse?'clockwise':'counterclockwise'}, including both Duan doors, without a rescue`,()=>{
 const f=fixture();try{
  f.bike.park(false);let rescues=0;const teleport=f.bike.teleport.bind(f.bike);f.bike.teleport=(...args)=>{rescues++;return teleport(...args);};
  const route=reverse?[...campusLoop].reverse():campusLoop;
  for(const[x,z]of route.slice(1)){
   const target=localToWorld(education,{x,z});let reached=false;
   for(let frame=0;frame<2400;frame++){
    const p=f.bike.position,dx=target.x-p.x,dz=target.z-p.z,distance=Math.hypot(dx,dz);
    if(distance<.25){reached=true;break;}
    const desired=Math.atan2(-dx,-dz),error=Math.atan2(Math.sin(desired-f.bike.yaw),Math.cos(desired-f.bike.yaw));
    tick(f,{throttle:Math.abs(error)>1?.13:Math.abs(error)>.4?.2:.35,steer:Math.max(-1,Math.min(1,error*3))});
    assert.ok(bicycleFootprintClear(f.walk,f.bike.position,f.bike.yaw),`complete wheel footprint at ${x}, ${z}`);
    near(f.bike.position.y,f.walk.groundAt(f.bike.position),1e-5);
   }
   assert.ok(reached,`ride to ${x}, ${z}, reached ${JSON.stringify(dockLocal(f.bike.position,education))}`);
  }
  assert.equal(rescues,0);assert.ok(f.bike.distanceTravelled>120);assert.ok(f.bike.dismountPoint());
 }finally{f.dispose();}
});

for(const fps of[30,60,120])test(`bicycle wheels and cranks remain exactly parked after a moving dismount at ${fps} FPS`,()=>{
 const f=fixture();try{
  f.bike.setModel(articulation());f.bike.park(false);
  for(let n=0;n<45;n++)tick(f,{...drive,steer:.3});
  assert.ok(f.bike.speed>2);assert.ok(f.bike.crankAngle>0);f.bike.park(true);f.bike.updateVisual(0,false,.35);
  const position=f.bike.group.position.clone(),rotation=f.bike.group.quaternion.clone(),wheels=f.bike.wheelPivots.map(w=>w.quaternion.clone()),crank=f.bike.crankNode.quaternion.clone(),cadence=f.bike.crankAngle;
  for(let frame=0;frame<fps*2;frame++){
   tick(f);f.bike.updateVisual(1/fps,false,(frame%11)/11);
   assert.ok(f.bike.group.position.distanceTo(position)<1e-8);assert.ok(f.bike.group.quaternion.angleTo(rotation)<1e-7);
   f.bike.wheelPivots.forEach((wheel,n)=>assert.ok(wheel.quaternion.angleTo(wheels[n])<1e-7));
   assert.ok(f.bike.crankNode.quaternion.angleTo(crank)<1e-7);near(f.bike.crankAngle,cadence);assert.equal(f.bike.speed,0);
  }
  f.bike.park(false);tick(f);f.bike.updateVisual(DT,false,.2);assert.ok(f.bike.group.position.distanceTo(position)<1e-7);
 }finally{f.dispose();}
});

test('holding the bicycle cancels queued movement and crank interpolation before resume',()=>{
 const f=fixture();try{
  f.bike.setModel(articulation());f.bike.park(false);for(let n=0;n<45;n++)tick(f,{...drive,steer:.15});
  const p={...f.bike.position},yaw=f.bike.yaw,crank=f.bike.crankAngle;
  f.bike.step({...drive,steer:1},DT);f.bike.hold();f.world.step();
  for(const alpha of[0,.7,.2,1]){f.bike.updateVisual(DT,false,alpha);near(f.bike.group.position.x,p.x);near(f.bike.group.position.z,p.z);near(f.bike.group.rotation.y,yaw);near(f.bike.visualCrankAngle,crank);}
  tick(f);assert.equal(f.bike.speed,0);near(f.bike.crankAngle,crank);
 }finally{f.dispose();}
});

test('30, 60 and 120 FPS produce the same Education travel, heading, wheel roll and pedal cadence',()=>{
 const results=[];
 for(const fps of[30,60,120]){
  const f=fixture();try{
   f.bike.park(false);let accumulator=0,steps=0;
   for(let frame=0;frame<fps*3;frame++){
    accumulator+=1/fps;
    while(accumulator+1e-10>=DT){tick(f,{throttle:1,steer:steps<60?.2:-.15,boost:steps>=120});accumulator-=DT;steps++;}
    f.bike.updateVisual(1/fps,false,Math.max(0,accumulator/DT));
   }
   assert.equal(steps,180);results.push({...f.bike.position,yaw:f.bike.yaw,wheel:f.bike.wheelAngle,crank:f.bike.crankAngle,distance:f.bike.distanceTravelled});
  }finally{f.dispose();}
 }
 assert.ok(results[0].distance>5);for(const result of results.slice(1))for(const key of Object.keys(result))near(result[key],results[0][key],1e-6);
});

function gameFixture(){
 const f=fixture(),character=new CharacterController(R,f.world);
 character.teleport(localToWorld(education,{x:4.5,z:18.3}),f.walk);character.enable(true);
 const boat={position:{x:0,y:.35,z:0},yaw:0,velocity:{x:0,y:0,z:0},hold(){this.velocity={x:0,y:0,z:0};},park(value){this.parked=value;},snapshot(){return{position:{...this.position}};},teleport(point){this.position={...point};this.yaw=point.yaw||0;}};
 const player=new PlayerController(boat,character);player.mode='walking';player.island=education;player.berth={landing:localToWorld(education,layout.berths[0].landing)};player.rideBicycle(f.bike);f.bike.park(false);
 const inputs={enabled:true,keys:new Set(['KeyW']),setEnabled(value){this.enabled=value;this.keys.clear();}};
 const quad={parked:true,position:{x:49,y:.85,z:10.5},park(value){this.parked=value;},hold(){assert.fail('Education pause must not hold the Projects quad');}};
 const game=Object.assign(Object.create(Game.prototype),{player,character,boat,bicycle:f.bike,quadBike:quad,inputs,mode:'exploring',focus:null,loaded:new Map(),accumulator:DT*.5,props:{snapshot:()=>[],resetCargo(){},resetNear(){}},challenges:{epoch:0,frozen:false,active:false,pause(){},cancel(){this.epoch++;}},events:{trigger(){}},feedback:{clear(){}},clearWake(){},resetCamera(){},syncCameraTransition(){},safePoint:p=>p,updateNearby(){}});
 game.boarding=new BoardingController(player);
 return{...f,game,character,quad};
}

test('Education reading and background pause hold the real bicycle until all reasons close, without restoring old input',()=>{
 const f=gameFixture();try{
  for(let n=0;n<35;n++)tick(f,drive);const p={...f.bike.position},crank=f.bike.crankAngle;
  f.game.pause('read',{id:'education',schoolId:'bu'});assert.equal(f.bike.speed,0);assert.equal(f.game.frozen,true);assert.equal(f.game.inputs.keys.size,0);
  f.game.pause('hidden',f.game.focus);f.game.resume('read');assert.equal(f.game.frozen,true);assert.equal(f.game.mode,'hidden');
  f.game.resume('hidden');assert.equal(f.game.frozen,false);assert.equal(f.game.player.ridingBicycle,true);
  tick(f);near(f.bike.position.x,p.x);near(f.bike.position.z,p.z);near(f.bike.crankAngle,crank);
  assert.deepEqual(f.quad.position,{x:49,y:.85,z:10.5});
 }finally{f.dispose();}
});

test('Travel while a bicycle reader is open parks both vehicles and cannot revive cycling when the old reader closes',()=>{
 const f=gameFixture();try{
  for(let n=0;n<25;n++)tick(f,drive);const bicyclePosition={...f.bike.position};
  f.game.pause('read',{id:'education',schoolId:'cmu'});const epoch=f.game.player.transitionEpoch;
  const destination={x:0,y:.35,z:60,yaw:.3};f.game.teleport(destination);f.game.resume('read');
  assert.equal(f.game.player.mode,'sailing');assert.equal(f.game.player.activeActor,f.game.boat);assert.ok(f.game.player.transitionEpoch>epoch);
  assert.equal(f.bike.parked,true);assert.equal(f.quad.parked,true);assert.equal(f.game.snapshot,null);assert.equal(f.game.pendingResume,null);
  for(let n=0;n<10;n++)tick(f);assert.deepEqual({...f.bike.position},bicyclePosition);assert.equal(f.bike.speed,0);
  assert.equal(f.game.boat.position.x,destination.x);assert.equal(f.game.boat.position.z,destination.z);
 }finally{f.dispose();}
});

test('Reset during campus cycling returns only the bicycle to its own clear bridgehead spawn',()=>{
 const f=gameFixture();try{
  relocate(f,12,-4);for(let n=0;n<10;n++)tick(f,drive);
  f.game.focus={id:'education',schoolId:'bu'};f.game.pause('read',f.game.focus);
  assert.equal(f.game.reset(),education);assert.equal(f.game.player.ridingBicycle,true);assert.equal(f.game.player.activeActor,f.bike);
  near(f.bike.position.x,f.spawn.x);near(f.bike.position.z,f.spawn.z);assert.equal(f.bike.speed,0);
  assert.equal(f.bike.parked,false);assert.equal(f.game.focus,null);assert.equal(f.game.player.pauseReasons.size,0);
  assert.deepEqual(f.quad.position,{x:49,y:.85,z:10.5});tick(f);near(f.bike.position.z,f.spawn.z);
 }finally{f.dispose();}
});

for(const damage of ['articulation','contact'])test(`a replacement bicycle missing ${damage} retains the working model, quality, contacts and simulation`,()=>{
 const f=fixture();try{
  const original=articulation(),mesh=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),new THREE.MeshStandardMaterial());original.add(mesh);
  let disposed=0;mesh.geometry.addEventListener('dispose',()=>disposed++);mesh.material.addEventListener('dispose',()=>disposed++);
  f.bike.setModel(original,'high');f.bike.park(false);for(let n=0;n<20;n++)tick(f,drive);f.bike.updateVisual(0,true);
  const before={position:{...f.bike.position},crank:f.bike.crankAngle,wheel:f.bike.wheelAngle,contacts:f.bike.contactTargets()},candidate=articulation();
  candidate.getObjectByName(damage==='articulation'?'bicycle-crank':'bicycle-grip-left').removeFromParent();
  assert.throws(()=>f.bike.setModel(candidate,'low'));
  assert.equal(f.bike.model,original);assert.equal(f.bike.quality,'high');assert.equal(original.parent,f.bike.visual);assert.equal(disposed,0,'a rejected model must not dispose the currently rendered resources');
  assert.deepEqual({...f.bike.position},before.position);assert.deepEqual(f.bike.contactTargets(),before.contacts);
  near(f.bike.crankAngle,before.crank);near(f.bike.wheelAngle,before.wheel);
  for(let n=0;n<20;n++){tick(f,drive);assert.doesNotThrow(()=>f.bike.updateVisual(DT,false,.5));}
  assert.ok(f.bike.position.z<before.position.z);assert.ok(f.bike.crankAngle>before.crank,'the old bicycle remains fully usable after failed quality replacement');
 }finally{f.dispose();}
});

test('failed bicycle downloads and malformed first installs leave no physics orphan and a later retry succeeds',async()=>{
 const world=new R.World({x:0,y:0,z:0}),walk=new IslandWalkWorld(R,world,education,layout),scene=new THREE.Scene(),messages=[];
 const game=Object.assign(Object.create(Game.prototype),{world,scene,settings:{quality:'high'},player:{},bicycle:null,bicycleLoading:null,events:{trigger:(name,args)=>messages.push([name,args])}});
 const before={bodies:world.bodies.len(),colliders:world.colliders.len(),handles:walk.handles.size};
 const previousDocument=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({beginPath(){},roundRect(){},fill(){},fillText(){}})})};
 try{
  game.loader={loadAsync:async()=>{throw new Error('simulated unavailable GLB');}};
  assert.equal(await game.installBicycle(education,walk),null);
  game.loader={loadAsync:async()=>({scene:new THREE.Group()})};
  assert.equal(await game.installBicycle(education,walk),null);
  assert.equal(game.bicycle,null);assert.equal(game.player.bicycle,undefined);assert.equal(game.bicycleLoading,null);
  assert.equal(world.bodies.len(),before.bodies);assert.equal(world.colliders.len(),before.colliders);assert.equal(walk.handles.size,before.handles);
  assert.equal(scene.children.length,0,'neither an invisible vehicle nor an E marker remains after failure');
  assert.ok(messages.some(([name])=>name==='message'),'walking fallback explains that the bicycle is unavailable');
  game.loader={loadAsync:async()=>({scene:articulation()})};
  const bicycle=await game.installBicycle(education,walk);assert.ok(bicycle);assert.equal(game.bicycle,bicycle);assert.equal(game.player.bicycle,bicycle);
  assert.equal(world.bodies.len(),before.bodies+1);assert.equal(world.colliders.len(),before.colliders+1);assert.equal(walk.handles.size,before.handles+1);
  assert.equal(scene.children.filter(child=>child===bicycle.group).length,1);assert.ok(game.bicycleRideMarker);
  assert.doesNotThrow(()=>bicycle.updateVisual(DT,false,.5));assert.equal(await game.installBicycle(education,walk),bicycle);
  assert.equal(world.bodies.len(),before.bodies+1,'retry cannot duplicate an already installed bicycle');
 }finally{
  game.bicycle?.dispose();world.free();
  if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
 }
});
