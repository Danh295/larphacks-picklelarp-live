// Swing replay (UX-2, landmark-only). Pure: no DOM, time is passed in.
// - createClipRecorder: keeps a short buffer of smoothed landmarks and freezes a clip around each
//   fired swing (last KEEP clips).
// - analyzeClip: splits a clip into Backswing / Forward swing / Contact / Follow-through (frame ranges)
//   from the dominant wrist's speed, each with one line of advice. Advice thresholds come from
//   swing-tips.js (TIP_TUNE) so they stay in one place.
// Honest framing: 2D webcam pose at ~30 fps is rough guidance, not coaching.
import { L, torsoLen } from '../cv/geometry.js';
import { TIP_TUNE, tipsFor, PRAISE } from '../cv/swing-tips.js';

export const CAVEAT = '2D webcam pose at ~30 fps: rough guidance, not coaching.';

export const CLIP_TUNE = {
  PRE_MS: 1500,   // history kept before the swing fired (it fires after the burst ends)
  POST_MS: 600,   // follow-through kept after it fired
  BUF_MS: 3000,   // rolling buffer length
  KEEP: 5         // clips kept
};

export function createClipRecorder(tune = CLIP_TUNE) {
  const buf = [];
  const clips = [];
  let pending = null;

  function finalize() {
    const ev = pending; pending = null;
    const frames = buf.filter(f => f.t >= ev.t - tune.PRE_MS && f.t <= ev.t + tune.POST_MS);
    if (frames.length < 4) return;
    const tips = ev.metrics ? tipsFor(ev.metrics) : [];
    const bad = tips.length > 0 && !tips.every(x => PRAISE.includes(x)); // had at least one fault to fix
    clips.push({ t: ev.t, side: ev.side === 'l' ? 'l' : 'r', mph: ev.realMph, metrics: ev.metrics || null, tips, bad, frames });
    // when full, drop the oldest GOOD clip first so the swings worth reviewing stay around longer
    while (clips.length > tune.KEEP) { const i = clips.findIndex(c => !c.bad); clips.splice(i >= 0 ? i : 0, 1); }
  }

  return {
    // P: smoothed 33 landmarks (display pixels). Call every processed frame, before swing detection.
    push(t, P) {
      if (!P) return;
      buf.push({ t, P });
      while (buf.length && t - buf[0].t > tune.BUF_MS) buf.shift();
      if (pending && t >= pending.t + tune.POST_MS) finalize();
    },
    // ev: the swing event ({ t, side, realMph, metrics }). The clip is frozen POST_MS later.
    swung(ev) { if (pending) finalize(); pending = ev; },
    clips() { return clips; },
    reset() { buf.length = 0; clips.length = 0; pending = null; }
  };
}

const IDX = { r: { wr: L.RWR, sh: L.RSH }, l: { wr: L.LWR, sh: L.LSH } };

// Dominant wrist relative to its shoulder, in torso lengths, per frame.
function relTrack(clip) {
  const ix = IDX[clip.side] || IDX.r;
  return clip.frames.map(f => {
    const torso = torsoLen(f.P);
    return { t: f.t, x: (f.P[ix.wr].x - f.P[ix.sh].x) / torso, y: (f.P[ix.wr].y - f.P[ix.sh].y) / torso };
  });
}

// Torso-lengths per second between neighbouring frames, lightly smoothed.
function speeds(track) {
  const raw = track.map((p, i) => {
    if (i === 0) return 0;
    const dt = (p.t - track[i - 1].t) / 1000;
    return dt > 0 ? Math.hypot(p.x - track[i - 1].x, p.y - track[i - 1].y) / dt : 0;
  });
  return raw.map((_, i) => {
    const a = raw[Math.max(0, i - 1)], b = raw[i], c = raw[Math.min(raw.length - 1, i + 1)];
    return (a + b + c) / 3;
  });
}

const pathLen = (track, from, to) => {
  let s = 0;
  for (let i = from + 1; i <= to; i++) s += Math.hypot(track[i].x - track[i - 1].x, track[i].y - track[i - 1].y);
  return s;
};

const ok = v => Number.isFinite(v);

function adviceFor(id, m, followRatio, t = TIP_TUNE) {
  const none = 'No swing metrics for this clip.';
  if (id === 'back') {
    if (!m) return none;
    if (ok(m.disp) && m.disp < t.SHORT_PATH) return 'Start the swing further back for a longer path.';
    if (ok(m.durationMs) && m.durationMs > t.SLOW_MS) return 'Shorten the backswing so it is one quick motion.';
    return 'Backswing is compact. Good.';
  }
  if (id === 'forward') {
    if (!m || !ok(m.peak)) return none;
    if (m.peak < t.SLOW) return 'Accelerate through it: let your hips and shoulders drive, not just the arm.';
    if (m.peak >= t.FAST) return 'Great speed. Repeat that exact swing.';
    return 'Decent speed. Drive with the hips and shoulders for more.';
  }
  if (id === 'contact') {
    if (!m) return none;
    if (ok(m.elbow) && m.elbow < t.ELBOW_BENT) return 'Extend your arm more at contact.';
    if (ok(m.elbow) && m.elbow > t.ELBOW_LOCKED) return 'Keep a slight bend in the elbow at contact.';
    if (ok(m.angleDeg) && m.angleDeg < t.HIT_DOWN) return 'You are hitting down. Brush up through contact.';
    if (ok(m.angleDeg) && m.angleDeg > t.TOO_STEEP) return 'Too steep an upward swing. Flatten the path.';
    if (ok(m.wristRise) && m.wristRise < t.LOW) return 'Contact is very low. Bend your knees.';
    if (ok(m.wristRise) && m.wristRise > t.HIGH) return 'Contact is high. Let it drop to waist height.';
    return 'Contact position looks good.';
  }
  // follow-through, measured from the frames themselves
  if (!ok(followRatio)) return none;
  return followRatio < 0.35 ? 'Follow through: finish across your body, do not stop at contact.' : 'Good follow-through.';
}

export const CHUNK_LABELS = { back: 'Backswing', forward: 'Forward swing', contact: 'Contact', follow: 'Follow-through' };

// Returns [{ id, label, from, to, advice }] (inclusive frame indexes into clip.frames), in order, always 4 chunks.
export function analyzeClip(clip) {
  const n = clip && clip.frames ? clip.frames.length : 0;
  if (n < 2) return [];
  const track = relTrack(clip);
  const sp = speeds(track);

  // contact = fastest frame in the window leading up to the fire time (the burst peaks just before it)
  let c = -1;
  for (let i = 0; i < n; i++) {
    if (clip.frames[i].t > clip.t - 700 && clip.frames[i].t <= clip.t && (c < 0 || sp[i] > sp[c])) c = i;
  }
  if (c < 0) c = sp.indexOf(Math.max(...sp));
  const peak = sp[c] || 1;

  let fs = c;                                   // forward swing starts where the burst began
  while (fs > 0 && sp[fs - 1] > 0.35 * peak) fs--;
  let bs = 0;                                   // backswing starts at the first real movement
  while (bs < fs - 1 && sp[bs] < 0.12 * peak) bs++;

  let fe = c;                                   // the burst ends where speed falls back under 35% of peak
  while (fe < n - 1 && sp[fe + 1] > 0.35 * peak) fe++;
  const before = pathLen(track, fs, fe), after = pathLen(track, fe, n - 1);
  const followRatio = before > 0 ? after / before : NaN;
  const m = clip.metrics || null;
  const last = n - 1;
  const mk = (id, from, to) => ({ id, label: CHUNK_LABELS[id], from, to, advice: adviceFor(id, m, followRatio) });
  return [
    mk('back', bs, Math.max(bs, fs - 1)),
    mk('forward', fs, Math.max(fs, c - 1)),
    mk('contact', c, c),
    mk('follow', Math.min(last, c + 1), last)
  ];
}
