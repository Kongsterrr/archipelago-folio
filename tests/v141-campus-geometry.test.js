import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {islands} from '../sources/config.js';
import {IslandWalkWorld,CharacterController,localToWorld} from '../sources/core/character.js';
import {applySunsetMaterials,releaseSunsetMaterials} from '../sources/world/sunset-materials.js';
import {IslandController} from '../sources/world/island.js';

const json=async p=>JSON.parse(await fs.readFile(new URL(p,import.meta.url),'utf8'));
const layout=(await json('../static/models/walk-layout.json')).islands.find(i=>i.id==='education');
const island=islands.find(i=>i.id==='education'),interior=layout.interiors.find(i=>i.landmarkId==='duan-center');
await R.init();
const models=new Map();
async function campus(quality){
 if(!models.has(quality))models.set(quality,(async()=>{const buffer=await fs.readFile(new URL(`../static/models/${quality==='low'?'low/':''}education.glb`,import.meta.url));return(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'')).scene;})());
 return models.get(quality);
}
function worldFixture(){const world=new R.World({x:0,y:0,z:0});world.timestep=1/60;const walk=new IslandWalkWorld(R,world,island,layout),actor=new CharacterController(R,world);world.step();return{world,walk,actor};}
function traverse(f,points){
 for(const [x,z]of points){const target=localToWorld(island,{x,z}),distance=Math.hypot(f.actor.position.x-target.x,f.actor.position.z-target.z);let reached=false;
  for(let i=0;i<Math.ceil((distance/2.4+2)*60);i++){const p=f.actor.position,dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);if(d<.065){reached=true;break;}const scale=Math.min(1,d/(2.4/60));f.actor.step({x:dx/d*scale,z:dz/d*scale},1/60);f.world.step();f.actor.afterStep();assert.ok(Math.abs(f.actor.position.y-f.walk.groundAt(f.actor.position))<.08,'interior has one continuous ground level');}
  assert.ok(reached,`actual controller must pass ${x},${z}`);
 }
}
const nodes=['occluder_campus_duan_ground_walls','occluder_campus_duan_podium_roof','occluder_campus_duan_lower','occluder_campus_duan_middle','occluder_campus_duan_upper','occluder_campus_duan_crown','occluder_campus_duan_terraces'];

test('Duan has two public entrances, a single ground floor and a separate landmark read station',()=>{
 assert.equal(interior.floorY,layout.groundY);assert.deepEqual(interior.bounds,{x:-17,z:-8.5,width:10,depth:7});
 assert.deepEqual(interior.entrances.map(e=>e.id),['front','east']);assert.ok(interior.entrances.every(e=>e.width>=2.6));
 const landmark=layout.stations.find(s=>s.landmarkId==='duan-center');assert.equal(landmark.id,'learning:duan');assert.equal(landmark.readFull,true);assert.equal(landmark.primary,false);assert.equal(landmark.readLabel,'About this landmark');assert.ok(landmark.hitArea.width>=2.6);
 assert.deepEqual(layout.stations.filter(s=>s.primary&&s.schoolId).map(s=>s.schoolId),['bu','cmu'],'the new architectural read does not become a third school');
 assert.equal(layout.stations.find(s=>s.action==='education-duan').label,'Explore the building');
 assert.ok(layout.benches.find(b=>b.action==='education-study'));assert.ok(layout.benches.find(b=>b.id==='learning:duan-seat'));
});

for(const reversed of[false,true])test(`actual Rapier character traverses Duan ${reversed?'east → interior → front':'front → interior → east'} without a hidden reset`,()=>{
 const f=worldFixture();try{const route=reversed?[...interior.walkRoute].reverse():interior.walkRoute;f.actor.teleport(localToWorld(island,{x:route[0][0],z:route[0][1]}),f.walk);f.actor.enable(true);f.world.step();let rescues=0;const reset=f.actor.teleport.bind(f.actor);f.actor.teleport=(...a)=>{rescues++;return reset(...a);};traverse(f,route.slice(1));assert.equal(rescues,0);}finally{f.world.free();}
});

test('tower cantilevers do not create invisible ground-level boxes across the through-route',()=>{
 const f=worldFixture();try{
  const obstacles=layout.obstacles.filter(o=>o.name.startsWith('Duan '));assert.ok(obstacles.length>=10);assert.ok(obstacles.every(o=>o.height<=2.8),'only the podium walls, core, columns and furniture are ground obstacles');
  for(const[x,z]of [[-17,-4.8],[-17,-6],[-17,-8.5],[-14,-8.5],[-12,-8.5],[-10.6,-8.5]])assert.ok(f.walk.clear(localToWorld(island,{x,z}),1.19),`2.6m circulation remains clear at ${x},${z}`);
  for(const b of layout.benches)assert.ok(f.walk.clear(localToWorld(island,b.approach),.24),`${b.id} has a clear capsule-width approach`);
 }finally{f.world.free();}
});

test('BU, CMU and Duan have explicit local framing volumes rather than a fixed old camera distance',()=>{
 for(const id of['learning:bu','learning:cmu','learning:duan']){const station=layout.stations.find(s=>s.id===id),bounds=station.camera?.fitBounds;assert.ok(bounds,`${id} requires fitBounds`);for(const axis of['x','y','z'])assert.ok(Number.isFinite(bounds.min[axis])&&bounds.max[axis]>bounds.min[axis]);}
 const duan=layout.stations.find(s=>s.id==='learning:duan').camera.fitBounds;assert.ok(duan.max.y-layout.groundY>=13.5);
});

for(const quality of['high','low'])test(`${quality}: shipped Duan has staggered volumes, readable facade plaque, separate occlusion and all interaction nodes`,async()=>{
 const model=await campus(quality);model.updateMatrixWorld(true);const boxes=[];
 for(const name of nodes){const node=model.getObjectByName(name);assert.ok(node,`${name} exists`);const box=new THREE.Box3().setFromObject(node);assert.ok(!box.isEmpty());if(/_(lower|middle|upper|crown)$/.test(name))boxes.push(box);}
 const centers=boxes.map(b=>b.getCenter(new THREE.Vector3()));assert.ok(Math.max(...centers.map(c=>c.x))-Math.min(...centers.map(c=>c.x))>1,'stacked blocks have intentional horizontal offsets');
 assert.ok(boxes.every((b,n)=>!n||b.min.y>=boxes[n-1].max.y-.2),'tower tiers progress upward without an accidental interpenetrating stack');
 const towerBounds=new THREE.Box3();for(const name of nodes)towerBounds.union(new THREE.Box3().setFromObject(model.getObjectByName(name)));assert.ok(towerBounds.max.y-layout.groundY>=13.4&&towerBounds.max.y-layout.groundY<14);
 for(const name of['anim_campus_study_page','anim_campus_study_lights',...[0,1,2].flatMap(n=>['anim_duan_theme_'+n,'anim_duan_pulse_'+n])]){const node=model.getObjectByName(name);assert.ok(node,`${name} preserved through export`);assert.ok(!new THREE.Box3().setFromObject(node).isEmpty(),`${name} contains rendered geometry`);}
 const plaque=model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName('station_learning:duan'));assert.ok(plaque);assert.equal(plaque.parent.name,'occluder_campus_duan_ground_walls','the clickable plaque belongs to the facade it is attached to');
 const face=layout.stations.find(s=>s.id==='learning:duan').hitArea,ray=new THREE.Raycaster();
 for(const dx of[-.38,0,.38])for(const dy of[-.35,0,.35]){ray.set(new THREE.Vector3(face.x+face.width*dx,face.y+face.height*dy,face.z+3),new THREE.Vector3(0,0,-1));const hit=ray.intersectObject(model,true).find(h=>h.distance<3.5);assert.ok(hit);let owner=hit.object;while(owner&&owner!==plaque)owner=owner.parent;assert.ok(owner,`actual facade tablet is first visible target at ${dx},${dy}`);}
 const controller=new IslandController(island,new THREE.Group());controller.bind(model);
 for(const name of nodes)model.getObjectByName(name).traverse(o=>{if(o.isMesh)assert.ok(controller.occluders.includes(o),`${o.name} can fade while Jack is indoors`);});
 let paving=0;model.traverse(o=>{if(o.isMesh&&o.material.name==='campus_paving'){paving++;assert.ok(!controller.occluders.includes(o),'ground surfaces stay opaque during facade fading');}});assert.ok(paving);controller.release();
});

test('high and low exports retain the same campus scene contracts and meet both compressed budgets',async()=>{
 const high=await json('../static/models/manifest.json'),low=await json('../static/models/low/manifest.json'),a=high.models.find(m=>m.id==='education'),b=low.models.find(m=>m.id==='education');
 assert.equal(high.walkLayout,low.walkLayout);assert.deepEqual(a.dock,b.dock);assert.deepEqual(a.shorePolygon,b.shorePolygon);assert.deepEqual(a.occluders,b.occluders);assert.deepEqual(a.animationNodes.map(n=>[n.name,n.position,n.rotation,n.scale]),b.animationNodes.map(n=>[n.name,n.position,n.rotation,n.scale]));
 assert.equal(a.revision,'v143-campus-sculpture');assert.equal(b.revision,a.revision);assert.ok(a.bytes<=1_500_000);assert.ok(b.bytes<=1_000_000);assert.ok(b.triangles<a.triangles);
 for(const [metadata,folder]of[[a,''],[b,'low/']])assert.equal(metadata.bytes,(await fs.stat(new URL(`../static/models/${folder}education.glb`,import.meta.url))).size);
});

test('actual new glass and metal finishes preserve their authored palette and alpha under sunset materials',async()=>{
 const model=await campus('high'),originals=[];model.traverse(o=>{if(o.isMesh&&['campus_windowClear','campus_reflectionBlue','campus_reflectionGold','campus_silver','campus_bronze'].includes(o.material.name))originals.push({mesh:o,source:o.material,color:o.material.color.clone(),opacity:o.material.opacity,metalness:o.material.metalness,roughness:o.material.roughness});});
 assert.equal(new Set(originals.map(o=>o.source.name)).size,5);applySunsetMaterials(model,'education');
 for(const{mesh,source,color,opacity,roughness,metalness}of originals){assert.ok(mesh.material.color.equals(color),source.name);assert.equal(mesh.material.opacity,opacity);assert.equal(mesh.material.roughness,roughness);assert.equal(mesh.material.metalness,metalness);if(source.name==='campus_windowClear'){assert.ok(mesh.material.transparent);assert.ok(Math.abs(mesh.material.opacity-.24)<.001);}}
 releaseSunsetMaterials(model);
});
