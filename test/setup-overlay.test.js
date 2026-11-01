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
