// Feedback loop for "the ball fires when I move my arm toward myself" (diagnosing-bugs Phase 1).
// A seeded fuzz of synthetic non-swing motions against createSwing() (must fire 0 times) plus a recall set of
// real swings (must fire exactly once, at the forward burst). Prints per-family counts so the rate is visible.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSwing } from '../src/cv/swing.js';

const MS = 1000 / 30, TORSO = 260;
const CALIB = { dominant: 'r' };
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// synthetic person facing the camera (pixels). k scales the whole body about (600,400) (leaning toward the camera).
function person({ rw, lw = [460, 520], k = 1, bend = 15, sx = [500, 700], wv = 0.9 }) {
  const P = Array.from({ length: 33 }, () => ({ x: 600, y: 400, v: 0.9 }));
  const set = (i, x, y, v = 0.9) => { P[i] = { x, y, v }; };
  set(0, 600, 150);
  set(11, sx[0], 300); set(12, sx[1], 300);
  set(23, 530, 560); set(24, 670, 560);
  set(25, 530, 760); set(26, 670, 760); set(27, 530, 950); set(28, 670, 950);
  set(16, rw[0], rw[1], wv); set(14, lerp(sx[1], rw[0], 0.5), lerp(300, rw[1], 0.5) + bend);
  set(15, lw[0], lw[1]); set(13, lerp(sx[0], lw[0], 0.5), lerp(300, lw[1], 0.5) + bend);
  return P.map(p => ({ x: 600 + (p.x - 600) * k, y: 400 + (p.y - 400) * k, v: p.v }));
}
const hold = (p, n, x = {}) => Array.from({ length: n }, () => ({ rw: p, ...x }));
// arc about a center (the dominant shoulder): interpolate angle and radius, like a real arm swinging at arm's length
const arcAbout = (c, a, b, n, x = {}) => {
  const ta = Math.atan2(a[1] - c[1], a[0] - c[0]), tb = Math.atan2(b[1] - c[1], b[0] - c[0]);
  const ra = Math.hypot(a[0] - c[0], a[1] - c[1]), rb = Math.hypot(b[0] - c[0], b[1] - c[1]);
  return Array.from({ length: n }, (_, i) => { const t = (i + 1) / n, th = lerp(ta, tb, t), rr = lerp(ra, rb, t); return { rw: [c[0] + Math.cos(th) * rr, c[1] + Math.sin(th) * rr], ...x }; });
};
const ramp = (a, b, n, x = {}) => Array.from({ length: n }, (_, i) => { const t = (i + 1) / n; return { rw: [lerp(a[0], b[0], t), lerp(a[1], b[1], t)], ...x }; });

function fires(frames) {
  const det = createSwing(); const out = [];
  frames.forEach((f, i) => { if (det.update(person(f), CALIB, 1000 + i * MS)) out.push(i); });
  return out;
}

const N = 200;
const REST = [740, 520];

const families = {
  // hand pulled straight in toward the shoulder/chest from any direction (curl, drawing the arm in)
  'pull-in': r => {
    const ang = r() * 2 * Math.PI, R0 = 0.8 + r() * 0.4, R1 = 0.05 + r() * 0.3, n = 4 + Math.floor(r() * 6);
    const at = R => [700 + Math.cos(ang) * R * TORSO, 300 + Math.sin(ang) * R * TORSO];
    const bend = 15 + r() * 90;
    return [...hold(at(R0), 10, { bend }), ...ramp(at(R0), at(R1), n, { bend }), ...hold(at(R1), 12, { bend })];
  },
  // arm rises to the chest/face (a bicep curl) from hanging
  'curl-up': r => {
    const n = 4 + Math.floor(r() * 6), end = [700 - 60 + r() * 120, 300 + 20 + r() * 80];
    return [...hold(REST, 10), ...ramp(REST, end, n, { bend: 60 + r() * 60 }), ...hold(end, 12, { bend: 60 + r() * 60 })];
  },
  // whole upper body leans/steps toward the camera while the arm hangs
  'lean-in': r => {
    const n = 5 + Math.floor(r() * 6), kEnd = 1.15 + r() * 0.25;
    return [...hold(REST, 10), ...Array.from({ length: n }, (_, i) => ({ rw: REST, k: lerp(1, kEnd, (i + 1) / n) })), ...hold(REST, 12, { k: kEnd })];
  },
  // arm raised and dropped fast on the dominant side, repeated 1 to 3 times (never crosses the body)
  'arm-up-down': r => {
    const dx = -30 + r() * 170, lo = [700 + dx, 480 + r() * 60], hi = [700 + dx * (0.5 + r() * 0.5), 130 + r() * 130];
    const n = 4 + Math.floor(r() * 5), reps = 1 + Math.floor(r() * 3), bend = 15 + r() * 45;
    const f = [...hold(lo, 8, { bend })];
    for (let k = 0; k < reps; k++) f.push(...ramp(lo, hi, n, { bend }), ...hold(hi, 2, { bend }), ...ramp(hi, lo, n, { bend }), ...hold(lo, 2, { bend }));
    return [...f, ...hold(lo, 10, { bend })];
  },
  // hand starts near the body's centerline and sweeps outward (away from the body)
  'outward': r => {
    const a = [610 + r() * 40, 340 + r() * 60], b = [840 + r() * 70, 180 + r() * 200], n = 4 + Math.floor(r() * 6), bend = 15 + r() * 45;
    return [...hold(a, 10, { bend }), ...ramp(a, b, n, { bend }), ...hold(b, 12, { bend })];
  },
  // single-frame tracking glitch: the wrist teleports for one frame (some at low visibility), then returns
  'glitch': r => {
    const f = [...hold(REST, 25)];
    const j = 12 + Math.floor(r() * 6), ang = r() * 2 * Math.PI, d = (0.8 + r() * 0.9) * TORSO;
    f[j] = { rw: [REST[0] + Math.cos(ang) * d, REST[1] + Math.sin(ang) * d], wv: 0.45 + r() * 0.45 };
    return f;
  }
};

// recall: real swings with random geometry (forward swing 0.2 to 0.33 s, slower wind-up 0.5 to 0.9 s). The forward swing ends ACROSS the body (past the torso centerline). The wrist moves on ARCS around the shoulder at about arm's length
// (that is what a swinging arm does), unlike the straight-line "pull in". Returns { frames, forwardStart }.
function realSwing(r) {
  const sideOn = r() < 0.25, bend = 15 + r() * 40, sx = sideOn ? [590, 610] : [500, 700];
  const S = [sx[1], 300], R = (0.65 + r() * 0.25) * TORSO, D = Math.PI / 180;
  const pt = (deg, rr) => [S[0] + Math.cos(deg * D) * rr, S[1] + Math.sin(deg * D) * rr];
  const back = pt(-50 + r() * 65, R), front = pt(135 + r() * 40, R * (0.95 + r() * 0.15));
  const rest = [S[0] + 40, S[1] + 220];
  const wn = 16 + Math.floor(r() * 11), fn = 6 + Math.floor(r() * 5), pre = 10, hb = 4 + Math.floor(r() * 5);
  const x = { bend, sx };
  const frames = [...hold(rest, pre, x), ...arcAbout(S, rest, back, wn, x), ...hold(back, hb, x), ...arcAbout(S, back, front, fn, x), ...hold(front, 10, x)];
  return { frames, forwardStart: pre + wn + hb };
}

for (const [name, gen] of Object.entries(families)) {
  test(`non-swing family "${name}" fires 0 times (${N} seeded variants)`, () => {
    const r = rng(1234 + name.length);
    let bad = 0, firstBad = -1;
    for (let i = 0; i < N; i++) { if (fires(gen(r)).length) { bad++; if (firstBad < 0) firstBad = i; } }
    console.log(`  [fp-loop] ${name}: ${bad}/${N} variants fired`);
    assert.equal(bad, 0, `${bad}/${N} "${name}" variants fired (first bad variant index ${firstBad})`);
  });
}

test(`recall: ${N} real swings each fire exactly once, at the forward burst (not the windup)`, () => {
  const r = rng(99);
  let missed = 0, multi = 0, early = 0;
  for (let i = 0; i < N; i++) {
    const { frames, forwardStart } = realSwing(r);
    const at = fires(frames);
    if (at.length === 0) missed++; else if (at.length > 1) multi++;
    else if (at[0] < forwardStart) early++;
  }
  console.log(`  [fp-loop] recall: missed ${missed}, multi ${multi}, fired during windup ${early} of ${N}`);
  // swings right at the speed threshold may legitimately be judged too slow, so allow 2% misses; double fires and windup fires are never allowed
  assert.ok(missed <= N * 0.02, `missed ${missed}/${N} (allowed ${N * 0.02})`);
  assert.equal(multi + early, 0, `multi ${multi}, windup-fired ${early}`);
});
