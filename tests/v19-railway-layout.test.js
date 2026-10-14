import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {sampleTrainPath,trainPathLength} from '../sources/core/train-path.js';
import {CAREER_TRAIN} from '../sources/core/career-train.js';
import {islands,gates,raceStart,toWorld} from '../sources/config.js';
import {pointInPolygon,pointSegmentDistance} from '../sources/core/dock.js';
import {FLEET_ROUTES,routePoint,routeYaw} from '../sources/world/water-space.js';
const layout=JSON.parse(fs.readFileSync(process.env.V19_LAYOUT_PROBE||new URL('../static/models/walk-layout.json',import.meta.url))).islands.find(x=>x.id==='experience');
const manifest=JSON.parse(fs.readFileSync(new URL('../static/models/manifest.json',import.meta.url)));
const item=(Array.isArray(manifest)?manifest:manifest.islands||manifest.models).find(x=>x.id==='experience');
const railway=layout.railway,island=islands.find(x=>x.id==='experience');
function rect(x,z,w,d,a=0){const c=Math.cos(a),s=Math.sin(a);return[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[x+u*w/2*c+v*d/2*s,z-u*w/2*s+v*d/2*c]);}
function overlap(a,b){for(const p of[a,b])for(let n=0;n<p.length;n++){const u=p[n],v=p[(n+1)%p.length],x=v[1]-u[1],z=u[0]-v[0],pa=a.map(q=>q[0]*x+q[1]*z),pb=b.map(q=>q[0]*x+q[1]*z);if(Math.max(...pa)<=Math.min(...pb)||Math.max(...pb)<=Math.min(...pa))return false;}return true;}
test('Career funicular has the approved order, constant incline, clamped endpoints and level cabin platforms',()=>{
 assert.deepEqual(railway.stations.map(s=>s.id),['harbor','visionx','beaconfire','amtrak']);
 const path=railway.path,length=trainPathLength(path),grade=17.7/34;
 assert.equal(path.type,'funicular');assert.equal(path.closed,false);assert.ok(Math.abs(length-45.131318787644126)<1e-8);assert.ok(Math.abs(railway.length-length)<1e-8);
 assert.equal(railway.crossings.length,0);assert.equal(railway.train.gauge,1.62);
 assert.equal(railway.train.length,5);assert.equal(railway.train.width,2.2);assert.equal(railway.train.floorOffset,CAREER_TRAIN.floorY);
 for(let d=0;d<length-.01;d+=.13){const q=sampleTrainPath(path,d),p=sampleTrainPath(path,d+.01);assert.ok(Math.abs(q.grade-grade)<1e-10);assert.ok(Math.abs(q.trackPitch-Math.atan(grade))<1e-10);assert.ok(Math.abs(Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)-.01)<1e-8,'distance means true 3D arc length');}
 for(const [distance,endpoint]of[[-10,0],[length+10,length]]){const a=sampleTrainPath(path,distance),b=sampleTrainPath(path,endpoint);for(const key of['x','y','z'])assert.equal(a[key],b[key],'open rail clamps without closing across the town');}
 assert.ok(Math.abs(railway.stations[0].distance-3.4)<1e-8);assert.ok(Math.abs(length-railway.stations.at(-1).distance-3.4)<1e-8);
 assert.deepEqual(railway.stations.map(s=>s.boarding.y),[3.85,8.05,14.55,21.55]);
 for(const station of railway.stations){
  const q=sampleTrainPath(path,station.distance),halfLength=CAREER_TRAIN.cars[0].halfLength,arcReach=halfLength/Math.cos(q.trackPitch);
  assert.ok(Math.abs(q.y-station.trackY)<1e-8);assert.ok(Math.abs(station.boarding.y-q.y-CAREER_TRAIN.floorY)<1e-8);
  assert.ok(Math.abs(station.door.y-station.boarding.y)<1e-8);assert.ok(Math.abs(station.platform.y-station.boarding.y)<1e-8);
  assert.ok(Math.hypot(station.boarding.x-station.door.x,station.boarding.z-station.door.z)<=1.61,'boarding point stays beside the full-width cabin');
  assert.ok(station.distance-arcReach>0&&station.distance+arcReach<length,'full level cabin stays within the reserved rail ends');
  assert.ok(station.boarding.y-.075-sampleTrainPath(path,station.distance+arcReach).y>.27,'uphill rail clears the underside of the level deck');
 }
});
test('the complete level 5 by 2.2 metre cabin envelope clears static architecture in both directions',()=>{
 const failures=new Map(),start=railway.stations[0].distance,end=railway.stations.at(-1).distance,car=CAREER_TRAIN.cars[0];
 // The cabin keeps its heading on descent, so the same complete sweep covers
 // both directions. Include both terminals, the chassis and the roof envelope.
 for(let step=0;step<=Math.ceil((end-start)/.20);step++){
  const d=Math.min(end,start+step*.20),q=sampleTrainPath(railway.path,d),p=rect(q.x,q.z,car.halfWidth*2,car.halfLength*2,q.yaw);
  for(const o of layout.obstacles){if((o.y??.85)>q.y+railway.train.height||(o.y??.85)+o.height<q.y-1.1)continue;if(overlap(p,rect(o.x,o.z,o.width,o.depth,o.rotation||0)))failures.set(o.name,{distance:d,x:o.x,z:o.z});}
 }
 assert.deepEqual([...failures],[]);
});
test('rear expansion and its sand skirt preserve the entire race corridor and cruise hull sweep',()=>{
 const shore=item.shorePolygon||item.shorelineXZ,world=shore.map(([x,z])=>{const p=toWorld(island,x*1.06,z*1.06);return[p.x,p.z];});
 const route=[raceStart,...gates];let raceGap=Infinity;
 for(let n=0;n<world.length;n++){const a=world[n],b=world[(n+1)%world.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let d=0;d<=length;d+=.2){const p={x:a[0]+(b[0]-a[0])*d/length,z:a[1]+(b[1]-a[1])*d/length};for(let j=1;j<route.length;j++)raceGap=Math.min(raceGap,pointSegmentDistance(p,route[j-1],route[j]));}}
 assert.ok(raceGap>=13,`full reserved race corridor requires13m, actual${raceGap}`);
 const cruise=FLEET_ROUTES.find(x=>x.id==='cruise');let cruiseGap=Infinity;
 for(let phase=0;phase<Math.PI*2;phase+=.008){const p=routePoint(cruise,phase),yaw=routeYaw(cruise,phase);for(let t=-cruise.length/2;t<=cruise.length/2;t+=.3){const q={x:p.x-Math.sin(yaw)*t,z:p.z-Math.cos(yaw)*t};assert.ok(!pointInPolygon(q,world));for(let j=0;j<world.length;j++){const a=world[j],b=world[(j+1)%world.length];cruiseGap=Math.min(cruiseGap,pointSegmentDistance(q,{x:a[0],z:a[1]},{x:b[0],z:b[1]})-cruise.width/2-.25);}}}assert.ok(cruiseGap>=2,`full cruise hull clearance${cruiseGap}`);
});

for(const quality of ['high','low'])test(`${quality}: actual inclined rail supports stay below the contact lines throughout the cabin sweep`,async()=>{
 const file=new URL(`../static/models/${quality==='low'?'low/':''}experience.glb`,import.meta.url),bytes=fs.readFileSync(file),scene=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 scene.updateMatrixWorld(true);const ray=new THREE.Raycaster();
 // Terminal buffers intentionally rise above the rail beyond the cabin. Cast
 // over every rail section beneath its complete legal swept footprint instead.
 const reach=CAREER_TRAIN.cars[0].halfLength/Math.cos(sampleTrainPath(railway.path,0).trackPitch),start=railway.stations[0].distance-reach,end=railway.stations.at(-1).distance+reach;
 for(let step=0;step<=Math.ceil((end-start)/.53);step++){const d=Math.min(end,start+step*.53),q=sampleTrainPath(railway.path,d),normal=Math.hypot(q.tangentX,q.tangentZ);for(const side of[-1,0,1]){
  const x=q.x-q.tangentZ/normal*side*railway.train.gauge/2,z=q.z+q.tangentX/normal*side*railway.train.gauge/2;ray.set(new THREE.Vector3(x,q.y+.5,z),new THREE.Vector3(0,-1,0));
  const hit=ray.intersectObject(scene,true)[0];assert.ok(hit,`missing actual support at distance ${d}`);assert.ok(hit.point.y-q.y<.012,`${hit.object.name} intrudes above the wheel line by ${hit.point.y-q.y}m at ${d}`);
 }}
});
