import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CameraRig,cameraNearForDistance} from '../sources/core/camera.js';
import {contentFocus,islands} from '../sources/config.js';

test('camera clipping retains close views and reserves useful precision at island distances',()=>{
 for(const distance of[0,10,24,30,45])assert.equal(cameraNearForDistance(distance),.2);
 let previous=.2;
 for(let distance=45;distance<=1000;distance+=.1){
  const near=cameraNearForDistance(distance);
  assert.ok(near>=previous&&near<=20);assert.ok(near-previous<.02,'near-plane ramp has no visible jump');previous=near;
 }
 const levels=2**24-1,depth=(near,distance)=>(2000/(2000-near)-2000*near/((2000-near)*distance))*levels;
 for(const distance of[200,270,500,700]){
  const original=depth(.2,distance+.025)-depth(.2,distance),improved=depth(cameraNearForDistance(distance),distance+.025)-depth(cameraNearForDistance(distance),distance);
  assert.ok(improved>original*19,'centimetre layers gain at least 19× depth separation');
  assert.ok(improved>10,'the farthest overview separates 25mm by multiple depth bins');
 }
});

for(const island of islands)test(`${island.id}: adaptive near preserves the complete fitted island and does not feed back into framing`,()=>{
 const focus=contentFocus(island.id),bounds=focus.camera.fitBounds,position={x:island.x,y:.85,z:island.z};
 for(const[width,height]of[[1440,900],[1920,1080],[390,844],[844,390]]){
  const camera=new THREE.PerspectiveCamera(28,width/height,.2,3000),rig=new CameraRig(camera,{zoom:1,walkZoom:1},width,height);
  rig.update(0,{position,focus},true);
  const eye=rig.position.clone(),target=rig.target.clone(),distance=rig.distance;
  for(const x of[bounds.min[0],bounds.max[0]])for(const y of[bounds.min[1],bounds.max[1]])for(const z of[bounds.min[2],bounds.max[2]]){
   const point=new THREE.Vector3(x,y,z),view=point.clone().applyMatrix4(camera.matrixWorldInverse),clip=point.project(camera);
   assert.ok(-view.z>camera.near+10,'near plane remains well before every island bound');
   assert.ok(clip.z>-1&&clip.z<1,'the complete island remains within the depth frustum');
  }
  for(let frame=0;frame<30;frame++)rig.update(1/60,{position,focus},true);
  assert.ok(rig.position.distanceTo(eye)<1e-9);assert.ok(rig.target.distanceTo(target)<1e-9);assert.equal(rig.distance,distance);
 }
});

for(const id of['about','education'])test(`${id}: near plane follows actual eye distance through overview entry and exit`,()=>{
 const island=islands.find(item=>item.id===id),position={x:island.x,y:.85,z:island.z},camera=new THREE.PerspectiveCamera(28,1.6,.2,3000),rig=new CameraRig(camera,{zoom:1,walkZoom:1},1440,900),focus=contentFocus(id);
 rig.update(0,{position,locomotion:'walking'},true);assert.equal(camera.near,.2);
 for(const next of[focus,null]){
  let previous=camera.near;
  for(let frame=0;frame<360;frame++){
   rig.update(1/60,{position,locomotion:'walking',focus:next});
   const actual=rig.position.distanceTo(rig.target);
   assert.ok(Math.abs(camera.near-cameraNearForDistance(actual))<=1e-6,'rendered distance controls clipping, not the requested destination');
   assert.ok(camera.near<actual*.03,'the clipping plane cannot approach the focal subject');
   if(next)assert.ok(camera.near>=previous-1e-9);else assert.ok(camera.near<=previous+1e-9);
   previous=camera.near;
  }
 }
 assert.equal(camera.near,.2,'the authored close plane returns after leaving overview');
});
