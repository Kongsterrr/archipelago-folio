import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {JackAvatar} from '../sources/world/jack.js';
import {CharacterController, IslandWalkWorld, localToWorld, CHARACTER} from '../sources/core/character.js';
import {dockLocal} from '../sources/core/dock.js';
import {islands} from '../sources/config.js';

const STEP = 1 / 60;
await MeshoptDecoder.ready;
await R.init();
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
const document = await io.read(fileURLToPath(new URL('../static/models/jack-imported.glb', import.meta.url)));
// Remove browser-only images; preserve the shipped skin, rig and animation.
for (const material of document.getRoot().listMaterials()) material.setBaseColorTexture(null);
for (const texture of [...document.getRoot().listTextures()]) texture.dispose();
for (const extension of document.getRoot().listExtensionsUsed()) if (extension.extensionName === 'EXT_meshopt_compression') extension.dispose();
const data = await io.writeBinary(document);
const binary = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
const layout = JSON.parse(await fs.readFile(new URL('../static/models/walk-layout.json', import.meta.url))).islands.find(item => item.id === 'experience');
const island = islands.find(item => item.id === 'experience');

async function avatarFixture() {
  const scene = new THREE.Scene(), gltf = await new GLTFLoader().parseAsync(binary, '');
  const avatar = new JackAvatar(scene, {loadAsync: async () => gltf});
  assert.equal(await avatar.load(), true);
  const character = {position: {x: 0, y: .85, z: 0}, previous: {x: 0, y: .85, z: 0}, yaw: 0, speed: 0, seated: false};
  const player = {onLand: true, walking: true};
  return {scene, avatar, character, player, update(dt = STEP, extra = {}) {
    avatar.update(dt, {player, character, alpha: 1, reduced: false, frozen: false, ...extra});
    scene.updateMatrixWorld(true);
    for (const name of ['Head', 'Hips', 'LeftFoot', 'RightFoot']) {
      assert.ok(avatar.model.getObjectByName(name).getWorldPosition(new THREE.Vector3()).toArray().every(Number.isFinite), name + ' must stay finite');
    }
  }};
}

function stairTrack(run, id = 'harbor-east-stair', lane = 0) {
  const world = new R.World({x: 0, y: 0, z: 0}); world.timestep = STEP;
  const walk = new IslandWalkWorld(R, world, island, layout), actor = new CharacterController(R, world);
  const stair = layout.stairs.find(item => item.id === id), angle = stair.rotation || 0, half = stair.depth / 2 + .3;
  const point = localToWorld(island, {x: stair.x + lane * Math.cos(angle) + half * Math.sin(angle), z: stair.z - lane * Math.sin(angle) + half * Math.cos(angle)});
  point.y = walk.groundAt(point); actor.teleport(point, walk); actor.enable(true); world.step();
  const input = {x: -Math.sin(island.rotation + angle), z: -Math.cos(island.rotation + angle), run};
  const snapshot = () => ({position: {...actor.position}, previous: {...actor.previous}, speed: actor.speed, yaw: actor.yaw, seated: false});
  const frames = [snapshot()]; let reached = false;
  try {
    for (let i = 0; i < 1000; i++) {
      actor.step(input, STEP); world.step(); actor.afterStep(); frames.push(snapshot());
      const p = dockLocal(actor.position, island), along = (p.x - stair.x) * Math.sin(angle) + (p.z - stair.z) * Math.cos(angle);
      if (along <= -half + .05) {reached = true; break;}
    }
    assert.ok(reached, 'real Rapier must climb ' + id);
    return {frames, input, run};
  } finally {world.free();}
}

const tracks = [stairTrack(false), stairTrack(true), stairTrack(true, 'harbor-west-stair', -1.3)];
function stateAt(track, time) {
  const tick = time / STEP, index = Math.min(track.frames.length - 1, Math.floor(tick + 1e-8));
  return {character: track.frames[index], alpha: Math.max(0, Math.min(1, tick - index))};
}

async function replay(track, fps, seconds) {
  const f = await avatarFixture(), expected = track.run ? 'run' : 'walk', locomotion = f.avatar.actions.get(expected);
  const walkingIntent = {...track.input, moving: true};
  let distance = 0, clipTime = 0, priorPoint, priorTime = 0, transitions = 0, previousPose, maxRootRise = 0;
  for (let frame = 0; frame <= Math.round(seconds * fps); frame++) {
    const state = stateAt(track, frame / fps), before = f.avatar.pose;
    f.update(frame ? 1 / fps : 0, {...state, walkingIntent});
    const point = f.avatar.root.position.clone(), current = state.character.position, previous = state.character.previous;
    for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(point[axis] - THREE.MathUtils.lerp(previous[axis], current[axis], state.alpha)) < 1e-10, 'the avatar must preserve the physical interpolation, without cosmetic root smoothing');
    if (priorPoint) {
      distance += Math.hypot(point.x - priorPoint.x, point.z - priorPoint.z);
      maxRootRise = Math.max(maxRootRise, Math.abs(point.y - priorPoint.y));
      if (f.avatar.pose === expected) {
        let advance = locomotion.time - priorTime;
        if (advance < -1e-8) advance += locomotion.getClip().duration;
        clipTime += advance;
      }
    }
    if (frame > 1) {
      assert.equal(f.avatar.pose, expected, 'stair contact must not switch a held movement input to another gait');
      if ((previousPose === 'walk' || previousPose === 'run') && previousPose !== f.avatar.pose) transitions++;
      if (frame / fps > .3) assert.equal(f.avatar.blend, null, 'contact speed dips must not restart animation blending');
    }
    previousPose = f.avatar.pose; priorPoint = point; priorTime = locomotion.time;
    assert.ok(before !== 'sit', 'walking replay must never become a vehicle pose');
  }
  assert.equal(transitions, 0);
  assert.ok(Math.abs(clipTime - distance / (track.run ? CHARACTER.run : CHARACTER.walk)) < 2e-6, `stride time ${clipTime} must match actual displayed distance ${distance}`);
  return {clipTime, distance, maxRootRise};
}

test('actual Jack keeps one walk/run clip through real stair contacts and does not restart the blend', async t => {
  for (const track of tracks) {
    const result = await replay(track, 60, (track.frames.length - 1) * STEP);
    t.diagnostic(`${track.run ? 'run' : 'walk'}: ${result.distance.toFixed(3)} m; largest unfiltered physical Y step ${result.maxRootRise.toFixed(4)} m`);
  }
});

test('actual GLB gait phase follows rendered distance equally at 30, 60 and 120 FPS with a 60 Hz world', async () => {
  for (const track of tracks.slice(0, 2)) {
    const measurements = [];
    for (const fps of [30, 60, 120]) measurements.push(await replay(track, fps, 2));
    for (const result of measurements) {
      assert.ok(Math.abs(result.distance - measurements[0].distance) < .001);
      assert.ok(Math.abs(result.clipTime - measurements[0].clipTime) < .0003);
    }
  }
});

test('one stopped stair contact holds the pose but not the feet; a wall, key release and Shift remain responsive', async () => {
  const f = await avatarFixture(), intent = {x: 0, z: -1, run: true, moving: true};
  const move = speed => {
    f.character.previous = {...f.character.position};
    f.character.position.z -= speed * STEP; f.character.speed = speed;
    f.update(STEP, {walkingIntent: intent});
  };
  for (let n = 0; n < 30; n++) move(4.8);
  const run = f.avatar.actions.get('run'), time = run.time;
  f.character.previous = {...f.character.position}; f.character.speed = .0053;
  f.update(STEP, {walkingIntent: intent});
  assert.equal(f.avatar.pose, 'run'); assert.equal(f.avatar.blend, null);
  assert.equal(run.time, time, 'feet must stop when the displayed character does not move');
  move(4.8); assert.equal(f.avatar.pose, 'run'); assert.equal(f.avatar.blend, null);
  intent.run = false; move(2.4); assert.equal(f.avatar.pose, 'walk', 'releasing Shift must affect the next pose');
  intent.run = true; move(2.0); assert.equal(f.avatar.pose, 'run', 'Shift must select run even during a slow contact');
  intent.moving = false; move(0); assert.equal(f.avatar.pose, 'idle', 'releasing movement must not wait for a stop timer');
  intent.moving = true; for (let n = 0; n < 20; n++) move(4.8);
  const beforeWall = run.time;
  for (let n = 0; n < 4; n++) move(0);
  assert.equal(f.avatar.pose, 'run'); assert.equal(run.time, beforeWall);
  move(0); assert.equal(f.avatar.pose, 'idle', 'a sustained wall stop must settle within 0.1 seconds');
  assert.equal(run.time, beforeWall);
});

test('pause, scope exit, Travel and train return discard old stride references without changing legacy land rules', async () => {
  const f = await avatarFixture(), intent = {x: 0, z: -1, run: true, moving: true};
  f.character.speed = 4.8; f.update(0, {walkingIntent: intent});
  f.character.previous = {...f.character.position}; f.character.position.z -= .08; f.update(STEP, {walkingIntent: intent});
  const run = f.avatar.actions.get('run'), time = run.time, root = f.avatar.root.position.clone();
  for (let n = 0; n < 3; n++) f.update(2, {frozen: true, walkingIntent: null});
  assert.equal(run.time, time); assert.deepEqual(f.avatar.root.position, root);
  f.character.previous = {...f.character.position}; f.character.position.z -= .08; f.update(STEP, {walkingIntent: intent});
  assert.ok(Math.abs(run.time - time - STEP) < 1e-7, 'resuming must not count paused wall time as movement');
  f.character.speed = 2; f.update(STEP, {walkingIntent: null});
  assert.equal(f.avatar.pose, 'walk', 'ordinary land keeps the previous actual-speed gait rule');
  assert.equal(f.avatar.stairStridePoint, null);
  f.character.position.x += 50; f.character.previous = {...f.character.position};
  f.update(STEP, {walkingIntent: intent});
  assert.equal(run.getEffectiveTimeScale(), 0, 'reentering the scope cannot replay a distant old point');
  f.avatar.resetPose('idle'); f.character.position.x += 50; f.character.previous = {...f.character.position};
  f.update(STEP, {walkingIntent: intent}); assert.equal(run.getEffectiveTimeScale(), 0, 'Travel starts with a fresh stride reference');
  const mount = new THREE.Group(); f.scene.add(mount);
  f.update(STEP, {player: {onLand: true, ridingTrain: true, train: {position: {...f.character.position}}}, trainVisual: {mountPoint: mount}});
  assert.equal(f.avatar.pose, 'sit'); assert.equal(f.avatar.stairStridePoint, null); assert.equal(f.avatar.root.parent, mount);
  f.character.speed = 0; f.update(0, {frozen: true, walkingIntent: null});
  assert.equal(f.avatar.pose, 'idle'); assert.equal(f.avatar.root.parent, f.scene);
  assert.deepEqual(f.avatar.root.position.toArray(), [f.character.position.x, f.character.position.y, f.character.position.z]);
  f.character.speed = 4.8; f.update(STEP, {walkingIntent: intent});
  assert.equal(f.avatar.pose, 'run'); assert.equal(run.getEffectiveTimeScale(), 0);
});
