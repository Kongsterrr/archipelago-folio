import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {JackAvatar} from '../sources/world/jack.js';
import {JACK_ASSET_URL, JACK_CLIPS} from '../sources/world/jack-asset.js';

const path = new URL('../static/models/jack-imported.glb', import.meta.url);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
// Node geometry checks omit image decoding; the unmodified embedded image is
// checked independently against the user-supplied source rig below.
async function load() {
  const doc = await io.read(fileURLToPath(path));
  for (const material of doc.getRoot().listMaterials()) material.setBaseColorTexture(null);
  for (const texture of [...doc.getRoot().listTextures()]) texture.dispose();
  for (const extension of doc.getRoot().listExtensionsUsed()) if (extension.extensionName === 'EXT_meshopt_compression') extension.dispose();
  const bytes = await io.writeBinary(doc);
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}
function spec(scene) { let value; scene.traverse(o => { if (o.userData.characterSpec) value = o.userData.characterSpec; }); return value; }
function vertices(scene) {
  const result = [];
  scene.updateMatrixWorld(true);
  scene.traverse(mesh => { if (!mesh.isSkinnedMesh) return; mesh.skeleton.update(); for (let i = 0; i < mesh.geometry.getAttribute('position').count; i++) result.push({mesh, i}); });
  return result;
}
function point({mesh, i}) { return mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld); }
function updateSkin(scene) { scene.updateMatrixWorld(true); scene.traverse(mesh => { if (mesh.isSkinnedMesh) mesh.skeleton.update(); }); }

test('live avatar uses the supplied mesh and original texture with a complete local rig', async () => {
  assert.match(JACK_ASSET_URL, /jack-imported\.glb/);
  const doc = await io.read(fileURLToPath(path)), root = doc.getRoot();
  assert.equal(root.listSkins().length, 1);
  assert.equal(root.listMaterials().length, 1);
  assert.deepEqual(root.listAnimations().map(a => a.getName()), JACK_CLIPS);
  const source = await io.read(fileURLToPath(new URL('../assets/source/imported-jack/rig.glb', import.meta.url)));
  const sha = image => createHash('sha256').update(image).digest('hex');
  assert.equal(sha(root.listTextures()[0].getImage()), sha(source.getRoot().listTextures()[0].getImage()));
  const primitives = root.listMeshes().flatMap(m => m.listPrimitives());
  assert.ok(primitives.reduce((n, p) => n + p.getIndices().getCount() / 3, 0) <= 50000);
  for (const p of primitives) {
    assert.ok(p.getAttribute('TEXCOORD_0'));
    const weights = p.getAttribute('WEIGHTS_0'), joints = p.getAttribute('JOINTS_0');
    for (let i = 0; i < weights.getCount(); i++) {
      const w = [], j = []; weights.getElement(i, w); joints.getElement(i, j);
      assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < .0001);
      assert.ok(j.every(index => index >= 0 && index < root.listSkins()[0].listJoints().length));
    }
  }
});

test('decoded imported walk/run keep the feet near the ground between baked frames', async () => {
  const gltf = await load(), all = vertices(gltf.scene), feet = all.filter(v => point(v).y < .085);
  const bounds = new THREE.Box3(); for (const v of all) bounds.expandByPoint(point(v));
  assert.ok(Math.abs(bounds.min.y) < .001);
  assert.ok(Math.abs(bounds.max.y - 1.2) < .003);
  assert.ok(feet.length > 100);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  for (const name of ['walk', 'run']) {
    mixer.stopAllAction(); const clip = gltf.animations.find(c => c.name === name); mixer.clipAction(clip).play();
    for (let sample = 0; sample <= 180; sample++) {
      mixer.setTime(clip.duration * sample / 180); updateSkin(gltf.scene);
      const lowest = Math.min(...feet.map(v => point(v).y));
      assert.ok(lowest > -.001 && lowest < .025, `${name}: lowest foot ${lowest}`);
    }
  }
});

test('actual imported palms remain on the wheel through steering, pause and boarding', async () => {
  const gltf = await load(), scene = new THREE.Scene(), boatVisual = new THREE.Group(); scene.add(boatVisual);
  const avatar = new JackAvatar(scene, {loadAsync: async () => gltf}); assert.equal(await avatar.load(), true);
  const character = {position: {x: 4, y: .85, z: 4}, previous: {x: 4, y: .85, z: 4}, yaw: 0, speed: 0, seated: false};
  const player = {onLand: false};
  const update = (dt, frozen = false) => avatar.update(dt, {player, boatVisual, character, alpha: 1, reduced: false, frozen});
  const expected = {Left: new THREE.Vector3(.19303, .1615, -.21631), Right: new THREE.Vector3(.37345, .1615, -.21631)};
  function check() {
    scene.updateMatrixWorld(true);
    for (const side of ['Left', 'Right']) {
      const bone = avatar.model.getObjectByName(side + 'Hand');
      const palm = new THREE.Vector3(...avatar.spec.helmPalmAnchors[side].local).applyMatrix4(bone.matrixWorld);
      boatVisual.worldToLocal(palm);
      assert.ok(palm.distanceTo(expected[side]) < .001, `${side} palm moved ${palm.distanceTo(expected[side])}`);
    }
  }
  for (const fps of [30, 60, 120]) for (let frame = 0; frame < fps; frame++) {
    boatVisual.rotation.set(.03 * Math.sin(frame), frame * .03, .03 * Math.cos(frame));
    update(1 / fps, frame % 20 === 0); check();
  }
  for (const speed of [0, 2.4, 4]) {
    player.onLand = true; character.speed = speed; update(.2);
    assert.equal(avatar.root.parent, scene); assert.ok(avatar.ready);
    player.onLand = false; character.speed = 0; update(0, true); check();
    assert.equal(avatar.pose, 'helm'); assert.equal(avatar.root.parent, boatVisual);
  }
});

test('imported seated shins clear the existing bench front', async () => {
  const gltf = await load(), s = spec(gltf.scene), all = vertices(gltf.scene);
  const legs = all.filter(({mesh, i}) => {
    const ids = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight');
    let joint = 0; for (let k = 1; k < 4; k++) if (weights.getComponent(i, k) > weights.getComponent(i, joint)) joint = k;
    return /^(Left|Right)(Leg|Foot)$/.test(mesh.skeleton.bones[ids.getComponent(i, joint)].name);
  });
  const mixer = new THREE.AnimationMixer(gltf.scene); mixer.clipAction(gltf.animations.find(c => c.name === 'sit')).play(); mixer.setTime(.2);
  gltf.scene.position.set(0, -s.benchSeatOffset, -s.benchForwardOffset); updateSkin(gltf.scene);
  let sampled = 0;
  for (const vertex of legs) {
    const p = point(vertex); if (p.y >= 0 || p.y <= -.12) continue;
    sampled++; assert.ok(p.z < -.31, `shin intersects bench: ${p.z}`);
  }
  assert.ok(sampled > 0);
});

test('static or incomplete exports fail cleanly before becoming a playable avatar', async () => {
  const avatar = new JackAvatar(new THREE.Scene(), {loadAsync: async () => ({scene: new THREE.Group(), animations: []})});
  assert.equal(await avatar.load(), false); assert.equal(avatar.ready, false);
  assert.equal(avatar.root.children.length, 0);
});
