import test from 'node:test';
import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {TerrainSurface} from '../sources/core/terrain.js';
import {IslandWalkWorld,localToWorld} from '../sources/core/character.js';
import {QuadBikeController,quadGroundPose,quadFootprintClear} from '../sources/core/quad-bike.js';
import {selectLandExhibit,selectProjectSign,exhibitRange} from '../sources/core/project-exhibits.js';
import {CameraRig} from '../sources/core/camera.js';
import {PerspectiveCamera} from 'three';

const terrain=(sx=.08,sz=-.12)=>({vertices:[-20,4-20*sx-20*sz,-20,20,4+20*sx-20*sz,-20,20,4+20*sx+20*sz,20,-20,4-20*sx+20*sz,20],indices:[0,2,1,0,3,2]});
await R.init();
function fixture(sx=.08,sz=-.12){
 const world=new R.World({x:0,y:0,z:0});world.timestep=1/60;
 const island={x:16,z:-31,rotation:-Math.PI/2,shore:[[-20,-20],[20,-20],[20,20],[-20,20]]};
 const layout={groundY:.85,terrain:terrain(sx,sz),surfaces:[],obstacles:[]};
 const walk=new IslandWalkWorld(R,world,island,layout),p=localToWorld(island,{x:0,z:0,y:4});
 const bike=new QuadBikeController(R,world,walk,p);world.step();
 return{world,island,walk,bike,dispose(){bike.dispose();world.free();}};
}

test('triangle terrain samples exact heights and upward normals across diagonal seams',()=>{
 const surface=new TerrainSurface(terrain());
 for(let x=-19;x<=19;x+=.5)for(const z of[x-.001,x,x+.001]){
  const s=surface.sample(x,z);assert.ok(s);assert.ok(Math.abs(s.height-(4+.08*x-.12*z))<1e-8);
  assert.ok(Math.abs(s.normal.y-1/Math.hypot(1,.08,.12))<1e-8);
 }
 assert.equal(surface.sample(21,0),null);
});

test('rotated island terrain sampler, collider and full quad footprint agree',()=>{
 const f=fixture();try{
  const p=localToWorld(f.island,{x:2,z:-3});const s=f.walk.groundSample(p);
  assert.ok(Math.abs(s.height-4.52)<1e-8);assert.ok(s.normal.y>0);
  assert.equal(quadFootprintClear(f.walk,{...p,y:s.height},f.island.rotation),true);
  const support=quadGroundPose(f.walk,p,f.island.rotation);assert.ok(Math.abs(support.height-s.height)<1e-8);
  f.world.updateSceneQueries();const hit=f.world.castRay(new R.Ray({x:p.x,y:12,z:p.z},{x:0,y:-1,z:0}),20,true);
  assert.ok(Math.abs(12-hit.timeOfImpact-s.height)<.002,'visible terrain and Rapier floor agree');
 }finally{f.dispose();}
});

for(const fps of[30,60,120])test(`slope parking/dismount/hold remain stable at ${fps} FPS`,()=>{
 const f=fixture();try{
  f.bike.park(false);
  for(let i=0;i<35;i++){f.bike.step({throttle:1,steer:.15},1/60);f.world.step();f.bike.afterStep();}
  assert.ok(f.bike.dismountPoint(),'gentle slope has a complete safe dismount');
  f.bike.park(true);f.bike.updateVisual(0,true);
  const p=f.bike.group.position.clone(),q=f.bike.group.quaternion.clone(),wheel=f.bike.wheelAngle;
  assert.ok(Math.abs(f.bike.group.rotation.x)+Math.abs(f.bike.group.rotation.z)>.05,'bike actually tilts');
  for(let frame=0;frame<fps*2;frame++){f.world.step();f.bike.updateVisual(1/fps,false,(frame%7)/7);assert.ok(f.bike.group.position.distanceTo(p)<1e-8);assert.ok(1-Math.abs(f.bike.group.quaternion.dot(q))<1e-10);}
  assert.equal(f.bike.wheelAngle,wheel);assert.equal(f.bike.speed,0);
  f.bike.park(false);f.bike.step({},1/60);f.world.step();f.bike.afterStep();assert.ok(Math.hypot(f.bike.position.x-p.x,f.bike.position.y-p.y,f.bike.position.z-p.z)<1e-5);
 }finally{f.dispose();}
});

test('steep surfaces cannot be driven onto or used to dismount',()=>{
 const f=fixture(.5,0);try{assert.equal(quadFootprintClear(f.walk,f.bike.position,0),false);assert.equal(f.bike.dismountPoint(),null);}finally{f.dispose();}
});

const action=(id,x,station={},kind='read')=>({id,kind,station,position:{x,z:0},distance:p=>Math.abs(p.x-x)});
test('project prompts separate sight range, use range, hysteresis and riding actions',()=>{
 const primary=action('project',0,{primary:true,readFull:true}),device=action('cards',2,{},'action'),secondary=action('details',3);
 const list=[primary,device,secondary];
 assert.equal(selectProjectSign(list,{x:11},()=>true),primary);
 assert.equal(selectLandExhibit(list,{x:11}),null);
 assert.equal(selectLandExhibit(list,{x:3.4},{previous:primary}),secondary,'nearest remains authoritative');
 assert.equal(selectLandExhibit([primary],{x:3.4},{previous:primary}),primary);
 assert.equal(selectLandExhibit([primary],{x:3.4}),null);
 assert.equal(selectLandExhibit(list,{x:4.4},{riding:true}),primary);
 assert.equal(selectLandExhibit(list,{x:4.4},{riding:true,visible:()=>false}),null);
 assert.equal(selectLandExhibit([device,secondary],{x:2},{riding:true}),null);
 assert.equal(selectLandExhibit([primary],{x:4.9},{riding:true,previous:primary}),primary);
 assert.equal(exhibitRange(secondary,false,true),2.1);
});

test('land camera raises above a terrain obstruction without changing fixed bearing',()=>{
 const camera=new PerspectiveCamera(),rig=new CameraRig(camera,{walkZoom:1,zoom:1},1440,900);
 const state={position:{x:0,y:3,z:0},locomotion:'walking',landAzimuth:0,yaw:0};
 rig.update(0,state,true);const before=camera.position.y;
 rig.update(0,{...state,terrainHeight:p=>p.z>3?10:null},true);
 assert.ok(camera.position.y>before+2);assert.ok(Math.abs(camera.position.x)<1e-7);
});
