import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {islands} from '../sources/config.js';
import {CharacterController, IslandWalkWorld, localToWorld, WALK_GROUP, CHARACTER} from '../sources/core/character.js';
import {dockLocal} from '../sources/core/dock.js';
import {CareerTrainController} from '../sources/core/career-train.js';
import {CareerJourney} from '../sources/world/career-journey.js';
import {PlayerController} from '../sources/core/player.js';
import {landPrimaryAction, selectLandExhibit} from '../sources/core/project-exhibits.js';

const layouts=JSON.parse(await fs.readFile(new URL('../static/models/walk-layout.json',import.meta.url)));
const layout=layouts.islands.find(item=>item.id==='experience'),island=islands.find(item=>item.id==='experience'),DT=1/60;
const tours=layout.shortTours;
assert.equal(tours?.length,3,'test the actual V22 export, including all three short company visits');
const actions=layout.stations.map(station=>{
 const position=localToWorld(island,station);
 return{id:station.id,station,kind:station.type,position,distance:p=>Math.hypot(p.x-position.x,p.z-position.z)};
});
await R.init();

function fixture(tour){
 const station=layout.railway.stations.find(station=>station.id===tour.contentId);
 const world=new R.World({x:0,y:0,z:0});world.timestep=DT;
 const walk=new IslandWalkWorld(R,world,island,layout),character=new CharacterController(R,world),scene=new THREE.Scene();
 character.teleport(localToWorld(island,station.boarding),walk);character.enable(true);world.step();
 const boat={position:{x:0,y:0,z:0},speed:0,yaw:0},player=new PlayerController(boat,character),root=new THREE.Group();scene.add(root);
 player.mode='walking';player.island=island;player.berth={landing:localToWorld(island,layout.berths[0].landing)};
 const inputs={enabled:true,clear(){},setEnabled(value){this.enabled=value;}};
 const game={boat,player,character,scene,inputs,mode:'exploring',jack:{root,resetPose(){}},cancelChallenge(){},resetCamera(){},events:{trigger(){}}};
 Object.defineProperty(game,'frozen',{get(){return player.transitioning||player.pauseReasons.size>0;}});
 const journey=new CareerJourney(game,R);
 Object.assign(journey,{ready:true,island,railway:layout.railway,walk,controller:new CareerTrainController(layout.railway,{island}),visual:{mountPoint:new THREE.Group(),update(){}},marker:{visible:false,position:new THREE.Vector3()}});game.journey=journey;
 journey.controller.parkAtStation(station.id);
 // Keep the full, level production cabin collider at the platform while Jack
 // visits. The walking test cannot pass through an omitted parked vehicle.
 for(const spec of journey.controller.cars){
  const body=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
  const collider=world.createCollider(R.ColliderDesc.cuboid(spec.halfWidth,spec.collisionHalfHeight??.8,spec.halfLength).setCollisionGroups(WALK_GROUP).setTranslation(0,spec.collisionCenterY??1,0),body);
  walk.handles.add(collider.handle);walk.obstacles.push(collider);journey.colliders.push({body,collider});
 }
 journey.syncPhysics(true);world.step();
 let rescues=0;const teleport=character.teleport.bind(character);character.teleport=(...args)=>{rescues++;return teleport(...args);};
 return{world,walk,character,game,player,journey,station,elapsed:0,distance:0,get rescues(){return rescues;},finishTransition(){for(let frame=0;frame<27;frame++){player.tick(DT);world.step();}inputs.setEnabled(!game.frozen);}};
}

function selected(f){return selectLandExhibit(actions,f.character.position,{visible:action=>f.walk.visible(f.character.position,action.position)});}

// Direct input follows the published short tour. There is deliberately no A*
// detour, rescue teleport, run input or enlarged proximity range in this test.
function walkTo(f,[x,z],height){
 const goal=localToWorld(island,{x,z,y:height}),start=f.elapsed;
 while(f.elapsed-start<8){
  const p=f.character.position,dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz);
  if(d<.055)return;
  const scale=Math.min(1,d/(CHARACTER.walk*DT));
  f.character.step({x:dx/d*scale,z:dz/d*scale},DT);f.world.step();f.character.afterStep();f.elapsed+=DT;
  const after=f.character.position;
  f.distance+=Math.hypot(after.x-p.x,after.z-p.z);
  assert.ok(Math.abs(after.y-height)<.055,`feet lost the level short-visit surface at ${JSON.stringify(dockLocal(after,island))}, y=${after.y}`);
  assert.equal(f.rescues,0,'a short visit must never need a safety teleport');
 }
 assert.fail(`Rapier blocked at ${JSON.stringify(dockLocal(f.character.position,island))} on the direct path to ${x},${z}`);
}

test('V22: all three physical short visits total at most 20 seconds at normal walking speed',async suite=>{
 let total=0;
 for(const tour of tours)await suite.test(`${tour.contentId}: reader in 3 seconds, apparatus, return and reboard`,context=>{
 const f=fixture(tour);
 try{
  const mapPath=layout.paths.find(path=>path.id===tour.id);
  assert.ok(mapPath.short&&!mapPath.scenic,'the minimap uses the same short route');assert.deepEqual(mapPath.points,tour.points);
  f.journey.nearby();assert.equal(f.game.canBoardTrain,true,'the initial point is an actual boarding point');
  assert.equal(landPrimaryAction({player:f.player,canBoardTrain:f.game.canBoardTrain,nearStation:selected(f)})?.kind,'board-train');
  let readerReached=false,readerSeconds=null,firstReadableSeconds=null;const visitedActions=new Set();
  for(const point of tour.points.slice(1)){
   walkTo(f,point,tour.y);f.journey.nearby();
   const exhibit=selected(f);
   const reader=layout.stations.find(station=>station.id===tour.readerId),atReader=Math.hypot(point[0]-reader.x,point[1]-reader.z)<.01;
   if(atReader){assert.equal(exhibit?.id,tour.readerId);assert.equal(f.game.canBoardTrain,false,'the reader is far enough from the door that E does not reboard');}
   if(exhibit?.id===tour.readerId&&!f.game.canBoardTrain){
    assert.equal(landPrimaryAction({player:f.player,canBoardTrain:f.game.canBoardTrain,nearStation:exhibit})?.kind,'read');
    assert.equal(exhibit.station.contentId,tour.contentId);assert.equal(exhibit.station.readFull,true);
    firstReadableSeconds??=f.elapsed;
    if(atReader){
     if(!readerReached){readerSeconds=f.elapsed;assert.ok(f.elapsed<=3,`${tour.contentId}: reader took ${f.elapsed.toFixed(3)} seconds`);}
     readerReached=true;
    }
   }
   if(f.game.canBoardTrain)assert.equal(landPrimaryAction({player:f.player,canBoardTrain:true,nearStation:exhibit})?.kind,'board-train','returning to the door keeps boarding priority over a nearby read range');
   if(tour.actionIds.includes(exhibit?.id)){
    assert.equal(f.game.canBoardTrain,false,'F is available at the apparatus, separate from the train door');
    assert.equal(exhibit.kind,'action');assert.equal(exhibit.station.contentId,tour.contentId);visitedActions.add(exhibit.id);
   }
  }
  assert.equal(readerReached,true,'the authored route reaches the complete company story');
  assert.deepEqual([...visitedActions].sort(),[...tour.actionIds].sort(),'the direct route reaches every promised working apparatus');
  assert.ok(f.elapsed<=20,`${tour.contentId}: complete short visit took ${f.elapsed.toFixed(3)} seconds`);
  assert.ok(f.distance/f.elapsed<=CHARACTER.walk*1.01,'short visits keep the normal average walking speed across surface contact seams');
  total+=f.elapsed;
  context.diagnostic(`normal walk: readable ${firstReadableSeconds.toFixed(2)}s, reader approach ${readerSeconds.toFixed(2)}s, complete short visit ${f.elapsed.toFixed(2)}s, ${f.distance.toFixed(2)} units`);
  assert.equal(f.game.canBoardTrain,true,'the loop returns to an unobstructed door');
  assert.equal(f.journey.board(),true);f.finishTransition();assert.equal(f.player.ridingTrain,true);
  assert.equal(f.journey.leave(),true);f.finishTransition();assert.equal(f.player.walking,true);
  assert.ok(Math.abs(f.character.position.y-tour.y)<.04,'disembarking returns to the same supported level');
 }finally{f.world.free();}
 });
 assert.ok(total<=20,`the three physical short visits total ${total.toFixed(3)}s, exceeding the 20s combined budget`);
 suite.diagnostic(`combined normal-walk visit time ${total.toFixed(2)}s`);
});

const apparatus=[
 {contentId:'visionx',id:'visionx:water',obstacle:'garden entry worktable'},
 {contentId:'beaconfire',id:'beaconfire:pipeline',obstacle:'entry pipeline workbench'},
];
for(const item of apparatus)test(`${item.contentId}: the new entry apparatus is solid and cannot be operated through its back`,()=>{
 const tour=tours.find(tour=>tour.contentId===item.contentId),f=fixture(tour),action=actions.find(action=>action.id===item.id),prop=layout.obstacles.find(obstacle=>obstacle.name===item.obstacle);
 try{
  assert.ok(prop,'the visible entry apparatus has its own collision');
  const index=tour.points.findIndex(([x,z])=>Math.hypot(x-action.station.x,z-action.station.z)<.01);
  assert.ok(index>0);for(const point of tour.points.slice(1,index+1))walkTo(f,point,tour.y);
  assert.equal(selected(f)?.id,item.id);assert.equal(f.walk.visible(f.character.position,action.position),true);
  const behind=localToWorld(island,{x:action.station.x,z:prop.z-prop.depth/2-.5,y:tour.y});
  assert.equal(f.walk.visible(behind,action.position),false,'the solid table blocks reach-through interaction');
  const target=localToWorld(island,prop),start=f.character.position,d=Math.hypot(target.x-start.x,target.z-start.z);
  const input={x:(target.x-start.x)/d,z:(target.z-start.z)/d};
  for(let frame=0;frame<120;frame++){f.character.step(input,DT);f.world.step();f.character.afterStep();}
  const stopped=dockLocal(f.character.position,island),angle=prop.rotation||0,dx=stopped.x-prop.x,dz=stopped.z-prop.z;
  assert.ok(Math.abs(dx*Math.cos(angle)-dz*Math.sin(angle))>=prop.width/2||Math.abs(dx*Math.sin(angle)+dz*Math.cos(angle))>=prop.depth/2,'the complete character cannot walk through the apparatus');
  assert.equal(f.rescues,0);
 }finally{f.world.free();}
});

async function model(quality){
 const bytes=await fs.readFile(new URL(`../static/models/${quality==='low'?'low/':''}experience.glb`,import.meta.url));
 const scene=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 scene.updateMatrixWorld(true);return scene;
}
function belongsTo(object,group){for(let owner=object;owner;owner=owner.parent)if(owner===group)return true;return false;}

for(const quality of['high','low'])test(`${quality}: the real exported short-visit signs and apparatus are visible from their walking interaction points`,async()=>{
 const scene=await model(quality),ray=new THREE.Raycaster();
 for(const tour of tours){
  const reader=layout.stations.find(station=>station.id===tour.readerId),face=reader.hitArea;
  const group=scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(`station_${reader.id}`));assert.ok(group);
  const origin=new THREE.Vector3(reader.x,reader.y+1.05,reader.z);
  for(const fraction of[-.25,0,.25]){
   const target=new THREE.Vector3(face.x+Math.cos(face.yaw||0)*face.width*fraction,face.y,face.z-Math.sin(face.yaw||0)*face.width*fraction),distance=origin.distanceTo(target);
   ray.set(origin,target.sub(origin).normalize());ray.far=distance+.12;
   const hit=ray.intersectObject(scene,true)[0];
   assert.ok(hit&&belongsTo(hit.object,group),`${reader.id}: the visible read target is blocked from its actual approach by ${hit?.object.name||'missing geometry'}`);
  }
 }
 for(const item of apparatus){
  const action=layout.stations.find(station=>station.id===item.id),prop=layout.obstacles.find(obstacle=>obstacle.name===item.obstacle),group=scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(`station_${item.id}`));
  assert.ok(group,'the functional apparatus survives both quality exports');
  const bounds=new THREE.Box3().setFromObject(group);assert.ok(!bounds.isEmpty());
  assert.ok(bounds.min.y>=action.y-.05&&bounds.max.y>action.y+.85,'the apparatus stands on the same tier as its interaction');
  const origin=new THREE.Vector3(action.x,action.y+1.05,action.z),target=new THREE.Vector3(prop.x,action.y+.86,prop.z);
  ray.set(origin,target.clone().sub(origin).normalize());ray.far=origin.distanceTo(target)+.2;
  const hit=ray.intersectObject(scene,true)[0];assert.ok(hit&&belongsTo(hit.object,group),`${item.id}: physical entry apparatus is hidden by ${hit?.object.name||'missing geometry'}`);
 }
});
