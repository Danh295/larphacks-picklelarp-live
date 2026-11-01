// Broadcast effects: ball, confetti, lower-third, big text, HUD.
import { grunt, thwack, sadClap, crowd, say } from './audio.js';
import { launch as launchBall, step as stepBall, alpha as ballAlpha } from './ball.js';

const $ = id => document.getElementById(id);
let W = 1280, H = 720;
export function setSize(w, h) { W = w; H = h; }

export const balls = [];
export const confetti = [];
export const state = { dupr: 2.1, topMph: 0, honest: false };

export const proName = () => ($('name').value.trim() || 'YOU').toUpperCase();

const LINES = [
  "What a put away! That is a man with a mortgage and a dream.",
  "The crowd is on its feet. The crowd is three retirees.",
  "Textbook. I don't know which textbook.",
  "Ben Johns is watching from home. Ben Johns is scared.",
  "He has never hit a ball and it shows. In a good way.",
  "Absolutely nobody saw that coming, including the player.",
  "That is a sponsored swing. The sponsor is his mother.",
  "Pure power. Zero accuracy. Wonderful.",
  "The ball is in a different zip code.",
  "Coaches hate this one weird trick."
];
let lineOrder = [], lineIdx = 0;
function nextLine() {
  if (lineIdx >= lineOrder.length) {
    lineOrder = LINES.map((_, i) => i).sort(() => Math.random() - 0.5);
    lineIdx = 0;
  }
  return LINES[lineOrder[lineIdx++]];
}

const SPONSORS = [
  "Dink Juice, the official hydration of people who can't play",
  "Big Dill Energy Drink",
  "Third Shot Drop Insurance",
  "Paddle & Co. Therapy",
  "Retiree Rally Mortgage Brokers"
];
export function renderTicker(extra) {
  const arr = extra ? [extra, ...SPONSORS] : SPONSORS;
  const html = arr.map(s => `<span>◆</span>PICKLELARP LIVE IS BROUGHT TO YOU BY ${s.toUpperCase()}`).join('');
  $('tickTxt').innerHTML = html + html;
}

let lowT = 0;
export function lower(a, b) {
  $('lowA').textContent = a;
  $('lowB').textContent = b;
  const el = $('lower');
  el.classList.add('show');
  clearTimeout(lowT);
  lowT = setTimeout(() => el.classList.remove('show'), 4200);
}
export function big(text, color = '#fff') {
  const el = $('big');
  el.textContent = text;
  el.style.color = color;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}
export function hint(text) {
  const h = $('hint');
  h.textContent = text || '';
  h.classList.toggle('show', !!text);
}
export function updateHud() {
  $('dupr').textContent = state.dupr.toFixed(2);
  $('top').textContent = Math.round(state.topMph) + ' mph';
}

// swing event -> broadcast. `ev` follows the contract in SPEC.md:
// { type:'swing', realMph, power, wrist:{x,y}, side, t }
export function onSwing(ev) {
  const CONF = 16.5; // Confidence Coefficient
  const real = ev.realMph;
  let shown = state.honest ? real : Math.max(real * CONF, 118 + Math.random() * 28);
  shown = Math.min(shown, 199);
  grunt(Math.min(1, shown / 170));
  setTimeout(thwack, 120);
  if (shown > state.topMph) state.topMph = shown;
  state.dupr = Math.min(9.99, state.dupr + 0.3 + Math.random() * 0.45);
  updateHud();

  balls.push(launchBall(ev.wrist, ev.launch, W, H)); // leaves the hand the way the arm moved (ball.js clamps it)

  const msg = state.honest ? `${shown.toFixed(1)} mph (honest)` : `${Math.round(shown)} mph`;
  const tag = state.honest ? 'Respectable.' : (shown >= 150 ? 'WORLD RECORD' : 'FASTEST EVER');
  lower(`${proName()} · WORLD NO. 1 (SELF-REPORTED)`, `${msg} · ${tag}`);
  if (shown >= 150 && !state.honest) {
    renderTicker(SPONSORS[Math.floor(Math.random() * SPONSORS.length)] + ' (NEW SPONSOR UNLOCKED)');
  }
  setTimeout(() => say(nextLine()), 350);
}

export function boom() {
  crowd(3.2);
  for (let i = 0; i < 170; i++) {
    confetti.push({
      x: Math.random() * W, y: -20 - Math.random() * 200,
      vx: (Math.random() - 0.5) * 220, vy: 120 + Math.random() * 260,
      r: Math.random() * 6, vr: (Math.random() - 0.5) * 8,
      c: ['#d4ff1f', '#ff2d3d', '#2b6bff', '#fff', '#ffe600'][i % 5], w: 8 + Math.random() * 8
    });
  }
  big('POINT OF THE YEAR', '#d4ff1f');
  lower(proName(), 'The crowd goes wild');
  setTimeout(() => say('Ladies and gentlemen. Point of the year. He lost that point.'), 400);
}
export function sad() {
  sadClap();
  big('. . .', '#9fb0d0');
  setTimeout(() => say('A single clap. From a single man.'), 500);
}

export function drawBalls(ctx, dt) {
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    stepBall(b, dt);
    if (b.dead) { balls.splice(i, 1); continue; }
    const fade = ballAlpha(b);
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 14) b.trail.shift();
    ctx.save();
    for (let k = 0; k < b.trail.length; k++) {
      ctx.globalAlpha = k / b.trail.length * 0.5 * fade;
      ctx.fillStyle = '#d4ff1f';
      ctx.beginPath(); ctx.arc(b.trail[k].x, b.trail[k].y, 5 + k, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#d4ff1f'; ctx.strokeStyle = '#6b8000'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6b8000';
    for (const [ox, oy] of [[-8, -6], [7, -8], [0, 4], [-9, 9], [10, 7]]) {
      ctx.beginPath(); ctx.arc(b.x + ox, b.y + oy, 3, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
}
export function drawConfetti(ctx, dt) {
  for (let i = confetti.length - 1; i >= 0; i--) {
    const c = confetti[i];
    c.x += c.vx * dt; c.y += c.vy * dt; c.r += c.vr * dt;
    if (c.y > H + 30) { confetti.splice(i, 1); continue; }
    ctx.save();
    ctx.translate(c.x, c.y); ctx.rotate(c.r);
    ctx.fillStyle = c.c; ctx.fillRect(-c.w / 2, -3, c.w, 6);
    ctx.restore();
  }
}
