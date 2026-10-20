import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {TerrainSurface} from '../sources/core/terrain.js';

const layout=JSON.parse(await fs.readFile(new URL('../static/models/walk-layout.json',import.meta.url))).islands.find(i=>i.id==='experience');
const terrain=new TerrainSurface(layout.terrain);

test('the summit stair retains all 52 supported treads while its camera-facing shoulder descends to the workshop',()=>{
 const stair=layout.stairs.find(s=>s.id==='summit-west-stair');
 assert.equal(stair.stepCount,52);assert.equal(stair.width,3.4);assert.equal(stair.depth,17.68);
 assert.equal(stair.frontY,14.55);assert.equal(stair.backY,21.55);
 for(const tread of stair.treads){
  assert.ok(Math.abs(terrain.sample(tread.x,tread.z).height-tread.y)<1e-5);
  for(const across of[-1.2,0,1.2])for(let distance=.2;distance<=14;distance+=.2){
   const floor=terrain.sample(tread.x,tread.z+across+distance)?.height;
   const sightline=tread.y+.7+Math.tan(52*Math.PI/180)*distance;
   assert.ok(floor!==undefined&&floor<=sightline-.35+1e-5,`camera-side terrain obstructs tread ${tread.id}, across=${across}, distance=${distance}: ${floor} > ${sightline-.35}`);
  }
 }
 for(const x of[-23,-20,-17,-14,-11,-8]){
  const near=terrain.sample(x,-13.29).height,far=terrain.sample(x,-9.01).height;
  assert.ok(near>=far,'the shoulder descends toward the visible workshop side');
  assert.ok(Math.abs(far-14.55)<.03,'the rock shoulder meets the lower terrace');
 }
});

test('short visit paving and scenic routes keep distinct navigation roles',()=>{
 assert.deepEqual(layout.shortTours.map(t=>t.contentId),['visionx','beaconfire','amtrak']);
 for(const tour of layout.shortTours){
  const path=layout.paths.find(p=>p.id===tour.id);
  assert.equal(path.short,true);assert.equal(path.scenic,false);assert.deepEqual(path.points,tour.points);
  const station=layout.railway.stations.find(s=>s.id===tour.contentId);
  assert.deepEqual(tour.points[0],[station.boarding.x,station.boarding.z]);assert.deepEqual(tour.points.at(-1),tour.points[0]);
  for(let i=1;i<tour.points.length;i++){
   const a=tour.points[i-1],b=tour.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
   for(let d=.07;d<length;d+=.37){const t=d/length;assert.ok(Math.abs(terrain.sample(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t).height-tour.y)<.001,`${tour.id}: paving must preserve the existing level floor`);}
  }
 }
 assert.ok(layout.paths.filter(p=>p.kind==='stair').every(p=>p.scenic===true));
});

for(const quality of['high','low'])test(`${quality}: all short visits blend into a single decoded GLB terrace floor`,async()=>{
 const bytes=await fs.readFile(new URL(`../static/models/${quality==='low'?'low/':''}experience.glb`,import.meta.url));
 const scene=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 scene.updateMatrixWorld(true);const ray=new THREE.Raycaster();
 for(const tour of layout.shortTours)for(let i=1;i<tour.points.length;i++){
  const a=tour.points[i-1],b=tour.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  for(let d=.17;d<length;d+=.53){
   const t=d/length,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
   // Stone joints sit 6mm above the floor and are batched into the static
   // stone mesh on export. Start below those details to inspect the support face.
   ray.set(new THREE.Vector3(x,tour.y+.004,z),new THREE.Vector3(0,-1,0));ray.far=.04;
   const hits=ray.intersectObject(scene,true),floors=new Set(hits.map(h=>h.object.name));
   assert.equal(floors.size,1,`${tour.id}: overlapping floor materials at ${x},${z}: ${[...floors]}`);
   assert.ok(hits.length&&hits.every(h=>Math.abs(h.point.y-tour.y)<.0035));
   assert.equal(hits[0].object.material.name,'junction_paving',`${tour.id}: its paving must match the surrounding terrace`);
  }
 }
});
