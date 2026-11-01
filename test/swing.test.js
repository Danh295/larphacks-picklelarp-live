import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSwing } from '../src/cv/swing.js';

// Synthetic person facing the camera in the mirrored display. Pixels. Shoulder width = 200 px.
// Landmark 12 (subject's right shoulder) is on the RIGHT of the display (x=700), 11 on the left (x=500).
const MS = 1000 / 30;
const CALIB = { shoulderW: 200, torso: 260, armLen: 300, dominant: 'r' };
const lerp = (a, b, t) => a + (b - a) * t;

function person({ rw, lw, dx = 0, bend = 15, v = 0.9 }) {
  const P = Array.from({ length: 33 }, () => ({ x: 600 + dx, y: 400, v }));
  const set = (i, x, y, vis = v) => { P[i] = { x: x + dx, y, v: vis }; };
  set(0, 600, 150);                 // nose
  set(11, 500, 300); set(12, 700, 300);   // shoulders
  set(23, 530, 560); set(24, 670, 560);   // hips
  set(25, 530, 760); set(26, 670, 760); set(27, 530, 950); set(28, 670, 950);
  // right arm
  set(16, rw[0], rw[1], rw[2] ?? v);
  set(14, lerp(700, rw[0], 0.5), lerp(300, rw[1], 0.5) + bend);
  // left arm
  set(15, lw[0], lw[1], lw[2] ?? v);
  set(13, lerp(500, lw[0], 0.5), lerp(300, lw[1], 0.5) + bend);
  return P;
}
const REST_R = [740, 520], REST_L = [460, 520];

// Run frames through a fresh detector; returns events. Frames are person() args.
function run(frames, { dominant = 'r', t0 = 1000 } = {}) {
  const det = createSwing();
  const events = [];
  frames.forEach((f, i) => {
    const ev = det.update(person(f), { ...CALIB, dominant }, t0 + i * MS);
    if (ev) events.push(ev);
  });
  return events;
}
const hold = (rw, n, extra = {}) => Array.from({ length: n }, () => ({ rw, lw: REST_L, ...extra }));
function ramp(from, to, n, extra = {}) {
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / n;
    return { rw: [lerp(from[0], to[0], t), lerp(from[1], to[1], t)], lw: REST_L, ...extra };
  });
}
// A full forehand: rest -> backswing out wide -> hold -> fast forward across the body -> follow-through rest.
const BACK = [870, 330];       // 0.85 shoulder-widths outboard of the right shoulder
const FRONT = [520, 420];
function forehand(extra = {}) {
  return [
    ...hold(REST_R, 10, extra),
    ...ramp(REST_R, BACK, 8, extra),
    ...hold(BACK, 6, extra),
    ...ramp(BACK, FRONT, 8, extra),    // 350 px in ~267 ms
    ...hold(FRONT, 10, extra),
    ...ramp(FRONT, REST_R, 15, extra)
  ];
}

test('a real forehand fires exactly once, on the dominant side', () => {
  const ev = run(forehand());
  assert.equal(ev.length, 1);
  assert.equal(ev[0].type, 'swing');
  assert.equal(ev[0].side, 'r');
  assert.ok(ev[0].realMph > 0 && Number.isFinite(ev[0].realMph));
  assert.ok(ev[0].power > 0 && ev[0].power <= 1);
  assert.ok(typeof ev[0].wrist.x === 'number' && typeof ev[0].wrist.y === 'number');
});

test('the mirror-image forehand fires for a left-handed player', () => {
  // Swap which arm swings and which shoulder is dominant by mirroring the whole scene about x=600.
  const det = createSwing();
  const frames = forehand();
  let n = 0;
  frames.forEach((f, i) => {
    const mir = person({ rw: REST_R, lw: [1200 - f.rw[0], f.rw[1]] });
    if (det.update(mir, { ...CALIB, dominant: 'l' }, 1000 + i * MS)) n++;
  });
  assert.equal(n, 1);
});

test('walking sideways with the arm at rest fires 0 times', () => {
  const frames = Array.from({ length: 90 }, (_, i) => ({ rw: [740 + i * 8, 520], lw: [460 + i * 8, 520], dx: i * 8 }));
  assert.equal(run(frames).length, 0);
});

test('walking sideways with the arm out wide fires 0 times', () => {
  const frames = Array.from({ length: 90 }, (_, i) => ({ rw: [870 + i * 8, 330], lw: [460 + i * 8, 520], dx: i * 8 }));
  assert.equal(run(frames).length, 0);
});

test('raising both arms straight up fires 0 times', () => {
  const frames = [
    ...hold(REST_R, 10),
    ...Array.from({ length: 10 }, (_, i) => ({ rw: [700, lerp(520, 40, (i + 1) / 10)], lw: [500, lerp(520, 40, (i + 1) / 10)] })),
    ...Array.from({ length: 20 }, () => ({ rw: [700, 40], lw: [500, 40] })),
    ...Array.from({ length: 10 }, (_, i) => ({ rw: [700, lerp(40, 520, (i + 1) / 10)], lw: [500, lerp(40, 520, (i + 1) / 10)] }))
  ];
  assert.equal(run(frames).length, 0);
});

test('fidgeting (wrist jitter and small waves) fires 0 times', () => {
  let s = 7;
  const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296 - 0.5;
  const frames = Array.from({ length: 150 }, (_, i) => ({
    rw: [740 + rnd() * 40 + Math.sin(i / 4) * 25, 520 + rnd() * 40],
    lw: [460 + rnd() * 40, 520 + rnd() * 40]
  }));
  assert.equal(run(frames).length, 0);
});

test('a full swing with the NON-dominant hand fires 0 times', () => {
  const frames = forehand().map(f => ({ rw: REST_R, lw: [1200 - f.rw[0], f.rw[1]] }));
  assert.equal(run(frames, { dominant: 'r' }).length, 0);
});

test('a fast flick with no backswing fires 0 times', () => {
  const frames = [...hold(REST_R, 10), ...ramp(REST_R, FRONT, 6), ...hold(FRONT, 10)];
  assert.equal(run(frames).length, 0);
});

test('a fast swing with a sharply bent elbow fires 0 times', () => {
  assert.equal(run(forehand({ bend: 110 })).length, 0);
});

test('low wrist visibility fires 0 times', () => {
  const frames = forehand().map(f => ({ ...f, rw: [f.rw[0], f.rw[1], 0.2] }));
  assert.equal(run(frames).length, 0);
});

test('1.5 s cooldown: two swings 0.5 s apart fire once, 2.5 s apart fire twice', () => {
  const quick = [...forehand().slice(0, 40), ...hold(REST_R, 2), ...forehand()];
  // the first forehand's follow-through is cut so the second backswing starts quickly
  assert.equal(run(quick).length, 1);
  const spaced = [...forehand(), ...hold(REST_R, 75), ...forehand()];
  assert.equal(run(spaced).length, 2);
});

test('a stale backswing expires (no fire if the forward move starts > 600 ms after it ended)', () => {
  // drift slowly back to rest (about 1 s, well under the forward-speed threshold), idle, then flick
  const frames = [...hold(REST_R, 10), ...ramp(REST_R, BACK, 8), ...hold(BACK, 6), ...ramp(BACK, REST_R, 30), ...hold(REST_R, 10), ...ramp(REST_R, FRONT, 6), ...hold(FRONT, 10)];
  assert.equal(run(frames).length, 0);
});
