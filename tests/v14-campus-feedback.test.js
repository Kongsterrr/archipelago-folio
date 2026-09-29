import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {islands,toWorld} from '../sources/config.js';
import {CameraRig} from '../sources/core/camera.js';
import {IslandController} from '../sources/world/island.js';
import {applySunsetMaterials, releaseSunsetMaterials} from '../sources/world/sunset-materials.js';
import {SurfaceLibrary} from '../sources/world/surface-library.js';

const shape=material=>new THREE.Mesh(new THREE.BoxGeometry(),material);
function campusModel(){
 const model=new THREE.Group(),district=new THREE.Group(),fence=new THREE.Group(),windows=new THREE.Group();
 district.name='district_learning';fence.name='anim_campus_fence';windows.name='anim_bu_windows';
 const source=new THREE.MeshStandardMaterial({name:'campus_window',color:'#476d7f',emissive:'#ae8160',emissiveIntensity:.06,roughness:.29});
 const activeWindow=shape(source),staticWindow=shape(source);windows.add(activeWindow);district.add(windows,staticWindow,fence);
 const patterns=[0,1,2].map(index=>{const group=new THREE.Group();group.name=`anim_campus_fence_pattern_${index}`;group.add(shape(new THREE.MeshStandardMaterial({name:'campus_paint',color:'#c69271'})));fence.add(group);return group;});
 for(const name of['anim_book','anim_beacon']){const group=new THREE.Group();group.name=name;group.add(shape(source));district.add(group);}
 model.add(district);return{model,district,patterns,activeWindow,staticWindow,source};
}
const education={id:'education',x:0,z:0,rotation:0,districts:[{id:'learning',x:0,z:-3}]};
function fixture(){const f=campusModel(),controller=new IslandController(education,new THREE.Group());controller.bind(f.model);return{...f,controller,child:controller.children[0]};}
const tick=(f,dt,reduced=false)=>f.controller.update(dt,{x:0,z:0},0,false,reduced);
const visiblePattern=f=>f.patterns.map(p=>p.visible);

test('campus fence cycles exactly three authored patterns and freezes its reveal with simulation',()=>{
 const f=fixture();assert.deepEqual(visiblePattern(f),[true,false,false]);
 assert.equal(f.controller.cycleCampusFence(),1);assert.deepEqual(visiblePattern(f),[false,true,false]);
 const start=f.patterns[1].scale.x;assert.ok(start<.1);
 tick(f,0);assert.equal(f.patterns[1].scale.x,start);
 tick(f,.25);assert.ok(f.patterns[1].scale.x>start&&f.patterns[1].scale.x<1);
 tick(f,1);assert.equal(f.patterns[1].scale.x,1);
 assert.equal(f.controller.cycleCampusFence(),2);assert.deepEqual(visiblePattern(f),[false,false,true]);
 assert.equal(f.controller.cycleCampusFence(),0);assert.deepEqual(visiblePattern(f),[true,false,false]);
});

test('reduced motion changes the fence artwork without scaling the display',()=>{
 const f=fixture();f.controller.cycleCampusFence(true);assert.equal(f.patterns[1].scale.x,1);
 tick(f,.1,true);assert.equal(f.patterns[1].scale.x,1);assert.deepEqual(visiblePattern(f),[false,true,false]);
});

test('BU reading lights windows immediately during frozen simulation without changing shared sources',()=>{
 const f=fixture(),base=f.source.emissive.clone(),intensity=f.source.emissiveIntensity;
 assert.notEqual(f.activeWindow.material,f.source);assert.equal(f.staticWindow.material,f.source);
 assert.equal(f.controller.readSchool('bu'),true);
 assert.equal(f.activeWindow.material.emissiveIntensity,.48);assert.equal(f.activeWindow.material.emissive.getHexString(),'ffd59a');
 tick(f,0);assert.equal(f.activeWindow.material.emissiveIntensity,.48);
 assert.equal(f.source.emissiveIntensity,intensity);assert.ok(f.source.emissive.equals(base));
 f.controller.readSchool('cmu');assert.equal(f.activeWindow.material.emissiveIntensity,intensity);assert.ok(f.activeWindow.material.emissive.equals(base));
 f.controller.readSchool('bu');f.controller.readSchool(null);assert.equal(f.activeWindow.material.emissiveIntensity,intensity);
});

test('school focus queued before loading and fence selection survive model quality replacement',()=>{
 const controller=new IslandController(education,new THREE.Group()),first=campusModel();
 assert.equal(controller.readSchool('bu'),true);controller.bind(first.model);assert.equal(first.activeWindow.material.emissiveIntensity,.48);
 controller.cycleCampusFence(true);controller.cycleCampusFence(true);
 const second=campusModel();controller.bind(second.model);
 assert.deepEqual(second.patterns.map(p=>p.visible),[false,false,true]);assert.equal(second.activeWindow.material.emissiveIntensity,.48);
 assert.equal(first.activeWindow.material,first.source,'detached model is restored and no longer owned');
 controller.readSchool(null);assert.equal(second.activeWindow.material.emissiveIntensity,second.source.emissiveIntensity);
 assert.equal(first.source.emissiveIntensity,.06,'the replaced model never receives further feedback');
});

test('campus feedback coexists with the existing book and beacon celebration',()=>{
 const f=fixture(),book=f.model.getObjectByName('anim_book'),beacon=f.model.getObjectByName('anim_beacon');
 f.controller.cycleCampusFence(true);f.controller.activate('learning');tick(f,.5);
 assert.notEqual(book.rotation.z,0);assert.notEqual(beacon.rotation.y,0);assert.deepEqual(visiblePattern(f),[false,true,false]);
 tick(f,.1,true);assert.equal(book.rotation.z,0);assert.equal(beacon.rotation.y,0);assert.deepEqual(visiblePattern(f),[false,true,false]);
});

test('controller release restores bindings and disposes owned materials exactly once',()=>{
 const f=fixture(),owned=f.activeWindow.material;let ownedDisposals=0,sourceDisposals=0;
 owned.addEventListener('dispose',()=>ownedDisposals++);f.source.addEventListener('dispose',()=>sourceDisposals++);
 f.controller.readSchool('bu');f.controller.release();f.controller.release();
 assert.equal(ownedDisposals,1);assert.equal(sourceDisposals,0);assert.equal(f.activeWindow.material,f.source);
 assert.equal(f.controller.model,null);assert.equal(f.controller.children.length,0);
});

test('authored campus brick, limestone, copper and slate retain color and surface finish under sunset roofs',()=>{
 const model=new THREE.Group(),roof=new THREE.Group();roof.name='occluder_campus_roof';model.add(roof);
 const colors={campus_cmu_brick:'#c8ad7b',campus_bu_stone:'#d8d0bf',campus_copper:'#527d6a',campus_slate:'#516576'};
 for(const[name,color]of Object.entries(colors)){
  const material=new THREE.MeshStandardMaterial({name,color,roughness:.63,metalness:name==='campus_copper'?.42:0});roof.add(shape(material));
 }
 const originals=roof.children.map(m=>m.material);applySunsetMaterials(model,'education');
 roof.children.forEach((mesh,index)=>{const source=originals[index];assert.ok(mesh.material.color.equals(source.color));assert.equal(mesh.material.roughness,source.roughness);assert.equal(mesh.material.metalness,source.metalness);assert.equal(mesh.material.userData.sunsetMaterial.role,source.name);});
 releaseSunsetMaterials(model);roof.children.forEach((mesh,index)=>assert.equal(mesh.material,originals[index]));
});

test('campus materials and feedback release compose without recoloring unrelated windows',()=>{
 const f=campusModel();applySunsetMaterials(f.model,'education');const themed=f.activeWindow.material;
 const controller=new IslandController(education,new THREE.Group());controller.bind(f.model);controller.readSchool('bu');
 assert.notEqual(f.activeWindow.material,themed);assert.equal(f.staticWindow.material,themed);assert.equal(themed.emissiveIntensity,.06);
 controller.release();assert.equal(f.activeWindow.material,themed);releaseSunsetMaterials(f.model);assert.equal(f.activeWindow.material,f.source);
});

async function loadCampus(quality){
 const bytes=await fs.readFile(new URL(`../static/models/${quality==='low'?'low/':''}education.glb`,import.meta.url));
 return(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}
for(const quality of['high','low'])test(`${quality}: actual Education GLB binds all fence art, isolated BU windows, book and lighthouse`,async()=>{
 const model=await loadCampus(quality),island=islands.find(i=>i.id==='education'),originals=[];
 model.traverse(mesh=>{if(mesh.isMesh)for(const material of(Array.isArray(mesh.material)?mesh.material:[mesh.material]))if(material.name.startsWith('campus_'))originals.push({mesh,name:material.name,color:material.color.clone()});});
 applySunsetMaterials(model,'education');
 for(const {mesh,name,color}of originals){const material=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).find(m=>m.name===name);assert.ok(material.color.equals(color),`${quality} ${name} must retain authored landmark colors`);}
 const controller=new IslandController(island,new THREE.Group());controller.bind(model);
 const child=controller.children.find(c=>c.island.id==='learning');assert.ok(child);
 assert.equal(child.campusPatterns.length,3);assert.ok(child.campusWindows.length>0);
 for(const pattern of child.campusPatterns){let triangles=0;pattern.object.traverse(mesh=>{if(mesh.isMesh)triangles+=(mesh.geometry.index?.count||mesh.geometry.getAttribute('position').count)/3;});assert.ok(triangles>0,`${pattern.name} must contain actual painted geometry`);}
 const surfaces=new SurfaceLibrary({loader:{dispose(){}},fetchManifest:async()=>({})});surfaces.bind(model,'education');
 const renderedMaterials=new Set();model.traverse(mesh=>{if(mesh.isMesh)for(const m of(Array.isArray(mesh.material)?mesh.material:[mesh.material]))renderedMaterials.add(m);});
 controller.readSchool('bu');
 for(const {material}of child.campusWindows){assert.ok(renderedMaterials.has(material),'visible window feedback must target the rendered material after surface binding');assert.ok(material.emissiveIntensity>=.48);}
 controller.cycleCampusFence(true);assert.deepEqual(child.campusPatterns.map(n=>n.object.visible),[false,true,false]);
 controller.activate('learning');controller.update(.5,island,.5);
 assert.notEqual(model.getObjectByName('anim_book').rotation.z,0);assert.notEqual(model.getObjectByName('anim_beacon').rotation.y,0);
 controller.readSchool(null);for(const {material,intensity}of child.campusWindows)assert.equal(material.emissiveIntensity,intensity);
 surfaces.release(model);controller.release();releaseSunsetMaterials(model);surfaces.dispose();
});

test('actual high-to-low Education rebind retains painted fence selection and frozen BU reading',async()=>{
 const high=await loadCampus('high'),low=await loadCampus('low'),controller=new IslandController(islands.find(i=>i.id==='education'),new THREE.Group());
 applySunsetMaterials(high,'education');controller.bind(high);controller.cycleCampusFence(true);controller.cycleCampusFence(true);controller.readSchool('bu');
 controller.release();releaseSunsetMaterials(high);applySunsetMaterials(low,'education');controller.bind(low);
 const child=controller.children[0];assert.deepEqual(child.campusPatterns.map(n=>n.object.visible),[false,false,true]);for(const {material}of child.campusWindows)assert.ok(material.emissiveIntensity>=.48);
 controller.update(0,controller.island,0);assert.deepEqual(child.campusPatterns.map(n=>n.object.visible),[false,false,true]);
 controller.release();releaseSunsetMaterials(low);
});

test('actual high/low campus walls join roof occlusion, including the default-camera ray hiding Jack at The Fence',async()=>{
 const island=islands.find(i=>i.id==='education');
 const walls={hamburg_roof:'campus_sandstone',hamerschlag_dome:'campus_sandstone',marsh_roof:'campus_limestone',cas_roof:'campus_limestone',brownstone_0:'campus_brick',brownstone_1:'campus_brickDark',brownstone_2:'campus_brick'};
 for(const quality of['high','low']){
  const model=await loadCampus(quality),outer=new THREE.Group();outer.position.set(island.x,0,island.z);outer.rotation.y=island.rotation;outer.add(model);
  const controller=new IslandController(island,outer);controller.bind(model);outer.updateMatrixWorld(true);
  for(const[name,materialName]of Object.entries(walls)){
   const owner=model.getObjectByName('occluder_campus_'+name);assert.ok(owner,`${quality}: ${name} keeps an occlusion owner`);
   const body=[];owner.traverse(mesh=>{if(mesh.isMesh&&(Array.isArray(mesh.material)?mesh.material:[mesh.material]).some(m=>m.name===materialName))body.push(mesh);});
   assert.ok(body.length>0,`${quality}: ${name} includes its actual wall geometry, not only the roof`);
   for(const mesh of body){assert.ok(controller.occluders.includes(mesh),`${quality}: ${name} wall is collected for runtime fading`);for(const material of(Array.isArray(mesh.material)?mesh.material:[mesh.material]))assert.ok(material.transparent);}
  }
  // Reproduce the reported fixed land-camera viewpoint, with the same chest
  // probe and endpoint clearance as Game.updateOcclusion, against actual GLB.
  const actor=toWorld(island,15.57,-2.36,.85),camera=new THREE.PerspectiveCamera(28,1440/900,.2,600),rig=new CameraRig(camera,{walkZoom:1,zoom:1,reduced:false},1440,900);
  rig.update(0,{position:actor,locomotion:'walking',landAzimuth:island.rotation},true);
  const target=new THREE.Vector3(actor.x,actor.y+.7,actor.z),direction=target.clone().sub(camera.position);
  const ray=new THREE.Raycaster(camera.position,direction.clone().normalize(),0,direction.length()-.15),hits=ray.intersectObject(model,true);
  const wallHit=hits.find(hit=>hit.object.material.name==='campus_sandstone');assert.ok(wallHit,`${quality}: reported view actually intersects Hamburg's body`);
  assert.equal(wallHit.object.parent.name,'occluder_campus_hamburg_roof');
  assert.ok(controller.occluders.includes(wallHit.object),`${quality}: the formerly static wall is now a fade candidate`);
  for(const hit of hits)assert.ok(controller.occluders.includes(hit.object),`${quality}: no unregistered opaque batch remains between camera and Jack`);
  let plazas=0;model.traverse(mesh=>{if(mesh.isMesh&&(Array.isArray(mesh.material)?mesh.material:[mesh.material]).some(m=>m.name==='campus_paving')){plazas++;assert.ok(!controller.occluders.includes(mesh),`${quality}: ground paving remains visible when the building fades`);}});assert.ok(plazas>0);
  controller.release();
 }
});
