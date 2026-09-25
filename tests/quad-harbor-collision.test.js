import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import { islands } from '../sources/config.js';
import { IslandWalkWorld, CharacterController, localToWorld } from '../sources/core/character.js';
import { dockLocal } from '../sources/core/dock.js';
import { QUAD_BIKE, QuadBikeController, quadFootprintClear } from '../sources/core/quad-bike.js';

const layout = JSON.parse(fs.readFileSync(new URL('../static/models/walk-layout.json', import.meta.url))).islands.find(i => i.id === 'projects');
const projects = islands.find(i => i.id === 'projects');
const DT = 1 / 60;
const drive = { throttle: 1, steer: 0, boost: false, brake: false };
await R.init();

function fixture({ island = projects, walkLayout = layout, localSpawn = QUAD_BIKE.localSpawn } = {}) {
  const world = new R.World({ x: 0, y: 0, z: 0 });
  world.timestep = DT;
  const walk = new IslandWalkWorld(R, world, island, walkLayout);
  const spawn = localToWorld(island, { ...localSpawn, y: walkLayout.groundY ?? .85 });
  const bike = new QuadBikeController(R, world, walk, spawn);
  world.propagateModifiedBodyPositionsToColliders();
  world.updateSceneQueries();
  return { world, walk, bike, spawn, dispose() { bike.dispose(); world.free(); } };
}

function tick(f, input = drive) {
  f.bike.step(input, DT);
  f.world.step();
  f.bike.afterStep();
}

function relocate(f, x, z, yaw = 0) {
  const p = localToWorld(f.walk.island, { x, z, y: layout.groundY, yaw });
  assert.ok(quadFootprintClear(f.walk, p, p.yaw), `test staging point must be clear: ${x},${z}`);
  f.bike.teleport(p);
  f.bike.park(false);
  return p;
}

test('quad starts at the actual Projects harbor, with an unobstructed route into the island', () => {
  const f = fixture();
  try {
    const local = dockLocal(f.spawn, projects);
    assert.ok(local.z >= layout.dock.startZ - 4 && local.z <= layout.dock.startZ + .5, 'parking stays beside the harbor mouth, not the Research footbridge');
    assert.ok(Math.abs(local.x) < 4, 'parking is visible beside the arrival path');
    assert.ok(quadFootprintClear(f.walk, f.spawn, f.spawn.yaw), 'the complete vehicle clears shore and dock pilings');
    for (let z = local.z; z >= 19; z -= .2) {
      const p = localToWorld(projects, { x: local.x, z });
      assert.ok(quadFootprintClear(f.walk, p, f.spawn.yaw), `harbor exit is clear at local z=${z.toFixed(1)}`);
    }
    for (const berth of layout.berths) {
      for (let z = berth.landing.z; z >= 26; z -= .2) {
        assert.ok(f.walk.clear(localToWorld(projects, { x: berth.landing.x, z }), .24), 'Jack can reach the parking approach from either berth');
      }
    }
  } finally { f.dispose(); }
});

test('complete footprint rejects a thin post inside the chassis, including a rotated island', () => {
  for (const rotation of [0, -.7, Math.PI / 2]) {
    const island = { x: 41, z: -23, rotation, shore: [[-10,-10],[10,-10],[10,10],[-10,10]] };
    const walkLayout = { groundY: .85, surfaces: [], obstacles: [{ x: .4, z: .46, width: .03, depth: .12, height: 1, rotation: .35 }] };
    const f = fixture({ island, walkLayout, localSpawn: { x: 4, z: 4, yaw: 0 } });
    try {
      const p = localToWorld(island, { x: 0, z: 0 });
      assert.equal(quadFootprintClear(f.walk, p, rotation), false, 'a post between the old nine sample points still blocks the quad');
      assert.equal(quadFootprintClear(f.walk, localToWorld(island, { x: 3, z: 0 }), rotation), true);
    } finally { f.dispose(); }
  }
});

for (const approach of [{ name: 'frontal', yaw: 0 }, { name: 'left oblique', yaw: .16 }, { name: 'right oblique', yaw: -.16 }]) {
  test(`Projects observatory ${approach.name} collision stays local and can reverse away`, () => {
    const f = fixture();
    try {
      relocate(f, -.8, 6, approach.yaw);
      let previous = { ...f.bike.position }, closest = Infinity;
      for (let n = 0; n < 480; n++) {
        tick(f, { ...drive, boost: true });
        const p = f.bike.position;
        assert.ok(Math.hypot(p.x - previous.x, p.z - previous.z) < .4, `collision cannot teleport on frame ${n}`);
        assert.ok(quadFootprintClear(f.walk, p, f.bike.yaw), `full quad stays outside observatory on frame ${n}`);
        assert.ok(Math.hypot(p.x - f.spawn.x, p.z - f.spawn.z) > 12, 'normal contact never returns to harbor spawn');
        closest = Math.min(closest, dockLocal(p, projects).z);
        previous = { ...p };
      }
      assert.ok(closest < 0, 'the test actually reaches the observatory wall');
      const stopped = dockLocal(f.bike.position, projects);
      for (let n = 0; n < 120; n++) tick(f, { ...drive, throttle: -1 });
      const reversed = dockLocal(f.bike.position, projects);
      assert.ok(reversed.z > stopped.z + 2, 'reverse gets the vehicle away from the wall');
    } finally { f.dispose(); }
  });
}

test('holding throttle against a wall does not keep spinning stationary wheels', () => {
  const f = fixture();
  try {
    relocate(f, -.8, 6);
    for (let n = 0; n < 360; n++) tick(f);
    const angle = f.bike.wheelAngle, position = { ...f.bike.position };
    for (let n = 0; n < 120; n++) { tick(f); f.bike.updateVisual(DT, false, 1); }
    assert.ok(Math.hypot(f.bike.position.x - position.x, f.bike.position.z - position.z) < .01);
    assert.ok(Math.abs(f.bike.wheelAngle - angle) < .04, 'wheel rotation tracks ground travel, not held throttle');
  } finally { f.dispose(); }
});

test('steering while touching a wall cannot rotate a corner through it or reset the bike', () => {
  const f = fixture();
  try {
    relocate(f, -.8, 6);
    for (let n = 0; n < 300; n++) tick(f);
    let previous = { ...f.bike.position };
    for (let n = 0; n < 240; n++) {
      tick(f, { ...drive, steer: n < 120 ? 1 : -1, boost: true });
      const p = f.bike.position;
      assert.ok(Math.hypot(p.x - previous.x, p.z - previous.z) < .4, 'turning contact stays local');
      assert.ok(quadFootprintClear(f.walk, p, f.bike.yaw), 'rotated corners do not cut into obstacles');
      previous = { ...p };
    }
  } finally { f.dispose(); }
});

test('Jack cannot walk through the parked quad', () => {
  const f = fixture();
  const character = new CharacterController(R, f.world);
  try {
    f.bike.teleport(localToWorld(projects, { x: 2.5, z: 20, y: .85 }));
    f.bike.park(true);
    character.teleport(localToWorld(projects, { x: 2.5, z: 24, y: .85 }), f.walk);
    character.enable(true);
    const yaw = projects.rotation;
    for (let n = 0; n < 180; n++) {
      character.step({ x: -Math.sin(yaw), z: -Math.cos(yaw), run: true }, DT);
      f.world.step();
      character.afterStep();
    }
    const p = dockLocal(character.position, projects);
    assert.ok(p.z < 23, 'Jack reaches the vehicle');
    assert.ok(p.z > 20 + QUAD_BIKE.collisionHalfLength + .18, 'the walking capsule stops before the parked vehicle');
  } finally { f.dispose(); }
});

test('parking, holding and resuming keep the same pose; dismount puts Jack outside the whole quad', () => {
  const f = fixture();
  try {
    relocate(f, 2.5, 20, .25);
    for (let n = 0; n < 40; n++) tick(f);
    f.bike.park(true);
    const parked = { ...f.bike.position }, yaw = f.bike.yaw;
    for (let n = 0; n < 120; n++) tick(f, { ...drive, steer: 1, boost: true });
    assert.deepEqual({ ...f.bike.position }, parked);
    assert.equal(f.bike.yaw, yaw);
    assert.equal(f.bike.speed, 0);
    const dismount = f.bike.dismountPoint();
    assert.ok(dismount && f.walk.clear(dismount, .24));
    const dx = dismount.x - parked.x, dz = dismount.z - parked.z;
    const across = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    const along = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    assert.ok(Math.abs(across) > QUAD_BIKE.collisionHalfWidth + .24 || Math.abs(along) > QUAD_BIKE.collisionHalfLength + .24, 'dismounted capsule is outside the vehicle');
    f.bike.park(false);
    f.bike.hold();
    f.world.step();
    assert.deepEqual({ ...f.bike.position }, parked, 'opening or closing a panel cannot retain old motion');
    for (let n = 0; n < 30; n++) tick(f);
    assert.ok(Math.hypot(f.bike.position.x - parked.x, f.bike.position.z - parked.z) > .3, 'fresh throttle resumes travel');
  } finally { f.dispose(); }
});

test('the same fixed-step quad drive is consistent at 30, 60 and 120 render frames per second', () => {
  const results = [];
  for (const fps of [30, 60, 120]) {
    const f = fixture();
    try {
      relocate(f, 2.5, 20);
      let accumulator = 0, steps = 0;
      for (let frame = 0; frame < fps * 4; frame++) {
        accumulator += 1 / fps;
        while (accumulator + 1e-12 >= DT) {
          tick(f, { ...drive, steer: .12 });
          accumulator -= DT;
          steps++;
        }
        f.bike.updateVisual(1 / fps, false, Math.max(0, accumulator / DT));
      }
      assert.equal(steps, 240);
      results.push({ ...f.bike.position, yaw: f.bike.yaw, wheelAngle: f.bike.wheelAngle });
    } finally { f.dispose(); }
  }
  for (const result of results.slice(1)) for (const key of ['x', 'z', 'yaw', 'wheelAngle']) {
    assert.ok(Math.abs(result[key] - results[0][key]) < 1e-5, `${key} remains independent of render frame rate`);
  }
});
