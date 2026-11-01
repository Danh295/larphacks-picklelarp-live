// Pure helpers over a 33-landmark array of {x, y, v} (display-space pixels).
export const L = { NOSE: 0, LSH: 11, RSH: 12, LEL: 13, REL: 14, LWR: 15, RWR: 16, LHIP: 23, RHIP: 24, LKNEE: 25, RKNEE: 26, LANK: 27, RANK: 28 };

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export function torsoLen(P) {
  return Math.max(40, dist(mid(P[L.LSH], P[L.RSH]), mid(P[L.LHIP], P[L.RHIP])));
}
export function shoulderWidth(P) {
  return Math.max(30, dist(P[L.LSH], P[L.RSH]));
}
// interior angle at b (degrees) for points a-b-c
export function angle(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y }, v2 = { x: c.x - b.x, y: c.y - b.y };
  const d = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1;
  return Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / d))) * 180 / Math.PI;
}
