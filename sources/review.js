// Development-only review entry; Vite's production input remains index.html.
import * as THREE from 'three/webgpu';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {SurfaceLibrary} from './world/surface-library.js';
import {daylightEnvironment} from './world/bay-lighting.js';
import {applyJackHairSurface} from './world/jack-hair-surface.js';
import {prepareBoatMaterials,BoatAppearance} from './world/boat-appearance.js';
import {JACK_ASSET_URL} from './world/jack-asset.js';
import {JackAvatar} from './world/jack.js';
import {addQuadRiderSupports} from './world/quad-rider-pose.js';
const params=new URLSearchParams(location.search),kind=['boat','quad-bike','harbor','about','experience','projects','education'].includes(params.get('model'))?params.get('model'):'jack',clay=params.has('clay');
const canvas=document.querySelector('canvas'),renderer=new THREE.WebGPURenderer({canvas,antialias:true,forceWebGL:params.has('webgl')});await renderer.init();
renderer.setPixelRatio(1.5);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),gltf=await loader.loadAsync(kind==='jack'&&!params.has('legacy')?JACK_ASSET_URL:`/models/${kind}.glb?v=${kind==='jack'?8:kind==='quad-bike'?2:11}`),surfaces=new SurfaceLibrary({renderer});
const environment=daylightEnvironment();const views=[];
const riderReview=kind==='quad-bike'&&params.has('rider');
const riderGLTF=riderReview?await loader.loadAsync(JACK_ASSET_URL):null;
for(let index=0;index<3;index++){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#eee9df');scene.environment=environment;scene.environmentIntensity=.7;
 let model=clone(gltf.scene);if(kind==='jack'){applyJackHairSurface(model);const mixer=new THREE.AnimationMixer(model),clip=gltf.animations.find(a=>a.name===params.get('pose'))||gltf.animations.find(a=>a.name==='idle'),time=Number(params.get('time')||0);mixer.clipAction(clip).play();mixer.setTime(Number.isFinite(time)?THREE.MathUtils.clamp(time,0,clip.duration):0);model.traverse(o=>{if(o.isBone)o.quaternion.normalize();});}
 if(kind==='quad-bike'){
   if(!riderReview)model.rotation.y=Math.PI;
   const angle=Number(params.get('wheelAngle')||0),steer=Number(params.get('wheelSteer')||0);
   model.traverse(o=>{if(/^quad-wheel-(front|rear)-(left|right)$/.test(o.name)){o.rotation.order='YXZ';o.rotation.x=Number.isFinite(angle)?angle:0;if(o.name.includes('front'))o.rotation.y=Number.isFinite(steer)?steer:0;}});
 }
 if(kind==='boat')prepareBoatMaterials(model);
 if(clay)model.traverse(o=>{if(o.isMesh)o.material=new THREE.MeshStandardMaterial({color:'#bcb7ad',roughness:.85});});else surfaces.bind(model,kind);
 if(kind==='boat'&&!clay)new BoatAppearance({livery:'marina'}).bind(model);
 model.traverse(o=>{if(o.isMesh){o.castShadow=!o.material.transparent;o.receiveShadow=true;}});scene.add(model);
 if(riderReview){
   const bikeModel=model,group=new THREE.Group(),mountPoint=new THREE.Group();
   scene.remove(model);scene.add(group);group.add(bikeModel,mountPoint);bikeModel.scale.setScalar(1.65);bikeModel.rotation.y=Math.PI;
   addQuadRiderSupports(group);
   const quadBike={group,mountPoint,position:{x:0,y:0,z:0}};
   const avatar=new JackAvatar(scene,{loadAsync:async()=>({scene:clone(riderGLTF.scene),animations:riderGLTF.animations})});
   await avatar.load();
   avatar.update(0,{player:{onLand:true,ridingQuad:true},quadBike,character:{position:{x:0,y:0,z:0}},alpha:1,reduced:true,frozen:false});
   if(clay)avatar.model.traverse(o=>{if(o.isMesh)o.material=new THREE.MeshStandardMaterial({color:'#bcb7ad',roughness:.85});});
   group.userData.contacts=avatar.quadPose.contacts;model=group;
 }

 const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:'#eee9df',roughness:.9}));floor.position.y=bounds.min.y-.007;floor.receiveShadow=true;scene.add(floor);
 scene.add(new THREE.HemisphereLight('#e8f3ed','#aaa28b',.9));const sun=new THREE.DirectionalLight('#fff0d5',3.25);sun.position.set(-3,6,-4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.009;sun.shadow.bias=-.0001;const extent=Math.max(2,size.length());Object.assign(sun.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:.1,far:500});scene.add(sun);
 const camera=new THREE.PerspectiveCamera(28,1,.01,1000);const directions=kind==='jack'||riderReview?[new THREE.Vector3(0,.02,-1),new THREE.Vector3(.7,.13,-1),new THREE.Vector3(1,.02,-.04)]:[new THREE.Vector3(0,.8,-1),new THREE.Vector3(.8,.8,-1),new THREE.Vector3(1,.6,0)];
 views.push({scene,camera,center,size,direction:directions[index].normalize()});
}
if(!clay)await surfaces.loadQuality('high');
function render(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);renderer.setScissorTest(true);views.forEach((v,n)=>{v.camera.aspect=(w/3)/h;v.camera.updateProjectionMatrix();const distance=(kind==='jack'||riderReview?Math.max(v.size.y,v.size.x*1.15):v.size.length())*.62/Math.tan(THREE.MathUtils.degToRad(14))/Math.min(1,v.camera.aspect);v.camera.position.copy(v.center).addScaledVector(v.direction,distance);v.camera.lookAt(v.center);renderer.setViewport(n*w/3,0,w/3,h);renderer.setScissor(n*w/3,0,w/3,h);renderer.render(v.scene,v.camera);});renderer.setScissorTest(false);}
renderer.setAnimationLoop(render);document.querySelector('h1').textContent=`${kind==='jack'?(params.has('legacy')?'V8 · ORIGINAL':'V9 · IMPORTED'):['about','experience','projects','education'].includes(kind)?'V11':kind==='quad-bike'?'V12.1':'V9'} · ${riderReview?'QUAD + ACTUAL JACK':kind.toUpperCase()} / ${clay?'CLAY':'ACTUAL MATERIALS'}`;document.querySelector('#state').textContent=`Actual runtime GLB · ${clay?'Neutral clay':kind==='jack'&&!params.has('legacy')?'User-supplied mesh and texture · local rig':surfaces.stats().status+' · shared game surfaces'}${riderReview?' · Palms fitted to actual handlebar grips':''} · Web${renderer.backend.isWebGPUBackend?'GPU':'GL2'}`;
document.querySelector('#capture').onclick=async()=>{render();const blob=await new Promise(resolve=>canvas.toBlob(resolve));const response=await fetch(`http://127.0.0.1:5174/capture/${kind}-${clay?'clay':'materials'}.png`,{method:'POST',body:blob});document.querySelector('#state').textContent=response.ok?'Actual render saved.':'Capture server unavailable.';};
