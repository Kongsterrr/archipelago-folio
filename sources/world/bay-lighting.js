import * as THREE from 'three/webgpu';
import {pass, vec4, mix, uniform, uv, getViewPosition, renderOutput} from 'three/tsl';
import {ao} from 'three/addons/tsl/display/GTAONode.js';
import {fxaa} from 'three/addons/tsl/display/FXAANode.js';

// One authored daylight rig for the whole bay. The small generated environment
// supplies broad sky reflections without a network HDR or a second scene render.
export function daylightEnvironment(width=256,height=128){
 const data=new Float32Array(width*height*4);
 const sky=new THREE.Color('#a9d8e6'),horizon=new THREE.Color('#f9ead1'),ground=new THREE.Color('#547d70');
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const v=y/(height-1),c=v<.5?ground.clone().lerp(horizon,Math.pow(v*2,3)):horizon.clone().lerp(sky,Math.pow((v-.5)*2,.6));
  const softbox=Math.exp(-((x/width-.32)**2/.014+(v-.70)**2/.012));
  const i=(y*width+x)*4;data[i]=c.r*.8+softbox*1.8;data[i+1]=c.g*.8+softbox*1.55;data[i+2]=c.b*.8+softbox*1.2;data[i+3]=1;
 }
 const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);
 texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.LinearSRGBColorSpace;texture.needsUpdate=true;return texture;
}

export class BayLighting {
 constructor(scene,renderer,camera,quality){
  Object.assign(this,{scene,renderer,camera,quality});
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  this.fill=new THREE.HemisphereLight('#e8f3ed','#9aa383',.9);scene.add(this.fill);
  this.sun=new THREE.DirectionalLight('#fff0d5',3.25);this.sun.castShadow=true;
  this.sun.shadow.bias=-.00012;this.sun.shadow.normalBias=.025;this.sun.shadow.radius=2;
  Object.assign(this.sun.shadow.camera,{near:1,far:145});scene.add(this.sun,this.sun.target);
  this.environment=daylightEnvironment();scene.environment=this.environment;scene.environmentIntensity=.7;
  scene.background=new THREE.Color('#69b5c0');scene.fog=new THREE.Fog('#a4d5d0',145,330);
  this.setQuality(quality);
 }
 setQuality(quality){
  this.quality=quality;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const size=quality==='low'?1024:2048;
  // ShadowNode owns the render target and resizes it on the next shadow pass.
  // Clearing light.shadow.map here leaves its cached target alive and untracked.
  if(this.sun.shadow.mapSize.x!==size){this.sun.shadow.mapSize.set(size,size);this.sun.shadow.needsUpdate=true;}
  this.scene.environmentIntensity=quality==='low'?.55:.7;
  // Keep one lazy pipeline for this renderer's lifetime. Rebuilding an already
  // rendered PassNode graph can reuse stale backend bindings in r183, producing
  // a blank composite after rapid switches. Low quality bypasses it entirely;
  // its bounded targets are retained only if high quality was used previously.
 }
 update(p,walking,distance=30){
  const extent=walking?14:Math.max(26,Math.min(64,distance*.75));
  const c=this.sun.shadow.camera;
  if(c.right!==extent){Object.assign(c,{left:-extent,right:extent,top:extent,bottom:-extent});c.updateProjectionMatrix();}
  // Snap the shadow origin to its texel spacing to keep tiny seams stable.
  const texel=extent*2/this.sun.shadow.mapSize.x,x=Math.round(p.x/texel)*texel,z=Math.round(p.z/texel)*texel;
  this.sun.position.set(x-28,55,z+24);this.sun.target.position.set(x,0,z);this.sun.target.updateMatrixWorld();
 }
 createPipeline(){
  this.scenePass=pass(this.scene,this.camera,{samples:0});
  // Reconstruct normals from opaque depth: glass and sprites keep their normal
  // alpha blending, without a second normal render attachment.
  const color=this.scenePass.getTextureNode('output'),depth=this.scenePass.getTextureNode('depth');
  const viewPosition=getViewPosition(uv(),depth,uniform(this.camera.projectionMatrixInverse));
  const worldHeight=uniform(this.camera.matrixWorld).mul(vec4(viewPosition,1)).y;
  const mask=worldHeight.greaterThan(.12);
  this.ao=ao(depth,null,this.camera);this.ao.resolutionScale=.5;
  this.ao.radius.value=.42;this.ao.thickness.value=.65;this.ao.distanceExponent.value=1.8;
  this.pipeline=new THREE.RenderPipeline(this.renderer);
  const shaded=vec4(color.rgb.mul(mix(1,this.ao.getTextureNode().r,mask.select(.48,0))),color.a);
  this.antialias=fxaa(renderOutput(shaded,THREE.ACESFilmicToneMapping,THREE.SRGBColorSpace));
  this.pipeline.outputNode=this.antialias;this.pipeline.outputColorTransform=false;
 }
 render(){
  if(this.quality==='low'||this.failed){this.renderer.render(this.scene,this.camera);return;}
  try{if(!this.pipeline)this.createPipeline();this.pipeline.render();}
  catch(error){this.failed=true;this.disposePipeline();console.warn('Contact shading unavailable; daylight retained.',error.message);this.renderer.render(this.scene,this.camera);}
 }
 disposePipeline(){
  this.pipeline?.dispose();this.scenePass?.dispose();
  // In Three r183 FXAA's convertToTexture creates an RTTNode whose inherited
  // dispose only dispatches an event. GTAO also leaves its noise texture alive.
  // These are owned exclusively by this pipeline, so release them explicitly.
  const rtt=this.antialias?.textureNode;
  if(rtt?.isRTTNode){rtt.renderTarget.dispose();rtt._quadMesh?.material.dispose();rtt.dispose();}
  this.ao?._noiseNode?.value.dispose();this.ao?.dispose();this.antialias?.dispose();
  this.pipeline=this.scenePass=this.ao=this.antialias=null;
 }
 dispose(){this.disposePipeline();if(this.scene.environment===this.environment)this.scene.environment=null;this.environment.dispose();this.sun.dispose();this.fill.dispose();this.scene.remove(this.fill,this.sun,this.sun.target);}
}
