// Locomotion is independent from panels/background pauses and challenge time.
export class PlayerController{
 constructor(boat,character){this.boat=boat;this.character=character;this.mode='sailing';this.island=null;this.berth=null;this.transitionEpoch=0;this.pauseReasons=new Set();this.ashoreTime=0;}
 get walking(){return this.mode==='walking';}
 get ridingQuad(){return this.mode==='riding-quad';}
 get transitioning(){return this.mode==='boarding'||this.mode==='disembarking';}
 get onLand(){return this.walking||this.ridingQuad||(this.mode==='boarding'&&!this.transition?.committed)||(this.mode==='disembarking'&&!!this.transition?.committed);}
 get activeActor(){return this.ridingQuad?(this.quad||this.character):this.onLand?this.character:this.boat;}
 invalidate(){this.transitionEpoch++;this.transition=null;return this.transitionEpoch;}
 begin(mode,commit){if(this.transitioning)return false;const epoch=this.invalidate();this.stableMode=this.mode;this.mode=mode;this.transition={epoch,elapsed:0,commit,committed:false};return true;}
 tick(dt){const t=this.transition;if(!t||this.pauseReasons.size)return;if(t.epoch!==this.transitionEpoch)return; t.elapsed+=dt;
  if(t.elapsed>=.3&&!t.committed){t.committed=true;t.commit();}
  if(t.elapsed>=.6){this.mode=t.destination||this.mode;this.transition=null;}
 }
 rideQuad(quad){if(!this.walking||!quad||this.pauseReasons.size||this.transitioning)return false;this.quad=quad;this.character.enable(false);this.character.seated=false;this.mode='riding-quad';this.ashoreTime=0;return true;}
 leaveQuad(point){if(!this.ridingQuad||!point||this.pauseReasons.size)return false;this.character.teleport(point,this.character.walkWorld);this.character.enable(true);this.mode='walking';this.ashoreTime=0;return true;}
 toSailing(){this.invalidate();this.mode='sailing';this.character.enable(false);this.character.seated=false;this.island=null;this.berth=null;this.ashoreTime=0;}
}

export class BoardingController{
 constructor(player,{prepare,select,onCommit,onError}={}){Object.assign(this,{player,prepare,select,onCommit,onError});this.pending=false;}
 async disembark(island){const p=this.player;if(p.mode!=='sailing'||this.pending||p.pauseReasons.size)return false;const epoch=p.invalidate();this.pending=true;this.pendingEpoch=epoch;p.boat.hold();
  try{const prepared=await this.prepare(island);if(epoch!==p.transitionEpoch)return false;const berth=this.select(island,prepared);if(!berth)throw new Error('This berth is busy. Read the island or try again in a moment.');
   p.begin('disembarking',()=>{this.onCommit('ashore',island,berth,prepared);p.transition.destination='walking';});return true;
  }catch(e){if(epoch===p.transitionEpoch)this.onError(e);return false;}finally{if(this.pendingEpoch===epoch)this.pending=false;}
 }
 board(){const p=this.player;if(!p.walking||p.pauseReasons.size)return false;return p.begin('boarding',()=>{this.onCommit('aboard',p.island,p.berth);p.transition.destination='sailing';});}
 cancel(){this.pending=false;const p=this.player;if(p.transitioning){p.mode=p.transition?.committed?(p.transition.destination||p.stableMode):p.stableMode;}p.invalidate();}
}
