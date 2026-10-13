import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PlayerController} from '../sources/core/player.js';
import {CareerTrainController} from '../sources/core/career-train.js';
import {CareerJourney} from '../sources/world/career-journey.js';
import {CameraRig,cameraAzimuth} from '../sources/core/camera.js';
import {CameraTransition} from '../sources/core/camera-transition.js';
import {Game} from '../sources/game.js';

function fixture(){
 const island={id:'experience',x:-76,z:8,rotation:Math.PI/2},scene=new THREE.Scene(),events=[];
 const character={position:{x:0,y:.85,z:0},velocity:{x:0,z:0},enabled:true,seated:false,yaw:0,speed:0,enable(value){this.enabled=value;},hold(){this.speed=0;},teleport(point,walk){this.position={...point};this.walkWorld=walk;}};
 const boat={position:{x:10,y:0,z:10},yaw:0,speed:0},player=new PlayerController(boat,character);
 player.mode='walking';player.island=island;player.berth={landing:{x:-40,y:.85,z:8,yaw:0}};
 const root=new THREE.Group();scene.add(root);
 const inputs={enabled:true,clears:0,setEnabled(value){this.enabled=value;this.clears++;},clear(){this.clears++;}};
 const game={boat,character,player,scene,inputs,mode:'exploring',jack:{root,resetPose(pose){this.pose=pose;},forceFrame:false},cancelChallenge(){},resetCamera(){},events:{trigger(...event){events.push(event);}}};
 Object.defineProperty(game,'frozen',{get(){return player.transitioning||player.pauseReasons.size>0||game.mode!=='exploring';}});
 const journey=new CareerJourney(game),path={type:'racetrack',center:[0,.85,0],halfStraight:16,radius:8};
 journey.island=island;journey.railway={path,stations:['harbor','visionx','beaconfire','amtrak'].map((id,index)=>({id,contentId:id==='harbor'?null:id,label:id,distance:index*24,boarding:{x:index*5,y:.85,z:10},exit:{x:index*5,y:.85,z:11,yaw:.3}})),cameraPoints:[{distance:0,azimuth:0},{distance:48,azimuth:.5},{distance:96,azimuth:1}]};
 journey.walk={visible:()=>true,clear:()=>true,groundAt:()=>.85,layout:{stations:['visionx','beaconfire','amtrak'].map((contentId,index)=>({id:contentId,contentId,primary:true,readFull:true,x:5+index*5,y:.85,z:13,camera:{fitBounds:{min:[-1,0,-1],max:[1,3,1]}}}))}};
 character.walkWorld=journey.walk;journey.controller=new CareerTrainController(journey.railway,{island});
 journey.visual={mountPoint:new THREE.Group(),update(){}};scene.add(journey.visual.mountPoint);
 journey.marker={visible:false,position:new THREE.Vector3()};journey.ready=true;game.journey=journey;game.careerTrain=journey.controller;game.trainVisual=journey.visual;
 character.teleport(journey.world(journey.railway.stations[0].boarding),journey.walk);
 function finishTransition(){player.tick(.3);player.tick(.3);inputs.setEnabled(!game.frozen);}
 return {game,journey,player,character,events,inputs,scene,root,finishTransition};
}

test('boarding keeps one active actor, commits once behind the fade and does not become a drivable vehicle',()=>{
 const f=fixture();assert.equal(f.journey.board(),true);assert.equal(f.journey.board(),false,'repeated E cannot enqueue another board');
 assert.equal(f.player.activeActor,f.character);assert.equal(f.player.onLand,true);assert.equal(f.inputs.enabled,false);
 f.player.tick(.3);
 assert.equal(f.player.activeActor,f.journey.controller);assert.equal(f.player.ridingTrain,true);assert.equal(f.player.ridingVehicle,false);assert.equal(f.character.enabled,false);
 f.player.tick(.3);assert.equal(f.player.mode,'riding-train');assert.equal(f.journey.controller.passenger,true);
 assert.equal(f.journey.continue(),true);assert.equal(f.journey.controller.nextStation.id,'visionx');
 assert.equal(f.journey.leave(),false,'a moving carriage has no dismount exit');
});

test('background pauses a boarding transition both before and after its single commit',()=>{
 for(const committed of [false,true]){
  const f=fixture();f.journey.board();if(committed)f.player.tick(.3);
  const elapsed=f.player.transition.elapsed,epoch=f.player.transitionEpoch;
  f.player.pauseReasons.add('hidden');f.player.tick(10);
  assert.equal(f.player.transition.elapsed,elapsed);assert.equal(f.player.transitionEpoch,epoch);assert.equal(f.journey.controller.passenger,committed);
  f.player.pauseReasons.delete('hidden');f.player.tick(.6);
  assert.equal(f.player.mode,'riding-train');assert.equal(f.player.activeActor,f.journey.controller);
 }
});

test('Travel and Reset cancellation invalidate an uncommitted or committed ride without retaining Jack under the train',()=>{
 for(const committed of [false,true])for(const restoreLanding of [false,true]){
  const f=fixture();f.journey.board();if(committed){f.player.tick(.3);f.journey.visual.mountPoint.add(f.root);}
  const oldEpoch=f.player.transitionEpoch;
  f.journey.cancel({restoreLanding});
  assert.ok(f.player.transitionEpoch>oldEpoch);assert.equal(f.player.transition,null);assert.equal(f.player.mode,'walking');assert.equal(f.journey.controller.passenger,false);
  assert.equal(f.root.parent,f.scene,'single Jack returns to the scene before the train moves away');
  assert.equal(f.character.enabled,restoreLanding);if(restoreLanding)assert.deepEqual(f.character.position,f.player.berth.landing);
  f.player.tick(10);assert.equal(f.player.ridingTrain,false,'the previous fade callback cannot remount Jack');
  f.player.toSailing();assert.equal(f.player.activeActor,f.game.boat);assert.equal(f.player.onLand,false);
 }
});

test('stopped train exits use validated platform support and restore ordinary character movement',()=>{
 const f=fixture();f.journey.board();f.finishTransition();
 f.journey.walk.clear=()=>false;assert.equal(f.journey.leave(),false,'a blocked platform does not eject Jack');
 f.journey.walk.clear=()=>true;f.journey.walk.groundAt=()=>3;assert.equal(f.journey.leave(),false,'a missing floor does not eject Jack');
 f.journey.walk.groundAt=()=>.85;assert.equal(f.journey.leave(),true);assert.equal(f.player.ridingTrain,true,'the train owns the actor until the commit');
 f.finishTransition();assert.equal(f.player.mode,'walking');assert.equal(f.player.activeActor,f.character);assert.equal(f.character.enabled,true);assert.equal(f.journey.controller.passenger,false);
 assert.deepEqual(f.character.position,f.journey.world(f.journey.railway.stations[0].exit));
});

test('a platform blocked during the exit fade keeps the same passenger safely aboard at commit',()=>{
 const f=fixture();f.journey.board();f.finishTransition();f.journey.visual.mountPoint.add(f.root);
 const characterPosition={...f.character.position};
 assert.equal(f.journey.leave(),true);
 f.journey.walk.clear=()=>false;
 f.finishTransition();
 assert.equal(f.player.mode,'riding-train');assert.equal(f.journey.controller.passenger,true);assert.equal(f.character.enabled,false);
 assert.deepEqual(f.character.position,characterPosition,'an invalidated exit cannot move the capsule into the obstruction');
 assert.equal(f.root.parent,f.journey.visual.mountPoint,'Jack retains the original stable passenger mount');
 f.journey.walk.clear=()=>true;assert.equal(f.journey.leave(),true,'a later clear exit remains usable');f.finishTransition();assert.equal(f.player.mode,'walking');
});

test('call controls require a visible nearby platform and cannot summon to a remote station through automation',()=>{
 const f=fixture();assert.equal(f.journey.call('amtrak'),false);assert.equal(f.journey.controller.currentStation.id,'harbor');
 f.character.teleport(f.journey.world(f.journey.station('beaconfire').boarding),f.journey.walk);
 f.journey.walk.visible=()=>false;assert.equal(f.journey.call('beaconfire'),false);
 f.journey.walk.visible=()=>true;assert.equal(f.journey.call('beaconfire'),true);assert.equal(f.journey.controller.targetStationId,'beaconfire');assert.equal(f.journey.controller.passenger,false);
 const distance=f.journey.controller.distance;f.journey.step(1);assert.ok(f.journey.controller.distance>distance,'an empty called train follows its real route');
});

test('read-on-train preserves station identity and supplies a dedicated reader focus without marking a mere arrival viewed',()=>{
 const f=fixture();f.journey.board();f.finishTransition();assert.equal(f.journey.read(),false,'harbor is not an employer story');
 const stop=f.journey.station('visionx'),c=f.journey.controller;c.distance=stop.distance;c.previousDistance=c.distance;c.stationId='visionx';
 assert.equal(f.journey.read(),true);
 const event=f.events.at(-1);assert.equal(event[0],'exhibit');assert.equal(event[1][0].station.contentId,'visionx');assert.equal(event[1][0].station.trainReader,true);assert.equal(event[1][0].station.readFull,true);
 const focus=f.journey.readingFocus('visionx');assert.equal(focus.trainReader,true);assert.equal(focus.contentId,'visionx');assert.equal(focus.islandId,'experience');
 assert.equal(f.events.filter(event=>event[0]==='discovery').length,0,'transport cannot grant content-reading stamps');
});

test('pause freezes physical rail position, recovery continues and a safe return dismounts only at harbor',()=>{
 const f=fixture();f.journey.board();f.finishTransition();f.journey.continue();f.journey.step(5);
 const position={...f.journey.controller.position},distance=f.journey.controller.distance;f.journey.step(60,true);
 assert.equal(f.journey.controller.distance,distance);assert.deepEqual(f.journey.controller.position,position);
 f.journey.step(1,false);assert.ok(f.journey.controller.distance>distance);
 assert.equal(f.journey.returnToHarbor(),true);assert.equal(f.player.ridingTrain,true);assert.equal(f.journey.controller.targetStationId,'harbor');
 for(let frame=0;frame<20000&&!f.player.transitioning;frame++)f.journey.step(1/60,false);
 assert.equal(f.journey.controller.currentStation.id,'harbor');assert.equal(f.player.mode,'leaving-train');
 f.finishTransition();assert.equal(f.player.mode,'walking');assert.equal(f.journey.returningPassenger,false);
});

test('train cinematography changes smoothly without restarting island-direction fades',()=>{
 const f=fixture(),transition=new CameraTransition();f.journey.board();f.finishTransition();
 const camera=new THREE.PerspectiveCamera(28,1440/900,.2,600),rig=new CameraRig(camera,{walkZoom:1},1440,900);
 let last;
 for(let frame=0;frame<180;frame++){
  f.journey.controller.distance=frame*.2;
  const state={position:f.journey.controller.position,yaw:f.journey.controller.yaw,landAzimuth:f.journey.island.rotation,locomotion:'train',trainView:f.journey.cameraView()};
  transition.request(cameraAzimuth(state));assert.equal(transition.active,false,'changing authored view angles must not freeze the railway behind a fade');
  rig.update(1/60,state,frame===0);
  if(last)assert.ok(Math.abs(Math.atan2(Math.sin(rig.trainAzimuth-last),Math.cos(rig.trainAzimuth-last)))<.015,'view angle eases gradually');last=rig.trainAzimuth;
 }
});

test('the game keeps a passenger paused until both reading and background reasons are cleared',()=>{
 const f=fixture(),g=f.game;
 Object.assign(g,{loaded:new Map(),snapshot:null,props:{snapshot:()=>[]},challenges:{epoch:3,active:false,pause(){}},syncCameraTransition(){}});
 g.boat.snapshot=()=>({position:{...g.boat.position}});g.boat.hold=()=>{};
 f.journey.board();f.finishTransition();f.journey.continue();f.journey.step(2);
 const distance=f.journey.controller.distance,mode=f.player.mode;
 Game.prototype.pause.call(g,'read',{id:'experience'});
 Game.prototype.pause.call(g,'hidden',g.focus);
 f.journey.step(10,g.frozen);
 assert.equal(f.journey.controller.distance,distance);assert.equal(f.player.mode,mode);assert.equal(f.inputs.enabled,false);
 Game.prototype.resume.call(g,'read');
 assert.equal(g.mode,'hidden');assert.equal(f.player.ridingTrain,true);assert.equal(f.journey.controller.paused,true);assert.equal(f.inputs.enabled,false);
 Game.prototype.resume.call(g,'hidden');
 assert.equal(g.mode,'exploring');assert.equal(f.inputs.enabled,true);assert.equal(f.journey.controller.passenger,true);assert.equal(f.journey.controller.paused,false);
 f.journey.step(1);assert.ok(f.journey.controller.distance>distance,'the same carriage continues without restoring an old snapshot');
});

test('game Reset releases a travelling passenger at the island landing while the empty train returns along the rail',()=>{
 const f=fixture(),g=f.game;Object.assign(g,{cancelTravel(){this.player.pauseReasons.delete('travel');},cancelPractice(){}});
 f.journey.board();f.finishTransition();f.journey.continue();f.journey.step(5);
 const distance=f.journey.controller.distance;f.journey.visual.mountPoint.add(f.root);f.player.pauseReasons.add('read');g.mode='read';
 const result=Game.prototype.reset.call(g);
 assert.equal(result.id,'experience');assert.equal(f.player.mode,'walking');assert.equal(f.root.parent,f.scene);assert.equal(f.journey.controller.passenger,false);
 assert.equal(f.journey.controller.distance,distance,'Reset cannot jump the visible train to the harbor');assert.equal(f.journey.controller.targetStationId,'harbor');
 assert.deepEqual(f.character.position,f.player.berth.landing);assert.equal(f.inputs.enabled,true);assert.equal(f.player.pauseReasons.size,0);
 f.journey.step(1);assert.ok(f.journey.controller.distance>distance,'the unoccupied train still uses its ordinary route');
});
