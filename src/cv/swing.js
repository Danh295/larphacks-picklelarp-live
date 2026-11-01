// Swing detector v3 (SWING-FIX). Pure: no DOM, time is passed in.
//
// v2 required "wrist out to the side, then across the body", measured in shoulder-widths. A real mimed
// swing (side-on stance, bent elbow, diagonal path) never satisfied that. v3 detects the MOVE, not a direction:
//   - the DOMINANT wrist is measured RELATIVE to its shoulder (walking and leaning cancel out)
//   - in TORSO lengths (stays valid when you stand side-on and your shoulders overlap)
//   - a swing is a fast burst (speed >= V_START for FWD_FRAMES), judged when it slows to PEAK_DROP x its peak:
//     it must have peaked at >= V_PEAK and travelled >= MIN_DISP torso lengths, with a not-folded elbow
//   - ignored while both wrists are above the nose (that is the jumbotron pose), 1.5 s cooldown after a fire
// `debug` (live internals + last reject reason) is exposed for the D-key panel.
import { L, torsoLen, angle } from './geometry.js';

// Exported for live tuning from the console: PLARP_SWING.V_PEAK = 2.5
export const SWING_TUNE = {
  V_START: 2.5,        // torso-lengths per second to start counting a burst
  V_PEAK: 3.5,         // the burst must reach this to count as a swing
  FWD_FRAMES: 2,
  MIN_DISP: 0.7,       // net wrist travel across the burst, in torso lengths
  ELBOW_MIN: 70,       // degrees; below this the arm is folded, not swinging
  MIN_VIS: 0.4,        // wrist and shoulder must be this visible
  COOLDOWN_MS: 1500,
  PEAK_DROP: 0.55,
  VEL_WINDOW_MS: 120,
  SWING_MAX_MS: 600,
  LOOKBACK_MS: 250,    // where the displacement is measured from, before the burst was noticed
  TORSO_M: 0.5         // assumed real torso length in metres, for the mph estimate
};

const IDX = {
  r: { wr: L.RWR, el: L.REL, sh: L.RSH },
  l: { wr: L.LWR, el: L.LEL, sh: L.LSH }
};

export function createSwing(tune = SWING_TUNE) {
  const hist = [];
  let state = 'IDLE', count = 0, tStart = 0, cool = 0, peak = null;
  const debug = { state: 'IDLE', speed: 0, disp: 0, elbow: null, vis: 0, reason: 'waiting', side: 'r', fired: 0 };

  function reset() { state = 'IDLE'; count = 0; peak = null; }

  return {
    debug,
    reset() { hist.length = 0; reset(); cool = 0; },

    // P: 33 display-space landmarks. calib: { dominant: 'l'|'r', ... } or null (defaults to 'r'). now: ms.
    update(P, calib, now) {
      const side = calib && calib.dominant === 'l' ? 'l' : 'r';
      const ix = IDX[side];
      const wr = P[ix.wr], el = P[ix.el], sh = P[ix.sh];
      debug.side = side;

      if (!wr || !sh || wr.v < tune.MIN_VIS || sh.v < tune.MIN_VIS) {
        hist.length = 0; reset();
        debug.state = state; debug.speed = 0; debug.vis = wr ? wr.v : 0; debug.reason = 'wrist or shoulder not visible';
        return null;
      }
      debug.vis = wr.v;

      // both hands above the head is the jumbotron pose, never a swing
      const lift = torsoLen(P) * 0.15, noseY = P[L.NOSE].y;
      if (P[L.LWR].v > 0.4 && P[L.RWR].v > 0.4 && P[L.LWR].y < noseY - lift && P[L.RWR].y < noseY - lift) {
        hist.length = 0; reset(); debug.state = state; debug.speed = 0; debug.reason = 'both arms up (jumbotron)';
        return null;
      }

      const torso = torsoLen(P);
      const rel = { x: wr.x - sh.x, y: wr.y - sh.y };
      hist.push({ t: now, x: rel.x, y: rel.y });
      while (hist.length && now - hist[0].t > 900) hist.shift();

      const cur = hist[hist.length - 1];
      const ref = hist.find(h => now - h.t <= tune.VEL_WINDOW_MS) || cur;
      const dt = (cur.t - ref.t) / 1000;
      const sp = dt >= 0.05 ? Math.hypot(cur.x - ref.x, cur.y - ref.y) / dt / torso : 0;
      debug.speed = sp;

      if (now < cool) { debug.state = 'COOLDOWN'; debug.reason = 'cooldown'; return null; }

      if (state === 'IDLE') {
        count = sp >= tune.V_START ? count + 1 : 0;
        if (count >= tune.FWD_FRAMES) {
          state = 'FWD'; tStart = now;
          peak = { v: sp, elbow: el && el.v >= tune.MIN_VIS ? angle(sh, el, wr) : null };
        }
        debug.state = state;
        debug.reason = state === 'FWD' ? 'swing in progress' : (sp < tune.V_START ? `too slow (${sp.toFixed(1)} < ${tune.V_START})` : 'building');
        return null;
      }

      // FWD: a burst is in progress
      if (sp > peak.v) peak = { v: sp, elbow: el && el.v >= tune.MIN_VIS ? angle(sh, el, wr) : null };
      debug.state = 'FWD';
      if (sp >= peak.v * tune.PEAK_DROP && now - tStart <= tune.SWING_MAX_MS) return null;

      // burst over: decide
      const startT = tStart - tune.LOOKBACK_MS;
      const from = hist.find(h => h.t >= startT) || hist[0];
      const disp = Math.hypot(cur.x - from.x, cur.y - from.y) / torso;
      const p = peak;
      reset();
      debug.disp = disp; debug.elbow = p.elbow;
      if (p.v < tune.V_PEAK) { debug.reason = `peak too slow (${p.v.toFixed(1)} < ${tune.V_PEAK})`; return null; }
      if (disp < tune.MIN_DISP) { debug.reason = `too small a move (${disp.toFixed(2)} < ${tune.MIN_DISP} torso)`; return null; }
      if (p.elbow != null && p.elbow < tune.ELBOW_MIN) { debug.reason = `elbow folded (${Math.round(p.elbow)} < ${tune.ELBOW_MIN})`; return null; }

      cool = now + tune.COOLDOWN_MS;
      debug.fired++; debug.reason = 'SWING!';
      return {
        type: 'swing',
        realMph: p.v * tune.TORSO_M * 2.237,                // torso-lengths/s -> m/s -> mph
        power: Math.min(1, p.v / 10),
        wrist: { x: wr.x, y: wr.y },                        // where the hand is NOW, so the ball spawns on it
        side,
        t: now
      };
    }
  };
}
