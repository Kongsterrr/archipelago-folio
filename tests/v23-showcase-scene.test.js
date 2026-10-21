import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {islands} from '../sources/config.js';
import {CharacterController,IslandWalkWorld,localToWorld} from '../sources/core/character.js';
import {exhibitRange,selectLandExhibit} from '../sources/core/project-exhibits.js';

const read=async path=>JSON.parse(await fs.readFile(new URL(path,import.meta.url),'utf8'));
const layout=(await read('../static/models/walk-layout.json')).islands.find(i=>i.id==='experience');
const island=islands.find(i=>i.id==='experience');
const companies=await read('../sources/content.json');
await R.init();

async function load(quality){
 const bytes=await fs.readFile(new URL(`../static/models/${quality==='low'?'low/':''}experience.glb`,import.meta.url));
 const scene=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 scene.updateMatrixWorld(true);return scene;
}
function descendant(object,root){for(let o=object;o;o=o.parent)if(o===root)return true;return false;}

test('career directory extends west while preserving the dock-side edge and all shared reading entries',()=>{
 const wall=layout.obstacles.find(o=>o.name==='port directory');
 assert.ok(Math.abs(wall.x+wall.width/2+1.6)<1e-8);
 assert.ok(wall.width>=8,'three company columns have real horizontal space');
 const stair=layout.stairs.find(s=>s.id==='harbor-west-stair');
 assert.ok(wall.x-wall.width/2>=stair.x+stair.width/2+.25,'the complete wall footprint stays outside the full-width west stair');
 const entries=layout.stations.filter(s=>s.directory);
 assert.deepEqual(entries.map(e=>e.contentId),['visionx','beaconfire','amtrak']);
 for(let i=0;i<entries.length;i++){
  const e=entries[i],source=companies.find(c=>c.id===e.contentId);
  assert.equal(e.label,source.title);assert.equal(e.readFull,true);
  assert.ok(source.period&&source.theme);
  assert.deepEqual([e.x,e.z,e.y],[e.hitArea.x,28.1,.85],'pointer distance is measured at its own column');
  if(i)assert.ok(e.hitArea.x-e.hitArea.width/2>entries[i-1].hitArea.x+entries[i-1].hitArea.width/2,'clickable story columns do not overlap');
 }
 const overview=layout.stations.filter(s=>s.directoryOverview);
 assert.equal(overview.length,1);assert.equal(overview[0].contentId,'experience');
});

test('all three demonstrations have independent identities and full apparatus hit areas',()=>{
 const demos=layout.stations.filter(s=>s.demoId);
 assert.deepEqual(demos.map(s=>s.demoId),['visionx','beaconfire','amtrak']);
 assert.deepEqual(demos.map(s=>s.id),['visionx:water','beaconfire:pipeline','amtrak:workflow']);
 assert.equal(layout.stations.find(s=>s.id==='amtrak:dispatch').action,'career-train');
 const world=new R.World({x:0,y:0,z:0}),walk=new IslandWalkWorld(R,world,island,layout);
 try{for(const station of demos){
  assert.equal(station.action,'experience-demo');assert.equal(station.label,'Try an example');
  assert.ok(station.hitArea.width>=1.35&&station.hitArea.depth>=.62&&station.hitArea.height>=1,'the target is the whole worktable');
  const p=localToWorld(island,station);
  assert.ok(walk.clear(p,.24),`${station.id}: approach must remain clear`);
  assert.ok(Math.abs(walk.groundAt(p)-p.y)<.035,`${station.id}: approach must stay grounded`);
 }}finally{world.free();}
});

for(const [index,start]of [...layout.berths.map(berth=>berth.landing),{x:-1.79528,z:28.72715,y:.85}].entries())test(`harbor approach ${index+1}: both dock landings and a piling-side visitor can reach the whole timeline`,()=>{
 const world=new R.World({x:0,y:0,z:0});world.timestep=1/60;
 const walk=new IslandWalkWorld(R,world,island,layout),actor=new CharacterController(R,world);
 actor.teleport(localToWorld(island,start),walk);actor.enable(true);world.step();
 let rescues=0;const teleport=actor.teleport.bind(actor);actor.teleport=(...args)=>{rescues++;return teleport(...args);};
 const entries=layout.stations.filter(s=>s.directory),overview=layout.stations.find(s=>s.directoryOverview);
 const action=station=>{const position=localToWorld(island,station);return{id:station.id,kind:station.type,station,position,distance:p=>Math.hypot(p.x-position.x,p.z-position.z)};};
 const overviewAction=action(overview),actions=[overviewAction,...entries.map(action)];
 // The decorative pier-end piling is solid. Move through the bridge center
 // before crossing west, rather than trying to leave the dock over the sea.
 const route=[...(index===2?[[0,start.z]]:[]),[0,27.5],[overview.x,overview.z],...entries.slice().reverse().map(s=>[s.x,s.z]),[0,27.5]];
 try{for(const [x,z]of route){
  const target=localToWorld(island,{x,z,y:.85});let reached=false;
  for(let frame=0;frame<700;frame++){
   const p=actor.position,dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);
   if(d<.08){reached=true;break;}
   actor.step({x:dx/d,z:dz/d},1/60);world.step();actor.afterStep();
   assert.ok(Math.abs(actor.position.y-.85)<.035,'the wall frontage stays on the quay floor');
  }
  assert.ok(reached,`visitor cannot reach timeline frontage ${x},${z}`);
  if(x===overview.x)assert.equal(selectLandExhibit(actions,actor.position)?.id,overview.id,'E keeps the shared overview');
  const entry=entries.find(e=>Math.abs(e.x-x)<1e-8);
  if(entry){const read=action(entry);assert.ok(read.distance(actor.position)<=exhibitRange(read));assert.equal(walk.visible(actor.position,read.position),true);}
 }
 assert.equal(rescues,0);
 }finally{world.free();}
});

test('a real character can leave the main Amtrak hall route, visit the workflow desk, and return',()=>{
 const route=layout.stations.find(s=>s.id==='amtrak:workflow').walkRoute;
 const world=new R.World({x:0,y:0,z:0});world.timestep=1/60;
 const walk=new IslandWalkWorld(R,world,island,layout),actor=new CharacterController(R,world);
 actor.teleport(localToWorld(island,{x:route[0][0],z:route[0][1],y:21.55}),walk);actor.enable(true);world.step();
 let rescues=0;const teleport=actor.teleport.bind(actor);actor.teleport=(...args)=>{rescues++;return teleport(...args);};
 try{for(const[x,z]of [...route.slice(1),...route.slice(0,-1).reverse()]){
  const target=localToWorld(island,{x,z,y:21.55});let reached=false;
  for(let frame=0;frame<600;frame++){
   const p=actor.position,dx=target.x-p.x,dz=target.z-p.z,distance=Math.hypot(dx,dz);
   if(distance<.08){reached=true;break;}
   actor.step({x:dx/distance,z:dz/distance},1/60);world.step();actor.afterStep();
   assert.ok(Math.abs(actor.position.y-21.55)<.035,'the workflow visit never climbs furniture or window trim');
  }
  assert.ok(reached,`new desk blocks its own approach to ${x},${z}`);
 }
 assert.equal(rescues,0);
 }finally{world.free();}
});

for(const quality of['high','low'])test(`${quality}: decoded showcase geometry has isolated stage nodes and a genuinely visible apparatus`,async()=>{
 const scene=await load(quality),ray=new THREE.Raycaster();
 for(const station of layout.stations.filter(s=>s.demoId)){
  const group=scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName('station_'+station.id));assert.ok(group);
  const bounds=new THREE.Box3().setFromObject(group);
  assert.ok(bounds.min.y>=station.y-.01&&bounds.max.y<=station.y+2.1,'working props stay near the tabletop');
  const h=station.hitArea,origin=new THREE.Vector3(station.x,station.y+1.05,station.z),target=new THREE.Vector3(h.x,station.y+.85,h.z);
  ray.set(origin,target.clone().sub(origin).normalize());ray.far=origin.distanceTo(target)+.2;
  const first=ray.intersectObject(scene,true)[0];
  assert.ok(first&&descendant(first.object,group),`${station.id}: visible geometry is obstructed by ${first?.object.name}`);
  for(let index=0;index<3;index++){
   const role=station.demoId==='visionx'?'sample':'stage',node=scene.getObjectByName(`anim_experience_${station.demoId}_${role}_${index}`);
   assert.ok(node&&descendant(node,group),'feedback belongs to its actual workstation');
   const box=new THREE.Box3().setFromObject(node),size=box.getSize(new THREE.Vector3());
   assert.ok(size.length()>.1&&size.length()<1.4,'animation owner holds one small local element');
  }
 }
 const resultWall=scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName('station_amtrak:showcase'));
 const box=new THREE.Box3().setFromObject(resultWall);
 assert.ok(box.min.y>22.8&&box.max.z<-24.4,'results are mounted on the back wall, never lying on the floor');
 assert.ok(scene.getObjectByName('anim_experience_amtrak_arrival_0'));
 assert.ok(scene.getObjectByName('occluder_junction_terminal_entry_canopy'));
});
