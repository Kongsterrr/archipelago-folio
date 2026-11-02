import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {IslandController} from '../sources/world/island.js';
import {SurfaceLibrary} from '../sources/world/surface-library.js';
import {applySunsetMaterials,releaseSunsetMaterials} from '../sources/world/sunset-materials.js';
import {setOcclusionOpacity} from '../sources/world/occlusion-material.js';
import {islands} from '../sources/config.js';

const materials=mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material];
const state=material=>({opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite,depthTest:material.depthTest});
const load=async(id,quality)=>{
 const bytes=await fs.readFile(new URL(`../static/models/${quality==='low'?'low/':''}${id}.glb`,import.meta.url));
 return(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
};

test('temporary fades preserve authored glass and only invalidate an opaque material on render-mode transitions',()=>{
 for(const options of[{}, {transparent:true,opacity:.4,depthWrite:false}, {transparent:true,opacity:1}, {opacity:.65,depthWrite:false}]){
  const material=new THREE.MeshStandardMaterial(options),base=state(material),version=material.version;
  for(const factor of[.2,.2,.025,.025]){
   setOcclusionOpacity(material,factor);
   assert.equal(material.opacity,base.opacity*factor);assert.equal(material.transparent,true);assert.equal(material.depthWrite,false);assert.equal(material.depthTest,base.depthTest);
   assert.equal(material.version,version+(base.transparent?0:1),'a continuing fade does not recreate its shader every occlusion tick');
  }
  setOcclusionOpacity(material);setOcclusionOpacity(material);
  assert.deepEqual(state(material),base);assert.equal(material.version,version+(base.transparent?0:2));
  setOcclusionOpacity(material,.2);setOcclusionOpacity(material);
  assert.deepEqual(state(material),base);assert.equal(material.version,version+(base.transparent?0:4));
 }
});

for(const id of['about','education'])for(const quality of['high','low'])test(`${id} ${quality}: real architecture remains opaque between fades and texture-quality swaps`,async()=>{
 const model=await load(id,quality),original=new Map();
 model.traverse(mesh=>{if(mesh.isMesh)original.set(mesh,{material:mesh.material,geometry:mesh.geometry});});
 applySunsetMaterials(model,id);
 const authored=new Map();model.traverse(mesh=>{if(mesh.isMesh)authored.set(mesh,materials(mesh).map(state));});
 const controller=new IslandController(islands.find(island=>island.id===id),model);controller.bind(model);
 const library=new SurfaceLibrary({loader:{dispose(){}},fetchManifest:async()=>({qualities:{high:{surfaces:{}},low:{surfaces:{}}}})});
 library.bind(model,id);
 const bound=new Map(controller.occluders.map(mesh=>[mesh,mesh.material]));
 let opaque=0,glass=0;
 for(const mesh of controller.occluders)for(const [index,material]of materials(mesh).entries()){
  const base=authored.get(mesh)[index];assert.deepEqual(state(material),base,material.name);
  if(base.transparent)glass++;else opaque++;
 }
 assert.ok(opaque>0,'fixture includes opaque walls/roofs');assert.ok(glass>0,'fixture retains genuinely transparent panes');
 const disposed=new Map(),sourceDisposed=new Set(),owned=new Set();
 for(const {materials:records}of library.models.values())for(const {material}of records.values())owned.add(material);
 const collect=owner=>{for(const material of owner.ownedMaterials)owned.add(material);for(const child of owner.children)collect(child);};collect(controller);
 for(const material of owned)material.addEventListener('dispose',()=>disposed.set(material,(disposed.get(material)||0)+1));
 for(const {material}of original.values())for(const source of(Array.isArray(material)?material:[material]))source.addEventListener('dispose',()=>sourceDisposed.add(source));
 for(const next of['high','low','high']){
  for(const factor of[.2,.025,1]){
   for(const mesh of controller.occluders)for(const material of materials(mesh))setOcclusionOpacity(material,factor);
   await library.loadQuality(next);
   for(const mesh of controller.occluders){
    assert.equal(mesh.material,bound.get(mesh),'texture updates keep the material that occlusion controls');
    for(const[index,material]of materials(mesh).entries()){
     const base=authored.get(mesh)[index];assert.equal(material.opacity,base.opacity*factor);assert.equal(material.transparent,factor<1||base.transparent);assert.equal(material.depthWrite,factor<1?false:base.depthWrite);assert.equal(material.depthTest,base.depthTest);
    }
   }
  }
 }
 library.release(model);controller.release();releaseSunsetMaterials(model);library.dispose();
 for(const[mesh,base]of original){assert.equal(mesh.material,base.material);assert.equal(mesh.geometry,base.geometry);}
 for(const material of owned)assert.equal(disposed.get(material),1,'each runtime material is released once');
 assert.equal(sourceDisposed.size,0,'occlusion and surface owners cannot dispose GLB source materials');
});
