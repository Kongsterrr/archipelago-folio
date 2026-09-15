import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {CameraRig} from '../sources/core/camera.js';

const bytes=fs.readFileSync(new URL('../static/models/boat.glb',import.meta.url));
const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
gltf.scene.updateMatrixWorld(true);
// Actual transformed mesh vertices; no Box3/AABB corners, wake, or outline.
const localVertices=[];
gltf.scene.traverse(o=>{if(o.isMesh){const a=o.geometry.getAttribute('position');for(let i=0;i<a.count;i++)localVertices.push(new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld));}});
const viewports=[[1440,900],[1920,1080],[390,844],[844,390]];
const project=(camera,p)=>new THREE.Vector3(p.x,p.y,p.z).project(camera);
const create=(w,h)=>{const camera=new THREE.PerspectiveCamera(28,w/h,.2,600);return{camera,rig:new CameraRig(camera,{zoom:1,reduced:false},w,h)}};

for(const [w,h]of viewports){
 test(`GLB tight stationary framing ${w}x${h}`,()=>{
  const {camera,rig}=create(w,h);rig.reset({x:0,y:.35,z:0},0);
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const v of localVertices){const p=v.clone().add(new THREE.Vector3(0,.35,0)).project(camera);minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
  const fraction=Math.max((maxX-minX)*w/2,(maxY-minY)*h/2)/Math.min(w,h),[lo,hi]=h>w?[.20,.26]:[.16,.22];
  assert.ok(fraction>=lo&&fraction<=hi,`actual tight fraction ${fraction}, expected ${lo}..${hi}`);
  const centreY=(1-(minY+maxY)/2)/2;assert.ok(centreY>.58&&centreY<.64,`tight boat centre ${centreY}`);
 });
 for(const speed of [12,18])for(let direction=0;direction<8;direction++){
  test(`Actual steady camera ${w}x${h}, ${speed}m/s, yaw ${direction*45}`,()=>{
   const yaw=direction*Math.PI/4,heading={x:-Math.sin(yaw),z:-Math.cos(yaw)},position={x:0,y:.35,z:0},velocity={x:heading.x*speed,z:heading.z*speed};
   const {camera,rig}=create(w,h);rig.reset(position,yaw);
   // Keep moving through every frame. A stationary point with nonzero velocity misses follow lag.
   for(let frame=0;frame<360;frame++){position.x+=velocity.x/60;position.z+=velocity.z/60;rig.update(1/60,{position,velocity,yaw,speed,input:{throttle:1,boost:speed===18}});}
   const next=project(camera,{x:position.x+heading.x*(speed+2),y:0,z:position.z+heading.z*(speed+2)}),boat=project(camera,position);
   assert.ok(Math.abs(next.x)<.941&&next.y>-.851&&next.y<.821,`actual forward NDC ${next.x},${next.y}`);
   assert.ok(Math.abs(boat.x)<.701&&Math.abs(boat.y)<.681,`boat centre NDC ${boat.x},${boat.y}`);
   const transform=new THREE.Matrix4().compose(new THREE.Vector3(position.x,position.y,position.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(1,1,1));
   for(const v of localVertices){const p=v.clone().applyMatrix4(transform).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1,`boat mesh vertex leaves screen ${p.x},${p.y}`);}
  });
 }
}
