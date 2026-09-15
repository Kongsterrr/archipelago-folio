import test from 'node:test';
import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {Game} from '../sources/game.js';
import {BoatController} from '../sources/core/boat.js';
import {Race} from '../sources/core/race.js';
import {gates,islands} from '../sources/config.js';
await R.init();
function fixture(){const world=new R.World({x:0,y:0,z:0});let now=0;const g=Object.create(Game.prototype);g.boat=new BoatController(R,world,{x:0,z:60,yaw:0});g.race=new Race(gates,{now:()=>now});g.inputs={enabled:true,setEnabled(v){this.enabled=v;}};g.mode='exploring';g.clearWake=()=>g.wakes=[];g.wakes=[{x:0,z:0}];g.resetCamera=()=>g.cameraReset=true;return {g,world,setTime:t=>now=t};}
test('boost → read → travel → close cannot restore stale race velocity or wake',()=>{const {g,world,setTime}=fixture();g.race.start();setTime(3000);g.race.tick({x:0,z:60},{x:0,z:60});g.boat.step({throttle:1,boost:true},1);g.pause('read');assert.ok(g.snapshot.velocity.z<0);assert.equal(g.race.state,'paused');g.teleport({...islands[2].dock,yaw:islands[2].yaw});g.resume();assert.equal(g.boat.speed,0);assert.equal(g.snapshot,null);assert.equal(g.race.state,'idle');assert.equal(g.race.best,0);assert.deepEqual(g.wakes,[]);assert.equal(g.cameraReset,true);world.free();});
test('a paused race restores the exact velocity only behind the resume countdown',()=>{const {g,world,setTime}=fixture();g.race.start();setTime(3000);g.race.tick({x:0,z:60},{x:0,z:60});g.boat.step({throttle:1,boost:true},1);const speed=g.boat.speed;g.pause('read');setTime(6000);g.resume();assert.equal(g.race.state,'resuming');assert.equal(g.race.frozen,true);assert.equal(g.boat.speed,speed);world.free();});
test('docking anchors the boat and closing the panel never restarts it',()=>{const {g,world}=fixture();g.boat.step({throttle:1,boost:true},1);const p={...g.boat.position};g.dock(islands[0]);assert.equal(g.boat.speed,0);g.resume();assert.equal(g.boat.speed,0);assert.deepEqual({...g.boat.position},p);assert.equal(g.mode,'exploring');world.free();});
