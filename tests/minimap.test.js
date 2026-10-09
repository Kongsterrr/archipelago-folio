import test from 'node:test';
import assert from 'node:assert/strict';
import layouts from '../static/models/walk-layout.json' with {type:'json'};
import {islands,toWorld} from '../sources/config.js';
import {dockLocal,DockInteraction,inDockZone} from '../sources/core/dock.js';
import {selectMapIsland,createMapProjection,islandMapGeometry} from '../sources/core/minimap.js';

const close=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-9,`${message}: ${actual} ≠ ${expected}`);
const closePoint=(actual,expected,message)=>{close(actual.x,expected.x,message+' x');close(actual.z,expected.z,message+' z');};
const allPoints=g=>[...g.shore,...g.dock,...g.route,...g.stations,...g.districts,...g.obstacles.flatMap(o=>o.polygon)];

test('map follows dock arrival, stays on the occupied island, and restores sea mode on departure or challenges',()=>{
 const docks=new DockInteraction(islands);
 for(const island of islands){
  const nearby=docks.update(island.dock);
  assert.equal(nearby,island,'actual safe berth is recognized');
  assert.equal(selectMapIsland({onLand:false,nearby}),island);
  assert.equal(selectMapIsland({onLand:true,island,nearby:null}),island);
  assert.equal(selectMapIsland({onLand:true,island,nearby:islands.find(i=>i!==island)}),island);
  assert.equal(selectMapIsland({onLand:false,nearby,challengeActive:true}),null);
  assert.equal(selectMapIsland({onLand:true,island,challengeActive:true}),island);
  assert.equal(selectMapIsland({onLand:false,nearby:docks.update({x:0,z:0})}),null);
 }
 assert.equal(selectMapIsland({onLand:true}),null);
});

for(const island of islands)test(`${island.id}: actual map geometry fits and aligns stations, districts, docks and obstacle footprints`,()=>{
 const layout=layouts.islands.find(l=>l.id===island.id),before=JSON.stringify(layout);
 const geometry=islandMapGeometry(island,layout);
 assert.equal(geometry.shore.length,layout.shore.length);
 assert.equal(geometry.route.length,layout.route.length);
 assert.equal(geometry.stations.length,layout.stations.length);
 assert.equal(geometry.obstacles.length,layout.obstacles.length);
 for(const [n,point] of geometry.shore.entries())closePoint(point,toWorld(island,...layout.shore[n]),'shore');
 for(const [n,point] of geometry.route.entries())closePoint(point,toWorld(island,...layout.route[n]),'route');
 for(const station of geometry.stations){
  const source=layout.stations.find(s=>s.id===station.id),district=geometry.districts.find(d=>d.id===station.contentId),localDistrict=layout.districts.find(d=>d.id===station.contentId);
  closePoint(station,toWorld(island,source.x,source.z),station.id);
  if(source.directoryOverview){
   assert.equal(station.contentId,island.id,'an overview belongs to the whole physical island');
   assert.equal(district,undefined,'an overview must not be assigned to one project district');
   close(Math.hypot(station.x-island.x,station.z-island.z),Math.hypot(source.x,source.z),'overview-to-island distance');
  }else{
   assert.ok(district,`${station.id} has its district`);
   close(Math.hypot(station.x-district.x,station.z-district.z),Math.hypot(source.x-localDistrict.x,source.z-localDistrict.z),'station-to-district distance');
  }
  assert.equal(station.label,source.label);
  assert.equal(station.action,source.action);
  assert.equal(station.y,source.y,'elevated station height remains metadata');
 }
 for(const corner of geometry.dock){
  const local=dockLocal(corner,island);
  close(Math.abs(local.x),layout.dock.width/2,'dock width');
  assert.ok(Math.min(Math.abs(local.z-layout.dock.startZ),Math.abs(local.z-layout.dock.endZ))<1e-9,'dock reaches both correct endpoints');
 }
 for(const [n,obstacle] of geometry.obstacles.entries()){
  const source=layout.obstacles[n];
  closePoint(obstacle,toWorld(island,source.x,source.z),'obstacle center');
  assert.equal(obstacle.polygon.length,4);
  for(const corner of obstacle.polygon){
   const local=dockLocal(dockLocal(corner,island),{x:source.x,z:source.z,rotation:source.rotation??0});
   close(Math.abs(local.x),source.width/2,'obstacle local half width');
   close(Math.abs(local.z),source.depth/2,'obstacle local half depth');
  }
 }
 const points=[...allPoints(geometry),island.dock];
 const {project,scale}=createMapProjection(points,310,226,18);
 assert.ok(Number.isFinite(scale)&&scale>0);
 for(const point of points){const p=project(point);assert.ok(p.x>=18-1e-9&&p.x<=292+1e-9&&p.y>=18-1e-9&&p.y<=208+1e-9,`${island.id} map clips content`);}
 assert.equal(JSON.stringify(layout),before,'map geometry must not mutate the walk controller data');
});

test('uniform map projection preserves world distances, centers the fit and keeps north up',()=>{
 const points=[{x:-50,z:-20},{x:100,z:30}],{project,scale,bounds}=createMapProjection(points,320,220,20);
 assert.deepEqual(bounds,{minX:-50,maxX:100,minZ:-20,maxZ:30});
 assert.deepEqual(project({x:25,z:5}),{x:160,y:110});
 const origin=project({x:0,z:0}),east=project({x:10,z:0}),south=project({x:0,z:10});
 close(east.x-origin.x,10*scale,'east distance');
 close(south.y-origin.y,10*scale,'south distance');
 assert.ok(project({x:0,z:-10}).y<origin.y);
 close(Math.hypot(east.x-south.x,east.y-south.y),Math.hypot(10,10)*scale,'diagonal distance');
});

test('empty or collapsed bounds give a stable finite projection with a minimum world span',()=>{
 for(const points of [[],[{x:7,z:-4}],[{x:NaN,z:Infinity},{x:7,z:-4}]]){
  const {project,scale,bounds}=createMapProjection(points,240,200);
  assert.ok(Number.isFinite(scale)&&scale>0);
  close(bounds.maxX-bounds.minX,20,'minimum X span');
  close(bounds.maxZ-bounds.minZ,20,'minimum Z span');
  assert.deepEqual(project(points.length?{x:7,z:-4}:{x:0,z:0}),{x:120,y:100});
 }
});

test('fixed local bounds include outer legal approach corners and the dock retention buffer on every island',()=>{
 for(const island of islands){
  const geometry=islandMapGeometry(island,layouts.islands.find(l=>l.id===island.id)),approach=island.approach;
  assert.equal(geometry.approach.length,4);
  for(const point of geometry.approach){
   const local=dockLocal(point,island);
   assert.ok(Math.min(Math.abs(local.x-(approach.min[0]-.75)),Math.abs(local.x-(approach.max[0]+.75)))<1e-9,'approach includes side hysteresis');
   assert.ok(Math.min(Math.abs(local.z-(approach.min[2]-.75)),Math.abs(local.z-(approach.max[2]+.75)))<1e-9,'approach includes end hysteresis');
  }
  const points=[...geometry.shore,...geometry.dock,...geometry.approach];
  for(const [width,height,padding] of[[254,212,21],[122,104,15]]){
   const {project}=createMapProjection(points,width,height,padding);
   for(const x of[approach.min[0]-.749,approach.max[0]+.749])for(const z of[approach.min[2]-.749,approach.max[2]+.749]){
    const world=toWorld(island,x,z),p=project(world);
    assert.ok(inDockZone(world,island,.75),`${island.id} corner is inside retained arrival zone`);
    assert.ok(p.x>=padding-1e-9&&p.x<=width-padding+1e-9&&p.y>=padding-1e-9&&p.y<=height-padding+1e-9,`${island.id} approach marker fits at ${width}×${height}`);
   }
  }
 }
 assert.deepEqual(islandMapGeometry({x:0,z:0}).approach,[]);
});

test('geometry can render config shoreline, pier and districts while walk data is unavailable',()=>{
 for(const island of islands){
  const geometry=islandMapGeometry(island,null);
  assert.equal(geometry.shore.length,island.shore.length);
  assert.equal(geometry.dock.length,4);
  assert.equal(geometry.districts.length,island.districts.length);
  assert.deepEqual(geometry.route,[]);
  assert.deepEqual(geometry.stations,[]);
  assert.deepEqual(geometry.obstacles,[]);
 }
 assert.deepEqual(islandMapGeometry(null),{shore:[],dock:[],approach:[],route:[],stations:[],districts:[],campuses:[],landmarks:[],obstacles:[],roads:[],parkingAreas:[],terrain:[],tracks:[]});
});

test('Duan map footprint includes the full open podium without turning it into a walking obstacle',()=>{
 const island=islands.find(i=>i.id==='education'),layout=layouts.islands.find(l=>l.id===island.id),geometry=islandMapGeometry(island,layout);
 const landmark=geometry.landmarks.find(l=>l.id==='duan-center'),source=layout.landmarks.find(l=>l.id==='duan-center');
 assert.ok(landmark);assert.equal(landmark.label,'Duan Center');assert.equal(landmark.walkableInterior,true);
 closePoint(landmark,toWorld(island,source.x,source.z),'landmark');
 assert.equal(landmark.polygon.length,4);assert.ok(landmark.width===10&&landmark.depth===8);
 assert.ok(!geometry.obstacles.some(o=>o.width===landmark.width&&o.depth===landmark.depth&&o.x===landmark.x&&o.z===landmark.z));
 assert.deepEqual(islandMapGeometry(island,null).landmarks,[]);
});
