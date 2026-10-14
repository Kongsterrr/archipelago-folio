import * as THREE from 'three';
import {CareerTrainController,CAREER_TRAIN,CAREER_TRAIN_MOTION} from '../core/career-train.js';
import {CareerTrainVisual} from './career-train.js';
import {localToWorld,WALK_GROUP} from '../core/character.js';
import {campusStationFocus} from '../core/campus-focus.js';
import {label} from './geometry.js';

// Integration owner: simulation and Jack's mount outlive any island GLB reload.
export class CareerJourney {
 constructor(game,R){this.game=game;this.R=R;this.returningPassenger=false;this.colliders=[];this.autoDeparture=null;this.boardingRequest=null;this.departureHoldReason=null;}
 async load(){
  if(this.ready)return true;if(this.promise)return this.promise;
  this.promise=this.loadNow().finally(()=>{this.promise=null;});return this.promise;
 }
 async loadNow(){
  const g=this.game,island=g.loaded.get('experience')?.island,layout=g.walkLayouts?.get('experience');
  if(!island||!layout?.railway)return false;
  try{
   const asset=await g.loader.loadAsync('/models/career-train.glb?v=20');
   this.island=island;this.walk=g.ensureWalkWorld(island);this.railway=layout.railway;
   this.controller=new CareerTrainController(this.railway,{island});
   this.visual=new CareerTrainVisual(g.scene,this.controller);this.visual.bind(asset.scene);
   this.visual.bindCrossings?.(g.loaded.get('experience')?.model);
   this.visual.update(1);g.careerTrain=this.controller;g.trainVisual=this.visual;g.player.train=this.controller;
   for(const spec of CAREER_TRAIN.cars){
    const body=g.world.createRigidBody(this.R.RigidBodyDesc.kinematicPositionBased());
    const collider=g.world.createCollider(this.R.ColliderDesc.cuboid(spec.halfWidth,.8,spec.halfLength).setCollisionGroups(WALK_GROUP).setTranslation(0,1,0),body);
    this.walk.handles.add(collider.handle);this.walk.obstacles.push(collider);this.colliders.push({body,collider});
   }
   this.marker=label('E  BOARD TRAIN',{width:512,height:96,worldWidth:2.1,fontSize:30,background:'#fff5dd',color:'#254f62'});this.marker.visible=false;g.scene.add(this.marker);
   this.ready=true;this.syncPhysics(true);return true;
  }catch(error){console.warn('Career train unavailable',error.message);g.events.trigger('message',['The train could not load. All three experiences remain open to explore on foot.']);return false;}
 }
 world(point){return localToWorld(this.island,point);}
 station(id){return this.railway?.stations.find(s=>s.id===id);}
 platformPoint(station){
  const g=this.game,p=g.player,boarding=station?.boarding||station?.approach;
  if(!boarding||p.island?.id!=='experience')return null;
  const point=this.world(boarding),actor=g.character.position,height=this.walk.groundAt(point);
  if(Math.hypot(actor.x-point.x,actor.z-point.z)>=2.1||Math.abs(actor.y-point.y)>=.8||!this.walk.visible(actor,point)||!this.walk.clear(point)||!Number.isFinite(height)||Math.abs(height-point.y)>.25)return null;
  return {...point,y:height};
 }
 cancelAutoDeparture(reason='interaction'){
  this.autoDeparture=null;this.departureHoldReason=reason;
  if(this.boardingRequest)this.boardingRequest.held=true;
 }
 holdDeparture(reason='interaction'){this.cancelAutoDeparture(reason);}
 scheduleDeparture(phase,duration){this.departureHoldReason=null;this.autoDeparture={phase,duration,remaining:duration,waitingForTransition:phase==='boarding'};}
 prepareStation(id){
  if(!this.ready||!this.controller.parkAtStation(id))return false;
  this.visual.update(1,{frozen:true});this.syncPhysics(true);return true;
 }
 // Called by the successful ashore commit, with the entry mask already opaque.
 prepareEntry(){
  if(!this.ready)return false;
  const g=this.game;this.cancelAutoDeparture('entry');this.boardingRequest=null;this.returningPassenger=false;
  this.controller.passenger=false;
  if(g.jack.root.parent===this.visual.mountPoint)g.scene.add(g.jack.root);
  g.jack.resetPose('idle');g.jack.forceFrame=true;
  return this.prepareStation('harbor');
 }
 nearby(){
  const g=this.game,p=g.player;
  g.canBoardTrain=false;g.canLeaveTrain=false;this.nearStation=null;this.callAction=null;
  if(this.marker)this.marker.visible=false;
  if(!this.ready||g.frozen)return;
  if(p.ridingTrain){g.canLeaveTrain=!!this.exitPoint();return;}
  if(!p.walking||p.island?.id!=='experience')return;
  const point=p.activeActor.position;
  const candidates=this.railway.stations.map(station=>({station,position:this.platformPoint(station)})).filter(s=>s.position).sort((a,b)=>Math.hypot(point.x-a.position.x,point.z-a.position.z)-Math.hypot(point.x-b.position.x,point.z-b.position.z));
  const nearest=candidates[0];if(!nearest)return;
  this.nearStation=nearest.station;
  const c=this.controller;
  g.canBoardTrain=!c.passenger;
  if(g.canBoardTrain){this.marker.position.set(nearest.position.x,nearest.position.y+1.5,nearest.position.z);this.marker.visible=true;}
 }
 exitPoint(){
  if(!this.ready||this.controller.state!=='stopped')return null;
  const station=this.controller.currentStation,exit=station?.exit||station?.boarding;
  if(!exit)return null;
  const point=this.world(exit),height=this.walk.groundAt(point);
  if(!this.walk.clear(point)||!Number.isFinite(height)||Math.abs(height-point.y)>.25)return null;
  return {...point,y:height};
 }
 board(){
  const g=this.game,c=this.controller,p=g.player;
  this.nearby();if(!g.canBoardTrain||!this.nearStation||g.frozen||!p.walking)return false;
  const id=this.nearStation.id;this.cancelAutoDeparture('board');const request={id,kind:'board',held:false};this.boardingRequest=request;
  g.cancelChallenge();g.inputs.setEnabled(false);g.character.hold();
  const began=p.begin('boarding-train',()=>{
   p.transition.destination='walking';
   if(this.boardingRequest!==request||!this.platformPoint(this.station(id))||c.passenger){this.boardingRequest=null;return;}
   c.step(0,{paused:false});
   if(!this.prepareStation(id)||!c.board(id)){this.boardingRequest=null;return;}
   p.train=c;p.transition.destination='riding-train';g.character.enable(false);g.character.seated=false;
   this.returningPassenger=false;this.visual.update(1);g.jack.resetPose('sit');g.jack.forceFrame=true;g.resetCamera();
   if(!request.held)this.scheduleDeparture('boarding',CAREER_TRAIN_MOTION.boardingDelay);
   this.boardingRequest=null;
  },{duration:.4});
  if(!began){this.boardingRequest=null;g.inputs.setEnabled(!g.frozen);}return began;
 }
 leave(){
  const g=this.game,p=g.player,c=this.controller,point=this.exitPoint();
  if(g.frozen||!p.ridingTrain)return false;
  this.cancelAutoDeparture('leave');if(!point)return false;
  g.inputs.setEnabled(false);this.returningPassenger=false;
  return p.begin('leaving-train',()=>{
   c.step(0,{paused:false});
   const safePoint=this.exitPoint();
   if(!safePoint||!c.leave()){p.transition.destination='riding-train';return;}
   p.transition.destination='walking';g.character.teleport(safePoint,this.walk);g.character.enable(true);g.character.seated=false;
   if(g.jack.root.parent!==g.scene)g.scene.add(g.jack.root);g.jack.resetPose('idle');g.jack.forceFrame=true;g.resetCamera();
  },{duration:.4});
 }
 continue(){
  const g=this.game;if(g.frozen||!g.player.ridingTrain)return false;
  this.cancelAutoDeparture('continue');g.inputs.clear();this.controller.step(0,{paused:false});return this.controller.continue();
 }
 call(id=this.nearStation?.id){
  const g=this.game,p=g.player;this.nearby();if(g.frozen||!p.walking||!this.nearStation||id!==this.nearStation.id||this.controller.passenger)return false;
  const clearForTrain=()=>!this.controller.intersectsPedestrian(this.station(id).distance,this.controller.localPoint(g.character.position));
  if(!clearForTrain())return false;
  this.cancelAutoDeparture('call');const request={id,kind:'call',held:true};this.boardingRequest=request;
  g.inputs.setEnabled(false);g.character.hold();
  const began=p.begin('calling-train',()=>{
   p.transition.destination='walking';
   if(this.boardingRequest===request&&this.platformPoint(this.station(id))&&!this.controller.passenger&&clearForTrain()){this.controller.step(0,{paused:false});this.prepareStation(id);g.resetCamera();}
   this.boardingRequest=null;
  },{duration:.4});
  if(!began){this.boardingRequest=null;g.inputs.setEnabled(!g.frozen);}return began;
 }
 read(){
  const g=this.game,c=this.controller,stop=c?.currentStation;
  if(g.frozen||!g.player.ridingTrain||!stop?.contentId||stop.id==='harbor')return false;
  const station=this.walk.layout.stations.find(s=>s.contentId===stop.contentId&&s.primary);
  if(!station)return false;
  this.cancelAutoDeparture('read');g.inputs.clear();g.events.trigger('exhibit',[{island:'experience',station:{...station,trainReader:true,readFull:true},position:this.world(station)}]);return true;
 }
 returnToHarbor(){
  const g=this.game;if(g.frozen||!g.player.ridingTrain)return false;
  this.cancelAutoDeparture('return');g.inputs.clear();this.returningPassenger=true;this.controller.step(0,{paused:false});
  if(this.controller.currentStation?.id==='harbor')return this.leave();
  return this.controller.returnToHarbor();
 }
 cancel({restoreLanding=true}={}){
  const g=this.game,p=g.player;
  const riding=p?.ridingTrain||['boarding-train','leaving-train'].includes(p?.mode);
  const calling=p?.mode==='calling-train';this.cancelAutoDeparture('cancel');this.boardingRequest=null;this.returningPassenger=false;
  if(riding||calling){
   p.invalidate();p.mode='walking';g.inputs.clear();
   if(g.jack.root.parent!==g.scene)g.scene.add(g.jack.root);
   if(calling)g.character.enable(true);
   else if(restoreLanding&&p.berth){g.character.teleport(p.berth.landing,this.walk);g.character.enable(true);}
   else g.character.enable(false);
   g.jack.resetPose('idle');g.jack.forceFrame=true;
  }
  this.controller?.cancelRide();
 }
 step(dt,paused=false){
  if(!this.ready)return;
  const g=this.game,c=this.controller,previousState=c.state;
  // A boarding fade freezes physics, but its new countdown starts only once
  // walking has fully changed to riding. Other pauses consume the countdown.
  if(paused&&!(g.player.mode==='boarding-train'&&!g.player.pauseReasons.size&&g.mode==='exploring'))this.cancelAutoDeparture('pause');
  const pedestrians=g.player.walking&&g.player.island?.id==='experience'?[g.character.position]:[];
  c.step(dt,{paused,pedestrians});this.syncPhysics(false);
  if(paused)return;
  if(this.returningPassenger&&g.player.ridingTrain&&c.currentStation?.id==='harbor'){this.leave();return;}
  const arrived=previousState!=='stopped'&&c.state==='stopped';
  if(arrived&&c.passenger&&g.player.ridingTrain){
   if(c.currentStation.id==='harbor')this.cancelAutoDeparture('tour-complete');
   else this.scheduleDeparture('station',CAREER_TRAIN_MOTION.stationDwell);
  }
  const timer=this.autoDeparture;if(!timer||arrived||dt<=0)return;
  if(!g.player.ridingTrain||!c.passenger||c.state!=='stopped'){this.cancelAutoDeparture('state-change');return;}
  if(g.player.transitioning)return;
  timer.waitingForTransition=false;timer.remaining=Math.max(0,timer.remaining-dt);
  if(timer.remaining<=1e-8){this.autoDeparture=null;c.continue();}
 }
 syncPhysics(initial=false){
  if(!this.ready)return;
  this.colliders.forEach(({body},index)=>{
   const p=this.controller.carPose(index),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(p.pitch,p.yaw,0,'YXZ'));
   if(initial){body.setTranslation(p,true);body.setRotation(q,true);}
   body.setNextKinematicTranslation(p);body.setNextKinematicRotation(q);
  });
  if(initial){this.game.world?.propagateModifiedBodyPositionsToColliders();this.game.world?.updateSceneQueries();}
 }
 update(alpha,frozen){if(this.ready)this.visual.update(alpha,{frozen});}
 cameraView(){
  if(!this.ready)return null;
  const c=this.controller,d=((c.distance%c.length)+c.length)%c.length,keys=this.railway.cameraPoints||[];
  let azimuth=this.island.rotation+.28,elevation=.60,lookAt=null,distance=32;
  if(keys.length){
   const ordered=[...keys].sort((a,b)=>a.distance-b.distance);let a=ordered.at(-1),b=ordered[0],span=c.length-a.distance+b.distance,along=(d-a.distance+c.length)%c.length;
   for(let n=0;n<ordered.length-1;n++)if(d>=ordered[n].distance&&d<ordered[n+1].distance){a=ordered[n];b=ordered[n+1];span=b.distance-a.distance;along=d-a.distance;break;}
   const t=Math.max(0,Math.min(1,along/Math.max(.01,span))),smooth=t*t*(3-2*t);
   azimuth=this.island.rotation+a.azimuth+Math.atan2(Math.sin(b.azimuth-a.azimuth),Math.cos(b.azimuth-a.azimuth))*smooth;
   elevation=(a.elevation??.6)+((b.elevation??.6)-(a.elevation??.6))*smooth;
   distance=(a.viewDistance??32)+((b.viewDistance??32)-(a.viewDistance??32))*smooth;
   if(a.lookAt&&b.lookAt)lookAt=this.world({x:a.lookAt[0]+(b.lookAt[0]-a.lookAt[0])*smooth,y:a.lookAt[1]+(b.lookAt[1]-a.lookAt[1])*smooth,z:a.lookAt[2]+(b.lookAt[2]-a.lookAt[2])*smooth});
  }
  const station=c.currentStation,reader=station?.contentId&&this.walk.layout.stations.find(s=>s.primary&&s.contentId===station.contentId);
  const engine=c.carPose(0),coach=c.carPose(1),center={x:(engine.x+coach.x)/2,y:(engine.y+coach.y)/2+CAREER_TRAIN.floorY,z:(engine.z+coach.z)/2};
  return {azimuth,elevation,distance,center,lookAt:lookAt||(reader?this.world(reader):null)};
 }
 readingFocus(contentId){
  if(!this.game.player.ridingTrain)return null;
  const station=this.walk.layout.stations.find(s=>s.primary&&s.contentId===contentId);
  if(!station)return null;
  const focus={...campusStationFocus(this.island,station),trainReader:true};
  focus.camera.azimuth=this.cameraView().azimuth;
  const bounds=focus.camera.fitBounds;
  if(bounds&&this.controller.currentStation?.contentId===contentId){
   for(const index of[0,1]){const p=this.controller.carPose(index);for(const[k,n]of[['x',0],['y',1],['z',2]]){bounds.min[n]=Math.min(bounds.min[n],p[k]-(k==='y'?0:2.1));bounds.max[n]=Math.max(bounds.max[n],p[k]+(k==='y'?3.2:2.1));}}
  }
  return focus;
 }
 status(){
  if(!this.ready)return null;const g=this.game,c=this.controller,base=c.status(),riding=!!g.player.ridingTrain,stopped=c.state==='stopped';
  const automatic=this.autoDeparture?{phase:this.autoDeparture.phase,remaining:this.autoDeparture.remaining,duration:this.autoDeparture.duration}:null;
  return {...base,phase:c.state,stopped,canContinue:riding&&stopped&&!g.frozen,canGetOff:riding&&stopped&&!g.frozen&&!!this.exitPoint(),canRead:riding&&stopped&&c.currentStation?.id!=='harbor'&&!g.frozen,autoDeparture:automatic,autoDepartureRemaining:automatic?.remaining??null,autoDepartureDuration:automatic?.duration??null,departureHoldReason:this.departureHoldReason,progress:base.distance/c.length,nearStation:this.nearStation?.id||null,boardingPoints:c.stations.map(s=>({id:s.id,position:this.world(s.boarding||s.approach)})),position:{...c.position},passengerPose:c.seatPose(),length:c.length,returningPassenger:this.returningPassenger};
 }
}
