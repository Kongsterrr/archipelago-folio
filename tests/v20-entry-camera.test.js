import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PlayerController,BoardingController} from '../sources/core/player.js';
import {Game} from '../sources/game.js';
import {arrivalBounds,arrivalOverviewPose,arrivalFrameRect} from '../sources/core/island-arrival-framing.js';
import {CameraRig} from '../sources/core/camera.js';

test('every transition commits under one fully opaque rendered frame, including overshoot and background pauses',()=>{
 for(const duration of[.4,.6])for(const fps of[30,60,120]){
  const p=new PlayerController({},{});p.mode='walking';let commits=0;
  p.begin('calling-train',()=>{commits++;assert.equal(p.transitionOpacity,1);p.transition.destination='walking';},{duration});
  assert.equal(p.onLand,true);assert.equal(p.ridingTrain,false);
  while(!p.transition.committed)p.tick(1/fps);
  assert.equal(p.transitionOpacity,1);p.pauseReasons.add('hidden');p.tick(5);assert.equal(p.transitionOpacity,1);
  p.pauseReasons.clear();while(p.transition)p.tick(1/fps);
  assert.equal(commits,1);assert.equal(p.mode,'walking');assert.equal(p.transitionOpacity,0);
 }
 const p=new PlayerController({},{});p.mode='walking';p.begin('calling-train',()=>{p.transition.destination='walking';},{duration:.4});
 p.tick(2);assert.equal(p.transitionOpacity,1);assert.equal(p.transitioning,true);p.tick(.2);assert.equal(p.mode,'walking');
});

test('cancelled or failed shore preparations cannot reposition the train',async()=>{
 let resolve,prepared=0;const p=new PlayerController({hold(){}},{enable(){}});
 const boarding=new BoardingController(p,{prepare:()=>new Promise(r=>resolve=r),select:()=>({}),onCommit(){prepared++;},onError(){}});
 const pending=boarding.disembark({id:'experience'});boarding.cancel();resolve({});assert.equal(await pending,false);p.tick(10);assert.equal(prepared,0);
 const failed=new BoardingController(p,{prepare:async()=>{throw Error('asset missing');},onCommit(){prepared++;},onError(){}});
 assert.equal(await failed.disembark({id:'experience'}),false);p.tick(10);assert.equal(prepared,0);
});

test('failed train boarding and leaving keep the last committed control subject',()=>{
 for(const[before,mode,after]of[['walking','boarding-train','walking'],['walking','boarding-train','riding-train'],['riding-train','leaving-train','walking'],['riding-train','leaving-train','riding-train']]){
  const character={},train={},p=new PlayerController({},character);p.train=train;p.mode=before;
  p.begin(mode,()=>{p.transition.destination=after;},{duration:.4});
  assert.equal(p.ridingTrain,before==='riding-train');p.tick(.2);
  assert.equal(p.ridingTrain,after==='riding-train');assert.equal(p.activeActor,after==='riding-train'?train:character);
  p.tick(.2);assert.equal(p.mode,after);
 }
});

function landingFixture(id='experience'){
 const events=[],island={id,x:-76,z:8,rotation:Math.PI/2,shore:[[-39,-32],[39,-32],[39,30],[-39,30]]};
 const group=new THREE.Group();group.add(new THREE.Mesh(new THREE.BoxGeometry(78,16,62)));
 const walk={layout:{overviewBounds:{min:[-29,.85,-24],max:[29,18,38]}}};
 const boat={position:{x:0,y:.35,z:0},yaw:0,teleport(point){Object.assign(this.position,point);},park(){},hold(){}};
 const character={teleport(){},enable(){}},player=new PlayerController(boat,character);
 const game=Object.assign(Object.create(Game.prototype),{boat,character,player,jack:{resetPose(){}},journey:{prepareEntry(){events.push('train');}},arrival:{start(i,b){events.push('overview');this.bounds=b;}},loaded:new Map([[id,{group}]]),clearWake(){},feedback:{clear(){}},prev:new THREE.Vector3(),resetCamera(){events.push('camera');},events:{trigger(){}}});
 const berth={boat:{x:1,y:.35,z:2},landing:{x:1,y:.85,z:3}};
 return{game,island,walk,berth,events};
}

test('every successful Experience landing prepares the train before overview; other islands do not',()=>{
 for(const id of['experience','education']){
  const f=landingFixture(id);
  for(let n=0;n<3;n++){f.events.length=0;f.game.commitBoarding('ashore',f.island,f.berth,f.walk);assert.deepEqual(f.events,id==='experience'?['train','overview','camera']:['overview','camera']);}
 }
});

test('composition bounds fit the town, clock and original dock without enlarging to unused coast',()=>{
 const island={x:-76,z:8,rotation:Math.PI/2,shore:[[-39,-32],[39,-32],[39,30],[-39,30]]};
 const local={min:[-29,.85,-24],max:[29,18,38]},full={min:[-120,-1,-38],max:[-20,18,54]},before=JSON.stringify(local);
 const bounds=arrivalBounds(island,full,local),fallback=arrivalBounds(island,full);
 assert.ok(bounds.max[2]-bounds.min[2]<fallback.max[2]-fallback.min[2]);assert.equal(JSON.stringify(local),before);
 for(const[width,height]of[[1440,900],[1920,1080],[390,844],[844,390]]){
  const pose=arrivalOverviewPose(bounds,{width,height,azimuth:island.rotation}),camera=new THREE.PerspectiveCamera(28,width/height,.2,2000);camera.position.copy(pose.position);camera.lookAt(pose.target);camera.updateMatrixWorld();const rect=arrivalFrameRect(width,height);
  for(const x of[-29,29])for(const y of[.85,18])for(const z of[-24,38]){const q=new THREE.Vector3(island.x+z,y,island.z-x).project(camera),px=(q.x+1)*width/2,py=(1-q.y)*height/2;assert.ok(px>=rect.left&&px<=rect.right&&py>=rect.top&&py<=rect.bottom);}
 }
 assert.throws(()=>arrivalBounds(island,full,{min:[0,0,0],max:[NaN,3,4]}));
});

test('authored traveling look target affects composition without pulling the passenger far off screen',()=>{
 const state={position:{x:0,y:2,z:0},yaw:0,locomotion:'train',landAzimuth:0,trainView:{azimuth:0,distance:32}};
 for(const[width,height]of[[1440,900],[390,844],[844,390]]){
  const make=reduced=>new CameraRig(new THREE.PerspectiveCamera(),{walkZoom:1,reduced},width,height);
  const ordinary=make(false),authored=make(false);ordinary.update(0,state,true);authored.update(0,{...state,trainView:{...state.trainView,lookAt:{x:100,y:100,z:100}}},true);
  const delta=authored.target.clone().sub(ordinary.target);assert.ok(Math.hypot(delta.x,delta.z)<=2.500001);assert.ok(Math.abs(delta.y)<=1.500001);assert.ok(delta.length()>0);
  const reduced=make(true);reduced.update(0,{...state,trainView:{...state.trainView,lookAt:{x:100,y:100,z:100}}},true);assert.ok(reduced.target.distanceTo(ordinary.target)<1e-9);
 }
});
