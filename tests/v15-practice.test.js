import test from 'node:test';
import assert from 'node:assert/strict';
import {EstatePracticeController, TENNIS_CONTACT, GOLF_CONTACT, golfHeight, golfGradient, segmentDistance3D} from '../sources/core/estate-practice.js';
const STEP=1/60;
const holes=[
 {tee:{x:-7,z:-21},cup:{x:-1,z:-21},slopeX:0,slopeZ:0,undulation:0},
 {tee:{x:-7,z:-24},cup:{x:1,z:-24},slopeX:0,slopeZ:.012,undulation:.025},
 {tee:{x:-7,z:-27},cup:{x:3,z:-27},slopeX:0,slopeZ:0,undulation:.015,sand:{x:-2,z:-26.4,rx:1.2,rz:.45}},
].map(h=>({...h,bounds:{minX:-9,maxX:9,minZ:h.tee.z-1.3,maxZ:h.tee.z+1.3}}));
const sports={tennis:{baseline:{x:16,z:4,minX:12,maxX:20},net:{z:-5,height:1.02},machine:{x:16,y:1.95,z:-13.5},targets:[13,16,19]},golf:{holes}};
function fixture(kind){const events=[],p=new EstatePracticeController({onEvent:event=>events.push({...event,ball:p.ball?{...p.ball}:null})});p.configure(structuredClone(sports),.85);assert.equal(p.start(kind),true);p.advanceCountdown(2);return{p,events};}
function tennisInput(p){
 const gap=p.targetX-TENNIS_CONTACT.x-p.actor.x;
 if(p.ball&&!p.ball.returned&&p.swing<0&&(p.actor.z+TENNIS_CONTACT.z-p.ball.z)/p.ball.vz<.275)p.hit();
 return{right:Math.abs(gap)<.02?0:Math.sign(gap)};
}
function golfBot(){let index=-1,holdTicks=0;return p=>{
 if(index!==p.index){index=p.index;holdTicks=0;}
 if(p.stage!=='ready')return{};
 if(p.waitRelease)return{};
 const aim=[0,.05416666666666667,0][p.index],gap=aim-p.aim;
 if(Math.abs(gap)>.0001)return{right:Math.sign(gap)};
 if(holdTicks++<[50,60,70][p.index])return{held:true};
 return{};
};}
function simulate(kind,fps=60){const f=fixture(kind),bot=kind==='tennis'?tennisInput:golfBot();let accumulator=0;
 for(let frame=0;frame<fps*90&&f.p.state!=='finished';frame++){accumulator+=1/fps;while(accumulator+1e-10>=STEP&&f.p.state!=='finished'){f.p.tick(STEP,bot(f.p));accumulator-=STEP;}}
 return f;
}

test('six tennis balls require lateral movement and can return over the net into the opposite court',()=>{
 const{p,events}=simulate('tennis');assert.equal(p.state,'finished');assert.equal(p.index,6);assert.equal(p.score,6);assert.ok(p.elapsed>=30&&p.elapsed<=45);
 const returns=events.filter(e=>e.type==='ball');assert.equal(returns.length,6);
 for(const event of returns){assert.equal(event.success,true);assert.ok(event.ball.z<-5&&event.ball.z>-14.5);assert.ok(event.ball.x>=11&&event.ball.x<=21);}
});

test('tennis cannot score remotely, before a bounce, above the racket, or outside the strike timing window',()=>{
 for(const scenario of['remote','before-bounce','above','timing']){
  const{p}=fixture('tennis');p.stage='flight';p.swing=scenario==='timing'?.03:.45;
  const contact={x:p.actor.x+TENNIS_CONTACT.x,y:p.actor.y+TENNIS_CONTACT.y,z:p.actor.z+TENNIS_CONTACT.z};
  p.ball={...contact,x:contact.x+(scenario==='remote'?1:0),y:contact.y+(scenario==='above'?1:0),vx:0,vy:0,vz:.1,bounces:scenario==='before-bounce'?0:1,returned:false};
  p.tick(STEP,{});assert.equal(p.ball.returned,false,scenario);
 }
});

test('tennis uses the swept three-dimensional ball segment at the small racket contact region',()=>{
 const{p}=fixture('tennis');p.stage='flight';p.swing=.4;
 const c={x:p.actor.x+TENNIS_CONTACT.x,y:p.actor.y+TENNIS_CONTACT.y,z:p.actor.z+TENNIS_CONTACT.z};
 p.ball={x:c.x,y:c.y,z:c.z-.6,vx:0,vy:0,vz:30,bounces:1,returned:false};p.tick(.04,{});
 assert.equal(p.ball.returned,true,'Endpoints both lie outside the contact radius but the swept segment crosses it.');
 assert.ok(segmentDistance3D({x:0,y:2,z:-1},{x:0,y:2,z:1},{x:0,y:0,z:0})>1.9,'Height is part of the contact check.');
});

test('tennis without any strike finishes all six balls without awarding a success',()=>{
 const{p}=fixture('tennis');for(let i=0;i<4000&&p.state!=='finished';i++)p.tick(STEP,{});assert.equal(p.state,'finished');assert.equal(p.score,0);assert.equal(p.index,6);
});

test('golf completes all three real lane profiles including cross-slope and a side sand bunker',()=>{
 const{p,events}=simulate('golf');assert.equal(p.state,'finished');assert.equal(p.score,3);assert.equal(p.index,3);assert.equal(p.attempts,3);
 assert.equal(events.filter(e=>e.type==='hole').length,3);assert.equal(events.filter(e=>e.type==='hit').length,3);
});

test('golf sand increases drag and the cross-slope adds downhill motion; visual and sampled heights share the formula',()=>{
 const a=fixture('golf').p,b=fixture('golf').p;
 for(const p of[a,b]){p.index=2;p.setupRound();p.stage='rolling';p.rollTime=0;p.ball={x:-2,z:-26.4,y:1,vx:2,vz:0};}
 b.config.golf.holes[2].sand=null;a.tick(STEP,{});b.tick(STEP,{});assert.ok(Math.hypot(a.ball.vx,a.ball.vz)<Math.hypot(b.ball.vx,b.ball.vz)-.03);
 const{p}=fixture('golf');p.index=1;p.setupRound();p.stage='rolling';p.rollTime=0;p.ball.vx=2;p.tick(STEP,{});assert.ok(p.ball.vz<0);
 assert.ok(Math.abs(p.ball.y-golfHeight(p.config.golf.holes[1],p.ball.x,p.ball.z,.85)-.07)<1e-9);
 const h=holes[1],x=-3,epsilon=1e-4;assert.ok(Math.abs(golfGradient(h,x).x-(golfHeight(h,x+epsilon,h.tee.z)-golfHeight(h,x-epsilon,h.tee.z))/(2*epsilon))<1e-8);
});

test('putter stays on the tee at every aim angle and releases the ball only at the half-stroke contact',()=>{
 const{p,events}=fixture('golf');
 for(const aim of[-.65,-.2,0,.25,.65]){p.aim=aim;p.tick(STEP,{});const c=Math.cos(p.actor.yaw),s=Math.sin(p.actor.yaw);assert.ok(Math.abs(p.actor.x+GOLF_CONTACT.x*c+GOLF_CONTACT.z*s-holes[0].tee.x)<1e-9);assert.ok(Math.abs(p.actor.z-GOLF_CONTACT.x*s+GOLF_CONTACT.z*c-holes[0].tee.z)<1e-9);}
 p.aim=0;p.tick(STEP,{});for(let i=0;i<50;i++)p.tick(STEP,{held:true});p.tick(STEP,{});
 while(p.swing+STEP/.65<.5){assert.equal(p.ball.vx,0);assert.equal(events.filter(e=>e.type==='hit').length,0);p.tick(STEP,{});}
 p.tick(STEP,{});assert.ok(p.swing>=.5);assert.ok(p.ball.vx>0);assert.equal(events.filter(e=>e.type==='hit').length,1);
});

for(const kind of['tennis','golf'])test(`${kind} gives the same fixed-step result at 30, 60, and 120 rendered frames per second`,()=>{
 const results=[30,60,120].map(fps=>{const{p}=simulate(kind,fps);return{state:p.state,score:p.score,attempts:p.attempts,index:p.index,elapsed:p.elapsed,ball:p.ball,actor:p.actor};});
 assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);assert.equal(results[0].state,'finished');
});

test('pause freezes a committed stroke, clears pending charge, and requires fresh input after the resume countdown',()=>{
 const{p,events}=fixture('golf');p.tick(STEP,{});for(let i=0;i<20;i++)p.tick(STEP,{held:true});assert.ok(p.charge>0);p.pause();const snapshot=structuredClone({ball:p.ball,actor:p.actor,elapsed:p.elapsed});
 for(let i=0;i<120;i++)p.tick(STEP,{held:true,right:1});assert.deepEqual({ball:p.ball,actor:p.actor,elapsed:p.elapsed},snapshot);assert.equal(p.charge,0);assert.equal(p.holding,false);
 p.resume();p.advanceCountdown(1);p.tick(1,{held:false});assert.equal(p.state,'resuming');assert.equal(p.elapsed,snapshot.elapsed);p.advanceCountdown(1);assert.equal(p.state,'running');
 for(let i=0;i<20;i++)p.tick(STEP,{held:true});assert.equal(p.attempts,0,'Old held Space cannot shoot after a pause.');p.tick(STEP,{});for(let i=0;i<20;i++)p.tick(STEP,{held:true});p.tick(STEP,{});assert.equal(p.stage,'swing');assert.equal(p.attempts,1);
 const swing=p.swing;p.pause();for(let i=0;i<60;i++)p.tick(STEP,{});assert.equal(p.swing,swing);p.resume();p.advanceCountdown(2);for(let i=0;i<30;i++)p.tick(STEP,{});assert.equal(events.filter(e=>e.type==='hit').length,1);
});

test('cancel invalidates countdown/queued actions and restart clears every round state',()=>{
 const{p}=fixture('tennis');p.hit();p.pause();const epoch=p.epoch;p.cancel();assert.ok(p.epoch>epoch);p.resume();p.advanceCountdown(10);p.tick(10,{held:true});assert.equal(p.state,'idle');assert.equal(p.ball,null);assert.equal(p.hitQueued,false);assert.equal(p.pose(),null);
 p.start('golf');assert.equal(p.state,'countdown');assert.equal(p.score,0);assert.equal(p.attempts,0);assert.equal(p.index,0);assert.equal(p.charge,0);assert.equal(p.swing,-1);assert.equal(p.remaining,2);
 p.pause();p.resume();p.advanceCountdown(2);assert.equal(p.state,'running');assert.equal(p.stage,'ready');
});

test('tennis launches from the exported machine and treats ball radius as part of net clearance',()=>{
 const{p}=fixture('tennis');while(!p.ball)p.tick(STEP,{});assert.equal(p.ball.x,sports.tennis.machine.x);assert.equal(p.ball.y,sports.tennis.machine.y);assert.equal(p.ball.z,sports.tennis.machine.z);
 p.stage='flight';p.ball={x:16,y:.85+1.02+.05,z:-5.2,vx:0,vy:0,vz:24,bounces:0,returned:false};p.tick(.02,{});
 assert.equal(p.index,1,'The center clears the net but the ball surface hits it.');assert.equal(p.score,0);
});
