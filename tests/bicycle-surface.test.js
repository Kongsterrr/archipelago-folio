import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BicycleSurface} from '../sources/core/bicycle-surface.js';
import {BicycleController} from '../sources/core/bicycle.js';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {IslandWalkWorld,localToWorld} from '../sources/core/character.js';
import {islands} from '../sources/config.js';
import fs from 'node:fs';
await MeshoptDecoder.ready; await R.init();
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
async function load(file){
 const doc=await io.read(fileURLToPath(new URL('../static/models/'+file,import.meta.url)));
 for(const m of doc.getRoot().listMaterials())m.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null).setEmissiveTexture(null).setOcclusionTexture(null);
 for(const t of [...doc.getRoot().listTextures()])t.dispose();
 for(const e of doc.getRoot().listExtensionsUsed())if(e.extensionName==='EXT_meshopt_compression')e.dispose();
 const bytes=await io.writeBinary(doc);return(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}
const education=islands.find(i=>i.id==='education');
const layout=JSON.parse(fs.readFileSync(new URL('../static/models/walk-layout.json',import.meta.url))).islands.find(i=>i.id==='education');
async function fixture(quality){
 const [campus,model]=await Promise.all([load((quality==='low'?'low/':'')+'education.glb'),load((quality==='low'?'low/':'')+'bicycle.glb')]);
 campus.position.set(education.x,0,education.z);campus.rotation.y=education.rotation;campus.updateMatrixWorld(true);
 const world=new R.World({x:0,y:0,z:0}),walk=new IslandWalkWorld(R,world,education,layout);
 const bike=new BicycleController(R,world,walk,localToWorld(education,{x:3.2,z:18.3,y:.85,yaw:0}));bike.setModel(model,quality);bike.setSurfaceModel(campus);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),origin=new THREE.Vector3(),floors=[];
 campus.traverse(o=>{if(o.isMesh&&['static_sand','static_grass','static_wood','district_learning_campus_paving','district_learning_campus_limestone'].includes(o.name))floors.push(o);});
 const actualFloor=p=>{origin.set(p.x,.951,p.z);ray.set(origin,down);return Math.max(.85,...ray.intersectObjects(floors,false).filter(h=>h.point.y>=.84).map(h=>h.point.y));};
 const relocate=(x,z,yaw=0)=>{bike.teleport(localToWorld(education,{x,z,y:.85,yaw}));};
 return{campus,world,walk,bike,actualFloor,relocate,dispose(){bike.dispose();world.free();}};
}
const places=[['grass',7,2,.85],['arrival plaza',3.2,18.3,.91943],['road',0,10,.883166],['central path',2.8,0,.883166],['chapel apron',-6,-3.25,.8936415],['Duan aisle',-17,-8.5,.883166]];
for(const quality of ['high','low'])test(`${quality}: actual campus paving, roads, plaza and Duan floor drive bicycle support height`,async()=>{
 const f=await fixture(quality);try{
  assert.ok(f.bike.surface.triangleCount>150);
  for(const [label,x,z,height]of places){const p=localToWorld(education,{x,z});assert.ok(Math.abs(f.bike.surface.heightAt(p)-height)<.002,label);assert.ok(Math.abs(f.bike.surface.heightAt(p)-f.actualFloor(p))<1e-5,label);}
  // An empty/failed island reload has a safe navigation fallback, not NaN.
  assert.equal(new BicycleSurface(null,f.walk).heightAt(f.bike.position),.85);
 }finally{f.dispose();}
});

function tireClearance(f){
 const result=[],point=new THREE.Vector3();
 for(const wheel of f.bike.wheelPivots){
  let min=Infinity;
  wheel.traverse(mesh=>{if(!mesh.isMesh)return;const positions=mesh.geometry.getAttribute('position');
   for(let n=0;n<positions.count;n++){
    point.fromBufferAttribute(positions,n).applyMatrix4(mesh.matrixWorld);
    if(point.y>1.03)continue; // Only the lowest tread can touch these public floors.
    min=Math.min(min,point.y-f.bike.surface.heightAt(point));
   }
  });result.push(min);
 }return result;
}
for(const quality of ['high','low'])test(`${quality}: full imported tires clear real surfaces through wheel roll, turns, and paving-edge crossings`,async()=>{
 const f=await fixture(quality);try{
  for(const[label,x,z]of places)for(const yaw of[0,Math.PI/2,Math.PI/4])for(const phase of[0,.8,1.9,3.2,4.8]){
   f.relocate(x,z,yaw);f.bike.wheelAngle=phase;f.bike.steering=.7;f.bike.updateVisual(0,true);
   for(const clearance of tireClearance(f)){
    assert.ok(clearance>=-.004,`${label} ${yaw} phase ${phase}: tire under floor by ${-clearance}`);
    assert.ok(clearance<.026,`${label}: tire floats ${clearance}`);
   }
  }
  // Welcome plaza's actual edge, front/rear on different heights; check both
  // forward and diagonal crossings, including positions between physics steps.
  for(const yaw of[0,Math.PI/4])for(let z=12.9;z<=14.1;z+=.1){
   f.relocate(3.2,z,yaw);f.bike.updateVisual(0,true);
   for(const clearance of tireClearance(f))assert.ok(clearance>=-.006,`paving edge z=${z}, yaw=${yaw}: ${clearance}`);
  }
  // Side-edge regression: sparse circular samples miss the raised plaza under
  // the leading shoulder of the tire, even when both axle samples are correct.
  f.relocate(6.48,16,Math.PI/2);f.bike.wheelAngle=3.2;f.bike.steering=0;f.bike.updateVisual(0,true);
  for(const clearance of tireClearance(f))assert.ok(clearance>=-.001,`plaza side edge: ${clearance}`);
 }finally{f.dispose();}
});

test('paved-edge parking and pauses are stable; a quality reload keeps the same bike/rider frame',async()=>{
 const f=await fixture('high');try{
  f.relocate(3.2,13.5);f.bike.wheelAngle=1.2;f.bike.crankAngle=.8;f.bike.park(true);f.bike.updateVisual(0,true);
  const position=f.bike.group.position.clone(),quaternion=f.bike.group.quaternion.clone(),contacts=f.bike.contactTargets();
  assert.ok(Math.abs(f.bike.group.rotation.x)>.02,'front and rear tires straddle different surfaces');
  for(let n=0;n<120;n++){f.bike.updateVisual(1/60,n%2===0,(n%17)/17);assert.ok(position.distanceTo(f.bike.group.position)<1e-9);assert.ok(quaternion.angleTo(f.bike.group.quaternion)<1e-7);}
  f.bike.setModel(await load('low/bicycle.glb'),'low');
  const lowCampus=await load('low/education.glb');lowCampus.position.copy(f.campus.position);lowCampus.rotation.copy(f.campus.rotation);f.bike.setSurfaceModel(lowCampus);
  assert.ok(position.distanceTo(f.bike.group.position)<.002);assert.ok(quaternion.angleTo(f.bike.group.quaternion)<.005);
  const updated=f.bike.contactTargets();for(const side of['Left','Right'])for(const role of['grips','feet'])assert.ok(new THREE.Vector3(...contacts[role][side]).distanceTo(new THREE.Vector3(...updated[role][side]))<1e-5);
 }finally{f.dispose();}
});
