import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {PerspectiveCamera,Vector3} from 'three';
import {Game} from '../sources/game.js';
import {EstatePracticeController} from '../sources/core/estate-practice.js';
import {PlayerController,BoardingController} from '../sources/core/player.js';
import {ChallengeManager} from '../sources/core/challenges.js';
import {CharacterController,IslandWalkWorld,localToWorld,SEA_GROUP} from '../sources/core/character.js';
import {createIslandColliders} from '../sources/core/collisions.js';
import {CameraRig} from '../sources/core/camera.js';
import {DiscoveryStore} from '../sources/core/discovery.js';
import {islands} from '../sources/config.js';
const layout=JSON.parse(fs.readFileSync(new URL('../static/models/walk-layout.json',import.meta.url))).islands.find(i=>i.id==='about');
const island=islands.find(i=>i.id==='about'),STEP=1/60;
await R.init();

function fixture(kind='tennis'){
 const events=[],g=Object.create(Game.prototype);
 const boat={position:{x:0,y:.35,z:36},yaw:0,hold(){},park(){},teleport(p){this.position={...p,y:.35};},snapshot(){return{position:{...this.position},velocity:{x:0,y:0,z:0}};}};
 const landing=localToWorld(island,layout.berths[0].landing);
 const character={position:{...landing},previous:{...landing},yaw:landing.yaw,velocity:{x:0,y:0,z:0},enable(){},hold(){this.velocity={x:0,y:0,z:0};},teleport(p){this.position={...p};this.previous={...p};this.yaw=p.yaw||0;},walkWorld:{layout,groundAt:()=>layout.groundY}};
 const player=new PlayerController(boat,character);player.mode='walking';player.island=island;player.berth={landing};
 Object.assign(g,{player,boat,character,boarding:new BoardingController(player),challenges:new ChallengeManager(),mode:'exploring',loaded:new Map(),props:{snapshot:()=>[],resetCargo(){},resetNear(){}},inputs:{enabled:true,clear(){this.cleared=true;},setEnabled(value){this.clear();this.enabled=value;}},events:{trigger:(name,args)=>events.push({name,args})},jack:{estatePose:{reset(){}},resetPose(){}},feedback:{clear(){}},safePoint:p=>p,resetCamera(){},syncCameraTransition(){},updateNearby(){},clearWake(){},accumulator:0,focus:null,snapshot:null,pendingResume:null,practiceIsland:island});
 g.practice=new EstatePracticeController({onEvent:e=>g.practiceEvent(e)});g.practice.configure(layout.sports,layout.groundY);g.practice.start(kind);g.practice.advanceCountdown(2);return {g,events};
}
for(const kind of ['tennis','golf'])test(`${kind}: nested read/hidden pauses freeze balls and begin one 2s resume only after the last reason closes`,()=>{
 const {g}=fixture(kind);g.practice.tick(.4);const before={ball:structuredClone(g.practice.ball),elapsed:g.practice.elapsed,index:g.practice.index};
 g.pause('read');g.pause('hidden');g.resume('read');assert.equal(g.practice.state,'paused');assert.equal(g.mode,'hidden');assert.equal(g.inputs.enabled,false);
 g.practice.advanceCountdown(20);g.practice.tick(20,{held:true,right:1});assert.deepEqual(g.practice.ball,before.ball);assert.equal(g.practice.elapsed,before.elapsed);assert.equal(g.practice.index,before.index);
 g.resume('hidden');assert.equal(g.practice.state,'resuming');assert.equal(g.inputs.enabled,false);g.practice.advanceCountdown(1.99);assert.equal(g.practice.state,'resuming');g.practice.tick(2,{held:true});assert.equal(g.practice.elapsed,before.elapsed);
 g.pause('hidden');g.resume('hidden');assert.equal(g.practice.remaining,2,'interrupted recovery grants a fresh visible 2s');g.practice.advanceCountdown(1.99);assert.equal(g.inputs.enabled,false);g.practice.advanceCountdown(.011);assert.equal(g.practice.state,'running');assert.equal(g.inputs.enabled,true);assert.equal(g.player.mode,'walking');
});
for(const action of ['reset','teleport'])test(`${action}: cancel practice and discard stale read/resume snapshots permanently`,()=>{
 const {g}=fixture();g.pause('read');const epoch=g.practice.epoch;assert.ok(g.snapshot);if(action==='reset')g.reset();else g.teleport({x:40,z:35,yaw:.2});
 assert.equal(g.practice.state,'idle');assert.ok(g.practice.epoch>epoch);assert.equal(g.practice.ball,null);assert.equal(g.snapshot,null,'the old panel physics snapshot must be invalidated');assert.equal(g.pendingResume,null);
 g.resume('read');g.practice.advanceCountdown(100);g.practice.tick(100,{held:true});assert.equal(g.practice.state,'idle');assert.equal(g.player.mode,action==='reset'?'walking':'sailing');
});
test('Travel while a practice is hidden cancels its round while retaining the background pause',()=>{const {g}=fixture('golf');g.pause('hidden');g.teleport({x:40,z:35,yaw:.2});assert.equal(g.practice.state,'idle');assert.equal(g.player.mode,'sailing');assert.ok(g.player.pauseReasons.has('hidden'));assert.equal(g.frozen,true);assert.equal(g.inputs.enabled,false);g.resume('hidden');assert.equal(g.practice.state,'idle');assert.equal(g.inputs.enabled,true);});
test('practice completion is transient and never writes results, challenge bests or stamps',()=>{
 const values=new Map();let writes=0;const storage={getItem:k=>values.get(k),setItem(k,v){writes++;values.set(k,v);}};const {g,events}=fixture('golf');g.discovery=new DiscoveryStore({storage});const before=JSON.stringify([...values]),beforeWrites=writes,beforeStamps=g.discovery.stamps;
 g.practice.finish();assert.equal(events.filter(e=>e.name==='practicefinish').length,1);assert.equal(events.filter(e=>e.name==='finish').length,0);assert.equal(writes,beforeWrites);assert.equal(JSON.stringify([...values]),before);assert.equal(g.discovery.stamps,beforeStamps);assert.equal(g.discovery.completed.size,0);g.cancelPractice(false);assert.equal(g.practice.score,0);assert.equal(g.practice.attempts,0);
});

const viewports=[[1440,900],[1920,1080],[390,844],[844,390]];
for(const [width,height]of viewports)for(const [kind,index]of [['tennis',0],['golf',0],['golf',1],['golf',2]])test(`${width}x${height} ${kind} ${index+1}: actual Game focus transforms the full practice bounds and fits all corners`,()=>{
 const {g}=fixture(kind);g.practice.index=index;const focus=g.practiceFocus();assert.equal(focus.camera.practice,true);assert.equal(focus.islandId,'about');
 const local=kind==='tennis'?{min:[10,.85,-15],max:[22,3,7]}:(()=>{const h=layout.sports.golf.holes[index];return{min:[h.tee.x-1.2,.85,h.tee.z-1.8],max:[h.cup.x+1.2,2.7,h.cup.z+1.8]};})();
 const vertices=[];for(const x of[local.min[0],local.max[0]])for(const y of[local.min[1],local.max[1]])for(const z of[local.min[2],local.max[2]]){const p=localToWorld(island,{x,y,z});vertices.push(new Vector3(p.x,p.y,p.z));}
 for(const [axis,n]of [['x',0],['y',1],['z',2]]){assert.ok(Math.abs(focus.camera.fitBounds.min[n]-Math.min(...vertices.map(v=>v[axis])))<1e-8);assert.ok(Math.abs(focus.camera.fitBounds.max[n]-Math.max(...vertices.map(v=>v[axis])))<1e-8);}
 const camera=new PerspectiveCamera(28,width/height,.2,600),rig=new CameraRig(camera,{zoom:1,walkZoom:1,reduced:false},width,height),state={position:g.character.position,velocity:{x:0,y:0,z:0},yaw:island.rotation,speed:0,input:{},focus,locomotion:'walking',landAzimuth:island.rotation};rig.update(0,state,true);camera.updateMatrixWorld(true);
 const rect={left:24,right:width-24,top:Math.min(190,height*.28),bottom:height-Math.min(170,height*.24)};
 for(const v of vertices){const p=v.clone().project(camera),x=(p.x+1)*width/2,y=(1-p.y)*height/2;assert.ok(p.z>=-1&&p.z<=1,'corner stays before camera far plane');assert.ok(x>=rect.left-.1&&x<=rect.right+.1&&y>=rect.top-.1&&y<=rect.bottom+.1,`corner ${x},${y} outside practice viewport`);}
});

function physicsFixture(berth){const world=new R.World({x:0,y:0,z:0});world.timestep=STEP;createIslandColliders(R,world,island);world.forEachCollider(c=>c.setCollisionGroups(SEA_GROUP));const walk=new IslandWalkWorld(R,world,island,layout),actor=new CharacterController(R,world);actor.teleport(localToWorld(island,berth.landing),walk);actor.enable(true);world.step();let rescues=0;const teleport=actor.teleport.bind(actor);actor.teleport=(...args)=>{rescues++;return teleport(...args);};return{world,walk,actor,get rescues(){return rescues;}};}
function traverse(f,route){for(const [x,z]of route){const target=localToWorld(island,{x,z});let reached=false;const distance=Math.hypot(f.actor.position.x-target.x,f.actor.position.z-target.z),budget=Math.ceil((distance/2.4+4)*60);for(let frame=0;frame<budget;frame++){const p=f.actor.position,dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);if(d<.09){reached=true;break;}const scale=Math.min(1,d/(2.4*STEP));f.actor.step({x:dx/d*scale,z:dz/d*scale},STEP);f.world.step();f.actor.afterStep();assert.ok(Math.abs(f.actor.position.y-f.walk.groundAt(f.actor.position))<.08,'actual capsule feet retain the floor');assert.ok(f.actor.position.y<1.2,'a decorative second storey never becomes walking ground');}assert.ok(reached,`blocked route endpoint ${x},${z}; actual ${JSON.stringify(f.actor.position)}`);}}
for(const [index,berth]of layout.berths.entries())test(`About landing ${index+1}: real Rapier actor traverses estate ground floor, scenic loop and all four empty garage bays`,()=>{
 const f=physicsFixture(berth);try{
  traverse(f,layout.route);
  traverse(f,[[0,22],[0,15.6],[-4,15.6],[-4,2],[-4,-3],[-4,-6.3],[-10,-6.3],[-4,-6.3],[-4,-8],[2,-8],[-4,-8],[-4,-12],[-4,-17],[-4,-12],[-4,-3],[-4,2],[-4,15.6]]);
  assert.equal(layout.garageBays.length,4);for(const bay of layout.garageBays)traverse(f,[[bay.x,15.6],[bay.x,13],[bay.x,9],[bay.x,6.4],[bay.x,9],[bay.x,13],[bay.x,15.6]]);
  assert.equal(f.rescues,0,'no route was repaired by a silent teleport');
 }finally{f.world.free();}
});
