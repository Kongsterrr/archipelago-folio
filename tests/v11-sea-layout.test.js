import test from 'node:test';
import assert from 'node:assert/strict';
import {islands,toWorld,secretPlaces,cargoStarts} from '../sources/config.js';
import {dockLocal} from '../sources/core/dock.js';
import {FLEET_ROUTES,routePoint,routeYaw,waterClear,sweptHullWaterClear,CHANNEL_POSTS} from '../sources/world/water-space.js';
import {HABITATS,SHOALS,birdPose,SEA_LIFE} from '../sources/world/marine.js';
import {TOY_PLACEMENTS} from '../sources/world/props.js';

test('three V10 vessels have complete swept-hull clearance around four V11 islands',()=>{
 assert.equal(islands.length,4);
 assert.deepEqual(FLEET_ROUTES.map(r=>r.model),['cruise','yacht-one','yacht-two']);
 for(const route of FLEET_ROUTES)for(let degree=0;degree<360;degree++){
  const a=degree*Math.PI/180,b=(degree+1)*Math.PI/180;
  assert.ok(sweptHullWaterClear(routePoint(route,a),routePoint(route,b),routeYaw(route,a),routeYaw(route,b),route),`${route.id} swept hull at ${degree} degrees`);
 }
});

test('four sea-life classes retain clear habitats and full fish scatter envelopes',()=>{
 assert.deepEqual(SEA_LIFE.map(s=>s.id),['dolphin','shark','fish','turtle']);
 for(const h of HABITATS)for(let n=0;n<180;n++){
  const a=n/180*Math.PI*2;
  assert.ok(waterClear({x:h.x+Math.cos(a)*h.rx,z:h.z+Math.sin(a)*h.rz},h.kind==='turtle'?.7:1.3,{activities:true,docks:h.kind==='shark'}),`${h.kind} habitat ${h.x},${h.z}`);
 }
 for(const h of SHOALS)for(let n=0;n<180;n++){
  const a=n/180*Math.PI*2;
  assert.ok(waterClear({x:h.x+Math.cos(a)*4,z:h.z+Math.sin(a)*2.4},.35,{activities:true}),`shoal ${h.x},${h.z}`);
 }
});

test('all ordinary toys sit outside new terrain, reading approaches and sea-game corridors',()=>{
 assert.equal(Object.values(TOY_PLACEMENTS).flat().length+cargoStarts.length,24);
 for(const [kind,positions]of Object.entries(TOY_PLACEMENTS))for(const [x,z]of positions)
  assert.ok(waterClear({x,z},kind==='crate'?1.7:1,{activities:true,docks:true}),`${kind} at ${x},${z}`);
});

test('animal and fleet clearance includes full expanded piers, arch columns and posts',()=>{
 for(const island of islands){const pier=island.pier;
  assert.equal(waterClear(toWorld(island,0,pier.endZ-.25)),false,`${island.id} far pier deck`);
  assert.equal(waterClear(toWorld(island,pier.width/2+.2,pier.endZ-.5)),false,`${island.id} pier edge`);
 }
 for(const x of [-6,6])assert.equal(waterClear({x:secretPlaces.arch.x+x,z:secretPlaces.arch.z}),false);
 for(const [x,z]of CHANNEL_POSTS)assert.equal(waterClear({x,z}),false);
});

test('all bird perches follow the four actual piers without duplicate reduced-motion roosts',()=>{
 const unique=new Set(),groups=new Map();
 for(let n=0;n<12;n++){
  const pose=birdPose(n,7,true),island=islands.find(i=>i.id===pose.islandId),p=dockLocal(pose,island),pier=island.pier;
  assert.equal(pose.fly,false);assert.ok(Math.abs(p.x)<=pier.width/2&&p.z>pier.startZ&&p.z<pier.endZ);
  assert.equal(pose.y,pier.deckY+.42);
  unique.add(`${pose.x.toFixed(3)},${pose.z.toFixed(3)}`);groups.set(island.id,(groups.get(island.id)||0)+1);
 }
 assert.equal(unique.size,12);assert.deepEqual([...groups.values()],[3,3,3,3]);
 for(let n=8;n<12;n++)assert.equal(birdPose(n,7,false).fly,true);
});
