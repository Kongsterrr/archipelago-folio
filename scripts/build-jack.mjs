// Build original shared-skeleton character without changing any existing asset.
// node scripts/build-jack.mjs
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {meshopt,dedup} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import {createJackCharacter,JACK_SPEC} from './jack-character.mjs';

globalThis.FileReader=class{
  async readAsArrayBuffer(blob){this.result=await blob.arrayBuffer();this.onloadend?.({target:this});}
  async readAsDataURL(blob){this.result=`data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;this.onloadend?.({target:this});}
};
const {root,animations,bones}=createJackCharacter();
root.updateMatrixWorld(true);
const bounds=new THREE.Box3().setFromObject(root);
const raw=await new GLTFExporter().parseAsync(root,{binary:true,trs:true,onlyVisible:true,animations});
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const document=await io.readBinary(new Uint8Array(raw));
// One glTF mesh with six material primitives shares one inverse-bind set. Keeping
// this whole before quantization prevents per-material quantization from splitting skins.
await document.transform(dedup());
const skinnedNodes=document.getRoot().listNodes().filter(n=>n.getMesh()&&n.getSkin());
const combined=skinnedNodes[0].getMesh();combined.setName('JackCharacter');skinnedNodes[0].setName('Jack_Skinned');
for(const n of skinnedNodes.slice(1)){
  const m=n.getMesh();for(const primitive of [...m.listPrimitives()]){m.removePrimitive(primitive);combined.addPrimitive(primitive);}
  n.setMesh(null);n.setSkin(null);m.dispose();n.dispose();
}
await document.transform(meshopt({encoder:MeshoptEncoder,level:'medium'}),dedup());
const dir=new URL('../static/models/',import.meta.url),output=new URL('jack.glb',dir);
await fs.mkdir(dir,{recursive:true});await io.write(fileURLToPath(output),document);
const checked=await io.read(fileURLToPath(output)),r=checked.getRoot();
const primitives=r.listMeshes().flatMap(m=>m.listPrimitives());
const report={revision:'v4-meet-jack',file:'jack.glb',...JACK_SPEC,bytes:(await fs.stat(output)).size,rawBytes:raw.byteLength,
 triangles:primitives.reduce((s,p)=>s+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0),materials:r.listMaterials().length,drawCalls:primitives.length,
 joints:Object.keys(bones),skins:r.listSkins().length,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},dimensions:bounds.getSize(new THREE.Vector3()).toArray(),
 animations:r.listAnimations().map(a=>({name:a.getName(),tracks:a.listChannels().length,duration:Math.max(...a.listSamplers().map(s=>Math.max(...s.getInput().getArray())))})),textures:r.listTextures().length,
 compression:'EXT_meshopt_compression',placement:root.userData};
for(const accessor of r.listAccessors())for(const n of accessor.getArray()||[])if(!Number.isFinite(n))throw Error('Non-finite Jack accessor');
if(report.triangles>12000||report.materials>6||report.drawCalls>6||report.bytes>350000)throw Error('Jack asset exceeded budget');
if(report.skins!==1||report.animations.length!==JACK_SPEC.clips.length)throw Error('Missing shared skeleton or clips');
if(Math.abs(report.bounds.min[1])>.002||Math.abs(report.dimensions[1]-1.30)>.025)throw Error('Incorrect Jack height/origin');
await fs.writeFile(new URL('jack.manifest.json',dir),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
