import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {JackAvatar} from '../sources/world/jack.js';
import {JackExpression} from '../sources/world/jack-expression.js';
const near=(actual,expected,epsilon=1e-7)=>assert.ok(Math.abs(actual-expected)<epsilon,`${actual} != ${expected}`);
async function fixture(){
 const bytes=await fs.readFile(new URL('../static/models/jack.glb',import.meta.url));
 const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const scene=new THREE.Scene(),boatVisual=new THREE.Group();scene.add(boatVisual);
 const avatar=new JackAvatar(scene,{loadAsync:async()=>gltf});assert.equal(await avatar.load(),true);
 const player={onLand:true},character={position:{x:4,y:.85,z:4},previous:{x:4,y:.85,z:4},yaw:0,speed:0,seated:false};
 const update=(dt,opts={})=>avatar.update(dt,{player,boatVisual,character,alpha:1,reduced:false,frozen:false,...opts});
 update(0);return{avatar,player,character,update,boatVisual};
}
function snapshot(avatar){return{pose:avatar.pose,root:[...avatar.root.position.toArray(),...avatar.root.quaternion.toArray()],mixer:avatar.mixer.time,stand:avatar.standTime,interaction:avatar.interactTime,actions:[...avatar.actions].map(([name,a])=>[name,a.time,a.getEffectiveWeight()]),expression:[avatar.expression.time,avatar.expression.gaze,avatar.expression.blink],head:avatar.expression.head.quaternion.toArray()};}
function activeWeight(avatar){return[...avatar.actions.values()].reduce((sum,a)=>sum+(a.isScheduled()?a.getEffectiveWeight():0),0);}

test('interrupted blends preserve current contributions and normalized weights',async()=>{
 const f=await fixture();f.character.speed=2.4;f.update(.05);
 for(const speed of[4,2.4,4,0,2.4]){
  const before=new Map([...f.avatar.actions].map(([n,a])=>[n,a.getEffectiveWeight()]));
  f.character.speed=speed;f.update(0);
  for(const[n,a]of f.avatar.actions)near(a.getEffectiveWeight(),before.get(n));
  near(activeWeight(f.avatar),1);
  f.update(.01);near(activeWeight(f.avatar),1);
  for(const[n,a]of f.avatar.actions)if(n!==f.avatar.pose)assert.ok(a.getEffectiveWeight()<=before.get(n)+1e-7,`${n} contribution jumped`);
 }
 f.update(.2);near(activeWeight(f.avatar),1);assert.equal(f.avatar.blend,null);
});

test('walk/run transfer stride phase and use threshold hysteresis',async()=>{
 const f=await fixture();f.character.speed=2.4;f.update(.37);
 for(const speed of[4,2.4,4,2.4]){
  const prior=f.avatar.actions.get(f.avatar.pose),phase=prior.time/prior.getClip().duration;
  f.character.speed=speed;f.update(0);const next=f.avatar.actions.get(f.avatar.pose);
  near(next.time/next.getClip().duration,phase);f.update(.035);
 }
 f.character.speed=2.7;f.update(.02);assert.equal(f.avatar.pose,'walk');
 f.character.speed=3;f.update(.02);assert.equal(f.avatar.pose,'run');
 f.character.speed=2.7;f.update(.02);assert.equal(f.avatar.pose,'run');
 f.character.speed=2.5;f.update(.02);assert.equal(f.avatar.pose,'walk');
});

test('pausing a walk preserves the exact rendered body and expression state',async()=>{
 const f=await fixture();f.character.speed=2.4;f.update(.4);const before=snapshot(f.avatar);
 f.character.speed=0;for(let i=0;i<20;i++)f.update(.1,{frozen:true});assert.deepEqual(snapshot(f.avatar),before);
 f.update(.02);assert.equal(f.avatar.pose,'idle');assert.ok(f.avatar.mixer.time>before.mixer);
});

test('standing starts at seated heading, follows the shortest angle, and freezes without root drift',async()=>{
 const f=await fixture();f.character.seated=true;f.character.seatVisual=new THREE.Vector3(5,1.1,5);f.character.seatYaw=Math.PI-.1;f.update(.3);
 f.character.seated=false;f.character.yaw=-Math.PI+.1;f.character.speed=2.4;f.update(0);
 near(f.avatar.root.rotation.y,Math.PI-.1);const duration=f.avatar.standDuration;
 f.update(duration*.4);assert.ok(f.avatar.root.rotation.y>Math.PI-.1&&f.avatar.root.rotation.y<Math.PI+.1);
 const before=snapshot(f.avatar);for(let i=0;i<10;i++)f.update(.2,{frozen:true});assert.deepEqual(snapshot(f.avatar),before);
 f.update(duration*.61);assert.equal(f.avatar.standTime,0);assert.deepEqual(f.avatar.root.position.toArray(),[4,.85,4]);assert.equal(f.avatar.pose,'walk');
});

test('boarding can still commit helm immediately during a frozen frame',async()=>{
 const f=await fixture();f.character.speed=2.4;f.update(.1);f.player.onLand=false;f.update(0,{frozen:true});
 assert.equal(f.avatar.pose,'helm');assert.equal(f.avatar.root.parent,f.boatVisual);near(activeWeight(f.avatar),1);
 assert.deepEqual([...f.avatar.actions].filter(([,a])=>a.isRunning()).map(([n])=>n),['helm']);
});

function expressionFixture(){
 const model=new THREE.Group(),head=new THREE.Bone();head.name='Head';head.rotation.set(.03,.1,-.02);model.add(head);
 for(const name of['LeftEye','RightEye','LeftBrow','RightBrow','Mouth']){const node=new THREE.Object3D();node.name=name;node.position.set(.01,.04,.05);node.scale.set(1.1,.8,.9);head.add(node);}
 const expression=new JackExpression(model),opts={reduced:false,frozen:false,walking:true,moving:false,yaw:0,position:{x:0,z:0},lookTarget:{x:-2,z:-2},interacting:.55};
 const state=()=>expression.nodes.flatMap(n=>[...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()]);
 const authored=state();const update=(dt,overrides={})=>{expression.restore();expression.update(dt,{...opts,...overrides});};return{expression,update,state,authored};
}

test('expressions blink, remain bounded, and do not accumulate on zero-delta or frozen frames',()=>{
 const f=expressionFixture();f.update(2.795);near(f.expression.blink,1);for(const eye of f.expression.eyes)near(eye.scale.y,.8*.06);
 const before=f.state(),time=f.expression.time,gaze=f.expression.gaze;
 for(let i=0;i<100;i++)f.update(0);assert.deepEqual(f.state(),before);
 for(let i=0;i<100;i++)f.update(.1,{frozen:true});assert.deepEqual(f.state(),before);near(f.expression.time,time);near(f.expression.gaze,gaze);
 assert.ok(Math.abs(gaze)<=.24);f.update(.11);assert.equal(f.expression.blink,0);
});

test('reduced motion and reset restore authored face transforms',()=>{
 const f=expressionFixture();f.update(2.795);assert.notDeepEqual(f.state(),f.authored);
 const time=f.expression.time;f.update(1,{reduced:true});assert.deepEqual(f.state(),f.authored);assert.equal(f.expression.time,time);assert.equal(f.expression.gaze,0);assert.equal(f.expression.blink,0);
 f.update(.1);f.expression.reset();assert.deepEqual(f.state(),f.authored);assert.equal(f.expression.time,0);
});

test('seated gaze uses the rendered seat heading when a target is directly ahead',async()=>{
 const f=await fixture();f.character.seated=true;f.character.seatVisual=new THREE.Vector3(4,1.1,4);f.character.seatYaw=Math.PI;f.character.yaw=0;
 f.update(.4,{lookTarget:{x:4,z:9}});near(f.avatar.expression.gaze,0);
});
