// brand5.js — What If Labs icon variants: half-body host only. mode=wave | neon | walk | think
(function () {
'use strict';
const W = 1920, H = 1080, B = window.__B, { glow, neon, LOOP, TAU } = B;
const MODE = (new URLSearchParams(location.search)).get('mode') || 'wave';
function ik2b(p0, p1, l1, l2, side) {
  let dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { mid: { x: p0.x + ux * a + side * uy * h, y: p0.y + uy * a - side * ux * h }, end: { x: p0.x + ux * dd, y: p0.y + uy * dd } };
}
function pose(t, o) {
  o = o || {};
  const P = walkerPose({ phase: o.phase || 0, walk: o.walk || 0, headDown: o.headDown || 0, lean: o.lean == null ? 0.02 : o.lean, bob: 0.6, eyeOpen: o.eyeOpen == null ? 1 : o.eyeOpen, eyeGlow: 0, flutter: 0.1, step: 0, time: t });
  if (o.raise > 0) {
    const J = P.J, phi = lerp(0.1, 2.9, o.raise), reach = 71 + 6.4 * o.raise;
    const r = ik2b(J, { x: J.x + Math.sin(phi) * reach, y: J.y + Math.cos(phi) * reach }, 39, 39, -1);
    P.armF = { sh: J, elbow: r.mid, hand: r.end };
  }
  return P;
}
function stars(g, ph, n, seed, col) {
  const r = rng(seed); g.fillStyle = col || '#d6edff';
  for (let i = 0; i < n; i++) { const x = 420 + r() * 1080, y = r() * H, tw = 0.5 + 0.5 * Math.sin(ph * (1 + (i % 3)) + i); g.globalAlpha = 0.15 + 0.55 * tw * r(); g.beginPath(); g.arc(x, y, 1.5 + r() * 2.5, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
}
function lin(g, stops) { const bg = g.createLinearGradient(0, 0, 0, H); stops.forEach(([o, c]) => bg.addColorStop(o, c)); g.fillStyle = bg; g.fillRect(0, 0, W, H); }
function hero(g, P, S, hx, hy) {
  const j0 = walkerJoints({ x: 0, y: 0, s: S, facing: 1, pose: P });
  drawWalker(g, { x: hx - j0.head.x, y: hy - j0.head.y, s: S, facing: 1, pose: P, pal: PAL_REAL, alpha: 1 });
}
const S = 4.5;

function WAVE(g, t) {  // sunburst, friendly wave
  const ph = (t / LOOP) * TAU;
  lin(g, [[0, '#ffd23f'], [1, '#ff7a2f']]);
  g.save(); g.translate(960, 560); g.rotate((t / LOOP) * (TAU / 14));
  g.fillStyle = 'rgba(255,255,255,0.16)';
  for (let i = 0; i < 14; i++) { g.rotate(TAU / 14); g.beginPath(); g.moveTo(0, 0); g.lineTo(1500, -150); g.lineTo(1500, 150); g.closePath(); g.fill(); }
  g.restore();
  glow(g, 960, 520, 520, '255,255,230', 0.5);
  hero(g, pose(t, { raise: 0.93 + 0.1 * Math.sin(ph * 2), lean: 0.0 }), S * 1.4, 1010, 400 + Math.sin(ph) * 5);
}
function NEON(g, t) {  // dark studio, neon ring badge
  const ph = (t / LOOP) * TAU;
  lin(g, [[0, '#0a0a2a'], [1, '#1b0f45']]); stars(g, ph, 60, 3);
  glow(g, 960, 560, 560, '60,150,255', 0.28); glow(g, 960, 900, 600, '255,90,170', 0.25);
  g.save(); g.translate(960, 540);
  neon(g, 'rgba(127,233,255,0.95)', 12, () => { g.beginPath(); g.arc(0, 0, 440, 0, TAU); g.stroke(); }, 30);
  neon(g, 'rgba(255,120,200,0.8)', 6, () => { g.beginPath(); g.arc(0, 0, 480 + Math.sin(ph) * 6, 0, TAU); g.stroke(); }, 20);
  g.restore();
  g.save(); g.beginPath(); g.arc(960, 540, 432, 0, TAU); g.clip();
  g.fillStyle = 'rgba(20,24,80,0.55)'; g.fillRect(0, 0, W, H);
  hero(g, pose(t, { lean: 0.02 }), S * 1.3, 1000, 420 + Math.sin(ph) * 5);
  g.restore();
}
function WALK(g, t) {  // confident walk-cycle, sunset
  const ph = (t / LOOP) * TAU;
  lin(g, [[0, '#2a1068'], [0.55, '#e0447f'], [1, '#ff9a4a']]);
  g.save(); g.fillStyle = '#ffe9a8'; g.shadowColor = '#ffb347'; g.shadowBlur = 80; g.beginPath(); g.arc(960, 520, 400, 0, TAU); g.fill(); g.restore();
  g.save(); g.beginPath(); g.arc(960, 520, 400, 0, TAU); g.clip(); g.fillStyle = '#e0447f';
  for (let i = 0; i < 7; i++) { const y = 560 + i * 62; g.fillRect(500, y, 920, 8 + i * 5); } g.restore();
  stars(g, ph, 40, 4, '#ffd9f0');
  hero(g, pose(t, { walk: 1, phase: (t / LOOP) * 2, lean: 0.12 }), S * 1.35, 1010, 400);
}
function THINK(g, t) {  // thoughtful, floating question marks
  const ph = (t / LOOP) * TAU;
  lin(g, [[0, '#0e7a8a'], [1, '#12306b']]);
  glow(g, 960, 560, 600, '120,240,230', 0.35); stars(g, ph, 50, 6);
  B.qmark(g, 600, 320, 130, t, 'rgba(255,255,255,0.9)'); B.qmark(g, 1300, 250, 170, t + 0.8, 'rgba(255,230,120,0.95)'); B.qmark(g, 1250, 820, 90, t + 1.7, 'rgba(255,255,255,0.7)');
  g.fillStyle = 'rgba(255,255,255,0.9)'; [[1130, 430, 12], [1090, 480, 8]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y + Math.sin(ph) * 3, r, 0, TAU); g.fill(); });
  hero(g, pose(t, { headDown: 0.45, lean: 0.07 }), S * 1.35, 925, 450 + Math.sin(ph) * 5);
}
window.drawFrame = function (g, T) {
  const t = ((T % LOOP) + LOOP) % LOOP;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
  ({ wave: WAVE, neon: NEON, walk: WALK, think: THINK }[MODE] || WAVE)(g, t);
  const v = g.createRadialGradient(960, 540, 420, 960, 540, 900); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,14,0.35)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
};
})();
