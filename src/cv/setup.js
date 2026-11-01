// Setup state machine (CV-6). Pure: time is passed in, so tests drive it with synthetic frames.
// WAITING -> ALIGN -> READY (T-pose) -> CALIBRATE (still, then raise paddle hand) -> LIVE.
// Landmarks are display-space (mirrored) pixels. 'l' / 'r' name L.LWR / L.RWR, same as swing.js.
// calib values are display PIXELS, measured on the same frame size the landmarks use.
import { L, dist, mid, angle, shoulderWidth, torsoLen } from './geometry.js';

// Starting values from research, NOT yet tuned on a real camera. Live tuning: PLARP_SETUP.TPOSE_MS = 1000
export const SETUP_TUNE = {
  VIS: 0.6,         // min visibility for the joints each phase needs
  ALIGN_MS: 1000,   // fully framed for this long -> READY
  TPOSE_MS: 1500,   // T-pose held for this long -> CALIBRATE
  LEVEL_TOL: 0.25,  // wrist y within this many shoulder widths of shoulder y
  ELBOW_MIN: 150,   // degrees; elbow this straight counts as an extended arm
  STILL_MS: 2000,   // stay still this long to average the body measurements
  STILL_TOL: 0.15,  // shoulder midpoint may drift this many shoulder widths before sampling restarts
  RAISE_MS: 500,    // paddle hand above the nose for this long sets dominant
  LOST_MS: 3000     // no pose for longer than this -> WAITING from any phase
};

// Pixel estimates for a full body at 1280x720. Used by the L test key.
export const DEFAULT_CALIB = Object.freeze({ shoulderW: 110, torso: 150, armLen: 170, dominant: 'r' });

const MSG = {
  WAITING: 'Step back so your whole body is in frame',
  ALIGN: 'Hold still, checking your position',
  READY: 'Raise both arms into a T-pose',
  STILL: 'Hold the T-pose and stay still',
  RAISE: 'Raise your paddle hand above your head',
  LIVE: 'YOU ARE LIVE'
};

const SIDES = [[L.LSH, L.LEL, L.LWR], [L.RSH, L.REL, L.RWR]];

export function createSetup(tune = SETUP_TUNE) {
  let phase, stage, since, lastSeen, forced, progress, anchor, samples, partial, raiseSide, calib;

  function reset() {
    phase = 'WAITING'; stage = 'still'; since = null; lastSeen = null; forced = false; progress = 0;
    anchor = null; samples = []; partial = null; raiseSide = null; calib = null;
  }
  function go(next) {
    phase = next; stage = 'still'; since = null; progress = 0;
    anchor = null; samples = []; partial = null; raiseSide = null;
    if (next !== 'LIVE') calib = null;
  }
  // ms the condition has held continuously as of t (0 when it is false)
  function held(cond, t) {
    if (!cond) { since = null; return 0; }
    if (since == null) since = t;
    return t - since;
  }
  const out = () => ({
    phase, progress,
    message: phase === 'CALIBRATE' ? (stage === 'still' ? MSG.STILL : MSG.RAISE) : MSG[phase],
    calib: phase === 'LIVE' ? calib : null
  });
  const clamp01 = x => Math.max(0, Math.min(1, x));

  function isTPose(P, sw) {
    return SIDES.every(([sh, el, wr]) =>
      P[el].v >= tune.VIS && P[wr].v >= tune.VIS &&
      Math.abs(P[wr].y - P[sh].y) <= tune.LEVEL_TOL * sw &&
      angle(P[sh], P[el], P[wr]) >= tune.ELBOW_MIN);
  }

  reset();

  return {
    reset,
    // Test key L. Returns the LIVE result. Stays LIVE through an empty room until a real person has appeared.
    skip(tMs) {
      go('LIVE'); calib = DEFAULT_CALIB; progress = 1; forced = true; lastSeen = tMs ?? null;
      return out();
    },
    // landmarks: 33 display-space {x,y,v} or null; tMs: ms
    update(P, tMs) {
      const lost = lastSeen != null && tMs - lastSeen > tune.LOST_MS;
      if (!P) {
        since = null; samples = []; anchor = null; // holds restart after a gap
        if (lost && !forced) reset();
        return out();
      }
      if (lost && !forced) reset();
      forced = false;
      lastSeen = tMs;

      const vis = i => P[i].v >= tune.VIS;
      const ankles = vis(L.LANK) && vis(L.RANK);
      const framed = ankles && [L.NOSE, L.LSH, L.RSH, L.LHIP, L.RHIP, L.LKNEE, L.RKNEE].every(vis) &&
        P[L.LHIP].y < P[L.LKNEE].y && P[L.RHIP].y < P[L.RKNEE].y;

      switch (phase) {
        case 'WAITING':
          if (!ankles) { progress = 0; return out(); }
          go('ALIGN');
          // falls through so the 1 s hold starts on this frame
        case 'ALIGN': {
          if (!ankles) { go('WAITING'); return out(); }
          const h = held(framed, tMs);
          progress = clamp01(h / tune.ALIGN_MS);
          if (framed && h >= tune.ALIGN_MS) go('READY');
          return out();
        }
        case 'READY': {
          if (!framed) { go('ALIGN'); return out(); }
          const h = held(isTPose(P, shoulderWidth(P)), tMs);
          progress = clamp01(h / tune.TPOSE_MS);
          if (h >= tune.TPOSE_MS) go('CALIBRATE');
          return out();
        }
        case 'CALIBRATE': {
          if (!framed) { go('ALIGN'); return out(); }
          const sw = shoulderWidth(P);
          if (stage === 'still') {
            const c = mid(P[L.LSH], P[L.RSH]);
            // arms must stay extended: armLen is only meaningful with straight arms
            const tp = isTPose(P, sw);
            if (!tp || (anchor && dist(c, anchor) > tune.STILL_TOL * sw)) {
              samples = []; anchor = null; since = null; progress = 0; // restart the window
            }
            if (tp && !anchor) { anchor = c; since = tMs; }
            if (anchor) {
              const arm = SIDES.reduce((a, [sh, el, wr]) => a + dist(P[sh], P[el]) + dist(P[el], P[wr]), 0) / 2;
              samples.push({ sw, torso: torsoLen(P), arm });
              const h = tMs - since;
              progress = clamp01(h / tune.STILL_MS);
              if (h >= tune.STILL_MS) {
                const avg = k => samples.reduce((a, s) => a + s[k], 0) / samples.length;
                partial = { shoulderW: avg('sw'), torso: avg('torso'), armLen: avg('arm') };
                stage = 'raise'; since = null; progress = 0;
              }
            }
            return out();
          }
          const lUp = vis(L.LWR) && P[L.LWR].y < P[L.NOSE].y;
          const rUp = vis(L.RWR) && P[L.RWR].y < P[L.NOSE].y;
          const side = lUp === rUp ? null : (lUp ? 'l' : 'r'); // exactly one wrist up
          if (side !== raiseSide) { raiseSide = side; since = null; }
          const h = held(side != null, tMs);
          progress = clamp01(h / tune.RAISE_MS);
          if (side && h >= tune.RAISE_MS) {
            const done = { ...partial, dominant: side };
            go('LIVE');
            calib = done;
            progress = 1;
          }
          return out();
        }
        default: // LIVE: only the lost-pose rule leaves it
          return out();
      }
    }
  };
}
