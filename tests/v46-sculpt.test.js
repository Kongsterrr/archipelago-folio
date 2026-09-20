import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {measureV46Geometry} from '../scripts/jack-geometry-metrics.mjs';
import {createFaceGeometry,createSneakerUpper} from '../scripts/jack-shapes.mjs';
import {CHARACTER} from '../sources/core/character.js';

const bytes=await fs.readFile(new URL('../static/models/jack.glb',import.meta.url));
const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const mixer=new THREE.AnimationMixer(gltf.scene);mixer.clipAction(gltf.animations.find(c=>c.name==='idle')).play();mixer.setTime(0);
const sculpt=measureV46Geometry(gltf.scene);

test('V4.6 decoded jacket hem to sole is 29–32% of actual standing height',()=>{
 assert.ok(sculpt.hemToFloorFraction>=.29&&sculpt.hemToFloorFraction<=.32,`${sculpt.hemToFloorFraction}`);
 assert.ok(Math.abs(sculpt.height-1.20)<.003);
 assert.ok(Math.abs(2*(CHARACTER.radius+CHARACTER.halfHeight)-CHARACTER.height)<1e-9);
 assert.ok(sculpt.height-CHARACTER.height>.04&&sculpt.height-CHARACTER.height<.08);
});

test('V4.6 actual facial skin has oval temples, cheek volume and a smaller jaw',()=>{
 assert.ok(sculpt.face.widthHeight>.90&&sculpt.face.widthHeight<.99);
 const at=t=>sculpt.face.slices.find(s=>s.t===t);
 assert.ok(at(.2).width/at(.45).width<.79,'jaw narrower than the cheek band');
 assert.ok(at(.85).width<at(.6).width,'temples turn toward the crown');
 assert.ok(at(.15).frontZ-at(.6).frontZ>.035,'chin retreats from the forehead/cheek profile');
 assert.ok(sculpt.face.mainTriangles>1000,'measure the connected face, not an eye or nose primitive');
});

test('V4.6 decoded trousers connect pelvis, crotch and both legs in one surface',()=>{
 const main=sculpt.pants.components[0];
 assert.ok(main.triangles/sculpt.pants.totalTriangles>.93);
 for(const name of ['Hips','LeftUpLeg','RightUpLeg','LeftLeg','RightLeg'])assert.ok(main.joints.includes(name),name);
});

for(const [name,make]of [['face',createFaceGeometry],['sneaker upper',createSneakerUpper]])test(`V4.6 ${name} closes its poles without inverted faces or zero normals`,()=>{
 const g=make(),p=g.getAttribute('position'),n=g.getAttribute('normal'),ix=g.index,edges=new Map();
 for(let i=0;i<ix.count;i+=3){
  const ids=[ix.getX(i),ix.getX(i+1),ix.getX(i+2)],v=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j));
  const face=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));assert.ok(face.lengthSq()>1e-18);
  const normal=ids.reduce((sum,j)=>sum.add(new THREE.Vector3().fromBufferAttribute(n,j)),new THREE.Vector3());
  assert.ok(face.dot(normal)>0,'outward triangle and vertex normals agree');
  for(let j=0;j<3;j++){const key=[ids[j],ids[(j+1)%3]].sort((a,b)=>a-b).join(':');edges.set(key,(edges.get(key)||0)+1);}
 }
 for(let i=0;i<n.count;i++)assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(n,i).length()-1)<1e-5);
 assert.ok([...edges.values()].every(count=>count===2),'one closed surface with no split side seam');g.dispose();
});
