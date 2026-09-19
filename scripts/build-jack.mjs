// Build original shared-skeleton character without changing any existing asset.
// node scripts/build-jack.mjs
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
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
const report={revision:'v41-round-jack',file:'jack.glb',...JACK_SPEC,bytes:(await fs.stat(output)).size,rawBytes:raw.byteLength,
 triangles:primitives.reduce((s,p)=>s+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0),materials:r.listMaterials().length,drawCalls:primitives.length,
 joints:Object.keys(bones),skins:r.listSkins().length,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},dimensions:bounds.getSize(new THREE.Vector3()).toArray(),
 animations:r.listAnimations().map(a=>({name:a.getName(),tracks:a.listChannels().length,duration:Math.max(...a.listSamplers().map(s=>Math.max(...s.getInput().getArray())))})),textures:r.listTextures().length,
 compression:'EXT_meshopt_compression',placement:root.userData};
for(const accessor of r.listAccessors())for(const n of accessor.getArray()||[])if(!Number.isFinite(n))throw Error('Non-finite Jack accessor');
if(report.triangles>12000||report.materials>6||report.drawCalls>6||report.bytes>350000)throw Error('Jack asset exceeded budget');
if(report.skins!==1||report.animations.length!==JACK_SPEC.clips.length)throw Error('Missing shared skeleton or clips');
if(Math.abs(report.bounds.min[1])>.002||Math.abs(report.dimensions[1]-1.30)>.025)throw Error('Incorrect Jack height/origin');
// Validate contact after decoding the compressed file, including between-key
// interpolation; author-time sole corrections must survive export/quantization.
const encoded=await fs.readFile(output);
const decoded=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(encoded.buffer.slice(encoded.byteOffset,encoded.byteOffset+encoded.byteLength),'');
const mixer=new THREE.AnimationMixer(decoded.scene),skinned=[],feet=[];
decoded.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;skinned.push(mesh);const index=mesh.geometry.getAttribute('skinIndex');for(let n=0;n<index.count;n++)if(['LeftFoot','RightFoot'].includes(mesh.skeleton.bones[index.getX(n)].name))feet.push({mesh,index:n});});
report.groundContact={};
for(const name of ['walk','run']){
 const clip=decoded.animations.find(c=>c.name===name);mixer.stopAllAction();mixer.clipAction(clip).play();let min=Infinity,max=-Infinity;
 for(let frame=0;frame<=480;frame++){
  mixer.setTime(clip.duration*frame/480);decoded.scene.updateMatrixWorld(true);for(const mesh of skinned)mesh.skeleton.update();
  let sole=Infinity;for(const{mesh,index}of feet)sole=Math.min(sole,mesh.getVertexPosition(index,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).y);
  min=Math.min(min,sole);max=Math.max(max,sole);
 }
 report.groundContact[name]={sampledFrames:481,minimumLowestSoleY:min,maximumLowestSoleY:max};
 if(min<0||max>(name==='walk'?.003:.020))throw Error(`${name}: exported sole contact is out of range (${min}, ${max})`);
}
// The current three bench slats reach 0.31m forward of bench center. Validate the
// authored forward offset against actual skin vertices in the seated pose.
mixer.stopAllAction();mixer.clipAction(decoded.animations.find(c=>c.name==='sit')).play();mixer.setTime(.25);
decoded.scene.position.set(0,-JACK_SPEC.benchSeatOffset,-JACK_SPEC.benchForwardOffset);decoded.scene.updateMatrixWorld(true);for(const mesh of skinned)mesh.skeleton.update();
let shinRear=-Infinity,hipsBottom=Infinity;
for(const mesh of skinned){const ids=mesh.geometry.getAttribute('skinIndex');for(let n=0;n<ids.count;n++){
 const joint=mesh.skeleton.bones[ids.getX(n)].name;if(!['Hips','LeftLeg','RightLeg'].includes(joint))continue;
 const p=mesh.getVertexPosition(n,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
 if(joint==='Hips')hipsBottom=Math.min(hipsBottom,p.y);else if(p.y<0)shinRear=Math.max(shinRear,p.z);
}}
report.benchFit={frontEdgeZ:-.31,shinRearBelowSeatZ:shinRear,shinClearance:-.31-shinRear,hipsBottomAboveSeat:hipsBottom};
if(report.benchFit.shinClearance<0||hipsBottom<-.002||hipsBottom>.012)throw Error('Decoded seated character does not fit bench slats');
await fs.writeFile(new URL('jack.manifest.json',dir),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
