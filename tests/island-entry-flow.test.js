import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PerspectiveCamera, Vector3} from 'three';
import {Game} from '../sources/game.js';
import {CameraRig} from '../sources/core/camera.js';
import {CameraTransition} from '../sources/core/camera-transition.js';
import {ChallengeManager} from '../sources/core/challenges.js';
import {PlayerController, BoardingController} from '../sources/core/player.js';
import {Inputs} from '../sources/core/inputs.js';
import {localToWorld} from '../sources/core/character.js';
import {islands, contentFocus} from '../sources/config.js';

const layouts = JSON.parse(fs.readFileSync(new URL('../static/models/walk-layout.json', import.meta.url))).islands;
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} != ${expected}`);
const angle = (actual, expected, message) => close(Math.atan2(Math.sin(actual - expected), Math.cos(actual - expected)), 0, message);

function actor(position, yaw = 0) {
  return {
    position: {...position}, yaw, velocity: {x:0,y:0,z:0}, speed: 0,
    hold() {},
    enable(value) { this.enabled = value; },
    park(value) { this.parked = value; },
    teleport(point, walkWorld) {
      this.position = {x:point.x,y:point.y ?? .35,z:point.z};
      this.yaw = point.yaw ?? 0;
      if (walkWorld) this.walkWorld = walkWorld;
    },
  };
}

function inputsFixture() {
  return Object.assign(Object.create(Inputs.prototype), {
    enabled: true, keys: new Set(), holds: new Set(), touch: {active:false,x:0,y:0},
  });
}

function fixture(island = islands[0]) {
  const game = Object.create(Game.prototype);
  const boat = actor({x:island.dock.x,y:.35,z:island.dock.z}, island.yaw);
  const character = actor({x:island.x,y:.85,z:island.z}, island.rotation);
  const settings = {zoom:1,walkZoom:1,reduced:false};
  const player = new PlayerController(boat, character);
  const walk = {layout:layouts.find(layout => layout.id === island.id),clear:() => true};
  Object.assign(game, {
    boat, character, player, settings, mode:'exploring', focus:null,
    cameraRig:new CameraRig(new PerspectiveCamera(28, 1440 / 900, .2, 600), settings, 1440, 900),
    visualPosition:new Vector3().copy(boat.position), prev:new Vector3().copy(boat.position), prevYaw:boat.yaw,
    jack:{root:{position:new Vector3().copy(character.position)}},
    world:{propagateModifiedBodyPositionsToColliders() {},updateSceneQueries() {},intersectionWithShape:() => null},
    inputs:inputsFixture(), challenges:{frozen:false}, feedback:{clear() {}},
    events:{trigger() {}}, landActions:new Map(), clearWake() {},
  });
  game.boarding = new BoardingController(player, {
    prepare:async () => walk,
    select:(selectedIsland, prepared) => game.selectBerth(selectedIsland, prepared),
    onCommit:(...args) => game.commitBoarding(...args),
    onError:error => { throw error; },
  });
  return {game, walk};
}

function putAshore(game, island) {
  game.player.mode = 'walking';
  game.player.island = island;
  game.character.yaw = island.rotation;
  game.boat.park(true);
}

for (const island of islands) {
  for (const berthIndex of [0, 1]) {
    test(`V12.2 ${island.id} berth ${berthIndex + 1}: land facing inland and retain the boat's berth yaw`, async () => {
      const {game, walk} = fixture(island);
      const originalLayout = structuredClone(walk.layout.berths);
      const berth = walk.layout.berths[berthIndex];
      const expectedBoat = localToWorld(island, berth.boat);
      const expectedLanding = localToWorld(island, berth.landing);
      game.boat.teleport(expectedBoat);
      assert.equal(await game.boarding.disembark(island), true);
      game.player.tick(.31);
      assert.equal(game.player.onLand, true);
      assert.equal(game.player.island, island);
      assert.deepEqual(game.boat.position, {x:expectedBoat.x,y:expectedBoat.y,z:expectedBoat.z});
      assert.deepEqual(game.character.position, {x:expectedLanding.x,y:expectedLanding.y,z:expectedLanding.z});
      assert.equal(game.boat.parked, true);
      angle(game.boat.yaw, expectedBoat.yaw, 'boat retains its original docking orientation');
      angle(game.character.yaw, island.rotation, 'character faces island-local -Z');
      angle(game.player.berth.landing.yaw, island.rotation, 'reset landing also faces inland');
      angle(game.cameraRig.yaw, island.rotation, 'midpoint camera uses the newly committed island');
      game.player.tick(.30);
      game.resetCamera();
      angle(game.cameraRig.yaw, island.rotation, 'transition completion keeps the land camera');
      assert.deepEqual(walk.layout.berths, originalLayout, 'selecting a berth must not rewrite shared layout data');

      assert.equal(game.boarding.board(), true);
      game.player.tick(.31);
      assert.equal(game.player.onLand, false);
      assert.equal(game.boat.parked, false);
      assert.equal(game.player.island, null);
      angle(game.boat.yaw, expectedBoat.yaw, 'boarding does not rotate the parked boat');
      angle(game.cameraRig.yaw, Math.PI / 4, 'boarding restores the sailing camera');
    });
  }

  test(`V12.2 ${island.id}: overview, full story and exhibit retain the land angle without mutating focus data`, () => {
    const {game} = fixture(island);
    putAshore(game, island);
    const focuses = [
      contentFocus(island.id),
      contentFocus(island.entryIds[0]),
      {islandId:island.id,x:island.x + 2,y:.85,z:island.z - 3,exhibit:true,camera:{distance:16,height:1.85,azimuth:Math.PI / 4,elevation:.66}},
    ];
    for (const focus of focuses) {
      const original = structuredClone(focus);
      game.focus = focus;
      const state = game.cameraState();
      assert.deepEqual(state.focus.camera, {...focus.camera,azimuth:island.rotation});
      assert.deepEqual(focus, original, 'shared focus data is unchanged');
      game.resetCamera();
      angle(game.cameraRig.yaw, island.rotation, 'focused reset retains island heading');
      game.focus = null;
      game.resetCamera();
      angle(game.cameraRig.yaw, island.rotation, 'closing the panel retains island heading');
    }
  });
}

function transitionFixture() {
  const island = islands.find(item => item.id === 'about');
  const remote = islands.find(item => item.id === 'experience');
  const {game, walk} = fixture(island);
  Object.assign(game, {
    cameraTransition:new CameraTransition(), challenges:new ChallengeManager(), loaded:new Map(),
    props:{snapshot:() => [],resetCargo() {},resetNear() {}},
    safePoint:point => point, updateNearby() {},
  });
  // The UI adapter avoids a DOM dependency; pause, resume, camera state and the
  // transition itself all use their production implementations.
  game.inputs.setEnabled = function(value) {
    this.enabled = value;
    this.keys.clear();
    this.holds.clear();
    this.touch = {active:false,x:0,y:0};
  };
  game.boat.snapshot = function() { return {position:{...this.position},yaw:this.yaw,velocity:{...this.velocity}}; };
  game.jack.resetPose = () => {};
  putAshore(game, island);
  game.player.berth = game.selectBerth(island, walk);
  game.character.teleport(game.player.berth.landing, walk);
  game.jack.root.position.copy(game.character.position);
  game.resetCamera();
  const cameraUpdates = [];
  const update = game.cameraRig.update.bind(game.cameraRig);
  game.cameraRig.update = (dt, state, snap) => {
    update(dt, state, snap);
    cameraUpdates.push({snap:!!snap,yaw:game.cameraRig.yaw});
  };
  return {game, island, remote, cameraUpdates};
}

function cameraFrame(game, dt) {
  // Preserve Game.frame's ordering without requiring the renderer/physics UI.
  game.syncCameraTransition();
  const fade = game.cameraTransition.step(dt, {paused:game.player.pauseReasons.has('hidden')});
  if (fade.finished) game.inputs.setEnabled(!game.frozen);
  game.updateCamera(dt, fade);
  return fade;
}

test('V12.2 Game pauses input and holds the camera until the opaque remote-panel snap, then restores the land view', () => {
  const {game, island, remote, cameraUpdates} = transitionFixture();
  const character = {...game.character.position};
  const boat = {...game.boat.position};
  const previousPosition = game.cameraRig.camera.position.clone();
  const previousRotation = game.cameraRig.camera.quaternion.clone();
  game.inputs.keys.add('KeyW');
  game.pause('read', contentFocus(remote.id));
  assert.equal(game.cameraTransition.active, true);
  assert.equal(game.inputs.enabled, false);
  assert.equal(game.frozen, true);
  assert.deepEqual(game.inputs.readWalking(game.cameraRig.yaw), {x:0,z:0,run:false});
  const before = cameraFrame(game, .04);
  assert.equal(before.hold, true);
  assert.equal(before.snap, false);
  assert.equal(cameraUpdates.length, 0, 'fade out must not update the camera pose');
  assert.deepEqual(game.cameraRig.camera.position, previousPosition);
  assert.deepEqual(game.cameraRig.camera.quaternion.toArray(), previousRotation.toArray());

  const opaque = cameraFrame(game, .06);
  assert.equal(opaque.opacity, 1);
  assert.equal(opaque.snap, true);
  assert.equal(cameraUpdates.length, 1);
  assert.equal(cameraUpdates[0].snap, true);
  angle(game.cameraRig.yaw, remote.camera.azimuth, 'remote panel snaps to its configured angle');
  assert.equal(cameraFrame(game, .1).finished, true);
  assert.equal(game.inputs.enabled, false, 'the reading panel keeps movement paused after the fade');

  game.resume();
  assert.equal(game.focus, null);
  assert.equal(game.mode, 'exploring');
  assert.equal(game.cameraTransition.active, true);
  assert.equal(game.inputs.enabled, false, 'closing the panel holds input until the return fade ends');
  const updatesBeforeReturn = cameraUpdates.length;
  assert.equal(cameraFrame(game, .05).hold, true);
  assert.equal(cameraUpdates.length, updatesBeforeReturn);
  angle(game.cameraRig.yaw, remote.camera.azimuth, 'remote view stays fixed while returning to black');
  assert.equal(cameraFrame(game, .05).snap, true);
  angle(game.cameraRig.yaw, island.rotation, 'opaque return restores the About view');
  assert.equal(cameraFrame(game, .1).finished, true);
  assert.equal(game.inputs.enabled, true);
  assert.equal(game.frozen, false);
  assert.deepEqual(game.character.position, character);
  assert.deepEqual(game.boat.position, boat);
  assert.equal(cameraUpdates.filter(update => update.snap).length, 2, 'exactly one opaque snap per direction');
});

test('V12.2 rapid remote-panel open/close before commit never strands movement input', () => {
  const {game, island, remote, cameraUpdates} = transitionFixture();
  for (const elapsed of [0, .04, .09]) {
    game.pause('read', contentFocus(remote.id));
    assert.equal(cameraFrame(game, elapsed).snap, false);
    game.resume();
    assert.equal(game.cameraTransition.active, false);
    assert.equal(game.cameraTransition.opacity, 0);
    assert.equal(game.inputs.enabled, true);
    assert.equal(game.frozen, false);
    assert.equal(cameraFrame(game, .3).snap, false, 'canceled focus cannot snap on a later frame');
    angle(game.cameraRig.yaw, island.rotation, 'the original land heading survives cancellation');
  }
  assert.equal(cameraUpdates.some(update => update.snap), false);
});

for (const elapsed of [.04, .14]) {
  test(`V12.2 Game hidden pause freezes the remote-panel transition at ${elapsed}s`, () => {
    const {game, remote} = transitionFixture();
    game.pause('read', contentFocus(remote.id));
    cameraFrame(game, Math.min(elapsed, .1));
    if (elapsed > .1) cameraFrame(game, elapsed - .1);
    const before = {
      phase:game.cameraTransition.phase,
      opacity:game.cameraTransition.opacity,
      committedAzimuth:game.cameraTransition.committedAzimuth,
      yaw:game.cameraRig.yaw,
    };
    game.pause('hidden');
    for (let frame = 0; frame < 3; frame++) {
      const fade = cameraFrame(game, .3);
      assert.equal(fade.snap, false);
      assert.equal(fade.finished, false);
      assert.equal(game.cameraTransition.phase, before.phase);
      close(game.cameraTransition.opacity, before.opacity, 'background frames retain fade opacity');
      angle(game.cameraTransition.committedAzimuth, before.committedAzimuth, 'background frames retain the committed angle');
      angle(game.cameraRig.yaw, before.yaw, 'background frames cannot rotate the camera');
      assert.equal(game.inputs.enabled, false);
    }
    game.resume('hidden');
    assert.equal(game.mode, 'read');
    assert.equal(game.player.pauseReasons.has('read'), true);
    assert.equal(game.focus.id, remote.id);
    cameraFrame(game, .06);
    cameraFrame(game, .1);
    assert.equal(game.cameraTransition.active, false);
    angle(game.cameraRig.yaw, remote.camera.azimuth, 'foreground frames finish the preserved target');
    assert.equal(game.inputs.enabled, false, 'the underlying reading panel remains paused');
    game.resume();
    cameraFrame(game, .1);
    cameraFrame(game, .1);
    assert.equal(game.inputs.enabled, true);
    assert.equal(game.frozen, false);
  });
}

for (const action of ['travel', 'reset']) {
  for (const elapsed of [.04, .14]) {
    test(`V12.2 Game ${action} at ${elapsed}s invalidates the previous panel angle and fade`, () => {
      const {game, island, remote} = transitionFixture();
      const focus = {...contentFocus(remote.id),camera:{...remote.camera,azimuth:.31}};
      game.pause('read', focus);
      cameraFrame(game, Math.min(elapsed, .1));
      if (elapsed > .1) cameraFrame(game, elapsed - .1);
      if (action === 'travel') game.teleport({...remote.dock,yaw:remote.yaw});
      else assert.equal(game.reset(), island);
      const expectedYaw = action === 'travel' ? Math.PI / 4 : island.rotation;
      assert.equal(game.focus, null);
      assert.equal(game.cameraTransition.active, false);
      assert.equal(game.cameraTransition.opacity, 0);
      assert.equal(game.inputs.enabled, true);
      assert.equal(game.frozen, false);
      assert.equal(game.player.mode, action === 'travel' ? 'sailing' : 'walking');
      angle(game.cameraRig.yaw, expectedYaw, 'the reset view immediately uses the current actor');
      angle(game.cameraTransition.committedAzimuth, expectedYaw, 'the obsolete transition target is discarded');
      for (const dt of [.05, .2, 1]) {
        const fade = cameraFrame(game, dt);
        assert.equal(fade.snap, false, 'the old panel angle never commits later');
        assert.equal(fade.opacity, 0);
        angle(game.cameraRig.yaw, expectedYaw, 'later frames preserve the new camera angle');
      }
    });
  }
}

test('V12.2 remote panels, sailing panels and Boat Studio preserve their own camera rules', () => {
  const island = islands.find(item => item.id === 'projects');
  const remote = islands.find(item => item.id === 'experience');
  const {game} = fixture(island);
  putAshore(game, island);
  game.focus = {...remote,camera:{...remote.camera,azimuth:.31}};
  const original = structuredClone(game.focus);
  assert.deepEqual(game.cameraState().focus, original);
  game.resetCamera();
  angle(game.cameraRig.yaw, .31, 'remote focus preserves its configured angle');

  game.focus = {boatStudio:true,islandId:island.id,camera:{azimuth:-.7}};
  assert.deepEqual(game.cameraState().focus, game.focus);
  game.resetCamera();
  angle(game.cameraRig.yaw, Math.PI / 4, 'Boat Studio retains the global angle while ashore');

  game.player.toSailing();
  game.focus = contentFocus(island.id);
  assert.deepEqual(game.cameraState().focus, contentFocus(island.id));
  game.resetCamera();
  angle(game.cameraRig.yaw, Math.PI / 4, 'a panel opened from the boat retains its configured angle');
  game.focus = null;
  game.player.island = island;
  game.resetCamera();
  angle(game.cameraRig.yaw, Math.PI / 4, 'a stale island reference cannot rotate the sailing camera');
});

test('V12.2 camera state uses the rendered land actor each frame and its physical position on reset', () => {
  const island = islands.find(item => item.id === 'experience');
  const {game} = fixture(island);
  putAshore(game, island);
  game.jack.root.position.set(island.x + 1, 1.2, island.z + 3);
  assert.deepEqual({...game.cameraState().position}, {...game.jack.root.position});
  assert.deepEqual({...game.cameraState({physical:true}).position}, game.character.position);
  assert.equal(game.cameraState().landAzimuth, island.rotation);
  const boatPosition = {...game.boat.position};
  game.resetCamera();
  assert.deepEqual(game.cameraRig.lastPoint, game.character.position);
  angle(game.cameraRig.yaw, island.rotation, 'reset retains the island angle');
  assert.deepEqual(game.boat.position, boatPosition);
});

test('V12.2 walking and quad cameras keep the same Projects angle through mount and dismount', () => {
  const island = islands.find(item => item.id === 'projects');
  const {game} = fixture(island);
  putAshore(game, island);
  game.resetCamera();
  const walkYaw = game.cameraRig.yaw;
  const quad = actor({x:island.x + 4,y:.85,z:island.z + 6}, .73);
  quad.mountPoint = {getWorldPosition:point => point.set(quad.position.x, 1.9, quad.position.z)};
  game.quadBike = quad;
  assert.equal(game.player.rideQuad(quad), true);
  assert.equal(game.cameraState().locomotion, 'quad');
  game.resetCamera();
  angle(game.cameraRig.yaw, walkYaw, 'mounting changes framing without rotating the view');
  assert.equal(game.player.leaveQuad({...quad.position,yaw:quad.yaw}), true);
  assert.equal(game.cameraState().locomotion, 'walking');
  game.resetCamera();
  angle(game.cameraRig.yaw, walkYaw, 'dismounting retains the land view');
});

const headingDirections = {
  about:{forward:{x:0,z:1},right:{x:-1,z:0}},
  experience:{forward:{x:-1,z:0},right:{x:0,z:-1}},
  projects:{forward:{x:1,z:0},right:{x:0,z:1}},
  education:{forward:{x:0,z:-1},right:{x:1,z:0}},
};

for (const island of islands) {
  test(`V12.2 ${island.id}: keyboard and touch follow the actual land camera heading`, () => {
    const {game} = fixture(island);
    putAshore(game, island);
    game.resetCamera();
    const cameraYaw = game.cameraRig.yaw;
    const input = inputsFixture();
    const expected = headingDirections[island.id];
    for (const [key, direction] of [['KeyW',expected.forward],['KeyD',expected.right]]) {
      input.keys = new Set([key]);
      const walking = input.readWalking(cameraYaw);
      close(walking.x, direction.x, `${key} world x`);
      close(walking.z, direction.z, `${key} world z`);
    }
    input.keys.clear();
    for (const [touch, direction] of [[{x:0,y:-.65},expected.forward],[{x:.65,y:0},expected.right]]) {
      input.touch = {active:true,...touch};
      const walking = input.readWalking(cameraYaw);
      close(walking.x, direction.x * .65, 'touch walking world x');
      close(walking.z, direction.z * .65, 'touch walking world z');
      const targetYaw = Math.atan2(-direction.x, -direction.z);
      const aligned = input.read(targetYaw, cameraYaw);
      close(aligned.steer, 0, 'touch steering aligns with the world movement heading');
      close(aligned.throttle, .65, 'touch throttle retains stick magnitude');
      close(input.read(targetYaw - .2, cameraYaw).steer, .34, 'touch steers toward its requested heading');
    }
  });
}
