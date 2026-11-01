// One Euro filter (Casiez et al. 2012) for landmark smoothing.
// MediaPipe's Pose Landmarker (tasks-vision) has no smoothing option, so we do it here.
// Coordinates are filtered in NORMALIZED units (x/W, y/H), so these constants do not depend on resolution.
//
// Tuning (per the authors): set BETA=0, lower MIN_CUTOFF until a still skeleton stops shaking,
// then raise BETA until fast motion (a swing) stops lagging. Tune live via window.PLARP_FILTER.
export const TUNE = {
  MIN_CUTOFF: 1.0,  // Hz. Lower = steadier when still, more lag.
  BETA: 8,          // Speed coefficient in normalized units. Higher = less lag when moving fast.
  D_CUTOFF: 1.0,    // Hz, for the derivative estimate
  LOW_VIS: 0.5,     // below this a landmark is not trusted
  RESET_MS: 300     // reset a landmark's filter after this long below LOW_VIS
};

const alpha = (cutoff, dt) => 1 / (1 + (1 / (2 * Math.PI * cutoff)) / dt);

class LowPass {
  constructor() { this.y = null; }
  filter(x, a) { this.y = this.y == null ? x : a * x + (1 - a) * this.y; return this.y; }
  reset() { this.y = null; }
}

export class OneEuroFilter {
  constructor(tune = TUNE) {
    this.tune = tune;
    this.x = new LowPass();
    this.dx = new LowPass();
    this.tPrev = null;
    this.xPrev = null;
  }
  // x: value, tSec: timestamp in seconds
  filter(x, tSec) {
    if (this.tPrev == null) {
      this.tPrev = tSec; this.xPrev = x;
      return this.x.filter(x, 1);
    }
    const dt = Math.max(1e-3, tSec - this.tPrev);
    const rate = (x - this.xPrev) / dt;
    const edx = this.dx.filter(rate, alpha(this.tune.D_CUTOFF, dt));
    const cutoff = this.tune.MIN_CUTOFF + this.tune.BETA * Math.abs(edx);
    this.tPrev = tSec; this.xPrev = x;
    return this.x.filter(x, alpha(cutoff, dt));
  }
  reset() { this.x.reset(); this.dx.reset(); this.tPrev = null; this.xPrev = null; }
}

// Smooths a 33-landmark array of {x, y, v} (display-space pixels).
export class LandmarkSmoother {
  constructor(w = 1280, h = 720, tune = TUNE) {
    this.w = w; this.h = h; this.tune = tune;
    this.fx = []; this.fy = []; this.lowSince = [];
  }
  setSize(w, h) { this.w = w; this.h = h; this.reset(); }
  reset() { this.fx = []; this.fy = []; this.lowSince = []; }

  // P: landmarks or null, tMs: ms. Returns a new smoothed array (or null).
  update(P, tMs) {
    if (!P) { this.reset(); return null; }
    const t = tMs / 1000;
    return P.map((p, i) => {
      if (p.v < this.tune.LOW_VIS) {
        if (this.lowSince[i] == null) this.lowSince[i] = tMs;
        if (tMs - this.lowSince[i] > this.tune.RESET_MS && this.fx[i]) { this.fx[i].reset(); this.fy[i].reset(); }
        return { x: p.x, y: p.y, v: p.v }; // untrusted: pass through raw, do not feed the filter
      }
      this.lowSince[i] = null;
      if (!this.fx[i]) { this.fx[i] = new OneEuroFilter(this.tune); this.fy[i] = new OneEuroFilter(this.tune); }
      return {
        x: this.fx[i].filter(p.x / this.w, t) * this.w,
        y: this.fy[i].filter(p.y / this.h, t) * this.h,
        v: p.v
      };
    });
  }
}
