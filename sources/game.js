import * as THREE from 'three/webgpu';
import { color, mix, positionWorld, positionLocal, sin, uniform, vec3 } from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import { Events } from './core/Events.js';
import { BoatController } from './core/boat.js';
import { CameraRig } from './core/camera.js';
import { ChallengeManager } from './core/challenges.js';
import { createIslandColliders, createBoundaryColliders } from './core/collisions.js';
import { IslandController } from './world/island.js';
import { FeedbackSystem } from './world/feedback.js';
import { Interactable } from './world/interactable.js';
import { PropManager } from './world/props.js';
import { Environment } from './world/environment.js';
import { mesh, box, cylinder, label, material } from './world/geometry.js';
import { islands, gates, boatSpawn, WORLD_RADIUS, nearestIsland, inDockZone, cargoBerths, lamps, challenges, secretPlaces, islandActions } from './config.js';
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
  await this.renderer.init();this.renderer.setSize(innerWidth,innerHeight);this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.settings.quality==='low'?1:1.5));
  this.renderer.shadowMap.enabled=this.settings.quality!=='low';this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;
  await RAPIER.init();this.world=new RAPIER.World({x:0,y:0,z:0});this.world.timestep=STEP;this.queue=new RAPIER.EventQueue(true);
  this.boat=new BoatController(RAPIER,this.world,boatSpawn);this.prev=vec(boatSpawn.x,.35,boatSpawn.z);this.prevYaw=this.boat.yaw;this.visualPosition=this.prev.clone();
  this.cameraRig=new CameraRig(this.camera,this.settings,innerWidth,innerHeight);
  this.feedback=new FeedbackSystem(this.scene,this.settings,(kind,strength)=>this.events.trigger('sound',[{kind,strength}]));
  this.createLight();this.createWater();this.createIslands();this.createBoat();this.createBoundary();
  this.environment=new Environment(this.scene,RAPIER,this.world,this.settings);
  this.props=new PropManager(this.scene,RAPIER,this.world,{settings:this.settings,feedback:this.feedback,onSecret:id=>this.findSecret(id)});
  this.toys=this.props.items;this.createInteractables();this.createWake();this.resetCamera();this.bindPointer();
  this.world.step(this.queue);this.queue.clear();
  await Promise.all([this.loadModel('boat'),this.loadModel('harbor'),this.loadModel('connect')]);
  this.mode='exploring';this.last=performance.now();this.inputs.setEnabled(true);this.setQuality(this.settings.quality);
  window.addEventListener('resize',()=>{this.cameraRig.resize(innerWidth,innerHeight);this.renderer.setSize(innerWidth,innerHeight);});
  this.renderer.setAnimationLoop(()=>this.safeFrame());
  this.readyMs=Math.round(performance.now());this.events.trigger('ready',[this.renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2']);
 }
 safeFrame(){try{this.frame();}catch(error){this.renderer.setAnimationLoop(null);this.events.trigger('failure',[error]);}}
 createLight(){
  this.scene.add(new THREE.HemisphereLight('#fff7da','#388783',2.1));this.sun=new THREE.DirectionalLight('#fff0cf',2.5);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);
  Object.assign(this.sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,near:1,far:180});this.sun.shadow.normalBias=.12;this.sun.shadow.bias=-.0001;this.scene.add(this.sun,this.sun.target);
 }
 createWater(){
  this.waterTime=uniform(0);const p=positionWorld,t=this.waterTime,water=new THREE.MeshStandardNodeMaterial({roughness:.32,metalness:.06});
  const wave=sin(p.x.mul(.19).add(p.z.mul(.26)).add(t.mul(.55))).mul(sin(p.z.mul(.31).sub(t.mul(.35)))).mul(.5).add(.5);
  water.colorNode=mix(color('#248f9e'),color('#5ac9bb'),wave.mul(.35).add(.15));
  water.positionNode=positionLocal.add(vec3(0,sin(positionLocal.x.mul(.28).add(t.mul(.6))).mul(sin(positionLocal.z.mul(.32).add(t.mul(.4)))).mul(.045),0));
  this.water=mesh(this.scene,new THREE.PlaneGeometry(900,900,100,100).rotateX(-Math.PI/2),water,[0,-.14,0]);this.water.castShadow=false;
  this.glints=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,.06),new THREE.MeshBasicMaterial({color:'#c7f6dc',transparent:true,opacity:.29,depthWrite:false}),650);const dummy=new THREE.Object3D();
  for(let i=0;i<650;i++){dummy.position.set(Math.sin(i*127.1)*175,.02,Math.cos(i*73.3)*175);dummy.rotation.set(-Math.PI/2,0,Math.sin(i)*.3);dummy.scale.set(.6+(i%5)*.2,1,1);dummy.updateMatrix();this.glints.setMatrixAt(i,dummy.matrix);}this.scene.add(this.glints);
 }
 createIslands(){
  for(const i of islands){
   const group=new THREE.Group();group.position.set(i.x,0,i.z);group.rotation.y=i.rotation;this.scene.add(group);
   const shape=new THREE.Shape(i.shore.map(([x,z])=>new THREE.Vector2(x,-z)));
   const geo=new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false}).rotateX(-Math.PI/2);mesh(group,geo,'sand',[0,-.1,0]);box(group,[3,.35,7.9],'woodLight',[0,.55,11.85]);
   const controller=new IslandController(i,group);this.controllers.set(i.id,controller);this.loaded.set(i.id,{group,model:null,requested:false,island:i});createIslandColliders(RAPIER,this.world,i);
   for(let j=0;j<3;j++){
    const shore=mesh(group,new THREE.ShapeGeometry(shape).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:['#73cfc0','#9cdbc2','#e2edc5'][j],transparent:true,opacity:.2+j*.025,depthWrite:false}),[0,-.055+j*.018,0]);shore.scale.setScalar(1.17-j*.045);shore.castShadow=false;shore.userData.shore=true;
   }
  }
 }
 createBoat(){this.boatGroup=new THREE.Group();this.scene.add(this.boatGroup);this.boatVisual=new THREE.Group();this.boatGroup.add(this.boatVisual);box(this.boatVisual,[1.5,.6,3.6],'orange',[0,.35,0]);box(this.boatVisual,[1.2,.35,2],'ivory',[0,.8,-.2]);}
 async loadModel(id,force=false){
  const item=id==='boat'?null:this.loaded.get(id);if(item?.requested&&!force)return;const quality=this.settings.quality,revision=item?(item.revision=(item.revision||0)+1):0;if(item){item.requested=true;item.requestedQuality=quality;}
  try{
   const gltf=await this.loader.loadAsync('/models/'+(id!=='boat'&&quality==='low'?'low/':'')+id+'.glb');if(item&&item.revision!==revision)return;gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
   if(id==='boat'){
    this.boatVisual.clear();this.boatVisual.add(gltf.scene);this.boatModel=gltf.scene;
    this.boatOutline=gltf.scene.clone(true);this.boatOutline.traverse(o=>{if(o.isMesh){o.material=new THREE.MeshBasicMaterial({color:'#fff8da',depthTest:false,transparent:true,opacity:.35});o.castShadow=false;o.renderOrder=9;}});this.boatOutline.scale.setScalar(1.025);this.boatOutline.visible=false;this.boatVisual.add(this.boatOutline);
   }else{
    const shore=item.group.children.filter(o=>o.userData.shore);if(item.model)item.model.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});item.group.clear();item.quality=quality;item.group.add(...shore,gltf.scene);item.model=gltf.scene;this.controllers.get(id).bind(gltf.scene);
   }
   this.loadedCount++;this.events.trigger('asset',[{id,count:this.loadedCount}]);
  }catch(error){if(item)item.lastFailure=performance.now();console.warn('Model unavailable: '+id,error.message);this.events.trigger('asseterror',[id]);}
 }
 createBoundary(){
  const geo=new THREE.CylinderGeometry(.22,.36,.7,8);this.boundary=new THREE.InstancedMesh(geo,material('yellow'),90);const dummy=new THREE.Object3D();
  for(let i=0;i<90;i++){const a=i/90*Math.PI*2;dummy.position.set(Math.cos(a)*WORLD_RADIUS,.15,Math.sin(a)*WORLD_RADIUS);dummy.updateMatrix();this.boundary.setMatrixAt(i,dummy.matrix);}this.scene.add(this.boundary);createBoundaryColliders(RAPIER,this.world,WORLD_RADIUS);
 }
 createInteractables(){
  for(const i of islands){
   const marker=label('F',{width:72,height:72,worldWidth:1.25,background:'#fff5dd',color:'#254f62',fontSize:38});marker.position.set(i.action.x,2.1,i.action.z);this.scene.add(marker);this.actionMarkers.push({marker,position:i.action});
   this.interactables.push(new Interactable({id:i.id,label:islandActions[i.id][0],position:i.action,range:8,object:marker,run:()=>i.id==='learning'?this.events.trigger('challengeopen',['lighthouse']):this.activateIsland(i.id)}));
  }
  for(const c of challenges)this.interactables.push(new Interactable({id:'challenge-'+c.id,label:'Play '+c.name,position:c,range:9,run:()=>this.events.trigger('challengeopen',[c.id])}));
  for(const lamp of lamps)this.interactables.push(new Interactable({id:'lamp-'+lamp.id,label:'Activate '+lamp.name,position:lamp,range:6,available:()=>this.challenges.kind==='lighthouse'&&this.challenges.state==='running',run:()=>this.challenges.activateLamp(lamp.id)}));
  this.bottle=new THREE.Group();this.bottle.position.set(secretPlaces.bottle.x,.25,secretPlaces.bottle.z);this.scene.add(this.bottle);
  const bottle=cylinder(this.bottle,.25,1.2,'#91dcc4',[0,.1,0]);bottle.rotation.z=1.05;cylinder(bottle,.14,.22,'wood',[0,.68,0]);
  const paper=box(bottle,[.22,.6,.1],'ivory',[0,0,.15]);paper.rotation.y=.3;const bottleMarker=label('✉',{width:80,height:80,worldWidth:1.1,background:'#fff5dd',color:'#254f62',fontSize:40});bottleMarker.position.set(0,1.8,0);this.bottle.add(bottleMarker);
  this.interactables.push(new Interactable({id:'bottle',label:'Read the message',position:secretPlaces.bottle,range:8,object:this.bottle,run:()=>{this.findSecret('bottle');this.events.trigger('message',['A message from the sea: Hello, world.']);}}));
 }
 bindPointer(){
  this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();let down=null;
  this.canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
  this.canvas.addEventListener('pointerup',e=>{
   if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>8||this.mode!=='exploring'||this.challenges.frozen)return;down=null;
   this.pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);this.raycaster.setFromCamera(this.pointer,this.camera);
   const hit=this.interactables.filter(i=>i.object&&i.available()&&i.distance(this.boat.position)<10).find(i=>this.raycaster.intersectObject(i.object,true).length);
   if(hit)hit.run();
  });
  this.canvas.addEventListener('wheel',e=>{if(this.mode!=='exploring')return;e.preventDefault();if(!this.wheelTime||performance.now()-this.wheelTime>180){this.wheelTime=performance.now();this.setZoom((this.settings.zoom??1)+(e.deltaY>0?1:-1));}},{passive:false});
 }
 createWake(){this.wakeDummy=new THREE.Object3D();this.wakeMesh=new THREE.InstancedMesh(new THREE.CircleGeometry(1,10),new THREE.MeshBasicMaterial({color:'#d7f6e8',transparent:true,opacity:.44,depthWrite:false}),100);this.wakeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.wakeMesh.frustumCulled=false;this.scene.add(this.wakeMesh);this.lastWake=0;this.clearWake();}
 clearWake(){this.wakes=[];if(this.wakeMesh){this.wakeDummy.scale.setScalar(0);this.wakeDummy.updateMatrix();for(let i=0;i<100;i++)this.wakeMesh.setMatrixAt(i,this.wakeDummy.matrix);this.wakeMesh.instanceMatrix.needsUpdate=true;}}
 updateWake(frozen){
  const p=this.visualPosition,speed=this.boat.speed;
  if(!frozen&&speed>.7&&this.time-this.lastWake>.055){this.lastWake=this.time;for(const sign of [-1,1])this.wakes.push({x:p.x+Math.sin(this.boat.yaw)*1.8+Math.cos(this.boat.yaw)*sign*.4,z:p.z+Math.cos(this.boat.yaw)*1.8-Math.sin(this.boat.yaw)*sign*.4,dx:Math.cos(this.boat.yaw)*sign,dz:-Math.sin(this.boat.yaw)*sign,t:this.time,scale:.25+speed*.012});}
  this.wakes=this.wakes.filter(w=>this.time-w.t<2).slice(-100);
  for(let i=0;i<100;i++){const w=this.wakes[i];if(w){const age=this.time-w.t;this.wakeDummy.position.set(w.x+w.dx*age*.8,.065,w.z+w.dz*age*.8);this.wakeDummy.rotation.set(-Math.PI/2,0,0);const scale=(w.scale+age*.35)*(1-age/2);this.wakeDummy.scale.set(scale*1.8,scale,1);}else this.wakeDummy.scale.setScalar(0);this.wakeDummy.updateMatrix();this.wakeMesh.setMatrixAt(i,this.wakeDummy.matrix);}this.wakeMesh.instanceMatrix.needsUpdate=true;
 }
 frame(){
  const now=performance.now(),dt=Math.min((now-this.last)/1000,.1);this.last=now;this.time+=dt;this.fpsSamples=(this.fpsSamples||0)+1;if(!this.fpsSince)this.fpsSince=now;if(now-this.fpsSince>1000){this.fps=Math.round(this.fpsSamples*1000/(now-this.fpsSince));this.fpsSince=now;this.fpsSamples=0;}this.waterTime.value=this.settings.reduced?0:this.time;
  if(this.mode==='exploring')this.challenges.updateClock();
  const frozen=this.mode!=='exploring'||this.challenges.frozen;
  const input=this.inputs.read(this.boat.yaw,this.cameraRig.yaw);
  if(!frozen){
   this.accumulator+=dt;
   while(this.accumulator>=STEP){
    const before={...this.boat.position};this.prev.set(before.x,before.y,before.z);this.prevYaw=this.boat.yaw;
    this.props.beforeStep(before);this.boat.step(this.inputs.read(this.boat.yaw,this.cameraRig.yaw),STEP);this.enforceBoundary(before);this.world.step(this.queue);this.props.afterStep(this.queue,this.boat.collider,this.boat.position);
    this.challenges.tick(before,this.boat.position,STEP,this.challenges.kind==='cargo'?this.props.cargoData():[]);
    this.accumulator-=STEP;if(this.mode!=='exploring'||this.challenges.frozen)break;
   }
  }else this.accumulator=0;
  const p=this.boat.position,alpha=frozen?1:Math.min(this.accumulator/STEP,1);
  this.visualPosition.lerpVectors(this.prev,vec(p.x,p.y,p.z),alpha);this.boatGroup.position.copy(this.visualPosition);
  this.boatGroup.rotation.y=this.prevYaw+Math.atan2(Math.sin(this.boat.yaw-this.prevYaw),Math.cos(this.boat.yaw-this.prevYaw))*alpha;
  this.boatVisual.position.y=this.settings.reduced?0:Math.sin(this.time*2.2)*.06;
  this.boatVisual.rotation.z=THREE.MathUtils.damp(this.boatVisual.rotation.z,this.settings.reduced||frozen?0:-input.steer*this.boat.speed*.004,8,dt);
  this.boatVisual.rotation.x=THREE.MathUtils.damp(this.boatVisual.rotation.x,this.settings.reduced||frozen?0:-Math.max(0,this.boat.forwardSpeed)*.0025,8,dt);
  this.props.update(alpha,this.time,this.settings.reduced);this.bottle.position.y=.25+(this.settings.reduced?0:Math.sin(this.time)*.07);
  for(const controller of this.controllers.values())controller.update(dt,p,this.time,this.focus?.id===controller.island.id,this.settings.reduced);
  this.environment.update(this.challenges,this.time,p);this.updateWake(frozen);this.feedback.update(dt);this.updateCamera(dt);this.updateNearby(dt,now,frozen);this.updateOcclusion(now);
  this.sun.position.set(p.x-35,65,p.z+20);this.sun.target.position.set(p.x,0,p.z);this.sun.target.updateMatrixWorld();
  this.events.trigger('frame',[{position:p,yaw:this.boat.yaw,speed:this.boat.speed,dt,now,frozen}]);this.renderer.render(this.scene,this.camera);
  if(!frozen&&this.challenges.kind==='cargo'&&this.challenges.state==='running'){
   const lost=this.props.outOfBounds();if(lost){this.pause('recovery');if(this.props.recoverCargo(lost,p)){this.snapshot.props=this.props.snapshot();this.resume();this.events.trigger('message',['Cargo recovered. Resuming your run…']);}else{this.recovery=lost;this.events.trigger('message',['No clear recovery berth. Use Reset cargo for a fresh start.']);}}
  }
  if(this.recovery&&this.mode==='recovery'&&this.props.recoverCargo(this.recovery,p)){this.recovery=null;this.snapshot.props=this.props.snapshot();this.resume();}
  if(Math.hypot(p.x,p.z)>WORLD_RADIUS+9)this.events.trigger('rescue');
 }
 enforceBoundary(p){const distance=Math.hypot(p.x,p.z);if(distance>WORLD_RADIUS-10){const v=this.boat.velocity,out=(v.x*p.x+v.z*p.z)/distance;if(out>0){const f=Math.min(1,(distance-WORLD_RADIUS+10)/10)*.14;this.boat.body.setLinvel({x:v.x-p.x/distance*out*f,y:0,z:v.z-p.z/distance*out*f},true);}}}
 updateNearby(dt,now,frozen){
  const p=this.boat.position;this.nearby=null;
  for(const i of islands){const distance=Math.hypot(p.x-i.x,p.z-i.z),near=inDockZone(p,i);
   if(near&&(!this.nearby||Math.hypot(p.x-i.dock.x,p.z-i.dock.z)<Math.hypot(p.x-this.nearby.dock.x,p.z-this.nearby.dock.z)))this.nearby=i;
   if(!frozen){if(distance<40)this.discovery?.discover(i.id);this.discovery?.visit(i.id,near,dt);}
   const asset=this.loaded.get(i.id);if(!asset.requested&&distance<72)this.loadModel(i.id);
  }
  this.nearAction=!frozen?Interactable.nearest(this.interactables,p,this.camera):null;
  for(const m of this.actionMarkers)m.marker.visible=this.mode==='exploring'&&Math.hypot(p.x-m.position.x,p.z-m.position.z)<15;
  if(!frozen){if(Math.hypot(p.x-secretPlaces.arch.x,p.z-secretPlaces.arch.z)<3.2)this.findSecret('arch');if(Math.hypot(p.x-secretPlaces.cove.x,p.z-secretPlaces.cove.z)<5)this.findSecret('cove');}
 }
 updateCamera(dt){this.cameraRig.update(dt,{position:this.visualPosition,velocity:this.boat.velocity,yaw:this.boat.yaw,speed:this.mode==='exploring'?this.boat.speed:0,input:this.inputs.read(this.boat.yaw,this.cameraRig.yaw),focus:this.focus});}
 resetCamera(){const p=this.boat.position;this.visualPosition.set(p.x,p.y,p.z);this.prev.copy(this.visualPosition);this.prevYaw=this.boat.yaw;this.cameraRig.reset(p,this.boat.yaw);}
 updateOcclusion(now){
  if(this.lastOcclusion&&now-this.lastOcclusion<100)return;this.lastOcclusion=now;
  const candidates=[...this.environment.occluders];for(const c of this.controllers.values())if(Math.hypot(c.island.x-this.boat.position.x,c.island.z-this.boat.position.z)<50)candidates.push(...c.occluders);
  const target=vec(this.visualPosition.x,this.visualPosition.y+1,this.visualPosition.z),direction=target.clone().sub(this.camera.position),distance=direction.length();
  const ray=new THREE.Raycaster(this.camera.position,direction.normalize(),0,distance-.8);this.scene.updateMatrixWorld();const hit=new Set(this.focus?[]:ray.intersectObjects(candidates,false).map(h=>h.object));
  for(const object of this.occluded||[])if(!hit.has(object))for(const m of Array.isArray(object.material)?object.material:[object.material])m.opacity=1;
  for(const object of hit)for(const m of Array.isArray(object.material)?object.material:[object.material])m.opacity=.22;
  this.occluded=hit;if(this.boatOutline)this.boatOutline.visible=hit.size>0&&!this.focus;
 }
 activateIsland(id){
  const controller=this.controllers.get(id);controller?.activate();this.loadModel(id);this.feedback.splash(islands.find(i=>i.id===id).action,{kind:id==='harbor'?'bell':'click',strength:.8});
  if(id==='harbor')this.findSecret('bell');if(id==='connect')this.findSecret('signal');
  const texts=['One step is progress.','Start small.','Make room for a pause.'];const message=id==='affirmation'?texts[(this.affirmationIndex=(this.affirmationIndex??-1)+1)%texts.length]:islandActions[id][1];this.events.trigger('message',[message]);
 }
 interact(){if(this.mode==='exploring'&&!this.challenges.frozen)this.nearAction?.run();}
 findSecret(id){if(this.discovery?.secret(id)){this.feedback.splash(this.boat.position,{celebrate:true,kind:'discover'});this.events.trigger('discovery',[id]);}}
 challengeEvent(event){
  if(event.type==='release'){
   if(this.pendingResume?.epoch===this.challenges.epoch){this.boat.restore(this.pendingResume.boat);this.props.restore(this.pendingResume.props);this.prev.copy(vec(this.boat.position.x,this.boat.position.y,this.boat.position.z));this.prevYaw=this.boat.yaw;}
   this.pendingResume=null;if(this.mode==='exploring')this.inputs.setEnabled(true);
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
  if(this.mode==='exploring')this.snapshot={boat:this.boat.snapshot(),props:this.props.snapshot(),epoch:this.challenges.epoch};
  this.challenges.pause();this.mode=kind;this.focus=focus;this.inputs.setEnabled(false);this.accumulator=0;
 }
 dock(island){this.cancelChallenge();this.boat.hold();this.snapshot=null;this.pause('dock',island);this.snapshot=null;}
 resume(){
  if(this.mode==='exploring'||this.recovery)return;
  if(this.snapshot&&this.challenges.active&&this.snapshot.epoch===this.challenges.epoch){this.pendingResume=this.snapshot;this.challenges.resume();}else this.boat.hold();
  this.snapshot=null;this.focus=null;this.mode='exploring';this.accumulator=0;this.inputs.setEnabled(!this.challenges.frozen);this.last=performance.now();
 }
 cancelChallenge(){this.recovery=null;this.challenges.cancel();this.snapshot=null;this.pendingResume=null;this.props?.resetCargo();}
 teleport(point){
  this.cancelChallenge();this.focus=null;this.mode='exploring';this.props.resetNear(point);point=this.safePoint(point);this.boat.teleport(point);this.accumulator=0;this.clearWake();this.feedback.clear();this.resetCamera();this.updateNearby(0,performance.now(),false);this.inputs.setEnabled(true);this.last=performance.now();
 }
 safePoint(point){
  this.world.propagateModifiedBodyPositionsToColliders();this.world.updateSceneQueries();
  const q={x:0,y:Math.sin((point.yaw||0)/2),z:0,w:Math.cos((point.yaw||0)/2)},shape=new RAPIER.Cuboid(.85,.7,2.1);
  const candidates=[point];for(const radius of [3,6,9,12])for(let n=0;n<12;n++)candidates.push({...point,x:point.x+Math.cos(n/12*Math.PI*2)*radius,z:point.z+Math.sin(n/12*Math.PI*2)*radius});
  const free=candidates.find(p=>Math.hypot(p.x,p.z)<WORLD_RADIUS-5&&!this.world.intersectionWithShape({x:p.x,y:.35,z:p.z},q,shape,undefined,undefined,this.boat.collider,this.boat.body));
  if(!free)throw new Error('No safe water at destination');return free;
 }
 reset(){const i=nearestIsland(this.boat.position);this.teleport({...i.dock,yaw:i.yaw});return i;}
 startChallenge(id){const config=challenges.find(c=>c.id===id);if(!config)return;this.teleport(config.spawn);this.challenges.start(id);this.inputs.setEnabled(!this.challenges.frozen);}
 startRace(){this.startChallenge('buoy');}
 setZoom(index){this.cameraRig.setZoom(index);this.discovery?.save();this.events.trigger('zoom',[this.settings.zoom]);}
 setQuality(level){this.settings.quality=level;this.renderer.setPixelRatio(Math.min(devicePixelRatio,level==='low'?1:1.5));this.renderer.shadowMap.enabled=level!=='low';this.glints.visible=level!=='low';for(const [id,item] of this.loaded)if(item.requested&&item.requestedQuality!==level)this.loadModel(id,true);}
 project(point){return vec(point.x,point.y||0,point.z).project(this.camera);}
 status(){return{available3D:true,renderer:this.renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2',fps:this.fps,quality:this.settings.quality,cameraDistance:this.cameraRig.distance,viewport:{width:innerWidth,height:innerHeight},mode:this.mode,position:{...this.boat.position},speed:this.boat.speed,heading:this.boat.yaw,nearby:this.nearby?.id||null,action:this.nearAction?{id:this.nearAction.id,label:this.nearAction.label}:null,challenge:{kind:this.challenges.kind,state:this.challenges.state,index:this.challenges.index,elapsed:this.challenges.elapsed},zoom:this.settings.zoom,readyMs:this.readyMs,stamps:this.discovery?.stamps||0};}
}
