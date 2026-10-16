// brand8.js — host thinking (hand on chin), no jar. mode=bulb|warm|badge|pop|cine
(function () {
'use strict';
const W = 1920, H = 1080, B = window.__B, { glow, neon, LOOP, TAU } = B;
const MODE = (new URLSearchParams(location.search)).get('mode') || 'bulb';
function ik2b(p0, p1, l1, l2, side) {
  let dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { mid: { x: p0.x + ux * a + side * uy * h, y: p0.y + uy * a - side * ux * h }, end: { x: p0.x + ux * dd, y: p0.y + uy * dd } };
}
function stars(g, ph, n, seed, col) {
  const r = rng(seed); g.fillStyle = col || '#d6edff';
  for (let i = 0; i < n; i++) { const x = 420 + r() * 1080, y = r() * H, tw = 0.5 + 0.5 * Math.sin(ph * (1 + (i % 3)) + i); g.globalAlpha = 0.15 + 0.55 * tw * r(); g.beginPath(); g.arc(x, y, 1.5 + r() * 2.5, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
}
function bg(g, c0, c1, c2, cx, cy) { const b = g.createRadialGradient(cx || 1100, cy || 380, 60, 960, 540, 820); b.addColorStop(0, c0); b.addColorStop(0.55, c1); b.addColorStop(1, c2); g.fillStyle = b; g.fillRect(0, 0, W, H); }
function qm(g, x, y, size, a, col, rot) {
  g.save(); g.translate(x, y); g.rotate(rot || 0); g.globalAlpha = a; g.font = `900 ${size}px "Segoe UI Black","Arial Black",Impact,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = col; g.shadowBlur = size * 0.35; g.lineJoin = 'round'; g.lineWidth = size * 0.1; g.strokeStyle = 'rgba(20,10,60,0.9)'; g.strokeText('?', 0, 0);
  g.shadowBlur = 0; g.fillStyle = col; g.fillText('?', 0, 0); g.restore();
}
function sparkle(g, x, y, r, a, col) {
  g.save(); g.translate(x, y); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a; g.fillStyle = col || '#fff'; g.shadowColor = col || '#fff'; g.shadowBlur = r;
  g.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.18 : r; const an = i * Math.PI / 4; g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } g.closePath(); g.fill(); g.restore();
}
// the thinking man. o: {S, hx, hy (feet), tilt}
function man(g, t, o) {
  const ph = (t / LOOP) * TAU;
  const P = walkerPose({ phase: 0, walk: 0, headDown: (o.tilt == null ? 0.16 : o.tilt) + 0.03 * Math.sin(ph), lean: 0.03, bob: 0.6, eyeOpen: (t > 2.9 && t < 3.1) ? 0.12 : 1, eyeGlow: 0, flutter: 0.1, step: 0, time: t });
  const J = P.J, hd = P.head, tgt = { x: hd.x + 26, y: hd.y + 32 + Math.sin(ph) * 2 };
  const r = ik2b(J, tgt, 39, 39, -1); P.armF = { sh: J, elbow: r.mid, hand: r.end };
  const st = { x: o.hx, y: o.hy + Math.sin(ph) * 5, s: o.S, facing: 1, pose: P, pal: PAL_REAL, alpha: 1 };
  drawWalker(g, st);
  return walkerJoints(st).head;
}
function bulb(g, x, y, s, ph) {  // glowing idea bulb
  const pul = 1 + 0.04 * Math.sin(ph * 2);
  glow(g, x, y, 340 * s, '255,225,110', 0.5 * pul);
  g.save(); g.translate(x, y); g.scale(s * pul, s * pul);
  g.fillStyle = '#fff3a8'; g.strokeStyle = '#7a4a00'; g.lineWidth = 12; g.lineJoin = 'round'; g.shadowColor = 'rgba(255,220,90,0.95)'; g.shadowBlur = 50;
  g.beginPath(); g.arc(0, 0, 105, Math.PI * 0.78, Math.PI * 2.22); g.bezierCurveTo(70, 90, 56, 120, 56, 135); g.lineTo(-56, 135); g.bezierCurveTo(-56, 120, -70, 90, -105 * Math.cos(Math.PI * 0.22), 105 * Math.sin(Math.PI * 0.22)); g.closePath(); g.fill(); g.shadowBlur = 0; g.stroke();
  g.fillStyle = '#b8b8c8'; g.strokeStyle = '#4a4a5a'; g.lineWidth = 10;
  for (let i = 0; i < 3; i++) { g.beginPath(); g.roundRect(-52 + i * 4, 145 + i * 26, 104 - i * 8, 22, 8); g.fill(); g.stroke(); }
  g.strokeStyle = '#ff9a1f'; g.lineWidth = 9; g.beginPath(); g.moveTo(-26, 135); g.lineTo(-26, 40); g.lineTo(0, 62); g.lineTo(26, 40); g.lineTo(26, 135); g.stroke();
  g.restore();
  for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + (i - 3.5) * 0.42, r0 = 175 * s, r1 = (225 + 20 * Math.sin(ph * 2 + i)) * s; neon(g, 'rgba(255,230,120,0.95)', 9 * s, () => { g.beginPath(); g.moveTo(x + Math.cos(a) * r0, y - 10 + Math.sin(a) * r0); g.lineTo(x + Math.cos(a) * r1, y - 10 + Math.sin(a) * r1); g.stroke(); }, 18); }
}
function BULB(g, t) {
  const ph = (t / LOOP) * TAU;
  bg(g, '#4a2fb0', '#16124f', '#060720'); stars(g, ph, 70, 31);
  glow(g, 700, 940, 520, '255,90,170', 0.22);
  man(g, t, { S: 5.6, hx: 740, hy: 1650 });
  bulb(g, 1180, 300, 0.95, ph);
}
function WARM(g, t) {
  const ph = (t / LOOP) * TAU;
  bg(g, '#ffb25a', '#c4476a', '#2a1050', 1150, 360); stars(g, ph, 40, 33, '#ffe9c8');
  g.save(); g.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(1180 + Math.cos(i * 1.7) * 330, 520 + Math.sin(i * 2.3) * 260, 70 + i * 22, 0, TAU); g.fill(); } g.restore();
  man(g, t, { S: 5.8, hx: 720, hy: 1690 });
  [[1110, 330, 220, 0.95, '#fff3c8', 0.1], [1330, 210, 100, 0.7, '#ffe0a0', -0.2], [1360, 560, 80, 0.6, '#ffd0e0', 0.2]].forEach(([x, y, s, a, c, r], i) => qm(g, x, y + Math.sin(ph + i * 2) * 12, s, a, c, r));
}
function BADGE(g, t) {
  const ph = (t / LOOP) * TAU;
  bg(g, '#1c1c6a', '#0c0a35', '#050516', 960, 540); stars(g, ph, 60, 35);
  glow(g, 960, 560, 560, '127,233,255', 0.22);
  g.save(); g.translate(960, 540);
  neon(g, 'rgba(127,233,255,0.95)', 12, () => { g.beginPath(); g.arc(0, 0, 430, 0, TAU); g.stroke(); }, 30);
  neon(g, 'rgba(255,120,200,0.75)', 6, () => { g.beginPath(); g.arc(0, 0, 468 + Math.sin(ph) * 6, 0, TAU); g.stroke(); }, 20);
  g.restore();
  g.save(); g.beginPath(); g.arc(960, 540, 424, 0, TAU); g.clip(); g.fillStyle = 'rgba(30,30,110,0.5)'; g.fillRect(0, 0, W, H);
  man(g, t, { S: 5.0, hx: 750, hy: 1500 });
  qm(g, 1180, 330, 230, 1, '#7fe9ff', Math.sin(ph) * 0.06); qm(g, 1330, 600, 90, 0.6, '#ff78c8', 0.2);
  g.restore();
}
function POP(g, t) {
  const ph = (t / LOOP) * TAU;
  const b = g.createLinearGradient(0, 0, 0, H); b.addColorStop(0, '#27c6ff'); b.addColorStop(1, '#3a56ff'); g.fillStyle = b; g.fillRect(0, 0, W, H);
  g.save(); g.translate(1100, 420); g.rotate((t / LOOP) * (TAU / 14)); g.fillStyle = 'rgba(255,255,255,0.16)';
  for (let i = 0; i < 14; i++) { g.rotate(TAU / 14); g.beginPath(); g.moveTo(0, 0); g.lineTo(1500, -150); g.lineTo(1500, 150); g.closePath(); g.fill(); } g.restore();
  man(g, t, { S: 6.0, hx: 700, hy: 1730 });
  qm(g, 1210, 330, 300 * (1 + 0.04 * Math.sin(ph * 2)), 1, '#ffe14a', Math.sin(ph) * 0.06);
}
function CINE(g, t) {  // just the man: spotlight, dust, nothing else
  bg(g, '#16183a', '#0a0b1e', '#020208', 960, 380);
  g.save(); g.globalCompositeOperation = 'lighter'; const cone = g.createLinearGradient(900, 0, 900, 1000); cone.addColorStop(0, 'rgba(160,210,255,0.34)'); cone.addColorStop(1, 'rgba(160,210,255,0)');
  g.fillStyle = cone; g.beginPath(); g.moveTo(780, 0); g.lineTo(1080, 0); g.lineTo(1400, 1000); g.lineTo(380, 1000); g.closePath(); g.fill(); g.restore();
  const r = rng(41); g.fillStyle = '#cfefff';
  for (let i = 0; i < 46; i++) { const x = 500 + r() * 760, y0 = r() * H, sp = 1 + (i % 3), y = (y0 - (t / LOOP) * sp * H + H * 4) % H; g.globalAlpha = 0.1 + 0.3 * r(); g.beginPath(); g.arc(x, y, 1.5 + r() * 2.5, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
  glow(g, 880, 360, 520, '160,210,255', 0.16);
  man(g, t, { S: 5.7, hx: 800, hy: 1660 });
  const v = g.createRadialGradient(960, 540, 300, 960, 540, 800); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
}
window.drawFrame = function (g, T) {
  const t = ((T % LOOP) + LOOP) % LOOP;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
  ({ bulb: BULB, warm: WARM, badge: BADGE, pop: POP, cine: CINE }[MODE] || BULB)(g, t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
};
})();
