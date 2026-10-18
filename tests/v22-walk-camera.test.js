import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {CameraRig} from '../sources/core/camera.js';
import {WALK_CAMERA} from '../sources/core/walk-camera.js';
import {CharacterController,IslandWalkWorld,localToWorld} from '../sources/core/character.js';
import {dockLocal} from '../sources/core/dock.js';
import {islands} from '../sources/config.js';
import {Game} from '../sources/game.js';

const rigFor=(width=1440,height=900)=>new CameraRig(new THREE.PerspectiveCamera(28,width/height,.2,600),{walkZoom:1},width,height);
const state=(extra={})=>({position:{x:0,y:0,z:0},locomotion:'walking',landAzimuth:0,walkingObstruction:true,terrainHeight:()=>0,...extra});
const pitch=rig=>Math.atan2(rig.position.y-rig.target.y,Math.hypot(rig.position.x-rig.target.x,rig.position.z-rig.target.z));
const pose=rig=>[...rig.position.toArray(),...rig.target.toArray()];

test('walking height is damped without delaying horizontal movement or moving the actor',()=>{
 const rig=rigFor(),p={x:0,y:0,z:0};rig.update(0,state({position:p}),true);const eye=rig.position.clone(),target=rig.target.clone();
 p.x=.04;p.y=.13;rig.update(1/60,state({position:p}));
 assert.ok(Math.abs(rig.position.x-eye.x-.04)<1e-10);
 assert.ok(Math.abs(rig.position.y-eye.y-.13*(1-Math.exp(-8/60)))<1e-10);
 assert.ok(Math.abs(rig.target.y-target.y-.13*(1-Math.exp(-8/60)))<1e-10);
 assert.deepEqual(p,{x:.04,y:.13,z:0});
});

test('a composition target inside a high terrace does not count as a blocked character',()=>{
 const clear=rigFor(),rig=rigFor(),input=state({speed:2.4,yaw:-Math.PI/2});clear.update(0,input,true);
 // The .72 m walking lead lies in the slab, but the head-to-eye segment only
 // reaches its X edge after it has already risen clear of the slab.
 const terrainHeight=p=>p.x>.5&&p.z<3?4:0;
 rig.update(0,{...input,terrainHeight},true);
 assert.deepEqual(pose(rig),pose(clear));assert.equal(rig.walkCamera.blocked,false);
});

test('obstruction recovery waits .2 seconds and resumes gradually; pauses consume no delay',()=>{
 const rig=rigFor(),obstructed=state({terrainHeight:p=>p.z>6?8:0});rig.update(0,obstructed,true);
 const initial=rig.walkCamera.fraction;assert.ok(initial>.55&&initial<.9);
 for(let n=0;n<11;n++)rig.update(1/60,state());assert.equal(rig.walkCamera.fraction,initial);
 const held=pose(rig),timer=rig.walkCamera.recovery;rig.update(20,state({followPaused:true}));assert.deepEqual(pose(rig),held);assert.equal(rig.walkCamera.recovery,timer);
 rig.update(1/60,state());rig.update(1/60,state());assert.ok(rig.walkCamera.fraction>initial&&rig.walkCamera.fraction<1);
 for(let n=0;n<120;n++)rig.update(1/60,state());assert.ok(rig.walkCamera.fraction>.999);
});

test('impossible terrain remains bounded instead of forcing an overhead view',()=>{
 const rig=rigFor();rig.update(0,state({terrainHeight:p=>p.z>1?30:0}),true);
 assert.equal(rig.walkCamera.blocked,true);
 assert.ok(pitch(rig)<=WALK_CAMERA.maxElevation+1e-10);
 assert.ok(rig.position.distanceTo(rig.target)>=12.6*.55-1e-10);
 assert.ok(Math.abs(rig.yaw)<1e-10);
});

test('opaque resets discard old follow height, and reader/train/arrival do not use walking constraints',()=>{
 const rig=rigFor();rig.update(0,state({terrainHeight:p=>p.z>6?8:0}),true);
 const modes=[{focus:{x:3,z:6,camera:{distance:28,height:8,azimuth:.3}}},{locomotion:'train',trainView:{center:{x:3,y:8,z:6},azimuth:.3,distance:32}},{arrival:{bounds:{min:[-8,0,-8],max:[8,8,8]},progress:.3}}];
 for(const mode of modes){
  const a=rigFor(),b=rigFor(),input=state({...mode,terrainHeight:null});a.update(0,input,true);b.update(0,{...input,walkingObstruction:false},true);assert.deepEqual(pose(a),pose(b));assert.equal(a.walkCamera.target,null);
 }
 const position={x:80,y:21.55,z:-30};rig.lastPoint=null;rig.update(0,state({position,terrainHeight:()=>21.55}),true);
 const fresh=rigFor();fresh.update(0,state({position,terrainHeight:()=>21.55}),true);assert.deepEqual(pose(rig),pose(fresh));
 rig.resize(390,844);for(let n=0;n<120;n++)rig.update(1/60,state({position,terrainHeight:()=>21.55}));
 assert.ok(Math.abs(rig.position.distanceTo(rig.target)-24)<.001);assert.deepEqual(position,{x:80,y:21.55,z:-30});
});

test('closing a reader preserves its initial angle and eases back to the walking view',()=>{
 const rig=rigFor();rig.update(0,state(),true);
 rig.update(0,state({focus:{x:3,z:2,camera:{distance:28,height:5,azimuth:0,elevation:.84}}}),true);
 let previous=pitch(rig);
 for(let n=0;n<180;n++){
  rig.update(1/60,state());const current=pitch(rig);
  assert.ok(Math.abs(current-previous)<THREE.MathUtils.degToRad(1.5),'reader close must not snap to 38 degrees');previous=current;
 }
 assert.ok(Math.abs(pitch(rig)-WALK_CAMERA.elevation)<1e-5);
});

test('Game uses the rendered Jack head for Experience camera and building occlusion',()=>{
 const actor={position:{x:10,y:0,z:0},velocity:{x:0,z:0},yaw:0,speed:0},island={id:'experience',x:0,z:0,r:30,rotation:0};
 const jack={root:new THREE.Group(),outline(){}},player={onLand:true,walking:true,island,pauseReasons:new Set()};
 const game={activeActor:actor,player,jack,focus:null,frozen:false,practiceFocus:()=>null,settings:{},character:{walkWorld:{terrain:{},contains:()=>true,groundAt:()=>0}},inputs:{read:()=>({})},cameraRig:{yaw:0}};
 const cameraState=Game.prototype.cameraState.call(game);assert.deepEqual(cameraState.visibilityPivot,{x:0,y:.7,z:0});assert.equal(cameraState.walkingObstruction,true);
 player.pauseReasons.add('hidden');assert.equal(Game.prototype.cameraState.call(game).followPaused,true);player.pauseReasons.clear();
 player.island={...island,id:'projects'};assert.equal(Game.prototype.cameraState.call(game).walkingObstruction,false);player.island=island;
 const wall=new THREE.Mesh(new THREE.PlaneGeometry(2,8),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));wall.position.set(0,5,5);
 const scene=new THREE.Scene();scene.add(wall);Object.assign(game,{scene,camera:{position:new THREE.Vector3(0,10,10)},environment:{occluders:[wall]},controllers:new Map(),walkLayouts:new Map()});
 Game.prototype.updateOcclusion.call(game,1000);assert.equal(wall.material.opacity,.2,'wall on the visual head ray is faded even when the physics capsule is ahead');
});

const layout=JSON.parse(fs.readFileSync(new URL('../static/models/walk-layout.json',import.meta.url))).islands.find(i=>i.id==='experience');
const island=islands.find(i=>i.id==='experience'),STEP=1/60;
await R.init();
const world=new R.World({x:0,y:0,z:0});world.timestep=STEP;
const walk=new IslandWalkWorld(R,world,island,layout),actor=new CharacterController(R,world);actor.enable(true);
const tracks=[];
for(const id of['harbor-east-stair','garden-front-stair','summit-west-stair'])for(const run of[false,true])for(const direction of[-1,1]){
 const stair=layout.stairs.find(s=>s.id===id),angle=stair.rotation||0,half=stair.depth/2+.3,start=-direction*half;
 const point=localToWorld(island,{x:stair.x+start*Math.sin(angle),z:stair.z+start*Math.cos(angle)});point.y=walk.groundAt(point);actor.teleport(point,walk);world.step();
 const frames=[{position:actor.position,velocity:{x:0,z:0},yaw:actor.yaw,speed:0}];let reached=false;
 for(let n=0;n<1000;n++){
  const p=dockLocal(actor.position,island),along=(p.x-stair.x)*Math.sin(angle)+(p.z-stair.z)*Math.cos(angle);if((along-direction*half)*direction>=-.05){reached=true;break;}
  actor.step({x:Math.sin(island.rotation+angle)*direction,z:Math.cos(island.rotation+angle)*direction,run},STEP);world.step();actor.afterStep();frames.push({position:actor.position,velocity:{...actor.velocity},yaw:actor.yaw,speed:actor.speed});
 }
 assert.ok(reached,`${id} fixture must traverse the real stairs`);tracks.push({id,run,direction,frames});
}
world.free();
const terrainHeight=p=>walk.contains(p,0)?walk.groundAt(p):null;
test('the entire open summit shoulder clears all three walking lanes, both headings and every zoom',()=>{
 const stair=layout.stairs.find(s=>s.id==='summit-west-stair');
 for(const [width,height]of[[1440,900],[1920,1080],[390,844],[844,390]])for(const zoom of[0,1,2])for(const lane of[-1.3,0,1.3])for(const direction of[-1,1]){
  const rig=rigFor(width,height);rig.settings.walkZoom=zoom;
  for(let x=stair.x-stair.depth/2+.05;x<stair.x+stair.depth/2;x+=.25){
   const position=localToWorld(island,{x,z:stair.z+lane});position.y=walk.groundAt(position);
   rig.update(0,{position,speed:4.8,yaw:direction>0?0:Math.PI,locomotion:'walking',landAzimuth:island.rotation,terrainHeight,walkingObstruction:true},true);
   const label=`${width}x${height}/zoom${zoom}/lane${lane}/direction${direction}/x${x}`;
   assert.equal(rig.walkCamera.blocked,false,label);
   const head=new THREE.Vector3(position.x,position.y+.7,position.z);
   for(let k=1;k<=32;k++){const q=head.clone().lerp(rig.position,k/32),height=terrainHeight(q);assert.ok(!Number.isFinite(height)||q.y>=height+.28,label+' clear head ray');}
  }
 }
});
for(const [width,height]of[[1440,900],[1920,1080],[390,844],[844,390]])for(const fps of[30,60,120])test(`V22 Rapier stair cameras at ${width}x${height}, ${fps} FPS retain framing and bounded terrain clearance`,()=>{
 for(const track of tracks){
  const rig=rigFor(width,height),duration=(track.frames.length-1)*STEP,base=Math.max(12.6,24*(height/width)/(844/390));
  let previous=null;
  for(let n=0;n<=Math.floor(duration*fps);n++){
   const tick=n/fps/STEP,index=Math.min(track.frames.length-1,Math.floor(tick+1e-9)),alpha=Math.max(0,tick-index),a=track.frames[Math.max(0,index-1)],b=track.frames[index];
   const position=new THREE.Vector3(a.position.x,a.position.y,a.position.z).lerp(new THREE.Vector3(b.position.x,b.position.y,b.position.z),alpha);
   rig.update(1/fps,{...b,position,locomotion:'walking',landAzimuth:island.rotation,terrainHeight,walkingObstruction:true},n===0);
   const label=`${track.id}/${track.run?'run':'walk'}/${track.direction}/frame ${n}`;
   assert.ok(pitch(rig)<=WALK_CAMERA.maxElevation+1e-9,label+' pitch');
   assert.ok(rig.position.distanceTo(rig.target)>=base*.55-1e-8,label+' distance');
   assert.ok(Math.abs(rig.yaw-island.rotation)<1e-8,label+' bearing');
   const head=new THREE.Vector3(position.x,position.y+.7,position.z),screen=head.clone().project(rig.camera);
   assert.ok(Math.abs(screen.x)<.82&&Math.abs(screen.y)<.86,label+' character frame');
   assert.equal(rig.walkCamera.blocked,false,label+' authored terrain must have a valid bounded view');
   if(previous)assert.ok(Math.abs(pitch(rig)-previous.pitch)<THREE.MathUtils.degToRad(1.8)*60/fps,label+' no sudden tilt');
   if(n%4===0)for(let k=1;k<=24;k++){
    const point=head.clone().lerp(rig.position,k/24),ground=terrainHeight(point);
    assert.ok(!Number.isFinite(ground)||point.y>=ground+.28,`${label} visibility sample ${k}: ${point.y-ground}`);
   }
   previous={pitch:pitch(rig)};
  }
 }
});
