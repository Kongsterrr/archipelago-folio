import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TerrainSurface} from '../sources/core/terrain.js';
import {sampleTrainPath} from '../sources/core/train-path.js';
import {CAREER_TRAIN_MOTION} from '../sources/core/career-train.js';

const layout=JSON.parse(fs.readFileSync(new URL('../static/models/walk-layout.json',import.meta.url))).islands.find(i=>i.id==='experience');
const {railway}=layout,terrain=new TerrainSurface(layout.terrain);
const near=(a,b,epsilon=.00001)=>assert.ok(Math.abs(a-b)<epsilon,`${a} differs from ${b}`);

test('V20 valley circuit keeps the approved short geometry, unchanged train and shared operating limits',()=>{
 assert.ok(railway.length>104&&railway.length<104.1);
 assert.deepEqual(railway.path.planSegments.filter(p=>p.type==='line').map(p=>[p.from,p.to]),[[[-15,15],[15,15]],[[15,1],[-15,1]]]);
 assert.deepEqual(railway.path.planSegments.filter(p=>p.type==='arc').map(p=>p.radius),[7,7]);
 assert.deepEqual(railway.train,{length:7.95,width:1.86,height:3.05,coachOffset:4.3,floorOffset:.6,gauge:1.62});
 for(const[key,value]of Object.entries(CAREER_TRAIN_MOTION))assert.equal(railway[key],value,`${key} cannot drift between model export and runtime`);
 assert.deepEqual(railway.stations.map(s=>s.id),['harbor','visionx','beaconfire','amtrak']);
 for(const[s,[x,z,y]]of railway.stations.map((s,i)=>[s,[[-9,15,.95],[9,15,.95],[9,1,2.15],[-9,1,2.15]][i]])){
  const q=sampleTrainPath(railway.path,s.centerDistance);near(q.x,x);near(q.z,z);near(q.y,y);near(s.platform.width,10);near(s.platform.depth,2.1);
 }
});

test('the three company buildings occupy distinct elevations around the public valley',()=>{
 const expected={'visionx-conservatory':[13,8,10,6,.85],'software-workshop':[11,-7.5,11,7,2.4],'career-station':[-11,-9,24,8,5.8]};
 for(const building of layout.landmarks){const[x,z,width,depth,floor]=expected[building.id];near(building.x,x);near(building.z,z,.03);near(building.width,width);near(building.depth,depth);near(layout.interiors.find(i=>i.landmarkId===building.id).floorY,floor);}
 const directory=layout.stations.filter(s=>s.directory).sort((a,b)=>b.hitArea.y-a.hitArea.y);
 assert.deepEqual(directory.map(s=>s.contentId),['visionx','beaconfire','amtrak']);
 assert.deepEqual(layout.overviewBounds,{min:[-29,.85,-24],max:[29,18,38]});
 assert.ok(layout.terraces.regions.some(r=>r.id==='valley-garden'));
 assert.ok(layout.obstacles.filter(o=>o.name.startsWith('landscape ridge')).every(o=>o.y+o.height<10),'the terminal clock remains above the rear rock skyline');
});

test('lower concourse and workshop entrance have a single continuous walking height',()=>{
 for(const[x,z,y]of[[-20,-4,2.75],[-11,-4.8,2.75],[-11,-6,2.75],[-11,-10,5.8],[11,-4.1,2.4],[11,-5,2.4],[11,-7.5,2.4],[13,8,.85]])near(terrain.sample(x,z).height,y);
 for(let z=-2.3;z>=-5;z-=.025){const a=terrain.sample(11,z).height,b=terrain.sample(11,z-.025).height;assert.ok(Math.abs(a-b)<.02,`workshop access discontinuity at ${z}`);}
 const stair=layout.stairs.find(s=>s.id==='station-grand-stair');near(stair.frontY,2.75);near(stair.backY,5.8);assert.ok(stair.treadHeight<=.14&&stair.treadDepth>=.339);
 const dispatch=layout.stations.find(s=>s.id==='amtrak:dispatch'),station=railway.stations.find(s=>s.id==='amtrak');assert.ok(Math.hypot(dispatch.x-station.boarding.x,dispatch.z-station.boarding.z)<=2.1,'the visible train action is inside the boarding zone');
});

test('V20 route camera keys preserve distance semantics and small view rotations',()=>{
 for(let i=0;i<railway.cameraPoints.length;i++){
  const point=railway.cameraPoints[i],next=railway.cameraPoints[(i+1)%railway.cameraPoints.length];assert.ok(point.distance>=0&&point.distance<railway.length);assert.ok(point.viewDistance>=32&&point.viewDistance<=36);assert.equal(point.lookAt.length,3);assert.ok(Math.abs(point.azimuth-next.azimuth)<=20*Math.PI/180);
 }
});
