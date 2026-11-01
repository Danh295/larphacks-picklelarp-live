// Setup overlay: renders the setup.update() return value. DOM-free view mapping + thin DOM layer.
// Big text on purpose: the player stands 3 to 4 m from the screen.
const DEFAULTS = {
  WAITING: ['STEP INTO FRAME', 'Whole body visible, feet included'],
  ALIGN: ['HOLD STILL, FACE THE CAMERA', 'Locking on to you'],
  READY: ['STRIKE A T-POSE', 'Arms straight out, level with your shoulders'],
  CALIBRATE: ['HOLD STILL', 'Measuring you']
};
const RAISE_SUB = 'The hand you swing with, straight up';
const CALIB_SECONDS = 2; // CV-6 STILL_MS; progress restarts for the 0.5 s raise-hand step
const STING_MS = 1800;

// Which of the 4 setup steps this is: 1 frame yourself, 2 T-pose, 3 hold still, 4 raise paddle hand.
function stepNumber(phase, stage) {
  if (phase === 'WAITING' || phase === 'ALIGN') return 1;
  if (phase === 'READY') return 2;
  if (phase === 'CALIBRATE') return stage === 'raise' ? 4 : 3;
  return 0;
}

// Pure: setupState -> what to show. `stage` ('still' | 'raise') is optional; older results omit it.
export function viewFor(s) {
  const phase = s && s.phase ? s.phase : 'WAITING';
  const progress = Math.min(1, Math.max(0, (s && s.progress) || 0));
  const stage = phase === 'CALIBRATE' && s && s.stage === 'raise' ? 'raise' : 'still';
  const n = stepNumber(phase, stage);
  const stepLabel = n ? `STEP ${n} OF 4` : '';
  if (phase === 'LIVE') {
    return { phase, text: 'YOU ARE LIVE', sub: '', stepLabel, ring: false, figure: false, arrow: false, outline: false, countdown: null, progress };
  }
  const [defText, defSub] = DEFAULTS[phase] || DEFAULTS.WAITING;
  const raising = phase === 'CALIBRATE' && stage === 'raise';
  const text = s && s.message ? s.message : (raising ? 'RAISE YOUR PADDLE HAND' : defText);
  return {
    phase, text, sub: raising ? RAISE_SUB : defSub, stepLabel, progress,
    ring: phase === 'READY' || phase === 'CALIBRATE',
    figure: phase === 'READY',
    arrow: raising,
    outline: phase === 'WAITING' || phase === 'ALIGN',
    countdown: phase === 'CALIBRATE' && !raising ? Math.max(1, Math.ceil((1 - progress) * CALIB_SECONDS)) : null
  };
}

const R = 90, CIRC = 2 * Math.PI * R;

const MARKUP = `
<div class="so-vignette"></div>
<div class="so-center">
  <svg class="so-outline" viewBox="0 0 200 400">
    <circle cx="100" cy="46" r="26"/>
    <path d="M100 74 V220 M100 96 H30 M100 96 H170 M100 220 L64 360 M100 220 L136 360"/>
    <path class="so-floor" d="M30 380 H170"/>
    <text x="100" y="398" text-anchor="middle">FEET ON THIS LINE</text>
  </svg>
  <div class="so-ringwrap">
    <svg class="so-ring" viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="${R}" class="so-track"/>
      <circle cx="100" cy="100" r="${R}" class="so-fill" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}" transform="rotate(-90 100 100)"/>
    </svg>
    <svg class="so-figure" viewBox="0 0 200 200">
      <circle cx="100" cy="52" r="14"/>
      <path d="M100 70 V122 M100 82 H34 M100 82 H166 M100 122 L80 172 M100 122 L120 172"/>
    </svg>
    <svg class="so-arrow" viewBox="0 0 200 200">
      <path d="M100 160 V50 M60 90 L100 48 L140 90"/>
    </svg>
    <div class="so-count"></div>
  </div>
</div>
<div class="so-bar"><div class="so-step"></div><div class="so-text"></div><div class="so-sub"></div></div>
<div class="so-sting">YOU ARE LIVE</div>`;

export function createSetupOverlay(rootEl) {
  rootEl.innerHTML = MARKUP;
  const q = s => rootEl.querySelector(s);
  const els = { fill: q('.so-fill'), ringwrap: q('.so-ringwrap'), figure: q('.so-figure'), arrow: q('.so-arrow'),
    outline: q('.so-outline'), count: q('.so-count'), step: q('.so-step'), text: q('.so-text'), sub: q('.so-sub'), sting: q('.so-sting') };
  let lastKey = null, lastCount = null, lastPhase = null, stingUntil = 0;

  function setMode(v) {
    els.step.textContent = v.stepLabel;
    els.text.textContent = v.text;
    els.sub.textContent = v.sub;
    els.ringwrap.style.display = v.ring ? '' : 'none';
    els.figure.style.display = v.figure ? '' : 'none';
    els.arrow.style.display = v.arrow ? '' : 'none';
    els.outline.style.display = v.outline ? '' : 'none';
  }

  return {
    render(setupState, tMs) {
      const v = viewFor(setupState);
      const key = v.phase + '|' + v.text + '|' + v.sub + '|' + v.stepLabel + '|' + v.arrow;
      if (key !== lastKey) {
        const enteringLive = v.phase === 'LIVE' && lastPhase !== null && lastPhase !== 'LIVE';
        if (enteringLive) { stingUntil = tMs + STING_MS; els.sting.classList.remove('go'); void els.sting.offsetWidth; els.sting.classList.add('go'); }
        if (v.phase !== 'LIVE') { els.sting.classList.remove('go'); setMode(v); }
        lastKey = key; lastPhase = v.phase;
      }
      const live = v.phase === 'LIVE';
      rootEl.dataset.phase = v.phase;
      rootEl.classList.toggle('on', !live);
      rootEl.classList.toggle('sting', live && tMs < stingUntil);
      if (!live) {
        els.fill.style.strokeDashoffset = CIRC * (1 - v.progress);
        if (v.countdown !== lastCount) { els.count.textContent = v.countdown == null ? '' : v.countdown; lastCount = v.countdown; }
      }
    }
  };
}
