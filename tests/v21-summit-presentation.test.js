import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {IslandArrival} from '../sources/core/island-arrival.js';
import {arrivalBounds,arrivalOverviewPose,arrivalFrameRect} from '../sources/core/island-arrival-framing.js';
import {CameraRig} from '../sources/core/camera.js';
import {BayLighting} from '../sources/world/bay-lighting.js';
import {careerTerrainBand,trainMapHeading} from '../sources/ui/minimap.js';

test('summit overview keeps the peak, original dock and all terrace corners inside four safe frames',()=>{
 const island={x:-76,z:8,rotation:Math.PI/2},local={min:[-37,.2,-31],max:[37,43,38]};
 const bounds=arrivalBounds(island,null,local),elevation=28*Math.PI/180;
 for(const[width,height]of[[1440,900],[1920,1080],[390,844],[844,390]]){
  const camera=new THREE.PerspectiveCamera(28,width/height,.2,2000),rig=new CameraRig(camera,{walkZoom:1},width,height);
  const actor={position:{x:-50,y:.85,z:8},yaw:island.rotation,locomotion:'walking',landAzimuth:island.rotation};
  const ordinary=new CameraRig(new THREE.PerspectiveCamera(),{walkZoom:1},width,height);ordinary.update(0,actor,true);
  const arrival={bounds,progress:0,camera:{elevation}};rig.update(0,{...actor,arrival},true);
  const view=rig.position.clone().sub(rig.target);assert.ok(Math.abs(Math.asin(view.y/view.length())-elevation)<1e-8);
  const rect=arrivalFrameRect(width,height);
  for(const x of[bounds.min[0],bounds.max[0]])for(const y of[bounds.min[1],bounds.max[1]])for(const z of[bounds.min[2],bounds.max[2]]){
   const q=new THREE.Vector3(x,y,z).project(camera),px=(q.x+1)*width/2,py=(1-q.y)*height/2;
   assert.ok(px>=rect.left&&px<=rect.right&&py>=rect.top&&py<=rect.bottom,`${width}x${height} clips summit`);
  }
  rig.update(0,{...actor,arrival:{...arrival,progress:1}},true);
  assert.ok(rig.position.distanceTo(ordinary.position)<1e-8);assert.ok(rig.target.distanceTo(ordinary.target)<1e-8);
  const defaultPose=arrivalOverviewPose(bounds,{width,height,azimuth:island.rotation});
  assert.ok(Math.abs(Math.asin(defaultPose.position.clone().sub(defaultPose.target).normalize().y)-38*Math.PI/180)<1e-8,'other islands retain 38°');
 }
});

test('arrival profile freezes with background pause and is discarded before the next island',()=>{
 const arrival=new IslandArrival(),profile={elevation:28*Math.PI/180};arrival.start({id:'experience'},{},profile);
 arrival.tick(.5);arrival.tick(5,{paused:true});assert.equal(arrival.progress,0);assert.equal(arrival.view().camera,profile);
 arrival.tick(1.8);assert.equal(arrival.active,false);assert.equal(arrival.camera,null);
 arrival.start({id:'education'},{});assert.equal(arrival.view().camera,undefined);
});

test('sun shadow volume follows real terrace height without changing sunlight direction',()=>{
 const rig=new BayLighting(new THREE.Scene(),{shadowMap:{}},new THREE.PerspectiveCamera(),'low');
 try{for(const y of[.85,8.05,14.55,21.55,40]){
  rig.update({x:-76,y,z:8},true);assert.ok(Math.abs(rig.sun.target.position.y-y)<.03);
  const direction=rig.sun.position.clone().sub(rig.sun.target.position).normalize();assert.ok(direction.dot(rig.sunDirection)>.99999);
  assert.equal(rig.bounce.target.position.y,rig.sun.target.position.y);
 }
 rig.update({x:-76,y:22,z:8},false,180);
 assert.ok(rig.sun.shadow.normalBias>=128/rig.sun.shadow.mapSize.x);
 rig.setQuality('high');rig.update({x:-76,y:22,z:8},true,12);
 assert.equal(rig.sun.shadow.normalBias,.025,'ordinary walking keeps its existing contact offset');
 }finally{rig.dispose();}
});

test('local map distinguishes mountain terraces and descent without rotating the physical cabin',()=>{
 assert.deepEqual([.85,3.85,8.05,14.55,21.55,41].map(careerTerrainBand),[0,0,1,2,3,4]);
 const yaw=.73;assert.equal(trainMapHeading({yaw,direction:1}),yaw);assert.equal(trainMapHeading({yaw,direction:-1}),yaw+Math.PI);
});
