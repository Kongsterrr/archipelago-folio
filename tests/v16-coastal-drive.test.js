import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {GARAGE_CARS} from '../sources/core/garage-car.js';
import {islands} from '../sources/config.js';
import {drivingFixture,follow,departure,ringPath,quarterTurn,brake} from './helpers/coastal-drive-probe.js';

const layout=JSON.parse(fs.readFileSync(new URL('../static/models/walk-layout.json',import.meta.url))).islands.find(i=>i.id==='about');
const island=islands.find(i=>i.id==='about');
await R.init();

for(const config of GARAGE_CARS)for(const direction of [-1,1])test(`${config.label}: leaves its bay ${direction<0?'left':'right'}, drives every rounded coastal corner and reverses into its own bay`,()=>{
 const f=drivingFixture(island,layout),car=f.cars[config.bay];
 try{
  const exit=departure(layout,config,direction);follow(f,car,exit,{speed:4});
  const circuit=ringPath(layout.driveRoute,exit.at(-1),{direction,full:true}),stats=follow(f,car,circuit);
  assert.ok(stats.length>240,'a complete coastal circuit, including all four corners, was driven');
  assert.ok(stats.maxSpeed>7.99,'the circuit reaches the unchanged 8m/s normal speed');
  assert.ok(stats.distance>stats.length-.5,'the car cannot shortcut the circuit');
  follow(f,car,[f.local(car),...exit.slice().reverse()],{reverse:true});
  const bay=layout.garageBays[config.bay];assert.ok(Math.hypot(f.local(car)[0]-bay.x,f.local(car)[1]-bay.z)<.2,'returns to its own marked bay');
  assert.ok(Math.abs(Math.sin(car.yaw-car.spawn.yaw))<.05,'parks aligned with the bay');
  car.park(true);assert.ok(car.dismountPoint(),'parked driver can get out');f.verifyParked(car);
 }finally{f.close();}
});

for(const config of GARAGE_CARS)test(`${config.label}: completes the rounded coastal circuit in reverse at the production 3m/s limit`,()=>{
 const f=drivingFixture(island,layout),car=f.cars[config.bay];
 try{
  const exit=departure(layout,config,1);follow(f,car,exit,{speed:4});
  const stats=follow(f,car,ringPath(layout.driveRoute,exit.at(-1),{direction:-1,full:true}),{reverse:true});
  assert.ok(stats.maxSpeed>2.99&&stats.maxSpeed<3.001,'normal reverse retains its own speed limit');
  assert.ok(stats.length>240&&stats.distance>stats.length-.5);
  follow(f,car,[f.local(car),...exit.slice().reverse()],{reverse:true});car.park(true);f.verifyParked(car);
 }finally{f.close();}
});

test('Raptor can make a full boosted turn inside the authored 16m turning circle without contacting another vehicle',()=>{
 const court=layout.parkingAreas.find(p=>p.id==='arrival-court'),radius=2.7*1.4/Math.tan(.72),config=GARAGE_CARS.find(c=>c.id==='raptor');
 assert.ok(court.width>=18&&court.depth>=18);
 const f=drivingFixture(island,layout,{initialPose:c=>c.id===config.id?{x:court.x-radius,z:court.z,yaw:Math.PI}:null}),car=f.cars[config.bay];
 try{
  car.park(false);const initial=car.yaw;let speed=0,turn=0;
  const checkEnvelope=()=>{const [x,z]=f.local(car),yaw=car.yaw-island.rotation,c=Math.cos(yaw),s=Math.sin(yaw),w=config.width/2+.04,l=config.length/2+.04;for(const dx of[-w,w])for(const dz of[-l,l])assert.ok(Math.hypot(x+dx*c+dz*s-court.x,z-dx*s+dz*c-court.z)<=8,'the entire Raptor stays in the 16m clear turning envelope');};
  for(let frame=0;frame<600&&turn<Math.PI*2;frame++){speed=Math.max(speed,f.tick(car,{throttle:1,steer:1,boost:true}));turn=car.yaw-initial;checkEnvelope();}
  assert.ok(turn>=Math.PI*2,'completes a full 360 degree turn');assert.ok(speed>15.99,'uses the unchanged 16m/s boost');brake(f,car,{steer:1,onStep:checkEnvelope});car.park(true);f.verifyParked(car);
 }finally{f.close();}
});

test('Raptor reaches the coastal overlook, parks in an authored stall and reverses back through its real entrance',()=>{
 const f=drivingFixture(island,layout),car=f.cars.find(c=>c.id==='raptor'),court=layout.parkingAreas.find(p=>p.id==='coast-overlook');
 try{
  const exit=departure(layout,car.config,1);follow(f,car,exit,{speed:4});
  const stall=court.stalls[1],start=[Math.min(...layout.driveRoute.points.map(p=>p[0])),stall.z-4];
  follow(f,car,ringPath(layout.driveRoute,exit.at(-1),{direction:1,end:start}));
  const intoCourt=[start,...quarterTurn(start[0],start[1],1,4),[stall.x,stall.z]];
  follow(f,car,intoCourt,{speed:4});car.park(true);
  assert.ok(car.dismountPoint(),'the lookout stall has a clear walking dismount');
  assert.ok(Math.hypot(f.local(car)[0]-stall.x,f.local(car)[1]-stall.z)<.2);
  const [px,pz]=f.local(car),yaw=car.yaw-island.rotation,c=Math.cos(yaw),s=Math.sin(yaw);
  for(const dx of[-car.spec.collisionHalfWidth-.04,car.spec.collisionHalfWidth+.04])for(const dz of[-car.spec.collisionHalfLength-.04,car.spec.collisionHalfLength+.04]){assert.ok(Math.abs(px+dx*c+dz*s-stall.x)<stall.width/2);assert.ok(Math.abs(pz-dx*s+dz*c-stall.z)<stall.depth/2,'the entire parked Raptor fits the painted stall');}
  follow(f,car,intoCourt.slice().reverse(),{reverse:true});car.park(true);f.verifyParked(car);
 }finally{f.close();}
});
