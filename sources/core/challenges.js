import {segmentCrossesGate} from './race.js';

export const LAMP_SYMBOLS = [{id:'wave',name:'Wave',symbol:'≈',color:'#54b9bf'},{id:'star',name:'Star',symbol:'★',color:'#f4be52'},{id:'shell',name:'Shell',symbol:'◒',color:'#ee947d'}];

export function cargoInside(box, berth) {
  const half=(box.halfSize??1.115)*(Math.abs(Math.cos(box.yaw||0))+Math.abs(Math.sin(box.yaw||0)));
  return Math.abs(box.x-berth.x)+half<=berth.halfWidth && Math.abs(box.z-berth.z)+half<=berth.halfDepth && box.speed<.35 && Math.abs(box.angularSpeed||0)<.15;
}

export class ChallengeManager {
  constructor({gates=[],berths=[],now=()=>performance.now(),random=Math.random,onEvent=()=>{}}={}) {
    this.gates=gates;this.berths=berths;this.now=now;this.random=random;this.onEvent=onEvent;this.epoch=0;this.sequence=[];this.cancel();
  }
  start(kind){
    const old=this.sequence.join(',');this.cancel();this.kind=kind;
    this.sequence=LAMP_SYMBOLS.map(x=>x.id);
    for(let i=2;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.sequence[i],this.sequence[j]]=[this.sequence[j],this.sequence[i]];}
    if(this.sequence.join(',')===old)this.sequence.push(this.sequence.shift());
    this.state=kind==='lighthouse'?'running':'countdown';this.deadline=this.now()+3000;this.startTime=this.now();
    this.onEvent({type:'start',kind,epoch:this.epoch});
  }
  updateClock(){
    const t=this.now();
    if(this.state==='countdown'&&t>=this.deadline){this.state='running';this.startTime=this.deadline;this.pauseDuration=0;this.onEvent({type:'release'});}
    else if(this.state==='resuming'&&t>=this.deadline){this.pauseDuration+=t-this.pauseTime;this.state='running';this.onEvent({type:'release'});}
    if(this.state==='running'&&this.kind!=='lighthouse')this.elapsed=Math.max(0,t-this.startTime-this.pauseDuration);
  }
  tick(a,b,dt=0,boxes=[]){
    this.updateClock();if(this.state!=='running')return;
    if(this.kind==='buoy'){
      while(this.index<this.gates.length&&segmentCrossesGate(a,b,this.gates[this.index])){
        const split=this.elapsed-(this.splits.at(-1)||0);this.splits.push(this.elapsed);this.index++;
        this.onEvent({type:'gate',index:this.index,split,position:this.gates[this.index-1]});
        if(this.index===this.gates.length){this.finish();break;}
      }
    }else if(this.kind==='cargo'){
      for(const box of boxes){
        if(this.delivered.has(box.id))continue;
        const berth=this.berths.find(b=>b.id===box.id);
        const settled=berth&&cargoInside(box,berth);
        this.settled.set(box.id,settled?(this.settled.get(box.id)||0)+dt:0);
        if(this.settled.get(box.id)>=1){this.delivered.add(box.id);this.index=this.delivered.size;this.onEvent({type:'delivery',id:box.id,position:berth});}
      }
      if(this.delivered.size===3)this.finish();
    }
  }
  activateLamp(id){
    if(this.kind!=='lighthouse'||this.state!=='running')return false;
    if(this.sequence[this.index]!==id){this.index=0;this.onEvent({type:'wrong-lamp',id});return false;}
    this.index++;this.onEvent({type:'lamp',id,index:this.index});if(this.index===3)this.finish();return true;
  }
  finish(){const result={type:'finish',kind:this.kind,elapsed:this.elapsed,epoch:this.epoch};this.state='finished';this.onEvent(result);}
  pause(){
    if(!this.active||this.state==='paused')return false;
    if(this.state==='resuming'){this.state='paused';return true;}
    this.updateClock();this.beforePause=this.state;this.pauseTime=this.now();this.remaining=this.state==='countdown'?Math.max(0,this.deadline-this.pauseTime):0;this.state='paused';return true;
  }
  resume(){if(this.state!=='paused')return;this.state=this.beforePause==='countdown'?'countdown':'resuming';this.deadline=this.now()+Math.max(2000,this.remaining||0);}
  cancel(){this.epoch++;this.kind=null;this.state='idle';this.index=0;this.elapsed=0;this.pauseDuration=0;this.pauseTime=0;this.beforePause=null;this.remaining=0;this.delivered=new Set();this.settled=new Map();this.splits=[];}
  get active(){return !['idle','finished'].includes(this.state);}
  get frozen(){return ['countdown','paused','resuming'].includes(this.state);}
}
