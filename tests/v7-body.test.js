import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {createV7BodySampler} from '../scripts/jack-v7-metrics.mjs';
import {measureV46Geometry} from '../scripts/jack-geometry-metrics.mjs';

// Measured from the decoded pre-V7 production GLB at 9abe9cd. Keep the fixture
// dimensions here so a regenerated model cannot silently redefine its baseline.
const BEFORE = {
  foot: [.1537400494, .1470015623, .2234687427],
  hand: [.0917203320, .0860072668, .0780053133],
  upperCoat: .3079265981, waistCoat: .2953575902,
  upperArm: [.1410988463, .1481599725],
  face: [.4496841513, .4696249462, .3795159915],
  faceSlices: [
    [.15, .3051798973, -.1405130341], [.2, .3448614452, -.1542610100],
    [.3, .4015629315, -.1729849110], [.45, .4449107095, -.1864140722],
    [.6, .4402277029, -.1840388575], [.75, .3890358525, -.1621365352],
    [.85, .3209405559, -.1329614894],
  ],
};

async function fixture(pose = 'idle') {
  const bytes = await fs.readFile(new URL('../static/models/jack.glb', import.meta.url));
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '',
  );
  const mixer = new THREE.AnimationMixer(gltf.scene), clip = gltf.animations.find(c => c.name === pose);
  assert.ok(clip, `actual GLB contains ${pose}`);
  mixer.clipAction(clip).play();
  const sample = createV7BodySampler(gltf.scene);
  return {gltf, clip, at(time) { mixer.setTime(time); return sample(); }};
}

function between(value, low, high, message) {
  assert.ok(Number.isFinite(value) && value >= low && value <= high,
    `${message}: ${value}; expected ${low}–${high}`);
}

test('V7 actual shoes are 15–20% narrower and shorter, with the original sole height', async () => {
  const m = (await fixture()).at(0);
  for (const side of ['Left', 'Right']) {
    const shoe = m.parts[`${side}Foot`];
    assert.ok(shoe.vertices > 500, 'measure the complete shoe including sole and trim');
    for (const axis of [0, 2]) between(shoe.dimensions[axis] / BEFORE.foot[axis], .80, .85, `${side} shoe axis ${axis}`);
    assert.ok(Math.abs(shoe.dimensions[1] - BEFORE.foot[1]) < .0005, 'shoe height retained');
    assert.ok(Math.abs(shoe.min[1] + .086) < .0005, 'same foot-joint-to-sole datum');
  }
});

test('V7 actual palms and thumbs are modestly smaller on all three axes', async () => {
  const m = (await fixture()).at(0);
  for (const side of ['Left', 'Right']) {
    const hand = m.parts[`${side}Hand`];
    assert.ok(hand.vertices > 200, 'sample palm and thumb geometry');
    hand.dimensions.forEach((size, axis) => between(size / BEFORE.hand[axis], .90, .95, `${side} hand axis ${axis}`));
  }
});

test('V7 broadens the upper coat while retaining the waist and slimming the upper sleeves', async () => {
  const m = (await fixture()).at(0);
  between(m.coat.upperWidth / BEFORE.upperCoat, 1.05, 1.08, 'upper coat width');
  between(m.coat.waistWidth / BEFORE.waistCoat, .995, 1.005, 'waist is not uniformly enlarged');
  for (const [side, shoulder] of Object.entries(m.shoulders)) {
    between(shoulder.upperArmWidth / BEFORE.upperArm[0], .90, .95, `${side} actual sleeve width`);
    between(shoulder.upperArmDepth / BEFORE.upperArm[1], .90, .95, `${side} actual sleeve depth`);
    assert.ok(shoulder.sleeveTriangles > 500 && shoulder.sleeveTriangles < 1600, 'identify the sleeve without including the torso');
    assert.ok(shoulder.blendedTriangles > 50, 'exercise the Chest/Arm weighted root geometry');
  }
});

test('V7 retains the actual facial shape, head scale and short standing silhouette', async () => {
  const f = await fixture(); f.at(0);
  const m = measureV46Geometry(f.gltf.scene);
  [m.face.width, m.face.height, m.face.depth].forEach((value, axis) =>
    assert.ok(Math.abs(value - BEFORE.face[axis]) < .0003, `unchanged face dimension ${axis}`));
  for (const [t, width, frontZ] of BEFORE.faceSlices) {
    const slice = m.face.slices.find(s => s.t === t);
    assert.ok(Math.abs(slice.width - width) < .0003, `face width at ${t}`);
    assert.ok(Math.abs(slice.frontZ - frontZ) < .0003, `face profile at ${t}`);
  }
  between(m.height, 1.197, 1.203, 'no added character height');
  between(m.hemToFloorFraction, .29, .32, 'short legs remain');
});

for (const pose of ['idle', 'walk', 'run', 'sit', 'helm', 'interact', 'stand']) {
  test(`V7 ${pose} preserves shoulder-root coverage from front, side and three-quarter views`, async () => {
    const f = await fixture(pose);
    // Includes interpolation between authored keys; evaluate in the moving
    // Chest frame so a torso lean cannot masquerade as changed body geometry.
    for (let frame = 0; frame <= 24; frame++) {
      const time = f.clip.duration * frame / 24, m = f.at(time);
      for (const [side, shoulder] of Object.entries(m.shoulders)) for (const slice of shoulder.slices) {
        const label = `${pose}/${side}/${time.toFixed(3)}s/${slice.offset}`;
        assert.ok(slice.sleeveIntersections > 16 && slice.coatIntersections > 16, `${label}: real surfaces intersect the shoulder band`);
        for (const projection of slice.projections) {
          assert.ok(Number.isFinite(projection.gap) && projection.gap <= -.003,
            `${label}/${projection.view}: disconnected sleeve root (${projection.gap})`);
        }
      }
    }
  });
}
