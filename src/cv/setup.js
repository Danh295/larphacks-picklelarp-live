// STUB until CV-6. Returns the contract shape from SPEC.md and is always LIVE.
// APP-3 builds against this shape; CV-6 replaces the body with the real state machine.
export const DEFAULT_CALIB = Object.freeze({ shoulderW: 0.4, torso: 0.5, armLen: 0.6, dominant: 'r' });

export function createSetup() {
  return {
    reset() {},
    // landmarks: 33 display-space {x,y,v} or null; tMs: ms
    update(landmarks, tMs) {
      return { phase: 'LIVE', progress: 1, message: '', calib: DEFAULT_CALIB };
    }
  };
}
