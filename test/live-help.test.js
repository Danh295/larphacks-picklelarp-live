import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLiveHelp } from '../src/ui/live-help.js';

test('the controls card shows only while LIVE, and the ? toggle hides and restores it', () => {
  const h = createLiveHelp();
  assert.equal(h.update({ phase: 'WAITING', tMs: 0 }).showCard, false);
  assert.equal(h.update({ phase: 'LIVE', tMs: 100 }).showCard, true);
  h.toggle();
  assert.equal(h.update({ phase: 'LIVE', tMs: 200 }).showCard, false);
  h.toggle();
  assert.equal(h.update({ phase: 'LIVE', tMs: 300 }).showCard, true);
});

test('nudge fires once after 8 s in LIVE with no swing, not before', () => {
  const h = createLiveHelp();
  h.update({ phase: 'LIVE', tMs: 1000 });
  assert.equal(h.update({ phase: 'LIVE', tMs: 8900 }).nudge, false, '7.9 s is too early');
  assert.equal(h.update({ phase: 'LIVE', tMs: 9000 }).nudge, true, '8 s since going LIVE');
  assert.equal(h.update({ phase: 'LIVE', tMs: 9033 }).nudge, false, 'one-shot, not every frame');
});

test('a swing resets the nudge timer', () => {
  const h = createLiveHelp();
  h.update({ phase: 'LIVE', tMs: 0 });
  h.swung(7000);
  assert.equal(h.update({ phase: 'LIVE', tMs: 9000 }).nudge, false, 'only 2 s since the swing');
  assert.equal(h.update({ phase: 'LIVE', tMs: 15000 }).nudge, true, '8 s since the swing');
});

test('nudges repeat at most once per 20 s while the player keeps missing', () => {
  const h = createLiveHelp();
  h.update({ phase: 'LIVE', tMs: 0 });
  assert.equal(h.update({ phase: 'LIVE', tMs: 8000 }).nudge, true);
  assert.equal(h.update({ phase: 'LIVE', tMs: 20000 }).nudge, false, 'only 12 s after the last nudge');
  assert.equal(h.update({ phase: 'LIVE', tMs: 28000 }).nudge, true, '20 s after the last nudge');
});

test('leaving LIVE and coming back restarts the clock, and no nudge outside LIVE', () => {
  const h = createLiveHelp();
  h.update({ phase: 'LIVE', tMs: 0 });
  assert.equal(h.update({ phase: 'WAITING', tMs: 30000 }).nudge, false);
  h.update({ phase: 'LIVE', tMs: 31000 });
  assert.equal(h.update({ phase: 'LIVE', tMs: 38000 }).nudge, false, '7 s after re-entering LIVE');
  assert.equal(h.update({ phase: 'LIVE', tMs: 39000 }).nudge, true, '8 s after re-entering LIVE');
});
