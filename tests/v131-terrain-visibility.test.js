import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Raycaster,Vector3} from 'three';
import {highlandsVisibleTerrain} from '../scripts/lib/projects-highlands.mjs';

const layout=JSON.parse(fs.readFileSync(new URL('../static/models/walk-layout.json',import.meta.url))).islands.find(i=>i.id==='projects');
const visible=highlandsVisibleTerrain(layout.terrain,layout.dock);
const triangle=(vertices,indices,n)=>indices.slice(n,n+3).map(j=>vertices.slice(j*3,j*3+3));
const slope=([a,b,c])=>{
 const u=new Vector3(...b).sub(new Vector3(...a)),v=new Vector3(...c).sub(new Vector3(...a)),n=u.cross(v).normalize();
 return Math.atan2(Math.hypot(n.x,n.z),n.y);
};

test('visible grassy land never disguises a quad-blocking slope as level ground',()=>{
 for(let i=0;i<visible.grass.length;i+=3)assert.ok(slope(triangle(visible.vertices,visible.grass,i))<=Math.PI/15+1.1e-6);
 const moderate=[];
 for(let i=0;i<layout.terrain.indices.length;i+=3){const p=triangle(layout.terrain.vertices,layout.terrain.indices,i),s=slope(p);if(s>Math.PI/15+.001&&s<Math.acos(.92)-.001)moderate.push(p);}
 assert.ok(moderate.length>450,'regression covers the broad previously invisible 12–23 degree banks');
});

await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
for(const quality of['high','low'])test(`${quality}: exported Projects keeps one surface at the bridge end and opaque rocky banks`,async()=>{
 const url=new URL(`../static/models/${quality==='low'?'low/':''}projects.glb`,import.meta.url),document=await io.read(fileURLToPath(url));
 assert.ok(!document.getRoot().listNodes().some(n=>n.getName().startsWith('occluder_highlands_peak')),'collidable mountain peaks cannot fade out');
 const rockPrimitives=document.getRoot().listMeshes().flatMap(mesh=>mesh.listPrimitives()).filter(p=>['highlandsRock','highlandsCliff'].includes(p.getMaterial()?.getName()));
 for(const primitive of rockPrimitives){
  const uv=primitive.getAttribute('TEXCOORD_0').getArray();
  assert.ok(Math.max(...uv)-Math.min(...uv)>8,'large rock banks use metre-scale repeating UVs, not one island-sized texture');
 }
 for(const name of['highlandsStrataDark','highlandsStrataLight'])assert.ok(document.getRoot().listMaterials().some(m=>m.getName()===name),'actual terrain-following rock strata are visible in both qualities');
 for(const material of document.getRoot().listMaterials()){
  material.setBaseColorTexture(null);material.setNormalTexture(null);material.setMetallicRoughnessTexture(null);material.setOcclusionTexture(null);material.setEmissiveTexture(null);
  if(['highlandsRock','highlandsCliff'].includes(material.getName()))assert.equal(material.getAlphaMode(),'OPAQUE');
 }
 for(const texture of[...document.getRoot().listTextures()])texture.dispose();
 for(const extension of[...document.getRoot().listExtensionsUsed()])if(extension.extensionName==='EXT_meshopt_compression')extension.dispose();
 const bytes=await io.writeBinary(document),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 gltf.scene.updateMatrixWorld(true);
 const ray=new Raycaster();
 // Plank centers at the landward end lie inside both the old terrain and pier.
 // Every sample must hit wood, and no coplanar terrain triangle may remain.
 for(const z of[27.70,28.12,28.54])for(const x of[-1.0,-.3,.3,1.0]){
  ray.set(new Vector3(x,layout.groundY+.12,z),new Vector3(0,-1,0));
  const hits=ray.intersectObject(gltf.scene,true).filter(hit=>Math.abs(hit.point.y-layout.groundY)<.015);
  assert.ok(hits.some(hit=>hit.object.material.name==='wood'),`wooden deck missing at ${x},${z}`);
  assert.ok(hits.every(hit=>hit.object.material.name==='wood'),`coplanar ground still flickers through deck at ${x},${z}`);
 }
 const banks=[];
 for(let i=0;i<layout.terrain.indices.length;i+=3){const p=triangle(layout.terrain.vertices,layout.terrain.indices,i),s=slope(p);if(s>Math.PI/15+.003&&s<Math.acos(.92)-.003)banks.push(p);}
 let checked=0;
 for(let i=0;i<banks.length;i+=23){
  const p=banks[i].reduce((a,p)=>a.add(new Vector3(...p)),new Vector3()).multiplyScalar(1/3);
  ray.set(new Vector3(p.x,p.y+.04,p.z),new Vector3(0,-1,0));
  const hits=ray.intersectObject(gltf.scene,true).filter(hit=>Math.abs(hit.point.y-p.y)<.005);
  assert.ok(hits.some(hit=>hit.object.material.name==='highlandsRock'),`12–23 degree bank is not visibly rock at ${p.x},${p.z}`);checked++;
 }
 assert.ok(checked>15);
 assert.ok(document.getRoot().listMaterials().some(m=>m.getName()==='highlandsTrailEdge'),'road shoulders are retained in both qualities');
});
