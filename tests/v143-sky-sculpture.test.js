import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {islands} from '../sources/config.js';
import {IslandWalkWorld,localToWorld} from '../sources/core/character.js';
import {bicycleFootprintClear} from '../sources/core/bicycle.js';
import {CameraRig} from '../sources/core/camera.js';
import {campusStationFocus} from '../sources/core/campus-focus.js';
import {campusReadingRect} from '../sources/core/focus-framing.js';

const layout=JSON.parse(await fs.readFile(new URL('../static/models/walk-layout.json',import.meta.url),'utf8')).islands.find(i=>i.id==='education');
const island=islands.find(i=>i.id==='education'),art=layout.sculptures.find(s=>s.id==='walking-to-the-sky');
await R.init();

test('sculpture base blocks contact while the aerial span and existing campus circulation remain open',()=>{
 const world=new R.World({x:0,y:0,z:0}),walk=new IslandWalkWorld(R,world,island,layout);
 const original=Object.create(walk);original.layout={...layout,obstacles:layout.obstacles.filter(o=>!o.name.startsWith('Walking to the Sky'))};
 try{
  assert.equal(art.figureCount,6);assert.equal(art.static,true);
  assert.ok(!walk.clear(localToWorld(island,art.base)), 'the visible plinth is a real obstacle');
  const obstacles=layout.obstacles.filter(o=>o.name.startsWith('Walking to the Sky'));
  assert.ok(obstacles.length===2&&obstacles.every(o=>o.width<2&&o.depth<1.2), 'only the plinth and low section occupy ground');
  for(const t of[.5,.65,.8,1]){
   const p=localToWorld(island,{x:art.poleStart.x+(art.poleEnd.x-art.poleStart.x)*t,z:art.poleStart.z+(art.poleEnd.z-art.poleStart.z)*t});
   assert.equal(walk.clear(p,.24),original.clear(p,.24),'elevated pole does not add a ground wall over the existing lawn/furniture');
   assert.equal(bicycleFootprintClear(walk,p,island.rotation),bicycleFootprintClear(original,p,island.rotation),'aerial span leaves original cycling clearance unchanged');
  }
  for(const path of layout.paths)for(let i=1;i<path.points.length;i++){
   const a=path.points[i-1],b=path.points[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.3);
   for(let n=0;n<=steps;n++)assert.ok(walk.clear(localToWorld(island,{x:a[0]+(b[0]-a[0])*n/steps,z:a[1]+(b[1]-a[1])*n/steps}),path.points[i][1]>layout.dock.startZ?.3:1.19),`${path.id} remains open`);
  }
 }finally{world.free();}
});

for(const quality of ['high','low'])test(`${quality}: actual sculpture contains six spaced figures on a continuous metal pole and fits CMU framing`,async()=>{
 const bytes=await fs.readFile(new URL(`../static/models/${quality==='low'?'low/':''}education.glb`,import.meta.url));
 const model=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 model.updateMatrixWorld(true);
 const group=model.getObjectByName('campus_walking_to_sky'),occluder=model.getObjectByName('occluder_campus_walking_to_sky');
 assert.ok(group&&occluder&&group!==occluder);assert.equal(occluder.parent,group);
 const start=new THREE.Vector3(art.poleStart.x,art.poleStart.y,art.poleStart.z),end=new THREE.Vector3(art.poleEnd.x,art.poleEnd.y,art.poleEnd.z),axis=end.clone().sub(start),length=axis.length();axis.normalize();
 assert.ok(end.y-start.y>8.5&&Math.hypot(end.x-start.x,end.z-start.z)>5,'recognizable diagonal silhouette');
 const count=Array(6).fill(0),vertices=[],materials=new Set();
 group.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const positions=mesh.geometry.attributes.position;
  for(let n=0;n<positions.count;n++){
   const v=new THREE.Vector3().fromBufferAttribute(positions,n).applyMatrix4(mesh.matrixWorld);vertices.push(v);
   if(mesh.parent!==occluder)continue;
   const delta=v.clone().sub(start),t=delta.dot(axis)/length,radial=delta.clone().addScaledVector(axis,-t*length).length();
   if(mesh.material.name==='campus_sculptureSteel'){
    assert.ok(mesh.material.metalness>.5&&mesh.material.roughness<.3,'pole keeps its authored silver finish');
   }else{
    materials.add(mesh.material.name);
    art.figures.forEach((f,i)=>{if(Math.abs(t-f.t)<.055&&radial>.23&&radial<1.4)count[i]++;});
   }
  }
 });
 // Long-cylinder end rings alone are sufficient for a continuous shaft; ray
 // hits check the exported intervening surface rather than source metadata.
 const normal=new THREE.Vector3(-axis.x*axis.y,1-axis.y*axis.y,-axis.z*axis.y).normalize();
 const ray=new THREE.Raycaster();
 for(const t of[.08,.27,.4,.53,.66,.79,.94]){
  const p=start.clone().addScaledVector(axis,length*t);ray.set(p.clone().addScaledVector(normal,.7),normal.clone().negate());
  assert.ok(ray.intersectObject(occluder,true).some(h=>h.object.material.name==='campus_sculptureSteel'&&h.distance<.8),'actual silver surface spans the full pole');
 }
 assert.ok(count.every(n=>n>80),`all six real painted figure bands survive export: ${count}`);
 assert.ok(materials.size>=6,'figures retain distinct painted clothing and skin details');
 assert.ok(group.children.some(c=>c!==occluder),'opaque plinth and attached plaque remain separate from occlusion');
 const station=layout.stations.find(s=>s.schoolId==='cmu'&&s.primary),focus=campusStationFocus(island,station);
 for(const [width,height]of [[1440,900],[1920,1080],[390,844],[844,390]]){
  const camera=new THREE.PerspectiveCamera(28,width/height,.2,600),rig=new CameraRig(camera,{zoom:1,walkZoom:1,reduced:false},width,height);
  rig.update(0,{position:localToWorld(island,station),locomotion:'walking',landAzimuth:island.rotation,focus},true);camera.updateMatrixWorld();
  const rect=campusReadingRect(width,height);
  for(const v of vertices){const p=localToWorld(island,{x:v.x,y:v.y,z:v.z}),q=new THREE.Vector3(p.x,p.y,p.z).project(camera),x=(q.x+1)*width/2,y=(1-q.y)*height/2;
   assert.ok(x>=rect.left-.2&&x<=rect.right+.2&&y>=rect.top-.2&&y<=rect.bottom+.2,`${quality} sculpture fits beside ${width}x${height} reading panel`);
  }
 }
});
