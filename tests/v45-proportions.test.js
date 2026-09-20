import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {createJackProportionSampler} from '../scripts/jack-proportion-metrics.mjs';

async function fixture(pose) {
  const bytes = await fs.readFile(new URL('../static/models/jack.glb', import.meta.url));
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '',
  );
  const mixer = new THREE.AnimationMixer(gltf.scene), clip = gltf.animations.find(c => c.name === pose);
  assert.ok(clip, `exported ${pose} animation exists`);
  mixer.clipAction(clip).play();
  const sample = createJackProportionSampler(gltf.scene);
  return {clip, at(time) { mixer.setTime(time); return sample(); }};
}

function between(value, lower, upper, label) {
  assert.ok(Number.isFinite(value), `${label}: actual skin slice must exist`);
  assert.ok(value >= lower && value <= upper, `${label}: ${value}, expected ${lower}–${upper}`);
}

test('Decoded skin has the shorter 2.2-head silhouette, independently of metadata', async () => {
  const character = await fixture('idle'), m = character.at(0);
  between(m.height, 1.195, 1.205, 'actual standing height');
  between(m.headsTall, 2.15, 2.25, 'crown-to-chin head proportion');
  between(m.headHeight, .532, .554, 'actual crown-to-chin height');
  between(m.footY, -.001, .003, 'standing sole datum');
  for (const [region, count] of Object.entries(m.triangleCounts)) assert.ok(count > 100, `${region} sampled its real geometry`);
});

test('V4.5 neutral sleeves and hands leave the reference gaps on both sides', async () => {
  const character = await fixture('idle'), m = character.at(0);
  for (const [side, metrics] of Object.entries(m.sides)) {
    const waist = metrics.waist.find(section => section.offset === .05);
    between(waist.gap, .015, .030, `${side} sleeve-to-waist gap`);
    between(metrics.hand.gap, .040, .070, `${side} palm/thumb-to-pants gap`);
    assert.ok(waist.innerIntersections > 8 && waist.outerIntersections > 8, `${side} full waist cross-sections`);
    assert.ok(metrics.hand.innerIntersections > 8 && metrics.hand.outerIntersections > 8, `${side} full palm/pants cross-sections`);
  }
});

for (const pose of ['walk', 'run']) test(`V4.5 ${pose} keeps actual elbows and waist-side sleeves outside the body`, async () => {
  const character = await fixture(pose);
  // Sample between the animation's authored keys as well as its stride extrema.
  for (let frame = 0; frame <= 48; frame++) {
    const time = character.clip.duration * frame / 48, m = character.at(time);
    for (const [side, metrics] of Object.entries(m.sides)) {
      const label = `${pose} ${side} at ${time.toFixed(4)}s`;
      assert.ok(metrics.elbowOutward > .020, `${label}: elbow folds inward (${metrics.elbowOutward})`);
      assert.ok(metrics.handOutward > .015, `${label}: hand crosses toward the body (${metrics.handOutward})`);
      const waist = metrics.waist.find(section => section.offset === .05);
      // Moving arms need not preserve the precise idle gap. A 1mm tolerance
      // covers quantization/cloth rounding while rejecting visible penetration.
      between(waist.gap, -.001, .120, `${label} deformed sleeve/waist separation`);
    }
  }
});
