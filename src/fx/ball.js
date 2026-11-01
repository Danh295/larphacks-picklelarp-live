// Broadcast ball: a 2D projectile that leaves the hand the way the arm moved.
//
// Launch: direction and strength come from the wrist's velocity at the moment of contact (swing.js reports it),
// but the result is shaped so it always looks right and never fails:
//   - speed = RATIO x hand speed, clamped to [MIN_SPEED, MAX_SPEED]
//   - launch angle is clamped to [ANGLE_MIN, ANGLE_MAX] degrees above horizontal, so a downward-moving wrist
//     still launches level/up and a vertical flick isn't a straight-up lob
//   - a (nearly) vertical swing goes toward the far side of the frame
//   - no / junk / tiny velocity falls back to a scripted arc, so a fired swing ALWAYS spawns a ball
// Flight: gravity, light drag, and a floor with a bounce (it bounces instead of "going into the ground"),
// then it fades out. Numbers come from research/ball-physics.md (restitution computed from the rebound specs;
// the 1.2 speed ratio and the angle clamp are engineering choices, not verified specs).
export const RADIUS = 22;
export const RESTITUTION = 0.74;   // tennis ball on a hard court (pickleball is about 0.64)
export const ANGLE_MIN = 10;       // degrees above horizontal (research: 3 to 15 for real tennis; 10 gives a visible arc)
export const ANGLE_MAX = 50;
export const RATIO = 1.2;          // ball speed / hand speed (unverified in the research)
export const MIN_SPEED = 700;      // px/s at 720p
export const MAX_SPEED = 2600;
const G720 = 2243;                 // 9.81 m/s^2 x about 228.6 px/m at 720p, scaled by frame height
const DRAG = 0.45;                 // 1/s, applied as v *= exp(-DRAG dt)
const MAX_BOUNCES = 2;
const FADE_S = 0.5;
const MAX_LIFE_S = 2.6;

const fin = v => Number.isFinite(v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// wrist: {x, y} display px. vel: {vx, vy} px/s (may be missing). Returns a ball to advance with step().
export function launch(wrist, vel, W, H) {
  const sc = H / 720;
  const x = clamp(wrist && fin(wrist.x) ? wrist.x : W / 2, RADIUS, W - RADIUS);
  let y = clamp(wrist && fin(wrist.y) ? wrist.y : H / 2, RADIUS, H - RADIUS);
  const floor = Math.min(H * 0.94, y + 0.28 * H);
  if (floor - y < 40 * sc) y = Math.max(RADIUS, floor - 40 * sc);

  const vx = vel && fin(vel.vx) ? vel.vx : 0;
  const vy = vel && fin(vel.vy) ? vel.vy : 0;
  const hand = Math.hypot(vx, vy);
  const far = x > W / 2 ? -1 : 1;                       // toward the far side of the frame

  let dir, ang, spd;
  if (hand < 200 * sc) {                                // no usable velocity: scripted arc
    dir = far; ang = 40; spd = 1400 * sc;
  } else {
    dir = Math.abs(vx) < 0.15 * hand ? far : Math.sign(vx);
    ang = clamp(Math.atan2(-vy, Math.abs(vx)) * 180 / Math.PI, ANGLE_MIN, ANGLE_MAX);
    spd = clamp(hand * RATIO, MIN_SPEED * sc, MAX_SPEED * sc);
  }
  const rad = ang * Math.PI / 180;
  return {
    x, y, floor, W,
    vx: dir * spd * Math.cos(rad), vy: -spd * Math.sin(rad),
    g: G720 * sc, age: 0, bounces: 0, fade: null, r: RADIUS, dead: false, trail: []
  };
}

export function step(b, dt) {
  if (b.dead) return b;
  b.age += dt;
  const d = Math.exp(-DRAG * dt);
  b.vx *= d; b.vy *= d;
  b.vy += b.g * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  if (b.y >= b.floor && b.vy > 0) {                     // hit the floor: bounce, never go through it
    b.y = b.floor;
    b.vy = -b.vy * RESTITUTION;
    b.vx *= 0.9;
    b.bounces++;
    if (b.bounces > MAX_BOUNCES && b.fade == null) b.fade = b.age;
  }
  if (b.fade == null && (b.age > MAX_LIFE_S || b.x < -3 * RADIUS || b.x > b.W + 3 * RADIUS)) b.fade = b.age;

  b.r = RADIUS * (1 - 0.25 * Math.min(1, b.age / MAX_LIFE_S));
  if (b.fade != null && b.age - b.fade >= FADE_S) b.dead = true;
  return b;
}

// 1 while in flight, fading to 0 over the last FADE_S so the ball doesn't pop out of existence
export const alpha = b => (b.fade == null ? 1 : Math.max(0, 1 - (b.age - b.fade) / FADE_S));
