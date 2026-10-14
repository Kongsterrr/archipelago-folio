// Locomotion is independent from panels/background pauses and challenge time.
export class PlayerController{
 constructor(boat,character){this.boat=boat;this.character=character;this.mode='sailing';this.island=null;this.berth=null;this.transitionEpoch=0;this.pauseReasons=new Set();this.ashoreTime=0;}
 get walking(){return this.mode==='walking';}
 get ridingQuad(){return this.mode==='riding-quad';}
 get ridingBicycle(){return this.mode==='riding-bicycle';}
 get ridingCar(){return this.mode==='riding-car';}
 get ridingTrain(){if(this.mode==='riding-train')return true;if(!['boarding-train','leaving-train'].includes(this.mode))return false;return this.transition?.committed?this.transition.destination==='riding-train':this.stableMode==='riding-train';}
 get ridingVehicle(){return this.ridingQuad||this.ridingBicycle||this.ridingCar;}
 get activeVehicle(){return this.ridingCar?this.car:this.ridingBicycle?this.bicycle:this.ridingQuad?this.quad:null;}
 get transitioning(){return ['boarding','disembarking','boarding-train','leaving-train','calling-train'].includes(this.mode);}
 get onLand(){return this.walking||this.ridingVehicle||this.ridingTrain||this.mode==='boarding-train'||this.mode==='leaving-train'||this.mode==='calling-train'||(this.mode==='boarding'&&!this.transition?.committed)||(this.mode==='disembarking'&&!!this.transition?.committed);}
 get transitionOpacity(){const t=this.transition;return !t?0:t.commitFrame?1:Math.sin(Math.min(1,t.elapsed/t.duration)*Math.PI);}
 get activeActor(){return this.ridingTrain?(this.train||this.character):this.ridingVehicle?(this.activeVehicle||this.character):this.onLand?this.character:this.boat;}
 invalidate(){this.transitionEpoch++;this.transition=null;return this.transitionEpoch;}
 begin(mode,commit,{duration=.6}={}){if(this.transitioning)return false;const epoch=this.invalidate();this.stableMode=this.mode;this.mode=mode;this.transition={epoch,elapsed:0,duration,commit,committed:false,commitFrame:false};return true;}
 tick(dt){const t=this.transition;if(!t||this.pauseReasons.size)return;if(t.epoch!==this.transitionEpoch)return; t.elapsed+=dt;
  t.commitFrame=false;
  if(t.elapsed>=t.duration/2&&!t.committed){t.elapsed=t.duration/2;t.committed=true;t.commitFrame=true;t.commit();return;}
  if(t.elapsed>=t.duration){this.mode=t.destination||this.mode;this.transition=null;}
 }
 rideQuad(quad){if(!this.walking||!quad||this.pauseReasons.size||this.transitioning)return false;this.quad=quad;this.character.enable(false);this.character.seated=false;this.mode='riding-quad';this.ashoreTime=0;return true;}
 leaveQuad(point){if(!this.ridingQuad||!point||this.pauseReasons.size)return false;this.character.teleport(point,this.character.walkWorld);this.character.enable(true);this.mode='walking';this.ashoreTime=0;return true;}
 rideBicycle(bicycle){if(!this.walking||!bicycle||this.pauseReasons.size||this.transitioning)return false;this.bicycle=bicycle;this.character.enable(false);this.character.seated=false;this.mode='riding-bicycle';this.ashoreTime=0;return true;}
 leaveBicycle(point){if(!this.ridingBicycle||!point||this.pauseReasons.size)return false;this.character.teleport(point,this.character.walkWorld);this.character.enable(true);this.mode='walking';this.ashoreTime=0;return true;}
 rideCar(car){if(!this.walking||!car||this.pauseReasons.size||this.transitioning)return false;this.car=car;this.character.enable(false);this.character.seated=false;this.mode='riding-car';this.ashoreTime=0;return true;}
 leaveCar(point){if(!this.ridingCar||!point||this.pauseReasons.size)return false;this.character.teleport(point,this.character.walkWorld);this.character.enable(true);this.mode='walking';this.ashoreTime=0;return true;}
 toSailing(){this.invalidate();this.mode='sailing';this.character.enable(false);this.character.seated=false;this.island=null;this.berth=null;this.ashoreTime=0;}
}

export class BoardingController{
 constructor(player,{prepare,select,onCommit,onError}={}){Object.assign(this,{player,prepare,select,onCommit,onError});this.pending=false;}
 async disembark(island){const p=this.player;if(p.mode!=='sailing'||this.pending||p.pauseReasons.size)return false;const epoch=p.invalidate();this.pending=true;this.pendingEpoch=epoch;p.boat.hold();
  try{const prepared=await this.prepare(island);if(epoch!==p.transitionEpoch)return false;const berth=this.select(island,prepared);if(!berth)throw new Error('This berth is busy. Read the island or try again in a moment.');
   p.begin('disembarking',()=>{p.transition.destination='walking';this.onCommit('ashore',island,berth,prepared);});return true;
  }catch(e){if(epoch===p.transitionEpoch)this.onError(e);return false;}finally{if(this.pendingEpoch===epoch)this.pending=false;}
 }
 board(){const p=this.player;if(!p.walking||p.pauseReasons.size)return false;return p.begin('boarding',()=>{p.transition.destination='sailing';this.onCommit('aboard',p.island,p.berth);});}
 cancel(){this.pending=false;const p=this.player;if(p.transitioning){p.mode=p.transition?.committed?(p.transition.destination||p.stableMode):p.stableMode;}p.invalidate();}
}
