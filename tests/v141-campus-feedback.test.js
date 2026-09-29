import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {IslandController} from '../sources/world/island.js';
import {islands} from '../sources/config.js';

const education=islands.find(island=>island.id==='education');
const visibility=controller=>controller.campusController().duanThemes.map(node=>node.object.visible);
const tick=(controller,dt,reduced=false)=>controller.update(dt,education,0,false,reduced);
function fixtureModel(){
 const model=new THREE.Group(),district=new THREE.Group();district.name='district_learning';model.add(district);
 const source=new THREE.MeshStandardMaterial({name:'warmWindow',color:'#e8d3b1',emissive:'#ae8160',emissiveIntensity:.08});
 const themes=[],pulses=[];
 for(let i=0;i<3;i++){
  const theme=new THREE.Group(),pulse=new THREE.Group();theme.name='anim_duan_theme_'+i;pulse.name='anim_duan_pulse_'+i;
  pulse.position.set(5+i,.4,-3);pulse.add(new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),source));theme.add(pulse);district.add(theme);themes.push(theme);pulses.push(pulse);
 }
 const page=new THREE.Group();page.name='anim_campus_study_page';page.position.set(1,1,2);page.rotation.z=.12;page.add(new THREE.Mesh(new THREE.BoxGeometry(.2,.01,.3),source));district.add(page);
 const lights=new THREE.Group();lights.name='anim_campus_study_lights';const lamp=new THREE.Mesh(new THREE.BoxGeometry(.1,.03,.1),source);lights.add(lamp);district.add(lights);
 const otherLamp=new THREE.Mesh(new THREE.BoxGeometry(.1,.03,.1),source);district.add(otherLamp);
 return{model,themes,pulses,page,lamp,otherLamp,source};
}
function fixture(){const f=fixtureModel(),controller=new IslandController(education,new THREE.Group());controller.bind(f.model);return{...f,controller};}
const approximately=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-9,message||`${actual} approximately ${expected}`);

test('Duan themes begin with sunlight, cycle through all concepts, and freeze pulse motion at dt zero',()=>{
 const f=fixture(),starts=f.pulses.map(p=>p.position.clone());assert.deepEqual(visibility(f.controller),[true,false,false]);
 assert.equal(f.controller.cycleDuanTheme(),0);assert.equal(f.controller.campusState.duanStarted,true);
 tick(f.controller,.45);assert.notEqual(f.pulses[0].position.x,starts[0].x);assert.ok(Math.abs(f.pulses[0].position.x-starts[0].x)<=.08);
 const position=f.pulses[0].position.clone(),elapsed=f.controller.campusState.duanElapsed;
 tick(f.controller,0);tick(f.controller,0);assert.ok(f.pulses[0].position.equals(position));assert.equal(f.controller.campusState.duanElapsed,elapsed);
 assert.equal(f.controller.cycleDuanTheme(),1);assert.deepEqual(visibility(f.controller),[false,true,false]);
 assert.equal(f.controller.cycleDuanTheme(),2);assert.deepEqual(visibility(f.controller),[false,false,true]);
 assert.equal(f.controller.cycleDuanTheme(),0);assert.deepEqual(visibility(f.controller),[true,false,false]);
 tick(f.controller,5.1);for(let i=0;i<3;i++)assert.ok(f.pulses[i].position.equals(starts[i]),'completed pulses restore exact authored coordinates');
 f.controller.release();
});

test('reduced motion switches the concept immediately without moving the diagram or turning a page',()=>{
 const f=fixture(),starts=f.pulses.map(p=>p.position.clone()),angle=f.page.rotation.z;
 f.controller.cycleDuanTheme(true);f.controller.cycleDuanTheme(true);assert.deepEqual(visibility(f.controller),[false,true,false]);
 f.controller.setStudySeated(true);tick(f.controller,.9,true);
 for(let i=0;i<3;i++)assert.ok(f.pulses[i].position.equals(starts[i]));approximately(f.page.rotation.z,angle);
 assert.ok(f.lamp.material.emissiveIntensity>=.6,'light still communicates the seated state');
 f.controller.release();
});

test('study seat turns its own lamp on, pauses the page turn, and stops both effects immediately on standing',()=>{
 const f=fixture(),angle=f.page.rotation.z,intensity=f.source.emissiveIntensity,color=f.source.emissive.clone();
 assert.notEqual(f.lamp.material,f.source);assert.equal(f.otherLamp.material,f.source);
 f.controller.setStudySeated(true);assert.ok(f.lamp.material.emissiveIntensity>=.6);assert.equal(f.otherLamp.material.emissiveIntensity,intensity);
 tick(f.controller,.45);assert.ok(f.page.rotation.z>angle);const pausedAngle=f.page.rotation.z;
 tick(f.controller,0);assert.equal(f.page.rotation.z,pausedAngle);
 const elapsed=f.controller.campusState.studyElapsed;f.controller.setStudySeated(true);assert.equal(f.controller.campusState.studyElapsed,elapsed,'continuous seated updates must not restart the animation');
 tick(f.controller,.45);approximately(f.page.rotation.z,angle+.9,'page reaches its midpoint once after 0.9 seconds');
 tick(f.controller,.9);approximately(f.page.rotation.z,angle,'page rests again at 1.8 seconds');assert.ok(f.lamp.material.emissiveIntensity>=.6);
 f.controller.setStudySeated(false);approximately(f.page.rotation.z,angle);assert.equal(f.lamp.material.emissiveIntensity,intensity);assert.ok(f.lamp.material.emissive.equals(color));
 f.controller.setStudySeated(true);tick(f.controller,.3);assert.ok(f.page.rotation.z>angle,'sitting again starts a fresh page turn');
 f.controller.setStudySeated(false);approximately(f.page.rotation.z,angle,'standing halfway through a page turn resets it immediately');
 assert.equal(f.source.emissiveIntensity,intensity);assert.ok(f.source.emissive.equals(color));f.controller.release();
});

test('a quality rebind preserves the shared concept, paused page time and study-light state',()=>{
 const first=fixture(),controller=first.controller;controller.cycleDuanTheme(true);controller.cycleDuanTheme();controller.setStudySeated(true);tick(controller,.45);
 const state=controller.campusState,elapsed=state.studyElapsed,oldLamp=first.lamp.material;let disposed=0;oldLamp.addEventListener('dispose',()=>disposed++);
 const second=fixtureModel();controller.bind(second.model);
 assert.equal(controller.campusState,state);assert.equal(controller.campusController().campusState,state);assert.equal(state.studyElapsed,elapsed);
 assert.deepEqual(visibility(controller),[false,true,false]);assert.ok(second.lamp.material.emissiveIntensity>=.6);
 tick(controller,0);assert.ok(second.page.rotation.z>.12,'a frozen tick restores the same in-progress authored pose');assert.equal(state.studyElapsed,elapsed);
 assert.equal(first.lamp.material,first.source);assert.equal(disposed,1);assert.equal(first.source.emissiveIntensity,.08);
 controller.setStudySeated(false);assert.equal(second.lamp.material.emissiveIntensity,.08);controller.release();
});

test('study-light ownership is released once without disposing shared source materials',()=>{
 const f=fixture(),owned=f.lamp.material;let ownedCount=0,sourceCount=0;owned.addEventListener('dispose',()=>ownedCount++);f.source.addEventListener('dispose',()=>sourceCount++);
 f.controller.setStudySeated(true);f.controller.release();f.controller.release();
 assert.equal(ownedCount,1);assert.equal(sourceCount,0);assert.equal(f.lamp.material,f.source);assert.equal(f.otherLamp.material,f.source);
 assert.equal(f.controller.model,null);assert.equal(f.controller.children.length,0);
});

async function loadCampus(quality){
 const bytes=await fs.readFile(new URL(`../static/models/${quality==='low'?'low/':''}education.glb`,import.meta.url));
 return(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}
const triangleCount=object=>{let count=0;object.traverse(mesh=>{if(mesh.isMesh)count+=(mesh.geometry.index?.count||mesh.geometry.getAttribute('position').count)/3;});return count;};
for(const quality of['high','low'])test(`${quality}: actual GLB contains complete Duan concepts and seated study feedback`,async()=>{
 const model=await loadCampus(quality),controller=new IslandController(education,new THREE.Group());controller.bind(model);const child=controller.campusController();
 assert.equal(child.duanThemes.length,3);assert.equal(child.duanPulses.length,3);assert.equal(child.studyPages.length,1);assert.ok(child.studyLights.length>0);
 for(let i=0;i<3;i++){
  const theme=model.getObjectByName('anim_duan_theme_'+i),pulse=model.getObjectByName('anim_duan_pulse_'+i);assert.ok(theme&&pulse);
  assert.ok(triangleCount(theme)>0,'theme must contain actual authored visible diagram geometry');assert.ok(triangleCount(pulse)>0,'pulse must move actual geometry');assert.equal(pulse.parent,theme);
 }
 const page=model.getObjectByName('anim_campus_study_page');assert.ok(triangleCount(page)>0);
 const angle=page.rotation.z;controller.cycleDuanTheme(true);controller.cycleDuanTheme();controller.setStudySeated(true);tick(controller,.45);
 assert.deepEqual(visibility(controller),[false,true,false]);assert.ok(page.rotation.z>angle);for(const lamp of child.studyLights)assert.ok(lamp.material.emissiveIntensity>=.6);
 const paused=page.rotation.z;tick(controller,0);assert.equal(page.rotation.z,paused);controller.setStudySeated(false);approximately(page.rotation.z,angle);
 for(const lamp of child.studyLights){assert.equal(lamp.material.emissiveIntensity,lamp.intensity);assert.ok(lamp.material.emissive.equals(lamp.emissive));}
 controller.release();
});

test('actual high-to-low replacement retains Duan selection and a seated study session',async()=>{
 const high=await loadCampus('high'),low=await loadCampus('low'),controller=new IslandController(education,new THREE.Group());controller.bind(high);
 controller.cycleDuanTheme(true);controller.cycleDuanTheme(true);controller.cycleDuanTheme(true);controller.setStudySeated(true);tick(controller,.6);
 const state=controller.campusState,elapsed=state.studyElapsed;controller.bind(low);tick(controller,0);
 assert.equal(controller.campusController().campusState,state);assert.equal(state.studyElapsed,elapsed);assert.deepEqual(visibility(controller),[false,false,true]);
 assert.ok(controller.campusController().studyPages[0].object.rotation.z>controller.campusController().studyPages[0].rotation.z);
 for(const lamp of controller.campusController().studyLights)assert.ok(lamp.material.emissiveIntensity>=.6);
 controller.setStudySeated(false);for(const lamp of controller.campusController().studyLights)assert.equal(lamp.material.emissiveIntensity,lamp.intensity);controller.release();
});
