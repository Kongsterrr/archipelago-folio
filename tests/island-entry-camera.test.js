import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {islands, toWorld} from '../sources/config.js';
import layout from '../static/models/walk-layout.json' with {type:'json'};
import {CameraRig, cameraAzimuth} from '../sources/core/camera.js';

const GLOBAL_AZIMUTH = Math.PI / 4;
const viewports = [[1440, 900], [1920, 1080], [390, 844], [844, 390]];
const modes = ['walking', 'quad'];
const makeRig = (width, height, zoom = 1, reduced = false) => new CameraRig(
  new THREE.PerspectiveCamera(28, width / height, .2, 600),
  {zoom, walkZoom: zoom, reduced}, width, height,
);
const project = (rig, point) => new THREE.Vector3(point.x, point.y, point.z).project(rig.camera);
const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const sameView = (actual, expected, label) => {
  assert.ok(actual.position.distanceTo(expected.position) < 1e-9, `${label}: camera position`);
  assert.ok(actual.target.distanceTo(expected.target) < 1e-9, `${label}: camera target`);
  assert.ok(Math.abs(angleDelta(actual.yaw, expected.yaw)) < 1e-10, `${label}: camera azimuth`);
};

test('camera azimuth resolves land, focus and Boat Studio independently', () => {
  assert.equal(cameraAzimuth(), GLOBAL_AZIMUTH);
  for (const island of islands) {
    const land = {landAzimuth: island.rotation};
    assert.equal(cameraAzimuth({...land, locomotion: 'sailing'}), GLOBAL_AZIMUTH);
    for (const locomotion of modes) {
      assert.equal(cameraAzimuth({...land, locomotion}), island.rotation);
      assert.equal(cameraAzimuth({locomotion}), GLOBAL_AZIMUTH);
      assert.equal(cameraAzimuth({...land, locomotion, focus: {x: 1, z: 2}}), GLOBAL_AZIMUTH);
      assert.equal(cameraAzimuth({...land, locomotion, focus: {camera: {azimuth: 0}}}), 0);
      assert.equal(cameraAzimuth({...land, locomotion, focus: {camera: {azimuth: 1.7}}}), 1.7);
      assert.equal(cameraAzimuth({...land, locomotion, focus: {boatStudio: true, camera: {azimuth: 1.7}}}), GLOBAL_AZIMUTH);
    }
  }
});

for (const island of islands) for (const [width, height] of viewports) {
  test(`${island.id}: both real entrances face screen-up at ${width}×${height}, every zoom and land mode`, () => {
    const berths = layout.islands.find(item => item.id === island.id).berths;
    assert.equal(berths.length, 2, 'exercise both actual landing berths');
    for (const berth of berths) for (const zoom of [0, 1, 2]) for (const locomotion of modes) {
      const {x, y, z} = berth.landing;
      const position = toWorld(island, x, z, y);
      const inward = toWorld(island, x, z - 4, y);
      const rig = makeRig(width, height, zoom);
      const label = `${island.id}/${x}/${locomotion}/zoom-${zoom}`;
      // Actor yaw includes the old berth-facing direction and every quarter turn.
      // The view belongs to the island, so turning in place cannot rotate it.
      for (const yaw of [island.rotation, berth.landing.yaw + island.rotation, -.6, .7, 2.1, 4.4]) {
        rig.update(0, {position, yaw, locomotion, landAzimuth: island.rotation}, true);
        const start = project(rig, position), end = project(rig, inward);
        assert.ok(Math.abs(end.x - start.x) * width / 2 < .001, `${label}: inward path has no horizontal screen drift`);
        assert.ok(end.y > start.y, `${label}: inward path points strictly up`);
        assert.ok(Math.abs(start.x) < 1e-10, `${label}: rotated framing keeps the landing centered horizontally`);
        assert.ok(Math.abs(angleDelta(rig.yaw, island.rotation)) < 1e-10, `${label}: island azimuth`);
        assert.ok(Math.abs(start.y) < .8 && Math.abs(end.y) < .9, `${label}: entry path stays visible`);
        assert.equal(rig.camera.fov, 28);
      }
    }
  });
}

test('walking and quad retain island azimuth while actor headings, speed and follow position change', () => {
  for (const island of islands) for (const locomotion of modes) for (const reduced of [false, true]) {
    const rig = makeRig(390, 844, 1, reduced);
    let position = toWorld(island, -.5, 26, .85);
    rig.update(0, {position, locomotion, landAzimuth: island.rotation}, true);
    for (let frame = 0; frame < 180; frame++) {
      const yaw = frame * .071, speed = locomotion === 'quad' ? 12 : 4;
      position = {...position, x: position.x - Math.sin(yaw) * speed / 60, z: position.z - Math.cos(yaw) * speed / 60};
      rig.update(1 / 60, {position, yaw, speed, locomotion, landAzimuth: island.rotation});
      assert.ok(Math.abs(angleDelta(rig.yaw, island.rotation)) < 1e-10, `${island.id}/${locomotion}: heading must not rotate view`);
      const offset = rig.position.clone().sub(rig.target).normalize();
      assert.ok(Math.abs(offset.y - Math.sin(THREE.MathUtils.degToRad(38))) < 1e-10, 'existing camera elevation is preserved');
    }
  }
});

test('rotating a land view preserves framing, distance and zoom relative to its entrance', () => {
  const origin = {x: 0, z: 0, rotation: 0};
  for (const [width, height] of viewports) for (const zoom of [0, 1, 2]) for (const locomotion of modes) for (const reduced of [false, true]) {
    const canonical = makeRig(width, height, zoom, reduced);
    const position = toWorld(origin, -.5, 29.5, .85), inward = toWorld(origin, -.5, 25.5, .85);
    canonical.update(0, {position, yaw: .9, speed: 3, locomotion, landAzimuth: 0}, true);
    const projected = [project(canonical, position), project(canonical, inward)];
    for (const island of islands) {
      const rotated = makeRig(width, height, zoom, reduced);
      const entry = toWorld(island, -.5, 29.5, .85), path = toWorld(island, -.5, 25.5, .85);
      rotated.update(0, {position: entry, yaw: .9 + island.rotation, speed: 3, locomotion, landAzimuth: island.rotation}, true);
      assert.equal(rotated.distance, canonical.distance);
      assert.ok(project(rotated, entry).distanceTo(projected[0]) < 1e-10, `${island.id}/${locomotion}: actor framing`);
      assert.ok(project(rotated, path).distanceTo(projected[1]) < 1e-10, `${island.id}/${locomotion}: path framing`);
    }
  }
});

test('land views default to the existing 45-degree camera when no island azimuth is supplied', () => {
  for (const [width, height] of viewports) for (const locomotion of modes) {
    const state = {position: {x: 12, y: .85, z: -32}, yaw: .8, speed: 3, locomotion};
    const defaultRig = makeRig(width, height), explicitRig = makeRig(width, height);
    defaultRig.update(0, state, true);
    explicitRig.update(0, {...state, landAzimuth: GLOBAL_AZIMUTH}, true);
    sameView(defaultRig, explicitRig, locomotion);
  }
});

test('prior land views cannot change sailing, focus or Boat Studio framing', () => {
  for (const [width, height] of viewports) for (const zoom of [0, 1, 2]) for (const island of islands) {
    const position = {x: 12, y: .35, z: -32};
    const independentStates = [
      {position, yaw: .7, speed: 18, velocity: {x: -Math.sin(.7) * 18, z: -Math.cos(.7) * 18}, input: {boost: true, throttle: 1}},
      {position, locomotion: 'walking', focus: {x: 6, z: 8}},
      {position, locomotion: 'quad', focus: {x: 6, z: 8, exhibit: true, camera: {azimuth: 0, elevation: .68, distance: 48, height: 3}}},
      {position, locomotion: 'walking', focus: {boatStudio: true}},
    ];
    for (const state of independentStates) {
      const rig = makeRig(width, height, zoom), baseline = makeRig(width, height, zoom);
      rig.update(0, {position, locomotion: 'walking', landAzimuth: island.rotation}, true);
      rig.update(0, {...state, landAzimuth: island.rotation}, true);
      baseline.update(0, state, true);
      sameView(rig, baseline, `${island.id}/${state.focus?.boatStudio ? 'studio' : state.focus ? 'focus' : 'sailing'}`);
    }
  }
});
