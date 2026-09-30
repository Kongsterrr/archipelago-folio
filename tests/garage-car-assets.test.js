import test from 'node:test';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import * as THREE from 'three';import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {MeshoptDecoder} from 'meshoptimizer';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {createG63RoofProbe} from './helpers/garage-roof-probe.js';
import {createCarHeadrestProbe} from './helpers/garage-headrest-probe.js';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {JackAvatar} from '../sources/world/jack.js';import {GarageCarController,GARAGE_CARS} from '../sources/core/garage-car.js';
await MeshoptDecoder.ready;await R.init();const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
async function load(name){const d=await io.read(fileURLToPath(new URL('../static/models/'+name,import.meta.url)));for(const m of d.getRoot().listMaterials())m.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null).setEmissiveTexture(null).setOcclusionTexture(null);for(const t of [...d.getRoot().listTextures()])t.dispose();for(const e of d.getRoot().listExtensionsUsed())if(e.extensionName==='EXT_meshopt_compression')e.dispose();const bytes=await io.writeBinary(d);return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
const jack=await load('jack-imported.glb');
for(const quality of['high','low'])for(const config of GARAGE_CARS)test(`${config.label} ${quality}: actual wheels, roof, seated Jack and quality-safe contacts`,async()=>{
 const gltf=await load(`${quality==='low'?'low/':''}car-${config.id}.glb`),scene=new THREE.Scene(),world=new R.World({x:0,y:0,z:0});
 const walk={vehicles:new Set(),handles:new Set(),groundAt:()=>0,contains:()=>true,clear:()=>true,visible:()=>true,island:{x:0,z:0,rotation:0,shore:[[-50,-50],[50,-50],[50,50],[-50,50]]},layout:{}};
 const car=new GarageCarController(R,world,walk,{x:0,y:0,z:0,yaw:0},config);car.setModel(gltf.scene,quality);scene.add(car.group);
 const avatar=new JackAvatar(scene,{loadAsync:async()=>({scene:clone(jack.scene),animations:jack.animations})});await avatar.load();
 try{
  assert.equal(car.wheelPivots.length,4);for(const wheel of car.wheelPivots){assert.equal(wheel.isMesh,undefined,'roll transform is a stable unquantized parent');assert.ok(wheel.children.some(n=>n.isMesh));}
  car.setOccupied(true);for(const roof of car.roof)assert.equal(roof.visible,true);
  if(config.id==='g63'){
   const body=car.model.getObjectByName('car-body'),roof=car.roof[0];
   assert.notEqual(roof.material,body.material,'roof finish cannot recolor the shared body atlas');
   assert.equal(roof.material.color.getHexString(),'71777b');
   for(const property of ['roughness','roughnessMap','metalness','metalnessMap','normalMap','envMapIntensity'])assert.equal(roof.material[property],body.material[property],`${property} follows body finish`);
   assert.equal(body.material.color.getHexString(),'ffffff','source body paint is unchanged');
   assert.equal(roof.material.opacity,1);assert.equal(roof.material.transparent,false);
  }
  const roofProbe=config.id==='g63'?createG63RoofProbe(car):null;
  const headrestProbe=createCarHeadrestProbe(car);
  const state={player:{onLand:true,ridingCar:true,car},character:{position:{x:0,y:0,z:0}},alpha:1,reduced:true,frozen:false};
  for(const yaw of[0,Math.PI/2,Math.PI]){
   car.teleport({x:4,y:0,z:2,yaw});car.setOccupied(true);
   for(const steer of[-1,0,1])for(const phase of[0,.7,2.4,4.9]){
    car.steering=steer;car.wheelAngle=car.previousWheelAngle=phase;car.updateVisual(0,true);avatar.update(0,state);scene.updateMatrixWorld(true);for(const roof of car.roof)assert.equal(roof.visible,true);
    if(roofProbe){const fit=roofProbe(avatar.model);assert.ok(fit.headVertices>10000);assert.equal(fit.coveredVertices,fit.headVertices);assert.equal(fit.penetratingVertices,0);assert.ok(fit.clearance>=.01,`hair-to-roof clearance ${fit.clearance}`);}
    const headrestFit=headrestProbe(avatar.model);
    assert.ok(headrestFit.covered>(config.id==='g63'?7000:3000));
    assert.equal(headrestFit.penetrating,0,'rearward pose must not intersect the headrest');
    assert.ok(headrestFit.clearance>=(config.id==='g63'?.005:.05),`headrest clearance ${headrestFit.clearance}`);
    const contact=avatar.carPose.contactStatus(car);assert.ok(contact.pelvisError<1e-5);
    for(const side of['Left','Right']){assert.ok(contact.palms[side].error<1e-4);assert.ok(contact.palms[side].skinError<.012);assert.ok(contact.soles[side].surfaceError<.007);assert.ok(contact.palms[side].requested<contact.palms[side].reach);}
    for(const side of['Left','Right']){
     const joint=name=>avatar.carPose.bones[side+name].getWorldPosition(new THREE.Vector3());
     const elbow=joint('ForeArm'),upper=joint('Arm').sub(elbow),lower=joint('Hand').sub(elbow);
     const angle=THREE.MathUtils.radToDeg(upper.angleTo(lower));
     assert.ok(angle>140&&angle<155,`extended but unlocked ${side} elbow: ${angle}`);
     assert.ok(contact.palms[side].reach-contact.palms[side].requested>.008,'hands retain reach reserve without stretching');
    }
    for(const [name,rest]of avatar.carPose.bind)assert.ok(avatar.carPose.bones[name].position.distanceTo(rest.position)<1e-6);
    assert.deepEqual(avatar.root.scale.toArray(),[1,1,1]);
    for(const wheel of car.wheelPivots)wheel.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.getAttribute('position'),v=new THREE.Vector3();for(let i=0;i<p.count;i++)assert.ok(v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).y>=-.001,`tire surface above ground: ${v.y}`);});
   }
  }
  car.park(false);car.previousWheelAngle=0;car.wheelAngle=6;car.previousSteering=-1;car.steering=1;
  car.updateVisual(1/120,false,.25);
  for(let n=0;n<car.wheelPivots.length;n++)assert.ok(Math.abs(car.wheelPivots[n].rotation.x+1.5*car.spec.wheelRadius/car.wheelRadii[n])<1e-9,'rolling distance uses this wheel radius');
  for(const steering of car.steeringNodes)assert.ok(Math.abs(steering.rotation.y+.3)<1e-7,'front steering shares chassis render interpolation');
  car.park(true);car.updateVisual(0,true);avatar.update(0,state);
  const pose=[...avatar.carPose.bind.keys()].map(n=>avatar.carPose.bones[n].quaternion.toArray());
  for(let n=0;n<6;n++)avatar.update(.1,{...state,frozen:true});assert.deepEqual([...avatar.carPose.bind.keys()].map(n=>avatar.carPose.bones[n].quaternion.toArray()),pose);
  car.setOccupied(false);for(const roof of car.roof)assert.equal(roof.visible,true);
  assert.ok(car.roof.length===(config.id==='g63'?1:0));
 }finally{car.dispose();world.free();}
});
