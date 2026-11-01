// Replay panel (UX-2): draws a frozen swing clip as a skeleton, with chunk buttons and advice.
// DOM-only glue over swing-replay.js. Landmark-only: no video frames are stored.
import { analyzeClip, CAVEAT } from './swing-replay.js';

const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
const JOINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const CHUNK_COLOR = { back: '#2b6bff', forward: '#d4ff1f', contact: '#ff2d3d', follow: '#ffffff' };
const CW = 400, CH = 300, PLAY_RATE = 0.4; // slow motion so a 0.5 s swing is readable

const MARKUP = `
<div class="rp-head"><b>SWING REPLAY</b><span class="rp-which"></span><span class="rp-close" title="Close (R)">R</span></div>
<canvas class="rp-cv" width="${CW}" height="${CH}"></canvas>
<div class="rp-chunks"></div>
<div class="rp-advice"></div>
<div class="rp-ctl">
  <button data-a="prev">‹ swing</button><button data-a="step-">◀</button><button data-a="play">Play</button><button data-a="step+">▶</button><button data-a="next">swing ›</button>
</div>
<div class="rp-note">R close · ←/→ step · ↑/↓ swing · P play · 1-4 chunk</div>
<div class="rp-note">${CAVEAT}</div>`;

export function createReplayPanel(rootEl, recorder) {
  rootEl.innerHTML = MARKUP;
  const q = s => rootEl.querySelector(s);
  const cvs = q('.rp-cv'), g = cvs.getContext('2d');
  const els = { which: q('.rp-which'), chunks: q('.rp-chunks'), advice: q('.rp-advice'), play: q('[data-a=play]') };
  const cache = new WeakMap();
  let open = false, idx = -1, frame = 0, playing = true, lastTick = 0, lastNewest = null, active = 'contact';

  const clips = () => recorder.clips();
  const clip = () => clips()[idx] || null;
  const info = c => { let a = cache.get(c); if (!a) { a = { chunks: analyzeClip(c), box: bbox(c) }; cache.set(c, a); } return a; };

  function bbox(c) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const f of c.frames) for (const i of JOINTS) {
      const p = f.P[i]; if (!p || p.v < 0.2) continue;
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    if (!isFinite(x0)) { x0 = 0; y0 = 0; x1 = 1; y1 = 1; }
    const m = 24, s = Math.min((CW - 2 * m) / Math.max(1, x1 - x0), (CH - 2 * m) / Math.max(1, y1 - y0));
    return { s, ox: (CW - s * (x1 - x0)) / 2 - s * x0, oy: (CH - s * (y1 - y0)) / 2 - s * y0 };
  }

  function chunkAt(chunks, f) {
    // contact wins ties so the single contact frame is always labelled as contact
    return (chunks.find(c => c.id === 'contact' && f === c.from) || chunks.find(c => f >= c.from && f <= c.to) || chunks[chunks.length - 1]);
  }

  function select(i) {
    if (!clips().length) { idx = -1; return; }
    idx = (i + clips().length) % clips().length;
    const a = info(clip());
    frame = a.chunks.length ? a.chunks[0].from : 0;
    playing = true; lastTick = 0;
    buildChunkButtons();
  }

  function buildChunkButtons() {
    els.chunks.innerHTML = '';
    const c = clip(); if (!c) return;
    for (const ch of info(c).chunks) {
      const b = document.createElement('button');
      b.textContent = ch.label; b.dataset.chunk = ch.id;
      b.style.borderBottomColor = CHUNK_COLOR[ch.id];
      b.onclick = () => jump(ch.id);
      els.chunks.appendChild(b);
    }
  }

  function jump(id) {
    const c = clip(); if (!c) return;
    const ch = info(c).chunks.find(x => x.id === id); if (!ch) return;
    frame = id === 'contact' ? ch.from : ch.to; playing = false; draw();
  }

  function draw() {
    const c = clip();
    g.clearRect(0, 0, CW, CH); g.fillStyle = '#0a1020'; g.fillRect(0, 0, CW, CH);
    if (!c) { els.which.textContent = ' · no swings yet'; els.advice.textContent = 'Swing at air, then press R.'; return; }
    const a = info(c), { s, ox, oy } = a.box, f = c.frames[Math.min(frame, c.frames.length - 1)];
    const X = p => p.x * s + ox, Y = p => p.y * s + oy;
    const wi = c.side === 'l' ? 15 : 16;
    // wrist trail, coloured by chunk
    g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 1; i < c.frames.length; i++) {
      g.strokeStyle = CHUNK_COLOR[chunkAt(a.chunks, i).id]; g.globalAlpha = 0.55;
      g.beginPath(); g.moveTo(X(c.frames[i - 1].P[wi]), Y(c.frames[i - 1].P[wi])); g.lineTo(X(c.frames[i].P[wi]), Y(c.frames[i].P[wi])); g.stroke();
    }
    g.globalAlpha = 1; g.lineWidth = 5; g.strokeStyle = 'rgba(212,255,31,.9)';
    for (const [p, r] of BONES) {
      const A = f.P[p], B = f.P[r]; if (!A || !B || A.v < 0.2 || B.v < 0.2) continue;
      g.beginPath(); g.moveTo(X(A), Y(A)); g.lineTo(X(B), Y(B)); g.stroke();
    }
    const W = f.P[wi]; g.fillStyle = '#fff'; g.beginPath(); g.arc(X(W), Y(W), 8, 0, 7); g.fill();
    const cur = chunkAt(a.chunks, frame); active = cur.id;
    els.which.textContent = ` · ${idx + 1}/${clips().length}${c.bad ? ' · NEEDS WORK' : (c.tips && c.tips.length ? ' · GOOD' : '')} · ${Math.round(c.mph)} mph (real) · frame ${frame + 1}/${c.frames.length}`;
    els.advice.textContent = `${cur.label}: ${cur.advice}`;
    for (const b of els.chunks.children) b.classList.toggle('on', b.dataset.chunk === active);
    els.play.textContent = playing ? 'Pause' : 'Play';
  }

  rootEl.addEventListener('click', e => {
    const a = e.target.dataset && e.target.dataset.a;
    if (e.target.classList.contains('rp-close')) return api.toggle();
    if (a) api.act(a);
    if (e.target.blur) e.target.blur();
  });

  const api = {
    isOpen: () => open,
    toggle() {
      open = !open; rootEl.classList.toggle('show', open);
      if (open) { lastNewest = clips()[clips().length - 1] || null; select(clips().length - 1); draw(); }
    },
    act(a) {
      const c = clip();
      if (a === 'prev') select(idx - 1); else if (a === 'next') select(idx + 1);
      else if (c && a === 'play') { playing = !playing; if (playing && frame >= c.frames.length - 1) frame = 0; lastTick = 0; }
      else if (c && a === 'step+') { playing = false; frame = Math.min(c.frames.length - 1, frame + 1); }
      else if (c && a === 'step-') { playing = false; frame = Math.max(0, frame - 1); }
      draw();
    },
    // Returns true if the key was used while the panel is open.
    key(e) {
      if (!open || e.metaKey || e.ctrlKey || e.altKey) return false;
      const k = e.key;
      const map = { ArrowLeft: 'step-', ArrowRight: 'step+', ArrowUp: 'prev', ArrowDown: 'next' };
      if (map[k]) api.act(map[k]);
      else if (k.toLowerCase() === 'p') api.act('play');
      else if (/^[1-4]$/.test(k)) jump(['back', 'forward', 'contact', 'follow'][+k - 1]);
      else if (k === 'Escape') api.toggle();
      else return false;
      return true;
    },
    // Called every animation frame: plays the clip in slow motion and picks up newly frozen clips.
    tick(nowMs) {
      const newest = clips()[clips().length - 1] || null;   // identity, not length: the list is capped at KEEP
      if (!open) { lastNewest = newest; return; }
      if (newest !== lastNewest) { lastNewest = newest; select(clips().length - 1); draw(); return; }
      const c = clip(); if (!c || !playing) { lastTick = 0; return; }
      if (!lastTick) { lastTick = nowMs; return; }
      const next = Math.min(c.frames.length - 1, frame + 1);
      const need = (c.frames[next].t - c.frames[frame].t) / PLAY_RATE;
      if (nowMs - lastTick >= need) {
        lastTick = nowMs;
        if (frame >= c.frames.length - 1) { playing = false; } else frame = next;
        draw();
      }
    }
  };
  return api;
}
