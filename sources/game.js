import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import { Events } from './core/Events.js';
import {CharacterController,IslandWalkWorld,localToWorld,SEA_GROUP} from './core/character.js';
import {PlayerController,BoardingController} from './core/player.js';
import {JackAvatar} from './world/jack.js';
import { BoatController } from './core/boat.js';
import { CameraRig } from './core/camera.js';
import { ChallengeManager } from './core/challenges.js';
import { createIslandColliders, createBoundaryColliders } from './core/collisions.js';
import { IslandController } from './world/island.js';
import { FeedbackSystem } from './world/feedback.js';
import { Interactable } from './world/interactable.js';
import { syncInteractionMarkers } from './core/interaction-markers.js';
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
import { islands, gates, boatSpawn, WORLD_RADIUS, nearestIsland, inDockZone, cargoBerths, lamps, challenges, secretPlaces, islandActions, reefGroups } from './config.js';
const vec=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const STEP=1/60;

export class Game {
 constructor(canvas,inputs,settings,discovery=null){
  Object.assign(this,{canvas,inputs,settings,discovery});this.events=new Events();this.scene=new THREE.Scene();
  this.scene.background=new THREE.Color('#55acb1');this.scene.fog=new THREE.Fog('#80c8c0',120,310);
  this.camera=new THREE.PerspectiveCamera(28,innerWidth/innerHeight,.2,600);this.mode='loading';this.loaded=new Map();this.controllers=new Map();
  this.time=0;this.accumulator=0;this.wakes=[];this.snapshot=null;this.pendingResume=null;this.focus=null;this.interactables=[];this.actionMarkers=[];this.loadedCount=0;
  this.loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  this.challenges=new ChallengeManager({gates,berths:cargoBerths,onEvent:event=>this.challengeEvent(event)});
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
  await Promise.all([this.loadModel('boat'),this.loadModel('harbor'),this.loadModel('connect'),this.jack.load(),this.loadWalkLayouts()]);
  if(this.jack.model){applySunsetMaterials(this.jack.model,'jack');this.surfaces.bind(this.jack.model,'jack');}
  this.mode='exploring';this.last=performance.now();this.inputs.setEnabled(true);this.setQuality(this.settings.quality);
  window.addEventListener('resize',()=>{this.cameraRig.resize(innerWidth,innerHeight);this.renderer.setSize(innerWidth,innerHeight);});
  this.renderer.setAnimationLoop(()=>this.safeFrame());
  this.readyMs=Math.round(performance.now());this.events.trigger('ready',[this.renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2']);
  this.surfaces.loadQuality(this.settings.quality);
  this.fleet.load().catch(e=>console.warn('Fleet unavailable',e.message));this.marine.load().catch(e=>console.warn('Sea life unavailable',e.message));
 }
 safeFrame(){try{this.frame();}catch(error){this.renderer.setAnimationLoop(null);this.events.trigger('failure',[error]);}}
 createLight(){this.lighting=new BayLighting(this.scene,this.renderer,this.camera,this.settings.quality);this.sun=this.lighting.sun;}
 createWater(){this.bayWater=new BayWater(this.scene,islands,reefGroups,this.settings);this.water=this.bayWater.mesh;this.waterTime=this.bayWater.time;}
 createIslands(){
  for(const i of islands){
   const group=new THREE.Group();group.position.set(i.x,0,i.z);group.rotation.y=i.rotation;this.scene.add(group);
   const shape=new THREE.Shape(i.shore.map(([x,z])=>new THREE.Vector2(x,-z)));
   const geo=new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false}).rotateX(-Math.PI/2);mesh(group,geo,'sand',[0,-.1,0]);box(group,[3,.35,7.9],'woodLight',[0,.55,11.85]);
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
   const gltf=await this.loader.loadAsync('/models/'+(id!=='boat'&&quality==='low'?'low/':'')+id+'.glb?v=6');if(item&&item.revision!==revision){gltf.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});return;}gltf.scene.traverse(o=>{if(o.isMesh){
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
    const shore=item.group.children.filter(o=>o.userData.shore);if(item.model){this.surfaces.release(item.model);releaseSunsetMaterials(item.model);}if(item.model)item.model.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});item.group.clear();item.quality=quality;item.group.add(...shore,gltf.scene);item.model=gltf.scene;applySunsetMaterials(gltf.scene,id);this.controllers.get(id).bind(gltf.scene);this.surfaces.bind(gltf.scene,id);gltf.scene.traverse(o=>{if(o.isMesh&&(Array.isArray(o.material)?o.material:[o.material]).some(m=>m.userData.sunsetMaterial?.role==='glass'))o.castShadow=false;});
   }
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
   const action=new Interactable({id:i.id,label:islandActions[i.id][0],position:i.action,range:8,object:marker,run:()=>i.id==='learning'?this.events.trigger('challengeopen',['lighthouse']):this.activateIsland(i.id)});
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
   if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>8||this.mode!=='exploring'||this.challenges.frozen)return;down=null;
   this.pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);this.raycaster.setFromCamera(this.pointer,this.camera);
   const hit=(this.player.walking?(this.landActions.get(this.player.island.id)||[]):this.interactables).filter(i=>i.object&&i.available()&&i.distance(this.activeActor.position)<(this.player.walking?2.1:10)).find(i=>this.raycaster.intersectObject(i.object,true).length);
   if(hit&&(!this.player.walking||this.character.walkWorld.visible(this.character.position,hit.position)))hit.run();
  });
  this.canvas.addEventListener('wheel',e=>{if(this.mode!=='exploring')return;e.preventDefault();if(!this.wheelTime||performance.now()-this.wheelTime>180){this.wheelTime=performance.now();this.setZoom(this.zoom+(e.deltaY>0?1:-1));}},{passive:false});
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
  this.events.trigger('boardingfade',[this.player.transition?Math.sin(Math.min(1,this.player.transition.elapsed/.6)*Math.PI):0]);
  if(this.mode==='exploring'&&!this.player.pauseReasons.size&&!this.player.transitioning)this.challenges.updateClock();
  const frozen=this.frozen,input=this.player.walking?{}:this.inputs.read(this.boat.yaw,this.cameraRig.yaw);
  if(!frozen){this.accumulator+=dt;while(this.accumulator>=STEP){
    const before={...this.boat.position};this.prev.set(before.x,before.y,before.z);this.prevYaw=this.boat.yaw;this.simTime+=STEP;
    this.fleet?.beforeStep(STEP,this.boat);const actor=this.activeActor;this.marine?.step(STEP,{position:actor.position,velocity:actor.velocity,yaw:actor.yaw,canCompanion:!this.player.walking});
    this.props.beforeStep(before);
    if(this.player.walking)this.character.step(this.inputs.readWalking(this.cameraRig.yaw),STEP);else{this.boat.step(this.inputs.read(this.boat.yaw,this.cameraRig.yaw),STEP);this.enforceBoundary(before);}
    this.world.step(this.queue);if(this.player.walking){this.character.afterStep();this.player.ashoreTime+=STEP;if(this.player.ashoreTime>=1)this.discovery?.land(this.player.island.id);}
    this.props.afterStep(this.queue,this.boat.collider,this.boat.position);if(!this.player.walking)this.challenges.tick(before,this.boat.position,STEP,this.challenges.kind==='cargo'?this.props.cargoData():[]);
    this.accumulator-=STEP;if(this.frozen)break;
  }}else this.accumulator=0;
  const boat=this.boat.position,p=this.activeActor.position,alpha=frozen?1:Math.min(this.accumulator/STEP,1);
  this.visualPosition.lerpVectors(this.prev,vec(boat.x,boat.y,boat.z),alpha);this.boatGroup.position.copy(this.visualPosition);this.boatGroup.rotation.y=this.prevYaw+Math.atan2(Math.sin(this.boat.yaw-this.prevYaw),Math.cos(this.boat.yaw-this.prevYaw))*alpha;
  this.bayWater.update(this.simTime);
  this.boatVisual.position.y=this.settings.reduced?0:Math.sin(this.simTime*2.2)*.06;
  this.boatVisual.rotation.z=THREE.MathUtils.damp(this.boatVisual.rotation.z,this.settings.reduced||frozen?0:-(input.steer||0)*this.boat.speed*.004,8,dt);
  this.boatVisual.rotation.x=THREE.MathUtils.damp(this.boatVisual.rotation.x,this.settings.reduced||frozen?0:-Math.max(0,this.boat.forwardSpeed)*.0025,8,dt);
  this.props.update(alpha,this.simTime,this.settings.reduced);this.bottle.position.y=.25+(this.settings.reduced?0:Math.sin(this.simTime)*.07);
  for(const controller of this.controllers.values()){controller.pedestrian=this.player.walking&&this.player.island.id===controller.island.id?this.character.position:null;controller.update(frozen?0:dt,p,this.simTime,this.focus?.id===controller.island.id,this.settings.reduced);}
  this.appearance?.update(dt,input,this.boat.speed,this.settings.reduced,frozen);this.jack.update(dt,{player:this.player,boatVisual:this.boatVisual,character:this.character,alpha,input,reduced:this.settings.reduced,frozen,lookTarget:this.nearStation?.position});
  this.fleet?.update(alpha,p,this.settings.reduced?0:this.simTime);this.marine?.update(alpha,p,this.camera,this.settings.reduced?0:this.simTime,[...this.loaded.values()].map(i=>i.group).concat(this.fleet?.items.map(i=>i.group)||[]));this.details?.update(frozen?0:dt,p,this.simTime,this.settings.reduced?0:this.simTime,this.controllers);
  this.updateWake(frozen);this.feedback.update(frozen?0:dt);this.updateCamera(dt);this.updateNearby(dt,now,frozen);this.environment.update(this.challenges,this.simTime,p,this.nearAction);this.updateOcclusion(now);
  const lightTarget=this.focus?.boatStudio?this.boat.position:this.focus||p;
  this.lighting.update(lightTarget,!this.focus&&this.player.onLand,this.cameraRig.distance);
  this.events.trigger('frame',[{position:p,yaw:this.activeActor.yaw,speed:this.activeActor.speed,dt,now,frozen}]);this.renderer.info.reset();this.lighting.render();
  if(!frozen&&this.challenges.kind==='cargo'&&this.challenges.state==='running'){const lost=this.props.outOfBounds();if(lost){this.pause('recovery');if(this.props.recoverCargo(lost,boat)){this.snapshot.props=this.props.snapshot();this.resume();this.events.trigger('message',['Cargo recovered. Resuming your run…']);}else{this.recovery=lost;this.events.trigger('message',['No clear recovery berth. Use Reset cargo for a fresh start.']);}}}
  if(this.recovery&&this.mode==='recovery'&&this.props.recoverCargo(this.recovery,boat)){this.recovery=null;this.snapshot.props=this.props.snapshot();this.resume();}
  if(!this.player.walking&&Math.hypot(boat.x,boat.z)>WORLD_RADIUS+9)this.events.trigger('rescue');
 }
 enforceBoundary(p){const distance=Math.hypot(p.x,p.z);if(distance>WORLD_RADIUS-10){const v=this.boat.velocity,out=(v.x*p.x+v.z*p.z)/distance;if(out>0){const f=Math.min(1,(distance-WORLD_RADIUS+10)/10)*.14;this.boat.body.setLinvel({x:v.x-p.x/distance*out*f,y:0,z:v.z-p.z/distance*out*f},true);}}}
 updateNearby(dt,now,frozen){
  const p=this.activeActor.position;this.nearby=this.player?.walking?this.player.island:this.docks?.update(p)||null;
  for(const i of islands){const distance=Math.hypot(p.x-i.x,p.z-i.z),near=inDockZone(this.boat.position,i);if(!frozen){if(distance<40)this.discovery?.discover(i.id);this.discovery?.visit(i.id,near,dt);}const asset=this.loaded.get(i.id);if(!asset.requested&&distance<72&&(!asset.lastFailure||now-asset.lastFailure>5000))this.loadModel(i.id);}
  this.nearStation=null;this.canBoard=false;
  if(this.player?.walking){const list=this.landActions.get(this.player.island.id)||[],old=this.lastStation;
   const possible=list.filter(a=>a.distance(p)<(a===old?2.1:1.8)&&a.visible(this.camera)&&this.character.walkWorld.visible(p,a.position)).sort((a,b)=>a.distance(p)-b.distance(p));this.nearStation=frozen?null:possible[0]||null;this.lastStation=this.nearStation;
   this.canBoard=Math.hypot(p.x-this.player.berth.landing.x,p.z-this.player.berth.landing.z)<2;
   this.nearAction=!this.canBoard&&this.nearStation?.kind!=='read'?this.nearStation:null;
   for(const [id,actions]of this.landActions)for(const a of actions)if(a.object)a.object.visible=!frozen&&id===this.player.island.id&&a===this.nearStation&&!this.canBoard;
  }else{this.nearAction=!frozen?Interactable.nearest(this.interactables,p,this.camera):null;for(const actions of this.landActions.values())for(const a of actions)a.object.visible=false;}
  syncInteractionMarkers(this.actionMarkers,this.nearAction,{frozen,walking:!!this.player?.walking});
  if(!frozen&&!this.player?.walking){if(Math.hypot(p.x-secretPlaces.arch.x,p.z-secretPlaces.arch.z)<3.2)this.findSecret('arch');if(Math.hypot(p.x-secretPlaces.cove.x,p.z-secretPlaces.cove.z)<5)this.findSecret('cove');}
 }
 get activeActor(){return this.player?.activeActor||this.boat;}
 get frozen(){return this.mode!=='exploring'||this.challenges.frozen||!!this.player?.pauseReasons.size||!!this.player?.transitioning||!!this.boarding?.pending;}
 get zoom(){return this.player?.walking?(this.settings.walkZoom??1):(this.settings.zoom??1);}
 updateCamera(dt){const actor=this.activeActor,walking=this.player.onLand,position=walking?this.jack.root.position:this.visualPosition;
  this.cameraRig.update(dt,{position:this.focus?.boatStudio?this.visualPosition:position,velocity:actor.velocity,yaw:actor.yaw,speed:this.frozen?0:actor.speed,input:walking?{}:this.inputs.read(this.boat.yaw,this.cameraRig.yaw),focus:this.focus,locomotion:walking?'walking':'sailing'});
 }
 resetCamera(){const p=this.boat.position;this.visualPosition.set(p.x,p.y,p.z);this.prev.copy(this.visualPosition);this.prevYaw=this.boat.yaw;const a=this.activeActor;this.cameraRig.lastPoint=null;this.cameraRig.update(0,{position:a.position,yaw:a.yaw,locomotion:this.player?.onLand?'walking':'sailing'},true);}
 updateOcclusion(now){
  if(this.lastOcclusion&&now-this.lastOcclusion<100)return;this.lastOcclusion=now;const p=this.activeActor.position,candidates=[...this.environment.occluders];for(const c of this.controllers.values())if(Math.hypot(c.island.x-p.x,c.island.z-p.z)<50)candidates.push(...c.occluders);
  const target=vec(p.x,p.y+(this.player.walking?.7:1),p.z),direction=target.clone().sub(this.camera.position),distance=direction.length();const ray=new THREE.Raycaster(this.camera.position,direction.normalize(),0,distance-.3);this.scene.updateMatrixWorld();const hit=new Set(this.focus?[]:ray.intersectObjects(candidates,false).map(h=>h.object));
  for(const object of this.occluded||[])if(!hit.has(object))for(const m of Array.isArray(object.material)?object.material:[object.material])m.opacity=m.userData.occlusionBaseOpacity??1;
  for(const object of hit)for(const m of Array.isArray(object.material)?object.material:[object.material])m.opacity=.2*(m.userData.occlusionBaseOpacity??1);
  this.occluded=hit;if(this.boatOutline)this.boatOutline.visible=hit.size>0&&!this.focus&&!this.player.walking;this.jack.outline(hit.size>0&&!this.focus&&this.player.walking);
 }
 activateIsland(id){
  const controller=this.controllers.get(id);controller?.activate();this.loadModel(id);this.jack?.interact();this.feedback.splash(this.player?.walking?this.character.position:islands.find(i=>i.id===id).action,{kind:id==='harbor'?'bell':'click',strength:.8});
  if(id==='harbor')this.findSecret('bell');if(id==='connect')this.findSecret('signal');
  const texts=['One step is progress.','Start small.','Make room for a pause.'];const message=id==='affirmation'?texts[(this.affirmationIndex=(this.affirmationIndex??-1)+1)%texts.length]:islandActions[id][1];this.events.trigger('message',[message]);
 }
 interact(){if(!this.frozen)this.nearAction?.run();}
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
   const best=this.discovery?.complete(event.kind,event.elapsed)||0;this.feedback.splash(this.boat.position,{celebrate:true,kind:'finish'});if(event.kind==='lighthouse')this.controllers.get('learning')?.activate();
   this.events.trigger('finish',[{...event,best}]);
  }
 }
 pause(kind='read',focus=null){
  if(focus&&this.loaded.has(focus.id))this.loadModel(focus.id);
  if(this.mode==='exploring'&&!this.snapshot)this.snapshot={boat:this.boat.snapshot(),props:this.props.snapshot(),epoch:this.challenges.epoch};
  const reason=kind==='hidden'?'hidden':kind==='travel'?'travel':'read';this.player?.pauseReasons.add(reason);
  this.challenges.pause();this.mode=kind;if(kind!=='hidden')this.focus=focus;this.inputs.setEnabled(false);this.character?.hold();this.accumulator=0;
 }
 dock(island){this.cancelChallenge();this.boat.hold();this.snapshot=null;this.pause('dock',island);this.snapshot=null;}
 resume(reason='read'){
  if(this.player){this.player.pauseReasons.delete(reason);if(this.player.pauseReasons.size){this.mode=this.player.pauseReasons.has('hidden')?'hidden':'read';return;}}
  if(this.mode==='exploring'||this.recovery)return;
  if(this.snapshot&&this.challenges.active&&this.snapshot.epoch===this.challenges.epoch){this.pendingResume=this.snapshot;this.challenges.resume();}else this.boat.hold();
  this.character?.hold();this.snapshot=null;this.focus=null;this.mode='exploring';this.accumulator=0;this.inputs.setEnabled(!this.challenges.frozen&&!this.player?.transitioning&&!this.boarding?.pending);this.last=performance.now();
 }
 cancelChallenge(){this.recovery=null;this.marine?.onTravel();this.challenges.cancel();this.snapshot=null;this.pendingResume=null;this.props?.resetCargo();}
 teleport(point){
  const wasHidden=this.player?.pauseReasons.has('hidden');this.boarding?.cancel();this.player?.toSailing();this.player?.pauseReasons.clear();this.boat.park?.(false);this.cancelChallenge();this.fleet?.onTravel();this.marine?.onTravel();this.docks?.reset();this.focus=null;this.mode='exploring';this.props.resetNear(point);point=this.safePoint(point);this.boat.teleport(point);this.accumulator=0;this.clearWake();this.feedback.clear();this.resetCamera();this.updateNearby(0,performance.now(),false);this.inputs.setEnabled(true);if(wasHidden)this.pause('hidden');this.last=performance.now();
 }
 safePoint(point){
  this.world.propagateModifiedBodyPositionsToColliders();this.world.updateSceneQueries();
  const q={x:0,y:Math.sin((point.yaw||0)/2),z:0,w:Math.cos((point.yaw||0)/2)},shape=new RAPIER.Cuboid(.85,.7,2.1);
  const candidates=[point];for(const radius of [3,6,9,12])for(let n=0;n<12;n++)candidates.push({...point,x:point.x+Math.cos(n/12*Math.PI*2)*radius,z:point.z+Math.sin(n/12*Math.PI*2)*radius});
  const free=candidates.find(p=>Math.hypot(p.x,p.z)<WORLD_RADIUS-5&&!this.world.intersectionWithShape({x:p.x,y:.35,z:p.z},q,shape,undefined,SEA_GROUP,this.boat.collider,this.boat.body));
  if(!free)throw new Error('No safe water at destination');return free;
 }
 reset(){this.boarding?.cancel();if(this.player?.walking){this.character.teleport(this.player.berth.landing);this.jack?.resetPose('idle');this.player.pauseReasons.clear();this.mode='exploring';this.focus=null;this.inputs.setEnabled(true);this.resetCamera();return this.player.island;}const i=nearestIsland(this.boat.position);this.teleport({...i.dock,yaw:i.yaw});return i;}
 startChallenge(id){const config=challenges.find(c=>c.id===id);if(!config)return;this.teleport(config.spawn);this.challenges.start(id);this.inputs.setEnabled(!this.challenges.frozen);}
 startRace(){this.startChallenge('buoy');}
 setZoom(index){if(this.player?.walking)this.settings.walkZoom=Math.max(0,Math.min(2,index));else this.cameraRig.setZoom(index);this.discovery?.save();this.events.trigger('zoom',[this.settings.zoom]);}
 async loadWalkLayouts(){try{const r=await fetch('/models/walk-layout.json');if(!r.ok)throw new Error('Walk layout unavailable');const data=await r.json();this.walkLayouts=new Map((data.islands||data).map(i=>[i.id,i]));}catch(e){console.warn(e.message);this.walkLayouts=new Map();}}
 async prepareAshore(island){this.inputs.setEnabled(false);this.events.trigger('message',['Preparing '+island.name+' for a little walk…']);
  if(!this.walkLayouts?.size)await this.loadWalkLayouts();await Promise.all([this.loadModel(island.id),this.jack.load()]);const layout=this.walkLayouts.get(island.id);if(!layout||!this.loaded.get(island.id).model||!this.jack.ready)throw new Error('The island is still loading. You can read it now or try going ashore again.');
  if(!this.walkWorlds.has(island.id)){const walk=new IslandWalkWorld(RAPIER,this.world,island,layout);this.walkWorlds.set(island.id,walk);this.createLandActions(island,layout);this.world.propagateModifiedBodyPositionsToColliders();this.world.updateSceneQueries();}return this.walkWorlds.get(island.id);
 }
 selectBerth(island,walk){const candidates=(walk.layout.berths||[{boat:{x:-3,z:14,yaw:0},landing:{x:-.6,z:14,y:.85,yaw:0}},{boat:{x:3,z:14,yaw:0},landing:{x:.6,z:14,y:.85,yaw:0}}]).map(b=>({boat:localToWorld(island,b.boat),landing:localToWorld(island,b.landing)})).sort((a,b)=>Math.hypot(a.boat.x-this.boat.position.x,a.boat.z-this.boat.position.z)-Math.hypot(b.boat.x-this.boat.position.x,b.boat.z-this.boat.position.z));
  this.world.propagateModifiedBodyPositionsToColliders();this.world.updateSceneQueries();return candidates.find(b=>walk.clear(b.landing)&&!this.world.intersectionWithShape({x:b.boat.x,y:.35,z:b.boat.z},{x:0,y:Math.sin(b.boat.yaw/2),z:0,w:Math.cos(b.boat.yaw/2)},new RAPIER.Cuboid(.85,.7,2.1),undefined,SEA_GROUP,this.boat.collider,this.boat.body));
 }
 commitBoarding(kind,island,berth,walk){if(kind==='ashore'){
  this.boat.teleport(berth.boat);this.boat.park(true);this.character.teleport(berth.landing,walk);this.character.enable(true);this.player.island=island;this.player.berth=berth;this.player.ashoreTime=0;
 }else{this.character.enable(false);this.character.seated=false;this.boat.park(false);this.boat.hold();this.player.island=null;this.player.berth=null;for(const actions of this.landActions.values())for(const a of actions)a.object.visible=false;}
 this.clearWake();this.feedback.clear();this.prev.copy(vec(this.boat.position.x,this.boat.position.y,this.boat.position.z));this.prevYaw=this.boat.yaw;this.snapshot=null;this.pendingResume=null;this.resetCamera();this.events.trigger('message',[kind==='ashore'?'Welcome ashore. WASD to walk · E to read · F to interact.':'Back aboard. Your next island is waiting.']);
 }
 async goAshore(){if(!this.nearby||this.player.mode!=='sailing'||this.frozen)return false;this.cancelChallenge();this.boat.hold();this.inputs.setEnabled(false);const result=await this.boarding.disembark(this.nearby);if(!result&&!this.frozen)this.inputs.setEnabled(true);return result;}
 boardBoat(){if(this.frozen||!this.player.walking)return false;this.inputs.setEnabled(false);this.character.hold();return this.boarding.board();}
 primaryAction(){if(this.frozen)return;if(this.player.walking){if(this.canBoard)return this.boardBoat();if(this.nearStation?.kind==='read')return this.nearStation.run();}else return this.goAshore();}
 createLandActions(island,layout){const actions=[];for(const station of [...layout.stations,{...layout.bench,id:'bench',type:'bench',label:'Sit for a moment'}]){
  const point=localToWorld(island,station.type==='bench'?station.approach:{...station,y:station.y??layout.groundY??.85});const kind=station.type;
  const marker=label(kind==='read'?'E':'F',{width:64,height:64,worldWidth:.45,fontSize:32,background:'#fff5dd',color:'#254f62'});marker.position.set(point.x,point.y+1.65,point.z);marker.visible=false;this.scene.add(marker);
  const action=new Interactable({id:island.id+':'+station.id,label:station.label,position:point,range:1.8,object:marker,run:()=>{if(this.frozen||!this.player.walking)return;this.jack.interact();
   if(kind==='read')this.events.trigger('exhibit',[{island:island.id,station,position:point}]);else if(kind==='studio')this.events.trigger('studio');else if(kind==='challenge')this.events.trigger('challengeopen',['lighthouse']);else if(kind==='bench'){this.character.teleport({...point,y:layout.groundY??.85,yaw:(station.yaw||0)+island.rotation});const seat=localToWorld(island,station);this.character.seatYaw=(station.yaw||0)+island.rotation+Math.PI;this.character.seatVisual=this.jack.seatPosition(seat,station.y+.06,this.character.seatYaw);this.character.seated=true;if(island.id==='affirmation')this.activateIsland(island.id);}else{this.activateIsland(island.id);if(station.action==='rag')this.events.trigger('message',['Concept illustration · Retrieve, add context, and respond.']);}
  }});action.kind=kind;action.station=station;actions.push(action);
 }this.landActions.set(island.id,actions);}
 setQuality(level){this.settings.quality=level;this.renderer.setPixelRatio(Math.min(devicePixelRatio,level==='low'?1:1.5));this.lighting.setQuality(level);this.bayWater.setQuality(level);if(this.mode!=='loading')this.surfaces.loadQuality(level);this.details?.setQuality();for(const [id,item] of this.loaded)if(item.requested&&item.requestedQuality!==level)this.loadModel(id,true);}
 project(point){return vec(point.x,point.y||0,point.z).project(this.camera);}
 spatialSound(kind,p,strength=1){const distance=Math.hypot(p.x-this.activeActor.position.x,p.z-this.activeActor.position.z),gain=Math.max(0,1-distance/60)*strength;if(gain>.01)this.events.trigger('sound',[{kind,strength:gain}]);}
 horn(){if(!this.player?.walking&&!this.frozen&&this.fleet?.horn(this.boat.position)){this.feedback.splash(this.boat.position,{strength:.3,kind:'water'});return true;}return false;}
 setLivery(id){const livery=this.appearance?.setLivery(id);this.discovery?.save();return livery;}
 status(){return{player:{mode:this.player.mode,position:{...this.activeActor.position},heading:this.activeActor.yaw,speed:this.activeActor.speed,island:this.player.island?.id||null,parkedBoat:this.boat.parked?{...this.boat.position}:null,seated:this.character.seated,ashore:[...(this.discovery?.ashore||[])],transitionEpoch:this.player.transitionEpoch,pauseReasons:[...this.player.pauseReasons],jackReady:this.jack.ready,stations:this.player.island?(this.landActions.get(this.player.island.id)||[]).map(a=>({id:a.id,type:a.kind,label:a.label,position:a.position})):[],nearStation:this.nearStation?.id||null,canBoard:this.canBoard},performance:{frameTimeMs:this.frameTimes?.length?{p50:[...this.frameTimes].sort((a,b)=>a-b)[Math.floor(this.frameTimes.length*.5)],p95:[...this.frameTimes].sort((a,b)=>a-b)[Math.floor(this.frameTimes.length*.95)]}:null,surfaces:this.surfaces.stats(),contactShading:this.lighting.quality!=='low'&&!this.lighting.failed,fpsWindow:this.fpsHistory||[],drawCalls:this.renderer.info.render.drawCalls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,loadedIslands:[...this.loaded.values()].filter(i=>i.model).length,detailVariants:[...this.details.items.values()].reduce((n,i)=>n+i.cache.size,0)},livery:this.settings.livery,fleet:this.fleet?.status(),seaLife:{...this.marine?.status(),sightings:[...(this.discovery?.seaLife||[])]},simulationTime:this.simTime,available3D:true,renderer:this.renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2',fps:this.fps,quality:this.settings.quality,cameraDistance:this.cameraRig.distance,viewport:{width:innerWidth,height:innerHeight},mode:this.mode,position:{...this.boat.position},speed:this.boat.speed,heading:this.boat.yaw,nearby:this.nearby?.id||null,action:this.nearAction?{id:this.nearAction.id,label:this.nearAction.label}:null,challenge:{kind:this.challenges.kind,state:this.challenges.state,index:this.challenges.index,elapsed:this.challenges.elapsed},zoom:this.settings.zoom,readyMs:this.readyMs,stamps:this.discovery?.stamps||0};}
}
