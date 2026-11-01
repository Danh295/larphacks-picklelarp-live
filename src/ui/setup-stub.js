// Fake setup state machine for building the overlay before CV-6 lands. Enable with ?stub=setup.
import { DEFAULT_CALIB } from '../cv/setup.js';

const STEPS = [
  { phase: 'WAITING', ms: 2000 },
  { phase: 'ALIGN', ms: 2000 },
  { phase: 'READY', ms: 1500 },
  { phase: 'CALIBRATE', ms: 2500 },
  { phase: 'LIVE', ms: 6000 }
];
const TOTAL = STEPS.reduce((a, s) => a + s.ms, 0);

export function createSetupStub() {
  let t0 = null, forced = false;
  const LIVE = { phase: 'LIVE', progress: 1, message: '', calib: DEFAULT_CALIB, stage: null };
  return {
    reset() { t0 = null; forced = false; },
    skip() { forced = true; return { ...LIVE }; },
    update(landmarks, tMs) {
      if (forced) return { ...LIVE };
      if (t0 === null) t0 = tMs;
      let t = (tMs - t0) % TOTAL;
      for (const s of STEPS) {
        if (t < s.ms) {
          const progress = t / s.ms;
          const raise = s.phase === 'CALIBRATE' && progress > 0.8;
          const message = raise ? 'Raise your paddle hand above your head' : '';
          const p = raise ? (progress - 0.8) / 0.2 : s.phase === 'CALIBRATE' ? progress / 0.8 : progress;
          const stage = s.phase === 'CALIBRATE' ? (raise ? 'raise' : 'still') : null;
          return { phase: s.phase, progress: p, message, calib: s.phase === 'LIVE' ? DEFAULT_CALIB : null, stage };
        }
        t -= s.ms;
      }
    }
  };
}
