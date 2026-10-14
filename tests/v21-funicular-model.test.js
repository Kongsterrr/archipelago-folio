import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {CAREER_TRAIN,CareerTrainController} from '../sources/core/career-train.js';
import {CareerTrainVisual} from '../sources/world/career-train.js';
import {careerRailway} from '../scripts/lib/career-railway-layout.mjs';
import {sampleTrainPath} from '../sources/core/train-path.js';

async function model(){const data=await fs.readFile(new URL('../static/models/career-train.glb',import.meta.url));return(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'')).scene;}
async function fixture(t){const controller=new CareerTrainController(careerRailway(),{island:{x:12,y:2,z:-8,rotation:1.17}}),visual=new CareerTrainVisual(new THREE.Scene(),controller);visual.bind(await model());t.after(()=>visual.dispose());return{controller,visual,cabin:visual.cars[0]};}
const close=(a,b,epsilon=.001)=>assert.ok(Math.abs(a-b)<epsilon,`${a} differs from ${b}`);

test('V21 ships one detailed level cabin, four independent circular wheels and a real clear door within the resource budget',async t=>{
 const {visual,cabin}=await fixture(t),manifest=JSON.parse(await fs.readFile(new URL('../static/models/career-train-manifest.json',import.meta.url)));
 assert.equal(manifest.version,21);assert.ok(manifest.bytes<=350000);assert.ok(manifest.triangles>10000);
 assert.equal(visual.cars.length,1);assert.equal(cabin.name,'career-funicular');assert.equal(visual.wheels.length,4);
 assert.equal(visual.model.getObjectByName('career-locomotive'),undefined);assert.equal(visual.model.getObjectByName('career-coach'),undefined);
 assert.ok(cabin.getObjectByName('funicular-wedge-supports'));assert.ok(visual.chassis);
 const bounds=new THREE.Box3();cabin.updateWorldMatrix(true,true);cabin.traverse(object=>{if(!object.isMesh)return;const p=object.geometry.attributes.position;for(let i=0;i<p.count;i++)bounds.expandByPoint(cabin.worldToLocal(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(object.matrixWorld)));});
 assert.ok(bounds.min.x>=-1.102&&bounds.max.x<=1.102,`side envelope ${bounds.min.x}, ${bounds.max.x}`);
 assert.ok(bounds.min.z>=-2.502&&bounds.max.z<=2.502,`length envelope ${bounds.min.z}, ${bounds.max.z}`);
 assert.ok(manifest.doors.clearWidth>=1.2);close(manifest.doors.sillY,CAREER_TRAIN.floorY);
 const ray=new THREE.Raycaster();for(const side of[-1,1])for(const z of[-.55,0,.55])for(const y of[1.9,2.4,3.05]){
  const origin=cabin.localToWorld(new THREE.Vector3(side*1.35,y,z)),direction=new THREE.Vector3(-side,0,0).transformDirection(cabin.matrixWorld);ray.set(origin,direction);ray.far=.48;
  assert.equal(ray.intersectObject(cabin,true).length,0,`central door is obstructed at side ${side}, ${y}, ${z}`);
 }
});

test('V21 cabin, standing deck and passenger anchor stay horizontal while all four treads touch the inclined rails',async t=>{
 const{controller:c,visual:v,cabin}=await fixture(t);
 for(let d=c.minDistance;d<=c.maxDistance;d+=.37){
  c.distance=c.previousDistance=d;v.update(1);const pose=c.carPose(0),pitch=pose.trackPitch;
  close(cabin.rotation.x,0);close(v.mountPoint.rotation.x,0);close(v.chassis.rotation.x,pitch);
  const up=new THREE.Vector3(0,1,0).transformDirection(v.mountPoint.matrixWorld);assert.ok(up.distanceTo(new THREE.Vector3(0,1,0))<1e-7);
  for(const wheel of v.wheels){
   const center=wheel.object.position,contact=new THREE.Vector3(center.x,center.y-wheel.radius*Math.cos(pitch),center.z-wheel.radius*Math.sin(pitch));close(Math.abs(center.z),1.5);
   const pathDistance=d-contact.z/Math.cos(pitch),q=sampleTrainPath(c.path,pathDistance),gauge=Math.sign(center.x)*c.railway.train.gauge/2,h=Math.hypot(q.tangentX,q.tangentZ);
   const expected=c.worldPoint({x:q.x-q.tangentZ/h*gauge,y:q.y,z:q.z+q.tangentX/h*gauge}),world=cabin.localToWorld(contact);
   assert.ok(world.distanceTo(new THREE.Vector3(expected.x,expected.y,expected.z))<.001,'radial contact follows the real slope normal');
  }
 }
});

test('V21 glazing and roof skylight transmit the cabin view without opaque shadow casting',async t=>{
 const {cabin}=await fixture(t),glass=[];cabin.traverse(object=>{if(object.isMesh&&object.material.name==='career_train_glass')glass.push(object);});
 assert.ok(glass.length>=2);assert.ok(glass.some(mesh=>mesh.name.startsWith('funicular-arched-roof')),'observation skylight uses real glass geometry');
 for(const mesh of glass){assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);assert.equal(mesh.material.depthWrite,false);assert.ok(mesh.material.transparent&&mesh.material.opacity<.25);}
});

test('V21 signed wheel rotation reverses on the same fixed-heading cabin and remains unchanged through opaque relocation or model replacement',async t=>{
 const{controller:c,visual:v}=await fixture(t);c.board();c.continue();for(let n=0;n<90;n++)c.step(1/60);v.update(1);
 const forward=v.wheels[0].object.rotation.x,heading=c.yaw,anchor=v.mountPoint,avatar=new THREE.Group();anchor.add(avatar);assert.ok(forward<0);
 c.returnToHarbor();for(let n=0;n<180;n++)c.step(1/60);v.update(1);assert.ok(v.wheels[0].object.rotation.x>forward,'return motion reverses the wheel angle');close(c.yaw,heading);
 const phase=v.wheels[0].object.rotation.x;await v.bind(await model());assert.equal(v.mountPoint,anchor);assert.equal(avatar.parent,anchor);close(v.wheels[0].object.rotation.x,phase,1e-8);assert.equal(v.coupling.visible,false);
 c.passenger=false;c.parkAtStation('beaconfire');v.update(1);close(v.wheels[0].object.rotation.x,phase,1e-8);
});
