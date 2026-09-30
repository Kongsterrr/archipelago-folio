import test from 'node:test';
import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {GarageCarController,GARAGE_CARS} from '../sources/core/garage-car.js';
await R.init();
for (const up of [false,true]) test(`car crossing a 25 mm paving ${up?'up':'down'} step does not gain rolling distance or road speed`, () => {
  const world = new R.World({x:0,y:0,z:0}), dt = 1/60;
  const groundAt = point => ((point.z >= 0) !== up) ? .025 : 0;
  const walk = {vehicles:new Set(),handles:new Set(),groundAt,contains:()=>true,clear:()=>true,visible:()=>true,
    island:{x:0,z:0,rotation:0,shore:[[-50,-50],[50,-50],[50,50],[-50,50]]},layout:{}};
  world.timestep = dt;
  const car = new GarageCarController(R,world,walk,{x:0,y:groundAt({z:.001}),z:.001,yaw:0},GARAGE_CARS[0]);
  try {
    car.park(false);
    for (let frame = 0; frame < 3; frame++) {
      const before = {...car.position}, angle = car.wheelAngle || 0;
      car.step({throttle:1,steer:0},dt);world.step();car.afterStep();
      const distance = before.z-car.position.z;
      assert.ok(Math.abs((car.wheelAngle-angle)*car.spec.wheelRadius-distance)<1e-6,'wheel phase should match actual road travel');
      assert.ok(Math.abs(Math.hypot(car.velocity.x,car.velocity.z)-.15*(frame+1))<1e-5,'a paving seam must not convert vertical velocity into driving speed');
    }
  } finally {car.dispose();world.free();}
});
