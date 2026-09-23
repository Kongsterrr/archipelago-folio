import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {shoreDistance,coastlineData} from '../sources/world/bay-water.js';
import {daylightEnvironment,BayLighting} from '../sources/world/bay-lighting.js';
import {prepareBoatMaterials,BoatAppearance} from '../sources/world/boat-appearance.js';
import {SUN_DIRECTION} from '../sources/world/sunset-theme.js';

test('shallow-water depth follows rotated real shoreline and reef margins',()=>{
 const coasts=coastlineData([{x:10,z:-3,rotation:Math.PI/2,shore:[[-2,-1],[2,-1],[2,1],[-2,1]]}]);
 assert.equal(shoreDistance(10,-3,coasts),0);
 assert.ok(Math.abs(shoreDistance(14,-3,coasts)-3)<1e-8);
 assert.equal(shoreDistance(50,50,coasts),40);
 assert.equal(shoreDistance(22,0,coasts,[{x:22,z:0,r:3}]),0);
});
test('sunset environment has finite radiance and its brightest source aligns with the world sun',()=>{
 const width=256,height=128,t=daylightEnvironment(width,height),data=t.image.data;
 assert.ok([...data].every(Number.isFinite));assert.equal(data.length,width*height*4);
 let peak=0;for(let i=4;i<data.length;i+=4)if(data[i]>data[peak])peak=i;
 const x=peak/4%width,y=Math.floor(peak/4/width),latitude=(y/(height-1)-.5)*Math.PI,longitude=(x/width-.5)*Math.PI*2;
 const direction=new THREE.Vector3(Math.cos(latitude)*Math.cos(longitude),Math.sin(latitude),Math.cos(latitude)*Math.sin(longitude));
 assert.ok(direction.dot(new THREE.Vector3(...SUN_DIRECTION).normalize())>.999);
 assert.ok(data[peak]>5,'sun remains HDR');assert.ok(data[peak]>data[peak+2],'sun is warm');
 assert.equal(t.mapping,THREE.EquirectangularReflectionMapping);t.dispose();
});
test('low quality retains grounding shadows and lets ShadowNode resize its existing target',()=>{
 const scene=new THREE.Scene(),renderer={shadowMap:{}},camera=new THREE.PerspectiveCamera();
 const rig=new BayLighting(scene,renderer,camera,'high');let disposed=0;
 rig.sun.shadow.map={dispose(){disposed++;}};rig.setQuality('low');
 assert.equal(disposed,0);assert.equal(renderer.shadowMap.enabled,true);assert.equal(rig.sun.shadow.mapSize.x,1024);assert.equal(rig.sun.shadow.needsUpdate,true);
 rig.update({x:15,z:2},true);assert.equal(rig.sun.shadow.camera.right,14);assert.ok(Number.isFinite(rig.sun.position.x));rig.dispose();assert.equal(disposed,1);
});
test('quality round trips retain one actual postprocessing graph and final disposal frees its hidden resources',()=>{
 const scene=new THREE.Scene(),rig=new BayLighting(scene,{shadowMap:{}},new THREE.PerspectiveCamera(),'low');
 assert.equal(rig.pipeline,undefined,'starting low does not allocate postprocessing');
 rig.setQuality('high');rig.createPipeline();
 const pipeline=rig.pipeline,scenePass=rig.scenePass,antialias=rig.antialias,ao=rig.ao,rtt=antialias.textureNode;
 assert.ok(rtt.isRTTNode,'FXAA owns the actual convertToTexture render target');
 const resources=[pipeline._quadMesh.material,scenePass.renderTarget,rtt.renderTarget,rtt._quadMesh.material,ao._noiseNode.value,ao._aoRenderTarget,ao._material];
 const released=resources.map(()=>0);
 resources.forEach((resource,index)=>resource.addEventListener('dispose',()=>released[index]++));
 for(let n=0;n<10;n++){
  rig.setQuality('low');rig.setQuality('high');
  assert.equal(rig.pipeline,pipeline);assert.equal(rig.scenePass,scenePass);assert.equal(rig.antialias,antialias);assert.equal(rig.ao,ao);
 }
 assert.ok(released.every(count=>count===0),'switches must not destroy backend graph bindings');
 rig.dispose();
 assert.deepEqual(released,resources.map(()=>1),'includes hidden FXAA RTT and GTAO noise allocations');
 assert.equal(scene.environment,null);assert.equal(scene.children.length,0);assert.equal(rig.pipeline,null);
});
test('hero boat physical surfaces retain livery identities and clear windscreen',()=>{
 const group=new THREE.Group();for(const name of ['hullOrange','hullIvory','satinMetal','windshield']){const m=new THREE.MeshStandardMaterial();m.name=name;group.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),m));}
 prepareBoatMaterials(group);const appearance=new BoatAppearance({livery:'marina'});appearance.bind(group);
 const hull=group.children[0].material,glass=group.children[3].material;
 assert.ok(hull.isMeshPhysicalMaterial);assert.ok(hull.clearcoat>0);assert.equal(glass.depthWrite,false);assert.ok(glass.opacity<.5);
 const original=hull.color.getHex();appearance.setLivery('sunset');assert.notEqual(hull.color.getHex(),original);
 group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});
