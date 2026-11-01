// All sounds are synthesized with WebAudio. No downloads.
let AC = null;
let master = null;

export function initAudio() {
  if (AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  master = AC.createGain();
  master.gain.value = 0.85;
  master.connect(AC.destination);
}
export function resumeAudio() {
  if (AC && AC.state === 'suspended') AC.resume();
}

function noiseBuf(sec) {
  const b = AC.createBuffer(1, Math.floor(AC.sampleRate * sec), AC.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export function grunt(p) {
  if (!AC) return;
  const t = AC.currentTime;
  const o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(190, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.35);
  f.type = 'bandpass';
  f.Q.value = 2.5;
  f.frequency.setValueAtTime(750, t);
  f.frequency.linearRampToValueAtTime(330, t + 0.35);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.2 + 0.7 * p, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  o.connect(f); f.connect(g); g.connect(master);
  o.start(t); o.stop(t + 0.45);
}

function burst(freq, dur, vol, type = 'lowpass') {
  if (!AC) return;
  const t = AC.currentTime;
  const s = AC.createBufferSource();
  s.buffer = noiseBuf(dur);
  const f = AC.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = AC.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t);
}
export const thwack = () => burst(1800, 0.09, 0.7);
export const sadClap = () => burst(2600, 0.14, 0.6, 'highpass');

export function crowd(sec = 3) {
  if (!AC) return;
  const t = AC.currentTime;
  const s = AC.createBufferSource();
  s.buffer = noiseBuf(sec);
  const f = AC.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6;
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.7, t + 0.5);
  g.gain.linearRampToValueAtTime(0.0001, t + sec);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t);
  for (let i = 0; i < 14; i++) {
    setTimeout(() => burst(2400 + Math.random() * 1500, 0.07, 0.25, 'highpass'), 200 + Math.random() * 1800);
  }
}

export function say(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.08;
    u.pitch = 0.7;
    const v = speechSynthesis.getVoices().find(v => /^en-(US|GB)/.test(v.lang));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) { /* speech is optional */ }
}
export function warmVoices() {
  try { speechSynthesis.getVoices(); } catch (e) { /* optional */ }
}
