import test from 'node:test';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {JackAvatar} from '../sources/world/jack.js';
import {QUAD_RIDER, addQuadRiderSupports} from '../sources/world/quad-rider-pose.js';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
async function fixture() {
  const document = await io.read(fileURLToPath(new URL('../static/models/jack-imported.glb', import.meta.url)));
  for (const material of document.getRoot().listMaterials()) material.setBaseColorTexture(null);
  for (const texture of [...document.getRoot().listTextures()]) texture.dispose();
  for (const extension of document.getRoot().listExtensionsUsed()) if (extension.extensionName === 'EXT_meshopt_compression') extension.dispose();
  const data = await io.writeBinary(document);
  const gltf = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
  const scene = new THREE.Scene(), group = new THREE.Group(), mountPoint = new THREE.Group(), boatVisual = new THREE.Group();
  scene.add(group, boatVisual); group.add(mountPoint); addQuadRiderSupports(group);
  const avatar = new JackAvatar(scene, {loadAsync: async () => gltf});
  assert.equal(await avatar.load(), true);
  const quadBike = {group, mountPoint, position: {x: 0, y: 0, z: 0}};
  const character = {position: {x: 0, y: 0, z: 0}, previous: {x: 0, y: 0, z: 0}, yaw: 0, speed: 0, seated: false};
  const player = {onLand: true, ridingQuad: true};
  function update(dt = 1 / 60, frozen = false) {
    avatar.update(dt, {player, boatVisual, quadBike, character, alpha: 1, reduced: true, frozen});
    scene.updateMatrixWorld(true);
    scene.traverse(mesh => {if (mesh.isSkinnedMesh) mesh.skeleton.update();});
  }
  return {scene, group, avatar, quadBike, character, player, update};
}
function skinPoints(avatar, boneName) {
  const result = [];
  avatar.model.traverse(mesh => {
    if (!mesh.isSkinnedMesh || mesh.material.transparent) return;
    const ids = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight');
    for (let i = 0; i < ids.count; i++) {
      let major = 0;
      for (let k = 1; k < 4; k++) if (weights.getComponent(i, k) > weights.getComponent(i, major)) major = k;
      if (mesh.skeleton.bones[ids.getComponent(i, major)].name === boneName) result.push(mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
    }
  });
  return result;
}

test('actual imported palms stay on ATV grips during turns, world translations and pauses', async () => {
  const f = await fixture();
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 4]) {
    f.group.position.set(31, .85, -45); f.group.rotation.y = yaw;
    for (const frozen of [false, true]) {
      f.update(1 / 30, frozen);
      for (const side of ['Left', 'Right']) {
        const palm = new THREE.Vector3(...f.avatar.spec.helmPalmAnchors[side].local).applyMatrix4(f.avatar.model.getObjectByName(side + 'Hand').matrixWorld);
        f.group.worldToLocal(palm);
        assert.ok(palm.distanceTo(new THREE.Vector3(...QUAD_RIDER.grips[side])) < .0001);
        assert.ok(f.avatar.quadPose.contacts[side].requested < f.avatar.quadPose.contacts[side].reach, 'No stretched arm bones.');
      }
    }
  }
});

test('actual seated pelvis clears the saddle and both soles meet raised foot pegs', async () => {
  const f = await fixture(); f.update();
  const pelvis = skinPoints(f.avatar, 'Hips').filter(p => Math.abs(p.x) < .1 && p.z > .04 && p.z < .2);
  assert.ok(pelvis.length > 100);
  assert.ok(Math.min(...pelvis.map(p => p.y)) >= .699, 'The shorts should sit on the saddle rather than pass through it.');
  for (const side of ['Left', 'Right']) {
    const feet = skinPoints(f.avatar, side + 'Foot');
    const peg = f.group.getObjectByName(`quad-${side.toLowerCase()}-raised-peg`);
    const box = new THREE.Box3().setFromObject(peg);
    const lowest = Math.min(...feet.map(p => p.y));
    assert.ok(Math.abs(lowest - box.max.y) < .006, `${side} sole must be supported: ${lowest} vs ${box.max.y}`);
    assert.ok(feet.filter(p => p.y < lowest + .02).every(p => p.x >= box.min.x - .01 && p.x <= box.max.x + .01 && p.z >= box.min.z - .01 && p.z <= box.max.z + .01));
  }
});

test('quad pose uses the single existing avatar and restores walking and boat grips', async () => {
  const f = await fixture(); f.update(); const original = f.avatar.model;
  for (let cycle = 0; cycle < 3; cycle++) {
    f.player.ridingQuad = false; f.player.onLand = true; f.update(0);
    assert.equal(f.avatar.root.parent, f.scene); assert.equal(f.avatar.pose, 'idle');
    const minimum = Math.min(...skinPoints(f.avatar, 'LeftFoot').map(p => p.y));
    assert.ok(Math.abs(minimum) < .003);
    f.player.onLand = false; f.update(0);
    assert.equal(f.avatar.pose, 'helm');
    f.player.onLand = true; f.player.ridingQuad = true; f.update(0);
    assert.equal(f.avatar.model, original);
    assert.equal(f.avatar.root.parent, f.quadBike.mountPoint);
    assert.equal(f.group.getObjectsByProperty('name', 'quad-chibi-footrests').length, 1);
  }
});


test('first mount after boat and walking fits both palms at the Projects harbor heading', async () => {
  for (const initialYaw of [-Math.PI / 2, Math.PI / 2, Math.PI]) {
    const f = await fixture();
    f.player.ridingQuad = false; f.player.onLand = false;
    f.update(.2);
    f.player.onLand = true; f.character.yaw = -.9; f.character.speed = 2.4;
    for (let i = 0; i < 20; i++) f.update(1 / 60);
    f.group.position.set(49, .85, 10.5); f.group.rotation.y = initialYaw;
    f.player.ridingQuad = true; f.character.speed = 0;
    f.update(0);
    for (const side of ['Left', 'Right']) {
      const palm = new THREE.Vector3(...f.avatar.spec.helmPalmAnchors[side].local).applyMatrix4(f.avatar.model.getObjectByName(side + 'Hand').matrixWorld);
      f.group.worldToLocal(palm);
      const distance = palm.distanceTo(new THREE.Vector3(...QUAD_RIDER.grips[side]));
      assert.ok(distance < .0001, `${initialYaw} ${side} grip error ${distance}`);
      const actual = f.avatar.quadContactStatus(f.quadBike).palms[side];
      assert.ok(actual.skinError < .01, `${initialYaw} ${side} actual hand mesh error ${actual.skinError}`);
    }
  }
});
