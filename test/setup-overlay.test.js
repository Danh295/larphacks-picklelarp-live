import test from 'node:test';
import assert from 'node:assert/strict';
import { viewFor } from '../src/ui/setup-overlay.js';
import { createSetupStub } from '../src/ui/setup-stub.js';

test('viewFor: per-phase defaults and flags', () => {
  assert.equal(viewFor({ phase: 'WAITING', progress: 0, message: '' }).text, 'STEP INTO FRAME');
  const r = viewFor({ phase: 'READY', progress: 0.4, message: '' });
  assert.ok(r.ring && r.figure);
  const a = viewFor({ phase: 'ALIGN', progress: 0.4, message: '' });
  assert.ok(!a.ring && !a.figure);
});

test('viewFor: message overrides default text', () => {
  assert.equal(viewFor({ phase: 'READY', progress: 0, message: 'ARMS HIGHER' }).text, 'ARMS HIGHER');
});

test('viewFor: calibrate countdown stays within 1..2', () => {
  assert.equal(viewFor({ phase: 'CALIBRATE', progress: 0 }).countdown, 2);
  assert.equal(viewFor({ phase: 'CALIBRATE', progress: 0.99 }).countdown, 1);
  assert.equal(viewFor({ phase: 'CALIBRATE', progress: 1 }).countdown, 1);
  assert.equal(viewFor({ phase: 'READY', progress: 0.5 }).countdown, null);
});

test('viewFor: clamps progress, tolerates junk', () => {
  assert.equal(viewFor({ phase: 'READY', progress: 7 }).progress, 1);
  assert.equal(viewFor(null).phase, 'WAITING');
});

test('stub cycles through every phase in order and loops', () => {
  const s = createSetupStub();
  const seen = [];
  for (let t = 0; t < 16000; t += 100) {
    const p = s.update(null, t).phase;
    if (seen[seen.length - 1] !== p) seen.push(p);
  }
  assert.deepEqual(seen, ['WAITING', 'ALIGN', 'READY', 'CALIBRATE', 'LIVE', 'WAITING']);
});

test('viewFor: the raise-hand step has no countdown, shows an arrow and says which hand', () => {
  const r = viewFor({ phase: 'CALIBRATE', stage: 'raise', progress: 0.3, message: 'Raise your paddle hand above your head' });
  assert.equal(r.countdown, null);
  assert.equal(r.arrow, true);
  assert.equal(r.ring, true);
  assert.match(r.sub, /swing with/i);
  const still = viewFor({ phase: 'CALIBRATE', stage: 'still', progress: 0.3, message: '' });
  assert.equal(still.arrow, false);
  assert.equal(still.countdown, 2);
});

test('viewFor: step label counts 1..4 so the player knows how long setup takes', () => {
  const lbl = s => viewFor(s).stepLabel;
  assert.equal(lbl({ phase: 'WAITING' }), 'STEP 1 OF 4');
  assert.equal(lbl({ phase: 'ALIGN' }), 'STEP 1 OF 4');
  assert.equal(lbl({ phase: 'READY' }), 'STEP 2 OF 4');
  assert.equal(lbl({ phase: 'CALIBRATE', stage: 'still' }), 'STEP 3 OF 4');
  assert.equal(lbl({ phase: 'CALIBRATE', stage: 'raise' }), 'STEP 4 OF 4');
  assert.equal(lbl({ phase: 'LIVE' }), '');
});

test('viewFor: the framing outline shows only while waiting/aligning', () => {
  const o = p => viewFor({ phase: p }).outline;
  assert.equal(o('WAITING'), true);
  assert.equal(o('ALIGN'), true);
  assert.equal(o('READY'), false);
  assert.equal(o('CALIBRATE'), false);
  assert.equal(o('LIVE'), false);
});

test('viewFor: a missing stage during CALIBRATE falls back to the still step (older setup results)', () => {
  const r = viewFor({ phase: 'CALIBRATE', progress: 0 });
  assert.equal(r.countdown, 2);
  assert.equal(r.arrow, false);
  assert.equal(r.stepLabel, 'STEP 3 OF 4');
});
