// Swing detector v3 (SWING-FIX). Pure: no DOM, time is passed in.
//
// v2 required "wrist out to the side, then across the body", measured in shoulder-widths. A real mimed
// swing (side-on stance, bent elbow, diagonal path) never satisfied that. v3 detects the MOVE, not a direction:
//   - the DOMINANT wrist is measured RELATIVE to its shoulder (walking and leaning cancel out)
//   - in TORSO lengths (stays valid when you stand side-on and your shoulders overlap)
//   - a swing is a fast burst (speed >= V_START for FWD_FRAMES). It is judged just after the speed PEAK (when
//     speed falls to FIRE_DROP x peak), because the peak is the moment of contact: the event reports the wrist
//     position and ABSOLUTE wrist velocity from that frame, so the ball can leave the hand the way it moved.
//     It must have peaked at >= V_PEAK and travelled >= MIN_DISP torso lengths, with a not-folded elbow
//   - ignored while both wrists are above the nose (that is the jumbotron pose), 1.5 s cooldown after a fire
// `debug` (live internals + last reject reason) is exposed for the D-key panel.
import { L, torsoLen, angle } from './geometry.js';

// Exported for live tuning from the console: PLARP_SWING.V_PEAK = 2.5
export const SWING_TUNE = {
  V_START: 2.5,        // torso-lengths per second to start counting a burst
  V_PEAK: 3.5,         // the burst must reach this to count as a swing
  FWD_FRAMES: 2,
  MIN_DISP: 0.5,       // net wrist travel up to the peak, in torso lengths
  ELBOW_MIN: 70,       // degrees; below this the arm is folded, not swinging
  MIN_VIS: 0.4,        // wrist and shoulder must be this visible
  COOLDOWN_MS: 1500,
  FIRE_DROP: 0.95,     // decide once speed falls to this fraction of the peak (just past contact)
  VEL_WINDOW_MS: 105, 
  SWING_MAX_MS: 600,
  CROSS_MARGIN: 0.08,  // the wrist must get at least this far (torso lengths) onto BOTH sides of the body's centerline
  CROSS_SWEEP: 0.7,    // and sweep at least this far laterally during the burst: a swing goes across the body
  MAX_INWARD: 0.6,     // reject if the wrist moves toward the shoulder: cos(angle between velocity and shoulder->wrist) < -this
  MIN_REACH: 0.45,     // wrist-to-shoulder distance at the peak, in torso lengths (a swing keeps the arm out)
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
  const debug = { state: 'IDLE', speed: 0, disp: 0, elbow: null, radial: 0, reach: 0, cross: null, vis: 0, reason: 'waiting', side: 'r', fired: 0 };

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
      // lateral position of the wrist relative to the torso axis (mid-shoulder -> mid-hip), in torso lengths
      const msx = (P[L.LSH].x + P[L.RSH].x) / 2, msy = (P[L.LSH].y + P[L.RSH].y) / 2;
      const mhx = (P[L.LHIP].x + P[L.RHIP].x) / 2, mhy = (P[L.LHIP].y + P[L.RHIP].y) / 2;
      const al = Math.hypot(mhx - msx, mhy - msy) || 1;
      const lat = ((wr.x - msx) * ((mhy - msy) / al) - (wr.y - msy) * ((mhx - msx) / al)) / torso;
      hist.push({ t: now, x: rel.x, y: rel.y, ax: wr.x, ay: wr.y, s: lat });
      while (hist.length && now - hist[0].t > 900) hist.shift();

      const cur = hist[hist.length - 1];
      const ref = hist.find(h => now - h.t <= tune.VEL_WINDOW_MS) || cur;
      const dt = (cur.t - ref.t) / 1000;
      const sp = dt >= 0.05 ? Math.hypot(cur.x - ref.x, cur.y - ref.y) / dt / torso : 0;
      const vel = dt >= 0.05 ? { vx: (cur.ax - ref.ax) / dt, vy: (cur.ay - ref.ay) / dt } : { vx: 0, vy: 0 };
      // everything the event needs, captured on the frame of the speed peak (= contact)
      const rmag = Math.hypot(rel.x, rel.y);
      const vrx = dt >= 0.05 ? (cur.x - ref.x) / dt : 0, vry = dt >= 0.05 ? (cur.y - ref.y) / dt : 0;
      const vrmag = Math.hypot(vrx, vry);
      // cos of the angle between the relative velocity and the shoulder->wrist direction: -1 = pulling straight in,
      // 0 = swinging around the shoulder (an arc), +1 = pushing straight out. Unknown (0) when the wrist is on the shoulder.
      const radial = rmag > 0.1 * torso && vrmag > 0 ? (vrx * rel.x + vry * rel.y) / (vrmag * rmag) : 0;
      const snap = () => ({
        v: sp, t: now, vel, wrist: { x: wr.x, y: wr.y }, rel: { x: rel.x, y: rel.y }, radial, reach: rmag / torso,
        rise: (sh.y - wr.y) / torso,
        elbow: el && el.v >= tune.MIN_VIS ? angle(sh, el, wr) : null
      });
      debug.speed = sp;

      if (now < cool) { debug.state = 'COOLDOWN'; debug.reason = 'cooldown'; return null; }

      if (state === 'IDLE') {
        count = sp >= tune.V_START ? count + 1 : 0;
        if (count >= tune.FWD_FRAMES) {
          state = 'FWD'; tStart = now;
          peak = snap();
        }
        debug.state = state;
        debug.reason = state === 'FWD' ? 'swing in progress' : (sp < tune.V_START ? `too slow (${sp.toFixed(1)} < ${tune.V_START})` : 'building');
        return null;
      }

      // FWD: a burst is in progress
      if (sp > peak.v) peak = snap();
      debug.state = 'FWD';
      if (sp >= peak.v * tune.FIRE_DROP && now - tStart <= tune.SWING_MAX_MS) return null;

      // burst over: decide
      const startT = tStart - tune.LOOKBACK_MS;
      const from = hist.find(h => h.t >= startT) || hist[0];
      const disp = Math.hypot(peak.rel.x - from.x, peak.rel.y - from.y) / torso;
      const p = peak;
      reset();
      debug.disp = disp; debug.elbow = p.elbow;
      if (p.v < tune.V_PEAK) { debug.reason = `peak too slow (${p.v.toFixed(1)} < ${tune.V_PEAK})`; return null; }
      if (disp < tune.MIN_DISP) { debug.reason = `too small a move (${disp.toFixed(2)} < ${tune.MIN_DISP} torso)`; return null; }
      debug.radial = p.radial; debug.reach = p.reach;
      if (p.radial < -tune.MAX_INWARD) { debug.reason = `arm moving inward (${p.radial.toFixed(2)} < -${tune.MAX_INWARD})`; return null; }
      if (p.reach < tune.MIN_REACH) { debug.reason = `arm too close to body (${p.reach.toFixed(2)} < ${tune.MIN_REACH} torso)`; return null; }
      let sMin = Infinity, sMax = -Infinity;
      for (const h of hist) if (h.t >= startT) { if (h.s < sMin) sMin = h.s; if (h.s > sMax) sMax = h.s; }
      debug.cross = { min: sMin, max: sMax };
      if (!(sMin <= -tune.CROSS_MARGIN && sMax >= tune.CROSS_MARGIN && sMax - sMin >= tune.CROSS_SWEEP)) {
        debug.reason = `not crossing the body (side ${sMin.toFixed(2)} to ${sMax.toFixed(2)}, need both sides and a ${tune.CROSS_SWEEP} sweep)`;
        return null;
      }
      if (p.elbow != null && p.elbow < tune.ELBOW_MIN) { debug.reason = `elbow folded (${Math.round(p.elbow)} < ${tune.ELBOW_MIN})`; return null; }

      cool = now + tune.COOLDOWN_MS;
      debug.fired++; debug.reason = 'SWING!';
      return {
        type: 'swing',
        realMph: p.v * tune.TORSO_M * 2.237,                // torso-lengths/s -> m/s -> mph
        power: Math.min(1, p.v / 10),
        wrist: p.wrist,                                     // the hand at the speed peak = contact point
        launch: p.vel,                                      // absolute wrist velocity (px/s) at the peak
        side,
        t: now,
        metrics: {                                          // for coaching tips
          peak: p.v, disp, elbow: p.elbow,
          durationMs: p.t - from.t,
          angleDeg: Math.atan2(-p.vel.vy, Math.abs(p.vel.vx)) * 180 / Math.PI, // + = moving upward
          wristRise: p.rise                                 // + = wrist above the shoulder, in torsos
        }
      };
    }
  };
}
