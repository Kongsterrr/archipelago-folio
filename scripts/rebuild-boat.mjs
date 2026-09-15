// Rebuild only the shared boat. Islands and their animated nodes stay byte-identical.
// Run with Node >=22: node scripts/rebuild-boat.mjs
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mergeGeometries, mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer';
import {createPremiumBoat} from './premium-boat.mjs';

globalThis.FileReader = class {
  async readAsArrayBuffer(blob) {this.result=await blob.arrayBuffer();this.onloadend?.({target:this});}
  async readAsDataURL(blob) {this.result=`data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;this.onloadend?.({target:this});}
};
const directory=new URL('../static/models/',import.meta.url);
const read=async name=>JSON.parse(await fs.readFile(new URL(name,directory),'utf8'));
const write=async(name,data)=>fs.writeFile(new URL(name,directory),JSON.stringify(data,null,2)+'\n');
const authored=createPremiumBoat();authored.updateMatrixWorld(true);
const batches=new Map();let sourceMeshes=0;
authored.traverse(object=>{
  if(!object.isMesh)return;
  sourceMeshes++;
  const geometry=object.geometry.clone();
  for(const name of Object.keys(geometry.attributes))if(!['position','normal'].includes(name))geometry.deleteAttribute(name);
  geometry.clearGroups();geometry.applyMatrix4(object.matrixWorld);
  if(!geometry.index)geometry.setIndex(Array.from({length:geometry.attributes.position.count},(_,i)=>i));
  if(!batches.has(object.material))batches.set(object.material,[]);
  batches.get(object.material).push(geometry);
});
const boat=new THREE.Group();boat.name='boat';boat.userData={...authored.userData,originalProceduralAsset:true,forward:'-Z',seaLevel:0};
for(const [material,geometries]of batches){
  const geometry=mergeVertices(mergeGeometries(geometries,false),1e-6);geometry.normalizeNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.name='static_'+material.name;boat.add(mesh);
}
const raw=await new GLTFExporter().parseAsync(boat,{binary:true,onlyVisible:true,trs:true});
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const document=await io.readBinary(new Uint8Array(raw));await document.transform(meshopt({encoder:MeshoptEncoder,level:'medium'}));
const output=new URL('boat.glb',directory);await io.write(fileURLToPath(output),document);
const checked=await io.read(fileURLToPath(output));
for(const accessor of checked.getRoot().listAccessors())for(const value of accessor.getArray()||[])if(!Number.isFinite(value))throw Error('Boat has invalid geometry');
const primitives=checked.getRoot().listMeshes().flatMap(mesh=>mesh.listPrimitives());
const bounds=new THREE.Box3().setFromObject(boat);
const model={id:'boat',name:'boat',file:'boat.glb',revision:'premium-runabout-1',bytes:(await fs.stat(output)).size,rawBytes:raw.byteLength,sourceMeshes,drawCalls:primitives.length,staticDrawCalls:primitives.length,vertices:primitives.reduce((s,p)=>s+p.getAttribute('POSITION').getCount(),0),triangles:primitives.reduce((s,p)=>s+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},dimensions:bounds.getSize(new THREE.Vector3()).toArray(),animationNodes:[],nodes:[]};
const totals=manifest=>{manifest.totalBytes=manifest.models.reduce((s,m)=>s+m.bytes,0);manifest.totalTriangles=manifest.models.reduce((s,m)=>s+m.triangles,0);return manifest;};
const high=await read('manifest.json');high.models=high.models.map(m=>m.id==='boat'?model:m);await write('manifest.json',totals(high));
const low=await read('low/manifest.json');low.models=low.models.map(m=>m.id==='boat'?{...model,file:'../boat.glb',quality:'original',highQualityTriangles:model.triangles,highQualityBytes:model.bytes,triangleReductionPercent:0}:m);await write('low/manifest.json',totals(low));
const compression=await read('compression.json');await write('compression.json',compression.map(m=>m.name==='boat.glb'?{name:'boat.glb',before:model.rawBytes,after:model.bytes}:m));
const comparison=await read('low/comparison.json');
comparison.models=comparison.models.map(m=>m.id==='boat'?{...m,highTriangles:model.triangles,lowTriangles:model.triangles,highCompressedBytes:model.bytes,lowCompressedBytes:model.bytes,drawCalls:model.drawCalls,animatedGeometry:'shared original boat geometry',shorePolygon:'not applicable',dock:'not applicable'}:m);
Object.assign(comparison,{highTotalTriangles:high.totalTriangles,lowTotalTriangles:low.totalTriangles,highTotalBytes:high.totalBytes,lowTotalBytes:low.totalBytes,totalTriangleReductionPercent:+(100*(1-low.totalTriangles/high.totalTriangles)).toFixed(1),totalByteReductionPercent:+(100*(1-low.totalBytes/high.totalBytes)).toFixed(1)});
await write('low/comparison.json',comparison);
console.log(JSON.stringify(model,null,2));
