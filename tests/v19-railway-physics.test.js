import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {islands} from '../sources/config.js';
import {CharacterController,IslandWalkWorld,localToWorld,WALK_GROUP} from '../sources/core/character.js';
import {dockLocal} from '../sources/core/dock.js';
import {CareerTrainController,CAREER_TRAIN} from '../sources/core/career-train.js';
import {CareerJourney} from '../sources/world/career-journey.js';
import {PlayerController} from '../sources/core/player.js';
import {selectLandExhibit} from '../sources/core/project-exhibits.js';

const layouts=JSON.parse(await fs.readFile(new URL('../static/models/walk-layout.json',import.meta.url)));
const layout=layouts.islands.find(item=>item.id==='experience'),island=islands.find(item=>item.id==='experience'),DT=1/60;
await R.init();

function fixture(berth){
 assert.ok(layout.railway?.stations?.length===4,'the current exported island needs all four train platforms');
 const world=new R.World({x:0,y:0,z:0});world.timestep=DT;
 const walk=new IslandWalkWorld(R,world,island,layout),character=new CharacterController(R,world),scene=new THREE.Scene(),events=[];
 character.teleport(localToWorld(island,berth.landing),walk);character.enable(true);world.step();
 const boat={position:{x:0,y:0,z:0},speed:0,yaw:0},player=new PlayerController(boat,character),root=new THREE.Group();scene.add(root);
 player.mode='walking';player.island=island;player.berth={landing:localToWorld(island,berth.landing)};
 const inputs={enabled:true,clear(){},setEnabled(value){this.enabled=value;}},game={boat,player,character,scene,inputs,mode:'exploring',jack:{root,resetPose(){}},cancelChallenge(){},resetCamera(){},events:{trigger(...event){events.push(event);}}};
 Object.defineProperty(game,'frozen',{get(){return player.transitioning||player.pauseReasons.size>0;}});
 const journey=new CareerJourney(game,R);Object.assign(journey,{ready:true,island,railway:layout.railway,walk,controller:new CareerTrainController(layout.railway,{island}),visual:{mountPoint:new THREE.Group(),update(){}},marker:{visible:false,position:new THREE.Vector3()}});game.journey=journey;
 for(const spec of CAREER_TRAIN.cars){const body=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());const collider=world.createCollider(R.ColliderDesc.cuboid(spec.halfWidth,.8,spec.halfLength).setCollisionGroups(WALK_GROUP).setTranslation(0,1,0),body);walk.handles.add(collider.handle);walk.obstacles.push(collider);journey.colliders.push({body,collider});}
 journey.syncPhysics(true);world.step();
 let rescues=0;const teleport=character.teleport.bind(character);character.teleport=(...args)=>{rescues++;return teleport(...args);};
 return{world,walk,character,player,journey,game,events,get rescues(){return rescues;},finishTransition(){player.tick(.3);player.tick(.3);inputs.setEnabled(!game.frozen);}};
}

// Plan test input through the exported walkable area, never teleport across a
// wall to manufacture connectivity. Rapier still executes every resulting step.
function navigator(f){
 const step=.5,cache=new Map(),key=(x,z)=>`${x},${z}`;
 function point(x,z){const id=key(x,z);if(cache.has(id))return cache.get(id);const p=localToWorld(island,{x:x*step,z:z*step}),sample=f.walk.groundSample(p);p.y=sample.height;const value=f.walk.clear(p,.31)&&f.walk.safeGround(p,.24)?{x,z,id,p}:null;cache.set(id,value);return value;}
 function edge(a,b){const distance=Math.hypot(b.x-a.x,b.z-a.z),count=Math.ceil(distance/.16);let prev=f.walk.groundAt(a);for(let i=1;i<=count;i++){const t=i/count,p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},y=f.walk.groundAt(p);if(!f.walk.clear(p,.29)||!f.walk.safeGround(p,.22)||Math.abs(y-prev)>.175)return false;prev=y;}return true;}
 function neighbors(p){const local=dockLocal(p,island),x=Math.round(local.x/step),z=Math.round(local.z/step),list=[];for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){const node=point(x+dx,z+dz);if(node&&edge(p,node.p))list.push(node);}return list;}
 return target=>{
  const start=f.character.position,goal=localToWorld(island,target);goal.y=f.walk.groundAt(goal);
  if(edge(start,goal))return[goal];
  const starts=neighbors(start),ends=new Set(neighbors(goal).map(n=>n.id));assert.ok(starts.length&&ends.size,`a walk route endpoint is blocked: ${JSON.stringify(target)}`);
  const open=[],cost=new Map(),parent=new Map(),closed=new Set(),heuristic=n=>Math.hypot(n.p.x-goal.x,n.p.z-goal.z);
  const push=(node,g,from)=>{if(g>=(cost.get(node.id)??Infinity))return;cost.set(node.id,g);parent.set(node.id,from);open.push({node,g,score:g+heuristic(node)});};
  for(const node of starts)push(node,Math.hypot(node.p.x-start.x,node.p.z-start.z),null);
  let found;
  for(let visited=0;open.length&&visited<30000;visited++){
   let best=0;for(let i=1;i<open.length;i++)if(open[i].score<open[best].score)best=i;
   const{node,g}=open.splice(best,1)[0];if(closed.has(node.id))continue;closed.add(node.id);
   if(ends.has(node.id)){found=node;break;}
   for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const next=point(node.x+dx,node.z+dz);if(next&&!closed.has(next.id)&&edge(node.p,next.p))push(next,g+Math.hypot(dx,dz)*step,node);}
  }
  assert.ok(found,`no supported walk route to ${JSON.stringify(target)}`);
  const route=[goal];for(let node=found;node;node=parent.get(node.id))route.unshift(node.p);
  return route;
 };
}

function walkTo(f,plan,target){
 const route=plan(target),initialRescues=f.rescues;
 for(const goal of route){let reached=false;const duration=Math.hypot(goal.x-f.character.position.x,goal.z-f.character.position.z)/2.4+3;
  for(let frame=0;frame<Math.ceil(duration/DT);frame++){
   const p=f.character.position,dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz);if(d<.06){reached=true;break;}
   const speed=Math.min(1,d/(2.4*DT));f.character.step({x:dx/d*speed,z:dz/d*speed},DT);f.world.step();f.character.afterStep();
   const after=f.character.position;assert.ok(Math.abs(after.y-f.walk.groundAt(after))<.19,`unsupported feet near ${JSON.stringify(dockLocal(after,island))}`);assert.equal(f.rescues,initialRescues,'walking must not rely on the safety rescue');
  }
  assert.ok(reached,`Rapier blocked at ${JSON.stringify(dockLocal(f.character.position,island))} approaching ${JSON.stringify(dockLocal(goal,island))}`);
 }
}

test('the current harbor entry uses the published approach and reaches its supported boarding deck',()=>{
 const f=fixture(layout.berths[0]),plan=navigator(f);
 try{
  const harbor=layout.railway.stations.find(station=>station.id==='harbor');
  for(const[x,z]of harbor.walkRoute)walkTo(f,plan,{x,z});
  f.journey.nearby();assert.equal(f.game.canBoardTrain,true);
  assert.ok(Math.abs(f.character.position.y-harbor.boarding.y)<.035);
  assert.equal(f.rescues,0,'the visible harbor route cannot need a rescue teleport');
 }finally{f.world.free();}
});

test('architectural ramps remain traversable uphill and downhill in both railing-side lanes',()=>{
 const f=fixture(layout.berths[0]);
 try{
  for(const ramp of layout.ramps.filter(ramp=>ramp.depth>1&&Math.abs(ramp.slope)>1e-6))for(const across of[-ramp.width/2+.215,0,ramp.width/2-.215])for(const direction of[-1,1]){
   const angle=ramp.rotation||0,point=along=>localToWorld(island,{x:ramp.x+across*Math.cos(angle)+along*Math.sin(angle),z:ramp.z-across*Math.sin(angle)+along*Math.cos(angle)});
   const length=ramp.depth-.75,start=point(-direction*length/2),end=point(direction*length/2);start.y=f.walk.groundAt(start);f.character.teleport(start,f.walk);f.world.step();
   const initialRescues=f.rescues;let reached=false;
   for(let frame=0;frame<Math.ceil((length/2.4+2)/DT);frame++){
    const p=f.character.position,dx=end.x-p.x,dz=end.z-p.z,d=Math.hypot(dx,dz);if(d<.08){reached=true;break;}
    f.character.step({x:dx/d,z:dz/d},DT);f.world.step();f.character.afterStep();
    assert.equal(f.rescues,initialRescues,`${ramp.id}: railing-side walking must stay supported`);
   }
   assert.ok(reached,`${ramp.id}: direction ${direction}, lane ${across.toFixed(3)} blocked at ${JSON.stringify(dockLocal(f.character.position,island))}`);
  }
 }finally{f.world.free();}
});

for(const[index,berth]of layout.berths.entries())test(`railway berth ${index+1}: walk to the train, ride and visit all three employers, then return to the pier`,()=>{
 const f=fixture(berth),plan=navigator(f);
 try{
  const c=f.journey.controller,stops=layout.railway.stations,actions=layout.stations.map(station=>{const position=localToWorld(island,station);return{id:station.id,station,kind:station.type,position,distance:p=>Math.hypot(p.x-position.x,p.z-position.z)};});
  walkTo(f,plan,stops[0].boarding);f.journey.nearby();assert.equal(f.game.canBoardTrain,true,'the actual harbor approach offers boarding');assert.equal(f.journey.board(),true);f.finishTransition();
  let travelSeconds=0;
  for(const id of ['visionx','beaconfire','amtrak','harbor']){
   assert.equal(f.journey.continue(),true);
   for(let frame=0;frame<180*60&&c.state!=='stopped';frame++){f.journey.step(DT);f.world.step();travelSeconds+=DT;}
   assert.equal(c.currentStation?.id,id,`${id}: the real route stops at its authored platform`);
   if(id!=='harbor'){
    assert.equal(f.journey.read(),true,`${id}: the passenger can open this actual company story before dismounting`);
    const payload=f.events.at(-1);assert.equal(payload[0],'exhibit');assert.equal(payload[1][0].station.contentId,id);assert.equal(payload[1][0].station.readFull,true);
    const pausedDistance=c.distance;f.journey.step(4,true);assert.equal(c.distance,pausedDistance);f.journey.step(0,false);
   }
   const exit=f.journey.exitPoint();assert.ok(exit,`${id}: stopped carriage has a clear, supported exit`);assert.ok(Math.abs(exit.y-f.walk.groundAt(exit))<.025);
   assert.equal(f.journey.leave(),true);f.finishTransition();f.world.step();
   if(id!=='harbor'){
    const reader=layout.stations.find(s=>s.primary&&s.contentId===id);assert.ok(reader);
    walkTo(f,plan,reader);const selected=selectLandExhibit(actions,f.character.position,{visible:action=>f.walk.visible(f.character.position,action.position)});assert.equal(selected?.station.contentId,id,`${id}: the actual company reader is reachable and E selects the right story`);
    walkTo(f,plan,stops.find(s=>s.id===id).boarding);f.journey.nearby();assert.equal(f.game.canBoardTrain,true);assert.equal(f.journey.board(),true);f.finishTransition();
   }
  }
  assert.ok(travelSeconds>=30&&travelSeconds<=45,`full motion time is ${travelSeconds.toFixed(2)}s`);
  walkTo(f,plan,berth.landing);assert.equal(f.player.walking,true);assert.ok(Math.abs(f.character.position.y-.85)<.04);
 }finally{f.world.free();}
});
