import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {sampleTrainPath,trainPathLength} from '../sources/core/train-path.js';
import {islands,gates,raceStart,toWorld} from '../sources/config.js';
import {pointInPolygon,pointSegmentDistance} from '../sources/core/dock.js';
import {FLEET_ROUTES,routePoint,routeYaw} from '../sources/world/water-space.js';
const layout=JSON.parse(fs.readFileSync(process.env.V19_LAYOUT_PROBE||new URL('../static/models/walk-layout.json',import.meta.url))).islands.find(x=>x.id==='experience');
const manifest=JSON.parse(fs.readFileSync(new URL('../static/models/manifest.json',import.meta.url)));
const item=(Array.isArray(manifest)?manifest:manifest.islands||manifest.models).find(x=>x.id==='experience');
const railway=layout.railway,island=islands.find(x=>x.id==='experience');
function rect(x,z,w,d,a=0){const c=Math.cos(a),s=Math.sin(a);return[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[x+u*w/2*c+v*d/2*s,z-u*w/2*s+v*d/2*c]);}
function overlap(a,b){for(const p of[a,b])for(let n=0;n<p.length;n++){const u=p[n],v=p[(n+1)%p.length],x=v[1]-u[1],z=u[0]-v[0],pa=a.map(q=>q[0]*x+q[1]*z),pb=b.map(q=>q[0]*x+q[1]*z);if(Math.max(...pa)<=Math.min(...pb)||Math.max(...pb)<=Math.min(...pa))return false;}return true;}
test('Career railway has the approved order, level stations, continuous true 3D curve and grade',()=>{
 assert.deepEqual(railway.stations.map(s=>s.id),['harbor','visionx','beaconfire','amtrak']);
 const path=railway.path,length=trainPathLength(path);assert.ok(length>=250&&length<=270);
 for(const part of path.planSegments)if(part.type==='arc')assert.ok(part.radius>=6);
 assert.equal(railway.crossings.length,1);assert.equal(railway.train.gauge,1.62);
 let grade=0;for(let d=0;d<length;d+=.13){const q=sampleTrainPath(path,d),p=sampleTrainPath(path,d+.01);grade=Math.max(grade,Math.abs(q.grade));assert.ok(Math.abs(Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)-.01)<.00004,'distance means 3D arc length');}
 assert.ok(grade<=.08);assert.ok(Math.hypot(...['x','y','z'].map(k=>sampleTrainPath(path,0)[k]-sampleTrainPath(path,length)[k]))<1e-6);
 for(const station of railway.stations){for(let offset=-5;offset<=5;offset+=.1){const q=sampleTrainPath(path,station.centerDistance+offset);assert.ok(Math.abs(q.y-station.trackY)<.001,'entire ten metre station straight stays level');}assert.ok(Math.abs(station.boarding.y-station.trackY-.6)<1e-8);assert.ok(Math.hypot(station.boarding.x-station.door.x,station.boarding.z-station.door.z)<1.4);}
});
test('complete conservative car envelopes clear each other and static architecture throughout the 3D loop',()=>{
 const failures=new Map();for(let d=0;d<railway.length;d+=.20){const cars=[];for(const[offset,half]of[[0,1.85],[4.3,1.8]]){const q=sampleTrainPath(railway.path,d-offset),p=rect(q.x,q.z,1.86,half*2,q.yaw);cars.push(p);for(const o of layout.obstacles){if((o.y??.85)>q.y+3.05||(o.y??.85)+o.height<q.y-.08)continue;if(overlap(p,rect(o.x,o.z,o.width,o.depth,o.rotation||0)))failures.set(o.name,{distance:d,x:o.x,z:o.z});}}assert.ok(!overlap(...cars),'separate loco and coach never overlap on tight turns');}assert.deepEqual([...failures],[]);
});
test('rear expansion and its sand skirt preserve the entire race corridor and cruise hull sweep',()=>{
 const shore=item.shorePolygon||item.shorelineXZ,world=shore.map(([x,z])=>{const p=toWorld(island,x*1.06,z*1.06);return[p.x,p.z];});
 const route=[raceStart,...gates];let raceGap=Infinity;
 for(let n=0;n<world.length;n++){const a=world[n],b=world[(n+1)%world.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let d=0;d<=length;d+=.2){const p={x:a[0]+(b[0]-a[0])*d/length,z:a[1]+(b[1]-a[1])*d/length};for(let j=1;j<route.length;j++)raceGap=Math.min(raceGap,pointSegmentDistance(p,route[j-1],route[j]));}}
 assert.ok(raceGap>=13,`full reserved race corridor requires13m, actual${raceGap}`);
 const cruise=FLEET_ROUTES.find(x=>x.id==='cruise');let cruiseGap=Infinity;
 for(let phase=0;phase<Math.PI*2;phase+=.008){const p=routePoint(cruise,phase),yaw=routeYaw(cruise,phase);for(let t=-cruise.length/2;t<=cruise.length/2;t+=.3){const q={x:p.x-Math.sin(yaw)*t,z:p.z-Math.cos(yaw)*t};assert.ok(!pointInPolygon(q,world));for(let j=0;j<world.length;j++){const a=world[j],b=world[(j+1)%world.length];cruiseGap=Math.min(cruiseGap,pointSegmentDistance(q,{x:a[0],z:a[1]},{x:b[0],z:b[1]})-cruise.width/2-.25);}}}assert.ok(cruiseGap>=2,`full cruise hull clearance${cruiseGap}`);
});

for(const quality of ['high','low'])test(`${quality}: actual sleepers, cap stones and piers remain below both wheel contact lines`,async()=>{
 const file=new URL(`../static/models/${quality==='low'?'low/':''}experience.glb`,import.meta.url),bytes=fs.readFileSync(file),scene=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 scene.updateMatrixWorld(true);const ray=new THREE.Raycaster();
 for(let d=0;d<railway.length;d+=.53){const q=sampleTrainPath(railway.path,d),normal=Math.hypot(q.tangentX,q.tangentZ);for(const side of[-1,0,1]){
  const x=q.x-q.tangentZ/normal*side*railway.train.gauge/2,z=q.z+q.tangentX/normal*side*railway.train.gauge/2;ray.set(new THREE.Vector3(x,q.y+.5,z),new THREE.Vector3(0,-1,0));
  const hit=ray.intersectObject(scene,true)[0];assert.ok(hit,`missing actual support at distance ${d}`);assert.ok(hit.point.y-q.y<.012,`${hit.object.name} intrudes above the wheel line by ${hit.point.y-q.y}m at ${d}`);
 }}
});
