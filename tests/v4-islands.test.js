import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {CharacterController,IslandWalkWorld,localToWorld,SEA_GROUP} from '../sources/core/character.js';
import {createIslandColliders} from '../sources/core/collisions.js';
import {islands} from '../sources/config.js';
import {DiscoveryStore} from '../sources/core/discovery.js';
import {IslandController} from '../sources/world/island.js';
import {Group} from 'three';
await R.init();
const layouts=JSON.parse(fs.readFileSync(new URL('../static/models/walk-layout.json',import.meta.url))).islands;
for(const layout of layouts)test(`${layout.id}: actual character completes scenic loop, both berths clear, bench accessible`,()=>{
 const i=islands.find(i=>i.id===layout.id),world=new R.World({x:0,y:0,z:0});world.timestep=1/60;
 try{createIslandColliders(R,world,i);world.forEachCollider(c=>c.setCollisionGroups(SEA_GROUP));const walk=new IslandWalkWorld(R,world,i,layout),c=new CharacterController(R,world);world.step();
 for(const b of layout.berths){const p=localToWorld(i,b.boat),l=localToWorld(i,b.landing);assert.ok(walk.clear(l),'landing blocked');assert.equal(world.intersectionWithShape({x:p.x,y:.35,z:p.z},{x:0,y:Math.sin(p.yaw/2),z:0,w:Math.cos(p.yaw/2)},new R.Cuboid(.85,.7,2.1),undefined,SEA_GROUP),null,'boat berth blocked');}
 c.teleport(localToWorld(i,layout.berths[0].landing),walk);c.enable(true);world.step();let rescues=0;const tp=c.teleport.bind(c);c.teleport=(...a)=>{rescues++;return tp(...a);};
 for(const [x,z]of layout.route){const target=localToWorld(i,{x,z});let reached=false;const budget=Math.ceil((Math.hypot(c.position.x-target.x,c.position.z-target.z)/2.4+4)*60);for(let n=0;n<budget;n++){const dx=target.x-c.position.x,dz=target.z-c.position.z,d=Math.hypot(dx,dz);if(d<.09){reached=true;break;}const scale=Math.min(1,d/(2.4/60));c.step({x:dx/d*scale,z:dz/d*scale},1/60);world.step();c.afterStep();assert.ok(Math.abs(c.position.y-walk.groundAt(c.position))<.08,'feet lost surface');}assert.ok(reached,`route blocked ${x},${z}`);}
 assert.equal(rescues,0,'route needed a rescue');assert.ok(layout.stations.length>=3);for(const s of layout.stations)assert.ok(walk.clear(localToWorld(i,s)),`${s.id} inaccessible`);
 const approach=localToWorld(i,layout.bench.approach);assert.ok(walk.clear(approach));assert.ok(walk.visible(approach,approach));c.teleport(approach,walk);c.seated=true;world.step();c.step({x:0,z:0},1/60);world.step();assert.equal(c.speed,0);c.step({x:1,z:0},1/60);assert.equal(c.seated,false);
 }finally{world.free();}
});
test('V3 migration keeps histories and adds an independent nine-island walking journal',()=>{const data=new Map([['jack-archipelago-v3',JSON.stringify({settings:{livery:'graphite',zoom:2,quality:'low'},visited:['amtrak'],viewed:['research'],seaLife:['shark'],secrets:['bell'],completed:['buoy']})]]),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};const store=new DiscoveryStore({storage});assert.equal(store.settings.livery,'graphite');assert.equal(store.settings.zoom,2);assert.equal(store.settings.walkZoom,1);assert.ok(store.visited.has('amtrak'));const before=store.stamps;store.land('amtrak');assert.equal(store.stamps,before);const loaded=new DiscoveryStore({storage});assert.ok(loaded.ashore.has('amtrak'));assert.ok(loaded.seaLife.has('shark'));});
test('Amtrak pauses its train phase before crossing a walking visitor',()=>{const island={...islands.find(i=>i.id==='amtrak'),x:0,z:0,rotation:0},ctrl=new IslandController(island,new Group());ctrl.activate();ctrl.pedestrian={x:8.8,z:-1.4};for(let n=0;n<60;n++)ctrl.update(1/60,{x:0,z:0},n/60);assert.equal(ctrl.elapsed,0);ctrl.pedestrian=null;ctrl.update(1/60,{x:0,z:0},2);assert.ok(ctrl.elapsed>0);});
