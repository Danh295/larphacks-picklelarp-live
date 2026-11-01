// Broadcast ball: a fixed, scripted arc. The swing only TRIGGERS it; the wrist's velocity never steers it,
// so a sloppy or random motion can't send the ball into the ground (the v1 bug).
// The ball rises from the wrist toward the far side of the frame and ends when it falls back to the
// launch height, so y never exceeds the launch y. The apex is kept on screen.
export const GRAVITY = 1400;  // px/s^2
export const RADIUS = 22;
const SHRINK = 0.45;          // radius lost by the end of the flight (it flies "away")
const MARGIN = RADIUS + 8;    // keep the apex this far below the top edge

// wrist: {x, y} display px. Returns a ball you advance with step(ball, dt).
export function launch(wrist, W, H) {
  const dir = wrist.x > W / 2 ? -1 : 1;                 // fly toward the far side of the frame
  const rise = Math.max(60, Math.min(H * 0.28, wrist.y - MARGIN)); // apex height above launch, on screen
  const vy = -Math.sqrt(2 * GRAVITY * rise);
  const flight = 2 * Math.sqrt(2 * rise / GRAVITY);     // time to come back down to launch height
  return {
    x: wrist.x, y: wrist.y, y0: wrist.y,
    vx: dir * (W * 0.35) / flight, vy,
    g: GRAVITY, age: 0, flight, r: RADIUS, dead: false, trail: []
  };
}

export function step(b, dt) {
  if (b.dead) return b;
  b.age += dt;
  b.vy += b.g * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  if (b.vy > 0 && b.y >= b.y0) { b.y = b.y0; b.dead = true; }   // never below launch height
  b.r = RADIUS * (1 - SHRINK * Math.min(1, b.age / b.flight));
  return b;
}

// 1 while in flight, fading to 0 over the last 20% so the ball doesn't pop out of existence
export const alpha = b => Math.max(0, Math.min(1, (1 - b.age / b.flight) / 0.2));
