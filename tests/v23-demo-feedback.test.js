import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fs from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {IslandController} from '../sources/world/island.js';
import {islands} from '../sources/config.js';
import {Game} from '../sources/game.js';
import {localToWorld} from '../sources/core/character.js';
import {isInteriorCutaway} from '../sources/core/campus-cutaway.js';

const island=islands.find(i=>i.id==='experience');
function modelFixture(){
 const model=new THREE.Group(),source=new THREE.MeshStandardMaterial({name:'junction_clear',color:'#8db2bd',emissive:'#203040',emissiveIntensity:.04}),objects={};
 for(const company of ['amtrak','beaconfire','visionx']){
  const district=new THREE.Group();district.name='district_'+company;model.add(district);
  for(const role of ['plant','card','stage','arrival'])for(let i=0;i<3;i++){
   const group=new THREE.Group();group.name=`anim_experience_${company}_${role}_${i}`;group.position.set(i,1,0);
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),source);group.add(mesh);district.add(group);objects[`${company}:${role}:${i}`]={group,mesh};
  }
  const shared=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),source);district.add(shared);objects[company+':untouched']={mesh:shared};
 }
 return {model,source,objects};
}
const tick=(controller,dt,{paused=false,reduced=false}={})=>{controller.stepExperienceDemo(dt,{paused,reduced});controller.update(paused?0:dt,island,0,false,reduced);};
const fixture=()=>{const f=modelFixture(),controller=new IslandController(island,new THREE.Group());controller.bind(f.model);return {...f,controller};};

test('one company owns its animated transforms and cloned feedback materials; cancellation restores exactly',()=>{
 const {controller,source,objects}=fixture(),demo=controller.experienceDemo,card=objects['visionx:card:0'],selected=objects['visionx:plant:2'];
 const idle=Object.fromEntries(Object.entries(objects).map(([key,item])=>[key,{position:item.group?.position.clone(),intensity:item.mesh.material.emissiveIntensity,color:item.mesh.material.emissive.clone()}]));
 demo.play('visionx','sunny-balcony');tick(controller,1);
 assert.ok(card.group.position.x>0);assert.ok(selected.group.scale.y>1);assert.ok(selected.mesh.material.emissiveIntensity>.04);
 assert.notEqual(selected.mesh.material,source);assert.equal(source.emissiveIntensity,.04);
 for(const [key,item] of Object.entries(objects))if(!key.startsWith('visionx:')||key.endsWith('untouched')){
  assert.equal(item.mesh.material.emissiveIntensity,idle[key].intensity,key);assert.ok(item.mesh.material.emissive.equals(idle[key].color),key);
  if(item.group)assert.ok(item.group.position.equals(idle[key].position),key);
 }
 const paused=card.group.position.clone(),elapsed=demo.elapsed;tick(controller,30,{paused:true});assert.equal(demo.elapsed,elapsed);assert.ok(card.group.position.equals(paused));
 demo.cancel();controller.refreshExperienceFeedback();assert.ok(card.group.position.equals(idle['visionx:card:0'].position));assert.equal(selected.group.scale.y,1);assert.equal(selected.mesh.material.emissiveIntensity,.04);controller.release();
});

test('quality rebind preserves selection, exact simulation stage and cloned material ownership',()=>{
 const first=fixture(),controller=first.controller;controller.experienceDemo.play('beaconfire','retrieval');tick(controller,3.1);
 const state=controller.experienceDemo,snapshot=state.snapshot(),owned=first.objects['beaconfire:stage:0'].mesh.material;let disposed=0;owned.addEventListener('dispose',()=>disposed++);
 const second=modelFixture();controller.bind(second.model);assert.equal(controller.experienceDemo,state);assert.deepEqual(state.snapshot(),snapshot);
 for(const child of controller.children)assert.equal(child.experienceDemo,state);
 assert.ok(second.objects['beaconfire:stage:0'].mesh.material.emissiveIntensity>.04);assert.equal(second.objects['visionx:stage:0'].mesh.material.emissiveIntensity,.04);
 assert.equal(disposed,1);assert.equal(first.objects['beaconfire:stage:0'].mesh.material,first.source);
 const oldPosition=first.objects['beaconfire:card:1'].group.position.clone();tick(controller,.3);assert.ok(first.objects['beaconfire:card:1'].group.position.equals(oldPosition));
 controller.release();
});

test('reduced motion shows the selected result without translating cards or growing plants',()=>{
 const {controller,objects}=fixture();controller.experienceDemo.play('visionx','low-light',{reduced:true});tick(controller,0,{reduced:true});
 assert.equal(objects['visionx:plant:0'].group.scale.y,1);assert.equal(objects['visionx:card:0'].group.position.x,0);assert.ok(objects['visionx:plant:0'].mesh.material.emissiveIntensity>.04);assert.equal(objects['visionx:plant:2'].mesh.material.emissiveIntensity,.04);controller.release();
});

test('Amtrak arrival is one finite pulse, pauses and survives quality rebind without relighting other districts',()=>{
 const first=fixture(),controller=first.controller;controller.experienceArrived();tick(controller,2);
 assert.ok(first.objects['amtrak:arrival:0'].mesh.material.emissiveIntensity>.04);
 assert.equal(first.objects['visionx:arrival:0'].mesh.material.emissiveIntensity,.04);
 const elapsed=controller.experienceArrival.elapsed;tick(controller,9,{paused:true});assert.equal(controller.experienceArrival.elapsed,elapsed);
 const second=modelFixture();controller.bind(second.model);assert.equal(controller.experienceArrival.elapsed,elapsed);assert.ok(second.objects['amtrak:arrival:0'].mesh.material.emissiveIntensity>.04);
 tick(controller,3);assert.equal(second.objects['amtrak:arrival:0'].mesh.material.emissiveIntensity,.04);
 controller.experienceArrived();tick(controller,2,{reduced:true});assert.equal(second.objects['amtrak:arrival:0'].mesh.material.emissiveIntensity,.04);controller.release();
});

async function actualModel(quality){
 const bytes=await fs.readFile(new URL(`../static/models/${quality==='low'?'low/':''}experience.glb`,import.meta.url));
 return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}
for(const quality of ['high','low'])test(`${quality}: shipped GLB binds all worktables, selected plants and finite arrival feedback`,async()=>{
 const model=await actualModel(quality),controller=new IslandController(island,new THREE.Group());controller.bind(model);
 const meshes=node=>{const result=[];node.traverse(o=>{if(o.isMesh)result.push(o);});return result;};
 for(const company of ['visionx','beaconfire','amtrak']){
  const child=controller.children.find(c=>c.island.id===company);
  for(let i=0;i<3;i++){
   const card=model.getObjectByName(`anim_experience_${company}_card_${i}`),module=model.getObjectByName(`anim_experience_${company}_${company==='visionx'?'sample':'stage'}_${i}`);
   assert.ok(card&&module);assert.ok(meshes(card).some(m=>m.geometry.getAttribute('position').count>0));assert.ok(meshes(module).some(m=>m.geometry.getAttribute('position').count>0));
  }
  assert.ok(child.experienceMaterials.length>=6);
 }
 const selected=model.getObjectByName('anim_experience_visionx_sample_2'),base=selected.scale.clone();controller.experienceDemo.play('visionx','sunny-balcony');tick(controller,2);
 assert.ok(selected.scale.y>base.y);const selectedMats=controller.children.find(c=>c.island.id==='visionx').experienceMaterials.filter(m=>m.name==='anim_experience_visionx_sample_2');assert.ok(selectedMats.some(m=>m.material.emissiveIntensity>=.22));
 for(const child of controller.children.filter(c=>c.island.id!=='visionx'))for(const m of child.experienceMaterials)assert.equal(m.material.emissiveIntensity,m.intensity);
 controller.experienceDemo.cancel();controller.refreshExperienceFeedback();assert.ok(selected.scale.equals(base));
 controller.experienceArrived();tick(controller,2);const arrival=controller.children.find(c=>c.island.id==='amtrak').experienceMaterials.filter(m=>m.name==='anim_experience_amtrak_arrival_0');assert.ok(arrival.length>0);assert.ok(arrival.some(m=>m.material.emissiveIntensity>=.32));
 tick(controller,3);for(const m of arrival)assert.equal(m.material.emissiveIntensity,m.intensity);controller.release();
});

for(const quality of ['high','low'])test(`${quality}: the actual Amtrak cutaway cannot depth-mask the worktable and restores on reading/exit`,async()=>{
 const layout=JSON.parse(await fs.readFile(new URL('../static/models/walk-layout.json',import.meta.url),'utf8')).islands.find(i=>i.id==='experience');
 const model=await actualModel(quality),scene=new THREE.Scene(),outer=new THREE.Group();outer.position.set(island.x,0,island.z);outer.rotation.y=island.rotation;outer.add(model);scene.add(outer);
 const controller=new IslandController(island,outer);controller.bind(model);
 const interior=layout.interiors.find(i=>i.landmarkId==='career-station'),position=localToWorld(island,{x:6,y:21.55,z:-18.1}),eye=localToWorld(island,{x:6,y:25,z:-8});
 const camera=new THREE.PerspectiveCamera(28,1.6,.2,600);camera.position.set(eye.x,eye.y,eye.z);camera.lookAt(position.x,position.y+.7,position.z);camera.updateMatrixWorld(true);
 const game={scene,camera,activeActor:{position},player:{walking:true,onLand:true,island},walkLayouts:new Map([['experience',layout]]),environment:{occluders:[]},controllers:new Map([['experience',controller]]),jack:{root:{position},outline(){}},focus:null};
 const upper=controller.occluders.filter(mesh=>isInteriorCutaway(mesh,interior)),matList=mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material];
 const original=new Map(controller.occluders.flatMap(mesh=>matList(mesh).map(m=>[m,{opacity:m.opacity,depthWrite:m.depthWrite,depthTest:m.depthTest}])));
 assert.ok(upper.length>0);
 try{
  controller.experienceDemo.play('amtrak','valid');tick(controller,8);
  Game.prototype.updateOcclusion.call(game,1000);
  for(const mesh of upper)for(const m of matList(mesh)){assert.equal(m.depthWrite,false,'faded wall/roof cannot reject the desk fragments');assert.equal(m.depthTest,original.get(m).depthTest);assert.equal(m.opacity,.025*(m.userData.occlusionBaseOpacity??1));}
  for(const role of ['stage','card'])for(let i=0;i<3;i++){
   const group=model.getObjectByName(`anim_experience_amtrak_${role}_${i}`);assert.ok(group);
   for(let ancestor=group;ancestor;ancestor=ancestor.parent)assert.equal(ancestor.visible,true);
   group.traverse(mesh=>{if(!mesh.isMesh)return;assert.ok(!upper.includes(mesh),'worktable is outside the structural cutaway');for(const m of matList(mesh)){assert.equal(m.depthTest,true,'ordinary furniture still respects real scene depth');assert.ok(m.opacity>0);}});
  }
  game.focus={id:'amtrak'};Game.prototype.updateOcclusion.call(game,1200);assert.equal(game.occluded.size,0);
  for(const[m,base]of original){assert.equal(m.depthWrite,base.depthWrite);assert.equal(m.opacity,base.opacity);assert.equal(m.depthTest,base.depthTest);}
  game.focus=null;Game.prototype.updateOcclusion.call(game,1400);assert.ok(upper.every(mesh=>matList(mesh).every(m=>m.depthWrite===false)));
  game.player.onLand=false;game.player.walking=false;game.arrival={active:true};Game.prototype.updateOcclusion.call(game,1600);assert.equal(game.occluded.size,0);
  for(const[m,base]of original)assert.equal(m.depthWrite,base.depthWrite);
 }finally{controller.release();}
});

test('temporary occlusion restores both opaque and originally non-writing glass material flags',()=>{
 const model=new THREE.Group(),owner=new THREE.Group();owner.name='occluder_test';model.add(owner);
 const materials=[new THREE.MeshStandardMaterial(),new THREE.MeshStandardMaterial({transparent:true,opacity:.4,depthWrite:false})],geometry=new THREE.BoxGeometry(1,1,1);for(const group of geometry.groups)group.materialIndex%=2;const mesh=new THREE.Mesh(geometry,materials);mesh.position.set(0,1,1);owner.add(mesh);
 const controller=new IslandController({id:'test',x:0,z:0,r:20},model);controller.bind(model);
 const scene=new THREE.Scene();scene.add(model);const camera=new THREE.PerspectiveCamera();camera.position.set(0,1,3);camera.lookAt(0,1,0);camera.updateMatrixWorld(true);
 const game={scene,camera,activeActor:{position:{x:0,y:0,z:0}},player:{onLand:false,walking:false},environment:{occluders:[]},controllers:new Map([['test',controller]]),jack:{outline(){}}};
 try{
  const bound=mesh.material;assert.equal(bound[0].depthWrite,true);assert.equal(bound[1].depthWrite,false);
  Game.prototype.updateOcclusion.call(game,1000);assert.equal(game.occluded.size,1);assert.ok(bound.every(m=>!m.depthWrite&&m.depthTest));
  Game.prototype.updateOcclusion.call(game,1200);game.focus={id:'test'};Game.prototype.updateOcclusion.call(game,1400);
  assert.equal(bound[0].depthWrite,true);assert.equal(bound[1].depthWrite,false);assert.equal(bound[0].opacity,1);assert.equal(bound[1].opacity,.4);
 }finally{controller.release();}
});
