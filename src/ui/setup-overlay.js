// Setup overlay: renders the setup.update() return value. DOM-free view mapping + thin DOM layer.
const DEFAULTS = {
  WAITING: ['STEP INTO FRAME', 'Whole body visible, feet included'],
  ALIGN: ['HOLD STILL, FACE THE CAMERA', 'Locking on to you'],
  READY: ['STRIKE A T-POSE', 'Arms straight out, level with your shoulders'],
  CALIBRATE: ['HOLD STILL', 'Calibrating']
};
const CALIB_SECONDS = 2; // CV-6 STILL_MS; progress restarts for the 0.5 s raise-hand step
const STING_MS = 1800;

// Pure: setupState -> what to show.
export function viewFor(s) {
  const phase = s && s.phase ? s.phase : 'WAITING';
  const progress = Math.min(1, Math.max(0, (s && s.progress) || 0));
  if (phase === 'LIVE') return { phase, text: 'YOU ARE LIVE', sub: '', ring: false, figure: false, countdown: null, progress };
  const [defText, sub] = DEFAULTS[phase] || DEFAULTS.WAITING;
  const text = s && s.message ? s.message : defText;
  return {
    phase, text, sub, progress,
    ring: phase === 'READY' || phase === 'CALIBRATE',
    figure: phase === 'READY',
    countdown: phase === 'CALIBRATE' ? Math.max(1, Math.ceil((1 - progress) * CALIB_SECONDS)) : null
  };
}

const R = 90, CIRC = 2 * Math.PI * R;

const MARKUP = `
<div class="so-vignette"></div>
<div class="so-center">
  <div class="so-ringwrap">
    <svg class="so-ring" viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="${R}" class="so-track"/>
      <circle cx="100" cy="100" r="${R}" class="so-fill" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}" transform="rotate(-90 100 100)"/>
    </svg>
    <svg class="so-figure" viewBox="0 0 200 200">
      <circle cx="100" cy="52" r="14"/>
      <path d="M100 70 V122 M100 82 H34 M100 82 H166 M100 122 L80 172 M100 122 L120 172"/>
    </svg>
    <div class="so-count"></div>
  </div>
</div>
<div class="so-bar"><div class="so-text"></div><div class="so-sub"></div></div>
<div class="so-sting">YOU ARE LIVE</div>`;

export function createSetupOverlay(rootEl) {
  rootEl.innerHTML = MARKUP;
  const q = s => rootEl.querySelector(s);
  const els = { fill: q('.so-fill'), ringwrap: q('.so-ringwrap'), figure: q('.so-figure'),
    count: q('.so-count'), text: q('.so-text'), sub: q('.so-sub'), sting: q('.so-sting') };
  let lastPhase = null, lastText = null, lastCount = null, stingUntil = 0;

  function setMode(v) {
    els.text.textContent = v.text;
    els.sub.textContent = v.sub;
    els.ringwrap.style.display = v.ring ? '' : 'none';
    els.figure.style.display = v.figure ? '' : 'none';
  }

  return {
    render(setupState, tMs) {
      const v = viewFor(setupState);
      if (v.phase !== lastPhase || v.text !== lastText) {
        const enteringLive = v.phase === 'LIVE' && lastPhase !== null && lastPhase !== 'LIVE';
        if (enteringLive) { stingUntil = tMs + STING_MS; els.sting.classList.remove('go'); void els.sting.offsetWidth; els.sting.classList.add('go'); }
        if (v.phase !== 'LIVE') els.sting.classList.remove('go');
        if (v.phase !== 'LIVE') setMode(v);
        lastPhase = v.phase; lastText = v.text;
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
