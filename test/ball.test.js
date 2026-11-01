import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, step, alpha, RADIUS, ANGLE_MIN, ANGLE_MAX, RESTITUTION } from '../src/fx/ball.js';

const W = 1280, H = 720;
const speed = b => Math.hypot(b.vx, b.vy);
const angleUp = b => Math.atan2(-b.vy, Math.abs(b.vx)) * 180 / Math.PI;

function fly(wrist, vel, w = W, h = H, dt = 1 / 60) {
  const b = launch(wrist, vel, w, h);
  const track = [{ x: b.x, y: b.y, vx: b.vx, vy: b.vy }];
  let t = 0;
  while (!b.dead && t < 6) { step(b, dt); track.push({ x: b.x, y: b.y, vx: b.vx, vy: b.vy }); t += dt; }
  return { b, track, t };
}

test('the ball leaves in the direction the arm moved', () => {
  assert.ok(launch({ x: 600, y: 400 }, { vx: 2000, vy: -300 }, W, H).vx > 0, 'rightward swing');
  assert.ok(launch({ x: 600, y: 400 }, { vx: -2000, vy: -300 }, W, H).vx < 0, 'leftward swing');
});

test('a harder swing sends the ball faster, up to a cap', () => {
  const slow = launch({ x: 600, y: 400 }, { vx: 1000, vy: -200 }, W, H);
  const fast = launch({ x: 600, y: 400 }, { vx: 2200, vy: -200 }, W, H);
  assert.ok(speed(fast) > speed(slow) * 1.5, `fast ${speed(fast)} vs slow ${speed(slow)}`);
  const huge = launch({ x: 600, y: 400 }, { vx: 90000, vy: 0 }, W, H);
  assert.ok(speed(huge) <= 2600 * (H / 720) + 1, 'speed is capped');
});

test('the launch angle is clamped: a downward-moving wrist still launches up, a vertical one is not a straight-up lob', () => {
  const down = launch({ x: 600, y: 300 }, { vx: 1500, vy: 1800 }, W, H);
  assert.ok(angleUp(down) >= ANGLE_MIN - 0.01, `angle ${angleUp(down)} >= ${ANGLE_MIN}`);
  assert.ok(down.vy < 0, 'moves upward');
  const steep = launch({ x: 600, y: 300 }, { vx: 600, vy: -2500 }, W, H);
  assert.ok(angleUp(steep) <= ANGLE_MAX + 0.01, `angle ${angleUp(steep)} <= ${ANGLE_MAX}`);
});

test('a nearly vertical swing falls back to the far side of the frame', () => {
  assert.ok(launch({ x: 1000, y: 400 }, { vx: 10, vy: -2000 }, W, H).vx < 0, 'wrist on the right -> leftward');
  assert.ok(launch({ x: 200, y: 400 }, { vx: -10, vy: -2000 }, W, H).vx > 0, 'wrist on the left -> rightward');
});

test('a ball ALWAYS spawns with finite numbers, even with no or junk velocity', () => {
  for (const vel of [undefined, null, {}, { vx: NaN, vy: NaN }, { vx: 0, vy: 0 }, { vx: 3, vy: -2 }, { vx: Infinity, vy: 1 }]) {
    const b = launch({ x: 640, y: 360 }, vel, W, H);
    for (const k of ['x', 'y', 'vx', 'vy']) assert.ok(Number.isFinite(b[k]), `${k} finite for ${JSON.stringify(vel)}`);
    assert.ok(speed(b) > 300, `visible speed for ${JSON.stringify(vel)}`);
    assert.ok(b.vy < 0, 'moves up');
    assert.equal(b.dead, false);
  }
});

test('the ball always starts inside the frame, even for a wrist at or past the edge', () => {
  for (const wrist of [{ x: -50, y: -50 }, { x: W + 80, y: H + 80 }, { x: 0, y: H }, { x: NaN, y: NaN }, undefined]) {
    const b = launch(wrist, { vx: 1500, vy: -300 }, W, H);
    assert.ok(b.x >= RADIUS && b.x <= W - RADIUS, `x=${b.x}`);
    assert.ok(b.y >= RADIUS && b.y <= H - RADIUS, `y=${b.y}`);
  }
});

test('the ball never goes below the floor, bounces instead, and ends within 4 seconds', () => {
  for (const wrist of [{ x: 100, y: 100 }, { x: 640, y: 360 }, { x: 1200, y: 650 }, { x: 640, y: 700 }]) {
    for (const vel of [{ vx: 2000, vy: 600 }, { vx: -1800, vy: -200 }, { vx: 900, vy: 1500 }, { vx: 0, vy: 0 }]) {
      for (const dt of [1 / 120, 1 / 60, 1 / 30, 0.05]) {
        const { b, track, t } = fly(wrist, vel, W, H, dt);
        assert.ok(Math.max(...track.map(p => p.y)) <= b.floor + 1e-6, `below floor for ${JSON.stringify({ wrist, vel, dt })}`);
        assert.ok(t < 4, `still alive at ${t}s`);
      }
    }
  }
});

test('the bounce keeps the restitution fraction of the vertical speed (research: tennis 0.74)', () => {
  const b = launch({ x: 300, y: 200 }, { vx: 1200, vy: 0 }, W, H);      // level launch, will fall to the floor
  let before = null, after = null;
  for (let i = 0; i < 600 && !after; i++) {
    const vyBefore = b.vy, bounces = b.bounces;
    step(b, 1 / 120);
    if (b.bounces > bounces) { before = vyBefore; after = b.vy; }
  }
  assert.ok(before > 0 && after < 0, 'it hit the floor and rebounded upward');
  assert.ok(Math.abs(-after / before - RESTITUTION) < 0.08, `ratio ${-after / before} vs ${RESTITUTION}`);
});

test('the ball fades out and then dies instead of popping', () => {
  const b = launch({ x: 640, y: 300 }, { vx: 1500, vy: -300 }, W, H);
  assert.equal(alpha(b), 1);
  let sawPartial = false;
  for (let i = 0; i < 600 && !b.dead; i++) { step(b, 1 / 60); const a = alpha(b); if (a > 0 && a < 1) sawPartial = true; }
  assert.ok(sawPartial, 'alpha passed through partial values');
  assert.equal(b.dead, true);
});

test('gravity scales with the frame height so the arc looks the same at 1080p', () => {
  const small = launch({ x: 300, y: 300 }, { vx: 1500, vy: -400 }, 1280, 720);
  const big = launch({ x: 450, y: 450 }, { vx: 2250, vy: -600 }, 1920, 1080);
  assert.ok(Math.abs(big.g / small.g - 1.5) < 0.01, `g ratio ${big.g / small.g}`);
});
