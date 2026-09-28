import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Box3, PropertyBinding, Raycaster, Vector3} from 'three';
import {islands} from '../sources/config.js';
import {IslandWalkWorld, localToWorld} from '../sources/core/character.js';
import {quadFootprintClear} from '../sources/core/quad-bike.js';

const layout=JSON.parse(fs.readFileSync(new URL('../static/models/walk-layout.json',import.meta.url))).islands.find(i=>i.id==='projects');
const island=islands.find(i=>i.id==='projects');
const research=layout.stations.find(s=>s.primary&&s.contentId==='research');
const overview=layout.stations.find(s=>s.directoryOverview);
await R.init();
await MeshoptDecoder.ready;

test('Research entry faces the front of its plateau with a clear grounded quad forecourt',()=>{
 const district=layout.districts.find(d=>d.id==='research');
 const kiosk=layout.obstacles.find(o=>o.name==='research: project kiosk CMU Movie Piracy');
 assert.ok(kiosk.z>district.z+2,'physical kiosk is in front of the observatory, not behind the plateau');
 assert.ok(research.z>kiosk.z+2,'reading point is on its front side');
 assert.ok(Math.abs(research.hitArea.z-kiosk.z-.12)<1e-8,'click face follows the relocated physical board');
 const world=new R.World({x:0,y:0,z:0}),walk=new IslandWalkWorld(R,world,island,layout);
 try{
  world.propagateModifiedBodyPositionsToColliders();world.updateSceneQueries();
  for(const x of[-1,0,1]){
   const p=localToWorld(island,{...research,x});
   assert.ok(Math.abs(walk.groundAt(p)-research.y)<.03,'front apron is on the true 6.5 m plateau');
   assert.ok(walk.clear(p,.24),'walking approach is clear');
   assert.ok(quadFootprintClear(walk,p,island.rotation),'whole quad fits the relocated front apron');
   assert.ok(walk.visible(p,localToWorld(island,research)),'approach can see the interaction target');
  }
 }finally{world.free();}
});

test('arrival board has one overview keyboard target and three intact project click rows, with lamps outside its forecourt',()=>{
 assert.ok(overview,'Projects overview is an explicit read target');
 assert.equal(overview.type,'read');assert.equal(overview.contentId,'projects');assert.equal(overview.readFull,true);
 const rows=layout.stations.filter(s=>s.directory);
 assert.deepEqual(rows.map(s=>s.contentId),['affirmation','research','catering']);
 assert.ok(rows.every(s=>s.hitArea&&s.readFull),'individual project touch/click faces remain available');
 assert.ok(overview.hitArea.y-overview.hitArea.height/2>Math.max(...rows.map(s=>s.hitArea.y+s.hitArea.height/2)),'overview header has a distinct hit area above project rows');
 const board=layout.obstacles.find(o=>o.name==='highlands directory');
 for(const lamp of layout.obstacles.filter(o=>o.name==='arrival lantern')){
  assert.ok(Math.abs(lamp.x-board.x)>board.width/2+.5||lamp.z<board.z-1,'no lamp projects over the front of the board');
  assert.ok(Math.hypot(lamp.x-overview.x,lamp.z-overview.z)>2,'reading forecourt has no lantern post');
 }
});

const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
for(const quality of['high','low'])test(`${quality}: actual exported project signs match their relocated hit areas without a lamp obscuring the directory`,async()=>{
 const document=await io.read(fileURLToPath(new URL(`../static/models/${quality==='low'?'low/':''}projects.glb`,import.meta.url)));
 for(const material of document.getRoot().listMaterials()){
  material.setBaseColorTexture(null);material.setNormalTexture(null);material.setMetallicRoughnessTexture(null);material.setOcclusionTexture(null);material.setEmissiveTexture(null);
 }
 for(const texture of[...document.getRoot().listTextures()])texture.dispose();
 for(const extension of[...document.getRoot().listExtensionsUsed()])if(extension.extensionName==='EXT_meshopt_compression')extension.dispose();
 const bytes=await io.writeBinary(document),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 gltf.scene.updateMatrixWorld(true);
 const sign=gltf.scene.getObjectByName(PropertyBinding.sanitizeNodeName('station_research:research'));assert.ok(sign);
 const bounds=new Box3().setFromObject(sign),center=bounds.getCenter(new Vector3());
 assert.ok(Math.abs(center.z-(research.hitArea.z-.10))<.08,'rendered research sign moved with its authored interaction face');
 assert.ok(Math.abs(bounds.min.y-research.y)<.04,'physical sign feet sit on the elevated platform');
 const ray=new Raycaster();
 function hitsOwnSign(hitArea,name,offsetX=0){
  const origin=new Vector3(hitArea.x+offsetX,hitArea.y,hitArea.z+4);
  ray.set(origin,new Vector3(0,0,-1));
  const first=ray.intersectObject(gltf.scene,true).find(hit=>hit.distance<4.5);
  assert.ok(first,`${name} is rendered across its full face`);
  let owner=first.object;while(owner&&owner.name!==PropertyBinding.sanitizeNodeName(name))owner=owner.parent;
  assert.ok(owner,`${name} face is not hidden by an intervening lamp or other prop at x=${origin.x}`);
 }
 for(const offset of[-.9,0,.9])hitsOwnSign(research.hitArea,'station_research:research',offset);
 for(const station of[overview,...layout.stations.filter(s=>s.directory)]){
  for(const offset of[-1,0,1])hitsOwnSign(station.hitArea,'station_projects-directory',offset);
 }
});
