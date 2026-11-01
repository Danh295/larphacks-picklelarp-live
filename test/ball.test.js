import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, step, alpha, RADIUS } from '../src/fx/ball.js';

function fly(wrist, W, H, dt) {
  const b = launch(wrist, W, H);
  const ys = [b.y];
  let t = 0;
  while (!b.dead && t < 6) { step(b, dt); ys.push(b.y); t += dt; }
  return { b, ys, t };
}

const cases = [];
for (const W of [1280, 1920]) for (const H of [720, 1080]) for (const dt of [1 / 120, 1 / 60, 1 / 30, 0.05]) {
  for (const wrist of [{ x: 100, y: 100 }, { x: 640, y: 360 }, { x: W - 50, y: H - 20 }, { x: W / 2, y: H - 5 }, { x: 5, y: 120 }, { x: W * 0.8, y: H * 0.9 }]) {
    cases.push({ W, H, dt, wrist });
  }
}

test('the ball never goes below its launch height, for any wrist position, size or frame rate', () => {
  for (const c of cases) {
    const { ys } = fly(c.wrist, c.W, c.H, c.dt);
    assert.ok(Math.max(...ys) <= c.wrist.y + 1e-9, `y went below launch for ${JSON.stringify(c)}`);
  }
});

test('the ball rises, stays on screen when the wrist is on screen, and ends in time', () => {
  for (const c of cases) {
    const { ys, t } = fly(c.wrist, c.W, c.H, c.dt);
    assert.ok(Math.min(...ys) < c.wrist.y - 55, `apex not at least 55 px above launch for ${JSON.stringify(c)}`);
    assert.ok(Math.min(...ys) >= 0, `apex went off the top of the frame for ${JSON.stringify(c)}`);
    assert.ok(t < 3, `ball still alive after ${t}s for ${JSON.stringify(c)}`);
  }
});

test('the physics matches the scripted arc: the ball lands when its planned flight time is up', () => {
  // This checks the real integration, not the clamp that forces y back to launch height.
  for (const dt of [1 / 120, 1 / 60]) {
    const b = launch({ x: 300, y: 600 }, 1280, 720);
    let t = 0;
    while (!b.dead && t < 6) { step(b, dt); t += dt; }
    assert.ok(Math.abs(t - b.flight) < 0.05, `landed at ${t}s, planned ${b.flight}s`);
  }
});

test('the ball travels toward the far side of the frame', () => {
  const W = 1280, H = 720;
  assert.ok(launch({ x: 1000, y: 400 }, W, H).vx < 0, 'wrist on the right launches leftward');
  assert.ok(launch({ x: 200, y: 400 }, W, H).vx > 0, 'wrist on the left launches rightward');
});

test('extra arguments such as a swing velocity cannot steer the ball', () => {
  const base = launch({ x: 300, y: 400 }, 1280, 720);
  const steered = launch({ x: 300, y: 400, vx: 9e3, vy: 9e3 }, 1280, 720, { vx: 9e3, vy: 9e3 });
  assert.deepEqual(steered, base);
});

test('the ball fades out at the end of its flight instead of popping', () => {
  const b = launch({ x: 300, y: 600 }, 1280, 720);
  assert.equal(alpha(b), 1);
  b.age = b.flight * 0.5;
  assert.equal(alpha(b), 1);
  b.age = b.flight * 0.95;
  assert.ok(alpha(b) < 0.3 && alpha(b) > 0);
  b.age = b.flight;
  assert.equal(alpha(b), 0);
});

test('the radius shrinks from RADIUS during flight', () => {
  const b = launch({ x: 300, y: 600 }, 1280, 720);
  assert.equal(b.r, RADIUS);
  step(b, 0.3);
  assert.ok(b.r < RADIUS && b.r > 0.5 * RADIUS);
});
