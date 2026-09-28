import test from 'node:test';
import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {IslandWalkWorld, CharacterController} from '../sources/core/character.js';
import {QuadBikeController, quadGroundPose, quadFootprintClear} from '../sources/core/quad-bike.js';

await R.init();
const DT = 1 / 60;

function fixture({descending = false, reverse = false} = {}) {
  const world = new R.World({x:0,y:0,z:0});
  world.timestep = DT;
  const slope = Math.tan(50 * Math.PI / 180);
  const xs = [-14,0,8,14], height = x => .85 + Math.max(0, Math.min(8,x)) * slope;
  const vertices = xs.flatMap(x => [[x,height(x),-8],[x,height(x),8]]).flat();
  const indices = [];
  for (let i = 0; i < xs.length - 1; i++) indices.push(i*2,i*2+2,i*2+3,i*2,i*2+3,i*2+1);
  const layout = {
    shore:[[-14,-8],[14,-8],[14,8],[-14,8]], groundY:.85,
    surfaces:[{x:-12,z:6,width:1,depth:1,y:.85}], obstacles:[],
    terrain:{vertices,indices,navigation:{maxClimbSlopeDegrees:55}},
  };
  const walk = new IslandWalkWorld(R,world,{x:0,z:0,rotation:0},layout);
  const travelYaw = descending ? Math.PI/2 : -Math.PI/2;
  const spawn = {x:descending ? 11 : -5,z:0,yaw:travelYaw + (reverse ? Math.PI : 0)};
  spawn.y = quadGroundPose(walk,spawn,spawn.yaw).height;
  const bike = new QuadBikeController(R,world,walk,spawn);
  bike.park(false);
  return {world,walk,bike,spawn,dispose(){bike.dispose();world.free();}};
}

function tick(f,input) {
  const before = {...f.bike.position};
  f.bike.step(input,DT); f.world.step(); f.bike.afterStep();
  const p = f.bike.position;
  assert.ok(quadFootprintClear(f.walk,p,f.bike.yaw), 'all wheel-support samples remain navigable');
  return Math.hypot(p.x-before.x,p.y-before.y,p.z-before.z)/DT;
}

test('quad actual 3D speed stays bounded across flat, steep-ramp and crest seams in both directions', () => {
  for (const descending of [false,true]) for (const reverse of [false,true]) for (const boost of [false,true]) {
    const f = fixture({descending,reverse});
    const limit = reverse ? (boost ? 8 : 4) : (boost ? 16 : 8);
    let maximum = 0;
    try {
      for (let n = 0; n < 300; n++) {
        const speed = tick(f,{throttle:reverse ? -1 : 1,boost});
        maximum = Math.max(maximum,speed);
        assert.ok(speed <= limit + .004, `surface speed ${speed} exceeds ${limit} on a ${descending?'descending':'ascending'} seam`);
      }
      assert.ok(maximum > limit * .9, 'the bound is achieved by driving normally, not by blocking the slope');
      assert.ok(descending ? f.bike.position.x < -.5 : f.bike.position.x > 8.5, 'vehicle crosses both slope seams');
    } finally { f.dispose(); }
  }
});

test('releasing the throttle on a steep slope stops and preserves the parked slope pose', () => {
  const f = fixture();
  try {
    for (let n = 0; n < 110; n++) tick(f,{throttle:1});
    assert.ok(f.bike.position.x > 1 && f.bike.position.x < 7, 'coasting begins on the ramp');
    for (let n = 0; n < 50; n++) tick(f,{});
    assert.ok(f.bike.speed < .02, 'gravity-free arcade climbing does not keep coasting after release');
    f.bike.park(true);
    f.bike.updateVisual(0,true);
    const pose = {position:f.bike.group.position.clone(),rotation:f.bike.group.quaternion.clone()};
    for (let n = 0; n < 60; n++) {
      tick(f,{}); f.bike.updateVisual(DT,false,(n%11)/10);
      assert.ok(f.bike.group.position.distanceTo(pose.position) < 1e-7, 'parked quad does not replay old interpolation');
      assert.ok(f.bike.group.quaternion.angleTo(pose.rotation) < 1e-7, 'parked bank angle remains stable');
    }
  } finally { f.dispose(); }
});

test('Jack cannot pass through the uphill or downhill end of a quad parked on a 50 degree slope', () => {
  for (const direction of [-1,1]) {
    const f = fixture();
    try {
      const parking = {x:3,z:0,yaw:-Math.PI/2};
      parking.y = quadGroundPose(f.walk,parking,parking.yaw).height;
      f.bike.teleport(parking); f.bike.park(true);
      f.world.propagateModifiedBodyPositionsToColliders();
      const jack = new CharacterController(R,f.world);
      const start = {x:3-direction*3,z:0}; start.y = f.walk.groundAt(start);
      jack.teleport(start,f.walk); jack.enable(true);
      for (let n = 0; n < 240; n++) {
        jack.step({x:direction,z:0},DT); f.world.step(); jack.afterStep();
        assert.ok((jack.position.x-parking.x)*direction < -.45, 'ground following must not place Jack through the tilted chassis');
      }
      assert.ok(Math.abs(jack.position.x-start.x) > 1, 'Jack approaches the vehicle before contact blocks him');
    } finally { f.dispose(); }
  }
});
