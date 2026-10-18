import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PlayerController} from '../sources/core/player.js';
import {CareerTrainController,CAREER_TRAIN_MOTION} from '../sources/core/career-train.js';
import {CareerJourney} from '../sources/world/career-journey.js';
import {CameraRig,cameraAzimuth} from '../sources/core/camera.js';
import {CameraTransition} from '../sources/core/camera-transition.js';
import {Game} from '../sources/game.js';
import {careerRailway} from '../scripts/lib/career-railway-layout.mjs';

function fixture({open=true}={}){
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
 if(open)journey.railway=careerRailway();
 journey.walk={visible:()=>true,clear:()=>true,groundAt:()=>.85,layout:{stations:['visionx','beaconfire','amtrak'].map((contentId,index)=>({id:contentId,contentId,primary:true,readFull:true,x:5+index*5,y:.85,z:13,camera:{fitBounds:{min:[-1,0,-1],max:[1,3,1]}}}))}};
 if(open)journey.walk.groundAt=point=>point.y;
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
  f.player.pauseReasons.delete('hidden');f.player.tick(.2);f.player.tick(.2);
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
 f.journey.walk.groundAt=point=>point.y;assert.equal(f.journey.leave(),true);assert.equal(f.player.ridingTrain,true,'the train owns the actor until the commit');
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
 f.journey.walk.visible=()=>true;assert.equal(f.journey.call('beaconfire'),true);assert.equal(f.journey.controller.currentStation.id,'harbor','preparing the platform waits for the opaque commit');assert.equal(f.journey.controller.passenger,false);
 f.finishTransition();assert.equal(f.journey.controller.currentStation.id,'beaconfire');assert.equal(f.player.mode,'walking');assert.equal(f.player.activeActor,f.character);
 const distance=f.journey.controller.distance;f.journey.step(1);assert.equal(f.journey.controller.distance,distance,'the prepared empty train waits at the requested platform');
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
 const f=fixture();f.journey.board();f.finishTransition();f.journey.continue();f.journey.step(2);
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
 f.journey.step(1);assert.ok(f.journey.controller.distance<distance,'the unoccupied cabin brakes and returns on the actual line');
});

for(const id of['harbor','visionx','beaconfire','amtrak'])test(`V20 ${id} boards the same train at the opaque midpoint even while an empty return is elsewhere`,()=>{
 const f=fixture(),c=f.journey.controller;c.call('amtrak');c.step(3);c.cancelRide();
 f.character.teleport(f.journey.world(f.journey.station(id).boarding),f.journey.walk);
 const original=c.distance;f.journey.nearby();assert.equal(f.game.canBoardTrain,true);
 assert.equal(f.journey.board(),true);assert.equal(f.player.transition.duration,.4);assert.equal(f.journey.board(),false);
 f.player.tick(.19);f.journey.step(0,true);assert.equal(c.distance,original);assert.equal(c.passenger,false);
 f.player.tick(.07);assert.equal(f.player.transitionOpacity,1);assert.equal(c.currentStation.id,id);assert.equal(c.passenger,true);assert.equal(f.player.activeActor,c);
 assert.equal(c.distance,c.previousDistance);assert.equal(c.speed,0);assert.deepEqual(c.carPose(0,0),c.carPose(0,1));
 f.journey.step(0,true);assert.equal(f.journey.status().autoDepartureRemaining,.6,'boarding freeze does not consume its timer');
 f.player.tick(.2);assert.equal(f.player.mode,'riding-train');f.journey.step(.59);assert.equal(c.state,'stopped');
 f.journey.step(.01);assert.equal(c.state,'moving');assert.equal(c.targetStationId,c.stations[(c.stations.findIndex(s=>s.id===id)+1)%4].id);
});

for(const defect of['blocked','missing-floor','hidden-platform','left-platform'])test(`V20 boarding revalidates a ${defect} before its opaque commit`,()=>{
 const f=fixture(),c=f.journey.controller;c.parkAtStation('amtrak');const original=c.distance;
 assert.equal(f.journey.board(),true);
 if(defect==='blocked')f.journey.walk.clear=()=>false;
 if(defect==='missing-floor')f.journey.walk.groundAt=()=>NaN;
 if(defect==='hidden-platform')f.journey.walk.visible=()=>false;
 if(defect==='left-platform')f.character.position.x+=10;
 f.player.tick(.2);assert.equal(f.player.transitionOpacity,1);assert.equal(f.player.activeActor,f.character,'a rejected board retains the walking actor during fade-in');
 assert.equal(c.distance,original);assert.equal(c.passenger,false);assert.equal(f.journey.autoDeparture,null);f.player.tick(.2);
 assert.equal(f.player.mode,'walking');assert.equal(f.character.enabled,true);
});

test('V20 successful entry cleans the train, passenger anchor, timer and both kinematic poses before the overview',()=>{
 const f=fixture(),c=f.journey.controller,poses=[];f.journey.board();f.finishTransition();f.journey.continue();f.journey.step(3);
 f.journey.visual.mountPoint.add(f.root);f.journey.returningPassenger=true;f.journey.scheduleDeparture('station',4);
 f.journey.colliders=c.cars.map((_,index)=>({body:{setTranslation(p){poses[index]={position:{...p}};},setRotation(q){poses[index].rotation=q.clone();},setNextKinematicTranslation(p){poses[index].next={...p};},setNextKinematicRotation(q){poses[index].nextRotation=q.clone();}}}));
 assert.equal(f.journey.prepareEntry(),true);assert.equal(c.currentStation.id,'harbor');assert.equal(c.passenger,false);assert.equal(c.mission,null);assert.equal(c.targetStationId,null);
 assert.equal(c.speed,0);assert.equal(c.distance,c.previousDistance);assert.deepEqual(c.velocity,{x:0,y:0,z:0});assert.equal(f.journey.autoDeparture,null);assert.equal(f.journey.returningPassenger,false);
 assert.equal(f.root.parent,f.scene);assert.equal(f.game.jack.pose,'idle');
 for(let index=0;index<c.cars.length;index++){assert.deepEqual(poses[index].position,c.carPose(index));assert.deepEqual(poses[index].next,c.carPose(index));assert.deepEqual(poses[index].rotation,poses[index].nextRotation);assert.ok(Math.abs(poses[index].rotation.x)<1e-8,'entry collider remains level');}
});

test('V22 an uninterrupted tour has 2.5-second stops and finishes within 30–35 seconds',()=>{
 const f=fixture(),railway=careerRailway();f.journey.railway=railway;f.journey.controller=new CareerTrainController(railway,{island:f.journey.island});f.game.careerTrain=f.journey.controller;
 f.journey.walk.groundAt=point=>point.y;f.character.teleport(f.journey.world(railway.stations[0].boarding),f.journey.walk);
 f.journey.board();f.finishTransition();let seconds=0,previous='harbor';const arrivals=[];
 for(let frame=0;frame<4000;frame++){
  f.journey.step(1/60);seconds+=1/60;const c=f.journey.controller,id=c.currentStation?.id;
  if(id&&id!==previous){arrivals.push(id);previous=id;if(id==='harbor')break;assert.equal(f.journey.autoDeparture.duration,2.5);assert.equal(f.journey.autoDeparture.remaining,2.5);}
 }
 assert.deepEqual(arrivals,['visionx','beaconfire','amtrak','harbor']);assert.ok(seconds+.4>=30&&seconds+.4<=35,`automatic tour took ${seconds}s`);
 assert.equal(f.journey.autoDeparture,null);const distance=f.journey.controller.distance;f.journey.step(10);assert.equal(f.journey.controller.distance,distance,'the tour does not silently start another lap');
});

for(const reason of['read','leave','keyboard-focus','menu','hidden'])test(`V20 ${reason} cancels a station countdown and does not restart it on resume`,()=>{
 const f=fixture();f.journey.board();f.finishTransition();f.journey.continue();
 while(f.journey.controller.state!=='stopped')f.journey.step(1/60);
 assert.equal(f.journey.autoDeparture.remaining,2.5);f.journey.step(1);assert.equal(f.journey.autoDeparture.remaining,1.5);
 f.journey.holdDeparture(reason);f.journey.step(10,true);f.journey.step(0,false);const distance=f.journey.controller.distance;
 f.journey.step(10);assert.equal(f.journey.autoDeparture,null);assert.equal(f.journey.controller.distance,distance);assert.equal(f.journey.controller.currentStation.id,'visionx');
 assert.equal(f.journey.continue(),true,'explicit Continue remains available');
});

for(const afterCommit of[false,true])test(`V20 an interruption ${afterCommit?'after':'before'} boarding commit suppresses its pending automatic departure`,()=>{
 const f=fixture();f.journey.board();if(afterCommit)f.player.tick(.2);
 f.journey.holdDeparture('hidden');f.player.pauseReasons.add('hidden');f.player.tick(1);f.journey.step(1,true);
 f.player.pauseReasons.delete('hidden');f.finishTransition();f.journey.step(10,false);
 assert.equal(f.player.mode,'riding-train');assert.equal(f.journey.controller.currentStation.id,'harbor');assert.equal(f.journey.autoDeparture,null);
});

test('V20 moving pauses preserve the destination, while a rejected exit consumes the station countdown',()=>{
 const f=fixture();f.journey.board();f.finishTransition();f.journey.step(CAREER_TRAIN_MOTION.boardingDelay);f.journey.step(1);
 const target=f.journey.controller.targetStationId,distance=f.journey.controller.distance;f.journey.holdDeparture('menu');f.journey.step(10,true);
 assert.equal(f.journey.controller.distance,distance);assert.equal(f.journey.controller.targetStationId,target);f.journey.step(1,false);assert.ok(f.journey.controller.distance>distance);
 while(f.journey.controller.state!=='stopped')f.journey.step(1/60);
 assert.ok(f.journey.autoDeparture);f.journey.walk.clear=()=>false;assert.equal(f.journey.leave(),false);assert.equal(f.journey.autoDeparture,null);
 const stopped=f.journey.controller.distance;f.journey.step(10);assert.equal(f.journey.controller.distance,stopped);
});

test('V20 canceled platform preparation cannot commit late or change the walking actor',()=>{
 const f=fixture();f.character.teleport(f.journey.world(f.journey.station('amtrak').boarding),f.journey.walk);
 const c=f.journey.controller,before=c.distance,position={...f.character.position};assert.equal(f.journey.call('amtrak'),true);assert.equal(f.player.activeActor,f.character);
 f.player.tick(.1);f.journey.cancel();f.player.tick(2);assert.equal(f.player.mode,'walking');assert.equal(c.distance,before);assert.deepEqual(f.character.position,position);assert.equal(c.passenger,false);
});

test('V20 preparing an empty train never relocates its body through a visitor beside the platform',()=>{
 const f=fixture(),c=f.journey.controller;let clear=true;c.intersectsPedestrian=()=>!clear;
 clear=false;assert.equal(f.journey.call('harbor'),false,'a future carriage envelope is checked before fading');assert.equal(f.player.mode,'walking');
 clear=true;c.parkAtStation('amtrak');const distance=c.distance;assert.equal(f.journey.call('harbor'),true);clear=false;f.finishTransition();
 assert.equal(c.distance,distance,'late pedestrian entry prevents the opaque relocation');assert.equal(f.player.mode,'walking');assert.equal(c.passenger,false);
});

test('legacy moving camera still interpolates authored look targets continuously through wrap',()=>{
 const f=fixture({open:false}),c=f.journey.controller;f.journey.railway.cameraPoints=[{distance:0,azimuth:.2,elevation:.56,viewDistance:32,lookAt:[0,3,0]},{distance:c.length/2,azimuth:.3,elevation:.60,viewDistance:36,lookAt:[8,5,4]}];
 c.distance=c.length/4;c.stationId=null;c.state='moving';const view=f.journey.cameraView();
 assert.equal(view.distance,34);assert.ok(Math.abs(view.elevation-.58)<1e-8);const expected=f.journey.world({x:4,y:4,z:2});for(const axis of['x','y','z'])assert.ok(Math.abs(view.lookAt[axis]-expected[axis])<1e-8);
 const cabin=c.carPose(0);assert.equal(view.center.x,cabin.x);assert.equal(view.center.z,cabin.z);assert.ok(Math.abs(view.center.y-cabin.y-c.spec.floorY)<1e-8);
 c.distance=c.length-1e-5;const end=f.journey.cameraView();c.distance=1e-5;const start=f.journey.cameraView();
 assert.ok(new THREE.Vector3(...Object.values(end.lookAt).slice(0,3)).distanceTo(new THREE.Vector3(...Object.values(start.lookAt).slice(0,3)))<1e-5);
});

test('open-line camera keys clamp independently at both ends and use the single level cabin center',()=>{
 const f=fixture(),c=f.journey.controller;
 f.journey.railway.cameraPoints=[{distance:5,azimuth:.1,elevation:.5,viewDistance:35,lookAt:[1,6,10]},{distance:35,azimuth:.3,elevation:.6,viewDistance:39,lookAt:[-2,22,-10]}];
 for(const [distance,key]of[[-1,0],[0,0],[40,1],[c.length+1,1]]){
  c.distance=c.previousDistance=distance;const view=f.journey.cameraView(),expected=f.journey.railway.cameraPoints[key],p=c.carPose(0),look=f.journey.world({x:expected.lookAt[0],y:expected.lookAt[1],z:expected.lookAt[2]});
  assert.equal(view.azimuth,f.journey.island.rotation+expected.azimuth);assert.equal(view.distance,expected.viewDistance);assert.deepEqual(view.lookAt,look);assert.deepEqual(view.center,{x:p.x,y:p.y+c.spec.floorY,z:p.z});
 }
 c.distance=c.previousDistance=20;const up=f.journey.cameraView();c.direction=-1;assert.deepEqual(f.journey.cameraView(),up,'descent keeps the same authored angle and facing');
});

test('summit read holds automatic descent until Continue, then skips intermediate stops and stays aboard at Harbor',()=>{
 const f=fixture(),c=f.journey.controller;f.character.teleport(f.journey.world(f.journey.station('beaconfire').boarding),f.journey.walk);
 f.journey.board();f.finishTransition();f.journey.continue();while(c.state!=='stopped')f.journey.step(1/60);
 assert.equal(c.currentStation.id,'amtrak');assert.equal(f.journey.autoDeparture.remaining,2.5);assert.equal(f.journey.status().progress,1);
 f.journey.step(2);assert.equal(f.journey.read(),true);f.journey.step(5,true);f.journey.step(0,false);f.journey.step(10);assert.equal(c.currentStation.id,'amtrak');assert.equal(f.journey.autoDeparture,null);
 assert.equal(f.journey.continue(),true);assert.equal(c.targetStationId,'harbor');assert.equal(c.direction,-1);
 const stops=[];while(c.state!=='stopped'){f.journey.step(1/60);if(c.currentStation)stops.push(c.currentStation.id);assert.equal(f.journey.autoDeparture,null);}
 assert.deepEqual(stops,['harbor']);assert.equal(f.player.mode,'riding-train');assert.equal(c.passenger,true);assert.equal(f.journey.status().progress,0);assert.equal(f.journey.autoDeparture,null);
});

test('pausing direct descent preserves Harbor target without creating intermediate dwell timers',()=>{
 const f=fixture(),c=f.journey.controller;f.character.teleport(f.journey.world(f.journey.station('amtrak').boarding),f.journey.walk);f.journey.board();f.finishTransition();f.journey.continue();f.journey.step(3);
 const distance=c.distance;f.journey.holdDeparture('hidden');f.journey.step(20,true);assert.equal(c.distance,distance);assert.equal(c.direction,-1);assert.equal(c.targetStationId,'harbor');assert.equal(c.speed,0);
 f.journey.step(1/60,false);assert.ok(c.distance<distance);assert.ok(c.speed<=c.motion.acceleration/60+1e-8);assert.equal(f.journey.autoDeparture,null);
});

function atWelcome(f){
 f.character.teleport(f.journey.world({x:0,y:.85,z:35.5}),f.journey.walk);
 return f;
}

test('V22 Start tour works from the welcome bridge, but does not broaden ordinary E boarding',()=>{
 const f=atWelcome(fixture()),c=f.journey.controller;
 c.parkAtStation('amtrak');const original=c.distance,origin={...f.character.position};
 assert.equal(f.journey.board(),false,'E remains tied to the nearby platform');
 assert.equal(f.journey.status().canStartFromHarbor,true);
 assert.equal(f.journey.startFromHarbor(),true);assert.equal(f.journey.startFromHarbor(),false);
 f.player.tick(.19);assert.equal(c.distance,original);assert.equal(c.passenger,false);assert.deepEqual(f.character.position,origin);
 f.player.tick(.01);assert.equal(f.player.transitionOpacity,1);assert.equal(c.currentStation.id,'harbor');assert.equal(c.passenger,true);
 assert.equal(f.player.activeActor,c);assert.equal(f.character.enabled,false);assert.equal(c.distance,c.previousDistance);
 assert.deepEqual(c.carPose(0,0),c.carPose(0,1));assert.equal(f.journey.status().canStartFromHarbor,false);
 f.player.tick(.2);f.journey.step(.6);assert.equal(c.targetStationId,'visionx');
});

for(const defect of ['outside','other-island','wrong-height','no-floor','blocked-origin','blocked-platform','not-ready','paused','vehicle'])test(`V22 Start tour refuses ${defect} without moving Jack or the cabin`,()=>{
 const f=atWelcome(fixture()),c=f.journey.controller,original=c.distance;
 if(defect==='outside')f.character.position.x+=40;
 if(defect==='other-island')f.player.island={...f.player.island,id:'education'};
 if(defect==='wrong-height')f.character.position.y=8;
 if(defect==='no-floor')f.journey.walk.groundAt=()=>NaN;
 if(defect==='blocked-origin')f.journey.walk.clear=point=>Math.abs(point.y-.85)>.1;
 if(defect==='blocked-platform')f.journey.walk.clear=point=>Math.abs(point.y-.85)<.1;
 if(defect==='not-ready')f.journey.ready=false;
 if(defect==='paused')f.player.pauseReasons.add('hidden');
 if(defect==='vehicle')f.player.mode='riding-car';
 const origin={...f.character.position};assert.equal(f.journey.canStartFromHarbor(),false);assert.equal(f.journey.startFromHarbor(),false);
 assert.equal(c.distance,original);assert.equal(c.passenger,false);assert.deepEqual(f.character.position,origin);assert.ok(!f.player.transition);
});

for(const defect of ['blocked-platform','missing-floor','left-zone','cancelled','background'])test(`V22 Start tour rechecks ${defect} at its opaque commit`,()=>{
 const f=atWelcome(fixture()),c=f.journey.controller;c.parkAtStation('amtrak');const original=c.distance,origin={...f.character.position};
 assert.equal(f.journey.startFromHarbor(),true);
 if(defect==='blocked-platform')f.journey.walk.clear=point=>point.y<1;
 if(defect==='missing-floor')f.journey.walk.groundAt=point=>point.y>1?NaN:point.y;
 if(defect==='left-zone')f.character.position.x+=40;
 if(defect==='cancelled')f.journey.cancel({restoreLanding:false});
 if(defect==='background'){
  f.player.pauseReasons.add('hidden');f.player.tick(10);f.journey.step(10,true);
  assert.equal(c.distance,original);assert.equal(c.passenger,false);assert.deepEqual(f.character.position,origin);
  f.player.pauseReasons.clear();f.finishTransition();f.journey.step(5);
  assert.equal(c.currentStation.id,'harbor');assert.equal(c.passenger,true);assert.equal(f.journey.autoDeparture,null);return;
 }
 f.finishTransition();assert.equal(c.distance,original);assert.equal(c.passenger,false);assert.equal(f.player.mode,'walking');assert.equal(f.journey.autoDeparture,null);
 if(defect!=='left-zone')assert.deepEqual(f.character.position,origin);
});

test('V22 journey timers use the controller motion config rather than stale global defaults',()=>{
 const f=fixture(),c=f.journey.controller;c.motion.boardingDelay=.25;c.motion.stationDwell=1.75;
 f.journey.board();f.finishTransition();assert.equal(f.journey.autoDeparture.duration,.25);
 f.journey.step(.25);while(c.state!=='stopped')f.journey.step(1/60);
 assert.equal(f.journey.autoDeparture.duration,1.75);assert.equal(f.journey.autoDeparture.remaining,1.75);
});

for(const fps of [30,60,120])test(`V22 whole automatic journey stays within 30–35 seconds at ${fps} FPS`,()=>{
 const f=atWelcome(fixture());f.journey.startFromHarbor();let seconds=0,previous='harbor',motion=0;const stops=[];
 for(let n=0;n<fps*40;n++){
  const transitioning=f.player.transitioning;f.player.tick(1/fps);f.journey.step(transitioning?0:1/fps,f.game.frozen);
  seconds+=1/fps;if(f.journey.controller.state!=='stopped')motion+=1/fps;
  const id=f.journey.controller.currentStation?.id;
  if(id&&id!==previous){stops.push(id);previous=id;if(id==='harbor')break;}
 }
 assert.deepEqual(stops,['visionx','beaconfire','amtrak','harbor']);assert.ok(seconds>=30&&seconds<=35,`${seconds}s`);
 assert.ok(Math.abs(motion-24.617)<.3,`motion ${motion}s`);assert.equal(f.player.ridingTrain,true);assert.equal(f.journey.autoDeparture,null);
});
