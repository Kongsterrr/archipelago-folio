import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {directionLabel} from '../sources/core/direction.js';
import {syncInteractionMarkers} from '../sources/core/interaction-markers.js';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

test('decorative arrows and Unicode toolbar glyphs are absent from the visible shell and UI copy', () => {
  const forbidden = ['↗','↘','↙','↖','↑','↓','←','→','⤴','✦','☰','▤','♫','♪','⚙','⚑','⟳','▶','◀','✉','♬'];
  for (const file of ['../sources/index.html','../sources/main.js']) {
    const text = source(file);
    for (const glyph of forbidden) assert.equal(text.includes(glyph), false, `${glyph} remains in ${file}`);
  }
});

test('cargo and lighthouse puzzle symbols remain available as gameplay clues', () => {
  const config = source('../sources/config.js');
  const main = source('../sources/main.js');
  for (const shape of ['●','▲','■']) assert.ok(config.includes(shape), `missing cargo clue ${shape}`);
  for (const symbol of ['≈','★','◒']) assert.ok(config.includes(symbol), `missing lighthouse clue ${symbol}`);
  assert.match(main, /Circle\s+·\s+▲ Triangle\s+·\s+■ Square/);
});

test('interaction markers show for only the selected, active action', () => {
  const actionA = {}, actionB = {};
  const markers = [
    {action:actionA,marker:{visible:true}},
    {action:actionB,marker:{visible:true}},
  ];
  syncInteractionMarkers(markers, actionB);
  assert.deepEqual(markers.map(entry=>entry.marker.visible), [false,true]);
  syncInteractionMarkers(markers, null);
  assert.deepEqual(markers.map(entry=>entry.marker.visible), [false,false]);
});

test('interaction markers hide during paused and on-foot states', () => {
  const action = {};
  for (const state of [{frozen:true},{walking:true}]) {
    const marker = {visible:true};
    syncInteractionMarkers([{action,marker}], action, state);
    assert.equal(marker.visible, false);
  }
});

test('challenge directions use plain language instead of rotated arrows', () => {
  assert.equal(directionLabel(0), 'ahead');
  assert.equal(directionLabel(Math.PI / 2), 'to your right');
  assert.equal(directionLabel(-Math.PI / 2), 'to your left');
  assert.equal(directionLabel(Math.PI), 'behind');
});
