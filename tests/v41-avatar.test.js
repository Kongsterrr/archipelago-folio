import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {JackAvatar} from '../sources/world/jack.js';
import {BoatAppearance} from '../sources/world/boat-appearance.js';
import {PlayerController,BoardingController} from '../sources/core/player.js';
const assets=new URL('../static/models/',import.meta.url);
async function load(file){const b=await fs.readFile(new URL(file,assets));return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
async function fixture(spec){const gltf=await load('jack.glb');if(spec)gltf.scene.traverse(o=>{if(o.userData.originalProceduralAsset)o.userData.characterSpec=spec;});const scene=new THREE.Scene(),boatVisual=new THREE.Group();scene.add(boatVisual);const avatar=new JackAvatar(scene,{loadAsync:async()=>gltf});await avatar.load();const character={position:{x:4,y:.85,z:4},previous:{x:4,y:.85,z:4},yaw:0,speed:0,seated:false,enable(){}};const player=new PlayerController({hold(){}},character);const update=(dt,opts={})=>avatar.update(dt,{player,boatVisual,character,alpha:1,input:{steer:0},reduced:false,frozen:false,...opts});const hands=()=>{scene.updateMatrixWorld(true);return ['LeftHand','RightHand'].map(name=>boatVisual.worldToLocal(avatar.model.getObjectByName(name).getWorldPosition(new THREE.Vector3())));};update(0);return{scene,boatVisual,avatar,character,player,update,hands};}
function sameHands(actual,expected,message){for(let n=0;n<2;n++)assert.ok(actual[n].distanceTo(expected[n])<1e-6,`${message}: ${n} moved ${actual[n].distanceTo(expected[n])}`);}
test('helm grips stay fixed in boat space across turn input, waves, pauses and reduced motion',async()=>{const f=await fixture(),canonical=f.hands();for(const fps of[30,60,120])for(const reduced of[false,true])for(const steer of[-1,0,1])for(const frozen of[false,true])for(let n=0;n<fps;n++){f.boatVisual.position.set(n*.03,.06*Math.sin(n),-n*.02);f.boatVisual.rotation.set(.03*Math.sin(n),n*.1,.04*Math.cos(n));f.update(1/fps,{input:{steer,boost:true},reduced,frozen});sameHands(f.hands(),canonical,'helm grip');assert.equal(f.avatar.root.parent,f.boatVisual);}});
test('boarding hard reset removes all fading land actions even on the first frozen frame',async()=>{const f=await fixture(),canonical=f.hands();for(let n=0;n<12;n++){f.player.mode='walking';f.character.speed=n%2?4:2.4;f.update(.01);f.avatar.interact();f.update(.01);f.player.toSailing();f.character.speed=0;f.update(0,{frozen:true});sameHands(f.hands(),canonical,'boarding frame');assert.equal(f.avatar.pose,'helm');assert.equal(f.avatar.interactTime,0);assert.equal(f.avatar.standTime,0);const active=[...f.avatar.actions].filter(([,a])=>a.isRunning()&&a.getEffectiveWeight()>1e-6).map(([name])=>name);assert.deepEqual(active,['helm']);f.update(.04);sameHands(f.hands(),canonical,'post-boarding');f.player.mode='walking';f.update(0);assert.equal(f.avatar.pose,'idle','old interaction must not replay after re-landing');}});
test('committing and cancelling a seated boarding transition keeps the same avatar and exact helm pose',async()=>{const f=await fixture(),canonical=f.hands(),root=f.avatar.root;f.player.mode='walking';f.character.seated=true;f.character.seatVisual=new THREE.Vector3(5,1,5);f.character.seatYaw=.4;f.update(.2);const b=new BoardingController(f.player,{onCommit:()=>{f.character.seated=false;f.character.enable(false);}});b.board();f.player.tick(.2);f.update(0,{frozen:true});assert.equal(f.player.onLand,true);b.cancel();assert.equal(f.player.mode,'walking');f.update(0);assert.equal(f.avatar.root,root);assert.equal(f.avatar.pose,'sit');b.board();f.player.tick(.31);f.update(0,{frozen:true});assert.equal(f.player.onLand,false);sameHands(f.hands(),canonical,'seated boarding commit');assert.equal(f.avatar.root,root);assert.equal(f.avatar.root.parent,f.boatVisual);});
test('authored character placement metadata sets helm anchor, scale and bench height',async()=>{const spec={helmAnchor:[.4,-.3,.2],helmScale:.91,benchSeatOffset:.41},f=await fixture(spec);assert.deepEqual(f.avatar.root.position.toArray(),spec.helmAnchor);assert.deepEqual(f.avatar.root.scale.toArray(),[.91,.91,.91]);const seat=f.avatar.seatPosition({x:4,z:8},1.46);assert.ok(Math.abs(seat.y-1.05)<1e-9);assert.equal(seat.x,4);assert.equal(seat.z,8);f.player.mode='walking';f.update(0);assert.deepEqual(f.avatar.root.scale.toArray(),[1,1,1]);f.player.toSailing();f.update(0);assert.deepEqual(f.avatar.root.position.toArray(),spec.helmAnchor);});
test('wheel remains neutral while the outboard and gauges still respond',async()=>{const model=(await load('boat.glb')).scene,appearance=new BoatAppearance({livery:'marina'});appearance.bind(model);const wheel=model.getObjectByName('anim_helm'),engine=model.getObjectByName('anim_engine'),gauge=model.getObjectByName('anim_gauge_0');assert.ok(wheel&&engine&&gauge);const w=wheel.quaternion.clone(),e=engine.quaternion.clone(),g=gauge.quaternion.clone();for(let n=0;n<60;n++)appearance.update(1/60,{steer:1},18,false,false);assert.ok(w.angleTo(wheel.quaternion)<1e-7);assert.ok(e.angleTo(engine.quaternion)>.1);assert.ok(g.angleTo(gauge.quaternion)>.1);for(let n=0;n<30;n++)appearance.update(1/60,{steer:-1},0,false,true);assert.ok(w.angleTo(wheel.quaternion)<1e-7);appearance.update(1/60,{steer:1},18,true,false);assert.ok(w.angleTo(wheel.quaternion)<1e-7);});

test('helm hand orientations are as stable as their positions',async()=>{const f=await fixture();const rotations=()=>{f.scene.updateMatrixWorld(true);const inverse=f.boatVisual.getWorldQuaternion(new THREE.Quaternion()).invert();return ['LeftHand','RightHand'].map(n=>inverse.clone().multiply(f.avatar.model.getObjectByName(n).getWorldQuaternion(new THREE.Quaternion())).normalize());};const start=rotations();for(let n=0;n<240;n++){f.boatVisual.rotation.set(.04*Math.sin(n),n*.02,.03*Math.cos(n));f.update(1/60,{input:{steer:Math.sin(n*.1)}});rotations().forEach((q,i)=>assert.ok(q.angleTo(start[i])<1e-6,'hand orientation drift'));}});

test('reset from a bench clears stand interpolation before restoring the landing point',async()=>{const f=await fixture();f.player.mode='walking';f.character.seated=true;f.character.seatVisual=new THREE.Vector3(30,1.1,30);f.character.seatYaw=.5;f.update(.2);f.character.seated=false;f.character.position={x:4,y:.85,z:4};f.character.previous={...f.character.position};f.avatar.resetPose('idle');f.update(0);assert.deepEqual(f.avatar.root.position.toArray(),[4,.85,4]);assert.equal(f.avatar.standTime,0);assert.equal(f.avatar.pose,'idle');});

test('new short legs clear the front bench slat at every authored bench facing',async()=>{
 const f=await fixture(),layout=JSON.parse(await fs.readFile(new URL('walk-layout.json',assets),'utf8'));
 const {islands}=await import('../sources/config.js');
 f.player.mode='walking';
 for(const island of islands){
  const bench=layout.islands.find(i=>i.id===island.id).bench,yaw=bench.yaw+island.rotation+Math.PI,top=bench.y+.06;
  const seat={x:4,z:8};f.character.seated=true;f.character.seatYaw=yaw;f.character.seatVisual=f.avatar.seatPosition(seat,top,yaw);f.update(.3);
  f.scene.updateMatrixWorld(true);let tested=0;
  f.avatar.model.traverse(mesh=>{
   if(!mesh.isSkinnedMesh||!mesh.visible)return;mesh.skeleton.update();const indices=mesh.geometry.getAttribute('skinIndex');
   for(let i=0;i<indices.count;i++){
    if(!/^(Left|Right)(Leg|Foot)$/.test(mesh.skeleton.bones[indices.getX(i)].name))continue;
    const p=mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
    if(p.y>top||p.y<top-.12)continue;
    const forward=-(p.x-seat.x)*Math.sin(yaw)-(p.z-seat.z)*Math.cos(yaw);
    assert.ok(forward>.31,`${island.id}: shin intersects seat front (${forward})`);tested++;
   }
  });
  assert.ok(tested>0,'exercise vertices crossing seat height');
 }
});

test('reduced motion holds resting head motion while preserving necessary walk animation',async()=>{const f=await fixture();f.player.mode='walking';f.update(.2,{reduced:true});const head=f.avatar.model.getObjectByName('Head'),q=head.quaternion.clone();for(let n=0;n<60;n++)f.update(1/60,{reduced:true});assert.ok(q.angleTo(head.quaternion)<1e-6);assert.equal(f.avatar.actions.get('idle').time,0);f.character.speed=2.4;f.update(.2,{reduced:true});assert.ok(f.avatar.actions.get('walk').time>0);});
