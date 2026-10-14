import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {JackAvatar} from '../sources/world/jack.js';
import {CareerTrainController} from '../sources/core/career-train.js';
import {CareerTrainVisual} from '../sources/world/career-train.js';
import {careerRailway} from '../scripts/lib/career-railway-layout.mjs';
import {PlayerController} from '../sources/core/player.js';
import {CareerJourney} from '../sources/world/career-journey.js';

async function fixture(){
 await MeshoptDecoder.ready;
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
 const doc=await io.read(fileURLToPath(new URL('../static/models/jack-imported.glb',import.meta.url)));
 // Node does not load browser images. Keep the exact shipped skin and clips.
 for(const material of doc.getRoot().listMaterials())material.setBaseColorTexture(null);
 for(const texture of [...doc.getRoot().listTextures()])texture.dispose();
 for(const extension of doc.getRoot().listExtensionsUsed())if(extension.extensionName==='EXT_meshopt_compression')extension.dispose();
 const data=await io.writeBinary(doc),gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 const scene=new THREE.Scene(),controller=new CareerTrainController(careerRailway(),{island:{x:-76,y:2,z:8,rotation:1.17}}),view=new CareerTrainVisual(scene,controller);
 const bytes=await fs.readFile(new URL('../static/models/career-train.glb',import.meta.url));
 view.bind((await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene);
 const avatar=new JackAvatar(scene,{loadAsync:async()=>gltf});assert.equal(await avatar.load(),true);
 const player={onLand:true,ridingTrain:true,train:controller},character={position:{x:0,y:0,z:0},previous:{x:0,y:0,z:0},yaw:0,speed:0};
 function update(dt=0,{frozen=false,reduced=false,player:activePlayer=player}={}){
  view.update(1,{frozen});avatar.update(dt,{player:activePlayer,trainVisual:view,character,alpha:1,reduced,frozen});
  scene.updateMatrixWorld(true);avatar.model.traverse(mesh=>{if(mesh.isSkinnedMesh)mesh.skeleton.update();});
 }
 return{scene,controller,view,avatar,player,character,update};
}
function skinPoints(avatar,coach){
 const result={};
 avatar.model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!mesh.visible)return;
  const ids=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight');
  for(let i=0;i<ids.count;i++){
   let major=0;for(let k=1;k<4;k++)if(weights.getComponent(i,k)>weights.getComponent(i,major))major=k;
   const name=mesh.skeleton.bones[ids.getComponent(i,major)].name;
   if(!/^(Head|Hips|LeftFoot|RightFoot|LeftHand|RightHand|LeftUpLeg|RightUpLeg)$/.test(name))continue;
   (result[name]??=[]).push(coach.worldToLocal(mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)));
  }
 });return result;
}
function surfaceAt(coach,object,point){
 const origin=coach.localToWorld(new THREE.Vector3(point.x,2,point.z)),direction=new THREE.Vector3(0,-1,0).transformDirection(coach.matrixWorld);
 const hit=new THREE.Raycaster(origin,direction).intersectObject(object,true)[0];
 return hit?coach.worldToLocal(hit.point).y:null;
}

test('actual imported sit skin rests on the level funicular seat, footboard and armrests in both directions and pause',async t=>{
 const f=await fixture();t.after(()=>{f.avatar.root.removeFromParent();f.view.dispose();});
 const cabin=f.view.cars[0],coach=cabin.getObjectByName('funicular-passenger-bay'),seat=coach.getObjectByName('funicular-passenger-seat'),footboard=coach.getObjectByName('funicular-passenger-footboard');
 assert.ok(seat&&footboard);
 const stops=f.controller.stations.map(station=>station.distance);
 for(const [distance,dt,frozen,reduced]of[[stops[0],0,false,false],[stops[1],.4,false,false],[stops[2],1,false,false],[stops[2],3,true,false],[stops[3],2,false,true],[stops[1],.5,false,true]]){
  f.controller.distance=f.controller.previousDistance=distance;f.update(dt,{frozen,reduced});
  assert.equal(f.avatar.pose,'sit');assert.equal(f.avatar.root.parent,f.view.mountPoint);
  const points=skinPoints(f.avatar,coach);
  for(const side of['Left','Right']){
   const foot=points[side+'Foot'].reduce((a,b)=>a.y<b.y?a:b),floor=surfaceAt(coach,footboard,foot);
   assert.notEqual(floor,null,`${side} foot must be above actual footboard geometry`);
   assert.ok(foot.y-floor>=-.001&&foot.y-floor<.006,`${side} sole contact ${foot.y-floor}`);
   const rest=coach.getObjectByName('funicular-passenger-armrest-'+side.toLowerCase()),hand=points[side+'Hand'].reduce((a,b)=>a.y<b.y?a:b),arm=surfaceAt(coach,rest,hand);
   assert.notEqual(arm,null,`${side} palm must be above its wooden armrest`);
   assert.ok(hand.y-arm>=-.001&&hand.y-arm<.006,`${side} hand contact ${hand.y-arm}`);
  }
  let pelvisContact=Infinity;
  for(const name of['Hips','LeftUpLeg','RightUpLeg'])for(const point of points[name]){
   const surface=surfaceAt(coach,seat,point);if(surface===null)continue;
   assert.ok(point.y>=surface-.001,`${name} clips wooden seat by ${surface-point.y}`);
   if(name==='Hips')pelvisContact=Math.min(pelvisContact,point.y-surface);
  }
  assert.ok(pelvisContact<.04,'the pelvis is supported by the first bench');
  assert.ok(Object.values(points).flat().every(p=>Math.abs(p.x)<.72),'seated body and hands clear side rails');
  const up=new THREE.Vector3(0,1,0).transformDirection(f.view.mountPoint.matrixWorld);assert.ok(up.distanceTo(new THREE.Vector3(0,1,0))<1e-6,'Jack and his sitting bay stay vertical on the incline');
 }
});

test('actual seated Jack remains visible through the downhill observation window and skylight',async t=>{
 const f=await fixture();t.after(()=>{f.avatar.root.removeFromParent();f.view.dispose();});f.update();
 const cabin=f.view.cars[0],headPoints=skinPoints(f.avatar,cabin).Head;assert.ok(headPoints?.length>100);
 const head=new THREE.Box3().setFromPoints(headPoints),center=head.getCenter(new THREE.Vector3());assert.ok(center.z>0,'Jack sits at the downhill window');
 const opaque=[];cabin.traverse(mesh=>{if(mesh.isMesh&&!mesh.material.transparent)opaque.push(mesh);});
 for(const direction of[new THREE.Vector3(0,.55,1),new THREE.Vector3(.6,.55,1),new THREE.Vector3(-.6,.55,1),new THREE.Vector3(1,.55,.35)]){
  let visible=0;const blocked=[];
  for(const x of[-.18,-.09,0,.09,.18])for(const y of[-.10,0,.10]){
   const target=center.clone().add(new THREE.Vector3(x,y,.04)),origin=target.clone().addScaledVector(direction.clone().normalize(),8);cabin.localToWorld(target);cabin.localToWorld(origin);
   const delta=target.clone().sub(origin),ray=new THREE.Raycaster(origin,delta.clone().normalize(),0,delta.length()-.03);const hit=ray.intersectObjects(opaque,false)[0];if(!hit)visible++;else blocked.push({name:hit.object.name,p:cabin.worldToLocal(hit.point).toArray(),head:center.toArray()});
  }
  // Narrow framing ribs may cross the face, but most of its projected area
  // must stay visible from each intended observation angle.
  assert.ok(visible>=8,`opaque cabin hides Jack's actual head from ${direction.toArray()}: ${JSON.stringify(blocked)}`);
 }
});

test('actual imported Jack restores standing soles and full body height on the frozen train-exit commit',async t=>{
 const f=await fixture();t.after(()=>{f.avatar.root.removeFromParent();f.view.dispose();});
 const character=f.character,island=f.controller.island;
 Object.assign(character,{enabled:false,seated:false,enable(value){this.enabled=value;},teleport(point,walk){this.position={...point};this.previous={...point};this.yaw=point.yaw??0;this.speed=0;this.walkWorld=walk;}});
 const player=new PlayerController({},character);player.island={...island,id:'experience'};player.train=f.controller;
 const game={player,character,jack:f.avatar,scene:f.scene,inputs:{setEnabled(){}},resetCamera(){}};
 Object.defineProperty(game,'frozen',{get(){return player.transitioning||player.pauseReasons.size>0;}});
 const journey=new CareerJourney(game);Object.assign(journey,{ready:true,island:player.island,railway:careerRailway(),controller:f.controller,visual:f.view,walk:{clear:()=>true,groundAt:p=>p.y}});
 function assertStanding(label,soleTolerance=.006){
  const points=skinPoints(f.avatar,f.scene),ground=character.position.y;
  const footY=['LeftFoot','RightFoot'].map(name=>Math.min(...points[name].map(p=>p.y)));
  assert.ok(Math.min(...footY)>=ground-.002,`${label}: sole clips the platform`);
  assert.ok(Math.min(...footY)-ground<soleTolerance,`${label}: seated offsets still raise the sole: ${footY}`);
  const head=points.Head.map(p=>p.y);assert.ok(Math.min(...head)>ground+.60&&Math.max(...head)>ground+1.10,`${label}: body is buried at the standing root`);
  assert.equal(f.avatar.root.parent,f.scene);assert.equal(f.avatar.actorMode,'land');assert.equal(f.avatar.root.scale.x,1);
 }
 for(const station of f.controller.stations){
  assert.equal(f.controller.parkAtStation(station.id),true);assert.equal(f.controller.board(station.id),true);player.mode='riding-train';
  f.update(.5,{player});assert.equal(f.avatar.pose,'sit');assert.equal(f.avatar.root.parent,f.view.mountPoint);
  assert.equal(journey.leave(),true);player.tick(.2);
  assert.equal(player.transition.commitFrame,true);assert.equal(game.frozen,true);assert.equal(player.ridingTrain,false);
  // This is the real leave callback and actual compressed skin, including the
  // rendered frame while the fade still freezes ordinary animation updates.
  f.update(0,{player,frozen:true});assert.equal(f.avatar.pose,'idle');assertStanding(station.id+' commit');
  player.tick(.2);assert.equal(player.mode,'walking');assert.equal(character.enabled,true);
  for(let frame=0;frame<60;frame++)f.update(1/60,{player});assertStanding(station.id+' idle');
  for(const speed of[2.4,4.8]){character.speed=speed;for(let frame=0;frame<60;frame++)f.update(1/60,{player});assertStanding(station.id+' moving '+speed,.065);}
  character.speed=0;
 }
});
