import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OneEuroFilter, LandmarkSmoother, TUNE } from '../src/cv/filter.js';

// deterministic pseudo-noise
function rng(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296 - 0.5; }
const variance = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length; };
const FPS = 30, DT = 1 / FPS;

test('filtering a noisy constant signal cuts variance by 3x or more', () => {
  const r = rng(1), f = new OneEuroFilter();
  const raw = [], out = [];
  for (let i = 0; i < 300; i++) {
    const x = 0.5 + r() * 0.01; // +-0.005 normalized jitter
    raw.push(x); out.push(f.filter(x, i * DT));
  }
  const v0 = variance(raw.slice(30)), v1 = variance(out.slice(30));
  assert.ok(v1 * 3 < v0, `variance ${v1} should be < ${v0 / 3}`);
});

test('a step input converges within 300 ms', () => {
  const f = new OneEuroFilter();
  for (let i = 0; i < 60; i++) f.filter(0.3, i * DT);
  let y = 0;
  for (let i = 0; i <= 9; i++) y = f.filter(0.7, (60 + i) * DT); // 9 frames = 300 ms
  assert.ok(Math.abs(y - 0.7) < 0.04, `y=${y} should be within 0.04 of 0.7 after 300 ms`);
});

test('a fast swing-speed ramp has small lag (beta works)', () => {
  const f = new OneEuroFilter();
  let y = 0, x = 0;
  for (let i = 0; i < 20; i++) { x = 0.2 + 1.5 * i * DT; y = f.filter(x, i * DT); } // 1.5 normalized units/s
  assert.ok(x - y < 0.03, `lag ${x - y} should be under 0.03 (about 20 ms at 1.5 units/s)`);
});

test('LandmarkSmoother: low-visibility landmark passes through raw and resets after RESET_MS', () => {
  const sm = new LandmarkSmoother(1000, 500);
  const mk = (x, v) => Array.from({ length: 33 }, () => ({ x, y: 100, v }));
  let t = 0;
  for (let i = 0; i < 10; i++) { sm.update(mk(500, 0.9), t); t += 33; }
  const low = sm.update(mk(800, 0.2), t);
  assert.equal(low[0].x, 800, 'untrusted landmark is returned raw');
  t += TUNE.RESET_MS + 50;
  sm.update(mk(800, 0.2), t);
  t += 33;
  const back = sm.update(mk(300, 0.9), t);
  assert.equal(Math.round(back[0].x), 300, 'filter restarts at the new position instead of gliding from the old one');
});

test('LandmarkSmoother: null input resets and returns null', () => {
  const sm = new LandmarkSmoother();
  assert.equal(sm.update(null, 0), null);
});
