import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClipRecorder, analyzeClip, CLIP_TUNE, CAVEAT } from '../src/ui/swing-replay.js';

const MS = 1000 / 30;
// Synthetic person (pixels, shoulder width 200, torso 260). Only the right wrist moves.
function person(rw) {
  const P = Array.from({ length: 33 }, () => ({ x: 600, y: 400, v: 0.9 }));
  const set = (i, x, y) => { P[i] = { x, y, v: 0.9 }; };
  set(0, 600, 150); set(11, 500, 300); set(12, 700, 300); set(23, 530, 560); set(24, 670, 560);
  set(16, rw[0], rw[1]); set(14, (700 + rw[0]) / 2, (300 + rw[1]) / 2 + 15);
  return P;
}
const lerp = (a, b, t) => a + (b - a) * t;
// rest -> slow backswing out wide -> hold -> fast forward across -> follow-through (or stop dead)
function swingPath({ follow = true } = {}) {
  const pts = [];
  const hold = (p, n) => { for (let i = 0; i < n; i++) pts.push(p); };
  const move = (a, b, n) => { for (let i = 1; i <= n; i++) pts.push([lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n)]); };
  const REST = [740, 520], BACK = [870, 330], FRONT = [520, 420], END = [400, 500];
  hold(REST, 8); move(REST, BACK, 12); hold(BACK, 4); move(BACK, FRONT, 4);
  if (follow) move(FRONT, END, 6); else hold(FRONT, 6);
  hold(follow ? END : FRONT, 10);
  return pts;
}
function record(path, metrics) {
  const rec = createClipRecorder();
  let ev = null, i = 0;
  const fireIdx = 8 + 12 + 4 + 4 + 1; // just after the forward burst
  for (; i < path.length; i++) {
    const t = 1000 + i * MS;
    rec.push(t, person(path[i]));
    if (i === fireIdx) { ev = { type: 'swing', t, side: 'r', realMph: 20, metrics }; rec.swung(ev); }
  }
  // keep feeding idle frames past POST_MS so the clip freezes
  for (let k = 0; k < 30; k++) rec.push(1000 + (i + k) * MS, person(path[path.length - 1]));
  return { rec, ev };
}
const M = { peak: 9, disp: 1.4, elbow: 140, durationMs: 300, angleDeg: 15, wristRise: 0.1 };

test('recorder freezes one clip around a swing, after POST_MS', () => {
  const { rec, ev } = record(swingPath(), M);
  assert.equal(rec.clips().length, 1);
  const c = rec.clips()[0];
  assert.equal(c.t, ev.t);
  assert.ok(c.frames[0].t >= ev.t - CLIP_TUNE.PRE_MS);
  assert.ok(c.frames[c.frames.length - 1].t <= ev.t + CLIP_TUNE.POST_MS);
  assert.equal(c.metrics, M);
});

test('recorder keeps only the last 5 clips and ignores null poses', () => {
  const rec = createClipRecorder();
  rec.push(0, null);
  for (let s = 0; s < 7; s++) {
    const t0 = s * 5000;
    for (let i = 0; i < 20; i++) rec.push(t0 + i * MS, person([740, 520]));
    rec.swung({ t: t0 + 19 * MS, side: 'r', realMph: s });
    for (let i = 20; i < 50; i++) rec.push(t0 + i * MS, person([740, 520]));
  }
  assert.equal(rec.clips().length, 5);
  assert.equal(rec.clips()[4].mph, 6);
  assert.equal(rec.clips()[0].mph, 2);
});

test('analyzeClip returns the four chunks in order, in bounds, with contact at the speed peak', () => {
  const { rec } = record(swingPath(), M);
  const clip = rec.clips()[0];
  const ch = analyzeClip(clip);
  assert.deepEqual(ch.map(c => c.id), ['back', 'forward', 'contact', 'follow']);
  const n = clip.frames.length;
  for (const c of ch) { assert.ok(c.from >= 0 && c.to <= n - 1 && c.from <= c.to, JSON.stringify(c)); assert.ok(c.advice.length > 0); }
  assert.ok(ch[0].from <= ch[1].from && ch[1].from <= ch[2].from && ch[2].from <= ch[3].from);
  // contact lands inside the fast forward burst (BACK -> FRONT), not the slow backswing
  const wx = clip.frames[ch[2].from].P[16].x;
  assert.ok(wx < 700, `contact wrist x=${wx} should be across the body`);
});

test('contact and follow-through advice react to the data', () => {
  const full = analyzeClip(record(swingPath(), M).rec.clips()[0]);
  assert.match(full[2].advice, /good/i);
  assert.match(full[3].advice, /good follow/i);

  const bent = analyzeClip(record(swingPath(), { ...M, elbow: 80 }).rec.clips()[0]);
  assert.match(bent[2].advice, /extend/i);

  const stopped = analyzeClip(record(swingPath({ follow: false }), M).rec.clips()[0]);
  assert.match(stopped[3].advice, /follow through/i);

  const slow = analyzeClip(record(swingPath(), { ...M, peak: 3 }).rec.clips()[0]);
  assert.match(slow[1].advice, /accelerate/i);
});

test('clips without metrics and junk input do not throw', () => {
  const clip = record(swingPath(), null).rec.clips()[0];
  assert.match(analyzeClip(clip)[0].advice, /no swing metrics/i);
  assert.deepEqual(analyzeClip(null), []);
  assert.deepEqual(analyzeClip({ frames: [] }), []);
  assert.ok(CAVEAT.length > 0);
});

test('clips are tagged bad when the swing had a fault, and a bad clip outlives good ones when the buffer is full', () => {
  const BAD = { ...M, peak: 3, elbow: 80 };
  const rec = createClipRecorder();
  for (let s = 0; s < 8; s++) {
    const t0 = s * 5000;
    for (let i = 0; i < 20; i++) rec.push(t0 + i * MS, person([740, 520]));
    rec.swung({ t: t0 + 19 * MS, side: 'r', realMph: s, metrics: s === 0 ? BAD : M });
    for (let i = 20; i < 50; i++) rec.push(t0 + i * MS, person([740, 520]));
  }
  const c = rec.clips();
  assert.equal(c.length, 5);
  assert.equal(c[0].mph, 0, 'the oldest clip is the bad swing and was kept');
  assert.equal(c[0].bad, true);
  assert.ok(c.slice(1).every(x => x.bad === false), 'good swings are tagged not-bad');
  assert.deepEqual(c.map(x => x.mph), [0, 4, 5, 6, 7], 'the oldest GOOD clips were dropped first');
  assert.ok(c[0].tips.length >= 1 && typeof c[0].tips[0] === 'string');
});

test('a clip with no metrics is not marked bad and has no tips', () => {
  const rec = createClipRecorder();
  for (let i = 0; i < 20; i++) rec.push(i * MS, person([740, 520]));
  rec.swung({ t: 19 * MS, side: 'r', realMph: 5 });
  for (let i = 20; i < 50; i++) rec.push(i * MS, person([740, 520]));
  assert.equal(rec.clips()[0].bad, false);
  assert.deepEqual(rec.clips()[0].tips, []);
});

test('a pending clip still freezes on time when the pose is lost after the swing', () => {
  const rec = createClipRecorder();
  for (let i = 0; i < 20; i++) rec.push(1000 + i * MS, person([740, 520]));
  const t = 1000 + 19 * MS;
  rec.swung({ type: 'swing', t, side: 'r', realMph: 12 });
  rec.push(t + 100, null);               // pose lost, too early to freeze
  assert.equal(rec.clips().length, 0);
  rec.push(t + CLIP_TUNE.POST_MS + 50, null); // still no pose, but time is up
  assert.equal(rec.clips().length, 1);
});
