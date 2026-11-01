import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSetup, DEFAULT_CALIB, SETUP_TUNE } from '../src/cv/setup.js';
import { L } from '../src/cv/geometry.js';

const FR = 33; // ms per frame (about 30 fps)

// A standing person in display-space pixels (1280x720): shoulderW 110, torso 150, armLen 170, arms down.
// k scales the body around the frame center, dx shifts it sideways.
function pose({ k = 1, dx = 0, tpose = false, raise = null, v = 0.95, hide = [] } = {}) {
  const P = Array.from({ length: 33 }, () => ({ x: 640, y: 360, v }));
  const set = (i, x, y) => { P[i] = { x, y, v }; };
  set(L.NOSE, 640, 150);
  set(L.LSH, 585, 220); set(L.RSH, 695, 220);
  set(L.LHIP, 600, 370); set(L.RHIP, 680, 370);
  set(L.LKNEE, 600, 500); set(L.RKNEE, 680, 500);
  set(L.LANK, 600, 630); set(L.RANK, 680, 630);
  if (tpose) {
    set(L.LEL, 500, 220); set(L.LWR, 415, 220);
    set(L.REL, 780, 220); set(L.RWR, 865, 220);
  } else {
    set(L.LEL, 585, 305); set(L.LWR, 585, 390);
    set(L.REL, 695, 305); set(L.RWR, 695, 390);
  }
  if (raise === 'l' || raise === 'both') set(L.LWR, 585, 80);
  if (raise === 'r' || raise === 'both') set(L.RWR, 695, 80);
  for (const i of hide) P[i].v = 0.1;
  return P.map(p => ({ x: 640 + (p.x - 640) * k + dx, y: 360 + (p.y - 360) * k, v: p.v }));
}

// Feed frames from t0 for ms milliseconds. mk is a pose, null, or t => pose. Returns the last result and its time.
function run(s, mk, t0, ms) {
  let r, t = t0;
  for (; t <= t0 + ms; t += FR) r = s.update(typeof mk === 'function' ? mk(t) : mk, t);
  return { r, t: t - FR };
}
const next = t => t + FR;

function toAlign(s) { return run(s, pose(), 0, 100); }
function toReady(s) { return run(s, pose(), 0, 1100); }
function toCalibrate(s, mk = () => pose({ tpose: true })) {
  const a = toReady(s);
  return run(s, mk, next(a.t), 1700);
}
function toLive(s, side = 'r') {
  const c = toCalibrate(s);
  const still = run(s, () => pose({ tpose: true }), next(c.t), 2100);
  return run(s, () => pose({ tpose: true, raise: side }), next(still.t), 700);
}

test('WAITING with no pose; WAITING when ankles are hidden; ALIGN once ankles are visible', () => {
  const s = createSetup();
  assert.equal(s.update(null, 0).phase, 'WAITING');
  assert.equal(s.update(pose({ hide: [L.LANK, L.RANK] }), FR).phase, 'WAITING');
  assert.equal(s.update(pose(), 2 * FR).phase, 'ALIGN');
  assert.equal(s.update(null, 0).calib, null);
});

test('ALIGN needs visibility >= 0.6 on nose, shoulders, hips, ankles for 1 s', () => {
  const s = createSetup();
  const a = run(s, pose(), 0, 900);
  assert.equal(a.r.phase, 'ALIGN');
  assert.ok(a.r.progress > 0.8 && a.r.progress < 1, `progress ${a.r.progress}`);
  const b = run(s, pose(), next(a.t), 200);
  assert.equal(b.r.phase, 'READY');
});

test('ALIGN: a visibility dip below 0.6 resets the 1 s hold', () => {
  const s = createSetup();
  const a = run(s, pose(), 0, 800);
  const dip = s.update(pose({ hide: [L.LHIP] }), next(a.t));
  assert.equal(dip.phase, 'ALIGN');
  assert.equal(dip.progress, 0);
  const b = run(s, pose(), next(next(a.t)), 700); // only 0.7 s since the dip
  assert.equal(b.r.phase, 'ALIGN');
  const c = run(s, pose(), next(b.t), 400);
  assert.equal(c.r.phase, 'READY');
});

test('ALIGN: hips below knees does not advance', () => {
  const s = createSetup();
  const bad = () => { const P = pose(); P[L.LHIP].y = 560; P[L.RHIP].y = 560; return P; };
  const a = run(s, bad, 0, 2000);
  assert.equal(a.r.phase, 'ALIGN');
  assert.equal(a.r.progress, 0);
});

test('ALIGN falls back to WAITING when the ankles are lost', () => {
  const s = createSetup();
  run(s, pose(), 0, 500);
  assert.equal(s.update(pose({ hide: [L.LANK, L.RANK] }), 600).phase, 'WAITING');
});

test('READY -> CALIBRATE after a T-pose held 1.5 s', () => {
  const s = createSetup();
  const a = toReady(s);
  assert.equal(a.r.phase, 'READY');
  const b = run(s, () => pose({ tpose: true }), next(a.t), 1400);
  assert.equal(b.r.phase, 'READY');
  assert.ok(b.r.progress > 0.9 && b.r.progress < 1, `progress ${b.r.progress}`);
  const c = run(s, () => pose({ tpose: true }), next(b.t), 200);
  assert.equal(c.r.phase, 'CALIBRATE');
});

test('READY: breaking the T-pose before 1.5 s resets progress to 0', () => {
  const s = createSetup();
  const a = toReady(s);
  const b = run(s, () => pose({ tpose: true }), next(a.t), 1200);
  assert.ok(b.r.progress > 0.7);
  const broke = s.update(pose(), next(b.t));
  assert.equal(broke.phase, 'READY');
  assert.equal(broke.progress, 0);
  const c = run(s, () => pose({ tpose: true }), next(next(b.t)), 1200); // 1.2 s again, still short
  assert.equal(c.r.phase, 'READY');
});

test('READY: wrists off level by more than 0.25 shoulderW, or bent elbows, are not a T-pose', () => {
  const s = createSetup();
  const a = toReady(s);
  const low = () => { const P = pose({ tpose: true }); P[L.LWR].y += 0.3 * 110; return P; };
  assert.equal(run(s, low, next(a.t), 2000).r.progress, 0);
  const bent = () => { const P = pose({ tpose: true }); P[L.REL] = { x: 740, y: 260, v: 0.95 }; P[L.RWR] = { x: 780, y: 220, v: 0.95 }; return P; };
  const b = run(s, bent, 4000, 2000);
  assert.equal(b.r.phase, 'READY');
  assert.equal(b.r.progress, 0);
});

test('READY falls back to ALIGN when the body is no longer fully framed', () => {
  const s = createSetup();
  const a = toReady(s);
  assert.equal(s.update(pose({ tpose: true, hide: [L.NOSE] }), next(a.t)).phase, 'ALIGN');
});

test('CALIBRATE falls back to ALIGN when the body is no longer fully framed', () => {
  const s = createSetup();
  const c = toCalibrate(s);
  assert.equal(c.r.phase, 'CALIBRATE');
  assert.equal(s.update(pose({ tpose: true, hide: [L.RSH] }), next(c.t)).phase, 'ALIGN');
});

test('ALIGN requires visible knees as well as hips above knees', () => {
  const s = createSetup();
  const a = run(s, pose({ hide: [L.LKNEE] }), 0, 2000);
  assert.equal(a.r.phase, 'ALIGN');
  assert.equal(a.r.progress, 0);
});

test('CALIBRATE averages shoulderW / torso / armLen (in pixels) over 2 s still', () => {
  const s = createSetup();
  const c = toCalibrate(s, () => pose({ tpose: true, k: 1.2 }));
  assert.equal(c.r.phase, 'CALIBRATE');
  const still = run(s, () => pose({ tpose: true, k: 1.2 }), next(c.t), 2100);
  assert.equal(still.r.phase, 'CALIBRATE');
  assert.equal(still.r.calib, null, 'dominant is not known yet');
  const done = run(s, () => pose({ tpose: true, k: 1.2, raise: 'r' }), next(still.t), 700);
  assert.equal(done.r.phase, 'LIVE');
  const c2 = done.r.calib;
  assert.ok(Math.abs(c2.shoulderW - 132) < 2, `shoulderW ${c2.shoulderW}`);
  assert.ok(Math.abs(c2.torso - 180) < 2, `torso ${c2.torso}`);
  assert.ok(Math.abs(c2.armLen - 204) < 2, `armLen ${c2.armLen}`);
});

test('CALIBRATE: moving more than the still tolerance restarts the 2 s window', () => {
  const s = createSetup();
  const c = toCalibrate(s);
  const a = run(s, () => pose({ tpose: true }), next(c.t), 1500);
  const moved = () => pose({ tpose: true, dx: 0.5 * 110 });
  const b = run(s, moved, next(a.t), 600); // would have finished the window, but it restarted
  assert.equal(b.r.phase, 'CALIBRATE');
  assert.ok(b.r.progress < 0.5, `progress ${b.r.progress}`);
  // raising now must not finish calibration: the still step is not done
  const d = run(s, () => pose({ tpose: true, dx: 55, raise: 'r' }), next(b.t), 700);
  assert.equal(d.r.phase, 'CALIBRATE');
});

test('CALIBRATE: raising the left wrist sets dominant l, the right wrist sets r', () => {
  for (const side of ['l', 'r']) {
    const s = createSetup();
    const r = toLive(s, side).r;
    assert.equal(r.phase, 'LIVE', side);
    assert.equal(r.calib.dominant, side);
    assert.equal(r.progress, 1);
  }
});

test('CALIBRATE: both wrists up does not set dominant, and a short raise does not count', () => {
  const s = createSetup();
  const c = toCalibrate(s);
  const still = run(s, () => pose({ tpose: true }), next(c.t), 2100);
  const both = run(s, () => pose({ tpose: true, raise: 'both' }), next(still.t), 1500);
  assert.equal(both.r.phase, 'CALIBRATE');
  const brief = run(s, () => pose({ tpose: true, raise: 'l' }), next(both.t), 300);
  assert.equal(brief.r.phase, 'CALIBRATE');
  const drop = s.update(pose({ tpose: true }), next(brief.t));
  assert.equal(drop.phase, 'CALIBRATE');
  assert.equal(drop.progress, 0);
});

test('LIVE stays LIVE while the pose is present, even if only partly visible', () => {
  const s = createSetup();
  const l = toLive(s);
  const r = run(s, () => pose({ hide: [L.LANK, L.RANK, L.NOSE] }), next(l.t), 2000).r;
  assert.equal(r.phase, 'LIVE');
});

test('no pose for over 3 s resets to WAITING from ALIGN, READY, CALIBRATE and LIVE', () => {
  const builders = { ALIGN: toAlign, READY: toReady, CALIBRATE: s => toCalibrate(s), LIVE: s => toLive(s) };
  for (const [name, build] of Object.entries(builders)) {
    const s = createSetup();
    const a = build(s);
    assert.equal(a.r.phase, name);
    const gone = run(s, null, next(a.t), 3100);
    assert.equal(gone.r.phase, 'WAITING', `from ${name}`);
    assert.equal(gone.r.calib, null);
  }
});

test('a gap of under 3 s keeps the phase; coming back after it restarts the hold', () => {
  for (const [name, build] of Object.entries({ ALIGN: toAlign, READY: toReady, CALIBRATE: s => toCalibrate(s), LIVE: s => toLive(s) })) {
    const s = createSetup();
    const a = build(s);
    const gone = run(s, null, next(a.t), 2800);
    assert.equal(gone.r.phase, name, `during gap in ${name}`);
    const back = s.update(pose({ tpose: true }), next(gone.t));
    assert.equal(back.phase, name, `after gap in ${name}`);
  }
});

test('a person re-arms the flow after the reset', () => {
  const s = createSetup();
  const l = toLive(s);
  const gone = run(s, null, next(l.t), 3100);
  assert.equal(gone.r.phase, 'WAITING');
  const back = run(s, pose(), next(gone.t), 1200);
  assert.equal(back.r.phase, 'READY');
});

test('skip() jumps to LIVE with DEFAULT_CALIB and holds with no pose until a real person appears and leaves', () => {
  const s = createSetup();
  const skipped = s.skip(5000); // main.js assigns this return value to setupState on the L key
  assert.equal(skipped.phase, 'LIVE');
  assert.equal(skipped.progress, 1);
  assert.deepEqual(skipped.calib, DEFAULT_CALIB);
  const r = s.update(null, 5033);
  assert.equal(r.phase, 'LIVE');
  assert.deepEqual(r.calib, DEFAULT_CALIB);
  assert.equal(s.update(null, 20000).phase, 'LIVE', 'forced LIVE does not time out in an empty room');
  assert.equal(s.update(pose(), 21000).phase, 'LIVE', 'a person appearing keeps LIVE');
  const gone = run(s, null, 21033, 3100);
  assert.equal(gone.r.phase, 'WAITING');
});

test('progress is always within 0..1 and thresholds are exported', () => {
  const s = createSetup();
  let t = 0;
  const frames = [
    () => pose(), () => pose({ tpose: true }), () => pose({ tpose: true }), () => pose({ tpose: true, raise: 'r' }), () => null
  ];
  for (let i = 0; i < 400; i++, t += FR) {
    const r = s.update(frames[Math.min(frames.length - 1, Math.floor(i / 80))](), t);
    assert.ok(r.progress >= 0 && r.progress <= 1, `progress ${r.progress} at ${t}`);
    assert.equal(typeof r.message, 'string');
  }
  assert.equal(SETUP_TUNE.TPOSE_MS, 1500);
  assert.equal(SETUP_TUNE.LOST_MS, 3000);
});
