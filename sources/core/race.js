export function segmentHitsCircle(a,b,c,r){const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz;const t=l?Math.max(0,Math.min(1,((c.x-a.x)*dx+(c.z-a.z)*dz)/l)):0;return Math.hypot(a.x+t*dx-c.x,a.z+t*dz-c.z)<=r;}
// Cross the gate plane in the course direction, between the two buoys.
// The whole movement segment is tested so fast frames cannot skip a gate.
export function segmentCrossesGate(a,b,g){
 const start=(a.x-g.x)*g.nx+(a.z-g.z)*g.nz;
 const end=(b.x-g.x)*g.nx+(b.z-g.z)*g.nz;
 if(start>=0||end<0)return false;
 const t=-start/(end-start),x=a.x+(b.x-a.x)*t-g.x,z=a.z+(b.z-a.z)*t-g.z;
 return Math.abs(x*g.nz-z*g.nx)<=g.r-.8;
}
export function formatTime(ms){const cs=Math.floor(ms/10),s=Math.floor(cs/100);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}.${String(cs%100).padStart(2,'0')}`;}
export class Race{
 constructor(gates,{now=()=>performance.now(),best=0,onFinish=()=>{}}={}){this.gates=gates;this.now=now;this.best=best;this.onFinish=onFinish;this.state='idle';this.index=0;this.elapsed=0;}
 start(){this.cancel();this.state='countdown';this.deadline=this.now()+3000;}
 tick(a,b){const t=this.now();if(this.state==='countdown'&&t>=this.deadline){this.state='running';this.startTime=t;this.pauseDuration=0;}else if(this.state==='resuming'&&t>=this.deadline){this.pauseDuration+=t-this.pauseTime;this.state=this.beforePause;}if(this.state!=='running')return;this.elapsed=t-this.startTime-this.pauseDuration;const g=this.gates[this.index];if(g&&segmentCrossesGate(a,b,g)){this.index++;if(this.index===this.gates.length){this.state='finished';if(!this.best||this.elapsed<this.best)this.best=this.elapsed;this.onFinish(this.elapsed,this.best);}}}
 pause(){if(!['running','countdown','resuming'].includes(this.state))return false;if(this.state==='resuming'){this.state='paused';return true;}this.beforePause=this.state;this.pauseTime=this.now();if(this.state==='countdown')this.remaining=this.deadline-this.pauseTime;this.state='paused';return true;}
 resume(){if(this.state!=='paused')return;if(this.beforePause==='countdown'){this.state='countdown';this.deadline=this.now()+Math.max(2000,this.remaining);return;}this.state='resuming';this.deadline=this.now()+2000;}
 cancel(){this.state='idle';this.index=0;this.elapsed=0;this.pauseTime=0;this.pauseDuration=0;this.beforePause=null;}
 get active(){return !['idle','finished'].includes(this.state);}
 get frozen(){return ['countdown','paused','resuming'].includes(this.state);}
}
