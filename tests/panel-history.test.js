import test from 'node:test';
import assert from 'node:assert/strict';
import {PanelHistory} from '../sources/core/panel-history.js';

function view(key, state = {}) {
  return {key, render() {}, scrollTop: 0, focusIndex: 0, ...state};
}

test('directory, detail and overview return the exact prior views and saved UI state', () => {
  const history = new PanelHistory();
  const directory = view('directory:all');
  const detail = view('detail:amtrak');
  const overview = view('overview:experience');
  assert.equal(history.current, null);
  assert.equal(history.canGoBack, false);
  assert.equal(history.back(), null);

  history.visit(directory);
  directory.scrollTop = 420;
  directory.focusIndex = 6;
  history.visit(detail);
  detail.scrollTop = 180;
  detail.focusIndex = 2;
  history.visit(overview);

  assert.equal(history.canGoBack, true);
  assert.equal(history.back(), detail);
  assert.equal(history.current.scrollTop, 180);
  assert.equal(history.current.focusIndex, 2);
  assert.equal(history.back(), directory);
  assert.equal(history.current.scrollTop, 420);
  assert.equal(history.current.focusIndex, 6);
  assert.equal(history.canGoBack, false);
  assert.equal(history.back(), null);
  assert.equal(history.current, directory, 'the caller decides whether to close at the root');
});

test('a new route after Back retains predecessors without reviving the abandoned route', () => {
  const history = new PanelHistory();
  const directory = view('directory:all');
  const detail = view('detail:amtrak');
  const oldOverview = view('overview:experience');
  const newDetail = view('detail:beaconfire');
  history.visit(directory);
  history.visit(detail);
  history.visit(oldOverview);
  assert.equal(history.back(), detail);
  history.visit(newDetail);

  assert.equal(history.current, newDetail);
  assert.deepEqual(history.stack, [directory, detail]);
  assert.equal(history.back(), detail);
  assert.equal(history.back(), directory);
  assert.equal(history.back(), null);
});

test('refreshing the same route replaces its view without duplicating a Back step', () => {
  const history = new PanelHistory();
  const directory = view('directory:all');
  const original = view('detail:amtrak');
  const refreshed = view('detail:amtrak', {scrollTop: 250});
  history.visit(directory);
  history.visit(original);
  history.visit(refreshed);

  assert.equal(history.current, refreshed);
  assert.deepEqual(history.stack, [directory]);
  history.visit(view('overview:experience'));
  assert.equal(history.back(), refreshed);
  assert.equal(history.back(), directory);
});

test('replace rerenders a restored view without adding a predecessor', () => {
  const history = new PanelHistory();
  const directory = view('directory:all');
  const detail = view('detail:amtrak');
  history.visit(directory);
  history.visit(detail);
  history.visit(view('overview:experience'));
  const restored = history.back();
  history.visit(restored, {replace: true});
  assert.equal(history.current, detail);
  assert.deepEqual(history.stack, [directory]);

  // Replacement also suppresses a push when rerendering changes the route key.
  const replacement = view('detail:amtrak:results');
  history.visit(replacement, {replace: true});
  assert.equal(history.current, replacement);
  assert.deepEqual(history.stack, [directory]);
  assert.equal(history.back(), directory);
});

test('clearing and reopening isolates panel sessions', () => {
  const history = new PanelHistory();
  history.visit(view('directory:all'));
  history.visit(view('detail:amtrak'));
  history.clear();
  assert.equal(history.current, null);
  assert.deepEqual(history.stack, []);
  assert.equal(history.canGoBack, false);
  assert.equal(history.back(), null);

  const reopened = view('overview:projects');
  history.visit(reopened);
  assert.equal(history.current, reopened);
  assert.equal(history.back(), null);
  assert.equal(history.current, reopened);
});

test('history retains only the 40 most recent predecessors in their original order', () => {
  const history = new PanelHistory();
  const views = Array.from({length: 48}, (_, index) => view(`route:${index}`));
  for (const entry of views) {
    history.visit(entry);
    assert.ok(history.stack.length <= 40);
  }
  assert.equal(history.current, views[47]);
  assert.deepEqual(history.stack, views.slice(7, 47));
  for (let index = 46; index >= 7; index--) {
    assert.equal(history.back(), views[index]);
  }
  assert.equal(history.back(), null);
  assert.equal(history.current, views[7]);
});

test('the data store never invokes a view render callback', () => {
  const history = new PanelHistory();
  const render = () => assert.fail('rendering belongs to the panel');
  const directory = view('directory:all', {render});
  history.visit(directory);
  history.visit(view('detail:amtrak', {render}));
  history.visit(view('detail:amtrak', {render}));
  history.visit(history.back(), {replace: true});
  history.back();
  history.clear();
});
