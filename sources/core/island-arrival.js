// Replay on every successful landing, independently of persistent visit stamps.
const HOLD_SECONDS=.5,APPROACH_SECONDS=1.8;
export class IslandArrival {
 constructor(){this.cancel();}
 start(island,bounds){
  this.cancel();this.island=island;this.bounds=bounds;return true;
 }
 get active(){return !!this.island;}
 get progress(){return Math.max(0,Math.min(1,(this.elapsed-HOLD_SECONDS)/APPROACH_SECONDS));}
 tick(dt,{paused=false,reduced=false}={}){
  if(!this.active||paused)return false;
  this.elapsed+=Math.max(0,dt);
  if(this.elapsed>=(reduced?2.5:HOLD_SECONDS+APPROACH_SECONDS)){this.cancel();return true;}return false;
 }
 view(reduced=false){return this.active?{bounds:this.bounds,progress:reduced?0:this.progress}:null;}
 cancel(){this.island=null;this.bounds=null;this.elapsed=0;}
}
