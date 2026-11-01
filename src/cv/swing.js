// Phase-gated swing detector (CV-4). Pure: no DOM, time is passed in.
//
// A swing is a forehand-style move by the DOMINANT hand only, seen from a camera the player faces:
//   IDLE -> BACK    wrist held outboard of its own shoulder (backswing posture) for >= BACK_FRAMES
//   BACK -> FWD     wrist moves back toward the body's midline faster than V_FWD for >= FWD_FRAMES
//   FWD  -> fire    when speed falls to PEAK_DROP x its peak (or FWD_MAX_MS passes), if the elbow
//                   was extended at the peak. Fires once, then COOLDOWN_MS of silence.
// The wrist is measured RELATIVE to the dominant shoulder and in shoulder-widths, so walking,
// leaning and camera distance do not change the numbers. Only the dominant wrist is tracked.
import { L, shoulderWidth, angle } from './geometry.js';

// Exported for live tuning from the console: PLARP_SWING.V_FWD = 3
export const SWING_TUNE = {
  BACK_U: 0.5,         // shoulder-widths outboard of the shoulder = backswing posture
  BACK_FRAMES: 3,
  V_FWD: 4,            // shoulder-widths per second, inward
  FWD_FRAMES: 2,
  ELBOW_MIN_DEG: 120,  // elbow must be at least this extended at the peak
  MIN_VIS: 0.5,        // wrist, elbow and both shoulders must be this visible
  COOLDOWN_MS: 1500,
  STALE_MS: 600,       // backswing expires after this long with no posture and no forward motion
  FWD_MAX_MS: 450,
  PEAK_DROP: 0.55,
  VEL_WINDOW_MS: 120,
  SHOULDER_M: 0.4      // assumed real shoulder width, metres, for the mph estimate
};

const IDX = {
  r: { wr: L.RWR, el: L.REL, sh: L.RSH, other: L.LSH },
  l: { wr: L.LWR, el: L.LEL, sh: L.LSH, other: L.RSH }
};

export function createSwing(tune = SWING_TUNE) {
  const hist = [];
  let state = 'IDLE';
  let backFrames = 0, fwdFrames = 0;
  let tBackLast = 0, tFwd = 0, cool = 0;
  let peak = null;

  function reset() {
    state = 'IDLE'; backFrames = 0; fwdFrames = 0; peak = null;
  }

  return {
    reset() { hist.length = 0; reset(); cool = 0; },

    // P: 33 display-space landmarks. calib: { dominant: 'l'|'r', ... } or null (defaults to 'r'). now: ms.
    update(P, calib, now) {
      const side = calib && calib.dominant === 'l' ? 'l' : 'r';
      const ix = IDX[side];
      const wr = P[ix.wr], el = P[ix.el], sh = P[ix.sh], other = P[ix.other];

      if ([wr, el, sh, other].some(p => !p || p.v < tune.MIN_VIS)) { hist.length = 0; reset(); return null; }

      const sw = shoulderWidth(P);
      const out = Math.sign(sh.x - other.x) || 1;           // which way is "outboard" for this arm
      const rel = { x: wr.x - sh.x, y: wr.y - sh.y };
      const u = rel.x * out / sw;                           // + = wrist outboard of the shoulder

      hist.push({ t: now, x: rel.x, y: rel.y });
      while (hist.length && now - hist[0].t > 300) hist.shift();

      // velocity of the wrist relative to the shoulder over ~VEL_WINDOW_MS
      let vin = 0;
      const cur = hist[hist.length - 1];
      const ref = hist.find(h => now - h.t <= tune.VEL_WINDOW_MS) || cur;
      const dt = (cur.t - ref.t) / 1000;
      if (dt >= 0.05) {
        vin = -((cur.x - ref.x) / dt) * out / sw;           // + = moving back toward the body
      }

      if (now < cool) return null;

      if (state === 'IDLE') {
        backFrames = u >= tune.BACK_U ? backFrames + 1 : 0;
        if (backFrames >= tune.BACK_FRAMES) { state = 'BACK'; tBackLast = now; fwdFrames = 0; }
        return null;
      }

      if (state === 'BACK') {
        if (u >= tune.BACK_U) tBackLast = now;
        fwdFrames = vin >= tune.V_FWD ? fwdFrames + 1 : 0;
        if (fwdFrames >= tune.FWD_FRAMES) {
          state = 'FWD'; tFwd = now;
          peak = { v: vin, elbow: angle(sh, el, wr) };
        } else if (now - tBackLast > tune.STALE_MS) reset();
        return null;
      }

      // FWD
      if (vin > peak.v) peak = { v: vin, elbow: angle(sh, el, wr) };
      if (vin < peak.v * tune.PEAK_DROP || now - tFwd > tune.FWD_MAX_MS) {
        const p = peak;
        reset();
        if (p.elbow < tune.ELBOW_MIN_DEG) return null;      // a bent-arm flail is not a swing
        cool = now + tune.COOLDOWN_MS;
        return {
          type: 'swing',
          realMph: p.v * tune.SHOULDER_M * 2.237,           // shoulder-widths/s -> m/s -> mph
          power: Math.min(1, p.v / 12),
          wrist: { x: wr.x, y: wr.y },                      // where the hand is NOW, so the ball spawns on it
          side,
          t: now
        };
      }
      return null;
    }
  };
}
