import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, step } from '../src/fx/ball.js';

function fly(wrist, W, H, dt) {
  const b = launch(wrist, W, H);
  const ys = [b.y];
  let t = 0;
  while (!b.dead && t < 6) { step(b, dt); ys.push(b.y); t += dt; }
  return { b, ys, t, wrist };
}

const cases = [];
for (const W of [1280, 1920]) for (const H of [720, 1080]) for (const dt of [1 / 120, 1 / 60, 1 / 30, 0.05]) {
  for (const wrist of [{ x: 100, y: 100 }, { x: 640, y: 360 }, { x: W - 50, y: H - 20 }, { x: W / 2, y: H - 5 }, { x: 5, y: 5 }, { x: W * 0.8, y: H * 0.9 }]) {
    cases.push({ W, H, dt, wrist });
  }
}

test('the ball never goes below its launch height, for any wrist position, size or frame rate', () => {
  for (const c of cases) {
    const { ys } = fly(c.wrist, c.W, c.H, c.dt);
    assert.ok(Math.max(...ys) <= c.wrist.y + 1e-9, `y went below launch for ${JSON.stringify(c)}`);
  }
});

test('the ball rises first, then ends within 3 seconds', () => {
  for (const c of cases) {
    const { ys, t } = fly(c.wrist, c.W, c.H, c.dt);
    assert.ok(Math.min(...ys) < c.wrist.y - 80, `apex not at least 80 px above launch for ${JSON.stringify(c)}`);
    assert.ok(t < 3, `ball still alive after ${t}s for ${JSON.stringify(c)}`);
  }
});

test('the ball travels toward the far side of the frame', () => {
  const W = 1280, H = 720;
  const right = launch({ x: 1000, y: 400 }, W, H), left = launch({ x: 200, y: 400 }, W, H);
  assert.ok(right.vx < 0, 'wrist on the right launches leftward');
  assert.ok(left.vx > 0, 'wrist on the left launches rightward');
});

test('launch ignores everything but the wrist position (always the same arc shape)', () => {
  const a = launch({ x: 300, y: 400 }, 1280, 720), b = launch({ x: 300, y: 400 }, 1280, 720);
  assert.equal(a.vy, b.vy);
  assert.equal(a.vx, b.vx);
  assert.equal(launch.length, 3, 'launch(wrist, W, H) takes no velocity argument');
});
