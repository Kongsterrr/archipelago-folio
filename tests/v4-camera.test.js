// Proposed V4 regression tests. Only the imports and JACK_FILE path need to become
// relative when copying this file into the repository's tests/ directory.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {CameraRig} from '../sources/core/camera.js';

const JACK_FILE=new URL('../static/models/jack.glb',import.meta.url);
const viewports=[[1440,900],[1920,1080],[390,844],[844,390]];
const location=new THREE.Vector3(37,.86,-42);

async function character(){
 const bytes=await fs.readFile(JACK_FILE);
 const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const model=gltf.scene,mixer=new THREE.AnimationMixer(model);
 model.position.copy(location);
 const action=mixer.clipAction(gltf.animations.find(a=>a.name==='idle')).play();
 return{model,mixer,action};
}
function rigFor(w,h,settings={zoom:1,walkZoom:1,reduced:false}){
 const camera=new THREE.PerspectiveCamera(28,w/h,.2,600);
 return new CameraRig(camera,settings,w,h);
}
function actualSilhouette(model,camera,w,h){
 const extent={left:Infinity,right:-Infinity,bottom:Infinity,top:-Infinity,near:Infinity,far:-Infinity};
 model.updateMatrixWorld(true);
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  mesh.skeleton.update();
  for(let i=0;i<mesh.geometry.getAttribute('position').count;i++){
   // getVertexPosition invokes applyBoneTransform. This measures the deformed
   // character silhouette, never an untransformed Box3 or its empty corners.
   const vertex=mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).project(camera);
   assert.ok(vertex.toArray().every(Number.isFinite),'projected skin vertex must be finite');
   extent.left=Math.min(extent.left,vertex.x);extent.right=Math.max(extent.right,vertex.x);
   extent.bottom=Math.min(extent.bottom,vertex.y);extent.top=Math.max(extent.top,vertex.y);
   extent.near=Math.min(extent.near,vertex.z);extent.far=Math.max(extent.far,vertex.z);
  }
 });
 return{...extent,height:(extent.top-extent.bottom)*h/2/Math.min(w,h),centerY:.5-(extent.top+extent.bottom)/4};
}

for(const [w,h]of viewports)test(`V4 walking: actual idle skin fits ${w}×${h} at all main headings`,async()=>{
 const{model,mixer}=await character(),rig=rigFor(w,h),min=h>w?.18:.16,max=h>w?.24:.20;
 for(const yaw of[0,Math.PI/2,Math.PI,3*Math.PI/2])for(const time of[0,.45,1.1]){
  model.rotation.y=yaw;mixer.setTime(time);
  rig.update(0,{position:location,yaw,speed:0,locomotion:'walking'},true);
  const b=actualSilhouette(model,rig.camera,w,h);
  assert.ok(b.height>=min&&b.height<=max,`height ${(100*b.height).toFixed(3)}%, target ${min*100}–${max*100}%, yaw=${yaw}, t=${time}`);
  assert.ok(b.centerY>=.54&&b.centerY<=.62,`character center should remain near 58%: ${b.centerY}`);
  assert.ok(b.left>-.95&&b.right<.95&&b.bottom>-.95&&b.top<.95,'entire character fits with a viewport margin');
 }
 mixer.stopAllAction();
});

test('V4 walk zoom is independent from the previously selected boat zoom',async()=>{
 const{model,mixer}=await character();mixer.update(0);const heights=[];
 for(const zoom of[0,1,2]){const rig=rigFor(1440,900,{zoom,walkZoom:1,reduced:false});rig.update(0,{position:location,locomotion:'walking'},true);heights.push(actualSilhouette(model,rig.camera,1440,900).height);}
 assert.ok(Math.max(...heights)-Math.min(...heights)<1e-8);
 const walkHeights=[];
 for(const walkZoom of[0,1,2]){const rig=rigFor(1440,900,{zoom:1,walkZoom,reduced:false});rig.update(0,{position:location,locomotion:'walking'},true);walkHeights.push(actualSilhouette(model,rig.camera,1440,900).height);}
 assert.ok(walkHeights[0]>walkHeights[1]&&walkHeights[1]>walkHeights[2],'Close, Standard and Wide visibly change walking framing');
});

test('V4 running never invokes boat boost pullback and reduced motion keeps fixed walking framing',()=>{
 const rig=rigFor(1440,900),input={boost:true,throttle:1};
 for(const yaw of[0,Math.PI/2,Math.PI,3*Math.PI/2]){
  rig.update(0,{position:location,yaw,speed:0,locomotion:'walking'},true);const distance=rig.distance,still=rig.target.clone();
  rig.update(0,{position:location,yaw,speed:4,input,velocity:{x:0,z:-4},locomotion:'walking'},true);
  assert.equal(rig.distance,distance);assert.ok(rig.target.distanceTo(still)<=1.200001,'walking lead cannot exceed 1.2m');
 }
 const reduced=rigFor(390,844,{zoom:1,walkZoom:1,reduced:true});
 reduced.update(0,{position:location,speed:0,locomotion:'walking'},true);const target=reduced.target.clone(),camera=reduced.position.clone();
 reduced.update(0,{position:location,speed:4,yaw:Math.PI/2,input,locomotion:'walking'},true);
 assert.ok(reduced.target.distanceTo(target)<1e-8&&reduced.position.distanceTo(camera)<1e-8);
});

test('V4 orientation changes reframe the camera without mutating the player position',()=>{
 const point=Object.freeze({x:location.x,y:location.y,z:location.z}),rig=rigFor(390,844);
 rig.update(0,{position:point,yaw:.3,locomotion:'walking'},true);
 rig.resize(844,390);rig.update(0,{position:point,yaw:.3,locomotion:'walking'},true);
 assert.deepEqual(point,{x:location.x,y:location.y,z:location.z});assert.ok(rig.camera.position.toArray().every(Number.isFinite));
});
