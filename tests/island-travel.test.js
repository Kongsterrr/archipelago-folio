import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3,Mesh,BoxGeometry,MeshBasicMaterial} from 'three';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {Game} from '../sources/game.js';
import {BoatController} from '../sources/core/boat.js';
import {CharacterController,IslandWalkWorld,localToWorld,SEA_GROUP} from '../sources/core/character.js';
import {PlayerController,BoardingController} from '../sources/core/player.js';
import {ChallengeManager} from '../sources/core/challenges.js';
import {EstatePracticeController} from '../sources/core/estate-practice.js';
import {IslandArrival} from '../sources/core/island-arrival.js';
import {islands} from '../sources/config.js';

const layouts=new Map(JSON.parse(fs.readFileSync(new URL('../static/models/walk-layout.json',import.meta.url))).islands.map(layout=>[layout.id,layout]));
const about=islands.find(island=>island.id==='about');
const experience=islands.find(island=>island.id==='experience');
const projects=islands.find(island=>island.id==='projects');
const close=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-5,`${label}: ${actual} != ${expected}`);
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
await R.init();

function vehicle(id,index){
 return{id,position:{x:about.x+index*3,y:.85,z:about.z},yaw:0,velocity:{x:0,y:0,z:0},parked:true,occupied:false,
  hold(){this.velocity={x:0,y:0,z:0};},
  park(value){this.parked=value;this.hold();},
  setOccupied(value){this.occupied=value;},
  get speed(){return Math.hypot(this.velocity.x,this.velocity.z);},
 };
}

function fixture(t,{origin='walking'}={}){
 const world=new R.World({x:0,y:0,z:0});
 t.after(()=>world.free());
 const walks=new Map();
 const walkFor=island=>{
  if(!walks.has(island.id))walks.set(island.id,new IslandWalkWorld(R,world,island,layouts.get(island.id)));
  return walks.get(island.id);
 };
 const walk=walkFor(about),boat=new BoatController(R,world,{...about.dock,yaw:about.yaw});
 const character=new CharacterController(R,world),player=new PlayerController(boat,character);
 const landing=localToWorld(about,{...walk.layout.berths[0].landing,yaw:0});
 character.teleport(landing,walk);character.enable(true);boat.park(true);
 player.mode='walking';player.island=about;player.berth={boat:localToWorld(about,walk.layout.berths[0].boat),landing};
 const cars=['911','g63','ferrari','raptor'].map(vehicle),quad=vehicle('quad',4),bicycle=vehicle('bicycle',5);
 const messages=[],events=[];
 const inputs={enabled:true,keys:new Set(['KeyW']),clear(){this.keys.clear();},setEnabled(value){this.clear();this.enabled=value;}};
 const game=Object.assign(Object.create(Game.prototype),{
  world,boat,character,player,garageCars:cars,quadBike:quad,bicycle,inputs,
  mode:'exploring',settings:{reduced:false,zoom:1,walkZoom:1},loaded:new Map(),walkLayouts:layouts,walkWorlds:walks,landActions:new Map(),
  challenges:new ChallengeManager(),props:{snapshot:()=>[],resetCargo(){},resetNear(){}},
  practiceView:{update(){}},jack:{root:{position:new Vector3().copy(character.position)},resetPose(){},estatePose:{reset(){}}},
  events:{trigger(name,args=[]){events.push({name,args});if(name==='message')messages.push(args[0]);}},
  feedback:{clear(){}},fleet:{onTravel(){}},marine:{onTravel(){}},docks:{reset(){}},
  prev:new Vector3().copy(boat.position),prevYaw:boat.yaw,visualPosition:new Vector3().copy(boat.position),
  accumulator:0,focus:null,snapshot:null,pendingResume:null,travelEpoch:0,
  clearWake(){},resetCamera(){},syncCameraTransition(){},updateNearby(){},safePoint:point=>point,
  prepareAshore:async island=>walkFor(island),
 });
 game.practice=new EstatePracticeController({onEvent:event=>game.practiceEvent(event)});
 game.boarding=new BoardingController(player,{
  prepare:island=>game.prepareAshore(island),select:(island,prepared)=>game.selectBerth(island,prepared),
  onCommit:(...args)=>game.commitBoarding(...args),onError:error=>messages.push(error.message),
 });
 if(origin==='car'){assert.ok(player.rideCar(cars[3]));cars[3].park(false);cars[3].setOccupied(true);cars[3].velocity={x:2,y:0,z:1};}
 else if(origin==='quad'){assert.ok(player.rideQuad(quad));quad.park(false);quad.velocity={x:2,y:0,z:1};}
 else if(origin==='bicycle'){assert.ok(player.rideBicycle(bicycle));bicycle.park(false);bicycle.velocity={x:2,y:0,z:1};}
 else if(origin==='sailing'){player.toSailing();boat.park(false);}
 return{game,world,boat,character,player,cars,quad,bicycle,messages,events,walkFor};
}

function assertAtLanding(f,island){
 const {game,player,character,boat}=f;
 assert.equal(player.mode,'walking');assert.equal(player.island,island);assert.equal(player.activeActor,character);
 assert.equal(player.transition,null);assert.equal(character.active,true);assert.equal(character.seated,false);
 assert.equal(character.walkWorld,f.walkFor(island));
 for(const axis of ['x','y','z'])close(character.position[axis],player.berth.landing[axis],`landing ${axis}`);
 close(character.yaw,island.rotation,'faces inland');
 assert.ok(character.walkWorld.clear(character.position),'the landing capsule is wholly on clear dock ground');
 close(character.position.y,character.walkWorld.groundAt(character.position),'standing on the bridge surface');
 assert.equal(boat.parked,true);assert.equal(boat.body.bodyType(),R.RigidBodyType.KinematicPositionBased);
 for(const axis of ['x','z'])close(boat.position[axis],player.berth.boat[axis],`boat berth ${axis}`);
 close(boat.yaw,player.berth.boat.yaw,'boat retains berth heading');
 assert.equal(boat.speed,0);assert.equal(game.snapshot,null);assert.equal(game.pendingResume,null);
}

for(const [index,island]of islands.entries())test(`Travel to ${island.id} lands Jack on its real bridge and parks every old vehicle`,async t=>{
 const f=fixture(t,{origin:['car','quad','bicycle','walking'][index]});
 const parkedPositions=[...f.cars,f.quad,f.bicycle].map(item=>({...item.position}));
 const epoch=f.game.beginTravel();
 assert.equal(f.game.inputs.enabled,false);assert.equal(f.game.inputs.keys.size,0);
 assert.equal(await f.game.travelToIsland(island,epoch),true);
 assertAtLanding(f,island);
 for(const item of [...f.cars,f.quad,f.bicycle]){assert.equal(item.parked,true);assert.equal(item.speed,0);}
 for(const car of f.cars)assert.equal(car.occupied,false);
 assert.deepEqual([...f.cars,f.quad,f.bicycle].map(item=>({...item.position})),parkedPositions);
 f.game.finishTravel(epoch);f.game.resume('read');
 assert.equal(f.player.mode,'walking','a late close of the old reader must not restore the old vehicle');
 assert.equal(f.player.pauseReasons.has('travel'),false);
 assert.equal(f.game.inputs.enabled,!f.game.frozen);
});

test('beginTravel ends old practice, challenge, snapshots and a boarding transition before preparation',t=>{
 const f=fixture(t);
 f.game.practice.configure(layouts.get('about').sports,.85);f.game.practice.start('tennis');
 f.game.challenges.start('cargo');
 const oldSnapshot={epoch:f.game.challenges.epoch};f.game.snapshot=oldSnapshot;f.game.pendingResume={epoch:f.game.challenges.epoch};
 assert.equal(f.game.boarding.board(),true);
 const playerEpoch=f.player.transitionEpoch,challengeEpoch=f.game.challenges.epoch,practiceEpoch=f.game.practice.epoch;
 f.player.pauseReasons.add('read');
 const epoch=f.game.beginTravel();
 assert.ok(epoch>0);assert.ok(f.player.transitionEpoch>playerEpoch);assert.equal(f.player.transition,null);
 assert.equal(f.player.mode,'walking');assert.equal(f.game.challenges.state,'idle');assert.equal(f.game.practice.state,'idle');
 assert.ok(f.game.challenges.epoch>challengeEpoch);assert.ok(f.game.practice.epoch>practiceEpoch);
 assert.notEqual(f.game.snapshot,oldSnapshot);assert.equal(f.game.pendingResume,null);
 assert.equal(f.player.pauseReasons.has('read'),false);assert.equal(f.player.pauseReasons.has('travel'),true);
 assert.equal(f.game.inputs.enabled,false);
});

for(const oldFinishesFirst of [true,false])test(`only the newest Travel can commit when ${oldFinishesFirst?'A':'B'} finishes loading first`,async t=>{
 const f=fixture(t),a=deferred(),b=deferred();
 f.game.prepareAshore=island=>island===experience?a.promise:b.promise;
 const original={...f.character.position};
 const firstEpoch=f.game.beginTravel(),first=f.game.travelToIsland(experience,firstEpoch);
 const secondEpoch=f.game.beginTravel(),second=f.game.travelToIsland(projects,secondEpoch);
 if(oldFinishesFirst){
  a.resolve(f.walkFor(experience));assert.equal(await first,false);
  f.game.finishTravel(firstEpoch);
  assert.deepEqual(f.character.position,original);assert.equal(f.player.island,about);
  assert.equal(f.player.pauseReasons.has('travel'),true);assert.equal(f.game.inputs.enabled,false);
 }
 b.resolve(f.walkFor(projects));assert.equal(await second,true);f.game.finishTravel(secondEpoch);
 assertAtLanding(f,projects);
 const latestPosition={...f.character.position},latestBerth=f.player.berth;
 if(!oldFinishesFirst){a.resolve(f.walkFor(experience));assert.equal(await first,false);f.game.finishTravel(firstEpoch);}
 assert.deepEqual(f.character.position,latestPosition);assert.equal(f.player.berth,latestBerth);
 assert.equal(f.player.island,projects);assert.equal(f.player.pauseReasons.has('travel'),false);
 assert.equal(f.game.inputs.enabled,!f.game.frozen);
});

for(const cancel of ['reset','teleport','startChallenge'])test(`${cancel} invalidates a pending Travel before its assets resolve`,async t=>{
 const f=fixture(t),loading=deferred();f.game.prepareAshore=()=>loading.promise;
 const epoch=f.game.beginTravel(),pending=f.game.travelToIsland(experience,epoch);
 if(cancel==='reset')f.game.reset();else if(cancel==='startChallenge')f.game.startChallenge('buoy');else f.game.teleport({x:0,z:42,yaw:.2});
 const state={mode:f.player.mode,island:f.player.island,boat:{...f.boat.position},character:{...f.character.position}};
 const challenge={epoch:f.game.challenges.epoch,kind:f.game.challenges.kind,state:f.game.challenges.state};
 loading.resolve(f.walkFor(experience));assert.equal(await pending,false);f.game.finishTravel(epoch);
 assert.deepEqual({mode:f.player.mode,island:f.player.island,boat:{...f.boat.position},character:{...f.character.position}},state);
 assert.deepEqual({epoch:f.game.challenges.epoch,kind:f.game.challenges.kind,state:f.game.challenges.state},challenge);
 assert.equal(f.player.pauseReasons.has('travel'),false);
 assert.equal(f.game.inputs.enabled,!f.game.frozen);
});

test('Travel invalidates a manual E preparation without letting its late completion clear the new request',async t=>{
 const f=fixture(t,{origin:'sailing'}),manual=deferred(),travel=deferred();
 f.game.prepareAshore=island=>island===about?manual.promise:travel.promise;
 const boarding=f.game.boarding.disembark(about);assert.equal(f.game.boarding.pending,true);
 const epoch=f.game.beginTravel(),pending=f.game.travelToIsland(experience,epoch);
 manual.resolve(f.walkFor(about));assert.equal(await boarding,false);
 assert.equal(f.player.transition,null);assert.equal(f.player.mode,'sailing');
 assert.equal(f.player.pauseReasons.has('travel'),true);assert.equal(f.game.inputs.enabled,false);
 travel.resolve(f.walkFor(experience));assert.equal(await pending,true);f.game.finishTravel(epoch);
 assertAtLanding(f,experience);
});

for(const reasons of [['read'],['hidden'],['read','hidden']])test(`Travel completion retains ${reasons.join(' + ')} added while loading`,async t=>{
 const f=fixture(t),loading=deferred();f.game.prepareAshore=()=>loading.promise;
 f.game.pause('read',{id:'old-reader'});
 const epoch=f.game.beginTravel(),pending=f.game.travelToIsland(experience,epoch);
 assert.equal(f.player.pauseReasons.has('read'),false,'the originating reader was consumed by Travel');
 const newFocus={id:'new-reader'};
 for(const reason of reasons)f.game.pause(reason,reason==='read'?newFocus:f.game.focus);
 loading.resolve(f.walkFor(experience));assert.equal(await pending,true);f.game.finishTravel(epoch);
 assertAtLanding(f,experience);
 for(const reason of reasons)assert.equal(f.player.pauseReasons.has(reason),true);
 assert.equal(f.player.pauseReasons.has('travel'),false);assert.equal(f.game.inputs.enabled,false);assert.equal(f.game.frozen,true);
 if(reasons.includes('read'))assert.equal(f.game.focus,newFocus,'the new reader retains its own camera focus');
 for(const [index,reason]of reasons.entries()){
  f.game.resume(reason);
  if(index<reasons.length-1){assert.equal(f.game.inputs.enabled,false);assert.equal(f.game.frozen,true);}
 }
 assert.equal(f.player.pauseReasons.size,0);assert.equal(f.game.inputs.enabled,!f.game.frozen);
 assert.equal(f.player.mode,'walking');
});

for(const failure of ['loading','both berths occupied'])test(`failed Travel (${failure}) preserves the original actor and can be retried`,async t=>{
 const f=fixture(t,{origin:'car'}),original={character:{...f.character.position},boat:{...f.boat.position},car:f.player.car};
 const blockers=[];
 if(failure==='loading')f.game.prepareAshore=async()=>{throw new Error('Island failed to load');};
 else for(const berth of layouts.get('experience').berths){
  const p=localToWorld(experience,berth.boat);
  const body=f.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(p.x,.35,p.z));
  f.world.createCollider(R.ColliderDesc.cuboid(1.2,.8,2.5).setCollisionGroups(SEA_GROUP),body);blockers.push(body);
 }
 const epoch=f.game.beginTravel();assert.equal(await f.game.travelToIsland(experience,epoch),false);f.game.finishTravel(epoch);
 assert.equal(f.player.mode,'riding-car');assert.equal(f.player.car,original.car);assert.equal(f.player.activeActor,original.car);
 assert.equal(original.car.occupied,true);assert.equal(original.car.parked,false,'failed preparation must retain a usable original vehicle');
 assert.deepEqual(f.character.position,original.character);assert.deepEqual({...f.boat.position},original.boat);
 assert.equal(f.player.pauseReasons.has('travel'),false);assert.equal(f.game.inputs.enabled,!f.game.frozen);
 assert.ok(f.messages.length>0,'a failed arrival explains why Jack did not move');
 for(const body of blockers)f.world.removeRigidBody(body);
 f.game.prepareAshore=async island=>f.walkFor(island);
 const retry=f.game.beginTravel();assert.equal(await f.game.travelToIsland(experience,retry),true);f.game.finishTravel(retry);
 assertAtLanding(f,experience);
});

for(const kind of ['boarding','disembarking'])for(const elapsed of [.2,.4])test(`failed Travel during ${kind} at ${elapsed}s retains the last committed actor`,async t=>{
 const f=fixture(t,{origin:kind==='boarding'?'walking':'sailing'});
 if(kind==='boarding')assert.equal(f.game.boarding.board(),true);
 else assert.equal(await f.game.boarding.disembark(about),true);
 f.player.tick(elapsed);
 const expected=kind==='boarding'?(elapsed<.3?'walking':'sailing'):(elapsed<.3?'sailing':'walking');
 const position={boat:{...f.boat.position},character:{...f.character.position}};
 f.game.prepareAshore=async()=>{throw new Error('Island failed to load');};
 const epoch=f.game.beginTravel();assert.equal(await f.game.travelToIsland(experience,epoch),false);f.game.finishTravel(epoch);
 assert.equal(f.player.mode,expected);assert.equal(f.player.transition,null);
 assert.equal(f.player.activeActor,expected==='walking'?f.character:f.boat);
 assert.equal(f.character.active,expected==='walking');assert.equal(f.boat.parked,expected==='walking');
 assert.deepEqual({boat:{...f.boat.position},character:{...f.character.position}},position);
 f.player.tick(1);assert.equal(f.player.mode,expected,'the canceled midpoint callback cannot fire later');
});

function enableArrival(f,t){
 f.game.arrival=new IslandArrival();
 const geometry=new BoxGeometry(2,4,2),material=new MeshBasicMaterial();
 t.after(()=>{geometry.dispose();material.dispose();});
 for(const island of islands){
  const model=new Mesh(geometry,material);model.position.set(island.x,2,island.z);model.updateMatrixWorld();
  f.game.loaded.set(island.id,{model,group:model});
 }
 return f.game.arrival;
}

test('direct arrival starts its introduction once; skipping lets E board the same safely parked boat',async t=>{
 const f=fixture(t),arrival=enableArrival(f,t);
 const epoch=f.game.beginTravel();assert.equal(await f.game.travelToIsland(experience,epoch),true);f.game.finishTravel(epoch);
 assert.equal(arrival.active,true);assert.equal(arrival.island,experience);assert.deepEqual([...arrival.seen],['experience']);
 assert.equal(f.game.frozen,true);assert.equal(f.game.inputs.enabled,false);
 const berth=f.player.berth,boatPosition={...f.boat.position},boatYaw=f.boat.yaw;
 assert.equal(f.game.skipArrival(),true);assert.equal(f.game.skipArrival(),false);assert.equal(f.game.inputs.enabled,true);
 assert.equal(f.game.boardBoat(),true);f.player.tick(.61);
 assert.equal(f.player.mode,'sailing');assert.equal(f.boat.parked,false);assert.equal(f.character.active,false);
 assert.deepEqual({...f.boat.position},boatPosition);assert.equal(f.boat.yaw,boatYaw);
 assert.equal(await f.game.boarding.disembark(experience),true);f.player.tick(.61);
 assert.equal(f.player.mode,'walking');assert.deepEqual(f.player.berth,berth);
 assert.equal(arrival.active,false,'manual E on a previously introduced island does not replay the introduction');
 assert.deepEqual([...arrival.seen],['experience']);
});

test('manual E records first arrival only at its ashore commit, and subsequent Travel does not replay it',async t=>{
 const f=fixture(t,{origin:'sailing'}),arrival=enableArrival(f,t),loading=deferred();
 f.game.prepareAshore=()=>loading.promise;
 const pending=f.game.boarding.disembark(about);
 assert.equal(arrival.seen.size,0);loading.resolve(f.walkFor(about));assert.equal(await pending,true);
 f.player.tick(.2);assert.equal(arrival.seen.size,0);
 f.player.tick(.11);assert.equal(arrival.active,true);assert.equal(arrival.island,about);assert.equal(f.player.transitioning,true);
 f.player.tick(.3);assert.equal(f.player.mode,'walking','the overview must not deadlock the remaining boarding transition');
 f.game.prepareAshore=async island=>f.walkFor(island);
 const epoch=f.game.beginTravel();assert.equal(arrival.active,false);
 assert.equal(await f.game.travelToIsland(about,epoch),true);f.game.finishTravel(epoch);
 assert.equal(arrival.active,false);assert.deepEqual([...arrival.seen],['about']);
});

test('a failed or superseded preparation does not consume an island introduction',async t=>{
 const f=fixture(t),arrival=enableArrival(f,t),loading=deferred();
 f.game.prepareAshore=()=>loading.promise;
 const epoch=f.game.beginTravel(),pending=f.game.travelToIsland(experience,epoch);
 f.game.reset();loading.resolve(f.walkFor(experience));assert.equal(await pending,false);f.game.finishTravel(epoch);
 assert.equal(arrival.seen.size,0);assert.equal(arrival.active,false);
 f.game.prepareAshore=async()=>{throw new Error('Island failed to load');};
 const failed=f.game.beginTravel();assert.equal(await f.game.travelToIsland(experience,failed),false);f.game.finishTravel(failed);
 assert.equal(arrival.seen.size,0);assert.equal(arrival.active,false);
});

test('Travel chooses the other real berth when the nearer boat space is occupied',async t=>{
 const f=fixture(t),walk=f.walkFor(experience);
 const first=f.game.selectBerth(experience,walk),p=first.boat;
 const body=f.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(p.x,.35,p.z));
 f.world.createCollider(R.ColliderDesc.cuboid(1.2,.8,2.5).setCollisionGroups(SEA_GROUP),body);
 const epoch=f.game.beginTravel();assert.equal(await f.game.travelToIsland(experience,epoch),true);f.game.finishTravel(epoch);
 assertAtLanding(f,experience);
 assert.ok(Math.hypot(f.player.berth.boat.x-p.x,f.player.berth.boat.z-p.z)>5,'the safe berth is on the other side of the bridge');
});
