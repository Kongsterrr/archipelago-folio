import test from 'node:test';
import assert from 'node:assert/strict';
import {islands,toWorld,contentFocus,gates,raceStart,challenges,WORLD_RADIUS} from '../sources/config.js';
import modelManifest from '../static/models/manifest.json' with {type:'json'};
import {PerspectiveCamera,Vector3} from 'three';
import {fitBoundsPose,campusReadingRect} from '../sources/core/focus-framing.js';
import {pointInPolygon,pointSegmentDistance} from '../sources/core/dock.js';
import {segmentCrossesGate} from '../sources/core/race.js';
import {waterClear} from '../sources/world/water-space.js';
import {COURSE_KEYS,DISCOVERY_STORAGE_KEY,DiscoveryStore} from '../sources/core/discovery.js';

test('About directory framing includes the full model and coast while story cameras follow their new places',()=>{
 const island=islands.find(i=>i.id==='about'),model=modelManifest.models.find(m=>m.id==='about'),focus=contentFocus('about'),bounds=focus.camera.fitBounds;
 const points=island.shore.map(([x,z])=>toWorld(island,x*1.17,z*1.17,-.055));
 for(const x of[model.bounds.min[0],model.bounds.max[0]])for(const y of[model.bounds.min[1],model.bounds.max[1]])for(const z of[model.bounds.min[2],model.bounds.max[2]])points.push(toWorld(island,x,z,y));
 for(const p of points)for(const[axis,n]of[['x',0],['y',1],['z',2]])assert.ok(p[axis]>=bounds.min[n]-1e-8&&p[axis]<=bounds.max[n]+1e-8);
 for(const[width,height]of[[1440,900],[390,844],[844,390]])for(const azimuth of[focus.camera.azimuth,island.rotation]){
  const pose=fitBoundsPose(bounds,{width,height,azimuth,elevation:focus.camera.elevation}),rect=campusReadingRect(width,height);
  const camera=new PerspectiveCamera(28,width/height,.2,Math.max(600,pose.distance+150));camera.position.copy(pose.position);camera.lookAt(pose.target);camera.updateMatrixWorld();
  for(const p of points){
   const clip=new Vector3(p.x,p.y,p.z).project(camera),x=(clip.x+1)*width/2,y=(1-clip.y)*height/2;
   assert.ok(x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom,'the island stays clear of the reading panel');
  }
 }
 for(const[id,local]of[['harbor',[-4,-16]],['connect',[0,18]]]){
  const story=contentFocus(id),expected=toWorld(island,...local);assert.equal(story.x,expected.x);assert.equal(story.z,expected.z);
 }
 assert.ok(island.districts.every(d=>d.x===0&&d.z===0),'camera framing does not move animation roots');
 for(const id of['experience','projects','education'])assert.equal(contentFocus(id).camera.fitBounds,undefined);
});

test('expanded About coast and its water halo leave the complete first race corridor open',()=>{
 const about=islands.find(i=>i.id==='about'),gate=gates[0],distance=Math.hypot(gate.x-raceStart.x,gate.z-raceStart.z);
 const halo=about.shore.map(([x,z])=>toWorld(about,x*1.17,z*1.17)),polygon=halo.map(p=>[p.x,p.z]);
 const count=Math.ceil(distance/.2);
 assert.ok(Math.hypot(raceStart.x,raceStart.z)<WORLD_RADIUS-10,'the race starts before boundary braking');
 assert.equal(challenges.find(c=>c.id==='buoy').spawn,raceStart);
 for(let n=0;n<=count;n++){
  const t=n/count,p={x:raceStart.x+(gate.x-raceStart.x)*t,z:raceStart.z+(gate.z-raceStart.z)*t};
  assert.ok(waterClear(p,2),'the boat hull stays in clear water throughout the first leg');
  assert.equal(pointInPolygon(p,polygon),false);
  const shoreDistance=Math.min(...halo.map((a,j)=>pointSegmentDistance(p,a,halo[(j+1)%halo.length])));
  assert.ok(shoreDistance>=13,`the full race corridor clears the visible coast: ${shoreDistance}`);
 }
 assert.ok(Math.abs(gate.nx-(gate.x-raceStart.x)/distance)<1e-12);
 assert.ok(Math.abs(gate.nz-(gate.z-raceStart.z)/distance)<1e-12);
 assert.ok(Math.abs(-Math.sin(raceStart.yaw)-gate.nx)<1e-6);
 assert.ok(Math.abs(-Math.cos(raceStart.yaw)-gate.nz)<1e-6);
 const before={x:gate.x-gate.nx*2,z:gate.z-gate.nz*2},after={x:gate.x+gate.nx*2,z:gate.z+gate.nz*2};
 assert.equal(segmentCrossesGate(before,after,gate),true);
 assert.equal(segmentCrossesGate(after,before,gate),false);
});

test('V16 runs keep old buoy times as history without comparing against the old course',()=>{
 const data=new Map([[DISCOVERY_STORAGE_KEY,JSON.stringify({version:11,completed:['buoy','cargo'],visited:['about'],bests:{'buoy-v2':45000,'cargo-v2':78000}})]]);
 const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)},store=new DiscoveryStore({storage});
 assert.equal(COURSE_KEYS.buoy,'buoy-v16');assert.equal(store.best('buoy'),0);assert.equal(store.best('cargo'),78000);
 assert.equal(store.bests['buoy-v2'],45000);assert.ok(store.completed.has('buoy'));assert.ok(store.visited.has('about'));
 assert.equal(store.complete('buoy',55000),55000,'a slower new-course time still establishes the new course record');
 assert.equal(store.complete('buoy',60000),55000);
 const saved=JSON.parse(data.get(DISCOVERY_STORAGE_KEY));
 assert.equal(saved.bests['buoy-v2'],45000);assert.equal(saved.bests['buoy-v16'],55000);assert.equal(saved.bests['cargo-v2'],78000);
 const reloaded=new DiscoveryStore({storage});assert.equal(reloaded.best('buoy'),55000);assert.equal(reloaded.bests['buoy-v2'],45000);
 reloaded.clearLogbook();
 const cleared=new DiscoveryStore({storage});assert.equal(cleared.stamps,0);assert.equal(cleared.best('buoy'),55000);assert.equal(cleared.bests['buoy-v2'],45000);
});
