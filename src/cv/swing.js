// v1 swing detection behind the SPEC.md contract. CV-4 replaces the internals with the
// phase-gated state machine; keep the createSwing()/update() signature and event shape.
import { L, torsoLen } from './geometry.js';

const SWING_ON = 4.2; // torso-lengths / second (v1 threshold)

function wristSpeed(arr, now, torso) {
  if (arr.length < 2) return { s: 0, vx: 0, vy: 0 };
  const cur = arr[arr.length - 1];
  let ref = arr[0];
  for (const p of arr) { if (now - p.t <= 130) { ref = p; break; } }
  const dt = (cur.t - ref.t) / 1000;
  if (dt < 0.03) return { s: 0, vx: 0, vy: 0 };
  const dx = cur.x - ref.x, dy = cur.y - ref.y;
  return { s: Math.hypot(dx, dy) / dt / torso, vx: dx / dt, vy: dy / dt };
}

export function createSwing() {
  const hist = { l: [], r: [] };
  let swing = null;
  let cool = 0;

  return {
    reset() { hist.l.length = 0; hist.r.length = 0; swing = null; },
    // P: 33 display-space landmarks, calib: from setup (unused in v1), now: ms
    update(P, calib, now) {
      const torso = torsoLen(P);
      for (const [k, i] of [['l', L.LWR], ['r', L.RWR]]) {
        if (P[i].v > 0.4) {
          hist[k].push({ t: now, x: P[i].x, y: P[i].y });
          while (hist[k].length && now - hist[k][0].t > 450) hist[k].shift();
        } else hist[k].length = 0;
      }
      const l = wristSpeed(hist.l, now, torso), r = wristSpeed(hist.r, now, torso);
      const w = l.s > r.s ? { ...l, who: 'l' } : { ...r, who: 'r' };

      if (!swing && now > cool && w.s > SWING_ON) {
        swing = { t0: now, peak: w.s, vx: w.vx, vy: w.vy, who: w.who };
        return null;
      }
      if (!swing) return null;

      if (w.s > swing.peak) { swing.peak = w.s; swing.vx = w.vx; swing.vy = w.vy; swing.who = w.who; }
      if (w.s < swing.peak * 0.55 || now - swing.t0 > 300) {
        const s = swing;
        swing = null;
        cool = now + 1300;
        const wr = P[s.who === 'l' ? L.LWR : L.RWR];
        return {
          type: 'swing',
          realMph: s.peak * 0.5 * 2.237, // torso ~ 0.5 m, m/s -> mph
          power: Math.min(1, s.peak / 10),
          wrist: { x: wr.x, y: wr.y },
          side: s.who,
          t: now,
          launch: { vx: s.vx, vy: s.vy }
        };
      }
      return null;
    }
  };
}
