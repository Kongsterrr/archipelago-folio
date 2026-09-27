import test from 'node:test';
import assert from 'node:assert/strict';
import {updateEngineSound} from '../sources/core/engine-sound.js';

function context() {
  const volume = [], frequency = [];
  const gain = {gain: {value: 1, setTargetAtTime: (...args) => volume.push(args)}, connect() { return this; }};
  const osc = {frequency: {setTargetAtTime: (...args) => frequency.push(args)}, connect() { return gain; }, start() { this.starts = (this.starts || 0) + 1; }};
  const audio = {currentTime: 10, destination: {}, created: 0, createOscillator() { this.created++; return osc; }, createGain() { return gain; }};
  return {audio, gain, osc, volume, frequency};
}
const sailing = {enabled: true, speed: 8, frozen: false, onLand: false};

test('repeated sound on/off schedules actual GainNode volume and reuses the running engine', () => {
  const {audio, volume, osc} = context();
  let engine = null;
  for (let i = 0; i < 5; i++) {
    engine = updateEngineSound(engine, audio, sailing);
    assert.equal(volume.at(-1)[0], .0112);
    const existing = engine;
    engine = updateEngineSound(engine, audio, {...sailing, enabled: false});
    assert.deepEqual(volume.at(-1), [0, 10, .1]);
    assert.equal(engine, existing);
  }
  assert.equal(audio.created, 1);
  assert.equal(osc.starts, 1);
});

test('initial mute or unavailable AudioContext creates no engine', () => {
  const {audio} = context();
  assert.equal(updateEngineSound(null, audio, {...sailing, enabled: false}), null);
  assert.equal(audio.created, 0);
  assert.equal(updateEngineSound(null, null, sailing), null);
});

test('reading and on-foot modes mute the engine; sailing resumes its volume', () => {
  const {audio, volume} = context();
  const engine = updateEngineSound(null, audio, sailing);
  updateEngineSound(engine, audio, {...sailing, frozen: true});
  assert.equal(volume.at(-1)[0], 0);
  updateEngineSound(engine, audio, {...sailing, onLand: true});
  assert.equal(volume.at(-1)[0], 0);
  updateEngineSound(engine, audio, sailing);
  assert.ok(volume.at(-1)[0] > 0);
});

test('audio scheduling failure while muted cannot escape into rendering and can recover', () => {
  const {audio, gain, volume} = context();
  const engine = updateEngineSound(null, audio, sailing);
  const schedule = gain.gain.setTargetAtTime;
  gain.gain.setTargetAtTime = () => { throw new Error('audio device unavailable'); };
  assert.equal(updateEngineSound(engine, audio, {...sailing, enabled: false}), engine);
  gain.gain.setTargetAtTime = schedule;
  updateEngineSound(engine, audio, {...sailing, enabled: false});
  assert.equal(volume.at(-1)[0], 0);
  updateEngineSound(engine, audio, sailing);
  assert.ok(volume.at(-1)[0] > 0);
});

test('engine creation failure is isolated from the game frame', () => {
  const {audio} = context();
  audio.createOscillator = () => { throw new Error('audio device unavailable'); };
  assert.equal(updateEngineSound(null, audio, sailing), null);
});
