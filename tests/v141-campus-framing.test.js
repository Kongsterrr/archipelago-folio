import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {islands} from '../sources/config.js';
import {localToWorld} from '../sources/core/character.js';
import {CameraRig} from '../sources/core/camera.js';
import {campusStationFocus} from '../sources/core/campus-focus.js';
import {campusReadingRect,fitBoundsPose} from '../sources/core/focus-framing.js';

const viewports=[
 {width:1440,height:900,rect:{left:24,top:96,right:952,bottom:876}},
 {width:1920,height:1080,rect:{left:24,top:96,right:1432,bottom:1056}},
 {width:390,height:844,rect:{left:16,top:96,right:374,bottom:355.36}},
 {width:844,height:390,rect:{left:24,top:96,right:356,bottom:366}},
];
const layout=JSON.parse(await fs.readFile(new URL('../static/models/walk-layout.json',import.meta.url),'utf8')).islands.find(i=>i.id==='education');
const island=islands.find(i=>i.id==='education');
const stations={duan:layout.stations.find(s=>s.landmarkId==='duan-center'),bu:layout.stations.find(s=>s.schoolId==='bu'&&s.primary)};
const modelVertices=new Map();

for(const quality of ['high','low']){
 const bytes=await fs.readFile(new URL(`../static/models/${quality==='low'?'low/':''}education.glb`,import.meta.url));
 const model=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 const outer=new THREE.Group();outer.position.set(island.x,0,island.z);outer.rotation.y=island.rotation;outer.add(model);outer.updateMatrixWorld(true);
 const sets={duan:[],bu:[]},owners=new Set();
 model.traverse(mesh=>{
  if(!mesh.isMesh)return;
  let owner=mesh.parent;while(owner&&!owner.name.startsWith('occluder_'))owner=owner.parent;
  const duan=owner?.name.startsWith('occluder_campus_duan_');
  const bu=duan||['occluder_campus_marsh_roof','occluder_campus_cas_roof'].includes(owner?.name);
  if(!bu)return;
  owners.add(owner.name);
  const positions=mesh.geometry.getAttribute('position');
  for(let n=0;n<positions.count;n++){
   const vertex=new THREE.Vector3().fromBufferAttribute(positions,n).applyMatrix4(mesh.matrixWorld);
   sets.bu.push(vertex);if(duan)sets.duan.push(vertex);
  }
 });
 assert.ok(sets.duan.length>100,`${quality}: actual Duan geometry is present`);
 assert.ok(owners.has('occluder_campus_marsh_roof')&&owners.has('occluder_campus_cas_roof'),`${quality}: BU overview includes both established landmarks`);
 modelVertices.set(quality,sets);
}

function createRig(width,height){
 const camera=new THREE.PerspectiveCamera(28,width/height,.2,600);
 return{camera,rig:new CameraRig(camera,{zoom:1,walkZoom:1,reduced:false},width,height)};
}
function focusState(kind){
 const station=stations[kind];assert.ok(station?.camera?.fitBounds,`${kind}: authored fit bounds exist`);
 return{position:localToWorld(island,station),locomotion:'walking',landAzimuth:island.rotation,focus:campusStationFocus(island,station),terrainHeight:()=>layout.groundY};
}
function assertVisible(camera,vertices,{width,height,rect},label,minimumOccupation=.65){
 const projected=vertices.map(vertex=>vertex.clone().project(camera));
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 for(const p of projected){
  assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.z>=-1&&p.z<=1,`${label}: finite vertex inside near/far planes`);
  const x=(p.x+1)*width/2,y=(1-p.y)*height/2;
  left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
 }
 const epsilon=.1;
 assert.ok(left>=rect.left-epsilon&&right<=rect.right+epsilon&&top>=rect.top-epsilon&&bottom<=rect.bottom+epsilon,
  `${label}: projected [${left},${top},${right},${bottom}] leaves readable rect [${rect.left},${rect.top},${rect.right},${rect.bottom}]`);
 const occupation=Math.max((right-left)/(rect.right-rect.left),(bottom-top)/(rect.bottom-rect.top));
 assert.ok(occupation>minimumOccupation,`${label}: landmark remains readable instead of being needlessly distant (${occupation})`);
}

test('campus reading rectangles reserve the actual side panel, top navigation and portrait bottom sheet',()=>{
 for(const{width,height,rect}of viewports)assert.deepEqual(campusReadingRect(width,height),rect);
});

test('campus focus transforms every authored corner on a translated, rotated island without mutating layout',()=>{
 const rotated={id:'education',x:113,z:-87,rotation:Math.PI/4};
 const bounds={min:{x:-22.1,y:.85,z:-12.25},max:{x:-11.9,y:14.38,z:-4.55}};
 const station={x:-13.8,z:-3.35,cameraTarget:{x:-17,y:6.1,z:-8.5},landmarkId:'duan-center',camera:{fitBounds:bounds}};
 const saved=structuredClone(station),matrix=new THREE.Matrix4().makeRotationY(rotated.rotation);matrix.setPosition(rotated.x,0,rotated.z);
 const points=[];for(const x of[bounds.min.x,bounds.max.x])for(const y of[bounds.min.y,bounds.max.y])for(const z of[bounds.min.z,bounds.max.z])points.push(new THREE.Vector3(x,y,z).applyMatrix4(matrix));
 const box=new THREE.Box3().setFromPoints(points),point=new THREE.Vector3(-17,6.1,-8.5).applyMatrix4(matrix);
 for(const fitBounds of[bounds,{min:[-22.1,.85,-12.25],max:[-11.9,14.38,-4.55]}]){
  const focus=campusStationFocus(rotated,{...station,camera:{fitBounds}});
  assert.ok(new THREE.Vector3(focus.x,focus.y,focus.z).distanceTo(point)<1e-10);
  assert.ok(new THREE.Vector3(...focus.camera.fitBounds.min).distanceTo(box.min)<1e-10);
  assert.ok(new THREE.Vector3(...focus.camera.fitBounds.max).distanceTo(box.max)<1e-10);
  assert.equal(focus.camera.azimuth,rotated.rotation);assert.equal(focus.landmarkId,'duan-center');
  // Reboxing a rotated volume into a world AABB deliberately adds safe space.
  for(const viewport of viewports){const{camera,rig}=createRig(viewport.width,viewport.height);rig.update(0,{position:point,focus},true);assertVisible(camera,points,viewport,'rotated bounds',.5);}
 }
 assert.deepEqual(station,saved);
});

test('perspective fitting includes corner depth at an oblique azimuth and honors a requested minimum distance',()=>{
 const bounds={min:[-5,.85,-4],max:[5,14.35,4]},vertices=[];
 for(const x of[bounds.min[0],bounds.max[0]])for(const y of[bounds.min[1],bounds.max[1]])for(const z of[bounds.min[2],bounds.max[2]])vertices.push(new THREE.Vector3(x,y,z));
 for(const viewport of viewports){
  const{width,height}=viewport,pose=fitBoundsPose(bounds,{width,height,azimuth:.71,elevation:.44});
  const camera=new THREE.PerspectiveCamera(28,width/height,.2,600);camera.position.copy(pose.position);camera.lookAt(pose.target);camera.updateMatrixWorld();
  assertVisible(camera,vertices,viewport,'oblique perspective');
  assert.ok(fitBoundsPose(bounds,{width,height,minDistance:200}).distance>=200);
 }
});

for(const quality of ['high','low'])for(const kind of ['duan','bu']){
 for(const viewport of viewports)test(`${quality} ${kind}: actual landmark vertices fit snap and settled reading camera at ${viewport.width}x${viewport.height}`,()=>{
  const{camera,rig}=createRig(viewport.width,viewport.height),state=focusState(kind),vertices=modelVertices.get(quality)[kind];
  rig.update(0,state,true);assertVisible(camera,vertices,viewport,`${quality} ${kind} snap`);
  rig.update(0,{...state,focus:null},true);
  for(let frame=0;frame<180;frame++)rig.update(1/60,state);
  assertVisible(camera,vertices,viewport,`${quality} ${kind} settled`);
 });
 test(`${quality} ${kind}: an open reader reframes after desktop, portrait and landscape resizes`,()=>{
  const{camera,rig}=createRig(1440,900),state=focusState(kind),vertices=modelVertices.get(quality)[kind];
  rig.update(0,state,true);
  for(const viewport of[viewports[2],viewports[3],viewports[1],viewports[0]]){
   rig.resize(viewport.width,viewport.height);
   for(let frame=0;frame<180;frame++)rig.update(1/60,state);
   assertVisible(camera,vertices,viewport,`${quality} ${kind} resized ${viewport.width}x${viewport.height}`);
  }
 });
}
