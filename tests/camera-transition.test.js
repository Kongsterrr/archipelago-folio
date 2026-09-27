import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CameraTransition} from '../sources/core/camera-transition.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
const create = (azimuth = 0) => {
  const transition = new CameraTransition();
  transition.reset(azimuth);
  return transition;
};

test('first camera initializes without a fade or snap', () => {
  const transition = new CameraTransition();
  assert.equal(transition.active, false);
  assert.equal(transition.request(Math.PI / 4), false);
  assert.equal(transition.committedAzimuth, Math.PI / 4);
  assert.deepEqual(transition.step(1), {snap: false, hold: false, opacity: 0, finished: false});
});

test('a 180 degree turn commits only at black and completes in 0.2 seconds', () => {
  const transition = create();
  transition.request(Math.PI);
  const before = transition.step(.05);
  assert.deepEqual(before, {snap: false, hold: true, opacity: .5, finished: false});
  assert.equal(transition.committedAzimuth, 0);
  assert.deepEqual(transition.step(.05), {snap: true, hold: false, opacity: 1, finished: false});
  assert.equal(transition.committedAzimuth, Math.PI);
  assert.deepEqual(transition.step(.05), {snap: false, hold: false, opacity: .5, finished: false});
  assert.equal(transition.active, true);
  assert.deepEqual(transition.step(.05), {snap: false, hold: false, opacity: 0, finished: true});
  assert.equal(transition.active, false);
  assert.equal(transition.step(1).snap, false);
  assert.equal(transition.step(1).finished, false);
});

test('a long frame still renders one fully opaque frame before fading in', () => {
  const transition = create();
  transition.request(Math.PI);
  assert.deepEqual(transition.step(2), {snap: true, hold: false, opacity: 1, finished: false});
  assert.equal(transition.active, true);
  assert.deepEqual(transition.step(2), {snap: false, hold: false, opacity: 0, finished: true});
});

test('hidden or paused frames freeze both fade phases and never issue a snap', () => {
  const transition = create();
  transition.request(Math.PI);
  const before = transition.step(.04);
  for (let i = 0; i < 3; i++) assert.deepEqual(transition.step(10, {paused: true}), before);
  assert.equal(transition.committedAzimuth, 0);
  assert.equal(transition.step(.06).snap, true);
  assert.deepEqual(transition.step(10, {paused: true}), {snap: false, hold: false, opacity: 1, finished: false});
  transition.step(.04);
  close(transition.opacity, .6);
  transition.step(10, {paused: true});
  close(transition.opacity, .6);
  assert.equal(transition.step(.06).finished, true);
});

test('rapid precommit requests snap only the latest target without restarting the fade', () => {
  const transition = create();
  transition.request(Math.PI / 2);
  transition.step(.04);
  transition.request(Math.PI);
  transition.request(-Math.PI / 2);
  close(transition.opacity, .4);
  assert.equal(transition.committedAzimuth, 0);
  assert.equal(transition.step(.06).snap, true);
  assert.equal(transition.committedAzimuth, -Math.PI / 2);
  assert.equal(transition.step(.1).snap, false);
  assert.equal(transition.step(1).snap, false);
});

test('requesting the committed angle before black cancels all obsolete changes', () => {
  const transition = create(.3);
  transition.request(2);
  transition.step(.08);
  assert.equal(transition.request(.3 + 2 * Math.PI), false);
  assert.equal(transition.active, false);
  assert.equal(transition.committedAzimuth, .3);
  assert.deepEqual(transition.step(2), {snap: false, hold: false, opacity: 0, finished: false});
  transition.request(-2);
  assert.equal(transition.step(.1).snap, true);
  assert.equal(transition.committedAzimuth, -2);
});

test('a new target after commit reverses opacity smoothly and snaps only under black', () => {
  const transition = create();
  transition.request(Math.PI);
  transition.step(.1);
  transition.step(.04);
  close(transition.opacity, .6);
  transition.request(-Math.PI / 2);
  close(transition.opacity, .6);
  const before = transition.step(.02);
  assert.equal(before.hold, true);
  assert.equal(before.snap, false);
  close(before.opacity, .8);
  assert.equal(transition.committedAzimuth, Math.PI);
  assert.equal(transition.step(.02).snap, true);
  assert.equal(transition.committedAzimuth, -Math.PI / 2);
  assert.equal(transition.step(.1).finished, true);
});

test('requesting the committed angle during fade in does not restart the transition', () => {
  const transition = create();
  transition.request(Math.PI);
  transition.step(.1);
  transition.step(.04);
  transition.request(-Math.PI);
  assert.equal(transition.step(.06).finished, true);
  assert.equal(transition.committedAzimuth, Math.PI);
  assert.equal(transition.step(1).snap, false);
});

test('a reversed transition can be canceled against its most recently committed angle', () => {
  const transition = create();
  transition.request(Math.PI);
  transition.step(.1);
  transition.step(.03);
  transition.request(0);
  transition.step(.01);
  transition.request(-Math.PI);
  assert.equal(transition.active, false);
  assert.equal(transition.committedAzimuth, Math.PI);
  assert.deepEqual(transition.step(1), {snap: false, hold: false, opacity: 0, finished: false});
});

for (const elapsed of [.04, .1, .14]) {
  test(`reset at ${elapsed}s invalidates every pending snap and fade`, () => {
    const transition = create();
    transition.request(Math.PI);
    transition.step(Math.min(elapsed, .1));
    if (elapsed > .1) transition.step(elapsed - .1);
    transition.reset(.7);
    assert.equal(transition.active, false);
    assert.equal(transition.committedAzimuth, .7);
    assert.equal(transition.targetAzimuth, .7);
    assert.deepEqual(transition.step(2), {snap: false, hold: false, opacity: 0, finished: false});
    assert.equal(transition.request(.7), false);
    transition.request(-.7);
    assert.equal(transition.step(.1).snap, true);
    assert.equal(transition.committedAzimuth, -.7);
  });
}

test('equivalent nearest angles and subthreshold differences do not fade', () => {
  const transition = create(Math.PI - 2e-6);
  for (const angle of [-Math.PI + 2e-6, Math.PI - 2e-6 + 8 * Math.PI, Math.PI + 6e-6]) {
    assert.equal(transition.request(angle), false);
    assert.equal(transition.opacity, 0);
    assert.equal(transition.step(.1).snap, false);
  }
  assert.equal(transition.request(-Math.PI + 2e-5), true);
  assert.equal(transition.step(.1).snap, true);
});

test('requests repeated every frame do not delay the opaque snap or completion', () => {
  const transition = create();
  let snaps = 0;
  for (let frame = 0; frame < 20; frame++) {
    transition.request(Math.PI);
    const result = transition.step(.01);
    snaps += Number(result.snap);
    if (frame === 9) assert.equal(result.opacity, 1);
  }
  assert.equal(snaps, 1);
  assert.equal(transition.active, false);
  assert.equal(transition.opacity, 0);
});
