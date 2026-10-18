import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {islands} from '../sources/config.js';
import {CharacterController,IslandWalkWorld,localToWorld,WALK_GROUP,CHARACTER} from '../sources/core/character.js';
import {dockLocal} from '../sources/core/dock.js';
import {CareerTrainController} from '../sources/core/career-train.js';
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
 for(const spec of journey.controller.cars){const body=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());const collider=world.createCollider(R.ColliderDesc.cuboid(spec.halfWidth,spec.collisionHalfHeight??.8,spec.halfLength).setCollisionGroups(WALK_GROUP).setTranslation(0,spec.collisionCenterY??1,0),body);walk.handles.add(collider.handle);walk.obstacles.push(collider);journey.colliders.push({body,collider});}
 journey.syncPhysics(true);world.step();
 let rescues=0;const teleport=character.teleport.bind(character);character.teleport=(...args)=>{rescues++;return teleport(...args);};
 return{world,walk,character,player,journey,game,events,walkedStairs:new Map(),get rescues(){return rescues;},finishTransition(){player.tick(.3);player.tick(.3);inputs.setEnabled(!game.frozen);}};
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
   const after=f.character.position,point=dockLocal(after,island);
   for(const stair of layout.stairs){const angle=stair.rotation||0,dx=point.x-stair.x,dz=point.z-stair.z,across=dx*Math.cos(angle)-dz*Math.sin(angle),along=dx*Math.sin(angle)+dz*Math.cos(angle);if(Math.abs(across)<stair.width/2&&Math.abs(along)<=stair.depth/2){const range=f.walkedStairs.get(stair.id)||{min:Infinity,max:-Infinity};range.min=Math.min(range.min,along);range.max=Math.max(range.max,along);f.walkedStairs.set(stair.id,range);}}
   const support=[f.walk.groundAt(after)];for(let n=0;n<16;n++){const a=n/16*Math.PI*2;support.push(f.walk.groundAt({x:after.x+Math.cos(a)*CHARACTER.radius,z:after.z+Math.sin(a)*CHARACTER.radius}));}assert.ok(Math.min(...support.map(y=>Math.abs(after.y-y)))<.08,`unsupported feet near ${JSON.stringify(dockLocal(after,island))}; y=${after.y}; support=${support.join(',')}`);assert.equal(f.rescues,initialRescues,'walking must not rely on the safety rescue');
  }
  assert.ok(reached,`Rapier blocked at ${JSON.stringify(dockLocal(f.character.position,island))} approaching ${JSON.stringify(dockLocal(goal,island))}`);
 }
}

function local(point){return Array.isArray(point)?{x:point[0],z:point[1]}:point;}
function follow(f,plan,points){for(const point of points)walkTo(f,plan,local(point));}

for(const stair of layout.stairs)for(const run of[false,true])for(const direction of[-1,1])for(const lane of[-1,0,1])test(`V21 ${stair.id}: ${run?'run':'walk'} stair direction ${direction}, lane ${lane} stays supported without gravity acceleration`,()=>{
 const f=fixture(layout.berths[0]);
 try{
  const angle=stair.rotation||0,across=lane*(stair.width/2-.4),half=stair.depth/2+.3,to=direction*half,from=-to;
  const start=localToWorld(island,{x:stair.x+across*Math.cos(angle)+from*Math.sin(angle),z:stair.z-across*Math.sin(angle)+from*Math.cos(angle)});start.y=f.walk.groundAt(start);
  f.character.teleport(start,f.walk);f.world.step();const initialRescues=f.rescues,requestedSpeed=run?CHARACTER.run:CHARACTER.walk;let reached=false;
  for(let frame=0;frame<900;frame++){
   const before=f.character.position,current=dockLocal(before,island),along=(current.x-stair.x)*Math.sin(angle)+(current.z-stair.z)*Math.cos(angle);if((along-to)*direction>=-.05){reached=true;break;}
   f.character.step({x:Math.sin(island.rotation+angle)*direction,z:Math.cos(island.rotation+angle)*direction,run},DT);f.world.step();f.character.afterStep();
   const after=f.character.position,speed=Math.hypot(after.x-before.x,after.z-before.z)/DT,support=[f.walk.groundAt(after)];
   for(let n=0;n<16;n++){const angle=n/16*Math.PI*2;support.push(f.walk.groundAt({x:after.x+Math.cos(angle)*CHARACTER.radius,z:after.z+Math.sin(angle)*CHARACTER.radius}));}
   assert.ok(speed<=requestedSpeed*1.01,`gravity increased the ${requestedSpeed} input speed to ${speed}`);
   assert.ok(Math.min(...support.map(y=>Math.abs(after.y-y)))<.08,`feet lost stair support at ${JSON.stringify(dockLocal(after,island))}`);
   assert.equal(f.rescues,initialRescues,'stairs do not rely on a rescue teleport');
  }
  assert.ok(reached,`the capsule stalled at ${JSON.stringify(dockLocal(f.character.position,island))}`);
 }finally{f.world.free();}
});

test('architectural clearance agrees with Rapier beneath an elevated wall and beside a same-level wall',()=>{
 // Preserve the V20 vertical-envelope regression independently of the V21
 // summit layout, whose upper station no longer projects over a concourse.
 const world=new R.World({x:0,y:0,z:0}),origin={x:0,z:0,rotation:0},data={groundY:.85,shore:[[-8,-8],[8,-8],[8,8],[-8,8]],obstacles:[{x:-2,z:0,y:3,width:2,depth:2,height:2},{x:2,z:0,y:.85,width:2,depth:2,height:2}]};
 const walk=new IslandWalkWorld(R,world,origin,data);world.step();
 try{
  const capsule=new R.Capsule(CHARACTER.halfHeight,CHARACTER.radius),orientation={x:0,y:0,z:0,w:1};
  const overlap=p=>world.intersectionWithShape({x:p.x,y:p.y+CHARACTER.height/2+CHARACTER.offset,z:p.z},orientation,capsule,undefined,WALK_GROUP,undefined,undefined,c=>walk.obstacles.includes(c));
  const under={x:-2,y:.85,z:0},wall={x:2,y:.85,z:0};
  assert.equal(walk.clear(under),true);assert.equal(overlap(under),null,'the whole capsule fits beneath the elevated wall');
  assert.equal(walk.clear(wall),false);assert.ok(overlap(wall),'the same-level wall blocks the complete capsule');
 }finally{world.free();}
});

for(const[index,berth]of layout.berths.entries())test(`V21 berth ${index+1}: walk the full summit, all platforms, company readers and every stairway`,()=>{
 const f=fixture(berth),plan=navigator(f);
 try{
  assert.equal(layout.railway.version,4,'use the current summit funicular assets with harbor entry and short visits');
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
    const landmarkId={visionx:'visionx-conservatory',beaconfire:'software-workshop',amtrak:'career-station'}[station.id],room=layout.interiors.find(room=>room.landmarkId===landmarkId);
    assert.ok(room,`${station.id}: the company has an authored open interior route`);
    follow(f,plan,room.walkRoute);follow(f,plan,[...room.walkRoute].reverse());
    if(station.id==='amtrak'){const westernRoute=layout.paths.find(path=>path.id==='summit-west-route').points;follow(f,plan,westernRoute);follow(f,plan,[...westernRoute].reverse());}
   }
   follow(f,plan,[...station.walkRoute].reverse());
  }
  // Rooms are visited with their own district, following the public routes.
  // Do not let the test planner invent a shortcut across an unwalkable cliff.
  for(const stair of layout.stairs){const range=f.walkedStairs.get(stair.id);assert.ok(range&&range.max-range.min>=stair.depth-.2,`${stair.id}: the complete tour must physically cover the full stair flight`);}
  walkTo(f,plan,berth.landing);assert.equal(f.rescues,0,'the complete walking visit uses no rescue or staging teleports');
  assert.ok(Math.abs(f.character.position.y-.85)<.04);
 }finally{f.world.free();}
});

test('V21 pedestrian routes remain separate from the steep funicular railway',()=>{
 assert.equal(layout.railway.mode,'funicular');assert.equal(layout.railway.crossings.length,0);
 const routes=[...layout.paths.map(p=>p.points),...layout.railway.stations.map(s=>s.walkRoute)];
 let samples=0;
 for(const route of routes)for(let i=1;i<route.length;i++){
  const a=local(route[i-1]),b=local(route[i]),n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.1));
  for(let j=0;j<=n;j++){
   const t=j/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
   if(z>-12&&z<22){assert.ok(Math.abs(x)>1.5,`pedestrian route crosses the moving cabin envelope at ${x},${z}`);samples++;}
  }
 }
 assert.ok(samples>500,'check the complete approach and cliff routes');
});
