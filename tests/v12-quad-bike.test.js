import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {PlayerController} from '../sources/core/player.js';
import {IslandWalkWorld} from '../sources/core/character.js';
import {QUAD_BIKE,QuadBikeController,quadFootprintClear,splitQuadWheels} from '../sources/core/quad-bike.js';

test('quad footprint fits the paved post-bridge turnout and refuses island edges',()=>{
  const walk={clear:({x,z},radius)=>Math.abs(x)<2-radius&&Math.abs(z)<8-radius};
  assert.equal(quadFootprintClear(walk,{x:0,z:0},0,QUAD_BIKE.collisionHalfWidth,QUAD_BIKE.collisionHalfLength),true);
  assert.equal(quadFootprintClear(walk,{x:1.1,z:0},0,QUAD_BIKE.collisionHalfWidth,QUAD_BIKE.collisionHalfLength),false);
  assert.equal(quadFootprintClear(walk,{x:0,z:7.2},Math.PI/4,QUAD_BIKE.collisionHalfWidth,QUAD_BIKE.collisionHalfLength),false);
});

test('fused GLB tires are split into four independent, spin-ready wheel pivots',()=>{
  const positions=[],indices=[];
  const centers=[[-.59,-.28,.76],[.59,-.28,.76],[-.59,-.28,-.76],[.59,-.28,-.76]];
  const addTriangle=(x,y,z,r=.006)=>{const start=positions.length/3;positions.push(x-r,y,z,x+r,y,z,x,y+r,z+r);indices.push(start,start+1,start+2);};
  for(const [x,y,z] of centers)for(let n=0;n<12;n++)addTriangle(x,y,z);
  addTriangle(0,.42,0,.04);addTriangle(.1,.42,0,.04);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);
  const model=new THREE.Group();model.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial()));
  const wheels=splitQuadWheels(model);
  assert.equal(wheels.length,4);
  assert.deepEqual(wheels.map(w=>w.name).sort(),['quad-wheel-front-left','quad-wheel-front-right','quad-wheel-rear-left','quad-wheel-rear-right']);
  assert.ok(wheels.every(w=>w.children[0].geometry.index.count>=36));
  assert.equal(model.children[0].geometry.index.count,6,'chassis triangles stay on the fixed body');
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
    assert.ok(bike.position.z>-9,'quad should remain inside the broad path');
    bike.teleport({x:0,y:.85,z:0,yaw:0});assert.equal(bike.speed,0);
  }finally{bike.dispose();world.free();}
});
