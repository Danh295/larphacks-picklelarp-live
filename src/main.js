import { loadPose, detect } from './cv/pose.js';
import { createSwing, SWING_TUNE } from './cv/swing.js';
import { createSetup, SETUP_TUNE } from './cv/setup.js';
import { createSetupStub } from './ui/setup-stub.js';
import { createSetupOverlay } from './ui/setup-overlay.js';
import { createLiveHelp, NUDGE_TEXT } from './ui/live-help.js';
import { LandmarkSmoother, TUNE } from './cv/filter.js';
import { L, torsoLen } from './cv/geometry.js';
import { initAudio, resumeAudio, warmVoices } from './fx/audio.js';
import { state, setSize, renderTicker, updateHud, hint, onSwing, boom, sad, drawBalls, drawConfetti } from './fx/effects.js';

const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const stage = $('stage');
let W = 1280, H = 720;
let video = null, landmarker = null, camOK = false, started = false;
let showSkel = true;
let pose = null;     // smoothed landmarks (used by every detector)
let rawPose = null;  // raw landmarks (debug view only)
let debug = false;
const smoother = new LandmarkSmoother(W, H);
window.PLARP_FILTER = TUNE; // live tuning from the console, e.g. PLARP_FILTER.BETA = 12
window.PLARP_SWING = SWING_TUNE; // e.g. PLARP_SWING.V_FWD = 3 if real swings are missed

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* optional */ } }
};
$('name').value = store.get('plarp.name') || '';
$('name').addEventListener('input', e => store.set('plarp.name', e.target.value));

function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  stage.style.width = W * s + 'px';
  stage.style.height = H * s + 'px';
}
function resize(w, h) { W = w; H = h; cv.width = W; cv.height = H; setSize(W, H); smoother.setSize(W, H); fit(); }
resize(W, H);
addEventListener('resize', fit);
renderTicker();

// ---------- detectors ----------
const swingDet = createSwing();
const setup = new URLSearchParams(location.search).get('stub') === 'setup' ? createSetupStub() : createSetup();
const overlay = createSetupOverlay($('setup'));
const help = createLiveHelp();
let nudgeT = 0;
let setupState = { phase: 'WAITING', progress: 0, message: '', calib: null };
window.PLARP_SETUP = SETUP_TUNE; // live tuning from the console, e.g. PLARP_SETUP.TPOSE_MS = 1000

let upBoth = 0, upOne = 0, jumboCool = 0;
function jumbotron(P, now) {
  const torso = torsoLen(P), noseY = P[L.NOSE].y, lift = torso * 0.15;
  const lUp = P[L.LWR].v > 0.4 && P[L.LWR].y < noseY - lift;
  const rUp = P[L.RWR].v > 0.4 && P[L.RWR].y < noseY - lift;
  upBoth = (lUp && rUp) ? upBoth + 1 : 0;
  upOne = (lUp !== rUp) ? upOne + 1 : 0;
  if (now < jumboCool) return;
  if (upBoth >= 10) { jumboCool = now + 6000; upBoth = 0; boom(); }
  else if (upOne >= 20) { jumboCool = now + 6000; upOne = 0; sad(); }
}

function process(raw, now) {
  rawPose = raw;
  const P = smoother.update(raw, now);
  pose = P;
  setupState = setup.update(P, now);
  overlay.render(setupState, now);
  const h = help.update({ phase: setupState.phase, tMs: now });
  $('help').classList.toggle('show', h.showCard);
  if (h.nudge) { hint(NUDGE_TEXT); nudgeT = now + 5000; }
  else if (nudgeT && now > nudgeT) { hint(''); nudgeT = 0; }
  if (!P || setupState.phase !== 'LIVE') return;
  const ev = swingDet.update(P, setupState.calib, now);
  if (ev) { onSwing(ev); help.swung(now); hint(''); nudgeT = 0; }
  jumbotron(P, now);
}

// ---------- drawing ----------
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 29], [27, 31], [28, 30], [28, 32]];
function drawPose() {
  if (!pose || !showSkel) return;
  ctx.save();
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(212,255,31,.9)'; ctx.lineCap = 'round';
  for (const [a, b] of BONES) {
    if (pose[a].v < 0.3 || pose[b].v < 0.3) continue;
    ctx.beginPath(); ctx.moveTo(pose[a].x, pose[a].y); ctx.lineTo(pose[b].x, pose[b].y); ctx.stroke();
  }
  for (const i of [15, 16, 27, 28]) {
    if (pose[i].v < 0.3) continue;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(pose[i].x, pose[i].y, 7, 0, 7); ctx.fill();
  }
  if (debug && rawPose) { // raw detections in red, smoothed (above) in lime
    ctx.fillStyle = '#ff2d3d';
    for (const i of [11, 12, 15, 16, 23, 24, 27, 28]) {
      if (rawPose[i].v < 0.3) continue;
      ctx.beginPath(); ctx.arc(rawPose[i].x, rawPose[i].y, 5, 0, 7); ctx.fill();
    }
  }
  ctx.restore();
}

let lastVT = -1, prevFrame = performance.now();
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now(), dt = Math.min(0.05, (now - prevFrame) / 1000);
  prevFrame = now;
  if (camOK && video.readyState >= 2) {
    ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0, W, H); ctx.restore();
    if (landmarker && video.currentTime !== lastVT) {
      lastVT = video.currentTime;
      try { process(detect(landmarker, video, now, W, H), now); } catch (e) { console.warn('detect', e); }
    }
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#12306a'); g.addColorStop(1, '#05070f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#9fb0d0'; ctx.font = '34px Impact'; ctx.textAlign = 'center';
    ctx.fillText(started ? 'NO CAMERA · use test keys S / J / U' : '', W / 2, H / 2);
    ctx.textAlign = 'start';
  }
  drawPose();
  drawBalls(ctx, dt);
  drawConfetti(ctx, dt);
}

// ---------- controls ----------
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || !started) return;
  const k = e.key.toLowerCase();
  if (k === 's') {
    onSwing({ type: 'swing', realMph: 3 + Math.random() * 5, power: 0.6,
      wrist: { x: W * 0.55, y: H * 0.55 }, side: 'r', t: performance.now() });
    help.swung(performance.now());
  }
  if (e.key === '?') help.toggle();
  if (k === 'd') debug = !debug;
  if (k === 'f' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && window.plarp) window.plarp.toggleFullscreen();
  if (k === 'l') setupState = setup.skip(performance.now());
  if (k === 'j') boom();
  if (k === 'u') sad();
});
$('btnHonest').onclick = () => {
  state.honest = !state.honest;
  $('btnHonest').textContent = 'Honest mode: ' + (state.honest ? 'on' : 'off');
  $('btnHonest').classList.toggle('on', state.honest);
};
$('btnSkel').onclick = () => { showSkel = !showSkel; $('btnSkel').classList.toggle('on', showSkel); };

// ---------- start ----------
$('start').onclick = async () => {
  $('start').disabled = true;
  initAudio(); resumeAudio(); warmVoices();
  const st = $('status');
  try {
    st.textContent = 'Starting camera…';
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
    video = document.createElement('video');
    video.playsInline = true; video.muted = true; video.srcObject = stream;
    await video.play();
    resize(video.videoWidth || 1280, video.videoHeight || 720);
    camOK = true;
  } catch (e) {
    st.textContent = 'Camera unavailable (' + (e.name || e) + '). Continuing in test-key mode.';
    console.warn(e);
  }
  if (camOK) {
    try {
      st.textContent = 'Loading pose model…';
      landmarker = await loadPose();
    } catch (e) {
      st.textContent = 'Pose model failed to load: ' + (e.message || e);
      console.error(e);
    }
  }
  started = true;
  $('intro').style.display = 'none';
  updateHud();
  hint('');
  loop();
};
