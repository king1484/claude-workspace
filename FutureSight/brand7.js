// brand7.js — host thinking (hand on chin), no props. thought bubble with pulsing "?"
(function () {
'use strict';
const W = 1920, H = 1080, B = window.__B, { glow, LOOP, TAU } = B;
function ik2b(p0, p1, l1, l2, side) {
  let dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { mid: { x: p0.x + ux * a + side * uy * h, y: p0.y + uy * a - side * ux * h }, end: { x: p0.x + ux * dd, y: p0.y + uy * dd } };
}
function stars(g, ph, n, seed) {
  const r = rng(seed); g.fillStyle = '#d6edff';
  for (let i = 0; i < n; i++) { const x = 420 + r() * 1080, y = r() * H, tw = 0.5 + 0.5 * Math.sin(ph * (1 + (i % 3)) + i); g.globalAlpha = 0.15 + 0.55 * tw * r(); g.beginPath(); g.arc(x, y, 1.5 + r() * 2.5, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
}
function qm(g, x, y, size, a, col, rot) {
  g.save(); g.translate(x, y); g.rotate(rot || 0); g.globalAlpha = a; g.font = `900 ${size}px "Segoe UI Black","Arial Black",Impact,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = col; g.shadowBlur = size * 0.35; g.lineJoin = 'round'; g.lineWidth = size * 0.1; g.strokeStyle = 'rgba(20,10,60,0.9)'; g.strokeText('?', 0, 0);
  g.shadowBlur = 0; g.fillStyle = col; g.fillText('?', 0, 0); g.restore();
}
function bubble(g, ph, t) {
  const cx = 1245, cy = 285, pul = 0.85 * (1 + 0.035 * Math.sin(ph * 2));
  glow(g, cx, cy, 420, '255,230,120', 0.22);
  g.save(); g.fillStyle = 'rgba(255,255,255,0.97)'; g.shadowColor = 'rgba(255,230,140,0.9)'; g.shadowBlur = 40;
  g.translate(cx, cy); g.scale(pul, pul);
  [[0, 0, 150], [-135, 20, 100], [135, 25, 105], [-70, -85, 95], [75, -90, 100], [-60, 85, 90], [70, 90, 92]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); });
  g.restore();
  g.save(); g.fillStyle = 'rgba(255,255,255,0.95)'; g.shadowColor = 'rgba(255,230,140,0.8)'; g.shadowBlur = 24;
  [[1075, 462, 20], [1040, 505, 12]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y + Math.sin(ph) * 3, r, 0, TAU); g.fill(); });
  g.restore();
  qm(g, cx, cy + 6, 250 * pul, 1, '#ff9a1f', Math.sin(ph) * 0.06);
}
window.drawFrame = function (g, T) {
  const t = ((T % LOOP) + LOOP) % LOOP, ph = (t / LOOP) * TAU;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
  const b = g.createRadialGradient(1100, 380, 60, 960, 540, 820); b.addColorStop(0, '#4a2fb0'); b.addColorStop(0.55, '#16124f'); b.addColorStop(1, '#060720'); g.fillStyle = b; g.fillRect(0, 0, W, H);
  stars(g, ph, 70, 17);
  glow(g, 700, 940, 520, '255,90,170', 0.22); glow(g, 1300, 300, 480, '60,150,255', 0.28);
  // floating small question marks
  [[560, 190, 90, 0.5, '#7fe9ff', -0.3], [1500, 560, 80, 0.55, '#c8a0ff', 0.3], [1420, 800, 60, 0.4, '#7fe9ff', 0.1]].forEach(([x, y, s, a, c, r], i) => qm(g, x, y + Math.sin(ph + i * 2) * 10, s, a, c, r));
  // pose: head slightly tilted down, front hand to chin
  const P = walkerPose({ phase: 0, walk: 0, headDown: 0.16 + 0.03 * Math.sin(ph), lean: 0.03, bob: 0.6, eyeOpen: (t > 2.9 && t < 3.1) ? 0.12 : 1, eyeGlow: 0, flutter: 0.1, step: 0, time: t });
  const J = P.J, hd = P.head, tgt = { x: hd.x + 26, y: hd.y + 32 + Math.sin(ph) * 2 };
  const r = ik2b(J, tgt, 39, 39, -1); P.armF = { sh: J, elbow: r.mid, hand: r.end };
  const st = { x: 740, y: 1650 + Math.sin(ph) * 5, s: 5.6, facing: 1, pose: P, pal: PAL_REAL, alpha: 1 };
  drawWalker(g, st);
  bubble(g, ph, t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
};
})();
