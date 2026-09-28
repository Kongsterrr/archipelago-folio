import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Game} from '../sources/game.js';
import content from '../sources/content.json' with {type: 'json'};
import {islands} from '../sources/config.js';
import {exhibitTarget} from '../sources/core/portfolio-navigation.js';
import {selectLandExhibit,landPrimaryAction} from '../sources/core/project-exhibits.js';

const layout = JSON.parse(fs.readFileSync(new URL('../static/models/walk-layout.json', import.meta.url))).islands.find(i => i.id === 'projects');

test('the shipped Projects overview resolves an island group instead of silently rejecting a missing story ID', () => {
  const station = layout.stations.find(s => s.directoryOverview);
  assert.ok(station, 'the harbor directory has an explicit overview action');
  const target = exhibitTarget(station, 'projects', content, islands);
  assert.equal(target.group.id, 'projects');
  assert.equal(target.island.id, 'projects');
  assert.equal(target.entry, null);
  assert.deepEqual(target.entries.map(e => e.id), ['affirmation', 'research', 'catering']);
});

test('all three clickable harbor directory rows retain their own full project destinations', () => {
  const rows = layout.stations.filter(s => s.directory);
  assert.equal(rows.length, 3);
  for (const station of rows) {
    const target = exhibitTarget(station, 'projects', content, islands);
    assert.equal(target.entry.id, station.contentId);
    assert.equal(target.group.id, 'projects');
  }
});

test('keyboard selection resolves the explicit overview regardless of clickable row order', () => {
  const stations = layout.stations.filter(s => s.directory || s.directoryOverview);
  const actions = stations.map(station => ({station, kind: station.type, distance: p => Math.hypot(p.x-station.x, p.z-station.z)}));
  const overview = actions.find(a => a.station.directoryOverview);
  for (const list of [actions, [...actions].reverse()]) {
    for (const riding of [false, true]) {
      assert.equal(selectLandExhibit(list, {x: -4.9, z: 27}, {riding}), overview);
    }
  }
});

test('summary exhibits retain legacy source-story routing and invalid IDs never pick an arbitrary story', () => {
  assert.equal(exhibitTarget({contentId: 'research'}, 'projects', content, islands).entry.id, 'research');
  assert.equal(exhibitTarget({}, 'amtrak', content, islands).entry.id, 'amtrak');
  assert.equal(exhibitTarget({}, 'projects', content, islands), null);
  assert.equal(exhibitTarget({readFull: true, contentId: 'missing'}, 'projects', content, islands), null);
});

function actionFixture(overrides = {}) {
  const calls = [];
  const game = {
    frozen: false,
    player: {walking: true, ridingQuad: false},
    canRideQuad: true,
    canBoard: false,
    nearStation: {kind: 'read', station: {readFull: true}, run: () => calls.push('read')},
    rideQuad: () => calls.push('mount'),
    dismountQuad: () => calls.push('dismount'),
    boardBoat: () => calls.push('board'),
    goAshore: () => calls.push('ashore'),
    ...overrides,
  };
  return {game, calls, pressE: () => Game.prototype.primaryAction.call(game)};
}

test('E mounts a reachable parked quad even when a complete project exhibit is also in range', () => {
  const f = actionFixture();
  assert.deepEqual(landPrimaryAction(f.game), {kind: 'mount', label: 'Ride quad bike'});
  f.pressE();
  assert.deepEqual(f.calls, ['mount']);
});

test('E reads the nearby project again once the parked quad is outside its eligible mount range', () => {
  const f = actionFixture({canRideQuad: false});
  assert.deepEqual(landPrimaryAction(f.game), {kind: 'read', label: 'View project'});
  f.pressE();
  assert.deepEqual(f.calls, ['read']);
});

test('riding E always dismounts beside an exhibit and never opens its content', () => {
  const f = actionFixture({player: {walking: false, ridingQuad: true}});
  assert.deepEqual(landPrimaryAction(f.game), {kind: 'dismount', label: 'Dismount quad bike'});
  f.pressE();
  assert.deepEqual(f.calls, ['dismount']);
});

test('the overview HUD identifies browsing and agrees with E dispatch beside the harbor sign', () => {
  const f = actionFixture({canRideQuad: false});
  f.game.nearStation.station = layout.stations.find(s => s.directoryOverview);
  assert.deepEqual(landPrimaryAction(f.game), {kind: 'read', label: 'Browse projects'});
  f.pressE();
  assert.deepEqual(f.calls, ['read']);
});

test('riding F still reads the nearby project independently of the dismount action', () => {
  const f = actionFixture({player: {walking: false, ridingQuad: true}});
  f.game.nearAction = f.game.nearStation;
  Game.prototype.interact.call(f.game);
  assert.deepEqual(f.calls, ['read']);
});

test('paused interaction cannot mount, dismount or read an overlapping exhibit', () => {
  for (const ridingQuad of [false, true]) {
    const f = actionFixture({frozen: true, player: {walking: !ridingQuad, ridingQuad}});
    f.pressE();
    assert.deepEqual(f.calls, []);
  }
});
