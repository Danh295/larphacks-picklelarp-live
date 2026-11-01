// Rule-based swing tips from the metrics swing.js attaches to each swing event. Pure.
// Honest framing: this is rough guidance from a 2D webcam pose at ~30 fps, not coaching. Thresholds are
// engineering heuristics (not from a coaching source) and may need tuning from real swings.
//
// metrics: { peak (torso-lengths/s), disp (torso lengths), elbow (deg | null), durationMs,
//            angleDeg (+ = moving up at contact), wristRise (+ = wrist above shoulder, torso lengths) }
export const TIP_TUNE = {
  SLOW: 5, FAST: 8,                 // peak speed, torso lengths per second
  ELBOW_BENT: 100, ELBOW_LOCKED: 170,
  SHORT_PATH: 0.9,                  // net travel up to contact
  HIT_DOWN: -15, TOO_STEEP: 45,     // degrees at contact
  LOW: -0.9, HIGH: 0.6,             // wrist vs shoulder at contact
  SLOW_MS: 450
};

const ok = v => Number.isFinite(v);

// The two "nothing to fix" lines. A swing whose tips are only these is not a bad swing.
export const PRAISE = ['Great racket speed. Repeat that exact swing.', 'Solid swing. Keep repeating it, then add speed.'];

// Returns 1 or 2 short tips, most important first.
export function tipsFor(m, t = TIP_TUNE) {
  const tips = [];
  const x = m || {};
  if (ok(x.peak) && x.peak < t.SLOW) tips.push('Accelerate through the swing: let your hips and shoulders drive it, not just the arm.');
  if (ok(x.elbow) && x.elbow < t.ELBOW_BENT) tips.push('Extend your arm more at contact for a bigger swing arc.');
  else if (ok(x.elbow) && x.elbow > t.ELBOW_LOCKED) tips.push('Keep a slight bend in your elbow. A locked arm loses speed and feel.');
  if (ok(x.disp) && x.disp < t.SHORT_PATH) tips.push('Take a longer swing path: start further back and finish further across your body.');
  if (ok(x.angleDeg) && x.angleDeg < t.HIT_DOWN) tips.push('You are hitting down on it. Brush up through the ball for lift and net clearance.');
  else if (ok(x.angleDeg) && x.angleDeg > t.TOO_STEEP) tips.push('Too much upward swing. Flatten the path through contact.');
  if (ok(x.wristRise) && x.wristRise < t.LOW) tips.push('Contact is very low. Bend your knees to meet the ball higher.');
  else if (ok(x.wristRise) && x.wristRise > t.HIGH) tips.push('Contact is high. Let the ball drop to about waist height before you swing.');
  if (ok(x.durationMs) && x.durationMs > t.SLOW_MS) tips.push('Smooth it out: shorten the backswing so the swing is one quick motion.');

  if (tips.length === 0) {
    return [ok(x.peak) && x.peak >= t.FAST ? PRAISE[0] : PRAISE[1]];
  }
  return tips.slice(0, 2);
}
