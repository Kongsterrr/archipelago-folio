import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {BayLighting} from '../sources/world/bay-lighting.js';

// Public renderer state accessors are exercised through Three's own save and
// restore helpers. No GPU is needed to inject an exception inside a pass.
function rendererFixture(){
 const renderer={shadowMap:{},xr:{enabled:true},transparent:true,opaque:true,contextNode:{name:'world-context'},toneMappingExposure:1,outputColorSpace:THREE.SRGBColorSpace,autoClear:false,
  target:null,cubeFace:0,mipmap:0,mrt:null,pixelRatio:1.5,clearColor:new THREE.Color('#123456'),clearAlpha:.4,scissorTest:true,renderFunction:()=>{},
  _callDepth:0,_currentRenderContext:null,_currentRenderObjectFunction:null,_handleObjectFunction:()=>{},_nodes:{nodeFrame:{frameId:40,renderId:0}},info:{calls:100},
  getRenderTarget(){return this.target;},setRenderTarget(target,cubeFace=0,mipmap=0){Object.assign(this,{target,cubeFace,mipmap});},
  getActiveCubeFace(){return this.cubeFace;},getActiveMipmapLevel(){return this.mipmap;},
  getRenderObjectFunction(){return this.renderFunction;},setRenderObjectFunction(value){this.renderFunction=value;},
  getPixelRatio(){return this.pixelRatio;},setPixelRatio(value){this.pixelRatio=value;},
  getMRT(){return this.mrt;},setMRT(value){this.mrt=value;},
  getClearColor(target){return target.copy(this.clearColor);},getClearAlpha(){return this.clearAlpha;},setClearColor(color,alpha){this.clearColor.set(color);this.clearAlpha=alpha;},
  getScissorTest(){return this.scissorTest;},setScissorTest(value){this.scissorTest=value;},
 };
 return renderer;
}

function snapshot(renderer,scene,camera){
 return{target:renderer.target,cubeFace:renderer.cubeFace,mipmap:renderer.mipmap,mrt:renderer.mrt,pixelRatio:renderer.pixelRatio,toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure,colorSpace:renderer.outputColorSpace,clearColor:renderer.clearColor.getHex(),clearAlpha:renderer.clearAlpha,autoClear:renderer.autoClear,scissor:renderer.scissorTest,renderFunction:renderer.renderFunction,xr:renderer.xr.enabled,transparent:renderer.transparent,opaque:renderer.opaque,context:renderer.contextNode,callDepth:renderer._callDepth,renderContext:renderer._currentRenderContext,renderObject:renderer._currentRenderObjectFunction,handleObject:renderer._handleObjectFunction,renderId:renderer._nodes.nodeFrame.renderId,sceneName:scene.name,override:scene.overrideMaterial,layers:camera.layers.mask};
}

for(const target of [null,{name:'caller-output'}])test(`failed nested postprocessing restores ${target?'the caller output':'the canvas'} before fallback and permits a high-quality retry`,t=>{
 t.mock.method(console,'warn',()=>{});
 const renderer=rendererFixture(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),rig=new BayLighting(scene,renderer,camera,'high');
 renderer.setRenderTarget(target,2,1);scene.name='Bay';camera.layers.set(2);
 const original=snapshot(renderer,scene,camera);let fallback=0,disposed=0,highFrames=0;
 renderer.render=(renderScene,renderCamera)=>{fallback++;assert.equal(renderScene,scene);assert.equal(renderCamera,camera);assert.deepEqual(snapshot(renderer,scene,camera),original,'fallback must not draw into the abandoned pass target');};
 rig.pipeline={dispose(){disposed++;},render(){
  renderer.setRenderTarget({name:'incomplete-fxaa-target'},5,3);renderer.setMRT({});renderer.setRenderObjectFunction(()=>{});renderer.setPixelRatio(.5);renderer.setClearColor('#ffffff',1);renderer.setScissorTest(false);
  renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=.2;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.autoClear=true;renderer.xr.enabled=false;renderer.transparent=false;renderer.opaque=false;renderer.contextNode={};
  renderer._callDepth=3;renderer._currentRenderContext={};renderer._currentRenderObjectFunction=()=>{};renderer._handleObjectFunction=()=>{};renderer._nodes.nodeFrame.renderId=103;renderer.info.calls=103;
  scene.name='offscreen';scene.overrideMaterial={};camera.layers.mask=0;
  throw new Error('transient nested pass failure');
 }};
 rig.render();assert.equal(fallback,1);assert.equal(disposed,1);assert.equal(rig.failed,true);assert.equal(rig.pipeline,null);
 assert.equal(renderer.info.calls,103,'cumulative render IDs must never rewind');assert.equal(renderer._nodes.nodeFrame.frameId,40);
 rig.render();assert.equal(fallback,2,'subsequent frames remain visible after failure');
 rig.setQuality('low');rig.render();assert.equal(fallback,3);
 rig.createPipeline=()=>{rig.pipeline={render(){highFrames++;},dispose(){}};};
 rig.setQuality('high');assert.equal(rig.failed,false);rig.render();rig.render();
 assert.equal(highFrames,2,'a deliberate high-quality retry runs effects again');assert.equal(fallback,3);assert.equal(rig.sun.shadow.mapSize.x,2048);
 rig.dispose();
});

test('successful high-low-high renders keep the same effects graph and all lighting controls',()=>{
 const renderer=rendererFixture(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),rig=new BayLighting(scene,renderer,camera,'high');
 let effects=0,direct=0,disposed=0;const pipeline={render(){effects++;},dispose(){disposed++;}};rig.pipeline=pipeline;renderer.render=()=>{direct++;};
 rig.update({x:12,y:21.55,z:8},true);const targetY=rig.sun.target.position.y,bias=rig.sun.shadow.normalBias;
 rig.render();rig.setQuality('low');rig.render();rig.setQuality('high');rig.render();
 assert.equal(rig.pipeline,pipeline);assert.equal(disposed,0);assert.equal(effects,2);assert.equal(direct,1);
 assert.equal(rig.sun.target.position.y,targetY);assert.equal(rig.sun.shadow.normalBias,bias);assert.ok(bias>=.025);assert.ok(targetY>21);
 assert.equal(renderer.shadowMap.enabled,true);assert.equal(rig.failed,false);rig.dispose();assert.equal(disposed,1);
});
