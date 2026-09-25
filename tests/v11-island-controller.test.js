import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {islands,toWorld,islandActions} from '../sources/config.js';
import {IslandController} from '../sources/world/island.js';
import {applySunsetMaterials,SUNSET_ISLAND_PALETTES} from '../sources/world/sunset-materials.js';

async function load(id,quality='high'){
 const bytes=fs.readFileSync(new URL(`../static/models/${quality==='low'?'low/':''}${id}.glb`,import.meta.url));
 return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}
async function fixture(id='experience',quality='high'){
 const island=islands.find(i=>i.id===id),outer=new THREE.Group(),model=await load(id,quality);
 outer.position.set(island.x,0,island.z);outer.rotation.y=island.rotation;outer.add(model);applySunsetMaterials(model,id);
 const controller=new IslandController(island,outer);controller.bind(model);outer.updateMatrixWorld(true);
 return {island,outer,model,controller,child:id=>controller.children.find(c=>c.island.id===id)};
}
const transforms=controller=>controller.nodes.map(({object})=>({object,position:object.position.toArray(),rotation:object.quaternion.toArray(),scale:object.scale.toArray()}));
function assertTransformsUnchanged(before){for(const entry of before){assert.deepEqual(entry.object.position.toArray(),entry.position,entry.object.name+' position');assert.ok(new THREE.Quaternion().fromArray(entry.rotation).angleTo(entry.object.quaternion)<1e-7,entry.object.name+' orientation');assert.deepEqual(entry.object.scale.toArray(),entry.scale,entry.object.name+' scale');}}

for(const quality of ['high','low'])test(`${quality}: activating VisionX only animates its district on the actual Experience island`,async()=>{
 const f=await fixture('experience',quality),train=transforms(f.child('amtrak')),pipeline=transforms(f.child('beaconfire'));
 assert.deepEqual(f.controller.children.map(c=>c.island.id),['amtrak','beaconfire','visionx']);
 assert.equal(f.controller.activate('visionx'),islandActions.visionx[1]);assert.equal(f.child('visionx').elapsed,0);assert.ok(f.child('beaconfire').elapsed>=f.child('beaconfire').duration);
 const plant=f.child('visionx').group.getObjectByName('anim_plant_0'),height=plant.scale.y;
 f.controller.update(.5,f.island,.5);assert.ok(plant.scale.y>height);assertTransformsUnchanged(train);assertTransformsUnchanged(pipeline);
});

test('an explicit unknown district action cannot silently start the first child',async()=>{
 const f=await fixture(),before=f.controller.children.map(c=>c.elapsed);
 assert.equal(f.controller.activate('missing-district'),undefined);
 assert.deepEqual(f.controller.children.map(c=>c.elapsed),before);
});

test('Amtrak pedestrian stopping transforms through both the island and district offsets',async()=>{
 const f=await fixture(),train=f.child('amtrak'),track=train.island.animation.train;
 const expected=toWorld(f.island,-24,-4);assert.ok(Math.hypot(train.island.x-expected.x,train.island.z-expected.z)<1e-10);
 f.controller.activate('amtrak');f.controller.pedestrian=toWorld(train.island,track.trackCentre[0]+track.trackRadii[0],track.trackCentre[2]);
 f.controller.update(1/60,f.island,0);assert.equal(train.elapsed,0,'a visitor at the translated train position stops the train');
 f.controller.pedestrian=toWorld(f.island,track.trackRadii[0],track.trackCentre[2]);
 f.controller.update(1/60,f.island,1/60);assert.ok(train.elapsed>0,'an unrelated point around the parent origin does not stop the district train');
});

test('Amtrak crossing guard also respects a rotated district inside the parent',async()=>{
 const f=await fixture(),district=f.island.districts.find(d=>d.id==='amtrak'),rotation=.37;
 const custom={...f.island,districts:f.island.districts.map(d=>d.id==='amtrak'?{...d,rotation}:d)};
 f.model.getObjectByName('district_amtrak').rotation.y=rotation;const controller=new IslandController(custom,f.outer);controller.bind(f.model);const train=controller.children.find(c=>c.island.id==='amtrak');
 assert.equal(train.island.rotation,f.island.rotation+rotation);controller.activate('amtrak');controller.pedestrian=toWorld(train.island,8.8,-1.4);
 controller.update(1/60,custom,0);assert.equal(train.elapsed,0);controller.pedestrian=toWorld(train.island,-18,18);controller.update(1/60,custom,1/60);assert.ok(train.elapsed>0);
});

test('one packet action moves each material batch only through its animated owner',async()=>{
 const f=await fixture(),owner=f.model.getObjectByName('anim_packet_0');let batch;owner.traverse(o=>{if(o.isMesh&&!batch)batch=o;});
 const initialLocal=owner.worldToLocal(batch.getWorldPosition(new THREE.Vector3()));f.controller.activate('beaconfire');f.controller.update(1.2,f.island,1.2);f.outer.updateMatrixWorld(true);
 const expected=owner.localToWorld(initialLocal),actual=batch.getWorldPosition(new THREE.Vector3());
 assert.ok(actual.distanceTo(expected)<1e-8,`material geometry received a second packet motion (${actual.distanceTo(expected).toFixed(4)} world units)`);
});

test('signal material batches inherit exactly one signal rotation',async()=>{
 const f=await fixture(),owner=f.model.getObjectByName('anim_signal');let batch;owner.traverse(o=>{if(o.isMesh&&!batch)batch=o;});
 const relative=owner.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(batch.getWorldQuaternion(new THREE.Quaternion()));f.controller.activate('amtrak');f.controller.update(.4,f.island,.4);f.outer.updateMatrixWorld(true);
 const expected=owner.getWorldQuaternion(new THREE.Quaternion()).multiply(relative),actual=batch.getWorldQuaternion(new THREE.Quaternion());
 assert.ok(expected.angleTo(actual)<1e-8,'signal group and its material batch must not each rotate by π');
});

test('glowing animation materials are isolated between districts, including shared signal sources',async()=>{
 const f=await fixture(),idle=[f.child('beaconfire'),f.child('visionx')],before=idle.flatMap(c=>c.glowing.map(material=>({material,color:material.emissive.toArray(),intensity:material.emissiveIntensity})));
 f.controller.activate('amtrak');f.controller.update(.5,f.island,.5);
 assert.ok(f.child('amtrak').glowing.some(material=>material.emissiveIntensity>0));
 for(const entry of before){assert.deepEqual(entry.material.emissive.toArray(),entry.color,'another district changed this district’s emissive color');assert.equal(entry.material.emissiveIntensity,entry.intensity,'another district changed this district’s emissive intensity');}
});

test('rebinding a quality model no longer mutates animation nodes from the replaced model',async()=>{
 const f=await fixture(),old=transforms(f.child('visionx')),replacement=await load('experience','low');f.outer.remove(f.model);f.outer.add(replacement);applySunsetMaterials(replacement,'experience');f.controller.bind(replacement);f.controller.activate('visionx');f.controller.update(.4,f.island,.4);
 assertTransformsUnchanged(old);assert.equal(f.controller.children.length,3);for(const child of f.controller.children)assert.ok(child.group.parent,'all rebound district roots belong to the replacement asset');
});

test('sunset palette selection follows the child district for shared static material sources',()=>{
 const model=new THREE.Group(),shared=new THREE.MeshStandardMaterial({name:'wood',color:'#ffffff'}),meshFor={};
 for(const id of ['amtrak','beaconfire','visionx']){const district=new THREE.Group();district.name='district_'+id;const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),shared);district.add(mesh);model.add(district);meshFor[id]=mesh;}
 applySunsetMaterials(model,'experience');
 assert.equal(meshFor.amtrak.material.color.getHexString(),new THREE.Color(SUNSET_ISLAND_PALETTES.amtrak.wood).getHexString());assert.equal(meshFor.beaconfire.material.color.getHexString(),new THREE.Color(SUNSET_ISLAND_PALETTES.beaconfire.wood).getHexString());assert.notEqual(meshFor.amtrak.material,meshFor.beaconfire.material);assert.equal(shared.color.getHexString(),'ffffff','source palette remains reusable');
});


test('reading a specific story highlights that district; overview highlights the whole island',async()=>{
 const f=await fixture(),idle=['beaconfire','visionx'].map(id=>f.child(id).glowing.map(m=>m.emissiveIntensity));f.controller.update(0,f.island,0,true,false,'amtrak');
 assert.ok(f.child('amtrak').glowing.some(m=>m.emissiveIntensity===.15));
 ['beaconfire','visionx'].forEach((id,n)=>assert.deepEqual(f.child(id).glowing.map(m=>m.emissiveIntensity),idle[n]));
 f.controller.update(0,f.island,0,true);for(const child of f.controller.children)assert.ok(child.glowing.some(m=>m.emissiveIntensity===.15));
});
