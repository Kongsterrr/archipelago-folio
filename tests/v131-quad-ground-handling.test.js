import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {islands} from '../sources/config.js';
import {IslandWalkWorld, localToWorld} from '../sources/core/character.js';
import {Inputs} from '../sources/core/inputs.js';
import {integrateQuadDrive, QuadBikeController, quadGroundPose, quadFootprintClear} from '../sources/core/quad-bike.js';

const DT = 1 / 60;
const layout = JSON.parse(fs.readFileSync(new URL('../static/models/walk-layout.json', import.meta.url))).islands.find(i => i.id === 'projects');
const projects = islands.find(i => i.id === 'projects');
await R.init();

function simulate(initial, input, seconds) {
  let state = {...initial}, x = 0, z = 0;
  for (let n = 0; n < Math.round(seconds / DT); n++) {
    state = integrateQuadDrive(state, input, DT);
    x += state.vx * DT; z += state.vz * DT;
  }
  return {...state, x, z};
}

test('quad turns maintain tyre grip instead of retaining sideways boat velocity', () => {
  for (const yaw of [0, Math.PI / 2, -.7]) for (const sign of [-1, 1]) {
    let state = {yaw, vx:-Math.sin(yaw) * 8, vz:-Math.cos(yaw) * 8};
    for (let n = 0; n < 120; n++) {
      state = integrateQuadDrive(state, {throttle:1, steer:sign}, DT);
      const lateral = state.vx * Math.cos(state.yaw) - state.vz * Math.sin(state.yaw);
      assert.ok(Math.abs(lateral) < .02, 'ordinary turns keep travel aligned with the actual vehicle heading');
      assert.ok(Math.hypot(state.vx, state.vz) <= 8 + 1e-8);
    }
  }
});

test('releasing throttle stops the quad promptly and steering alone cannot spin a parked chassis', () => {
  const cruise = simulate({yaw:0, vx:0, vz:-8}, {}, .7);
  assert.ok(Math.hypot(cruise.vx, cruise.vz) < .02, 'cruise coasting ends within 0.7 seconds');
  assert.ok(Math.abs(cruise.z) < 3, 'release does not continue drifting several vehicle lengths');
  const boosted = simulate({yaw:0, vx:0, vz:-16}, {}, 1.05);
  assert.ok(Math.hypot(boosted.vx, boosted.vz) < .02, 'boost coasting ends within 1.05 seconds');
  const still = simulate({yaw:.63, vx:0, vz:0}, {steer:1}, 2);
  assert.ok(Math.abs(still.yaw - .63) < 1e-10, 'turning the handlebar at rest does not rotate the chassis');
  assert.equal(Math.hypot(still.x, still.z), 0);
});

test('Down plus Right reverses toward the rider’s right, and Down plus Left toward the left', () => {
  for (const yaw of [0, Math.PI / 2, -Math.PI / 2, .74]) for (const steer of [-1, 1]) {
    const result = simulate({yaw, vx:0, vz:0}, {throttle:-1, steer}, .8);
    const right = result.x * Math.cos(yaw) - result.z * Math.sin(yaw);
    const backward = result.x * Math.sin(yaw) + result.z * Math.cos(yaw);
    assert.ok(right * -steer > .05, `reverse steering follows the requested rearward side at heading ${yaw}`);
    assert.ok(backward > .3, 'the vehicle really moves backward, rather than just pivoting');
  }
});

test('opposite throttle brakes before reversing and the dedicated brake stops without reversing', () => {
  let state = {yaw:0, vx:0, vz:-8}, previous = 8, reversed = false;
  for (let n = 0; n < 120; n++) {
    state = integrateQuadDrive(state, {throttle:-1}, DT);
    const speed = -state.vz;
    assert.ok(Math.abs(speed - previous) < 1, 'forward/reverse changes do not snap across zero');
    if (n < 5) assert.ok(speed >= 0, 'reverse input first slows the forward motion');
    if (speed < -.1) reversed = true;
    previous = speed;
  }
  assert.ok(reversed, 'holding reverse eventually drives backward');
  const braked = simulate({yaw:0, vx:0, vz:-8}, {brake:true}, .6);
  assert.ok(Math.hypot(braked.vx, braked.vz) < .02);
  assert.ok(braked.z <= 0, 'Space does not introduce reverse movement');
});

function touchInputs(x, y) {
  // Exercise the real input mapping without binding a browser's event handlers.
  return Object.assign(Object.create(Inputs.prototype), {
    enabled:true, keys:new Set(), holds:new Set(['reverse']),
    touch:{active:true, x, y},
  });
}

test('quad touch Reverse converges toward the joystick travel direction across camera headings', () => {
  for (const cameraYaw of [0, Math.PI / 4, -Math.PI / 2]) for (const [x,y] of [[0,-1],[1,0],[-.6,-.8]]) {
    const inputs = touchInputs(x,y);
    const travelYaw = Math.atan2(-x,-y) + cameraYaw;
    const targetYaw = travelYaw + Math.PI;
    let state = {yaw:targetYaw+.65, vx:0, vz:0};
    for (let n = 0; n < 240; n++) {
      const forwardSpeed = state.vx * -Math.sin(state.yaw) + state.vz * -Math.cos(state.yaw);
      state = integrateQuadDrive(state, inputs.read(state.yaw, cameraYaw, {groundVehicle:true,forwardSpeed}), DT);
    }
    const error = Math.atan2(Math.sin(targetYaw-state.yaw), Math.cos(targetYaw-state.yaw));
    assert.ok(Math.abs(error) < .02, `reverse joystick closes its heading error for camera ${cameraYaw}, stick ${x},${y}`);
    const alongStick = state.vx * -Math.sin(travelYaw) + state.vz * -Math.cos(travelYaw);
    assert.ok(alongStick > 3.9, 'the rear travels toward the stick, rather than steering around the ±π wrap');
  }
});

test('touch Reverse remains stable while braking a forward-moving quad before backing up', () => {
  const inputs = touchInputs(.6,-.8), cameraYaw = -.4;
  const travelYaw = Math.atan2(-.6,.8) + cameraYaw, targetYaw = travelYaw + Math.PI;
  let state = {yaw:targetYaw+.4, vx:-Math.sin(targetYaw+.4)*8, vz:-Math.cos(targetYaw+.4)*8};
  let sawForward = false, sawReverse = false;
  for (let n = 0; n < 300; n++) {
    const forwardSpeed = state.vx * -Math.sin(state.yaw) + state.vz * -Math.cos(state.yaw);
    sawForward ||= forwardSpeed > .2; sawReverse ||= forwardSpeed < -.2;
    state = integrateQuadDrive(state, inputs.read(state.yaw, cameraYaw, {groundVehicle:true,forwardSpeed}), DT);
  }
  assert.ok(sawForward && sawReverse, 'test really crosses the forward/reverse braking transition');
  const error = Math.atan2(Math.sin(targetYaw-state.yaw), Math.cos(targetYaw-state.yaw));
  assert.ok(Math.abs(error) < .02, 'steering remains negative feedback on both sides of zero speed');
});

test('reverse-aware quad joystick mapping preserves boat input and keyboard steering', () => {
  const inputs = touchInputs(0,-1);
  const boat = inputs.read(.2,0);
  assert.equal(boat.throttle,-1);
  assert.ok(Math.abs(boat.steer + .34) < 1e-10, 'boat retains its existing nose-heading joystick mapping');
  inputs.touch.active = false; inputs.holds.clear(); inputs.keys = new Set(['ArrowDown','ArrowRight']);
  assert.deepEqual(inputs.read(.2,0,{groundVehicle:true,forwardSpeed:-2}), inputs.read(.2,0), 'quad directional correction only applies to touch heading control');
  assert.equal(inputs.read(.2,0,{groundVehicle:true,forwardSpeed:-2}).steer,-1);
});

function wallFixture(yawOffset = 0) {
  const world = new R.World({x:0,y:0,z:0}); world.timestep = DT;
  const walk = new IslandWalkWorld(R, world, projects, layout);
  // Mountain slopes are now traversable; retain contact/escape coverage against
  // the actual Catering kiosk wall, which must remain a solid obstacle.
  const spawn = localToWorld(projects, {x:18,z:8,yaw:yawOffset});
  spawn.y = quadGroundPose(walk, spawn, spawn.yaw).height;
  assert.ok(quadFootprintClear(walk, spawn, spawn.yaw), 'approach staging clears the complete chassis');
  const wall = localToWorld(projects, {x:18,z:4});
  assert.equal(walk.clear(wall, .1), false, 'fixture really approaches an authored building wall');
  const bike = new QuadBikeController(R, world, walk, spawn); bike.park(false);
  let rescues = 0;
  const teleport = bike.teleport.bind(bike);
  bike.teleport = (...args) => { rescues++; return teleport(...args); };
  return {world, walk, bike, spawn, rescues:() => rescues, dispose() { bike.dispose(); world.free(); }};
}

function tick(f, input) {
  const before = {...f.bike.position};
  f.bike.step(input, DT); f.world.step(); f.bike.afterStep();
  const p = f.bike.position;
  assert.ok(Math.hypot(p.x-before.x, p.z-before.z) < .3, 'contact and recovery remain local');
  assert.ok(quadFootprintClear(f.walk, p, f.bike.yaw), 'no corner enters the solid building while escaping');
}

for (const angle of [0, -.2, .2]) for (const steer of [-1, 1]) {
  test(`real building contact can reverse with ${steer > 0 ? 'left' : 'right'} input after a ${angle} rad approach`, () => {
    const f = wallFixture(angle);
    try {
      for (let n = 0; n < 180; n++) tick(f, {throttle:1, boost:true});
      const reached = f.bike.position;
      assert.ok(Math.hypot(reached.x-f.spawn.x, reached.z-f.spawn.z) > .5, 'drive actually reaches the kiosk');
      assert.ok(f.bike.speed < .1, 'forward progress is blocked; harmless contact-tangent sliding is allowed');
      assert.equal(quadFootprintClear(f.walk, {
        x:reached.x-Math.sin(f.bike.yaw)*.15,
        z:reached.z-Math.cos(f.bike.yaw)*.15,
      }, f.bike.yaw), false, 'the complete front footprint is genuinely against the solid wall');
      for (let n = 0; n < 6; n++) tick(f, {brake:true});
      const contact = {...f.bike.position}, contactYaw = f.bike.yaw;
      // Full steering from a complete stop rotates one front corner toward the
      // obstacle while reverse wants to leave it: the historically sticky case.
      for (let n = 0; n < 75; n++) tick(f, {throttle:-1, steer});
      const p = f.bike.position;
      const retreat = (p.x-contact.x)*Math.sin(contactYaw) + (p.z-contact.z)*Math.cos(contactYaw);
      assert.ok(retreat > .8, 'reverse plus steering leaves the wall without an extra Reset');
      assert.equal(f.rescues(), 0, 'neither impact nor escape relies on safety teleport');
    } finally { f.dispose(); }
  });
}
