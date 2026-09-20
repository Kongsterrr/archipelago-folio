// This reads the shipped compressed GLB, not the procedural authoring mesh.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

const MODEL=new URL('../static/models/jack.glb',import.meta.url);
const PANTS_JOINT=/^(Hips|(Left|Right)(UpLeg|Leg))$/;

test('V4.6 all compressed trouser skin clears actual bench slats throughout the sit loop', async()=>{
 const bytes=await fs.readFile(MODEL),gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const model=gltf.scene,mixer=new THREE.AnimationMixer(model),clip=gltf.animations.find(c=>c.name==='sit');
 assert.ok(clip,'sit animation exists');mixer.clipAction(clip).play();
 let spec;model.traverse(o=>{if(o.userData.characterSpec)spec=o.userData.characterSpec;});
 assert.ok(spec && Number.isFinite(spec.benchSeatOffset) && Number.isFinite(spec.benchForwardOffset),'placement comes from shipped GLB');
 const samples=[],skeletons=new Set();let mixedHipThigh=0,upperThigh=0;
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  // Export currently emits child mesh per primitive. If it becomes multi-material,
  // accept only vertices used by the navy material groups.
  const g=mesh.geometry,ids=g.getAttribute('skinIndex'),weights=g.getAttribute('skinWeight'),eligible=new Set();
  const count=g.index?.count??ids.count,groups=g.groups.length?g.groups:[{start:0,count,materialIndex:0}];
  for(const group of groups)if(/NavyKnit/.test(materials[group.materialIndex??0]?.name??''))for(let i=group.start;i<group.start+group.count;i++)eligible.add(g.index?g.index.getX(i):i);
  for(const i of eligible){
   const names=[0,1,2,3].filter(k=>weights.getComponent(i,k)>.01).map(k=>mesh.skeleton.bones[ids.getComponent(i,k)].name);
   if(!names.length||!names.every(n=>PANTS_JOINT.test(n)))continue;
   // Deliberately include Hips and UpLeg; checking only Leg/Foot misses a
   // continuous upper-thigh surface penetrating the frontmost wooden slat.
   const hasUpper=names.some(n=>/UpLeg$/.test(n)),hasHips=names.includes('Hips');
   upperThigh+=hasUpper;if(hasUpper&&hasHips)mixedHipThigh++;
   let dominant=0;for(let k=1;k<4;k++)if(weights.getComponent(i,k)>weights.getComponent(i,dominant))dominant=k;
   samples.push({mesh,index:i,names,hipDominant:mesh.skeleton.bones[ids.getComponent(i,dominant)].name==='Hips'});skeletons.add(mesh.skeleton);
  }
 });
 assert.ok(samples.length>500,'exercise actual trousers skin');
 assert.ok(upperThigh>100&&mixedHipThigh>20,'include the continuous hip-to-thigh transition');
 const seat=new THREE.Vector3(4,1.46,8),p=new THREE.Vector3();
 for(const yaw of [0,.37,Math.PI/2,Math.PI,Math.PI*1.5]){
  const benchFrame=new THREE.Matrix4().makeRotationY(yaw);benchFrame.setPosition(seat);const inverseBench=benchFrame.clone().invert();
  model.rotation.set(0,yaw,0);model.position.set(seat.x-Math.sin(yaw)*spec.benchForwardOffset,seat.y-spec.benchSeatOffset,seat.z-Math.cos(yaw)*spec.benchForwardOffset);
  for(let frame=0;frame<=60;frame++){
   const time=clip.duration*frame/60;mixer.setTime(time);model.updateMatrixWorld(true);for(const s of skeletons)s.update();
   let hipsBottom=Infinity;
   for(const item of samples){
    item.mesh.getVertexPosition(item.index,p).applyMatrix4(item.mesh.matrixWorld).applyMatrix4(inverseBench);
    assert.ok(p.toArray().every(Number.isFinite),'deformed trousers vertices remain finite');
    if(item.hipDominant)hipsBottom=Math.min(hipsBottom,p.y);
    // Actual bench has three 1.95 × .12 × .18 m slats at Z=-.22,0,.22.
    // A 2mm allowance covers quantization and soft seat contact; larger visual
    // penetration is rejected at every orientation and between animation keys.
    const insideHeight=p.y<-.002&&p.y>-.12;
    const insideWidth=Math.abs(p.x)<.975;
    const insideSlat=[-.22,0,.22].some(z=>Math.abs(p.z-z)<.09);
    assert.ok(!(insideHeight&&insideWidth&&insideSlat),`trouser/slat intersection at ${time.toFixed(4)}s yaw=${yaw}: ${item.names.join('+')} vertex=[${p.toArray().map(n=>n.toFixed(5))}]`);
   }
   assert.ok(Number.isFinite(hipsBottom)&&hipsBottom>=-.002&&hipsBottom<=.012,`pelvis remains supported on seat (${hipsBottom})`);
  }
 }
});
