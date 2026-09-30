import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {Game} from '../sources/game.js';
import {GarageCarController,GARAGE_CARS,garageSpawn} from '../sources/core/garage-car.js';
import {CharacterController,IslandWalkWorld,localToWorld} from '../sources/core/character.js';
import {PlayerController,BoardingController} from '../sources/core/player.js';
import {EstatePracticeController} from '../sources/core/estate-practice.js';
import {ChallengeManager} from '../sources/core/challenges.js';
import {islands} from '../sources/config.js';

const STEP=1/60,island=islands.find(item=>item.id==='about');
const layout=JSON.parse(fs.readFileSync(new URL('../static/models/walk-layout.json',import.meta.url))).islands.find(item=>item.id==='about');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
await R.init();

test('High→Low→High while the second car loads reconciles every car to the latest setting',async()=>{
 const pending=[],requests=[];
 const cars=GARAGE_CARS.map(({id})=>({id,quality:'high',setModel(_model,quality){this.quality=quality;}}));
 const game=Object.assign(Object.create(Game.prototype),{
  settings:{quality:'low'},garageCars:cars,jack:{},
  loader:{loadAsync(url){requests.push(url);return new Promise(resolve=>pending.push({url,resolve}));}},
 });
 let complete=false;
 const first=game.reloadCarQuality().finally(()=>{complete=true;});
 await flush();
 assert.equal(pending.length,1);assert.match(pending[0].url,/low\/car-911/);
 pending.shift().resolve({scene:{}});await flush();
 assert.equal(cars[0].quality,'low');assert.match(pending[0].url,/low\/car-g63/);
 game.settings.quality='high';
 const repeated=game.reloadCarQuality();
 // Finish the old second-car request and any reconciliation it triggers.
 // The bound catches an accidental endless reload without sleeping on time.
 for(let turn=0;turn<12&&!complete;turn++){
  for(const request of pending.splice(0))request.resolve({scene:{}});
  await flush();
 }
 assert.ok(complete,'quality reconciliation must finish');
 await Promise.all([first,repeated]);
 assert.deepEqual(cars.map(car=>car.quality),['high','high']);
 assert.equal(!!game.carReloading,false);
 assert.ok(requests.some(url=>/models\/car-911/.test(url)),'the first car must be revisited after the late setting change');
});

function gameFixture(){
 const world=new R.World({x:0,y:0,z:0});world.timestep=STEP;
 const walk=new IslandWalkWorld(R,world,island,layout);
 const cars=GARAGE_CARS.map(config=>new GarageCarController(R,world,walk,garageSpawn(walk,config.bay),config));
 const character=new CharacterController(R,world),landing=localToWorld(island,layout.berths[0].landing);
 character.teleport(landing,walk);character.enable(true);
 const boat={position:{x:0,y:.35,z:36},yaw:0,velocity:{x:0,y:0,z:0},
  hold(){this.velocity={x:0,y:0,z:0};},park(value){this.parked=value;},
  snapshot(){return{position:{...this.position}};},teleport(point){this.position={...point};this.yaw=point.yaw||0;},
 };
 const player=new PlayerController(boat,character);player.mode='walking';player.island=island;player.berth={landing};
 const events=[],inputs={enabled:true,keys:new Set(['KeyW']),clear(){this.keys.clear();},setEnabled(value){this.clear();this.enabled=value;}};
 const game=Object.assign(Object.create(Game.prototype),{
  world,player,character,boat,garageCars:cars,walkLayouts:new Map([['about',layout]]),
  inputs,events:{trigger:(name,args)=>events.push({name,args})},mode:'exploring',loaded:new Map(),
  challenges:new ChallengeManager(),props:{snapshot:()=>[],resetCargo(){},resetNear(){}},
  practiceView:{update(){}},jack:{resetPose(){},estatePose:{reset(){}}},
  feedback:{clear(){}},safePoint:point=>point,resetCamera(){},syncCameraTransition(){},updateNearby(){},clearWake(){},
  accumulator:0,focus:null,snapshot:null,pendingResume:null,
 });
 game.boarding=new BoardingController(player);
 game.practice=new EstatePracticeController({onEvent:event=>game.practiceEvent(event)});
 return{world,walk,cars,character,game,events,dispose(){for(const car of cars)car.dispose();world.free();}};
}

function golfStance(index){
 const practice=new EstatePracticeController();practice.configure(layout.sports,layout.groundY);practice.start('golf');
 practice.index=index;practice.setupRound();return{...practice.actor};
}
const blockedCases=[
 {label:'tennis starting position',kind:'tennis',point:{x:16,z:4}},
 {label:'tennis sideways movement away from its starting position',kind:'tennis',point:{x:18,z:4},clearStart:true},
 {label:'first golf stance',kind:'golf',point:golfStance(0)},
 {label:'a later golf hole',kind:'golf',point:golfStance(2),clearStart:true},
 {label:'tennis exit',kind:'tennis',point:layout.sports.tennis.exit,clearStart:true},
 {label:'golf exit',kind:'golf',point:layout.sports.golf.exit,yaw:Math.PI/2,clearStart:true},
];
for(const scenario of blockedCases)test(`practice preflight rejects a parked car at ${scenario.label} before changing player state`,()=>{
 const f=gameFixture();try{
  const car=f.cars[0],point=localToWorld(island,{...scenario.point,yaw:scenario.yaw||0});point.y=f.walk.groundAt(point);
  assert.ok(car.clearPose(point,point.yaw),'the obstruction is a valid car parking location');
  car.teleport(point);
  assert.equal(f.walk.clear(point,.24),false,'the real parked car blocks a capsule at this location');
  if(scenario.clearStart){
   const start=localToWorld(island,scenario.kind==='tennis'?{x:16,z:4}:golfStance(0));
   assert.ok(f.walk.clear(start,.24),'checking only the initial actor position would miss this obstruction');
  }
  const before={position:{...f.character.position},epoch:f.game.practice.epoch,challengeEpoch:f.game.challenges.epoch};
  assert.equal(f.game.startPractice(scenario.kind),false);
  assert.equal(f.game.practice.state,'idle');assert.equal(f.game.practice.epoch,before.epoch);
  assert.equal(f.game.challenges.epoch,before.challengeEpoch);
  assert.deepEqual({...f.character.position},before.position);assert.equal(f.game.player.mode,'walking');
  assert.equal(f.game.inputs.enabled,true);assert.ok(f.events.some(event=>event.name==='message'));
  car.teleport(car.spawn);
  assert.equal(f.game.startPractice(scenario.kind),true,'moving the car away makes practice available again');
  assert.equal(f.game.practice.state,'countdown');assert.ok(f.walk.clear(f.character.position,.24));
  f.game.cancelPractice();assert.equal(f.game.practice.state,'idle');assert.ok(f.walk.clear(f.character.position,.24),'practice exits onto clear ground');
 }finally{f.dispose();}
});

for(const hidden of[false,true])test(`Travel from a car reader ${hidden?'with a background pause ':''}parks both cars and closing the old reader cannot resume driving`,()=>{
 const f=gameFixture();try{
  const car=f.cars[0];assert.ok(f.game.player.rideCar(car));car.park(false);car.setOccupied(true);
  for(let n=0;n<30;n++){car.step({throttle:1,steer:0},STEP);f.world.step();car.afterStep();}
  assert.ok(car.speed>0);
  f.game.pause('read',{id:'about'});assert.equal(car.speed,0);assert.equal(f.game.inputs.keys.size,0);
  if(hidden)f.game.pause('hidden',f.game.focus);
  const positions=f.cars.map(vehicle=>({...vehicle.position})),epoch=f.game.player.transitionEpoch;
  const destination={x:40,y:.35,z:35,yaw:.2};f.game.teleport(destination);f.game.resume('read');
  assert.equal(f.game.player.mode,'sailing');assert.equal(f.game.activeActor,f.game.boat);
  assert.ok(f.game.player.transitionEpoch>epoch);assert.equal(f.game.pendingResume,null);
  for(const vehicle of f.cars){assert.equal(vehicle.parked,true);assert.equal(vehicle.occupied,false);assert.equal(vehicle.speed,0);}
  assert.equal(f.game.player.pauseReasons.has('hidden'),hidden);assert.equal(f.game.inputs.enabled,!hidden);
  if(hidden)f.game.resume('hidden');
  assert.equal(f.game.player.mode,'sailing');assert.equal(f.game.inputs.enabled,true);assert.equal(f.game.snapshot,null);
  for(let n=0;n<10;n++){for(const vehicle of f.cars)vehicle.step({throttle:0,steer:0},STEP);f.world.step();for(const vehicle of f.cars)vehicle.afterStep();}
  assert.deepEqual(f.cars.map(vehicle=>({...vehicle.position})),positions);
  assert.deepEqual(f.game.boat.position,destination);
 }finally{f.dispose();}
});
