import test from 'node:test';
import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {PlayerController} from '../sources/core/player.js';
import {IslandWalkWorld} from '../sources/core/character.js';
import {QUAD_BIKE,QuadBikeController,quadFootprintClear} from '../sources/core/quad-bike.js';

test('quad footprint fits the harbor parking and refuses island edges',()=>{
  const walk={clear:({x,z},radius)=>Math.abs(x)<2-radius&&Math.abs(z)<8-radius};
  assert.equal(quadFootprintClear(walk,{x:0,z:0},0,QUAD_BIKE.collisionHalfWidth,QUAD_BIKE.collisionHalfLength),true);
  assert.equal(quadFootprintClear(walk,{x:1.5,z:0},0,QUAD_BIKE.collisionHalfWidth,QUAD_BIKE.collisionHalfLength),false);
  assert.equal(quadFootprintClear(walk,{x:0,z:7.2},Math.PI/4,QUAD_BIKE.collisionHalfWidth,QUAD_BIKE.collisionHalfLength),false);
});

test('riding switches the active actor to the quad and dismount restores Jack at a walkable point',()=>{
  const calls=[];const walkWorld={groundAt:()=>.85};
  const character={walkWorld,enable:v=>calls.push(['enable',v]),teleport:(p,w)=>calls.push(['teleport',p,w]),seated:false};
  const boat={hold(){}};const player=new PlayerController(boat,character),quad={position:{x:4,y:.85,z:3},yaw:.2,speed:0,velocity:{x:0,z:0}};
  player.mode='walking';player.island={id:'projects'};
  assert.equal(player.rideQuad(quad),true);assert.equal(player.ridingQuad,true);assert.equal(player.onLand,true);assert.equal(player.activeActor,quad);assert.deepEqual(calls.at(-1),['enable',false]);
  assert.equal(player.leaveQuad({x:5,y:.85,z:3,yaw:.2}),true);assert.equal(player.mode,'walking');assert.equal(player.activeActor,character);assert.deepEqual(calls.at(-2),['teleport',{x:5,y:.85,z:3,yaw:.2},walkWorld]);assert.deepEqual(calls.at(-1),['enable',true]);
});

test('quad drive uses the fixed-step physics body and stays within its walkable footprint',async()=>{
  await R.init();
  const world=new R.World({x:0,y:0,z:0});world.timestep=1/60;
  const island={x:0,z:0,rotation:0,shore:[[-10,-10],[10,-10],[10,10],[-10,10]]};
  const walk=new IslandWalkWorld(R,world,island,{groundY:.85,surfaces:[{x:0,z:0,width:20,depth:20,y:.85}],obstacles:[]});
  const bike=new QuadBikeController(R,world,walk,{x:0,y:.85,z:0,yaw:0});bike.park(false);
  try{
    for(let n=0;n<120;n++){bike.step({throttle:1,steer:0,brake:false,boost:false},1/60);world.step();bike.afterStep();}
    assert.ok(bike.position.z<-5,`quad should drive forward, position=${JSON.stringify(bike.position)}`);
    assert.ok(bike.position.z>-10+QUAD_BIKE.collisionHalfLength,'quad should remain inside the broad path');
    bike.teleport({x:0,y:.85,z:0,yaw:0});assert.equal(bike.speed,0);
  }finally{bike.dispose();world.free();}
});
