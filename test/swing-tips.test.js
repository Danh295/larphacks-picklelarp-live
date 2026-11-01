import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tipsFor } from '../src/cv/swing-tips.js';

// A decent swing: fast, extended-but-not-locked elbow, long path, level-to-up, waist-to-chest height, one smooth motion.
const GOOD = { peak: 9, disp: 1.4, elbow: 140, durationMs: 300, angleDeg: 15, wristRise: 0.1 };

test('a good swing gets praise, not a fault', () => {
  const t = tipsFor(GOOD);
  assert.equal(t.length, 1);
  assert.match(t[0], /great|solid|nice/i);
});

test('each fault produces its own advice', () => {
  assert.match(tipsFor({ ...GOOD, peak: 3.8 })[0], /accelerat|hips|shoulders/i);
  assert.match(tipsFor({ ...GOOD, elbow: 85 })[0], /extend|arm/i);
  assert.match(tipsFor({ ...GOOD, elbow: 176 })[0], /bend|locked/i);
  assert.match(tipsFor({ ...GOOD, disp: 0.6 })[0], /longer|path|further/i);
  assert.match(tipsFor({ ...GOOD, angleDeg: -25 })[0], /down|brush up/i);
  assert.match(tipsFor({ ...GOOD, angleDeg: 55 })[0], /flatten|upward/i);
  assert.match(tipsFor({ ...GOOD, wristRise: -1.1 })[0], /low|knees/i);
  assert.match(tipsFor({ ...GOOD, wristRise: 0.8 })[0], /high|drop/i);
  assert.match(tipsFor({ ...GOOD, durationMs: 700 })[0], /smooth|shorten|backswing/i);
});

test('at most two tips, most important first (speed before form)', () => {
  const t = tipsFor({ peak: 3, disp: 0.5, elbow: 80, durationMs: 800, angleDeg: -30, wristRise: -1.2 });
  assert.equal(t.length, 2);
  assert.match(t[0], /accelerat|hips|shoulders/i);
});

test('missing or junk metrics never throw and still give one tip', () => {
  for (const m of [undefined, null, {}, { peak: NaN }, { peak: 5, elbow: null }]) {
    const t = tipsFor(m);
    assert.ok(Array.isArray(t) && t.length >= 1 && t.every(x => typeof x === 'string' && x.length > 5), JSON.stringify(m));
  }
});
