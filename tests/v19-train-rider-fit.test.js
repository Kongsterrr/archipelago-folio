import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {JackAvatar} from '../sources/world/jack.js';
import {CareerTrainController} from '../sources/core/career-train.js';
import {CareerTrainVisual} from '../sources/world/career-train.js';
import {careerRailway} from '../scripts/lib/career-railway-layout.mjs';

async function fixture(){
 await MeshoptDecoder.ready;
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
 const doc=await io.read(fileURLToPath(new URL('../static/models/jack-imported.glb',import.meta.url)));
 // Node does not load browser images. Keep the exact shipped skin and clips.
 for(const material of doc.getRoot().listMaterials())material.setBaseColorTexture(null);
 for(const texture of [...doc.getRoot().listTextures()])texture.dispose();
 for(const extension of doc.getRoot().listExtensionsUsed())if(extension.extensionName==='EXT_meshopt_compression')extension.dispose();
 const data=await io.writeBinary(doc),gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 const scene=new THREE.Scene(),controller=new CareerTrainController(careerRailway(),{island:{x:-76,y:2,z:8,rotation:1.17}}),view=new CareerTrainVisual(scene,controller);
 const bytes=await fs.readFile(new URL('../static/models/career-train.glb',import.meta.url));
 view.bind((await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene);
 const avatar=new JackAvatar(scene,{loadAsync:async()=>gltf});assert.equal(await avatar.load(),true);
 const player={onLand:true,ridingTrain:true,train:controller},character={position:{x:0,y:0,z:0},previous:{x:0,y:0,z:0},yaw:0,speed:0};
 function update(dt=0,{frozen=false,reduced=false}={}){
  view.update(1,{frozen});avatar.update(dt,{player,trainVisual:view,character,alpha:1,reduced,frozen});
  scene.updateMatrixWorld(true);avatar.model.traverse(mesh=>{if(mesh.isSkinnedMesh)mesh.skeleton.update();});
 }
 return{scene,controller,view,avatar,player,update};
}
function skinPoints(avatar,coach){
 const result={};
 avatar.model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!mesh.visible)return;
  const ids=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight');
  for(let i=0;i<ids.count;i++){
   let major=0;for(let k=1;k<4;k++)if(weights.getComponent(i,k)>weights.getComponent(i,major))major=k;
   const name=mesh.skeleton.bones[ids.getComponent(i,major)].name;
   if(!/^(Hips|LeftFoot|RightFoot|LeftHand|RightHand|LeftUpLeg|RightUpLeg)$/.test(name))continue;
   (result[name]??=[]).push(coach.worldToLocal(mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)));
  }
 });return result;
}
function surfaceAt(coach,object,point){
 const origin=coach.localToWorld(new THREE.Vector3(point.x,2,point.z)),direction=new THREE.Vector3(0,-1,0).transformDirection(coach.matrixWorld);
 const hit=new THREE.Raycaster(origin,direction).intersectObject(object,true)[0];
 return hit?coach.worldToLocal(hit.point).y:null;
}

test('actual imported sit skin rests on the train seat, footboard and armrests on entry, grades and pause',async t=>{
 const f=await fixture();t.after(()=>{f.avatar.root.removeFromParent();f.view.dispose();});
 const coach=f.view.cars[1],seat=coach.getObjectByName('career-coach-seat-front'),footboard=coach.getObjectByName('career-coach-passenger-footboard');
 assert.ok(seat&&footboard);
 for(const [distance,dt,frozen,reduced]of[[f.controller.distance,0,false,false],[50,.4,false,false],[120,1,false,false],[120,3,true,false],[180,2,false,true]]){
  f.controller.distance=f.controller.previousDistance=distance;f.update(dt,{frozen,reduced});
  assert.equal(f.avatar.pose,'sit');assert.equal(f.avatar.root.parent,f.view.mountPoint);
  const points=skinPoints(f.avatar,coach);
  for(const side of['Left','Right']){
   const foot=points[side+'Foot'].reduce((a,b)=>a.y<b.y?a:b),floor=surfaceAt(coach,footboard,foot);
   assert.notEqual(floor,null,`${side} foot must be above actual footboard geometry`);
   assert.ok(foot.y-floor>=-.001&&foot.y-floor<.006,`${side} sole contact ${foot.y-floor}`);
   const rest=coach.getObjectByName('career-coach-passenger-armrest-'+side.toLowerCase()),hand=points[side+'Hand'].reduce((a,b)=>a.y<b.y?a:b),arm=surfaceAt(coach,rest,hand);
   assert.notEqual(arm,null,`${side} palm must be above its wooden armrest`);
   assert.ok(hand.y-arm>=-.001&&hand.y-arm<.006,`${side} hand contact ${hand.y-arm}`);
  }
  let pelvisContact=Infinity;
  for(const name of['Hips','LeftUpLeg','RightUpLeg'])for(const point of points[name]){
   const surface=surfaceAt(coach,seat,point);if(surface===null)continue;
   assert.ok(point.y>=surface-.001,`${name} clips wooden seat by ${surface-point.y}`);
   if(name==='Hips')pelvisContact=Math.min(pelvisContact,point.y-surface);
  }
  assert.ok(pelvisContact<.04,'the pelvis is supported by the first bench');
  assert.ok(Object.values(points).flat().every(p=>Math.abs(p.x)<.72),'seated body and hands clear side rails');
 }
});
