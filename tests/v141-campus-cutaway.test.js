import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {Game} from '../sources/game.js';
import {islands} from '../sources/config.js';
import {localToWorld} from '../sources/core/character.js';
import {campusInteriorAt,isDuanUpperOccluder} from '../sources/core/campus-cutaway.js';
import {IslandController} from '../sources/world/island.js';

const layout=JSON.parse(await fs.readFile(new URL('../static/models/walk-layout.json',import.meta.url),'utf8')).islands.find(i=>i.id==='education');
const island=islands.find(i=>i.id==='education');
const upperNames=['podium_roof','lower','middle','upper','crown','terraces'].map(name=>'occluder_campus_duan_'+name);
const materials=mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material];
const base=material=>material.userData.occlusionBaseOpacity??1;
const close=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-10,`${label}: ${actual} != ${expected}`);

async function loadCampus(quality){
 const bytes=await fs.readFile(new URL(`../static/models/${quality==='low'?'low/':''}education.glb`,import.meta.url));
 return(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}
function fixture(model){
 const scene=new THREE.Scene(),outer=new THREE.Group();outer.position.set(island.x,0,island.z);outer.rotation.y=island.rotation;outer.add(model);scene.add(outer);
 const controller=new IslandController(island,outer);controller.bind(model);
 const camera=new THREE.PerspectiveCamera(28,1.6,.2,600),outlines=[];
 const game={scene,camera,activeActor:{position:{}},player:{walking:true,onLand:true,ridingQuad:false,island},walkLayouts:new Map([['education',layout]]),environment:{occluders:[]},controllers:new Map([['education',controller]]),jack:{outline:value=>outlines.push(value)},boatOutline:{visible:false},focus:null};
 const place=(position,eye)=>{
  game.activeActor.position=localToWorld(island,{y:layout.groundY,...position});
  const cameraPoint=localToWorld(island,eye);camera.position.set(cameraPoint.x,cameraPoint.y,cameraPoint.z);
  const p=game.activeActor.position;camera.lookAt(p.x,p.y+.7,p.z);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
 };
 const inside=()=>place({x:-17,z:-8.5},{x:-17,y:layout.groundY+.7,z:-6.5});
 const outside=()=>place({x:0,z:17},{x:0,y:layout.groundY+.7,z:19});
 const tick=now=>Game.prototype.updateOcclusion.call(game,now);
 inside();return{model,scene,outer,controller,camera,game,outlines,place,inside,outside,tick};
}
function rayHits(f){
 const p=f.game.activeActor.position,target=new THREE.Vector3(p.x,p.y+.7,p.z),direction=target.sub(f.camera.position),distance=direction.length();
 return new THREE.Raycaster(f.camera.position,direction.normalize(),0,distance-.15).intersectObjects(f.controller.occluders,false);
}
function assertOpacity(meshes,factor,label){
 for(const mesh of meshes)for(const material of materials(mesh))close(material.opacity,factor*base(material),`${label}: ${mesh.name}/${material.name}`);
}

test('authored interior detection respects a translated and rotated island, perimeter and floor level',()=>{
 const interior=layout.interiors.find(i=>i.landmarkId==='duan-center');assert.ok(interior);
 const rotated={...island,x:113,z:-87,rotation:Math.PI/3},b=interior.bounds;
 for(const[x,z]of[[b.x,b.z],[b.x-b.width/2+.02,b.z],[b.x,b.z+b.depth/2-.02]]){
  const p=localToWorld(rotated,{x,z,y:interior.floorY});assert.equal(campusInteriorAt(rotated,layout,p),interior);
 }
 for(const[x,z]of[[b.x-b.width/2-.02,b.z],[b.x+b.width/2+.02,b.z],[b.x,b.z-b.depth/2-.02],[b.x,b.z+b.depth/2+.02]]){
  assert.equal(campusInteriorAt(rotated,layout,localToWorld(rotated,{x,z,y:interior.floorY})),null);
 }
 for(const dy of[-1.5,1.5,4])assert.equal(campusInteriorAt(rotated,layout,localToWorld(rotated,{x:b.x,z:b.z,y:interior.floorY+dy})),null);
 assert.equal(campusInteriorAt(rotated,{},localToWorld(rotated,{x:b.x,z:b.z,y:interior.floorY})),null);
 assert.equal(campusInteriorAt(null,layout,{x:0,y:0,z:0}),null);
});

test('the upper-structure selector follows nested meshes and excludes floors, columns and other buildings',()=>{
 for(const name of upperNames){const owner=new THREE.Group(),nested=new THREE.Group(),mesh=new THREE.Mesh();owner.name=name;owner.add(nested);nested.add(mesh);assert.equal(isDuanUpperOccluder(mesh),true,name);}
 for(const name of['duan_ground','duan_furniture','occluder_campus_duan_ground_walls','occluder_campus_marsh_roof','occluder_campus_duan_lower_extra','anim_duan_theme_0']){
  const owner=new THREE.Group(),mesh=new THREE.Mesh();owner.name=name;owner.add(mesh);assert.equal(isDuanUpperOccluder(mesh),false,name);
 }
});

for(const quality of['high','low']){
 test(`${quality}: actual Duan upper groups cut away without a ray hit while floors and columns retain opacity`,async()=>{
  const f=fixture(await loadCampus(quality));try{
   const upper=f.controller.occluders.filter(isDuanUpperOccluder),structural=[];f.model.getObjectByName('occluder_campus_duan_ground_walls').traverse(mesh=>{if(mesh.isMesh)structural.push(mesh);});
   assert.ok(upper.length>0&&structural.length>0);
   for(const name of upperNames){const owner=f.model.getObjectByName(name);assert.ok(owner,`${quality}: ${name} is exported`);const meshes=[];owner.traverse(mesh=>{if(mesh.isMesh)meshes.push(mesh);});assert.ok(meshes.length>0);for(const mesh of meshes)assert.ok(upper.includes(mesh),`${quality}: ${mesh.name} is bound for cutaway`);}
   const paving=[];f.model.traverse(mesh=>{if(mesh.isMesh&&materials(mesh).some(m=>m.name==='campus_paving'))paving.push(mesh);});assert.ok(paving.length>0);
   for(const mesh of paving){assert.equal(isDuanUpperOccluder(mesh),false);assert.ok(!f.controller.occluders.includes(mesh),'the opaque floor never becomes a fade candidate');}
   const retained=new Map([...structural,...paving].flatMap(mesh=>materials(mesh).map(material=>[material,material.opacity])));
   assert.equal(rayHits(f).length,0,'central interior eye ray misses the roof and structural walls');
   f.tick(1000);assertOpacity(upper,.025,'interior upper structure');
   for(const[material,opacity]of retained)close(material.opacity,opacity,'floor/column opacity');
   assert.deepEqual(new Set(f.game.occluded),new Set(upper));assert.equal(f.outlines.at(-1),false,'the filled actor outline must not cover the concept exhibit');assert.equal(f.game.boatOutline.visible,false);
  }finally{f.controller.release();}
 });

 test(`${quality}: leaving the interior and opening a reading focus restore all cutaway materials`,async()=>{
  const f=fixture(await loadCampus(quality));try{
   const upper=f.controller.occluders.filter(isDuanUpperOccluder);
   f.tick(1000);assertOpacity(upper,.025,'initial cutaway');
   f.outside();assert.equal(rayHits(f).length,0);f.tick(1200);assertOpacity(upper,1,'exit restoration');assert.equal(f.game.occluded.size,0);assert.equal(f.outlines.at(-1),false);
   f.inside();f.tick(1400);assertOpacity(upper,.025,'reentered cutaway');
   f.game.focus={id:'education',landmarkId:'duan-center'};f.tick(1600);assertOpacity(upper,1,'reading restoration');assert.equal(f.game.occluded.size,0);assert.equal(f.outlines.at(-1),false);
   f.game.focus=null;f.tick(1800);assertOpacity(upper,.025,'closing reader reapplies cutaway');
   f.game.player.walking=false;f.game.player.ridingBicycle=true;
   f.game.bicycle={yaw:0,spec:{collisionHalfWidth:.30,collisionHalfLength:.70}};
   f.tick(2000);assertOpacity(upper,.025,'a cyclist inside Duan keeps the same clear view as a walker');
   f.game.player.ridingBicycle=false;f.game.player.onLand=false;
   f.tick(2200);assertOpacity(upper,1,'returning to sea does not retain an interior cutaway');assert.equal(f.game.occluded.size,0);
  }finally{f.controller.release();}
 });
}

test('ordinary outdoor ray occlusion keeps its 20% group fade and actor outline, including material arrays',()=>{
 const model=new THREE.Group(),owner=new THREE.Group();owner.name='occluder_campus_duan_lower';model.add(owner);
 const geometry=new THREE.BoxGeometry(1,1,1);for(const group of geometry.groups)group.materialIndex%=2;
 const mesh=new THREE.Mesh(geometry,[new THREE.MeshStandardMaterial({opacity:.6,transparent:true}),new THREE.MeshStandardMaterial()]);mesh.position.set(0,1.55,17.5);owner.add(mesh);
 const sibling=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());sibling.position.set(3,1.55,17.5);owner.add(sibling);
 const f=fixture(model);try{
  f.place({x:0,z:15},{x:0,y:1.55,z:20});assert.ok(rayHits(f).some(hit=>hit.object===mesh));
  f.tick(1000);assertOpacity([mesh,sibling],.2,'ordinary outdoor occlusion');assert.equal(f.outlines.at(-1),true);assert.equal(f.game.boatOutline.visible,false);
  f.game.focus={id:'education'};f.tick(1200);assertOpacity([mesh,sibling],1,'focus restores ordinary opacity');assert.equal(f.game.occluded.size,0);assert.equal(f.outlines.at(-1),false);
 }finally{f.controller.release();}
});

test('an active interior cutaway transfers from high to low quality and drops detached mesh references',async()=>{
 const high=await loadCampus('high'),low=await loadCampus('low'),f=fixture(high);try{
  const previous=f.controller.occluders.filter(isDuanUpperOccluder);
  f.tick(1000);assertOpacity(previous,.025,'high cutaway');
  f.controller.release();f.outer.remove(high);f.outer.add(low);f.controller.bind(low);f.scene.updateMatrixWorld(true);
  const current=f.controller.occluders.filter(isDuanUpperOccluder);assert.ok(current.length>0&&current.every(mesh=>!previous.includes(mesh)));
  f.tick(1200);assertOpacity(current,.025,'low cutaway');
  assert.ok([...f.game.occluded].every(mesh=>current.includes(mesh)),'the occlusion set contains only current-quality upper meshes');
  assertOpacity(previous,1,'detached model remains restored');
  f.outside();f.tick(1400);assertOpacity(current,1,'new model exit restoration');assert.equal(f.game.occluded.size,0);
 }finally{f.controller.release();}
});
