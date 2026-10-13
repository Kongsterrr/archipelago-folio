import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CameraRig,cameraAzimuth} from '../sources/core/camera.js';
import {CameraTransition} from '../sources/core/camera-transition.js';
import {CareerTrainController,CAREER_TRAIN} from '../sources/core/career-train.js';
import {careerRailway} from '../scripts/lib/career-railway-layout.mjs';
import {CareerJourney} from '../sources/world/career-journey.js';

for(const [width,height]of [[1440,900],[1920,1080],[390,844],[844,390]])test(`whole train remains visible during a circuit at ${width}x${height}`,()=>{
 const railway=careerRailway(),island={x:-76,z:8,rotation:Math.PI/2};
 const c=new CareerTrainController(railway,{island});
 const journey=Object.assign(Object.create(CareerJourney.prototype),{ready:true,controller:c,railway,island,walk:{layout:{stations:[]}}});
 const camera=new THREE.PerspectiveCamera(28,width/height,.2,600),rig=new CameraRig(camera,{walkZoom:1},width,height);
 for(const zoom of[0,1,2])for(let d=0;d<c.length;d+=2){rig.settings.walkZoom=zoom;c.distance=c.previousDistance=d;rig.update(0,{position:c.position,yaw:c.yaw,locomotion:'train',landAzimuth:Math.PI/2,trainView:journey.cameraView()},true);
  for(let n=0;n<2;n++){const p=c.carPose(n),m=new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y,p.z),new THREE.Quaternion().setFromEuler(new THREE.Euler(p.pitch,p.yaw,0,'YXZ')),new THREE.Vector3(1,1,1)),spec=CAREER_TRAIN.cars[n];
   for(const x of[-spec.halfWidth,spec.halfWidth])for(const z of[-spec.halfLength,spec.halfLength])for(const y of[0,2.9]){const q=new THREE.Vector3(x,y,z).applyMatrix4(m).project(camera);assert.ok(Math.abs(q.x)<.97&&Math.abs(q.y)<.98,`car ${n} at ${d}: ${q.toArray()}`);}
  }
 }
});

test('slow rail camera angle changes do not trigger mode fades or freeze the simulated train',()=>{
 const camera=new THREE.PerspectiveCamera(28,1.6,.2,600),rig=new CameraRig(camera,{walkZoom:1},1440,900),fade=new CameraTransition(),position={x:0,y:1,z:0};
 fade.reset(Math.PI/2);
 for(let n=0;n<300;n++){
  const state={position,yaw:0,locomotion:'train',landAzimuth:Math.PI/2,trainView:{azimuth:Math.PI/2+Math.sin(n/90)*.5}};
  fade.request(cameraAzimuth(state));assert.equal(fade.active,false);const before=rig.trainAzimuth;rig.update(1/60,state,n===0);if(before!==undefined)assert.ok(Math.abs(rig.trainAzimuth-before)<.01,'no bend-driven camera snap');
 }
});

test('reduced motion holds a fixed train camera while the actor can keep moving',()=>{
 const camera=new THREE.PerspectiveCamera(28,1.6,.2,600),rig=new CameraRig(camera,{walkZoom:1,reduced:true},1440,900);
 for(let n=0;n<100;n++){rig.update(1/60,{position:{x:n/10,y:2,z:0},locomotion:'train',landAzimuth:1,trainView:{azimuth:n/10}},n===0);assert.equal(rig.trainAzimuth,1);}
 assert.ok(camera.position.x>10);
});

test('landscape passenger stays above the compact bottom card at every station',()=>{
 const railway=careerRailway(),island={x:-76,z:8,rotation:Math.PI/2},c=new CareerTrainController(railway,{island});
 const journey=Object.assign(Object.create(CareerJourney.prototype),{ready:true,controller:c,railway,island,walk:{layout:{stations:[]}}});
 const camera=new THREE.PerspectiveCamera(28,844/390,.2,600),rig=new CameraRig(camera,{walkZoom:1},844,390);
 for(const stop of railway.stations){c.distance=c.previousDistance=stop.distance;c.stationId=stop.id;rig.update(0,{position:c.position,yaw:c.yaw,locomotion:'train',landAzimuth:island.rotation,trainView:journey.cameraView()},true);
  const seat=c.seatPose(),head=new THREE.Vector3(seat.x,seat.y+1,seat.z).project(camera),screenY=(1-head.y)*.5*390;
  assert.ok(screenY>50&&screenY<210,`${stop.id} passenger head at ${screenY}px must clear the header and card`);
 }
});
