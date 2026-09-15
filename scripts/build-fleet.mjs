// Reproduce: node scripts/build-fleet.mjs [output-directory]
// Default when integrated: static/models/fleet/{kind}.glb and low/{kind}.glb.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { createVessel, VESSEL_SPECS } from './fleet-vessels.mjs';

globalThis.FileReader=class{async readAsArrayBuffer(b){this.result=await b.arrayBuffer();this.onloadend?.({target:this});}async readAsDataURL(b){this.result=`data:${b.type};base64,${Buffer.from(await b.arrayBuffer()).toString('base64')}`;this.onloadend?.({target:this});}};
const out=process.argv[2]?path.resolve(process.argv[2]):fileURLToPath(new URL('../static/models/fleet/',import.meta.url));
await fs.mkdir(path.join(out,'low'),{recursive:true});
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const manifest={version:3,originalAssets:true,units:'meters',coordinateSystem:'Y up, bow -Z',seaLevel:0,compression:'EXT_meshopt_compression',models:[]};
for(const kind of Object.keys(VESSEL_SPECS))for(const low of[false,true]){
  const vessel=createVessel(kind,{low}),bounds=new THREE.Box3().setFromObject(vessel);
  const raw=await new GLTFExporter().parseAsync(vessel,{binary:true,onlyVisible:true,trs:true});
  const doc=await io.readBinary(new Uint8Array(raw));await doc.transform(meshopt({encoder:MeshoptEncoder,level:'medium'}));
  const file=`${low?'low/':''}${kind}.glb`,dest=path.join(out,file);await io.write(dest,doc);
  const checked=await io.read(dest),primitives=checked.getRoot().listMeshes().flatMap(m=>m.listPrimitives());
  for(const a of checked.getRoot().listAccessors())for(const v of a.getArray()||[])if(!Number.isFinite(v))throw Error(`${file}: non-finite accessor`);
  const triangles=primitives.reduce((n,p)=>n+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0);
  const bytes=(await fs.stat(dest)).size,drawCalls=primitives.length;
  if(triangles>(low?700:6000))throw Error(`${file}: ${triangles} exceeds triangle budget`);
  if(drawCalls>(low?4:6))throw Error(`${file}: ${drawCalls} exceeds draw-call budget`);
  if(bytes>100*1024)throw Error(`${file}: ${bytes} exceeds byte budget`);
  if(bounds.min.y>=-.15)throw Error(`${file}: missing submerged hull`);
  const model={kind,quality:low?'low':'high',file,bytes,rawBytes:raw.byteLength,triangles,drawCalls,
    bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},dimensions:bounds.getSize(new THREE.Vector3()).toArray(),attachments:vessel.userData.attachments};
  manifest.models.push(model);console.log(JSON.stringify(model));
}
manifest.totalBytes=manifest.models.reduce((n,m)=>n+m.bytes,0);
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
