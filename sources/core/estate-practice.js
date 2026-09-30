const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function golfHeight(h,x,z,groundY=.85){return groundY+.035+(h.slopeX||0)*(x-h.tee.x)+(h.slopeZ||0)*(z-h.tee.z)+(h.undulation||0)*Math.sin((x+9)/18*Math.PI)**2;}
export function golfGradient(h,x){return{x:(h.slopeX||0)+(h.undulation||0)*Math.sin(2*(x+9)/18*Math.PI)*Math.PI/18,z:h.slopeZ||0};}
export const TENNIS_CONTACT=Object.freeze({x:.1675551656,y:.5140882649,z:-.4700406224});
export const GOLF_CONTACT=Object.freeze({x:.0622178670,y:.0560362854,z:-.2862233372});
export function segmentDistance3D(a,b,p){const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/(dx*dx+dy*dy+dz*dz||1),0,1);return Math.hypot(a.x+dx*t-p.x,a.y+dy*t-p.y,a.z+dz*t-p.z);}
export function segmentDistance(a,b,p){const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(a.x+dx*t-p.x,a.z+dz*t-p.z);}
// All coordinates are island-local and all clocks advance only through tick().
export class EstatePracticeController{
 constructor({onEvent=()=>{}}={}){this.onEvent=onEvent;this.epoch=0;this.cancel();}
 configure(sports,groundY=.85){this.config=sports;this.groundY=groundY;const c=sports.tennis;this.tennisConfig=c?{...c,minX:c.minX??c.baseline?.minX??12,maxX:c.maxX??c.baseline?.maxX??20,baselineZ:c.baselineZ??c.baseline?.z??4,machineZ:c.machineZ??c.machine?.z??-13.5,machineX:c.machine?.x??16,machineY:c.machine?.y??groundY+1.1,surfaceY:c.surfaceY??groundY+.04,netZ:c.netZ??c.net?.z??-5,netHeight:c.net?.height??1.02}:null;}
 get active(){return this.state!=='idle';}
 get frozen(){return ['paused','countdown','resuming','finished'].includes(this.state);}
 start(kind){if(!['tennis','golf'].includes(kind)||!this.config?.[kind])return false;this.cancel();this.kind=kind;this.state='countdown';this.remaining=2;this.index=0;this.score=0;this.attempts=0;this.elapsed=0;this.actor={x:16,z:4,y:this.groundY,yaw:0};this.setupRound();this.onEvent({type:'start',kind});return true;}
 setupRound(){this.swing=-1;this.charge=0;this.holding=false;this.hitQueued=false;this.ball=null;this.stage='ready';this.stageTime=0;this.shot=false;
  if(this.kind==='tennis'){const c=this.tennisConfig;this.targetX=(c.targets||[13,16,19])[[1,0,2,0,2,1][this.index]];this.actor={x:clamp(this.actor.x,c.minX??12,c.maxX??20),z:c.baselineZ??4,y:c.surfaceY,yaw:0};this.stage='waiting';this.stageTime=.8;}
  else{const h=this.config.golf.holes[this.index];this.aim=0;this.positionGolfer();this.ball={...h.tee,y:golfHeight(h,h.tee.x,h.tee.z,this.groundY)+.07,vx:0,vz:0};}
 }
 positionGolfer(){const h=this.config.golf.holes[this.index],yaw=-Math.PI/2-this.aim,c=Math.cos(yaw),s=Math.sin(yaw);this.actor={x:h.tee.x-(GOLF_CONTACT.x*c+GOLF_CONTACT.z*s),z:h.tee.z-(-GOLF_CONTACT.x*s+GOLF_CONTACT.z*c),y:golfHeight(h,h.tee.x,h.tee.z,this.groundY),yaw};}
 pause(){if(!this.active||this.state==='paused')return;this.beforePause=this.state==='resuming'?'running':this.state;this.state='paused';this.clearInput();}
 resume(){if(this.state!=='paused')return;if(this.beforePause==='finished'){this.state='finished';return;}this.state='resuming';this.remaining=2;this.clearInput();}
 clearInput(){this.hitQueued=false;this.charge=0;this.holding=false;this.waitRelease=true;}
 cancel(){this.epoch++;this.kind=null;this.state='idle';this.stage='idle';this.ball=null;this.swing=-1;this.charge=0;this.holding=false;this.hitQueued=false;this.waitRelease=true;this.elapsed=0;this.score=0;this.attempts=0;this.index=0;this.remaining=0;}
 advanceCountdown(dt){if(!['countdown','resuming'].includes(this.state))return;this.remaining=Math.max(0,this.remaining-dt);if(this.remaining===0){this.state='running';this.onEvent({type:'release'});}}
 hit(){if(this.kind==='tennis'&&this.state==='running'&&this.swing<0)this.hitQueued=true;}
 tick(dt,{right=0,held=false}={}){
  if(this.state!=='running')return;this.elapsed+=dt;
  if(this.kind==='tennis')this.tennis(dt,right);else this.golf(dt,right,held);
 }
 tennis(dt,right){const c=this.tennisConfig;this.actor.x=clamp(this.actor.x+clamp(right,-1,1)*2.4*dt,c.minX??12,c.maxX??20);
  if(this.hitQueued&&this.swing<0){this.swing=0;this.hitQueued=false;}
  if(this.swing>=0){this.swing+=dt/.55;if(this.swing>1)this.swing=-1;}
  if(this.stage==='waiting'){this.stageTime-=dt;if(this.stageTime<=0){const z=c.machineZ,vz=6.8,arrival=(c.baselineZ+TENNIS_CONTACT.z-z)/vz;this.ball={x:c.machineX,y:c.machineY,z,vx:(this.targetX-c.machineX)/arrival,vy:3.65,vz,bounces:0,returned:false};this.stage='flight';}return;}
  const b=this.ball;if(!b)return;const before={...b};b.x+=b.vx*dt;b.z+=b.vz*dt;b.y+=b.vy*dt-2*dt*dt;b.vy-=4*dt;
  const netZ=c.netZ;if((before.z-netZ)*(b.z-netZ)<0){const t=(netZ-before.z)/(b.z-before.z),height=before.y+(b.y-before.y)*t;if(height<this.groundY+c.netHeight+.095){this.resolveTennis(false);return;}}
  const contact={x:this.actor.x+TENNIS_CONTACT.x,y:this.actor.y+TENNIS_CONTACT.y,z:this.actor.z+TENNIS_CONTACT.z};
  if(!b.returned&&b.bounces===1&&this.swing>=.38&&this.swing<=.62&&segmentDistance3D(before,b,contact)<.34){b.returned=true;b.vz=-9;b.vy=2.8;b.vx=(c.machineX-b.x)/1.55;this.onEvent({type:'hit',kind:'tennis'});}
  if(b.y<=c.surfaceY+.095&&b.vy<0){b.y=c.surfaceY+.095;
   if(b.returned){this.resolveTennis(b.z<netZ&&b.z> (c.machineZ??-13.5)-1&&b.x>=11&&b.x<=21);return;}
   b.bounces++;if(b.bounces>1){this.resolveTennis(false);return;}b.vy=-b.vy*.40;
  }
  if(b.z>(c.baselineZ??4)+2.5||b.x<10||b.x>22)this.resolveTennis(false);
 }
 resolveTennis(success){if(success)this.score++;this.index++;this.onEvent({type:'ball',success,index:this.index});if(this.index>=6){this.finish();return;}this.setupRound();this.stageTime=1.2;}
 golf(dt,right,held){const h=this.config.golf.holes[this.index];
  if(this.waitRelease){if(!held)this.waitRelease=false;held=false;}
  if(this.stage==='ready'){
   this.aim=clamp(this.aim+clamp(right,-1,1)*.65*dt,-.65,.65);this.positionGolfer();
   if(held){this.holding=true;this.charge=clamp(this.charge+dt/1.5,0,1);}
   else if(this.holding){this.power=this.charge;this.charge=0;this.holding=false;this.swing=0;this.stage='swing';this.attempts++;}
  }
  if(this.stage==='swing'){this.swing+=dt/.65;if(this.swing>=.5){const speed=.7+3.5*this.power;this.ball.vx=Math.cos(this.aim)*speed;this.ball.vz=Math.sin(this.aim)*speed;this.stage='rolling';this.rollTime=0;this.onEvent({type:'hit',kind:'golf'});}}
  else if(this.swing>=0){this.swing+=dt/.65;if(this.swing>1)this.swing=-1;}
  if(this.stage==='rolling'){
   const b=this.ball,before={...b},gradient=golfGradient(h,b.x);this.rollTime+=dt;
   const sand=h.sand&&((b.x-h.sand.x)/h.sand.rx)**2+((b.z-h.sand.z)/h.sand.rz)**2<1;
   const edge=Math.min(b.x-h.bounds.minX,h.bounds.maxX-b.x,b.z-h.bounds.minZ,h.bounds.maxZ-b.z),drag=sand?2.8:edge<.18?1.1:.5;
   const speed=Math.hypot(b.vx,b.vz),next=Math.max(0,speed-drag*dt);if(speed){b.vx=b.vx/speed*next;b.vz=b.vz/speed*next;}
   b.vx-=gradient.x*6*dt;b.vz-=gradient.z*6*dt;b.x+=b.vx*dt;b.z+=b.vz*dt;
   if(segmentDistance(before,b,h.cup)<.23&&Math.hypot(b.vx,b.vz)<1.8){b.x=h.cup.x;b.z=h.cup.z;b.vx=b.vz=0;this.stage='holed';this.stageTime=1.1;this.score++;this.onEvent({type:'hole',index:this.index});}
   if(b.x<h.bounds.minX||b.x>h.bounds.maxX){b.x=clamp(b.x,h.bounds.minX,h.bounds.maxX);b.vx*=-.25;}if(b.z<h.bounds.minZ||b.z>h.bounds.maxZ){b.z=clamp(b.z,h.bounds.minZ,h.bounds.maxZ);b.vz*=-.25;}
   b.y=golfHeight(h,b.x,b.z,this.groundY)+.07;
   if(this.stage==='rolling'&&(Math.hypot(b.vx,b.vz)<.11||this.rollTime>12)){this.stage='retry';this.stageTime=1.2;}
  }
  if(['holed','retry'].includes(this.stage)){this.stageTime-=dt;if(this.stageTime<=0){if(this.stage==='holed'){this.index++;if(this.index>=3){this.finish();return;}}this.setupRound();this.waitRelease=true;}}
 }
 finish(){this.state='finished';this.swing=-1;this.clearInput();this.onEvent({type:'finish',kind:this.kind,score:this.score,attempts:this.attempts});}
 pose(){return this.active?{kind:this.kind,phase:this.swing>=0?'swing':'ready',swing:this.swing,charge:this.charge}:null;}
 status(){return{kind:this.kind,state:this.state,stage:this.stage,index:this.index,score:this.score,attempts:this.attempts,elapsed:this.elapsed,remaining:this.remaining,charge:this.charge,aim:this.aim||0,targetX:this.targetX,ball:this.ball?{...this.ball}:null,actor:this.actor?{...this.actor}:null,epoch:this.epoch};}
}
