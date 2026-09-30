import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {EstateSportPose} from '../sources/world/estate-sport-pose.js';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
async function fixture(clip = 'idle') {
  const doc = await io.read(fileURLToPath(new URL('../static/models/jack-imported.glb', import.meta.url)));
  for (const material of doc.getRoot().listMaterials()) material.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null).setEmissiveTexture(null).setOcclusionTexture(null);
  for (const texture of [...doc.getRoot().listTextures()]) texture.dispose();
  for (const extension of doc.getRoot().listExtensionsUsed()) if (extension.extensionName === 'EXT_meshopt_compression') extension.dispose();
  const bytes = await io.writeBinary(doc);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const root = new THREE.Group(), model = gltf.scene; root.add(model); root.updateMatrixWorld(true);
  const pose = new EstateSportPose(model, root);
  const mixer = new THREE.AnimationMixer(model); mixer.clipAction(gltf.animations.find(item => item.name === clip)).play();
  const updateBase = () => {pose.restore(); mixer.update(1 / 60); for (const bone of Object.values(pose.bones)) bone.quaternion.normalize();};
  return {root, model, pose, mixer, updateBase};
}

for (const kind of ['tennis', 'golf']) test(`actual Jack ${kind} arms and props stay inside anatomical reach through the full stroke`, async () => {
  const f = await fixture();
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 4]) for (let index = 0; index <= 20; index++) {
    f.root.position.set(8, .85, -40); f.root.rotation.y = yaw;
    f.updateBase();
    const bones = Object.values(f.pose.bones), positions = bones.map(bone => bone.position.clone()), scales = bones.map(bone => bone.scale.clone());
    f.pose.apply({kind, phase: 'swing', swing: index / 20});
    f.root.updateMatrixWorld(true); f.model.traverse(mesh => {if (mesh.isSkinnedMesh) mesh.skeleton.update();});
    for (const side of ['Left', 'Right']) {
      const contact = f.pose.contacts[side], target = f.root.localToWorld(new THREE.Vector3(...contact.target));
      assert.ok(contact.error < 1e-5, 'Palm anchor stays on the prop grip.');
      assert.ok(contact.reach - contact.requested > .035, 'Elbows retain a natural bend, rather than stretched or locked arms.');
      assert.ok(f.pose.skinPalm(side).distanceTo(target) < .012, 'The actual visible hand stays around the handle.');
    }
    bones.forEach((bone, i) => {
      assert.ok(bone.position.distanceTo(positions[i]) < 1e-9, `${bone.name} must not translate.`);
      assert.ok(bone.scale.distanceTo(scales[i]) < 1e-9, `${bone.name} must not stretch.`);
    });
    const local = f.pose.getContactPoint(new THREE.Vector3(), false);
    assert.ok(f.root.localToWorld(local).distanceTo(f.pose.getContactPoint()) < 1e-8, 'Contact follows character world position and yaw.');
  }
  f.pose.dispose();
});

test('sport overlay is frozen-frame idempotent, preserves walking legs, and restores the neutral mixer pose', async () => {
  const f = await fixture('walk');
  for (const kind of ['tennis', 'golf']) {
    f.updateBase();
    const before = Object.fromEntries(Object.entries(f.pose.bones).map(([name, bone]) => [name, bone.quaternion.clone()]));
    f.pose.apply({kind, phase: 'swing', swing: .55});
    const applied = Object.fromEntries(Object.entries(f.pose.bones).map(([name, bone]) => [name, bone.quaternion.clone()]));
    const contact = f.pose.getContactPoint();
    for (let repeat = 0; repeat < 30; repeat++) f.pose.apply({kind, phase: 'swing', swing: .55});
    for (const [name, bone] of Object.entries(f.pose.bones)) {
      assert.ok(1 - Math.abs(bone.quaternion.dot(applied[name])) < 1e-9, 'Paused renders do not accumulate the pose.');
      if (/Hips|UpLeg|Leg|Foot/.test(name)) assert.ok(1 - Math.abs(bone.quaternion.dot(before[name])) < 1e-9, 'Existing locomotion drives the lower body.');
    }
    assert.ok(contact.distanceTo(f.pose.getContactPoint()) < 1e-8, 'Paused equipment has no motion.');
    f.pose.reset();
    for (const [name, bone] of Object.entries(f.pose.bones)) assert.ok(1 - Math.abs(bone.quaternion.dot(before[name])) < 1e-9, `${name} restores after leaving practice.`);
    assert.equal(f.pose.props.visible, false);
  }
  const props = f.pose.props; f.pose.dispose(); assert.equal(props.parent, null);
});
