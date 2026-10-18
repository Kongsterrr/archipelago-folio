import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {CameraRig} from '../sources/core/camera.js';
import {CharacterController,IslandWalkWorld,localToWorld} from '../sources/core/character.js';
import {dockLocal} from '../sources/core/dock.js';
import {islands} from '../sources/config.js';

const layout=JSON.parse(fs.readFileSync(new URL('../static/models/walk-layout.json',import.meta.url))).islands.find(i=>i.id==='experience');
const island=islands.find(i=>i.id==='experience'),STEP=1/60;
const rigFor=(width=1440,height=900,zoom=0)=>new CameraRig(new THREE.PerspectiveCamera(28,width/height,.2,600),{walkZoom:zoom},width,height);
const state=(extra={})=>({position:{x:0,y:0,z:0},speed:2.4,yaw:Math.PI,velocity:{x:0,z:2.4},locomotion:'walking',landAzimuth:0,walkingObstruction:true,walkingStairs:true,walkingIntent:{x:0,z:1},terrainHeight:()=>null,...extra});

test('stair lead follows intention through contact pulses and an exact 180 degree reversal',()=>{
 const rig=rigFor(),steady=rigFor();let position={x:0,y:0,z:0};
 rig.update(0,state({position}),true);steady.update(0,state({position}),true);
 for(let n=0;n<120;n++){
  position={...position,z:position.z+.03};
  rig.update(STEP,state({position,speed:n%4===0?.005:2.4}));steady.update(STEP,state({position}));
  assert.ok(rig.position.distanceTo(steady.position)<1e-10);
 }
 // No normalized antipodal heading interpolation: the framing lead crosses
 // through zero and reaches the opposite side in less than half a second.
 for(let n=0;n<30;n++)rig.update(STEP,state({position,walkingIntent:{x:0,z:-1},yaw:0,speed:2.4}));
 const reversed=rigFor();reversed.update(0,state({position,walkingIntent:{x:0,z:-1},yaw:0,speed:2.4}),true);
 assert.ok(rig.stairLead.z<-.719,'the antipodal lead reaches its opposite direction');
 assert.ok(rig.target.distanceTo(reversed.target)<.06,'framing settles within half a second');
});

test('stair horizontal filtering stops promptly, freezes on pause, and exits without a catch-up jump',()=>{
 const rig=rigFor();let position={x:0,y:0,z:0};rig.update(0,state({position}),true);
 for(let n=0;n<120;n++){position={...position,z:position.z+.08};rig.update(STEP,state({position,speed:4.8,walkingIntent:{x:0,z:1,run:true}}));}
 assert.ok(rig.walkCamera.horizontalLag.length()<.3,'short horizontal lag is bounded at running pace');
 const held=rig.position.clone(),lag=rig.walkCamera.horizontalLag.clone();
 rig.update(20,state({position,followPaused:true}));assert.deepEqual(rig.position,held);assert.deepEqual(rig.walkCamera.horizontalLag,lag);
 let previous=rig.position.clone();
 for(let n=0;n<40;n++){
  rig.update(STEP,state({position,speed:0,velocity:{x:0,z:0},walkingStairs:n<5,walkingIntent:{x:0,z:0}}));
  assert.ok(rig.position.distanceTo(previous)<.15,'no abrupt stair exit correction');previous.copy(rig.position);
 }
 const settled=rig.position.clone();for(let n=0;n<40;n++)rig.update(STEP,state({position,speed:0,velocity:{x:0,z:0},walkingStairs:false,walkingIntent:{x:0,z:0}}));
 assert.ok(rig.position.distanceTo(settled)<.015,'stop does not leave a long camera tail');
 assert.ok(rig.walkCamera.horizontalLag.length()<1e-8);
 rig.update(0,state({position:{x:80,y:20,z:30}}),true);assert.equal(rig.walkCamera.horizontalLag.length(),0,'opaque resets discard old lag');
});

test('normal ground and other islands retain their existing camera behavior',()=>{
 for(const walkingObstruction of[true,false]){
  const a=rigFor(),b=rigFor();for(let n=0;n<100;n++){
   const input=state({position:{x:n*.02,y:0,z:n*.03},walkingObstruction,walkingStairs:false,speed:n%7===0?0:2.4});
   a.update(STEP,input,n===0);b.update(STEP,{...input,walkingIntent:null},n===0);
   assert.deepEqual(a.position,b.position);assert.deepEqual(a.target,b.target);
  }
 }
});

await R.init();
const world=new R.World({x:0,y:0,z:0});world.timestep=STEP;
const walk=new IslandWalkWorld(R,world,island,layout),actor=new CharacterController(R,world);actor.enable(true);
const tracks=[],maneuvers=[],linked=[];
for(const stair of layout.stairs)for(const run of[false,true])for(const direction of[-1,1]){
 const angle=stair.rotation||0,half=stair.depth/2+.3,start=-direction*half;
 const point=localToWorld(island,{x:stair.x+start*Math.sin(angle),z:stair.z+start*Math.cos(angle)});point.y=walk.groundAt(point);actor.teleport(point,walk);world.step();
 const intent={x:Math.sin(island.rotation+angle)*direction,z:Math.cos(island.rotation+angle)*direction,run};
 const frames=[{position:actor.position,velocity:{x:0,z:0},yaw:actor.yaw,speed:0}];let reached=false;
 for(let n=0;n<1000;n++){
  const p=dockLocal(actor.position,island),along=(p.x-stair.x)*Math.sin(angle)+(p.z-stair.z)*Math.cos(angle);if((along-direction*half)*direction>=-.05){reached=true;break;}
  actor.step(intent,STEP);world.step();actor.afterStep();frames.push({position:actor.position,velocity:{...actor.velocity},yaw:actor.yaw,speed:actor.speed});
 }
 assert.ok(reached,`${stair.id} fixture traverses actual Rapier treads`);
 const landmarks=[];for(const fraction of[-.5,-.25,0,.25,.5])for(const lane of[-1,1])landmarks.push(localToWorld(island,{x:stair.x+fraction*stair.depth*Math.sin(angle)+lane*Math.cos(angle),z:stair.z+fraction*stair.depth*Math.cos(angle)-lane*Math.sin(angle),y:stair.frontY+(stair.backY-stair.frontY)*(.5-fraction)+1}));
 tracks.push({id:stair.id,run,direction,intent,frames,landmarks});
}
for(const stair of layout.stairs)for(const run of[false,true]){
 const angle=stair.rotation||0,start=stair.depth*.25,point=localToWorld(island,{x:stair.x+start*Math.sin(angle),z:stair.z+start*Math.cos(angle)});point.y=walk.groundAt(point);actor.teleport(point,walk);world.step();
 const frames=[],sideLimit=stair.width/2-.55;let side=1;
 for(let n=0;n<300;n++){
  const p=dockLocal(actor.position,island),across=(p.x-stair.x)*Math.cos(angle)-(p.z-stair.z)*Math.sin(angle);if(Math.abs(across)>sideLimit)side=-Math.sign(across);
  // Diagonal ascent, an explicit stop, reverse, a 90-degree side step, then
  // resume climbing. These run through real tread corners and capsule sweeps.
  let along=-1,lateral=side*.3;
  if(n>=75&&n<93){along=0;lateral=0;}
  else if(n>=93&&n<132){along=1;lateral=side*.3;}
  else if(n>=132&&n<156){along=0;lateral=side;}
  const a=angle+island.rotation,intent={x:along*Math.sin(a)+lateral*Math.cos(a),z:along*Math.cos(a)-lateral*Math.sin(a),run};
  actor.step(intent,STEP);world.step();actor.afterStep();frames.push({position:actor.position,velocity:{...actor.velocity},yaw:actor.yaw,speed:actor.speed,intent,stairs:walk.nearStairs(actor.position)});
 }
 maneuvers.push({id:stair.id,run,frames});
}
for(const run of[false,true]){
 const first=layout.stairs.find(s=>s.id==='west-cliff-stair-0'),last=layout.stairs.find(s=>s.id==='west-cliff-stair-3');
 const point=localToWorld(island,{x:first.x,z:first.frontZ+1});point.y=walk.groundAt(point);actor.teleport(point,walk);world.step();
 const intent={x:-Math.sin(island.rotation),z:-Math.cos(island.rotation),run},frames=[];
 for(let n=0;n<1800;n++){
  if(dockLocal(actor.position,island).z<last.backZ-.8)break;
  actor.step(intent,STEP);world.step();actor.afterStep();frames.push({position:actor.position,velocity:{...actor.velocity},yaw:actor.yaw,speed:actor.speed,intent,stairs:walk.nearStairs(actor.position)});
 }
 assert.ok(dockLocal(actor.position,island).z<last.backZ-.8,'connected west route reaches the final landing');linked.push({run,frames,intent});
}
world.free();

function measure(track,width,height,zoom,fps,stable,verifyTerrain=false){
 const rig=rigFor(width,height,zoom),duration=(track.frames.length-1)*STEP,rows=[];
 const result={reverse:0,backgroundSquared:0,backgroundCount:0,maxBackground:0,maxHead:0,maxHeight:0};
 for(let n=0;n<=Math.floor(duration*fps);n++){
  const tick=n/fps/STEP,index=Math.min(track.frames.length-1,Math.floor(tick+1e-9)),alpha=Math.max(0,tick-index),a=track.frames[Math.max(0,index-1)],b=track.frames[index];
  const position=new THREE.Vector3(a.position.x,a.position.y,a.position.z).lerp(new THREE.Vector3(b.position.x,b.position.y,b.position.z),alpha);
  // This replay isolates camera motion from visibility changes. Real support
  // comes from Rapier above; V22 geometry/visibility tests separately exercise
  // the full terrain sampler and bound the camera at all authored viewpoints.
  rig.update(1/fps,state({...b,position,landAzimuth:island.rotation,walkingStairs:stable,walkingIntent:stable?track.intent:null}),n===0);
  if(verifyTerrain&&n%10===0){
   const pivot=new THREE.Vector3(position.x,position.y+.7,position.z),terrain=p=>walk.contains(p,0)?walk.groundAt(p):null;
   const clear=rig.walkCamera.clearFraction(pivot,rig.position,terrain);
   assert.equal(clear,1,`${track.id}/${track.direction}/zoom${zoom}: the smoothed eye retains actual terrain clearance`);
  }
  const head=new THREE.Vector3(position.x,position.y+.7,position.z).project(rig.camera);
  assert.ok(Math.abs(head.x)<.82&&Math.abs(head.y)<.86,`${track.id} keeps the actual interpolated head visible`);
  const row={eye:rig.position.clone(),head:new THREE.Vector2(head.x*width/2,head.y*height/2),landmarks:track.landmarks.map(p=>new THREE.Vector3(p.x,p.y,p.z).project(rig.camera))};rows.push(row);
  if(n<fps*.5||n>=duration*fps-.2*fps)continue;
  const prev=rows[n-1],prior=rows[n-2],delta=row.eye.clone().sub(prev.eye),factor=(fps/60)**2;
  if(delta.x*track.intent.x+delta.z*track.intent.z<-.0001)result.reverse++;
  result.maxHeight=Math.max(result.maxHeight,Math.abs(row.eye.y-2*prev.eye.y+prior.eye.y)*factor);
  result.maxHead=Math.max(result.maxHead,row.head.clone().addScaledVector(prev.head,-2).add(prior.head).length()*factor);
  for(let i=0;i<row.landmarks.length;i++){
   const points=[row.landmarks[i],prev.landmarks[i],prior.landmarks[i]];if(!points.every(p=>Math.abs(p.x)<.85&&Math.abs(p.y)<.85))continue;
   const [p,b,a]=points,dx=(p.x-2*b.x+a.x)*width/2,dy=(p.y-2*b.y+a.y)*height/2,value=Math.hypot(dx,dy)*factor;
   result.backgroundSquared+=value*value;result.backgroundCount++;result.maxBackground=Math.max(result.maxBackground,value);
  }
 }
 return result;
}

for(const [width,height]of[[1440,900],[1920,1080],[390,844],[844,390]])for(const fps of[30,60,120])test(`all 12 stair groups, both directions, walk/run and three zooms have stable screen motion at ${width}×${height}/${fps}Hz`,t=>{
 assert.equal(new Set(tracks.map(t=>t.id)).size,12);
 let before=0,after=0,samples=0,oldReversals=0;
 for(const track of tracks)for(const zoom of[0,1,2]){
  const original=measure(track,width,height,zoom,fps,false),fixed=measure(track,width,height,zoom,fps,true,fps===60&&(width===1440||width===390));
  assert.equal(fixed.reverse,0,`${track.id}/${track.run?'run':'walk'}/${track.direction}/zoom${zoom} cannot reverse a steady walking camera`);
  assert.ok(fixed.maxHeight<.02,'vertical acceleration remains bounded independently of camera pitch');
  before+=original.backgroundSquared;after+=fixed.backgroundSquared;samples+=fixed.backgroundCount;oldReversals+=original.reverse;
 }
 assert.ok(samples>1000,'compare visible fixed landmarks, not offscreen projections');
 assert.ok(oldReversals>100,'the fixture must expose the original backwards camera pulses');
 assert.ok(after<before*.35,`visible background acceleration must drop substantially: ${Math.sqrt(after/samples)} vs ${Math.sqrt(before/samples)} px/frame²`);
 t.diagnostic(`visible landmark RMS acceleration ${Math.sqrt(before/samples).toFixed(3)} → ${Math.sqrt(after/samples).toFixed(3)} pixels per 60Hz frame²; reverse frames ${oldReversals} → 0`);
});

test('diagonal stair contacts, stops, reversal and corners stay continuous at every zoom and frame rate',t=>{
 let maximum=0,worst='',stairMaximum=0,stairWorst='',exits=0;
 for(const track of maneuvers)for(const fps of[30,60,120])for(const zoom of[0,1,2]){
  const rig=rigFor(1440,900,zoom),rows=[];
  for(let n=0;n<5*fps;n++){
   const tick=n/fps/STEP,index=Math.min(track.frames.length-1,Math.floor(tick+1e-9)),alpha=Math.max(0,tick-index),a=track.frames[Math.max(0,index-1)],b=track.frames[index],position=new THREE.Vector3(a.position.x,a.position.y,a.position.z).lerp(new THREE.Vector3(b.position.x,b.position.y,b.position.z),alpha);
   rig.update(1/fps,state({...b,position,landAzimuth:island.rotation,walkingStairs:b.stairs,walkingIntent:b.intent}),n===0);
   const screen=new THREE.Vector3(position.x,position.y+.7,position.z).project(rig.camera);
   assert.ok(Math.abs(screen.x)<.82&&Math.abs(screen.y)<.86,`${track.id}: maneuver keeps Jack visible`);
   const offset=rig.position.clone().sub(rig.target);assert.ok(Math.abs(Math.atan2(offset.y,Math.hypot(offset.x,offset.z))-38*Math.PI/180)<1e-8);
   rows.push(rig.position.clone());
   if(n>2){const acceleration=rows[n].clone().addScaledVector(rows[n-1],-2).add(rows[n-2]).length()*(fps/60)**2,label=`${track.id}/${track.run?'run':'walk'}/${fps}Hz/zoom${zoom}/frame${n}/stairs${b.stairs}`;if(acceleration>maximum){maximum=acceleration;worst=label;}
    // A deliberate instantaneous +4.8 to -4.8m/s reversal is not steady-input
    // jitter. Bound recurring pulses after the short turn response separately.
    const steady=track.frames.slice(Math.max(0,index-8),index).every(f=>f.intent.x===b.intent.x&&f.intent.z===b.intent.z);
    if(b.stairs&&steady&&acceleration>stairMaximum){stairMaximum=acceleration;stairWorst=label;}}
   if(index&&track.frames[index-1].stairs&&!b.stairs)exits++;
   if(n===Math.round(1.4*fps)){
    const held=rig.position.clone(),lag=rig.walkCamera.horizontalLag.clone();rig.update(10,state({position,followPaused:true}));assert.deepEqual(rig.position,held);assert.deepEqual(rig.walkCamera.horizontalLag,lag);
   }
   if(n%Math.round(fps/3)===0){const terrain=p=>walk.contains(p,0)?walk.groundAt(p):null,pivot=new THREE.Vector3(position.x,position.y+.7,position.z);assert.equal(rig.walkCamera.clearFraction(pivot,rig.position,terrain),1,`${track.id}: diagonal smoothed view clears real terrain`);}
  }
 }
 assert.ok(exits>10,'actual trajectories must leave the nearStairs margin onto landings');
 assert.ok(stairMaximum<.07,`turn/stop acceleration ${stairMaximum} at ${stairWorst}`);
 t.diagnostic(`maximum maneuver camera acceleration ${maximum.toFixed(4)}m per 60Hz frame² at ${worst}`);
 t.diagnostic(`maximum on-stair maneuver acceleration ${stairMaximum.toFixed(4)}m per 60Hz frame²; landing exits ${exits}`);
});

test('four connected west stairs cross their actual two-metre landings without catch-up pulses',()=>{
 for(const track of linked)for(const fps of[30,60,120])for(const zoom of[0,1,2]){
  const rig=rigFor(1440,900,zoom),duration=track.frames.length*STEP;let previous=null,prior=null,previousStairs=null,boundaries=0;
  for(let n=0;n<duration*fps;n++){
   const tick=n/fps/STEP,index=Math.min(track.frames.length-1,Math.floor(tick+1e-9)),alpha=Math.max(0,tick-index),a=track.frames[Math.max(0,index-1)],b=track.frames[index],position=new THREE.Vector3(a.position.x,a.position.y,a.position.z).lerp(new THREE.Vector3(b.position.x,b.position.y,b.position.z),alpha);
   rig.update(1/fps,state({...b,position,landAzimuth:island.rotation,walkingStairs:b.stairs,walkingIntent:b.intent}),n===0);
   if(previousStairs!==null&&previousStairs!==b.stairs){
    boundaries++;
    if(prior){const acceleration=rig.position.clone().addScaledVector(previous,-2).add(prior).length()*(fps/60)**2;assert.ok(acceleration<.035,`landing boundary acceleration ${acceleration} at ${fps}Hz`);}
   }
   prior=previous;previous=rig.position.clone();previousStairs=b.stairs;
  }
  assert.ok(boundaries>=7,'exercise both entry and exit across all four stairs');
 }
});
