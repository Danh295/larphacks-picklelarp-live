import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSwing } from '../src/cv/swing.js';

// Synthetic person facing the camera in the mirrored display. Pixels. Shoulder width = 200 px.
// Landmark 12 (subject's right shoulder) is on the RIGHT of the display (x=700), 11 on the left (x=500).
const MS = 1000 / 30;
const CALIB = { shoulderW: 200, torso: 260, armLen: 300, dominant: 'r' };
const lerp = (a, b, t) => a + (b - a) * t;

function person({ rw, lw, dx = 0, bend = 15, v = 0.9, sx = [500, 700] }) {
  const P = Array.from({ length: 33 }, () => ({ x: 600 + dx, y: 400, v }));
  const set = (i, x, y, vis = v) => { P[i] = { x: x + dx, y, v: vis }; };
  set(0, 600, 150);                 // nose
  set(11, sx[0], 300); set(12, sx[1], 300);   // shoulders
  set(23, 530, 560); set(24, 670, 560);   // hips
  set(25, 530, 760); set(26, 670, 760); set(27, 530, 950); set(28, 670, 950);
  // right arm
  set(16, rw[0], rw[1], rw[2] ?? v);
  set(14, lerp(sx[1], rw[0], 0.5), lerp(300, rw[1], 0.5) + bend);
  // left arm
  set(15, lw[0], lw[1], lw[2] ?? v);
  set(13, lerp(sx[0], lw[0], 0.5), lerp(300, lw[1], 0.5) + bend);
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
// arc about the dominant shoulder (angle + radius interpolation), like a real swinging arm
function arc(from, to, n, extra = {}) {
  const c = [extra.sx ? extra.sx[1] : 700, 300];
  const ta = Math.atan2(from[1] - c[1], from[0] - c[0]), tb = Math.atan2(to[1] - c[1], to[0] - c[0]);
  const ra = Math.hypot(from[0] - c[0], from[1] - c[1]), rb = Math.hypot(to[0] - c[0], to[1] - c[1]);
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / n, th = lerp(ta, tb, t), rr = lerp(ra, rb, t);
    return { rw: [c[0] + Math.cos(th) * rr, c[1] + Math.sin(th) * rr], lw: REST_L, ...extra };
  });
}
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
    ...arc(BACK, FRONT, 8, extra),     // across the body on an arc about the shoulder
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

// frame index where the forward ramp (BACK -> FRONT) ends in forehand(): 10 hold + 8 ramp + 6 hold + 8 ramp
const FORWARD_END = 10 + 8 + 6 + 8;

test('fires at contact: before the follow-through, with the wrist where the hand was at the speed peak', () => {
  const det = createSwing();
  const frames = forehand();
  const wrists = [];
  let at = -1, ev = null;
  frames.forEach((f, i) => {
    const P = person(f);
    wrists.push({ x: P[16].x, y: P[16].y });
    const e = det.update(P, CALIB, 1000 + i * MS);
    if (e) { ev = e; at = i; }
  });
  assert.ok(ev, 'a swing fired');
  assert.ok(at <= FORWARD_END + 2, `fired at frame ${at}, should be by about the end of the forward ramp (${FORWARD_END})`);
  const recent = wrists.slice(Math.max(0, at - 8), at + 1);
  assert.ok(recent.some(w => w.x === ev.wrist.x && w.y === ev.wrist.y), 'the event wrist is the hand position from a recent peak frame, not an arbitrary later one');
});

test('the event carries the swing velocity: a right-to-left swing launches leftward, a left-to-right one rightward', () => {
  const right = run(forehand())[0];
  assert.ok(right.launch.vx < -300, `forehand moves right to left on screen, vx=${right.launch.vx}`);
  assert.ok(Number.isFinite(right.launch.vy));
  const mirrored = (() => {
    const det = createSwing(); let out = null;
    forehand().forEach((f, i) => {
      const e = det.update(person({ rw: REST_R, lw: [1200 - f.rw[0], f.rw[1]] }), { ...CALIB, dominant: 'l' }, 1000 + i * MS);
      if (e) out = e;
    });
    return out;
  })();
  assert.ok(mirrored.launch.vx > 300, `mirrored swing moves left to right, vx=${mirrored.launch.vx}`);
});

test('the event carries coaching metrics', () => {
  const m = run(forehand())[0].metrics;
  for (const k of ['peak', 'disp', 'durationMs', 'angleDeg', 'wristRise']) assert.ok(Number.isFinite(m[k]), `${k} is a number`);
  assert.ok(m.elbow === null || Number.isFinite(m.elbow));
  assert.ok(m.peak >= 3.5 && m.disp >= 0.5 && m.durationMs > 0);
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

test('a fast flick from rest now fires once (v3 judges speed and travel, not a backswing direction)', () => {
  const frames = [...hold(REST_R, 10), ...ramp(REST_R, FRONT, 6), ...hold(FRONT, 10)];
  assert.equal(run(frames).length, 1);
});

test('a tiny fast twitch (small travel) fires 0 times', () => {
  const frames = [...hold(REST_R, 10), ...ramp(REST_R, [REST_R[0] - 40, REST_R[1] - 10], 2), ...hold([REST_R[0] - 40, REST_R[1] - 10], 20)];
  assert.equal(run(frames).length, 0);
});

test('a side-on stance (shoulders overlapping) still fires once', () => {
  assert.equal(run(forehand({ sx: [590, 610] })).length, 1);
});

test('a moderately bent elbow swing (a real racket arm) fires once', () => {
  assert.equal(run(forehand({ bend: 45 })).length, 1);
});

test('a diagonal high-to-low swing fires once', () => {
  const HIGH = [830, 170], LOW = [560, 470];
  const frames = [...hold(REST_R, 10), ...ramp(REST_R, HIGH, 12), ...hold(HIGH, 6), ...arc(HIGH, LOW, 8), ...hold(LOW, 10)];
  assert.equal(run(frames).length, 1);
});

test('a fast swing with a sharply bent elbow fires 0 times', () => {
  assert.equal(run(forehand({ bend: 230 })).length, 0);
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

test('the same travel done slowly (a drift over 2 s) fires 0 times', () => {
  const frames = [...hold(REST_R, 10), ...ramp(REST_R, BACK, 60), ...ramp(BACK, FRONT, 60), ...hold(FRONT, 10)];
  assert.equal(run(frames).length, 0);
});

test('the debug readout explains why a swing was rejected and counts fires', () => {
  const det = createSwing();
  const frames_ = [...hold(REST_R, 5), ...ramp(REST_R, [REST_R[0] - 40, REST_R[1] - 10], 2), ...hold([REST_R[0] - 40, REST_R[1] - 10], 20)];
  frames_.forEach((f, i) => det.update(person(f), CALIB, 1000 + i * MS));
  assert.match(det.debug.reason, /too|building|waiting|slow/);
  forehand().forEach((f, i) => det.update(person(f), CALIB, 5000 + i * MS));
  assert.equal(det.debug.fired, 1);
  assert.match(det.debug.reason, /SWING!|cooldown/, 'after a fire the readout says SWING! then cooldown');
});

// A realistic forward swing: speed rises, peaks mid-swing, then falls (ease in-out), followed by a slow follow-through.
function bellSwing() {
  const N = 14;
  const c = [700, 300], ta = Math.atan2(BACK[1] - c[1], BACK[0] - c[0]), tb = Math.atan2(FRONT[1] - c[1], FRONT[0] - c[0]);
  const ra = Math.hypot(BACK[0] - c[0], BACK[1] - c[1]), rb = Math.hypot(FRONT[0] - c[0], FRONT[1] - c[1]);
  const ease = Array.from({ length: N }, (_, i) => {
    const t = (i + 1) / N, e = 0.5 - 0.5 * Math.cos(Math.PI * t), th = lerp(ta, tb, e), rr = lerp(ra, rb, e);
    return { rw: [c[0] + Math.cos(th) * rr, c[1] + Math.sin(th) * rr], lw: REST_L };
  });
  const tail = ramp(FRONT, [FRONT[0] - 25, FRONT[1] + 10], 20);
  return { frames: [...hold(REST_R, 10), ...ramp(REST_R, BACK, 14), ...hold(BACK, 8), ...ease, ...tail], peakIdx: 10 + 14 + 8 + N / 2 };
}

test('fires within a few frames of the speed peak (contact), not after the swing has died away', () => {
  const { frames, peakIdx } = bellSwing();
  const det = createSwing();
  let at = -1;
  frames.forEach((f, i) => { if (det.update(person(f), CALIB, 1000 + i * MS)) at = i; });
  assert.ok(at >= 0, 'fired');
  assert.ok(at - peakIdx <= 3, `fired ${at - peakIdx} frames after the speed peak (should be <= 3 frames, about 100 ms)`);
});

test('a fast swing that stays on one side of the body (never crosses the centerline) fires 0 times', () => {
  // arm sweeps on the dominant side only: shoulder-height out wide, down and in front of the shoulder, x stays right of the body center
  const OUT = [880, 330], DOWN = [715, 470];
  const frames = [...hold(REST_R, 10), ...arc(REST_R, OUT, 14), ...hold(OUT, 4), ...arc(OUT, DOWN, 8), ...hold(DOWN, 10)];
  assert.equal(run(frames).length, 0);
});

test('the same swing continued across the body fires once', () => {
  const OUT = [880, 330], ACROSS = [520, 430];
  const frames = [...hold(REST_R, 10), ...arc(REST_R, OUT, 14), ...hold(OUT, 4), ...arc(OUT, ACROSS, 8), ...hold(ACROSS, 10)];
  assert.equal(run(frames).length, 1);
});
