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
import {CareerTrainController} from './core/career-train.js';
import {careerRailway} from '../scripts/lib/career-railway-layout.mjs';
import {CareerTrainVisual} from './world/career-train.js';
import {JackAvatar} from './world/jack.js';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import {GarageCarController,GARAGE_CARS,garageCarAssetURL} from './core/garage-car.js';
import {BicycleController} from './core/bicycle.js';
import {addQuadRiderSupports} from './world/quad-rider-pose.js';
const params=new URLSearchParams(location.search),kind=['career-train','car-911','car-g63','car-ferrari','car-raptor','bicycle','boat','quad-bike','harbor','about','experience','projects','education'].includes(params.get('model'))?params.get('model'):'jack',clay=params.has('clay');
const canvas=document.querySelector('canvas'),renderer=new THREE.WebGPURenderer({canvas,antialias:true,forceWebGL:params.has('webgl')});await renderer.init();
renderer.setPixelRatio(1.5);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),gltf=await loader.loadAsync(kind.startsWith('car-')?garageCarAssetURL(kind.slice(4),params.has('low')?'low':'high'):kind==='jack'&&!params.has('legacy')?JACK_ASSET_URL:`/models/${params.has('low')&&kind.startsWith('car-')?'low/':''}${kind}.glb?v=${kind.startsWith('car-')?'15.1.1':kind==='career-train'?'21':kind==='bicycle'?'14.2.3':kind==='about'?'15':kind==='education'?'14.3':kind==='jack'?8:kind==='quad-bike'?2:11}`),surfaces=new SurfaceLibrary({renderer});
const environment=daylightEnvironment();const views=[],reviewCars=[];let spinWheels=false,spinPhase=0,lastSpinTime=performance.now();
const carReview=kind.startsWith('car-');const wheelDetail=carReview&&params.get('detail')==='wheel';
const riderReview=['career-train','car-911','car-g63','car-ferrari','car-raptor','quad-bike','bicycle'].includes(kind)&&params.has('rider');
if(kind==='bicycle'||carReview)await RAPIER.init();
const railReview=kind==='career-train'?careerRailway():null;
const riderGLTF=riderReview?await loader.loadAsync(JACK_ASSET_URL):null;
for(let index=0;index<3;index++){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#eee9df');scene.environment=environment;scene.environmentIntensity=.7;
 let model=clone(gltf.scene);
 if(kind==='education'&&params.get('detail')==='walking-to-sky'){const sculpture=model.getObjectByName('campus_walking_to_sky');if(!sculpture)throw Error('Walking to the Sky model is missing');model=clone(sculpture);}
 if(kind==='jack'){applyJackHairSurface(model);const mixer=new THREE.AnimationMixer(model),clip=gltf.animations.find(a=>a.name===params.get('pose'))||gltf.animations.find(a=>a.name==='idle'),time=Number(params.get('time')||0);mixer.clipAction(clip).play();mixer.setTime(Number.isFinite(time)?THREE.MathUtils.clamp(time,0,clip.duration):0);model.traverse(o=>{if(o.isBone)o.quaternion.normalize();});}
 if(kind==='quad-bike'){
   if(!riderReview)model.rotation.y=Math.PI;
   const angle=Number(params.get('wheelAngle')||0),steer=Number(params.get('wheelSteer')||0);
   model.traverse(o=>{if(/^quad-wheel-(front|rear)-(left|right)$/.test(o.name)){o.rotation.order='YXZ';o.rotation.x=Number.isFinite(angle)?angle:0;if(o.name.includes('front'))o.rotation.y=Number.isFinite(steer)?steer:0;}});
 }
 if(kind==='boat')prepareBoatMaterials(model);
 if(clay)model.traverse(o=>{if(o.isMesh)o.material=new THREE.MeshStandardMaterial({color:'#bcb7ad',roughness:.85});});else surfaces.bind(model,kind);
 if(kind==='boat'&&!clay)new BoatAppearance({livery:'marina'}).bind(model);
 model.traverse(o=>{if(o.isMesh){o.castShadow=!o.material.transparent;o.receiveShadow=true;}});scene.add(model);
 if(riderReview&&kind==='quad-bike'){
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

 if(kind==='career-train'&&railReview){
  const train=new CareerTrainController(railReview);const visual=new CareerTrainVisual(scene,train);scene.remove(model);visual.bind(model);
  if(riderReview){const avatar=new JackAvatar(scene,{loadAsync:async()=>({scene:clone(riderGLTF.scene),animations:riderGLTF.animations})});await avatar.load();avatar.update(0,{player:{onLand:true,ridingTrain:true,train},trainVisual:visual,character:{position:train.position},alpha:1,reduced:true,frozen:false});}
  scene.updateMatrixWorld(true);
  const actualBounds=new THREE.Box3();for(const car of visual.cars)actualBounds.expandByObject(car,true);if(riderReview)actualBounds.expandByObject(visual.mountPoint,true);
  model=visual.group;model.userData.reviewSeat=visual.mountPoint;model.userData.reviewYaw=train.yaw;model.userData.reviewBounds=actualBounds;
  // Render the incline beneath the level cabin so its wedge chassis is read
  // against the real rail, not mistaken for a car floating over a flat floor.
  const track=new THREE.Group(),pose=train.carPose(0);track.position.set(pose.x,pose.y,pose.z);track.rotation.set(pose.trackPitch,pose.yaw,0,'YXZ');scene.add(track);
  const railMaterial=new THREE.MeshStandardMaterial({color:'#6a7379',metalness:.65,roughness:.35}),tieMaterial=new THREE.MeshStandardMaterial({color:'#988474',roughness:.85});
  for(const x of[-.81,.81]){const rail=new THREE.Mesh(new THREE.BoxGeometry(.09,.08,6),railMaterial);rail.position.set(x,-.04,0);track.add(rail);}
  for(let z=-2.8;z<=2.8;z+=.4){const tie=new THREE.Mesh(new THREE.BoxGeometry(2.35,.11,.15),tieMaterial);tie.position.set(0,-.13,z);track.add(tie);}
 }
 if(kind==='bicycle'){
   const world=new RAPIER.World({x:0,y:0,z:0}),walk={handles:new Set(),groundAt:()=>0,contains:()=>true,clear:()=>true,visible:()=>true};
   const bicycle=new BicycleController(RAPIER,world,walk,{x:0,y:0,z:0,yaw:0});
   scene.remove(model);bicycle.setModel(model);scene.add(bicycle.group);
   bicycle.crankAngle=bicycle.previousCrankAngle=Number(params.get('crankAngle')||0);bicycle.steering=Number(params.get('wheelSteer')||0);bicycle.updateVisual(0,true);
   if(riderReview){const avatar=new JackAvatar(scene,{loadAsync:async()=>({scene:clone(riderGLTF.scene),animations:riderGLTF.animations})});await avatar.load();avatar.update(0,{player:{onLand:true,ridingBicycle:true},bicycle,character:{position:{x:0,y:0,z:0}},alpha:1,reduced:true,frozen:false});if(clay)avatar.model.traverse(o=>{if(o.isMesh)o.material=new THREE.MeshStandardMaterial({color:'#bcb7ad',roughness:.85});});}
   model=bicycle.group;
 }
 if(carReview){
  const world=new RAPIER.World({x:0,y:0,z:0}),walk={handles:new Set(),groundAt:()=>0,contains:()=>true,clear:()=>true,visible:()=>true,island:{x:0,z:0,rotation:0,shore:[[-50,-50],[50,-50],[50,50],[-50,50]]},layout:{}};
  const car=new GarageCarController(RAPIER,world,walk,{x:0,y:0,z:0,yaw:0},GARAGE_CARS.find(c=>kind==='car-'+c.id));scene.remove(model);car.setModel(model);scene.add(car.group);car.setOccupied(riderReview);car.wheelAngle=car.previousWheelAngle=Number(params.get('wheelAngle')||0)+(wheelDetail?index*Math.PI*2/3:0);car.steering=Number(params.get('wheelSteer')||0);car.updateVisual(0,true);
  if(riderReview){const avatar=new JackAvatar(scene,{loadAsync:async()=>({scene:clone(riderGLTF.scene),animations:riderGLTF.animations})});await avatar.load();avatar.update(0,{player:{onLand:true,ridingCar:true,car},character:{position:{x:0,y:0,z:0}},alpha:1,reduced:true,frozen:false});}
  model=car.group;reviewCars.push(car);
 }
 const bounds=kind==='career-train'?model.userData.reviewBounds.clone():new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 if(kind==='career-train'&&riderReview&&params.get('detail')==='rider'){center.copy(model.userData.reviewSeat.localToWorld(new THREE.Vector3(0,.3,-.2)));size.set(2,1.9,2);}
 if(carReview&&params.get('detail')==='driver'){const car=reviewCars.at(-1);center.copy(car.group.localToWorld(new THREE.Vector3(...car.contactTargets().pelvis).add(new THREE.Vector3(0,.35,-.15))));size.set(1.15,1.2,1.2);}
 if(wheelDetail){const car=reviewCars.at(-1),radius=car.wheelRadii[0];model.getObjectByName('car-steer-front-left').getWorldPosition(center);size.set(radius*.85,radius*2,radius*2);bounds.min.y=center.y-radius;}
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:'#eee9df',roughness:.9}));floor.position.y=bounds.min.y-.007;floor.receiveShadow=true;scene.add(floor);
 scene.add(new THREE.HemisphereLight('#e8f3ed','#aaa28b',.9));const sun=new THREE.DirectionalLight('#fff0d5',3.25);sun.position.set(-3,6,-4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.009;sun.shadow.bias=-.0001;const extent=Math.max(2,size.length());Object.assign(sun.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:.1,far:500});scene.add(sun);
 const camera=new THREE.PerspectiveCamera(28,1,.01,1000);const directions=wheelDetail?[new THREE.Vector3(-1,.08,-.10),new THREE.Vector3(-1,.08,-.10),new THREE.Vector3(-1,.08,-.10)]:carReview?[new THREE.Vector3(-.8,.6,-1),new THREE.Vector3(-1,.15,0),new THREE.Vector3(-.4,1,-.8)]:kind==='jack'||riderReview?[new THREE.Vector3(0,.02,-1),new THREE.Vector3(.7,.13,-1),new THREE.Vector3(1,.02,-.04)]:['education','about'].includes(kind)?[new THREE.Vector3(0,.8,1),new THREE.Vector3(.8,.8,1),new THREE.Vector3(1,.6,0)]:[new THREE.Vector3(0,.8,-1),new THREE.Vector3(.8,.8,-1),new THREE.Vector3(1,.6,0)];
 if(kind==='career-train'){
  directions[index].copy([new THREE.Vector3(0,.16,1),new THREE.Vector3(.8,.26,1),new THREE.Vector3(1,.12,0)][index]).applyAxisAngle(new THREE.Vector3(0,1,0),model.userData.reviewYaw);
  sun.position.add(center);sun.target.position.copy(center);scene.add(sun.target);
 }
 views.push({scene,camera,center,size,direction:directions[index].normalize()});
}
if(!clay)await surfaces.loadQuality('high');
function render(){const time=performance.now(),dt=Math.min(.05,(time-lastSpinTime)/1000);lastSpinTime=time;if(spinWheels)spinPhase+=dt;for(const[ n,car]of reviewCars.entries()){car.wheelAngle=car.previousWheelAngle=Number(params.get('wheelAngle')||0)+spinPhase+(wheelDetail?n*Math.PI*2/3:0);car.updateVisual(0,true);}const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);renderer.setScissorTest(true);views.forEach((v,n)=>{v.camera.aspect=(w/3)/h;v.camera.updateProjectionMatrix();let distance=(kind==='jack'||riderReview&&!carReview?Math.max(v.size.y,v.size.x*1.15):v.size.length())*.62/Math.tan(THREE.MathUtils.degToRad(14))/Math.min(1,v.camera.aspect);if(kind==='career-train'){const right=new THREE.Vector3(v.direction.z,0,-v.direction.x).normalize(),up=new THREE.Vector3().crossVectors(v.direction,right),extent=axis=>(Math.abs(axis.x)*v.size.x+Math.abs(axis.y)*v.size.y+Math.abs(axis.z)*v.size.z)/2,tan=Math.tan(THREE.MathUtils.degToRad(14));distance=(Math.max(extent(up)/tan,extent(right)/(tan*v.camera.aspect))+extent(v.direction))*1.12;}v.camera.position.copy(v.center).addScaledVector(v.direction,distance);v.camera.lookAt(v.center);renderer.setViewport(n*w/3,0,w/3,h);renderer.setScissor(n*w/3,0,w/3,h);renderer.render(v.scene,v.camera);});renderer.setScissorTest(false);}
if(carReview){const button=document.createElement('button');button.textContent='Spin wheels slowly';button.onclick=()=>{spinWheels=!spinWheels;button.textContent=spinWheels?'Pause wheels':'Spin wheels slowly';};document.querySelector('header').append(button);document.querySelectorAll('.labels span').forEach((element,n)=>{element.textContent=(wheelDetail?['ROLL 0°','ROLL 120°','ROLL 240°']:['FRONT THREE-QUARTER','DRIVER SIDE','CABIN VIEW'])[n]||'';});}
if(kind==='career-train')document.querySelectorAll('.labels span').forEach((element,n)=>{element.textContent=['DOWNHILL OBSERVATION WINDOW','THREE-QUARTER CABIN','LEVEL CABIN / INCLINED CHASSIS'][n];});
renderer.setAnimationLoop(render);document.querySelector('h1').textContent=`${kind==='jack'?(params.has('legacy')?'V8 · ORIGINAL':'V9 · IMPORTED'):carReview?'V15.2.1':kind==='career-train'?'V21':kind==='bicycle'?'V14.2.3':kind==='about'?'V15':kind==='education'?'V14.3':['about','experience','projects'].includes(kind)?'V11':kind==='quad-bike'?'V12.1':'V9'} · ${riderReview?`${carReview?kind.toUpperCase():kind==='career-train'?'FUNICULAR':kind==='bicycle'?'BICYCLE':'QUAD'} + ACTUAL JACK`:kind.toUpperCase()} / ${clay?'CLAY':'ACTUAL MATERIALS'}`;document.querySelector('#state').textContent=`Actual runtime GLB · ${clay?'Neutral clay':kind==='jack'&&!params.has('legacy')?'User-supplied mesh and texture · local rig':surfaces.stats().status+' · shared game surfaces'}${riderReview?kind==='career-train'?' · Actual seated clip, bench and footboard contacts':carReview?' · Seated pelvis, palms and foot contacts':' · Palms fitted to actual handlebar grips':''} · Web${renderer.backend.isWebGPUBackend?'GPU':'GL2'}`;
document.querySelector('#capture').onclick=async()=>{render();const blob=await new Promise(resolve=>canvas.toBlob(resolve));const response=await fetch(`http://127.0.0.1:5174/capture/${kind}-${clay?'clay':'materials'}.png`,{method:'POST',body:blob});document.querySelector('#state').textContent=response.ok?'Actual render saved.':'Capture server unavailable.';};
