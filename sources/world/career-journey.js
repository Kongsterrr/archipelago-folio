import * as THREE from 'three';
import {CareerTrainController,CAREER_TRAIN} from '../core/career-train.js';
import {CareerTrainVisual} from './career-train.js';
import {localToWorld,WALK_GROUP} from '../core/character.js';
import {campusStationFocus} from '../core/campus-focus.js';
import {label} from './geometry.js';

// Integration owner: simulation and Jack's mount outlive any island GLB reload.
export class CareerJourney {
 constructor(game,R){this.game=game;this.R=R;this.returningPassenger=false;this.colliders=[];}
 async load(){
  if(this.ready)return true;if(this.promise)return this.promise;
  this.promise=this.loadNow().finally(()=>{this.promise=null;});return this.promise;
 }
 async loadNow(){
  const g=this.game,island=g.loaded.get('experience')?.island,layout=g.walkLayouts?.get('experience');
  if(!island||!layout?.railway)return false;
  try{
   const asset=await g.loader.loadAsync('/models/career-train.glb?v=19');
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
 nearby(){
  const g=this.game,p=g.player;
  g.canBoardTrain=false;g.canLeaveTrain=false;this.nearStation=null;this.callAction=null;
  if(this.marker)this.marker.visible=false;
  if(!this.ready||g.frozen)return;
  if(p.ridingTrain){g.canLeaveTrain=!!this.exitPoint();return;}
  if(!p.walking||p.island?.id!=='experience')return;
  const point=p.activeActor.position;
  const candidates=this.railway.stations.map(station=>({station,position:this.world(station.boarding||station.approach)})).filter(s=>Math.hypot(point.x-s.position.x,point.z-s.position.z)<2.1&&Math.abs(point.y-s.position.y)<.8&&this.walk.visible(point,s.position)).sort((a,b)=>Math.hypot(point.x-a.position.x,point.z-a.position.z)-Math.hypot(point.x-b.position.x,point.z-b.position.z));
  const nearest=candidates[0];if(!nearest)return;
  this.nearStation=nearest.station;
  const c=this.controller;
  g.canBoardTrain=c.canBoard(nearest.station.id);
  if(g.canBoardTrain){this.marker.position.set(nearest.position.x,nearest.position.y+1.5,nearest.position.z);this.marker.visible=true;}
  else if(!c.passenger){
   const approaching=c.targetStationId===nearest.station.id&&c.state!=='stopped';
   const eta=c.eta;
   this.callAction={id:'train-call-'+nearest.station.id,label:approaching?`Train arriving${eta==null?'':` · ${eta}s`}`:'Call train',position:nearest.position,run:()=>this.call(nearest.station.id)};
  }
 }
 exitPoint(){
  if(!this.ready||this.controller.state!=='stopped')return null;
  const station=this.controller.currentStation,exit=station?.exit||station?.boarding;
  if(!exit)return null;
  const point=this.world(exit),height=this.walk.groundAt(point);
  if(!this.walk.clear(point)||Math.abs(height-point.y)>.25)return null;
  return {...point,y:height};
 }
 board(){
  const g=this.game,c=this.controller,p=g.player;
  this.nearby();if(!g.canBoardTrain||!this.nearStation||g.frozen||!p.walking)return false;
  const id=this.nearStation.id;g.cancelChallenge();g.inputs.setEnabled(false);g.character.hold();
  return p.begin('boarding-train',()=>{
   c.step(0,{paused:false});
   if(!c.board(id)){p.transition.destination='walking';return;}
   p.train=c;p.transition.destination='riding-train';g.character.enable(false);g.character.seated=false;
   this.returningPassenger=false;this.visual.update(1);g.jack.resetPose('sit');g.jack.forceFrame=true;g.resetCamera();
  });
 }
 leave(){
  const g=this.game,p=g.player,c=this.controller,point=this.exitPoint();
  if(g.frozen||!p.ridingTrain||!point)return false;
  g.inputs.setEnabled(false);this.returningPassenger=false;
  return p.begin('leaving-train',()=>{
   c.step(0,{paused:false});
   const safePoint=this.exitPoint();
   if(!safePoint||!c.leave()){p.transition.destination='riding-train';return;}
   p.transition.destination='walking';g.character.teleport(safePoint,this.walk);g.character.enable(true);g.character.seated=false;
   if(g.jack.root.parent!==g.scene)g.scene.add(g.jack.root);g.jack.resetPose('idle');g.jack.forceFrame=true;g.resetCamera();
  });
 }
 continue(){
  const g=this.game;if(g.frozen||!g.player.ridingTrain)return false;
  g.inputs.clear();this.controller.step(0,{paused:false});return this.controller.continue();
 }
 call(id=this.nearStation?.id){
  const g=this.game;this.nearby();if(g.frozen||!g.player.walking||!this.nearStation||id!==this.nearStation.id)return false;
  g.inputs.clear();const ok=this.controller.call(id);if(ok)g.events.trigger('message',[`The train is on its way to ${this.nearStation.label}.`]);return ok;
 }
 read(){
  const g=this.game,c=this.controller,stop=c?.currentStation;
  if(g.frozen||!g.player.ridingTrain||!stop?.contentId||stop.id==='harbor')return false;
  const station=this.walk.layout.stations.find(s=>s.contentId===stop.contentId&&s.primary);
  if(!station)return false;
  g.inputs.clear();g.events.trigger('exhibit',[{island:'experience',station:{...station,trainReader:true,readFull:true},position:this.world(station)}]);return true;
 }
 returnToHarbor(){
  const g=this.game;if(g.frozen||!g.player.ridingTrain)return false;
  g.inputs.clear();this.returningPassenger=true;this.controller.step(0,{paused:false});
  if(this.controller.currentStation?.id==='harbor')return this.leave();
  return this.controller.returnToHarbor();
 }
 cancel({restoreLanding=true}={}){
  const g=this.game,p=g.player;
  const riding=p?.ridingTrain||['boarding-train','leaving-train'].includes(p?.mode);
  this.returningPassenger=false;
  if(riding){
   p.invalidate();p.mode='walking';g.inputs.clear();
   if(g.jack.root.parent!==g.scene)g.scene.add(g.jack.root);
   if(restoreLanding&&p.berth){g.character.teleport(p.berth.landing,this.walk);g.character.enable(true);}
   else g.character.enable(false);
   g.jack.resetPose('idle');g.jack.forceFrame=true;
  }
  this.controller?.cancelRide();
 }
 step(dt,paused=false){
  if(!this.ready)return;
  const g=this.game;
  const pedestrians=g.player.walking&&g.player.island?.id==='experience'?[g.character.position]:[];
  this.controller.step(dt,{paused,pedestrians});this.syncPhysics(false);
  if(!paused&&this.returningPassenger&&g.player.ridingTrain&&this.controller.currentStation?.id==='harbor')this.leave();
 }
 syncPhysics(initial=false){
  if(!this.ready)return;
  this.colliders.forEach(({body},index)=>{
   const p=this.controller.carPose(index),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(p.pitch,p.yaw,0,'YXZ'));
   if(initial){body.setTranslation(p,true);body.setRotation(q,true);}
   body.setNextKinematicTranslation(p);body.setNextKinematicRotation(q);
  });
 }
 update(alpha,frozen){if(this.ready)this.visual.update(alpha,{frozen});}
 cameraView(){
  if(!this.ready)return null;
  const c=this.controller,d=((c.distance%c.length)+c.length)%c.length,keys=this.railway.cameraPoints||[];
  let azimuth=this.island.rotation+.28,elevation=.60;
  if(keys.length){
   const ordered=[...keys].sort((a,b)=>a.distance-b.distance);let a=ordered.at(-1),b=ordered[0],span=c.length-a.distance+b.distance,along=(d-a.distance+c.length)%c.length;
   for(let n=0;n<ordered.length-1;n++)if(d>=ordered[n].distance&&d<ordered[n+1].distance){a=ordered[n];b=ordered[n+1];span=b.distance-a.distance;along=d-a.distance;break;}
   const t=Math.max(0,Math.min(1,along/Math.max(.01,span))),smooth=t*t*(3-2*t);
   azimuth=this.island.rotation+a.azimuth+Math.atan2(Math.sin(b.azimuth-a.azimuth),Math.cos(b.azimuth-a.azimuth))*smooth;
   elevation=(a.elevation??.6)+((b.elevation??.6)-(a.elevation??.6))*smooth;
  }
  const station=c.currentStation,reader=station?.contentId&&this.walk.layout.stations.find(s=>s.primary&&s.contentId===station.contentId);
  return {azimuth,elevation,distance:32,lookAt:reader?this.world(reader):null};
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
  return {...base,phase:c.state,stopped,canContinue:riding&&stopped&&!g.frozen,canGetOff:riding&&stopped&&!g.frozen&&!!this.exitPoint(),canRead:riding&&stopped&&c.currentStation?.id!=='harbor'&&!g.frozen,progress:base.distance/c.length,nearStation:this.nearStation?.id||null,boardingPoints:c.stations.map(s=>({id:s.id,position:this.world(s.boarding||s.approach)})),position:{...c.position},passengerPose:c.seatPose(),length:c.length,returningPassenger:this.returningPassenger};
 }
}
