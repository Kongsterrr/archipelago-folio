import test from 'node:test';
import assert from 'node:assert/strict';
import {IslandArrival} from '../sources/core/island-arrival.js';
import {PlayerController,BoardingController} from '../sources/core/player.js';
import {Game} from '../sources/game.js';
import {PerspectiveCamera,Fog} from 'three';
const island={id:'projects'},bounds={min:[0,0,0],max:[30,11,30]};

test('arrival holds its full view, approaches, and unlocks at the same time across frame rates',()=>{
 for(const fps of[30,60,120]){
  const arrival=new IslandArrival();arrival.start(island,bounds);
  for(let n=0;n<fps*.2;n++)arrival.tick(1/fps);
  assert.equal(arrival.progress,0);
  for(let n=0;n<fps;n++)arrival.tick(1/fps);
  assert.ok(Math.abs(arrival.progress-.7/1.8)<1e-9);
  while(arrival.elapsed+1/fps<2.3-1e-9)arrival.tick(1/fps);
  assert.equal(arrival.active,true);
  for(let n=0;n<2;n++)arrival.tick(1/fps);
  assert.equal(arrival.active,false);assert.equal(arrival.start(island,bounds),true);
  assert.equal(arrival.active,true);assert.equal(arrival.elapsed,0);assert.equal(arrival.progress,0);
 }
});
test('paused arrival keeps its exact overview/zoom progress and reduced motion stays static',()=>{
 const arrival=new IslandArrival();arrival.start(island,bounds);arrival.tick(2);
 const before=arrival.view();for(let n=0;n<120;n++)arrival.tick(.1,{paused:true});
 assert.deepEqual(arrival.view(),before);assert.equal(arrival.view(true).progress,0);
 assert.equal(arrival.tick(.5,{reduced:true}),true);assert.equal(arrival.active,false);
});
test('skip/cancel prevents late motion and a revisit starts a fresh overview',()=>{
 const arrival=new IslandArrival();arrival.start(island,bounds);arrival.cancel();arrival.tick(20);
 assert.equal(arrival.active,false);assert.equal(arrival.start(island,bounds),true);
 assert.equal(arrival.elapsed,0);assert.equal(arrival.progress,0);
 arrival.tick(1);const nextBounds={min:[0,0,0],max:[40,14,40]};
 assert.equal(arrival.start(island,nextBounds),true);
 assert.deepEqual(arrival.view(),{bounds:nextBounds,progress:0});
 assert.equal(arrival.start({id:'education'},bounds),true);
 assert.equal(new IslandArrival().start(island,bounds),true);
});
test('portrait overview extends fog and far clipping, then restores them for reading and walking',()=>{
 const game=Object.assign(Object.create(Game.prototype),{arrival:{active:true},cameraRig:{distance:530},scene:{fog:new Fog('white',145,330)},camera:new PerspectiveCamera(28,1,.2,600)});
 game.updateArrivalAtmosphere();assert.equal(game.scene.fog.near,595);assert.equal(game.scene.fog.far,780);assert.equal(game.camera.far,680);
 game.cameraRig.distance=130;game.updateArrivalAtmosphere();assert.equal(game.scene.fog.near,195);
 game.focus={id:'projects'};game.updateArrivalAtmosphere();assert.equal(game.scene.fog.near,195,'fog remains extended while the reader camera approaches');game.cameraRig.distance=60;game.updateArrivalAtmosphere();assert.equal(game.scene.fog.near,145);assert.equal(game.scene.fog.far,330);assert.equal(game.camera.far,600);
 game.focus=null;game.updateArrivalAtmosphere();game.arrival.active=false;game.updateArrivalAtmosphere();assert.equal(game.scene.fog.near,145);assert.equal(game.arrivalAtmosphere,null);
});
test('a boarding commit cancelled by a new stable operation cannot overwrite that operation',async()=>{
 const boat={hold(){}},character={enable(){}};const player=new PlayerController(boat,character);
 let boarding;boarding=new BoardingController(player,{prepare:async()=>({}),select:()=>({}),onCommit:()=>{boarding.cancel();player.mode='sailing';},onError:e=>{throw e;}});
 assert.equal(await boarding.disembark(island),true);player.tick(.61);
 assert.equal(player.mode,'sailing');assert.equal(player.transition,null);
});
