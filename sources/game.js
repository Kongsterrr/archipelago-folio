import {campusInteriorAt,isInteriorCutaway} from './core/campus-cutaway.js';
import {campusStationFocus} from './core/campus-focus.js';
import {EstatePracticeController} from './core/estate-practice.js';
import {EstatePracticeView,installEstateNet} from './world/estate-practice-view.js';
import {dockLocal} from './core/dock.js';
import {duanThemes} from './campus-landmarks.js';
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import { Events } from './core/Events.js';
import {CharacterController,IslandWalkWorld,localToWorld,SEA_GROUP,CHARACTER} from './core/character.js';
import {PlayerController,BoardingController} from './core/player.js';
import {QuadBikeController,QUAD_BIKE,quadFootprintClear,overlaps} from './core/quad-bike.js';
import {GarageCarController,GARAGE_CARS,garageSpawn,carSpec,garageCarAssetURL} from './core/garage-car.js';
import {BicycleController,BICYCLE,bicycleFootprintClear} from './core/bicycle.js';
import {JackAvatar} from './world/jack.js';
import { BoatController } from './core/boat.js';
import { CameraRig, cameraAzimuth } from './core/camera.js';
import { CameraTransition } from './core/camera-transition.js';
import {IslandArrival} from './core/island-arrival.js';
import {arrivalBounds} from './core/island-arrival-framing.js';
import { ChallengeManager } from './core/challenges.js';
import { createIslandColliders, createBoundaryColliders } from './core/collisions.js';
import { IslandController } from './world/island.js';
import { FeedbackSystem } from './world/feedback.js';
import { Interactable } from './world/interactable.js';
import { syncInteractionMarkers } from './core/interaction-markers.js';
import {exhibitRange,exhibitReadLabel,selectLandExhibit,selectProjectSign,landPrimaryAction} from './core/project-exhibits.js';
import { PropManager } from './world/props.js';
import {DockInteraction} from './core/dock.js';
import {AmbientFleet} from './world/fleet.js';
import {MarineLife} from './world/marine.js';
import {BoatAppearance,prepareBoatMaterials} from './world/boat-appearance.js';
import {IslandDetails} from './world/island-details.js';
import {oceanHeight} from './world/water-space.js';
import { Environment } from './world/environment.js';
import {BayLighting} from './world/bay-lighting.js';
import {BayWater} from './world/bay-water.js';
import {SUNSET} from './world/sunset-theme.js';
import {applySunsetMaterials,releaseSunsetMaterials} from './world/sunset-materials.js';
import {SurfaceLibrary} from './world/surface-library.js';
import { mesh, box, cylinder, label, material } from './world/geometry.js';
import { islands, gates, boatSpawn, WORLD_RADIUS, nearestIsland, inDockZone, cargoBerths, lamps, challenges, secretPlaces, islandActions, reefGroups, resolveIsland } from './config.js';
const vec=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const STEP=1/60;
const ridingVehicle=player=>!!(player?.ridingVehicle||player?.ridingCar||player?.ridingQuad||player?.ridingBicycle);
const landVehicle=game=>game.player?.activeVehicle||(game.player?.ridingCar?game.player.car:game.player?.ridingBicycle?game.bicycle:game.quadBike);

export class Game {
 constructor(canvas,inputs,settings,discovery=null){
  Object.assign(this,{canvas,inputs,settings,discovery});this.events=new Events();this.scene=new THREE.Scene();
  this.scene.background=new THREE.Color('#55acb1');this.scene.fog=new THREE.Fog('#80c8c0',120,310);
  this.camera=new THREE.PerspectiveCamera(28,innerWidth/innerHeight,.2,600);this.mode='loading';this.loaded=new Map();this.controllers=new Map();
  this.time=0;this.accumulator=0;this.wakes=[];this.snapshot=null;this.pendingResume=null;this.focus=null;this.interactables=[];this.actionMarkers=[];this.loadedCount=0;this.garageCars=[];this.quadBike=null;this.quadRideMarker=null;this.bicycle=null;this.bicycleRideMarker=null;
  this.loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  this.challenges=new ChallengeManager({gates,berths:cargoBerths,onEvent:event=>this.challengeEvent(event)});
  this.practice=new EstatePracticeController({onEvent:event=>this.practiceEvent(event)});
  this.race=this.challenges; // Retained public alias for existing portfolio integrations.
 }
 async init(){
  this.renderer=new THREE.WebGPURenderer({canvas:this.canvas,antialias:true,powerPreference:'high-performance',forceWebGL:new URLSearchParams(location.search).has('webgl')});
  await this.renderer.init();this.surfaces=new SurfaceLibrary({renderer:this.renderer,quality:this.settings.quality});this.renderer.setSize(innerWidth,innerHeight);this.renderer.info.autoReset=false;this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.settings.quality==='low'?1:1.5));
  this.renderer.shadowMap.enabled=this.settings.quality!=='low';this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;
  await RAPIER.init();this.world=new RAPIER.World({x:0,y:0,z:0});this.world.timestep=STEP;this.queue=new RAPIER.EventQueue(true);
  this.boat=new BoatController(RAPIER,this.world,boatSpawn);this.prev=vec(boatSpawn.x,.35,boatSpawn.z);this.prevYaw=this.boat.yaw;this.visualPosition=this.prev.clone();
  this.docks=new DockInteraction(islands);this.appearance=new BoatAppearance(this.settings);this.simTime=0;
  this.cameraRig=new CameraRig(this.camera,this.settings,innerWidth,innerHeight);
  this.cameraTransition=new CameraTransition();this.arrival=new IslandArrival();this.travelEpoch=0;
  this.feedback=new FeedbackSystem(this.scene,this.settings,(kind,strength,p)=>this.spatialSound(kind,p||this.boat.position,strength));
  this.createLight();this.createWater();this.createIslands();this.createBoat();this.createBoundary();
  this.environment=new Environment(this.scene,RAPIER,this.world,this.settings);
  this.props=new PropManager(this.scene,RAPIER,this.world,{settings:this.settings,feedback:this.feedback,onSecret:id=>this.findSecret(id)});
  this.fleet=new AmbientFleet(this.scene,RAPIER,this.world,this.settings,this.loader,(kind,p,strength)=>this.spatialSound(kind,p,strength));
  this.marine=new MarineLife(this.scene,this.settings,this.loader,this.discovery,(kind,p,strength)=>this.spatialSound(kind,p,strength));
  this.details=new IslandDetails(this.scene,this.settings,this.loader);this.details.v4=true;
  this.world.forEachCollider(c=>c.setCollisionGroups(SEA_GROUP));
  this.character=new CharacterController(RAPIER,this.world);this.player=new PlayerController(this.boat,this.character);this.walkWorlds=new Map();this.landActions=new Map();this.jack=new JackAvatar(this.scene,this.loader);
  this.boarding=new BoardingController(this.player,{prepare:i=>this.prepareAshore(i),select:(i,w)=>this.selectBerth(i,w),onCommit:(kind,i,b,w)=>this.commitBoarding(kind,i,b,w),onError:e=>{this.events.trigger('message',[e.message]);this.inputs.setEnabled(!this.frozen);}});
  this.toys=this.props.items;this.createInteractables();this.createWake();this.resetCamera();this.bindPointer();
  this.world.step(this.queue);this.queue.clear();
  await Promise.all([this.loadModel('boat'),this.jack.load(),this.loadWalkLayouts()]);
  if(this.jack.model){applySunsetMaterials(this.jack.model,'jack');this.surfaces.bind(this.jack.model,'jack');}
  this.mode='exploring';this.last=performance.now();this.inputs.setEnabled(true);this.setQuality(this.settings.quality);
  window.addEventListener('resize',()=>{this.cameraRig.resize(innerWidth,innerHeight);this.renderer.setSize(innerWidth,innerHeight);});
  this.renderer.setAnimationLoop(()=>this.safeFrame());
  this.readyMs=Math.round(performance.now());this.events.trigger('ready',[this.renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2']);
  this.surfaces.loadQuality(this.settings.quality);
  this.loadModel('about');
  this.fleet.load().catch(e=>console.warn('Fleet unavailable',e.message));this.marine.load().catch(e=>console.warn('Sea life unavailable',e.message));
 }
 safeFrame(){try{this.frame();}catch(error){this.renderer.setAnimationLoop(null);this.events.trigger('failure',[error]);}}
 createLight(){this.lighting=new BayLighting(this.scene,this.renderer,this.camera,this.settings.quality);this.sun=this.lighting.sun;}
 createWater(){this.bayWater=new BayWater(this.scene,islands,reefGroups,this.settings);this.water=this.bayWater.mesh;this.waterTime=this.bayWater.time;}
 createIslands(){
  for(const i of islands){
   const group=new THREE.Group();group.position.set(i.x,0,i.z);group.rotation.y=i.rotation;this.scene.add(group);
   const shape=new THREE.Shape(i.shore.map(([x,z])=>new THREE.Vector2(x,-z)));
   const geo=new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false}).rotateX(-Math.PI/2);mesh(group,geo,'sand',[0,-.1,0]);box(group,[i.pier.width,.35,i.pier.endZ-i.pier.startZ],'woodLight',[0,.55,(i.pier.startZ+i.pier.endZ)/2]);
   const controller=new IslandController(i,group);this.controllers.set(i.id,controller);this.loaded.set(i.id,{group,model:null,requested:false,island:i});createIslandColliders(RAPIER,this.world,i);
   for(let j=0;j<3;j++){
    const shore=mesh(group,new THREE.ShapeGeometry(shape).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:['#447d84','#739993','#d9b68d'][j],transparent:true,opacity:.2+j*.025,depthWrite:false}),[0,-.055+j*.018,0]);shore.scale.setScalar(1.17-j*.045);shore.castShadow=false;shore.userData.shore=true;
   }
  }
 }
 createBoat(){this.boatGroup=new THREE.Group();this.scene.add(this.boatGroup);this.boatVisual=new THREE.Group();this.boatGroup.add(this.boatVisual);box(this.boatVisual,[1.5,.6,3.6],'orange',[0,.35,0]);box(this.boatVisual,[1.2,.35,2],'ivory',[0,.8,-.2]);}
 async loadModel(id,force=false){
  const item=this.loaded.get(id);if(item?.promise&&!force)return item.promise;if(item?.model&&!force)return true;
  const promise=this.loadModelNow(id,force);if(item)item.promise=promise;try{return await promise;}finally{if(item?.promise===promise)item.promise=null;}
 }
 async loadModelNow(id,force=false){
  const item=id==='boat'?null:this.loaded.get(id);const quality=this.settings.quality,revision=item?(item.revision=(item.revision||0)+1):0;if(item){item.requested=true;item.requestedQuality=quality;}
  try{
   const gltf=await this.loader.loadAsync('/models/'+(id!=='boat'&&quality==='low'?'low/':'')+id+'.glb?v='+(id==='about'?'16':id==='education'?'14.3':id==='projects'?'13.3':'11'));if(item&&item.revision!==revision){gltf.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});return;}gltf.scene.traverse(o=>{if(o.isMesh){
    const materials=Array.isArray(o.material)?o.material:[o.material];
    const glazing=id==='boat'&&materials.some(m=>m.transparent);
    // The clear windscreen should reveal the helm, including in the shadow pass.
    o.castShadow=!glazing;o.receiveShadow=!glazing;
    if(glazing){for(const material of materials)material.depthWrite=false;o.renderOrder=1;}
   }});
   if(id==='boat'){
    this.boatVisual.clear();this.boatVisual.add(gltf.scene);this.boatModel=gltf.scene;prepareBoatMaterials(gltf.scene);applySunsetMaterials(gltf.scene,'boat');this.surfaces.bind(gltf.scene,'boat');this.appearance.bind(gltf.scene);
    this.boatOutline=gltf.scene.clone(true);this.boatOutline.traverse(o=>{if(o.isMesh){o.material=new THREE.MeshBasicMaterial({color:'#fff8da',depthTest:false,transparent:true,opacity:.35});o.castShadow=false;o.renderOrder=9;}});this.boatOutline.scale.setScalar(1.025);this.boatOutline.visible=false;this.boatVisual.add(this.boatOutline);
   }else{
    const shore=item.group.children.filter(o=>o.userData.shore);if(item.model){this.surfaces.release(item.model);this.controllers.get(id)?.release();releaseSunsetMaterials(item.model);}if(item.model)item.model.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});item.group.clear();item.quality=quality;item.group.add(...shore,gltf.scene);item.model=gltf.scene;applySunsetMaterials(gltf.scene,id);if(id==='about')installEstateNet(gltf.scene,this.walkLayouts?.get('about')||{groundY:.85});this.controllers.get(id).bind(gltf.scene);this.surfaces.bind(gltf.scene,id);gltf.scene.traverse(o=>{if(o.isMesh&&(Array.isArray(o.material)?o.material:[o.material]).some(m=>['glass','campus_windowClear','estate_clear'].includes(m.userData.sunsetMaterial?.role)))o.castShadow=false;});
   }
   if(id==='about'&&this.walkLayouts?.has(id))this.installGarageCars(item.island,this.ensureWalkWorld(item.island));
   if(id==='education'&&this.bicycle)this.bicycle.setSurfaceModel(item.model);
   if(id==='projects'&&this.walkLayouts?.has(id))this.installQuadBike(item.island,this.ensureWalkWorld(item.island)).catch(e=>console.warn(e));
   this.loadedCount++;this.events.trigger('asset',[{id,count:this.loadedCount}]);return true;
  }catch(error){if(item){item.lastFailure=performance.now();item.requested=false;}console.warn('Model unavailable: '+id,error.message);this.events.trigger('asseterror',[id]);}
 }
 createBoundary(){
  const geo=new THREE.CylinderGeometry(.22,.36,.7,8);this.boundary=new THREE.InstancedMesh(geo,material('yellow'),90);const dummy=new THREE.Object3D();
  for(let i=0;i<90;i++){const a=i/90*Math.PI*2;dummy.position.set(Math.cos(a)*WORLD_RADIUS,.15,Math.sin(a)*WORLD_RADIUS);dummy.updateMatrix();this.boundary.setMatrixAt(i,dummy.matrix);}this.scene.add(this.boundary);createBoundaryColliders(RAPIER,this.world,WORLD_RADIUS);
 }
 createInteractables(){
  for(const i of islands){
   const marker=label('F',{width:72,height:72,worldWidth:1.25,background:'#fff5dd',color:'#254f62',fontSize:38});marker.position.set(i.action.x,2.1,i.action.z);marker.visible=false;this.scene.add(marker);
   const actionId=i.entryIds[0];
   const action=new Interactable({id:i.id,label:islandActions[actionId][0],position:i.action,range:8,object:marker,run:()=>i.id==='education'?this.events.trigger('challengeopen',['lighthouse']):this.activateIsland(actionId)});
   this.interactables.push(action);this.actionMarkers.push({marker,action});
  }
  for(const c of challenges)this.interactables.push(new Interactable({id:'challenge-'+c.id,label:'Play '+c.name,position:c,range:9,run:()=>this.events.trigger('challengeopen',[c.id])}));
  for(const lamp of lamps)this.interactables.push(new Interactable({id:'lamp-'+lamp.id,label:'Activate '+lamp.name,position:lamp,range:6,available:()=>this.challenges.kind==='lighthouse'&&this.challenges.state==='running',run:()=>this.challenges.activateLamp(lamp.id)}));
  this.bottle=new THREE.Group();this.bottle.position.set(secretPlaces.bottle.x,.25,secretPlaces.bottle.z);this.scene.add(this.bottle);
  const bottle=cylinder(this.bottle,.25,1.2,'#91dcc4',[0,.1,0]);bottle.rotation.z=1.05;cylinder(bottle,.14,.22,'wood',[0,.68,0]);
  const paper=box(bottle,[.22,.6,.1],'ivory',[0,0,.15]);paper.rotation.y=.3;const bottleMarker=label('F',{width:72,height:72,worldWidth:1,background:'#fff5dd',color:'#254f62',fontSize:38});bottleMarker.position.set(0,1.8,0);bottleMarker.visible=false;this.bottle.add(bottleMarker);
  const bottleAction=new Interactable({id:'bottle',label:'Read the message',position:secretPlaces.bottle,range:8,object:this.bottle,run:()=>{this.findSecret('bottle');this.events.trigger('message',['A message from the sea: Hello, world.']);}});
  this.interactables.push(bottleAction);this.actionMarkers.push({marker:bottleMarker,action:bottleAction});
 }
 bindPointer(){
  this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();let down=null;
  this.canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
  this.canvas.addEventListener('pointerup',e=>{
   if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>8||this.mode!=='exploring'||this.challenges.frozen||this.practice?.active)return;down=null;
   this.pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);this.raycaster.setFromCamera(this.pointer,this.camera);
   if(this.player.onLand){
    const p=this.activeActor.position,walk=this.character.walkWorld,actions=this.landActions.get(this.player.island.id)||[];
    const candidates=actions.filter(a=>(!ridingVehicle(this.player)||a.station?.readFull)&&a.distance(p)<=12&&a.available());
    const hits=candidates.flatMap(a=>this.raycaster.intersectObject(a.hitObject||a.object,true).map(hit=>({a,distance:hit.distance}))).sort((a,b)=>a.distance-b.distance);
    const hit=hits.find(({a})=>walk.visible(p,a.position));
    if(hit){if(hit.a.distance(p)<=exhibitRange(hit.a,ridingVehicle(this.player),hit.a===this.nearStation))hit.a.run({direct:true});else if(hit.a.station?.readFull)this.events.trigger('message',['Move closer to view']);}
   }else{
    const hit=this.interactables.filter(i=>i.object&&i.available()&&i.distance(this.activeActor.position)<10).find(i=>this.raycaster.intersectObject(i.object,true).length);hit?.run();
   }
  });
  this.canvas.addEventListener('wheel',e=>{if(this.mode!=='exploring'||this.arrival?.active)return;e.preventDefault();if(!this.wheelTime||performance.now()-this.wheelTime>180){this.wheelTime=performance.now();this.setZoom(this.zoom+(e.deltaY>0?1:-1));}},{passive:false});
 }
 createWake(){this.wakeDummy=new THREE.Object3D();this.wakeMesh=new THREE.InstancedMesh(new THREE.CircleGeometry(1,10),new THREE.MeshBasicMaterial({color:SUNSET.foam,transparent:true,opacity:.44,depthWrite:false}),100);this.wakeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.wakeMesh.frustumCulled=false;this.scene.add(this.wakeMesh);this.lastWake=0;this.clearWake();}
 clearWake(){this.wakes=[];if(this.wakeMesh){this.wakeDummy.scale.setScalar(0);this.wakeDummy.updateMatrix();for(let i=0;i<100;i++)this.wakeMesh.setMatrixAt(i,this.wakeDummy.matrix);this.wakeMesh.instanceMatrix.needsUpdate=true;}}
 updateWake(frozen){
  const p=this.visualPosition,speed=this.boat.speed;
  if(!frozen&&speed>.7&&this.simTime-this.lastWake>.055){this.lastWake=this.simTime;for(const sign of [-1,1])this.wakes.push({x:p.x+Math.sin(this.boat.yaw)*1.8+Math.cos(this.boat.yaw)*sign*.4,z:p.z+Math.cos(this.boat.yaw)*1.8-Math.sin(this.boat.yaw)*sign*.4,dx:Math.cos(this.boat.yaw)*sign,dz:-Math.sin(this.boat.yaw)*sign,t:this.simTime,scale:.25+speed*.012});}
  this.wakes=this.wakes.filter(w=>this.simTime-w.t<2).slice(-100);
  for(let i=0;i<100;i++){const w=this.wakes[i];if(w){const age=this.simTime-w.t;const x=w.x+w.dx*age*.8,z=w.z+w.dz*age*.8;this.wakeDummy.position.set(x,oceanHeight(x,z,this.settings.reduced?0:this.simTime)+.025,z);this.wakeDummy.rotation.set(-Math.PI/2,0,0);const scale=(w.scale+age*.35)*(1-age/2);this.wakeDummy.scale.set(scale*1.8,scale,1);}else this.wakeDummy.scale.setScalar(0);this.wakeDummy.updateMatrix();this.wakeMesh.setMatrixAt(i,this.wakeDummy.matrix);}this.wakeMesh.instanceMatrix.needsUpdate=true;
 }
 frame(){
  const now=performance.now(),dt=Math.min((now-this.last)/1000,.1);this.last=now;this.time+=dt;this.frameTimes=(this.frameTimes||[]).concat(dt*1000).slice(-300);
  this.fpsSamples=(this.fpsSamples||0)+1;if(!this.fpsSince)this.fpsSince=now;if(now-this.fpsSince>1000){this.fps=Math.round(this.fpsSamples*1000/(now-this.fpsSince));this.fpsSince=now;this.fpsSamples=0;this.fpsHistory=(this.fpsHistory||[]).concat(this.fps).slice(-30);}
  const transitioning=this.player.transitioning;this.player.tick(dt);
  if(transitioning&&!this.player.transitioning){this.inputs.setEnabled(!this.frozen);this.resetCamera();this.events.trigger('locomotion',[this.player.mode]);}
  this.syncCameraTransition();
  const arrivalFinished=this.arrival.tick(dt,{paused:this.mode!=='exploring'||this.player.pauseReasons.size>0||this.player.transitioning||this.cameraTransition.active,reduced:this.settings.reduced});
  if(arrivalFinished){this.resetCamera();this.inputs.setEnabled(!this.frozen);}
  const cameraFade=this.cameraTransition.step(dt,{paused:this.player.pauseReasons.has('hidden')});
  if(cameraFade.finished)this.inputs.setEnabled(!this.frozen);
  this.events.trigger('boardingfade',[Math.max(cameraFade.opacity,this.player.transition?Math.sin(Math.min(1,this.player.transition.elapsed/.6)*Math.PI):0)]);
  if(this.mode==='exploring'&&!this.player.pauseReasons.size&&!this.player.transitioning&&!ridingVehicle(this.player)&&!this.cameraTransition.active)this.challenges.updateClock();
  if(this.mode==='exploring'&&!this.player.pauseReasons.size&&!this.player.transitioning&&!this.cameraTransition.active)this.practice.advanceCountdown(dt);
  const frozen=this.frozen,input=this.player.walking?{}:this.inputs.read(this.activeActor.yaw,this.cameraRig.yaw);
  if(!frozen){this.accumulator+=dt;while(this.accumulator>=STEP){
    const before={...this.boat.position};this.prev.set(before.x,before.y,before.z);this.prevYaw=this.boat.yaw;this.simTime+=STEP;
    this.fleet?.beforeStep(STEP,this.boat);const actor=this.activeActor;this.marine?.step(STEP,{position:actor.position,velocity:actor.velocity,yaw:actor.yaw,canCompanion:!this.player.onLand});
    this.props.beforeStep(before);
    if(this.practice?.active)this.stepPractice(STEP);else if(this.player.walking)this.character.step(this.inputs.readWalking(this.cameraRig.yaw),STEP);else if(ridingVehicle(this.player))landVehicle(this)?.step(this.inputs.read(landVehicle(this).yaw,this.cameraRig.yaw,{groundVehicle:true,forwardSpeed:landVehicle(this).forwardSpeed}),STEP);else{this.boat.step(this.inputs.read(this.boat.yaw,this.cameraRig.yaw),STEP);this.enforceBoundary(before);}
    this.world.step(this.queue);if(this.player.walking){this.character.afterStep();this.player.ashoreTime+=STEP;if(this.player.ashoreTime>=1)this.discovery?.land(this.player.island.id);}else if(ridingVehicle(this.player))landVehicle(this)?.afterStep();
    this.props.afterStep(this.queue,this.boat.collider,this.boat.position);if(!this.player.walking&&!ridingVehicle(this.player))this.challenges.tick(before,this.boat.position,STEP,this.challenges.kind==='cargo'?this.props.cargoData():[]);
    this.accumulator-=STEP;if(this.frozen)break;
  }}else this.accumulator=0;
  const boat=this.boat.position,p=this.activeActor.position,alpha=frozen?1:Math.min(this.accumulator/STEP,1);
  this.visualPosition.lerpVectors(this.prev,vec(boat.x,boat.y,boat.z),alpha);this.boatGroup.position.copy(this.visualPosition);this.boatGroup.rotation.y=this.prevYaw+Math.atan2(Math.sin(this.boat.yaw-this.prevYaw),Math.cos(this.boat.yaw-this.prevYaw))*alpha;
  this.bayWater.update(this.simTime);
  this.boatVisual.position.y=this.settings.reduced?0:Math.sin(this.simTime*2.2)*.06;
  this.boatVisual.rotation.z=THREE.MathUtils.damp(this.boatVisual.rotation.z,this.settings.reduced||frozen?0:-(input.steer||0)*this.boat.speed*.004,8,dt);
  this.boatVisual.rotation.x=THREE.MathUtils.damp(this.boatVisual.rotation.x,this.settings.reduced||frozen?0:-Math.max(0,this.boat.forwardSpeed)*.0025,8,dt);
  this.props.update(alpha,this.simTime,this.settings.reduced);this.bottle.position.y=.25+(this.settings.reduced?0:Math.sin(this.simTime)*.07);
  for(const controller of this.controllers.values()){if(controller.island.id==='education')controller.setStudySeated(!!(this.player.walking&&this.player.island.id==='education'&&this.character.seated&&this.character.seatAction==='education-study'));controller.pedestrian=this.player.walking&&this.player.island.id===controller.island.id?this.character.position:null;controller.update(frozen?0:dt,p,this.simTime,this.focus?.id===controller.island.id,this.settings.reduced,this.focus?.contentId);}
  for(const car of this.garageCars||[])car.updateVisual(dt,frozen,alpha);this.quadBike?.updateVisual(dt,frozen,alpha);this.bicycle?.updateVisual(dt,frozen,alpha);this.appearance?.update(dt,input,this.boat.speed,this.settings.reduced,frozen);this.jack.update(dt,{player:this.player,boatVisual:this.boatVisual,quadBike:this.quadBike,bicycle:this.bicycle,character:this.character,alpha,input,reduced:this.settings.reduced,frozen,lookTarget:this.nearStation?.position,practice:this.practice.pose()});
  this.practiceView?.update(this.practice);
  this.fleet?.update(alpha,p,this.settings.reduced?0:this.simTime);this.marine?.update(alpha,p,this.camera,this.settings.reduced?0:this.simTime,[...this.loaded.values()].map(i=>i.group).concat(this.fleet?.items.map(i=>i.group)||[]));this.details?.update(frozen?0:dt,p,this.simTime,this.settings.reduced?0:this.simTime,this.controllers);
  this.updateWake(frozen);this.feedback.update(frozen?0:dt);this.updateCamera(dt,cameraFade);this.updateNearby(dt,now,frozen);this.environment.update(this.challenges,this.simTime,p,this.nearAction);this.updateOcclusion(now);
  const lightTarget=this.focus?.boatStudio?this.boat.position:this.focus|| (this.arrival?.active?this.arrival.island:p);
  this.lighting.update(lightTarget,!this.focus&&this.player.onLand&&!this.arrival?.active,this.cameraRig.distance);
  this.events.trigger('frame',[{position:p,yaw:this.activeActor.yaw,speed:this.activeActor.speed,dt,now,frozen}]);this.renderer.info.reset();this.lighting.render();
  if(!frozen&&this.challenges.kind==='cargo'&&this.challenges.state==='running'){const lost=this.props.outOfBounds();if(lost){this.pause('recovery');if(this.props.recoverCargo(lost,boat)){this.snapshot.props=this.props.snapshot();this.resume();this.events.trigger('message',['Cargo recovered. Resuming your run…']);}else{this.recovery=lost;this.events.trigger('message',['No clear recovery berth. Use Reset cargo for a fresh start.']);}}}
  if(this.recovery&&this.mode==='recovery'&&this.props.recoverCargo(this.recovery,boat)){this.recovery=null;this.snapshot.props=this.props.snapshot();this.resume();}
  if(!this.player.onLand&&Math.hypot(boat.x,boat.z)>WORLD_RADIUS+9)this.events.trigger('rescue');
 }
 enforceBoundary(p){const distance=Math.hypot(p.x,p.z);if(distance>WORLD_RADIUS-10){const v=this.boat.velocity,out=(v.x*p.x+v.z*p.z)/distance;if(out>0){const f=Math.min(1,(distance-WORLD_RADIUS+10)/10)*.14;this.boat.body.setLinvel({x:v.x-p.x/distance*out*f,y:0,z:v.z-p.z/distance*out*f},true);}}}
 updateNearby(dt,now,frozen){
  const p=this.activeActor.position;this.nearby=this.player?.onLand?this.player.island:this.docks?.update(p)||null;
  for(const i of islands){const distance=Math.hypot(p.x-i.x,p.z-i.z),near=inDockZone(this.boat.position,i);if(!frozen){if(distance<i.r+16)this.discovery?.discover(i.id);this.discovery?.visit(i.id,near,dt);}const asset=this.loaded.get(i.id);if(!asset.requested&&distance<i.r+60&&(!asset.lastFailure||now-asset.lastFailure>5000))this.loadModel(i.id);}
  this.nearCar=null;this.nearStation=null;this.canBoard=false;this.canRideQuad=false;this.canRideBicycle=false;this.canDismountQuad=!!this.player?.ridingQuad;this.canDismountBicycle=!!this.player?.ridingBicycle;
  const onLand=this.player?.onLand,riding=ridingVehicle(this.player);
  if(onLand){
   const list=this.landActions.get(this.player.island.id)||[],visible=a=>a.visible(this.camera)&&this.character.walkWorld.visible(p,a.position);
   this.nearStation=frozen||this.practice?.active?null:selectLandExhibit(list,p,{riding,previous:this.lastStation,visible});this.lastStation=this.nearStation;
   this.projectSign=frozen||this.practice?.active?null:selectProjectSign(list,p,visible);
   if(!riding&&!this.practice?.active){
    this.canBoard=Math.hypot(p.x-this.player.berth.landing.x,p.z-this.player.berth.landing.z)<2;
    if(!frozen&&this.player.island.id==='about')this.nearCar=(this.garageCars||[]).filter(car=>car.model&&car.mountDistance(p)<1.55&&car.accessPoints().some(a=>Math.hypot(a.x-p.x,a.z-p.z)<1.55&&this.character.walkWorld.visible(p,a))).sort((a,b)=>a.mountDistance(p)-b.mountDistance(p))[0]||null;
    if(!frozen&&this.player.island.id==='projects'&&this.quadBike){const bike=this.quadBike.position;this.canRideQuad=Math.hypot(p.x-bike.x,p.z-bike.z)<2.8&&this.character.walkWorld.visible(p,bike);}
    if(!frozen&&this.player.island.id==='education'&&this.bicycle){const bike=this.bicycle.position;this.canRideBicycle=Math.hypot(p.x-bike.x,p.z-bike.z)<1.9&&this.character.walkWorld.visible(p,bike);}
   }
   this.nearAction=riding?this.nearStation:!this.canBoard&&this.nearStation?.kind!=='read'?this.nearStation:null;
  }else{this.projectSign=null;this.lastStation=null;this.nearAction=!frozen?Interactable.nearest(this.interactables,p,this.camera):null;}
  for(const [id,actions]of this.landActions)for(const a of actions){
   const current=!frozen&&onLand&&id===this.player.island.id;
   if(a.object)a.object.visible=!!(current&&!riding&&a===this.nearStation&&!this.canBoard&&!((this.canRideQuad||this.canRideBicycle||this.nearCar)&&a.kind==='read')&&!(a.kind==='bench'&&this.character.seated)&&!a.station?.primary);
   if(a.sign)a.sign.visible=!!(current&&a===this.projectSign&&a!==this.nearStation);
   if(a.highlight)a.highlight.visible=!!(current&&a===this.nearStation);
  }
  for(const car of this.garageCars||[])if(car.marker){const cp=car.position;car.marker.position.set(cp.x,cp.y+car.config.height+.55,cp.z);car.marker.visible=!frozen&&this.nearCar===car;}
  if(this.quadRideMarker&&this.quadBike){const bp=this.quadBike.position;this.quadRideMarker.position.set(bp.x,bp.y+2.45,bp.z);this.quadRideMarker.visible=!frozen&&this.canRideQuad;}
  if(this.bicycleRideMarker&&this.bicycle){const bp=this.bicycle.position;this.bicycleRideMarker.position.set(bp.x,bp.y+2.0,bp.z);this.bicycleRideMarker.visible=!frozen&&this.canRideBicycle;}
  syncInteractionMarkers(this.actionMarkers,this.nearAction,{frozen,walking:!!this.player?.onLand});
  if(!frozen&&!this.player?.walking){if(Math.hypot(p.x-secretPlaces.arch.x,p.z-secretPlaces.arch.z)<3.2)this.findSecret('arch');if(Math.hypot(p.x-secretPlaces.cove.x,p.z-secretPlaces.cove.z)<5)this.findSecret('cove');}
 }
 get activeActor(){return this.player?.activeActor||this.boat;}
 get frozen(){return this.mode!=='exploring'||this.challenges.frozen||!!this.practice?.frozen||!!this.player?.pauseReasons.size||!!this.player?.transitioning||!!this.boarding?.pending||!!this.cameraTransition?.active||!!this.arrival?.active;}
 get zoom(){return this.player?.onLand?(this.settings.walkZoom??1):(this.settings.zoom??1);}
 cameraState({physical=false}={}){
  const actor=this.activeActor,onLand=!!this.player?.onLand;
  const position=this.focus?.boatStudio?(physical?this.boat.position:this.visualPosition):ridingVehicle(this.player)?landVehicle(this).mountPoint.getWorldPosition(vec()):physical?actor.position:onLand?this.jack.root.position:this.visualPosition;
  let focus=this.focus||this.practiceFocus();
  const landAzimuth=onLand?this.player.island?.rotation:undefined;
  const focusIsland=focus?.islandId||focus?.id;
  if(onLand&&focus&&!focus.boatStudio&&focusIsland===this.player.island?.id){
   focus={...focus,camera:{...focus.camera,azimuth:landAzimuth}};
  }
  const walk=this.character?.walkWorld,terrainHeight=onLand&&walk?.terrain&&(!focus||!focus.boatStudio&&focusIsland===this.player.island.id)?p=>walk.contains(p,0)?walk.groundAt(p):null:null;
  return{position,terrainHeight,arrival:!focus?this.arrival?.view(this.settings.reduced):null,velocity:actor.velocity,yaw:actor.yaw,speed:this.frozen?0:actor.speed,input:onLand&&!ridingVehicle(this.player)?{}:this.inputs.read(actor.yaw,this.cameraRig.yaw),focus,landAzimuth,locomotion:this.player?.ridingCar?'car':this.player?.ridingBicycle?'bicycle':ridingVehicle(this.player)?'quad':onLand?'walking':'sailing'};
 }
 syncCameraTransition(){
  if(!this.cameraTransition)return;
  const wasActive=this.cameraTransition.active;
  this.cameraTransition.request(cameraAzimuth(this.cameraState()));
  if(this.cameraTransition.active&&!wasActive){this.inputs.setEnabled(false);this.character?.hold();if(ridingVehicle(this.player))landVehicle(this)?.hold();this.accumulator=0;}
 }
 updateCamera(dt,fade={}){if(!fade.hold)this.cameraRig.update(dt,this.cameraState(),!!fade.snap);this.updateArrivalAtmosphere();}
 updateArrivalAtmosphere(){
  const overview=(this.arrival?.active&&!this.focus)||!!this.focus?.camera?.fitBounds;
  if(overview&&!this.arrivalAtmosphere)this.arrivalAtmosphere={near:this.scene.fog.near,far:this.scene.fog.far,clip:this.camera.far};
  const saved=this.arrivalAtmosphere;if(!saved)return;
  // A reader may open while the overview camera is still far away. Fade fog
  // back with the actual eye/target separation, not the stale follow distance.
  const distance=this.cameraRig.position?.distanceTo(this.cameraRig.target)??this.cameraRig.distance;
  const offset=Math.max(0,distance-80);
  this.scene.fog.near=saved.near+offset;this.scene.fog.far=saved.far+offset;
  const clip=Math.max(saved.clip,distance+150);
  if(this.camera.far!==clip){this.camera.far=clip;this.camera.updateProjectionMatrix();}
  if(!overview&&offset===0)this.arrivalAtmosphere=null;
 }
 resetCamera(){const p=this.boat.position;this.visualPosition.set(p.x,p.y,p.z);this.prev.copy(this.visualPosition);this.prevYaw=this.boat.yaw;const state=this.cameraState({physical:true});this.cameraTransition?.reset(cameraAzimuth(state));this.cameraRig.lastPoint=null;this.cameraRig.update(0,state,true);}
 updateOcclusion(now){
  if(this.lastOcclusion&&now-this.lastOcclusion<100)return;this.lastOcclusion=now;const p=this.activeActor.position,candidates=[...this.environment.occluders];for(const c of this.controllers.values())if(Math.hypot(c.island.x-p.x,c.island.z-p.z)<c.island.r+25)candidates.push(...c.occluders);
  const probes=[vec(p.x,p.y+(this.player.walking?.7:1),p.z)];
  if(ridingVehicle(this.player)){const vehicle=landVehicle(this),yaw=vehicle.yaw,c=Math.cos(yaw),s=Math.sin(yaw),w=vehicle.spec?.collisionHalfWidth??.6,l=vehicle.spec?.collisionHalfLength??.8;for(const [x,z]of[[0,0],[-w,-l],[w,-l],[-w,l],[w,l]])probes.push(vec(p.x+x*c+z*s,p.y+.35,p.z-x*s+z*c));}
  this.scene.updateMatrixWorld();const hit=new Set(),interior=!this.focus&&this.player.onLand?campusInteriorAt(this.player.island,this.walkLayouts.get(this.player.island.id),p):null,cutaway=new Set();
  if(interior)for(const object of candidates)if(isInteriorCutaway(object,interior)){hit.add(object);cutaway.add(object);}
  if(!this.focus&&!this.arrival?.active)for(const target of probes){const direction=target.clone().sub(this.camera.position),distance=direction.length(),ray=new THREE.Raycaster(this.camera.position,direction.normalize(),0,distance-.15);for(const h of ray.intersectObjects(candidates,false)){hit.add(h.object);let group=h.object.parent;while(group&&!group.name.startsWith('occluder_'))group=group.parent;if(group)group.traverse(o=>{if(candidates.includes(o))hit.add(o);});}}
  for(const object of this.occluded||[])if(!hit.has(object))for(const m of Array.isArray(object.material)?object.material:[object.material])m.opacity=m.userData.occlusionBaseOpacity??1;
  for(const object of hit)for(const m of Array.isArray(object.material)?object.material:[object.material])m.opacity=(cutaway.has(object)?.025:.2)*(m.userData.occlusionBaseOpacity??1);
  this.occluded=hit;if(this.boatOutline)this.boatOutline.visible=hit.size>0&&!this.focus&&!this.player.onLand;this.jack.outline(hit.size>0&&!this.focus&&this.player.onLand&&!interior);
 }
 activateIsland(id){
  if(id==='education-duan'){const index=this.controllers.get('education')?.cycleDuanTheme(this.settings.reduced)??0;const theme=duanThemes[index];this.events.trigger('message',[`${theme.title} · ${theme.description}`]);return;}
  if(id==='education-fence'){const pattern=this.controllers.get('education')?.cycleCampusFence(this.settings.reduced);this.events.trigger('message',[['The Fence · Make something together.','The Fence · Stay curious.','The Fence · A little color, a new idea.'][pattern??0]]);return;}
  if(id==='learning-book')id='learning';const island=resolveIsland(id);if(!island||!islandActions[id])return;
  const controller=this.controllers.get(island.id);controller?.activate(id);this.loadModel(island.id);this.jack?.interact();this.feedback.splash(this.player?.walking?this.character.position:island.action,{kind:id==='harbor'?'bell':'click',strength:.8});
  if(id==='harbor')this.findSecret('bell');if(id==='connect')this.findSecret('signal');
  const texts=['One step is progress.','Start small.','Make room for a pause.'];const message=id==='affirmation'?texts[(this.affirmationIndex=(this.affirmationIndex??-1)+1)%texts.length]:islandActions[id][1];this.events.trigger('message',[message]);
 }
 interact(){if(!this.frozen&&!this.practice?.active)this.nearAction?.run();}
 findSecret(id){if(this.discovery?.secret(id)){this.feedback.splash(this.boat.position,{celebrate:true,kind:'discover'});this.events.trigger('discovery',[id]);}}
 challengeEvent(event){
  if(event.type==='release'){
   if(this.pendingResume?.epoch===this.challenges.epoch){this.boat.restore(this.pendingResume.boat);this.props.restore(this.pendingResume.props);this.prev.copy(vec(this.boat.position.x,this.boat.position.y,this.boat.position.z));this.prevYaw=this.boat.yaw;}
   this.pendingResume=null;if(this.mode==='exploring'&&!this.player?.pauseReasons.size&&!this.player?.transitioning)this.inputs.setEnabled(true);
  }
  if(event.type==='gate'){this.feedback.splash(event.position,{celebrate:true,kind:'gate',strength:1});this.events.trigger('split',[event]);}
  if(event.type==='delivery'){this.props.deliver(event.id);this.feedback.splash(event.position,{celebrate:true,kind:'gate'});}
  if(event.type==='lamp'){this.feedback.splash(lamps.find(l=>l.id===event.id),{celebrate:true,kind:'gate'});}
  if(event.type==='wrong-lamp')this.events.trigger('message',['Try the clue again. Your route stays the same.']);
  if(event.type==='finish'){
   const best=this.discovery?.complete(event.kind,event.elapsed)||0;this.feedback.splash(this.boat.position,{celebrate:true,kind:'finish'});if(event.kind==='lighthouse')this.controllers.get('education')?.activate('learning');
   this.events.trigger('finish',[{...event,best}]);
  }
 }
 pause(kind='read',focus=null){
  if(focus&&this.loaded.has(focus.id))this.loadModel(focus.id);
  if(this.mode==='exploring'&&!this.snapshot)this.snapshot={boat:this.boat.snapshot(),props:this.props.snapshot(),epoch:this.challenges.epoch};
  const reason=kind==='hidden'?'hidden':kind==='travel'?'travel':'read';this.player?.pauseReasons.add(reason);
  this.challenges.pause();this.practice?.pause();this.mode=kind;if(kind!=='hidden')this.focus=focus;this.inputs.setEnabled(false);this.character?.hold();if(ridingVehicle(this.player))landVehicle(this)?.hold();this.accumulator=0;
  if(kind!=='hidden')this.syncCameraTransition();
 }
 dock(island){this.cancelChallenge();this.boat.hold();this.snapshot=null;this.pause('dock',island);this.snapshot=null;}
 resume(reason='read'){
  if(this.player){this.player.pauseReasons.delete(reason);if(this.player.pauseReasons.size){this.mode=this.player.pauseReasons.has('hidden')?'hidden':'read';return;}}
  if(this.mode==='exploring'||this.recovery)return;
  if(this.snapshot&&this.challenges.active&&this.snapshot.epoch===this.challenges.epoch){this.pendingResume=this.snapshot;this.challenges.resume();}else this.boat.hold();
  this.practice?.resume();this.character?.hold();if(ridingVehicle(this.player))landVehicle(this)?.hold();this.snapshot=null;this.focus=null;this.mode='exploring';this.accumulator=0;this.syncCameraTransition();this.inputs.setEnabled(!this.frozen);this.last=performance.now();
 }
 cancelChallenge(){this.recovery=null;this.marine?.onTravel();this.challenges.cancel();this.snapshot=null;this.pendingResume=null;this.props?.resetCargo();}
 cancelTravel(){this.travelEpoch=(this.travelEpoch||0)+1;this.arrival?.cancel();this.player?.pauseReasons.delete('travel');}
 beginTravel(){
  this.cancelTravel();this.boarding?.cancel();this.cancelPractice(false);this.cancelChallenge();
  this.player.pauseReasons.delete('read');this.snapshot=null;this.pendingResume=null;this.pause('travel');return this.travelEpoch;
 }
 async travelToIsland(island,epoch=this.beginTravel()){
  try{
   const walk=await this.prepareAshore(island);if(epoch!==this.travelEpoch)return false;
   const berth=this.selectBerth(island,walk);if(!berth)throw new Error('The landing is busy. Please try Travel here again, or read the island from the menu.');
   for(const car of this.garageCars||[]){car.park(true);car.setOccupied(false);}
   this.quadBike?.park(true);this.bicycle?.park(true);this.player.toSailing();this.player.mode='walking';
   this.fleet?.onTravel();this.marine?.onTravel();this.docks?.reset();this.accumulator=0;
   this.commitBoarding('ashore',island,berth,walk);this.updateNearby(0,performance.now(),true);
   this.events.trigger('locomotion',['walking']);return true;
  }catch(error){if(epoch===this.travelEpoch)this.events.trigger('message',[error.message]);return false;}
 }
 finishTravel(epoch){
  if(epoch!==this.travelEpoch)return false;
  this.player.pauseReasons.delete('travel');this.snapshot=null;this.pendingResume=null;
  this.mode=this.player.pauseReasons.has('hidden')?'hidden':this.player.pauseReasons.size?'read':'exploring';
  if(!this.player.pauseReasons.has('read'))this.focus=null;
  this.boat.hold();this.character.hold();if(ridingVehicle(this.player))landVehicle(this)?.hold();
  this.accumulator=0;this.resetCamera();this.inputs.setEnabled(!this.frozen);this.last=performance.now();return true;
 }
 skipArrival(){if(!this.arrival?.active)return false;this.arrival.cancel();this.resetCamera();this.inputs.setEnabled(!this.frozen);return true;}
 teleport(point){
  this.cancelTravel();this.cancelPractice(false);
  const wasHidden=this.player?.pauseReasons.has('hidden');this.boarding?.cancel();for(const car of this.garageCars||[]){car.park(true);car.setOccupied(false);}if(this.quadBike)this.quadBike.park(true);if(this.bicycle)this.bicycle.park(true);this.player?.toSailing();this.player?.pauseReasons.clear();this.boat.park?.(false);this.cancelChallenge();this.fleet?.onTravel();this.marine?.onTravel();this.docks?.reset();this.focus=null;this.mode='exploring';this.props.resetNear(point);point=this.safePoint(point);this.boat.teleport(point);this.accumulator=0;this.clearWake();this.feedback.clear();this.resetCamera();this.updateNearby(0,performance.now(),false);this.inputs.setEnabled(true);if(wasHidden)this.pause('hidden');this.last=performance.now();
 }
 safePoint(point){
  this.world.propagateModifiedBodyPositionsToColliders();this.world.updateSceneQueries();
  const q={x:0,y:Math.sin((point.yaw||0)/2),z:0,w:Math.cos((point.yaw||0)/2)},shape=new RAPIER.Cuboid(.85,.7,2.1);
  const candidates=[point];for(const radius of [3,6,9,12])for(let n=0;n<12;n++)candidates.push({...point,x:point.x+Math.cos(n/12*Math.PI*2)*radius,z:point.z+Math.sin(n/12*Math.PI*2)*radius});
  const free=candidates.find(p=>Math.hypot(p.x,p.z)<WORLD_RADIUS-5&&!this.world.intersectionWithShape({x:p.x,y:.35,z:p.z},q,shape,undefined,SEA_GROUP,this.boat.collider,this.boat.body));
  if(!free)throw new Error('No safe water at destination');return free;
 }
 reset(){this.cancelTravel();this.cancelPractice(false);this.snapshot=null;this.pendingResume=null;this.boarding?.cancel();if(ridingVehicle(this.player)&&landVehicle(this)){const vehicle=landVehicle(this);const point=vehicle.safeReset?.()||(!vehicle.safeReset?vehicle.spawn:null);if(!point){vehicle.hold();this.events.trigger('message',['No clear garage bay. Move into an open space first.']);return this.player.island;}vehicle.park(false);vehicle.teleport(point);this.player.pauseReasons.clear();this.mode='exploring';this.focus=null;this.inputs.setEnabled(true);this.resetCamera();return this.player.island;}if(this.player?.walking){this.character.teleport(this.player.berth.landing);this.jack?.resetPose('idle');this.player.pauseReasons.clear();this.mode='exploring';this.focus=null;this.inputs.setEnabled(true);this.resetCamera();return this.player.island;}const i=nearestIsland(this.boat.position);this.teleport({...i.dock,yaw:i.yaw});return i;}
 startChallenge(id){const config=challenges.find(c=>c.id===id);if(!config)return;this.teleport(config.spawn);this.challenges.start(id);this.inputs.setEnabled(!this.challenges.frozen);}
 startRace(){this.startChallenge('buoy');}
 practiceEvent(event){
  if(event.type==='release')this.inputs.setEnabled(!this.frozen);
  if(event.type==='hit'){const p=localToWorld(this.player.island,this.practice.ball);this.spatialSound('wood',p,.35);}
  if(event.type==='finish')this.events.trigger('practicefinish',[event]);
 }
 startPractice(kind){
  if(!this.player.walking||this.player.island?.id!=='about'||this.player.pauseReasons.size||this.player.transitioning)return false;
  const sports=this.walkLayouts.get('about')?.sports;if(!sports?.[kind])return false;
  if(this.garageCars?.length){
   // Preflight the full player movement area and exit, including the golfer's
   // rotating stance around each tee. Static court furniture is not a car.
   const c=sports.tennis,min=c.baseline?.minX??12,max=c.baseline?.maxX??20,z=c.baseline?.z??4;
   const spots=kind==='tennis'?Array.from({length:Math.ceil((max-min)/.5)+1},(_,n)=>({x:Math.min(max,min+n*.5),z})):sports.golf.holes.map(h=>h.tee);
   spots.push(sports[kind].exit);
   const blocked=spots.some(p=>{const q=localToWorld(this.player.island,p);return this.garageCars.some(car=>overlaps({...q,yaw:0,w:1,l:1},{...car.position,yaw:car.yaw,w:car.spec.collisionHalfWidth,l:car.spec.collisionHalfLength}));});
   if(blocked){this.events.trigger('message',['Move the parked car away from the practice area first.']);return false;}
  }
  this.cancelPractice(false);this.cancelChallenge();this.character.hold();this.practice.configure(sports,this.character.walkWorld.layout.groundY);if(!this.practice.start(kind))return false;
  this.practiceIsland=this.player.island;this.practiceView??=new EstatePracticeView(this.scene,this.practiceIsland);
  const p=localToWorld(this.practiceIsland,this.practice.actor);p.y=Math.max(p.y,this.character.walkWorld.groundAt(p));this.character.teleport(p);this.jack.resetPose('idle');this.jack.forceFrame=true;this.inputs.setEnabled(false);this.resetCamera();return true;
 }
 cancelPractice(returnToEntry=true){
  if(!this.practice?.active)return;const kind=this.practice.kind,config=this.practice.config?.[kind],island=this.practiceIsland;
  this.practice.cancel();this.practiceView?.update(this.practice);this.jack?.estatePose?.reset();this.jack?.resetPose('idle');
  if(returnToEntry&&this.player.walking&&this.player.island===island){const point=localToWorld(island,config.exit);point.y=this.character.walkWorld.groundAt(point);this.character.teleport(point);}
  this.inputs.clear();if(this.mode==='exploring'){this.inputs.setEnabled(!this.frozen);this.resetCamera();}
 }
 stepPractice(dt){
  const before=this.character.position;
  this.practice.tick(dt,this.inputs.readPractice());
  const p=localToWorld(this.practiceIsland,this.practice.actor);p.y=Math.max(p.y,this.character.walkWorld.groundAt(p));
  this.character.previous={...before};this.character.body.setNextKinematicTranslation({x:p.x,y:p.y+CHARACTER.height/2+CHARACTER.offset,z:p.z});this.character.velocity={x:(p.x-before.x)/dt,y:0,z:(p.z-before.z)/dt};this.character.yaw=p.yaw;
 }
 practiceFocus(){
  if(!this.practice?.active||!this.practiceIsland)return null;
  const tennis=this.practice.kind==='tennis',hole=this.practice.config.golf?.holes[Math.min(this.practice.index,2)];
  const court=this.practice.tennisConfig;
  const local=tennis?{x:(court.courtMinX+court.courtMaxX)/2,z:(court.machineZ+court.baselineZ+1.5)/2,y:1.1}:{x:(hole.tee.x+hole.cup.x)/2,z:hole.tee.z,y:1};
  const fitBounds=tennis?{min:[court.courtMinX,.85,court.machineZ-1.5],max:[court.courtMaxX,3,court.baselineZ+3]}:{min:[hole.tee.x-1.2,.85,hole.tee.z-1.8],max:[hole.cup.x+1.2,2.7,hole.cup.z+1.8]};
  return campusStationFocus(this.practiceIsland,{...local,camera:{practice:true,azimuth:this.practiceIsland.rotation,elevation:.8,fitBounds}});
 }
 setZoom(index){if(this.player?.onLand)this.settings.walkZoom=Math.max(0,Math.min(2,index));else this.cameraRig.setZoom(index);this.discovery?.save();this.events.trigger('zoom',[this.settings.zoom]);}
 async loadWalkLayouts(){try{const r=await fetch('/models/walk-layout.json?v=16');if(!r.ok)throw new Error('Walk layout unavailable');const data=await r.json();this.walkLayouts=new Map((data.islands||data).map(i=>[i.id,i]));}catch(e){console.warn(e.message);this.walkLayouts=new Map();}}
 async prepareAshore(island){this.inputs.setEnabled(false);this.events.trigger('message',['Preparing '+island.name+' for a little walk…']);
  if(!this.walkLayouts?.size)await this.loadWalkLayouts();await Promise.all([this.loadModel(island.id),this.jack.load()]);const layout=this.walkLayouts.get(island.id);if(!layout||!this.loaded.get(island.id).model||!this.jack.ready)throw new Error('The island is still loading. You can read it now or try going ashore again.');
  const walk=this.ensureWalkWorld(island);if(island.id==='projects')await this.installQuadBike(island,walk);if(island.id==='education')await this.installBicycle(island,walk);if(island.id==='about')await this.installGarageCars(island,walk);return walk;
 }
 ensureWalkWorld(island){
  if(island.id==='about'&&this.loaded.get(island.id)?.model)installEstateNet(this.loaded.get(island.id).model,this.walkLayouts.get(island.id));
  if(!this.walkWorlds.has(island.id)){const walk=new IslandWalkWorld(RAPIER,this.world,island,this.walkLayouts.get(island.id));this.walkWorlds.set(island.id,walk);this.createLandActions(island,walk.layout);this.world.propagateModifiedBodyPositionsToColliders();this.world.updateSceneQueries();}
  return this.walkWorlds.get(island.id);
 }
 async installGarageCars(island,walk){
  if(this.garageLoading)return this.garageLoading;
  this.garageCars??=[];
  if(this.garageCars.length===GARAGE_CARS.length)return this.garageCars;
  this.garageLoading=(async()=>{
   for(const config of GARAGE_CARS){
    if(this.garageCars.some(car=>car.id===config.id))continue;
    let car;
    try{
     let quality=this.settings.quality==='low'?'low':'high';
     let gltf=await this.loader.loadAsync(garageCarAssetURL(config.id,quality));
     if(quality!==(this.settings.quality==='low'?'low':'high')){quality=this.settings.quality==='low'?'low':'high';gltf=await this.loader.loadAsync(garageCarAssetURL(config.id,quality));}
     const spawn=garageSpawn(walk,config.bay),spec=carSpec(config);
     if(!quadFootprintClear(walk,spawn,spawn.yaw,spec.collisionHalfWidth,spec.collisionHalfLength))throw Error('Garage bay is occupied.');
     car=new GarageCarController(RAPIER,this.world,walk,spawn,config);car.setModel(gltf.scene,quality);this.scene.add(car.group);
     car.marker=label('E',{width:64,height:64,worldWidth:.45,background:'#254f62',color:'#fff5dd',fontSize:32});car.marker.visible=false;this.scene.add(car.marker);this.garageCars.push(car);
    }catch(error){car?.dispose();console.warn(config.label+' unavailable',error.message);this.events.trigger('message',[config.label+' could not load. You can still explore on foot.']);}
   }
   this.world.propagateModifiedBodyPositionsToColliders();this.world.updateSceneQueries();await this.reloadCarQuality();return this.garageCars;
  })().finally(()=>{this.garageLoading=null;});return this.garageLoading;
 }
 async reloadCarQuality(){
  if(this.carReloading)return this.carReloading;
  this.carReloading=(async()=>{
   const failed=new Map();
   // Re-evaluate the entire live fleet after every await. A newer quality
   // choice or a newly installed car must also reach the latest setting.
   while(true){
    const quality=this.settings.quality==='low'?'low':'high';
    const car=(this.garageCars||[]).find(c=>c.quality!==quality&&failed.get(c)!==quality);if(!car)break;
    try{const gltf=await this.loader.loadAsync(garageCarAssetURL(car.id,quality));car.setModel(gltf.scene,quality);if(this.jack)this.jack.forceFrame=true;}
    catch(error){failed.set(car,quality);console.warn('Car quality switch failed',error.message);}
   }
  })().finally(()=>{this.carReloading=null;});return this.carReloading;
 }

 rideCar(){
  const car=this.nearCar;if(this.frozen||!this.player.walking||!car||this.practice?.active)return false;
  this.cancelChallenge();this.inputs.setEnabled(false);this.character.hold();car.park(false);
  if(!this.player.rideCar(car)){car.park(true);this.inputs.setEnabled(true);return false;}
  car.setOccupied(true);this.jack.forceFrame=true;car.updateVisual(0,true);this.inputs.setEnabled(true);this.resetCamera();this.events.trigger('locomotion',['riding-car']);this.events.trigger('message',['Driving '+car.label+' · WASD to drive · Shift for 2× speed · E to exit.']);return true;
 }
 dismountCar(){
  const car=this.player.car;if(this.frozen||!this.player.ridingCar||!car)return false;
  const point=car.dismountPoint();if(!point){car.hold();this.events.trigger('message',['Move the car into an open space to get out.']);return false;}
  this.inputs.setEnabled(false);car.park(true);
  if(!this.player.leaveCar(point)){car.park(false);this.inputs.setEnabled(true);return false;}
  car.setOccupied(false);this.jack.resetPose('idle');this.inputs.setEnabled(true);this.resetCamera();this.events.trigger('locomotion',['walking']);return true;
 }
 async installQuadBike(island,walk){
  if(this.quadBike)return this.quadBike;
  if(this.quadLoading)return this.quadLoading;
  this.quadLoading=(async()=>{
   try{
    const quality=this.settings.quality==='low'?'low':'high',path=quality==='low'?'/models/low/quad-bike.glb?v=12.1':'/models/quad-bike.glb?v=12.1',gltf=await this.loader.loadAsync(path);
    const p=localToWorld(island,{...QUAD_BIKE.localSpawn,y:walk.layout.groundY??.85});p.y=walk.groundAt(p);p.yaw=island.rotation+QUAD_BIKE.localSpawn.yaw;
    if(!quadFootprintClear(walk,p,p.yaw)){
     const alternatives=[[2.5,26.4],[3,26],[-2.5,26.4],[-3,26]];let spawn=null;
     for(const [x,z]of alternatives){const q=localToWorld(island,{x,z,y:walk.layout.groundY??.85,yaw:QUAD_BIKE.localSpawn.yaw});q.y=walk.groundAt(q);q.yaw=island.rotation+QUAD_BIKE.localSpawn.yaw;if(quadFootprintClear(walk,q,q.yaw)){spawn=q;break;}}
     if(!spawn)throw new Error('The Projects harbor parking space is temporarily unavailable.');
     Object.assign(p,spawn);
    }
    this.quadBike=new QuadBikeController(RAPIER,this.world,walk,p);this.quadBike.setModel(gltf.scene,quality);this.scene.add(this.quadBike.group);this.player.quad=this.quadBike;this.quadBikeSpawn={...p};
    this.quadRideMarker=label('E',{width:64,height:64,worldWidth:.45,background:'#254f62',color:'#fff5dd',fontSize:32});this.scene.add(this.quadRideMarker);this.quadRideMarker.visible=false;
    this.world.propagateModifiedBodyPositionsToColliders();this.world.updateSceneQueries();return this.quadBike;
   }catch(error){console.warn('Quad bike unavailable',error.message);this.events.trigger('asseterror',['quad-bike']);return null;}
   finally{this.quadLoading=null;}
  })();return this.quadLoading;
 }
 async installBicycle(island,walk){
  if(this.bicycle)return this.bicycle;
  if(this.bicycleLoading)return this.bicycleLoading;
  this.bicycleLoading=(async()=>{try{
   let quality=this.settings.quality==='low'?'low':'high';
   let gltf=await this.loader.loadAsync(`/models/${quality==='low'?'low/':''}bicycle.glb?v=14.2.3`);
   if(quality!==(this.settings.quality==='low'?'low':'high')){quality=this.settings.quality==='low'?'low':'high';gltf=await this.loader.loadAsync(`/models/${quality==='low'?'low/':''}bicycle.glb?v=14.2.3`);}
   let spawn=null;
   for(const [x,z]of [[BICYCLE.localSpawn.x,BICYCLE.localSpawn.z],[3.8,18.3],[3.2,17.8]]){
    const p=localToWorld(island,{x,z,yaw:BICYCLE.localSpawn.yaw});p.y=walk.groundAt(p);
    if(bicycleFootprintClear(walk,p,p.yaw)){spawn=p;break;}
   }
   if(!spawn)throw new Error('The campus bicycle parking space is unavailable.');
   const bicycle=new BicycleController(RAPIER,this.world,walk,spawn);
   try{bicycle.setModel(gltf.scene,quality);bicycle.setSurfaceModel(this.loaded?.get(island.id)?.model);}catch(error){bicycle.dispose();throw error;}
   this.bicycle=bicycle;this.scene.add(bicycle.group);this.player.bicycle=bicycle;
   this.bicycleRideMarker=label('E',{width:64,height:64,worldWidth:.4,background:'#254f62',color:'#fff5dd',fontSize:32});this.scene.add(this.bicycleRideMarker);this.bicycleRideMarker.visible=false;
   this.world.propagateModifiedBodyPositionsToColliders();this.world.updateSceneQueries();return this.bicycle;
  }catch(error){console.warn('Campus bicycle unavailable',error.message);this.events.trigger('message',['The bicycle could not load. You can explore on foot and retry on your next visit.']);return null;}finally{this.bicycleLoading=null;}})();return this.bicycleLoading;
 }
 async reloadBicycleQuality(){
  if(!this.bicycle||this.bicycleReloading)return;
  this.bicycleReloading=true;
  try{while(this.bicycle&&this.bicycle.quality!==(this.settings.quality==='low'?'low':'high')){
   const quality=this.settings.quality==='low'?'low':'high',gltf=await this.loader.loadAsync(`/models/${quality==='low'?'low/':''}bicycle.glb?v=14.2.3`);
   this.bicycle.setModel(gltf.scene,quality);
  }}catch(error){console.warn('Bicycle quality switch failed',error.message);}finally{this.bicycleReloading=false;}
 }
 rideBicycle(){
  if(this.frozen||!this.player.walking||!this.canRideBicycle||!this.bicycle)return false;
  this.cancelChallenge();this.inputs.setEnabled(false);this.character.hold();this.bicycle.park(false);
  if(!this.player.rideBicycle(this.bicycle)){this.bicycle.park(true);this.inputs.setEnabled(true);return false;}
  this.bicycle.hold();this.inputs.setEnabled(true);this.resetCamera();this.events.trigger('locomotion',['riding-bicycle']);this.events.trigger('message',['WASD to cycle · Shift for 2× speed · E to get off · F to read.']);return true;
 }
 dismountBicycle(){
  if(this.frozen||!this.player.ridingBicycle||!this.bicycle)return false;
  const point=this.bicycle.dismountPoint();if(!point){this.events.trigger('message',['Move onto an open path to get off the bicycle.']);return false;}
  this.inputs.setEnabled(false);this.bicycle.park(true);
  if(!this.player.leaveBicycle(point)){this.bicycle.park(false);this.inputs.setEnabled(true);return false;}
  this.jack.resetPose('idle');this.inputs.setEnabled(true);this.resetCamera();this.events.trigger('locomotion',['walking']);return true;
 }
 selectBerth(island,walk){const candidates=(walk.layout.berths||[{boat:{x:-3,z:14,yaw:0},landing:{x:-.6,z:14,y:.85,yaw:0}},{boat:{x:3,z:14,yaw:0},landing:{x:.6,z:14,y:.85,yaw:0}}]).map(b=>({boat:localToWorld(island,b.boat),landing:localToWorld(island,{...b.landing,yaw:0})})).sort((a,b)=>Math.hypot(a.boat.x-this.boat.position.x,a.boat.z-this.boat.position.z)-Math.hypot(b.boat.x-this.boat.position.x,b.boat.z-this.boat.position.z));
  this.world.propagateModifiedBodyPositionsToColliders();this.world.updateSceneQueries();return candidates.find(b=>walk.clear(b.landing)&&!this.world.intersectionWithShape({x:b.boat.x,y:.35,z:b.boat.z},{x:0,y:Math.sin(b.boat.yaw/2),z:0,w:Math.cos(b.boat.yaw/2)},new RAPIER.Cuboid(.85,.7,2.1),undefined,SEA_GROUP,this.boat.collider,this.boat.body));
 }
 commitBoarding(kind,island,berth,walk){if(kind==='ashore'){
  this.boat.teleport(berth.boat);this.boat.park(true);this.character.teleport(berth.landing,walk);this.character.enable(true);this.player.island=island;this.player.berth=berth;this.player.ashoreTime=0;this.jack?.resetPose('idle');
  if(this.arrival)this.arrival.start(island,arrivalBounds(island,new THREE.Box3().setFromObject(this.loaded.get(island.id).group,true)));
 }else{this.character.enable(false);this.character.seated=false;this.boat.park(false);this.boat.hold();this.player.island=null;this.player.berth=null;for(const actions of this.landActions.values())for(const a of actions)a.object.visible=false;}
 this.clearWake();this.feedback.clear();this.prev.copy(vec(this.boat.position.x,this.boat.position.y,this.boat.position.z));this.prevYaw=this.boat.yaw;this.snapshot=null;this.pendingResume=null;this.resetCamera();this.events.trigger('message',[kind==='ashore'?'Welcome ashore. WASD to walk · E to read · F to interact.':'Back aboard. Your next island is waiting.']);
 }
 async goAshore(){if(!this.nearby||this.player.mode!=='sailing'||this.frozen)return false;this.cancelChallenge();this.boat.hold();this.inputs.setEnabled(false);const result=await this.boarding.disembark(this.nearby);if(!result&&!this.frozen)this.inputs.setEnabled(true);return result;}
 boardBoat(){if(this.practice?.active)this.cancelPractice();if(this.frozen||!this.player.walking)return false;this.inputs.setEnabled(false);this.character.hold();return this.boarding.board();}
 rideQuad(){if(this.frozen||!this.player.walking||!this.canRideQuad||!this.quadBike)return false;this.cancelChallenge();this.inputs.setEnabled(false);this.character.hold();this.quadBike.park(false);this.quadBike.hold();if(!this.player.rideQuad(this.quadBike)){this.quadBike.park(true);this.inputs.setEnabled(true);return false;}this.quadBike.hold();this.inputs.setEnabled(true);this.resetCamera();this.events.trigger('locomotion',['riding-quad']);this.events.trigger('message',['WASD to ride · Shift to boost · E to get off.']);return true;}
 dismountQuad(){if(this.frozen||!this.player.ridingQuad||!this.quadBike)return false;const point=this.quadBike.dismountPoint();if(!point){this.events.trigger('message',['There is no clear spot to get off. Move the quad bike onto an open path first.']);return false;}this.inputs.setEnabled(false);this.quadBike.park(true);if(!this.player.leaveQuad(point)){this.quadBike.park(false);this.inputs.setEnabled(true);return false;}this.jack.resetPose('idle');this.inputs.setEnabled(true);this.resetCamera();this.events.trigger('locomotion',['walking']);this.events.trigger('message',['Back on foot · Explore the island.']);return true;}
 primaryAction(){
  if(this.frozen||this.practice?.active)return;
  if(!this.player.walking&&!ridingVehicle(this.player))return this.goAshore();
  switch(landPrimaryAction(this)?.kind){
   case 'mount-car':return this.rideCar();
   case 'dismount-car':return this.dismountCar();
   case 'mount-bicycle':return this.rideBicycle();
   case 'dismount-bicycle':return this.dismountBicycle();
   case 'mount':return this.rideQuad();
   case 'dismount':return this.dismountQuad();
   case 'board':return this.boardBoat();
   case 'read':return this.nearStation.run();
  }
 }
 createLandActions(island,layout){const actions=[];for(const station of [...layout.stations,...(layout.benches||[layout.bench]).filter(Boolean).map((bench,n)=>({...bench,id:bench.id||'bench-'+n,type:'bench',label:bench.label||'Sit for a moment'}))]){
  const point=localToWorld(island,station.type==='bench'?station.approach:{...station,y:station.y??layout.groundY??.85});const kind=station.type;
  const marker=label(kind==='read'?'E':'F',{width:64,height:64,worldWidth:.45,fontSize:32,background:'#fff5dd',color:'#254f62'});marker.position.set(point.x,point.y+1.65,point.z);marker.visible=false;this.scene.add(marker);
  const action=new Interactable({id:island.id+':'+station.id,label:station.label,position:point,range:1.8,object:marker,run:({direct=false}={})=>{if(this.frozen||(!this.player.walking&&!(ridingVehicle(this.player)&&kind==='read'&&station.readFull)))return;this.inputs.clear();this.activeActor.hold();if(!ridingVehicle(this.player))this.jack.interact();
   if(kind==='read')this.events.trigger('exhibit',[{island:island.id,station:station.directory&&!direct?{...station,contentId:'projects'}:station,position:point}]);else if(kind==='practice')this.events.trigger('practiceopen',[station.practiceId]);else if(kind==='studio')this.events.trigger('studio');else if(kind==='challenge')this.events.trigger('challengeopen',['lighthouse']);else if(kind==='bench'){this.character.teleport({...point,y:this.character.walkWorld.groundAt(point),yaw:(station.yaw||0)+island.rotation});const seat=localToWorld(island,station);this.character.seatYaw=(station.yaw||0)+island.rotation+Math.PI;this.character.seatVisual=this.jack.seatPosition(seat,station.y+.06,this.character.seatYaw);this.character.seated=true;this.character.seatAction=station.action||null;if(station.action==='education-study')this.controllers.get('education')?.setStudySeated(true);if(station.contentId==='affirmation')this.activateIsland('affirmation');}else{this.activateIsland(station.action||station.contentId);if(station.action==='rag')this.events.trigger('message',['Concept illustration · Retrieve, add context, and respond.']);}
  }});action.kind=kind;action.station=station;
  if(station.hitArea){
   const h=station.hitArea,center=localToWorld(island,h);
   const proxy=new THREE.Mesh(new THREE.PlaneGeometry(h.width,h.height),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
   proxy.position.set(center.x,center.y,center.z);proxy.rotation.y=island.rotation+(h.yaw||0);this.scene.add(proxy);action.hitObject=proxy;
   const highlight=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(h.width+.1,h.height+.1)),new THREE.LineBasicMaterial({color:'#ffe3a6',transparent:true,opacity:.9}));
   highlight.position.copy(proxy.position);highlight.rotation.copy(proxy.rotation);highlight.translateZ(.025);highlight.visible=false;this.scene.add(highlight);action.highlight=highlight;
  }
  if(station.primary){
   const sign=label(`${station.number?station.number+'  ':''}${station.label}  /  ${exhibitReadLabel({station}).toUpperCase()}`,{width:1024,height:110,worldWidth:4.2,fontSize:34,background:'#fff5dd',color:'#254f62'});
   sign.position.set(point.x,point.y+3.15,point.z);sign.visible=false;this.scene.add(sign);action.sign=sign;
  }
  actions.push(action);
 }this.landActions.set(island.id,actions);}
 setQuality(level){this.settings.quality=level;this.reloadCarQuality();this.renderer.setPixelRatio(Math.min(devicePixelRatio,level==='low'?1:1.5));this.lighting.setQuality(level);this.bayWater.setQuality(level);if(this.mode!=='loading')this.surfaces.loadQuality(level);this.details?.setQuality();for(const [id,item] of this.loaded)if(item.requested&&item.requestedQuality!==level)this.loadModel(id,true);if(this.bicycle&&this.bicycle.quality!==(level==='low'?'low':'high'))this.reloadBicycleQuality();if(this.quadBike&&this.quadBike.quality!==(level==='low'?'low':'high'))this.reloadQuadQuality(level);}
 async reloadQuadQuality(level){if(!this.quadBike||this.quadReloading)return;this.quadReloading=true;try{const quality=level==='low'?'low':'high',path=quality==='low'?'/models/low/quad-bike.glb?v=12.1':'/models/quad-bike.glb?v=12.1',gltf=await this.loader.loadAsync(path);this.quadBike.setModel(gltf.scene,quality);}catch(error){console.warn('Quad bike quality switch failed',error.message);}finally{this.quadReloading=false;}}
 project(point){return vec(point.x,point.y||0,point.z).project(this.camera);}
 spatialSound(kind,p,strength=1){const distance=Math.hypot(p.x-this.activeActor.position.x,p.z-this.activeActor.position.z),gain=Math.max(0,1-distance/60)*strength;if(gain>.01)this.events.trigger('sound',[{kind,strength:gain}]);}
 horn(){if(!this.player?.onLand&&!this.frozen&&this.fleet?.horn(this.boat.position)){this.feedback.splash(this.boat.position,{strength:.3,kind:'water'});return true;}return false;}
 educationFocus(schoolId){
  return campusStationFocus(islands.find(i=>i.id==='education'),this.walkLayouts?.get('education')?.stations.find(s=>s.schoolId===schoolId&&s.primary));
 }
 landmarkFocus(landmarkId){
  return campusStationFocus(islands.find(i=>i.id==='education'),this.walkLayouts?.get('education')?.stations.find(s=>s.landmarkId===landmarkId));
 }
 readSchool(schoolId){this.controllers.get('education')?.readSchool(schoolId);}
 endSchoolRead(){this.controllers.get('education')?.readSchool(null);}
 setLivery(id){const livery=this.appearance?.setLivery(id);this.discovery?.save();return livery;}
 status(){return{practice:this.practice?.status(),player:{cars:(this.garageCars||[]).map(car=>({...car.status(),access:car.accessPoints(),rider:this.player.ridingCar&&this.player.car===car?this.jack.carPose.contactStatus(car):null})),nearCar:this.nearCar?.id||null,car:this.player.ridingCar?this.player.car?.id:null,mode:this.player.mode,position:{...this.activeActor.position},heading:this.activeActor.yaw,speed:this.activeActor.speed,island:this.player.island?.id||null,parkedBoat:this.boat.parked?{...this.boat.position}:null,quadBike:this.quadBike?{position:{...this.quadBike.position},parked:this.quadBike.parked,quality:this.quadBike.quality,heading:this.quadBike.yaw,wheelAngle:this.quadBike.wheelAngle||0,wheels:this.quadBike.wheelPivots.length,rider:this.player.ridingQuad?this.jack.quadContactStatus(this.quadBike):null,spawn:{...this.quadBikeSpawn}}:null,bicycle:this.bicycle?{...this.bicycle.status(),rider:this.player.ridingBicycle?this.jack.bicycleContactStatus(this.bicycle):null}:null,seated:this.character.seated,ashore:[...(this.discovery?.ashore||[])],transitionEpoch:this.player.transitionEpoch,pauseReasons:[...this.player.pauseReasons],jackReady:this.jack.ready,stations:this.player.island?(this.landActions.get(this.player.island.id)||[]).map(a=>({id:a.id,type:a.kind,label:a.label,position:a.position})):[],nearStation:this.nearStation?.id||null,canBoard:this.canBoard,canRideQuad:this.canRideQuad,canDismountQuad:this.canDismountQuad,canRideBicycle:this.canRideBicycle,canDismountBicycle:this.canDismountBicycle},performance:{frameTimeMs:this.frameTimes?.length?{p50:[...this.frameTimes].sort((a,b)=>a-b)[Math.floor(this.frameTimes.length*.5)],p95:[...this.frameTimes].sort((a,b)=>a-b)[Math.floor(this.frameTimes.length*.95)]}:null,surfaces:this.surfaces.stats(),contactShading:this.lighting.quality!=='low'&&!this.lighting.failed,fpsWindow:this.fpsHistory||[],drawCalls:this.renderer.info.render.drawCalls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,loadedIslands:[...this.loaded.values()].filter(i=>i.model).length,detailVariants:[...this.details.items.values()].reduce((n,i)=>n+i.cache.size,0)},livery:this.settings.livery,fleet:this.fleet?.status(),seaLife:{...this.marine?.status(),sightings:[...(this.discovery?.seaLife||[])]},simulationTime:this.simTime,available3D:true,renderer:this.renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2',fps:this.fps,quality:this.settings.quality,cameraDistance:this.cameraRig.distance,arrival:this.arrival?.active?{island:this.arrival.island.id,elapsed:this.arrival.elapsed,progress:this.arrival.progress}:null,travelPending:this.player.pauseReasons.has('travel'),cameraView:{azimuth:this.cameraRig.yaw,landAzimuth:this.player.onLand?this.player.island?.rotation:null,transitioning:!!this.cameraTransition?.active,fade:this.cameraTransition?.opacity||0},viewport:{width:innerWidth,height:innerHeight},mode:this.mode,position:{...this.boat.position},speed:this.boat.speed,heading:this.boat.yaw,nearby:this.nearby?.id||null,action:this.nearAction?{id:this.nearAction.id,label:this.nearAction.label}:null,challenge:{kind:this.challenges.kind,state:this.challenges.state,index:this.challenges.index,elapsed:this.challenges.elapsed},zoom:this.settings.zoom,readyMs:this.readyMs,stamps:this.discovery?.stamps||0};}
}
