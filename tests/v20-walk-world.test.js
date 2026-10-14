import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {islands} from '../sources/config.js';
import {CharacterController,IslandWalkWorld,localToWorld,WALK_GROUP,CHARACTER} from '../sources/core/character.js';
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
   const speed=Math.min(1,d/(2.4*DT));f.journey.step(DT,f.game.frozen);f.character.step({x:dx/d*speed,z:dz/d*speed},DT);f.world.step();f.character.afterStep();
   const after=f.character.position,support=[f.walk.groundAt(after)];for(let n=0;n<16;n++){const a=n/16*Math.PI*2;support.push(f.walk.groundAt({x:after.x+Math.cos(a)*CHARACTER.radius,z:after.z+Math.sin(a)*CHARACTER.radius}));}assert.ok(Math.min(...support.map(y=>Math.abs(after.y-y)))<.08,`unsupported feet near ${JSON.stringify(dockLocal(after,island))}; y=${after.y}; support=${support.join(',')}`);assert.equal(f.rescues,initialRescues,'walking must not rely on the safety rescue');
  }
  assert.ok(reached,`Rapier blocked at ${JSON.stringify(dockLocal(f.character.position,island))} approaching ${JSON.stringify(dockLocal(goal,island))}`);
 }
}

function local(point){return Array.isArray(point)?{x:point[0],z:point[1]}:point;}
function follow(f,plan,points){for(const point of points)walkTo(f,plan,local(point));}

for(const stair of layout.stairs)for(const run of[false,true])for(const direction of[-1,1])test(`V20 ${stair.id}: ${run?'run':'walk'} stair direction ${direction} stays supported without gravity acceleration`,()=>{
 const f=fixture(layout.berths[0]);
 try{
  const from=direction<0?stair.frontZ+.4:stair.backZ-.4,to=direction<0?stair.backZ-.4:stair.frontZ+.4,start=localToWorld(island,{x:stair.x,z:from});start.y=f.walk.groundAt(start);
  f.character.teleport(start,f.walk);f.world.step();const initialRescues=f.rescues,requestedSpeed=run?CHARACTER.run:CHARACTER.walk;let reached=false;
  for(let frame=0;frame<900;frame++){
   const before=f.character.position,current=dockLocal(before,island);if((current.z-to)*direction>=-.05){reached=true;break;}
   f.character.step({x:Math.sin(island.rotation)*direction,z:Math.cos(island.rotation)*direction,run},DT);f.world.step();f.character.afterStep();
   const after=f.character.position,speed=Math.hypot(after.x-before.x,after.z-before.z)/DT,support=[f.walk.groundAt(after)];
   for(let n=0;n<16;n++){const angle=n/16*Math.PI*2;support.push(f.walk.groundAt({x:after.x+Math.cos(angle)*CHARACTER.radius,z:after.z+Math.sin(angle)*CHARACTER.radius}));}
   assert.ok(speed<=requestedSpeed*1.01,`gravity increased the ${requestedSpeed} input speed to ${speed}`);
   assert.ok(Math.min(...support.map(y=>Math.abs(after.y-y)))<.08,`feet lost stair support at ${JSON.stringify(dockLocal(after,island))}`);
   assert.equal(f.rescues,initialRescues,'stairs do not rely on a rescue teleport');
  }
  assert.ok(reached,`the capsule stalled at ${JSON.stringify(dockLocal(f.character.position,island))}`);
 }finally{f.world.free();}
});

test('V20 architectural clearance agrees with Rapier below an upper wall and beside a ground-level wall',()=>{
 const f=fixture(layout.berths[0]);
 try{
  const capsule=new R.Capsule(CHARACTER.halfHeight,CHARACTER.radius),orientation={x:0,y:0,z:0,w:1};
  const overlap=p=>f.world.intersectionWithShape({x:p.x,y:p.y+CHARACTER.height/2+CHARACTER.offset,z:p.z},orientation,capsule,undefined,WALK_GROUP,undefined,undefined,c=>f.walk.obstacles.includes(c));
  const candidates=layout.obstacles.filter(o=>o.name==='terminal side wall').flatMap(o=>[-.35,0,.35].map(t=>{
   const p=localToWorld(island,{x:o.x,z:o.z+t*o.depth});p.y=f.walk.groundAt(p);return {o,p};
  }));
  const upper=candidates.find(({o,p})=>p.y+CHARACTER.height+.2<o.y&&f.walk.clear(p));
  assert.ok(upper,'the actual elevated station has a clear lower-concourse point beneath its wall projection');
  assert.equal(overlap(upper.p),null,'Rapier also clears the complete capsule below the upper wall');
  const wall=layout.obstacles.find(o=>o.name==='workshop outer wall'),ground=localToWorld(island,{x:wall.x,z:wall.z,y:wall.y});
  assert.equal(f.walk.clear(ground),false,'a wall at the same floor remains an obstacle');
  assert.ok(overlap(ground),'Rapier agrees that the same-level workshop wall blocks the capsule');
 }finally{f.world.free();}
});

for(const[index,berth]of layout.berths.entries())test(`V20 berth ${index+1}: walk the full valley, all platforms, company readers and both stairways`,()=>{
 const f=fixture(berth),plan=navigator(f);
 try{
  assert.equal(layout.railway.version,2,'use the current compact valley assets');
  const actors=layout.stations.map(station=>{const position=localToWorld(island,station);return{id:station.id,station,kind:station.type,position,distance:p=>Math.hypot(p.x-position.x,p.z-position.z)};});
  // Real movement across the authored streets, then every published platform
  // route in both directions. No test teleport is used to repair a failed path.
  follow(f,plan,layout.paths.find(path=>path.id==='harbor-approach').points);
  for(const station of layout.railway.stations){
   follow(f,plan,station.walkRoute);f.journey.nearby();
   assert.equal(f.game.canBoardTrain,true,`${station.id}: the exported platform is physically reachable and visible`);
   assert.equal(f.journey.nearStation.id,station.id);
   if(station.id!=='harbor'){
    const reader=layout.stations.find(s=>s.primary&&s.contentId===station.id);walkTo(f,plan,reader);
    const selected=selectLandExhibit(actors,f.character.position,{visible:action=>f.walk.visible(f.character.position,action.position)});
    assert.equal(selected?.station.contentId,station.id,`${station.id}: E chooses the complete company story`);
   }
   follow(f,plan,[...station.walkRoute].reverse());
  }
  for(const stair of layout.stairs){follow(f,plan,stair.walkRoute);follow(f,plan,[...stair.walkRoute].reverse());}
  for(const room of layout.interiors){follow(f,plan,room.walkRoute);follow(f,plan,[...room.walkRoute].reverse());}
  walkTo(f,plan,berth.landing);assert.equal(f.rescues,0,'the complete walking visit uses no rescue or staging teleports');
  assert.ok(Math.abs(f.character.position.y-.85)<.04);
 }finally{f.world.free();}
});

for(const[index,crossing]of layout.railway.crossings.entries())for(const direction of[-1,1])test(`V20 ${crossing.id}: a real walker crosses safely in direction ${direction}`,()=>{
 const f=fixture(layout.berths[0]),plan=navigator(f);
 try{
  const x=crossing.polygon.reduce((sum,p)=>sum+p[0],0)/crossing.polygon.length,z=crossing.polygon.reduce((sum,p)=>sum+p[1],0)/crossing.polygon.length;
  const source=index===0?'harbor':'beaconfire',target=index===0?'visionx':'amtrak',c=f.journey.controller;
  const start={x,z:z-direction*2.6},center={x,z},end={x,z:z+direction*2.6};
  walkTo(f,plan,start);walkTo(f,plan,center);
  // Stage an empty service at its preceding station; the walker remains where
  // the actual capsule walked. From here every train and pedestrian step runs.
  assert.equal(c.parkAtStation(source),true);f.journey.syncPhysics(true);assert.equal(c.call(target),true);
  for(let frame=0;frame<20*60&&c.state!=='waiting-crossing';frame++){f.journey.step(DT);f.character.step({x:0,z:0},DT);f.world.step();f.character.afterStep();}
  assert.equal(c.state,'waiting-crossing','the real character is detected in the crossing polygon');
  const stopped=c.distance,position={...f.character.position};
  for(let frame=0;frame<60;frame++){f.journey.step(DT);f.character.step({x:0,z:0},DT);f.world.step();f.character.afterStep();}
  assert.equal(c.distance,stopped);assert.ok(Math.hypot(f.character.position.x-position.x,f.character.position.z-position.z)<.02,'the train cannot push the waiting walker');
  walkTo(f,plan,end);
  for(let frame=0;frame<8*60&&c.distance<=stopped+.5;frame++){f.journey.step(DT);f.world.step();}
  assert.ok(c.distance>stopped+.5,'the same train resumes only after the walker clears the crossing');assert.equal(f.rescues,0);
 }finally{f.world.free();}
});
