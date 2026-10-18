import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Game} from '../sources/game.js';

test('stair camera intent follows the rendered actor and clears for panels, practice and other modes',()=>{
  const rendered={x:4,y:3,z:2},intent={x:.6,z:.8,run:true};
  const player={onLand:true,walking:true,island:{id:'experience',x:0,z:0,r:30,rotation:0},pauseReasons:new Set()};
  const calls=[],jack={root:new THREE.Group()};jack.root.position.copy(rendered);
  const game={player,jack,activeActor:{position:{x:100,y:0,z:100},velocity:{x:0,z:0},speed:0,yaw:0},
    character:{walkWorld:{terrain:{},contains:()=>true,groundAt:()=>3,nearStairs:p=>{calls.push({...p});return p.x===4;}}},
    focus:null,frozen:false,practice:{active:false},practiceFocus:()=>null,settings:{},cameraRig:{yaw:.7},
    inputs:{read:()=>({}),readWalking:yaw=>{assert.equal(yaw,.7);return intent;}}};
  const state=()=>Game.prototype.cameraState.call(game);
  assert.equal(state().walkingStairs,true);assert.deepEqual(state().walkingIntent,intent);
  assert.deepEqual(calls[0],rendered,'query the interpolated actor, not a physics point ahead of the renderer');
  game.frozen=true;player.pauseReasons.add('hidden');
  assert.equal(state().walkingIntent,null);assert.equal(state().followPaused,true);
  game.frozen=false;player.pauseReasons.clear();game.practice.active=true;
  assert.equal(state().walkingIntent,null);game.practice.active=false;
  jack.root.position.x=8;assert.equal(state().walkingStairs,false);assert.equal(state().walkingIntent,null);
  jack.root.position.x=4;player.island={...player.island,id:'projects'};
  assert.equal(state().walkingStairs,false);assert.equal(state().walkingIntent,null);
  player.island={...player.island,id:'experience'};player.walking=false;player.ridingQuad=true;game.quadBike={mountPoint:new THREE.Group()};
  assert.equal(state().walkingStairs,false);assert.equal(state().walkingIntent,null);
  player.ridingQuad=false;player.ridingTrain=true;game.trainVisual={mountPoint:new THREE.Group()};game.journey={cameraView:()=>({})};
  assert.equal(state().locomotion,'train');assert.equal(state().walkingIntent,null);
  player.ridingTrain=false;player.walking=true;game.frozen=true;game.focus={id:'experience',islandId:'experience',x:0,z:0,camera:{distance:24}};
  assert.equal(state().walkingIntent,null);assert.equal(state().focus.islandId,'experience');
});
