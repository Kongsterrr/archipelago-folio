// Session-only introductions: persistent visit stamps keep their original meaning.
export class IslandArrival {
 constructor(){this.seen=new Set();this.cancel();}
 start(island,bounds){
  this.cancel();if(this.seen.has(island.id))return false;
  this.seen.add(island.id);this.island=island;this.bounds=bounds;this.elapsed=0;return true;
 }
 get active(){return !!this.island;}
 get progress(){const t=Math.max(0,Math.min(1,(this.elapsed-.8)/2.4));return t;}
 tick(dt,{paused=false,reduced=false}={}){
  if(!this.active||paused)return false;
  this.elapsed+=Math.max(0,dt);
  if(this.elapsed>=(reduced?2.5:3.2)){this.cancel();return true;}return false;
 }
 view(reduced=false){return this.active?{bounds:this.bounds,progress:reduced?0:this.progress}:null;}
 cancel(){this.island=null;this.bounds=null;this.elapsed=0;}
}
