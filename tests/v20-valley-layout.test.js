import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TerrainSurface} from '../sources/core/terrain.js';
import {sampleTrainPath} from '../sources/core/train-path.js';
import {CAREER_TRAIN_MOTION} from '../sources/core/career-train.js';
const layout=JSON.parse(fs.readFileSync(new URL('../static/models/walk-layout.json',import.meta.url))).islands.find(i=>i.id==='experience');
const {railway}=layout,terrain=new TerrainSurface(layout.terrain);
const near=(a,b,e=.00001)=>assert.ok(Math.abs(a-b)<e,`${a} differs from ${b}`);

test('V21 straight mountain line has the approved stations, reserve and shared motion parameters',()=>{
 assert.equal(railway.path.type,'funicular');assert.equal(railway.path.closed,false);near(railway.length,45.131318787644);near(railway.endReserve,3.4);
 assert.deepEqual(railway.train,{length:5,width:2.2,height:4.3,coachOffset:0,floorOffset:1.65,gauge:1.62});
 for(const[key,value]of Object.entries(CAREER_TRAIN_MOTION))assert.equal(railway[key],value,`${key} stays shared`);
 assert.deepEqual(railway.stations.map(s=>s.id),['harbor','visionx','beaconfire','amtrak']);
 for(const[s,[z,y]]of railway.stations.map((s,i)=>[s,[[22,3.85],[13.93220338983,8.05],[1.44632768362,14.55],[-12,21.55]][i]])){
  const q=sampleTrainPath(railway.path,s.centerDistance);near(q.x,0);near(q.z,z);near(q.y+1.65,y);near(s.platform.y,y);near(s.platform.width,2.6);near(s.platform.depth,5.8);
  assert.ok(Math.abs(s.boarding.x)>=2.6&&Math.abs(s.boarding.x)<=2.8);assert.ok(s.walkRoute.length>15);
 }
 assert.equal(railway.crossings.length,0);
});

test('V21 architecture follows the chosen right garden, left workshop and upper station composition',()=>{
 const expected={'visionx-conservatory':[17,12,16,9,8.05],'software-workshop':[-15,0,18,10,14.55],'career-station':[4,-21,24,8,21.55]};
 for(const building of layout.landmarks){const[x,z,w,d,y]=expected[building.id];near(building.x,x);near(building.z,z);near(building.width,w);near(building.depth,d);near(layout.interiors.find(i=>i.landmarkId===building.id).floorY,y);}
 assert.deepEqual(layout.stations.filter(s=>s.directory).sort((a,b)=>b.hitArea.y-a.hitArea.y).map(s=>s.contentId),['visionx','beaconfire','amtrak']);
 assert.deepEqual(layout.overviewBounds,{min:[-34,.43,-30],max:[34,43,38]});near(layout.overviewCamera.elevation,28*Math.PI/180);
 assert.ok(layout.terraces.regions.some(r=>r.id==='eastern-mountain'));
 const peak=layout.solidRocks.find(rock=>rock.id==='main-peak');
 assert.ok(peak&&Math.max(...peak.vertices.filter((_,i)=>i%3===1))>=40,'the complete physical peak retains its visible skyline');
});

test('mountain stairs maintain real accessible tread dimensions, rotated geometry and matched floors',()=>{
 assert.ok(layout.stairs.length>=12);assert.equal(layout.ramps.length,0);
 for(const s of layout.stairs){assert.ok(s.width>=3.4);assert.ok(s.treadHeight<=.14);assert.ok(s.treadDepth>=.3399);assert.equal(s.treads.length,s.stepCount);
  for(const t of s.treads){near(terrain.sample(t.x,t.z).height,t.y,.001);near(t.rotation,s.rotation);}
 }
 assert.ok(layout.stairs.some(s=>Math.abs(s.rotation)>1));
 for(const[x,z,y]of[[17,12,8.05],[-15,0,14.55],[4,-21,21.55]])near(terrain.sample(x,z).height,y);
 const dispatch=layout.stations.find(s=>s.id==='amtrak:dispatch'),station=railway.stations.at(-1);assert.ok(Math.hypot(dispatch.x-station.boarding.x,dispatch.z-station.boarding.z)<=2.1);
 assert.ok(layout.terrain.indices.length/3<20000,'localized partitioning avoids global tread cut explosion');assert.ok(layout.terrain.vertices.length/3<12000,'shared indexed vertices keep collider data bounded');
});

test('V21 camera keys use bounded open-line distances and small view rotations',()=>{
 for(let i=0;i<railway.cameraPoints.length;i++){
  const p=railway.cameraPoints[i],next=railway.cameraPoints[Math.min(i+1,railway.cameraPoints.length-1)];assert.ok(p.distance>=0&&p.distance<=railway.length);assert.ok(p.viewDistance>=32&&p.viewDistance<=44);assert.equal(p.lookAt.length,3);assert.ok(Math.abs(p.azimuth-next.azimuth)<=20*Math.PI/180);
 }
});
