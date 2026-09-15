import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {NodeIO, getBounds} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import {ANIMAL_SPECS,createAnimal} from './animals.mjs';

globalThis.FileReader=class{
  async readAsArrayBuffer(blob){this.result=await blob.arrayBuffer();this.onloadend?.({target:this});}
  async readAsDataURL(blob){this.result=`data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;this.onloadend?.({target:this});}
};
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const out=new URL('../static/models/fauna/',import.meta.url);
await fs.mkdir(new URL('./low/',out),{recursive:true});
const report={revision:'original-toy-bay-fauna-v3',units:'metres',up:'+Y',forward:'-Z',source:'animals.mjs',compression:'EXT_meshopt_compression',textures:0,models:[]};
for(const kind of Object.keys(ANIMAL_SPECS))for(const low of [false,true]){
  const group=createAnimal(kind,{low}), animations=[];
  group.traverse(o=>{
    if(o.name.startsWith('anim_')&&o.isGroup)animations.push(o.name);
    if(o.isMesh){
      for(const [name,a]of Object.entries(o.geometry.attributes))for(const value of a.array)if(!Number.isFinite(value))throw Error(`${kind}: non-finite ${name}`);
      o.geometry.computeBoundingBox();if(o.geometry.boundingBox.isEmpty())throw Error(`${kind}: empty mesh bounds`);
    }
  });
  group.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(group),size=bounds.getSize(new THREE.Vector3());
  const expected=ANIMAL_SPECS[kind][kind==='seagull'?'wingspan':'length'];
  if(Math.abs(size[kind==='seagull'?'x':'z']-expected)>1e-6)throw Error(`${kind}: incorrect physical size`);
  const raw=await new GLTFExporter().parseAsync(group,{binary:true,trs:true,onlyVisible:true});
  const document=await io.readBinary(new Uint8Array(raw));
  await document.transform(meshopt({encoder:MeshoptEncoder,level:'medium'}));
  const filename=`${low?'low/':''}${kind}.glb`,output=new URL(filename,out);
  await io.write(fileURLToPath(output),document);
  const checked=await io.read(fileURLToPath(output)),root=checked.getRoot();
  for(const a of root.listAccessors())for(const value of a.getArray()||[])if(!Number.isFinite(value))throw Error(`${kind}: compressed GLB has invalid geometry`);
  const primitives=root.listMeshes().flatMap(m=>m.listPrimitives());
  const triangles=primitives.reduce((n,p)=>n+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0);
  if(triangles>ANIMAL_SPECS[kind].triangleBudget||primitives.length>=7||root.listMaterials().length>4)throw Error(`${kind}: export exceeded budget`);
  for(const name of animations)if(!root.listNodes().some(n=>n.getName()===name))throw Error(`${kind}: lost animation pivot ${name}`);
  if(!root.listExtensionsRequired().some(e=>e.extensionName==='EXT_meshopt_compression'))throw Error(`${kind}: missing Meshopt extension`);
  const b=getBounds(root.listScenes()[0]);
  if(![...b.min,...b.max].every(Number.isFinite))throw Error(`${kind}: invalid exported bounds`);
  report.models.push({kind,quality:low?'low':'high',file:filename,triangles,triangleBudget:ANIMAL_SPECS[kind].triangleBudget,drawCalls:primitives.length,materials:root.listMaterials().length,bytes:(await fs.stat(output)).size,rawBytes:raw.byteLength,dimensions:size.toArray(),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},compressedBounds:b,animationNodes:animations,animation:group.userData.animation});
}
report.totalBytes=report.models.reduce((n,m)=>n+m.bytes,0);
await fs.writeFile(new URL('../static/models/fauna/manifest.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
await fs.writeFile(new URL('./manifest.json',out),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.models.map(({kind,quality,triangles,drawCalls,materials,bytes,dimensions})=>({kind,quality,triangles,drawCalls,materials,bytes,dimensions})),null,2));
