import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {applySunsetMaterials,releaseSunsetMaterials} from '../sources/world/sunset-materials.js';
import {SurfaceLibrary} from '../sources/world/surface-library.js';
import {CameraRig} from '../sources/core/camera.js';
import {islands,contentFocus} from '../sources/config.js';

const pavingNames=new Set(['estate_paving','estate_asphalt','campus_paving']);
const load=async(id,quality)=>{
 const bytes=await fs.readFile(new URL(`../static/models/${quality==='low'?'low/':''}${id}.glb`,import.meta.url));
 return(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
};
function geometryHash(geometry){
 const hash=createHash('sha256');
 for(const attribute of[geometry.index,...Object.values(geometry.attributes)].filter(Boolean))hash.update(Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));
 return hash.digest('hex');
}
function layeredSamples(model){
 const grass=model.getObjectByName('static_grass'),samples=new Map(),ray=new THREE.Raycaster();
 model.updateMatrixWorld(true);assert.ok(grass);
 model.traverse(mesh=>{
  if(!mesh.isMesh||!pavingNames.has(mesh.material.name)||samples.has(mesh.material.name))return;
  const position=mesh.geometry.getAttribute('position'),index=mesh.geometry.index;
  for(let n=0;n<(index?.count??position.count);n+=3){
   const vertices=[0,1,2].map(i=>new THREE.Vector3().fromBufferAttribute(position,index?index.getX(n+i):n+i).applyMatrix4(mesh.matrixWorld));
   if(vertices.some(p=>p.y<.86||p.y>1))continue;
   const paving=vertices[0].clone().add(vertices[1]).add(vertices[2]).divideScalar(3);
   ray.set(paving.clone().add(new THREE.Vector3(0,1,0)),new THREE.Vector3(0,-1,0));
   const hit=ray.intersectObject(grass,false)[0],gap=hit?paving.y-hit.point.y:Infinity;
   if(gap>.015&&gap<.06){samples.set(mesh.material.name,{paving,grass:hit.point,material:mesh.material});break;}
  }
 });
 return samples;
}

for(const id of['about','education'])for(const quality of['high','low'])test(`${id} ${quality}: paving bias preserves real geometry, source materials and texture-quality ownership`,async()=>{
 const model=await load(id,quality),before=[];
 model.traverse(mesh=>{if(mesh.isMesh)before.push({mesh,source:mesh.material,geometry:mesh.geometry,hash:geometryHash(mesh.geometry)});});
 applySunsetMaterials(model,id);
 const shared=new Map(),paving=[];
 for(const{mesh,source}of before){
  if(pavingNames.has(source.name)){
   assert.notEqual(mesh.material,source);assert.equal(source.polygonOffset,false);
   assert.equal(mesh.material.polygonOffset,true);assert.equal(mesh.material.polygonOffsetFactor,0);assert.equal(mesh.material.polygonOffsetUnits,-2);
   if(shared.has(source))assert.equal(mesh.material,shared.get(source));else shared.set(source,mesh.material);
   paving.push(mesh);
  }else{
   assert.equal(mesh.material.polygonOffset,source.polygonOffset,source.name);
   assert.equal(mesh.material.polygonOffsetUnits,source.polygonOffsetUnits,source.name);
  }
 }
 assert.ok(paving.length>0);
 const themed=paving.map(mesh=>mesh.material),library=new SurfaceLibrary({loader:{dispose(){}},fetchManifest:async()=>({qualities:{high:{surfaces:{}},low:{surfaces:{}}}})});
 library.bind(model,id);const bound=paving.map(mesh=>mesh.material);
 for(const next of['high','low','high']){
  await library.loadQuality(next);
  for(const[step,mesh]of paving.entries()){
   assert.equal(mesh.material,bound[step]);assert.equal(mesh.material.polygonOffset,true);assert.equal(mesh.material.polygonOffsetUnits,-2);
   assert.ok(mesh.material.color.equals(themed[step].color));
  }
 }
 for(const{mesh,geometry,hash}of before){assert.equal(mesh.geometry,geometry);assert.equal(geometryHash(mesh.geometry),hash);}
 library.release(model);for(const[step,mesh]of paving.entries())assert.equal(mesh.material,themed[step]);
 releaseSunsetMaterials(model);for(const{mesh,source}of before)assert.equal(mesh.material,source);
 library.dispose();
});

for(const id of['about','education'])test(`${id}: two depth steps separate actual grass/paving layers at all overview aspect ratios`,async()=>{
 const model=await load(id,'high');applySunsetMaterials(model,id);
 const samples=layeredSamples(model),island=islands.find(item=>item.id===id);
 assert.equal(samples.size,id==='about'?2:1,'test exercises each affected material on an actual ground triangle');
 const placement=new THREE.Matrix4().makeRotationY(island.rotation).setPosition(island.x,0,island.z),levels=2**24-1;
 for(const[width,height]of[[1440,900],[1920,1080],[390,844],[844,390]]){
  const camera=new THREE.PerspectiveCamera(28,width/height,.2,2000),rig=new CameraRig(camera,{zoom:1,walkZoom:1},width,height);
  rig.update(0,{position:{x:island.x,y:.85,z:island.z},focus:contentFocus(id)},true);
  // Exercise the raster bias by itself at the least precise authored near
  // plane; adaptive camera clipping provides additional separation at runtime.
  camera.near=.2;camera.updateProjectionMatrix();
  for(const[name,sample]of samples){
   const windowDepth=p=>(p.clone().applyMatrix4(placement).project(camera).z*.5+.5)*levels;
   const grass=windowDepth(sample.grass),paving=windowDepth(sample.paving),biased=paving+sample.material.polygonOffsetUnits;
   assert.ok(grass>paving,`${name}: authored paving is geometrically in front of grass`);
   assert.ok(grass-paving<3,`${name}: overview exposes the nearly coincident depth layers`);
   // Quantization phase varies as the camera moves by subpixels. Include a
   // complete depth-bin phase sweep rather than checking one lucky frame.
   for(let phase=0;phase<=1;phase+=.025)assert.ok(Math.round(grass+phase)-Math.round(biased+phase)>=2,`${name} ${width}×${height}: biased paving retains at least two depth bins`);
  }
 }
 releaseSunsetMaterials(model);
});

test('focus and studio report their own distance while restoring authored close-view clipping',()=>{
 const camera=new THREE.PerspectiveCamera(28,1440/900,.35,2000),rig=new CameraRig(camera,{zoom:1,walkZoom:1},1440,900),position={x:0,y:.85,z:0};
 for(const focus of[{x:0,z:0,camera:{distance:280,height:1,azimuth:Math.PI/4,elevation:.68}},{x:0,z:0,camera:{distance:24,height:1}},{boatStudio:true},null]){
  rig.update(0,{position,locomotion:'walking',focus},true);
  if(!focus?.camera?.distance||focus.camera.distance<45)assert.equal(camera.near,.35);
  assert.ok(Math.abs(rig.distance-rig.position.distanceTo(rig.target))<1e-9);
 }
});
