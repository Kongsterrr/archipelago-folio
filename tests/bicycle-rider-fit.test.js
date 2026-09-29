import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {JackAvatar} from '../sources/world/jack.js';
import {BicycleController} from '../sources/core/bicycle.js';
import {addQuadRiderSupports} from '../sources/world/quad-rider-pose.js';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
async function loadModel(file) {
  const document = await io.read(fileURLToPath(new URL('../static/models/' + file, import.meta.url)));
  for (const material of document.getRoot().listMaterials()) {
    material.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null).setEmissiveTexture(null).setOcclusionTexture(null);
  }
  for (const texture of [...document.getRoot().listTextures()]) texture.dispose();
  for (const extension of document.getRoot().listExtensionsUsed()) if (extension.extensionName === 'EXT_meshopt_compression') extension.dispose();
  const bytes = await io.writeBinary(document);
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}

async function fixture(quality = 'high') {
  const [jack, bike] = await Promise.all([loadModel('jack-imported.glb'), loadModel(quality === 'low' ? 'low/bicycle.glb' : 'bicycle.glb')]);
  const scene = new THREE.Scene(), group = new THREE.Group(), mountPoint = new THREE.Group(), boatVisual = new THREE.Group();
  scene.add(group, boatVisual); group.add(mountPoint, bike.scene);
  // The review view clones one GLB into three independent scenes. Exercise that
  // path too: a clone's bindMatrixInverse is stale until SkinnedMesh updates.
  const avatar = new JackAvatar(scene, {loadAsync: async () => ({scene: clone(jack.scene), animations: jack.animations})});
  assert.equal(await avatar.load(), true);
  const bicycle = {group, mountPoint, model: bike.scene, position: {x: 0, y: 0, z: 0}, contactTargets: BicycleController.prototype.contactTargets};
  bike.scene.traverse(object => {if (object.userData.bicycleRig) bicycle.rig = object.userData.bicycleRig;});
  const quadBike = {group: new THREE.Group(), mountPoint: new THREE.Group(), position: {x: 0, y: 0, z: 0}};
  scene.add(quadBike.group); quadBike.group.add(quadBike.mountPoint); addQuadRiderSupports(quadBike.group);
  bicycle.steeringNode = bike.scene.getObjectByName('bicycle-steering');
  const crank = bike.scene.getObjectByName('bicycle-crank');
  const pedals = ['left', 'right'].map(side => bike.scene.getObjectByName('bicycle-pedal-' + side));
  const player = {onLand: true, ridingQuad: false, ridingBicycle: true};
  const character = {position: {x: 0, y: 0, z: 0}, previous: {x: 0, y: 0, z: 0}, yaw: 0, speed: 0, seated: false};
  function articulate(phase = 0, steering = 0) {
    crank.rotation.x = -phase; for (const pedal of pedals) pedal.rotation.x = phase;
    bicycle.steeringNode.rotation.y = steering;
  }
  function update(dt = 1 / 60, frozen = false) {
    avatar.update(dt, {player, boatVisual, quadBike, bicycle, character, alpha: 1, reduced: true, frozen});
    scene.updateMatrixWorld(true);
    scene.traverse(object => {if (object.isSkinnedMesh) object.skeleton.update();});
  }
  return {scene, avatar, bicycle, quadBike, player, character, boatVisual, group, articulate, update};
}

test('actual high and low bicycle mesh contacts fit palms and soles through a full crank cycle and handlebar turns', async () => {
  for (const quality of ['high', 'low']) {
    const f = await fixture(quality);
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 4]) {
      f.group.position.set(7, .85, -66); f.group.rotation.set(.06, yaw, -.03, 'YXZ');
      for (const steering of [-.26, 0, .26]) for (let phase = 0; phase < 12; phase++) {
        f.articulate(phase * Math.PI / 6, steering); f.update();
        const status = f.avatar.bicycleContactStatus(f.bicycle);
        for (const side of ['Left', 'Right']) {
          assert.ok(status.palms[side].error < .0001, `${side} palm contact at phase ${phase}, steering ${steering}`);
          assert.ok(status.palms[side].skinError < .012, `${side} visible hand stays on the grip`);
          assert.ok(status.soles[side].error < .0001, `${side} sole follows its own moving pedal`);
          assert.ok(status.soles[side].surfaceError < .007, `${side} shoe surface rests on the pedal`);
          assert.ok(status.palms[side].requested < status.palms[side].reach, 'Arms remain inside their anatomical reach.');
          assert.ok(status.soles[side].requested < status.soles[side].reach, 'Legs remain inside their anatomical reach.');
          const foot = new THREE.Box3().setFromPoints(f.avatar.bicyclePose.skinFoot(side).map(point => f.group.worldToLocal(point)));
          const size = foot.getSize(new THREE.Vector3());
          assert.ok(Math.max(Math.abs(foot.min.x), Math.abs(foot.max.x)) < .22, 'The entire visible foot stays beside the crank, not splayed out horizontally.');
          assert.ok(size.z > size.x * 1.12, 'The whole foot points along the bike, not sideways.');
          const knee = f.group.worldToLocal(f.avatar.bicyclePose.bones[side + 'Leg'].getWorldPosition(new THREE.Vector3()));
          assert.ok(Math.abs(knee.x) < .15, 'Knees track near the pedals, inside the compact riding silhouette.');
        }
        assert.ok(new THREE.Vector3(...status.pelvis).distanceTo(new THREE.Vector3(...f.bicycle.contactTargets().pelvis)) < .00001);
        assert.deepEqual(f.avatar.root.scale.toArray(), [1, 1, 1]);
        for (const [name, rest] of f.avatar.bicyclePose.bind) {
          assert.ok(f.avatar.bicyclePose.bones[name].position.distanceTo(rest.position) < .000001, `${name} is rotated, never stretched or translated`);
        }
      }
    }
  }
});

test('left and right shoes alternate with opposite pedals and animation freezes without a parked wobble', async () => {
  const f = await fixture(); f.articulate(Math.PI / 2, 0); f.update();
  const top = f.avatar.bicycleContactStatus(f.bicycle);
  const knee = f.avatar.bicyclePose.bones.LeftLeg.quaternion.clone();
  f.articulate(Math.PI * 1.5, 0); f.update();
  const bottom = f.avatar.bicycleContactStatus(f.bicycle);
  assert.ok((top.soles.Left.position[1] - top.soles.Right.position[1]) * (bottom.soles.Left.position[1] - bottom.soles.Right.position[1]) < 0);
  assert.ok(Math.abs(top.soles.Left.position[1] - bottom.soles.Left.position[1]) > .09);
  assert.ok(knee.angleTo(f.avatar.bicyclePose.bones.LeftLeg.quaternion) > .1, 'Knees articulate instead of moving only the foot bone.');
  const frozen = [...f.avatar.bicyclePose.bind.keys()].map(name => f.avatar.bicyclePose.bones[name].quaternion.toArray());
  for (let i = 0; i < 20; i++) f.update(1 / 60, true);
  assert.deepEqual([...f.avatar.bicyclePose.bind.keys()].map(name => f.avatar.bicyclePose.bones[name].quaternion.toArray()), frozen);
});

test('pausing commits the last crank interpolation and refits both soles without advancing animation', async () => {
  const f = await fixture(); f.articulate(.8, .15); f.update();
  const time = f.avatar.mixer.time;
  f.articulate(.95, .15); // hold() commits the current fixed-step crank angle.
  f.update(1 / 60, true);
  assert.equal(f.avatar.mixer.time, time);
  const status = f.avatar.bicycleContactStatus(f.bicycle);
  for (const side of ['Left', 'Right']) {
    assert.ok(status.soles[side].error < .0001, 'Paused feet match the committed, visible pedal position.');
    assert.ok(status.soles[side].surfaceError < .007);
    assert.ok(status.palms[side].error < .0001);
  }
});

test('cycling reuses the existing Jack and restores walking, boat and quad poses after dismount', async () => {
  const f = await fixture(); f.update(); const model = f.avatar.model;
  for (let repeat = 0; repeat < 3; repeat++) {
    f.player.ridingBicycle = false; f.update(0);
    assert.equal(f.avatar.root.parent, f.scene); assert.equal(f.avatar.pose, 'idle');
    const sole = Math.min(...f.avatar.bicyclePose.skinFoot('Left').map(point => point.y));
    assert.ok(Math.abs(sole) < .003, 'Dismounting restores the original floor pose.');
    f.player.onLand = false; f.update(0);
    assert.equal(f.avatar.root.parent, f.boatVisual); assert.equal(f.avatar.pose, 'helm');
    f.player.onLand = true; f.player.ridingQuad = true; f.update(0);
    assert.equal(f.avatar.root.parent, f.quadBike.mountPoint);
    for (const hand of Object.values(f.avatar.quadContactStatus(f.quadBike).palms)) assert.ok(hand.error < .0001);
    f.player.ridingQuad = false; f.player.ridingBicycle = true;
    f.articulate(repeat, .2); f.update(0);
    assert.equal(f.avatar.model, model); assert.equal(f.avatar.root.parent, f.bicycle.mountPoint);
    assert.equal(f.scene.getObjectsByProperty('name', 'Jack').length, 1);
    for (const hand of Object.values(f.avatar.bicycleContactStatus(f.bicycle).palms)) assert.ok(hand.error < .0001);
  }
});
