import * as THREE from 'three/webgpu';
import {pass, vec4, mix, uniform, uv, getViewPosition, renderOutput} from 'three/tsl';
import {ao} from 'three/addons/tsl/display/GTAONode.js';
import {fxaa} from 'three/addons/tsl/display/FXAANode.js';
import {SUN_DIRECTION, SUNSET} from './sunset-theme.js';

// Original fixed sunset radiance, shared by the visible sky and reflective materials.
// Latitude/longitude match Three's equirectUV convention; the bright source is
// at the exact same world direction as the directional sun and water glitter.
export function sunsetEnvironment(width=256,height=128){
 const data=new Float32Array(width*height*4),sun=new THREE.Vector3(...SUN_DIRECTION).normalize();
 const zenith=new THREE.Color(SUNSET.zenith),upper=new THREE.Color(SUNSET.upperSky),horizon=new THREE.Color(SUNSET.horizon),glow=new THREE.Color(SUNSET.horizonGlow),ground=new THREE.Color(SUNSET.ground),core=new THREE.Color(SUNSET.sunCore);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const latitude=(y/(height-1)-.5)*Math.PI,longitude=(x/width-.5)*Math.PI*2;
  const dy=Math.sin(latitude),dx=Math.cos(latitude)*Math.cos(longitude),dz=Math.cos(latitude)*Math.sin(longitude);
  const alignment=Math.max(0,dx*sun.x+dy*sun.y+dz*sun.z);
  const c=dy<0?ground.clone().lerp(horizon,Math.exp(dy*8)*.42):horizon.clone().lerp(upper,Math.min(1,dy*2.8)).lerp(zenith,Math.max(0,(dy-.32)/.68));
  const warmBand=Math.exp(-(((dy-.08)/.24)**2))*Math.pow(alignment,5);
  c.lerp(glow,warmBand*.68);
  // Long, sparse cloud strands; a continuous gradient remains dominant.
  const strands=Math.sin(longitude*5+dy*42)*Math.sin(longitude*11-dy*18);
  const cloud=Math.max(0,strands-.44)*Math.exp(-(((dy-.25)/.22)**2))*.25;
  c.lerp(new THREE.Color('#e9a4ad'),cloud);
  const corona=Math.pow(alignment,45)*1.8,disk=Math.pow(alignment,1600)*14;
  const i=(y*width+x)*4;data[i]=c.r*.8+core.r*(corona+disk);data[i+1]=c.g*.8+core.g*(corona+disk);data[i+2]=c.b*.8+core.b*(corona+disk);data[i+3]=1;
 }
 const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);
 texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.LinearSRGBColorSpace;texture.needsUpdate=true;return texture;
}
// Kept for the development model viewer and existing integrations.
export const daylightEnvironment=sunsetEnvironment;

export class BayLighting {
 constructor(scene,renderer,camera,quality){
  Object.assign(this,{scene,renderer,camera,quality});
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  this.fill=new THREE.HemisphereLight(SUNSET.fill,SUNSET.ground,1.15);scene.add(this.fill);
  // Broad sky bounce preserves faces and hull detail on the camera-facing side
  // of the sunset. It adds no competing shadow or specular sun disk.
  this.bounce=new THREE.DirectionalLight('#c8bbda',.85);scene.add(this.bounce,this.bounce.target);
  this.sun=new THREE.DirectionalLight(SUNSET.sun,3.6);this.sun.castShadow=true;
  this.sun.shadow.bias=-.00012;this.sun.shadow.normalBias=.025;this.sun.shadow.radius=2;
  Object.assign(this.sun.shadow.camera,{near:1,far:190});scene.add(this.sun,this.sun.target);
  this.sunDirection=new THREE.Vector3(...SUN_DIRECTION).normalize();
  this.environment=sunsetEnvironment();scene.environment=this.environment;scene.environmentIntensity=.7;
  scene.background=this.environment;scene.backgroundIntensity=.8;scene.backgroundBlurriness=.04;scene.fog=new THREE.Fog(SUNSET.fog,145,330);
  this.setQuality(quality);
 }
 setQuality(quality){
  this.quality=quality;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const size=quality==='low'?1024:2048;
  // ShadowNode owns the render target and resizes it on the next shadow pass.
  // Clearing light.shadow.map here leaves its cached target alive and untracked.
  if(this.sun.shadow.mapSize.x!==size){this.sun.shadow.mapSize.set(size,size);this.sun.shadow.needsUpdate=true;}
  this.scene.environmentIntensity=.7;
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
  this.sun.target.position.set(x,0,z);this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDirection,90);this.sun.target.updateMatrixWorld();
  this.bounce.target.position.set(x,0,z);this.bounce.position.set(x+40,45,z+40);this.bounce.target.updateMatrixWorld();
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
  catch(error){this.failed=true;this.disposePipeline();console.warn('Contact shading unavailable; sunset lighting retained.',error.message);this.renderer.render(this.scene,this.camera);}
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
 dispose(){this.disposePipeline();if(this.scene.environment===this.environment)this.scene.environment=null;if(this.scene.background===this.environment)this.scene.background=null;this.environment.dispose();this.sun.dispose();this.fill.dispose();this.bounce.dispose();this.scene.remove(this.fill,this.sun,this.sun.target,this.bounce,this.bounce.target);}
}
