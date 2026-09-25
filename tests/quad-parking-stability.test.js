import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import { QuadBikeController } from '../sources/core/quad-bike.js';

const fixedDt = 1 / 60;
const noInput = { throttle: 0, steer: 0, boost: false, brake: false };

async function movingBike() {
  await R.init();
  const world = new R.World({ x: 0, y: 0, z: 0 });
  world.timestep = fixedDt;
  const walk = {
    contains: () => true, clear: () => true, groundAt: () => .85,
    visible: () => true, handles: new Set(),
  };
  const bike = new QuadBikeController(R, world, walk, { x: 0, y: .85, z: 0, yaw: 0 });
  bike.wheelPivots = ['front-left', 'front-right', 'rear-left', 'rear-right'].map(name => {
    const wheel = new THREE.Group();
    wheel.name = `quad-wheel-${name}`;
    bike.visual.add(wheel);
    return wheel;
  });
  bike.park(false);
  for (let n = 0; n < 90; n++) {
    bike.step({ throttle: 1, steer: .65, boost: true, brake: false }, fixedDt);
    world.step();
    bike.afterStep();
  }
  assert.ok(bike.speed > 10, 'exercise dismount during a moving, turning frame');
  assert.ok(Math.abs(bike.yaw - bike.previousYaw) > .001, 'the last frame contains steering');
  return { world, bike, dispose() { bike.dispose(); world.free(); } };
}

function assertPose(bike, position, yaw, message) {
  const error = Math.hypot(
    bike.group.position.x - position.x,
    bike.group.position.y - position.y,
    bike.group.position.z - position.z,
  );
  assert.ok(error < 1e-6, `${message}: visual position drifted ${error} units`);
  const angleError = Math.abs(Math.atan2(Math.sin(bike.group.rotation.y - yaw), Math.cos(bike.group.rotation.y - yaw)));
  assert.ok(angleError < 1e-6, `${message}: visual heading drifted ${angleError} radians`);
}

for (const fps of [30, 60, 120]) {
  test(`moving dismount keeps a parked quad stable while the world renders at ${fps} FPS`, async () => {
    const fixture = await movingBike();
    const { bike, world } = fixture;
    try {
      const parkedPosition = { ...bike.position }, parkedYaw = bike.yaw;
      const wheelAngle = bike.wheelAngle;
      bike.park(true);
      bike.updateVisual(0, false, .37);
      assertPose(bike, parkedPosition, parkedYaw, 'first frame after E');
      const wheelRotations = bike.wheelPivots.map(wheel => wheel.rotation.clone());
      let accumulator = fixedDt * .37;
      for (let frame = 0; frame < fps * 2; frame++) {
        // Modest real-world frame timing variation exercises interpolation
        // phases instead of coincidentally testing only alpha=0 or alpha=1.
        const frameDt = 1 / fps + Math.sin(frame * 1.7) * .001;
        accumulator += frameDt;
        while (accumulator >= fixedDt) {
          bike.step(noInput, fixedDt);
          world.step();
          bike.afterStep();
          accumulator -= fixedDt;
        }
        bike.updateVisual(frameDt, false, accumulator / fixedDt);
        assertPose(bike, parkedPosition, parkedYaw, `parked frame ${frame}`);
        assert.deepEqual({ ...bike.position }, parkedPosition, 'physics remains parked as Jack walks');
        assert.equal(bike.speed, 0);
        assert.equal(bike.wheelAngle, wheelAngle, 'dismount does not advance the wheels');
        bike.wheelPivots.forEach((wheel, i) => assert.ok(wheel.rotation.equals(wheelRotations[i]), 'parked wheel pose remains stable'));
      }
    } finally { fixture.dispose(); }
  });
}

test('holding a moving quad cancels pending motion and cannot replay its last frame after pause', async () => {
  const fixture = await movingBike();
  const { bike, world } = fixture;
  try {
    const position = { ...bike.position }, yaw = bike.yaw;
    bike.hold();
    bike.updateVisual(0, true);
    assertPose(bike, position, yaw, 'paused frame');
    for (const alpha of [0, .2, .8, .1, 1]) {
      bike.updateVisual(1 / 120, false, alpha);
      assertPose(bike, position, yaw, 'resume before the next fixed step');
    }
    world.step();
    assert.deepEqual({ ...bike.position }, position, 'no previously queued kinematic move survives hold');
    bike.step(noInput, fixedDt);
    world.step();
    bike.afterStep();
    bike.updateVisual(fixedDt, false, .4);
    assertPose(bike, position, yaw, 'resumed with no fresh input');
  } finally { fixture.dispose(); }
});

test('remounting after an abrupt moving dismount starts at the parked pose without an old-frame jump', async () => {
  const fixture = await movingBike();
  const { bike, world } = fixture;
  try {
    const position = { ...bike.position }, yaw = bike.yaw;
    bike.park(true);
    for (let n = 0; n < 30; n++) world.step();
    bike.park(false);
    bike.updateVisual(1 / 120, false, .1);
    assertPose(bike, position, yaw, 'remount frame before driving');
    for (let n = 0; n < 5; n++) {
      bike.step(noInput, fixedDt);
      world.step();
      bike.afterStep();
      bike.updateVisual(fixedDt, false, .5);
      assertPose(bike, position, yaw, 'remounted without throttle');
      assert.equal(bike.speed, 0);
    }
    bike.step({ ...noInput, throttle: 1 }, fixedDt);
    world.step();
    bike.afterStep();
    const resumedDistance = Math.hypot(bike.position.x - position.x, bike.position.z - position.z);
    assert.ok(resumedDistance > 0 && resumedDistance < .01, `fresh throttle should accelerate from rest, moved ${resumedDistance}`);
  } finally { fixture.dispose(); }
});

test('dismount cancels a queued kinematic target and keeps the committed body heading', async () => {
  const fixture = await movingBike();
  const { bike, world } = fixture;
  try {
    const position = { ...bike.position }, rotation = bike.body.rotation();
    const committedYaw = 2 * Math.atan2(rotation.y, rotation.w);
    bike.step({ throttle: 1, steer: 1, boost: true, brake: false }, fixedDt);
    bike.park(true);
    world.step();
    bike.updateVisual(fixedDt, false, .35);
    assert.deepEqual({ ...bike.position }, position, 'aborted physics target must not move the parked quad');
    assertPose(bike, position, committedYaw, 'queued turn cancelled by dismount');
    bike.park(false);
    bike.step(noInput, fixedDt);
    world.step();
    bike.afterStep();
    bike.updateVisual(fixedDt, false, 1);
    assertPose(bike, position, committedYaw, 'remount must not recover the cancelled turn');
  } finally { fixture.dispose(); }
});
