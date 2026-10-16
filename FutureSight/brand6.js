// brand6.js — host-holding-flask icon, 6 variants. mode=lab|warm|badge|pop|burst|cine
(function () {
'use strict';
const W = 1920, H = 1080, B = window.__B, { glow, neon, flask, FC, LOOP, TAU } = B;
const MODE = (new URLSearchParams(location.search)).get('mode') || 'lab';
function ik2b(p0, p1, l1, l2, side) {
  let dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { mid: { x: p0.x + ux * a + side * uy * h, y: p0.y + uy * a - side * ux * h }, end: { x: p0.x + ux * dd, y: p0.y + uy * dd } };
}
function pose(t, raise, lean, eyeOpen) {
  const P = walkerPose({ phase: 0, walk: 0, headDown: 0, lean: lean == null ? 0.02 : lean, bob: 0.6, eyeOpen: eyeOpen == null ? 1 : eyeOpen, eyeGlow: 0, flutter: 0.1, step: 0, time: t });
  const J = P.J, phi = lerp(0.1, 2.45, raise), reach = 71 + 6.4 * raise;
  const r = ik2b(J, { x: J.x + Math.sin(phi) * reach, y: J.y + Math.cos(phi) * reach }, 39, 39, -1);
  P.armF = { sh: J, elbow: r.mid, hand: r.end };
  return P;
}
function stars(g, ph, n, seed, col) {
  const r = rng(seed); g.fillStyle = col || '#d6edff';
  for (let i = 0; i < n; i++) { const x = 420 + r() * 1080, y = r() * H, tw = 0.5 + 0.5 * Math.sin(ph * (1 + (i % 3)) + i); g.globalAlpha = 0.15 + 0.55 * tw * r(); g.beginPath(); g.arc(x, y, 1.5 + r() * 2.5, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
}
function bg(g, c0, c1, c2, cx, cy) { const b = g.createRadialGradient(cx || 960, cy || 480, 60, 960, 540, 820); b.addColorStop(0, c0); b.addColorStop(0.55, c1); b.addColorStop(1, c2); g.fillStyle = b; g.fillRect(0, 0, W, H); }
function sparkle(g, x, y, r, a, col) {
  g.save(); g.translate(x, y); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a; g.fillStyle = col || '#fff'; g.shadowColor = col || '#fff'; g.shadowBlur = r;
  g.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.18 : r; const an = i * Math.PI / 4; g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } g.closePath(); g.fill(); g.restore();
}
function sparkles(g, cx, cy, spread, t, n, col) {
  for (let i = 0; i < n; i++) {
    const u = (((t / LOOP) * (1 + (i % 2)) + i * 0.37) % 1 + 1) % 1, an = i * 2.4 + 0.5;
    sparkle(g, cx + Math.cos(an) * spread * (0.6 + 0.5 * ((i * 0.61) % 1)), cy + Math.sin(an) * spread * 0.9 - u * 30, 12 + (i % 3) * 8, Math.sin(u * Math.PI), col);
  }
}
// host + flask position. o: {S, hx, hy (feet), raise, dx, dy (flask offset from hand), lean}
function host(g, t, o) {
  const ph = (t / LOOP) * TAU;
  const P = pose(t, (o.raise || 0.78) + 0.04 * Math.sin(ph), o.lean, (t > 2.9 && t < 3.1) ? 0.12 : 1);
  const st = { x: o.hx, y: o.hy + Math.sin(ph) * 6, s: o.S, facing: 1, pose: P, pal: PAL_REAL, alpha: 1 };
  drawWalker(g, st);
  const J = walkerJoints(st);
  const fx = J.handF.x + (o.dx == null ? 60 : o.dx), fy = J.handF.y + (o.dy == null ? -120 : o.dy) + Math.sin(ph + 1) * 7;
  return { J, fx, fy, head: J.head };
}
function setFlask(c0, c1, c2, glowC, ring) { FC.c0 = c0; FC.c1 = c1; FC.c2 = c2; FC.glow = glowC; FC.ring = ring; }
function rimLight(g, J, col, a) { glow(g, J.head.x + 120, J.head.y + 30, 330, col, a); }

function LAB(g, t) {  // refined original: cyan flask, bloom on the host, sparkles
  const ph = (t / LOOP) * TAU; setFlask('#a6fff0', '#27b6ff', '#7a3cff', '127,233,255', 'rgba(80,220,255,0.95)');
  bg(g, '#4a2fb0', '#16124f', '#060720'); stars(g, ph, 70, 7);
  glow(g, 700, 900, 520, '255,90,170', 0.25); glow(g, 1260, 330, 480, '60,150,255', 0.3);
  g.save(); g.translate(1250, 480);
  [[0.25, '120,230,255'], [-0.6, '190,130,255']].forEach(([rot, col], k) => {
    g.save(); g.rotate(rot); neon(g, `rgba(${col},0.7)`, 6, () => { g.beginPath(); g.ellipse(0, 0, 340, 115, 0, 0, TAU); g.stroke(); }, 14);
    const a = ph * (k ? -1 : 1) + k * 2.4; g.fillStyle = '#fff'; g.shadowColor = `rgba(${col},1)`; g.shadowBlur = 22; g.beginPath(); g.arc(Math.cos(a) * 340, Math.sin(a) * 115, 13, 0, TAU); g.fill(); g.restore();
  });
  g.restore();
  const h = host(g, t, { S: 5.6, hx: 740, hy: 1650 });
  rimLight(g, h.J, '127,233,255', 0.22);
  flask(g, h.fx, h.fy, 200, t); sparkles(g, h.fx, h.fy - 60, 230, t, 7, '#bff3ff');
}
function WARM(g, t) {  // warm amber/rose, green potion
  const ph = (t / LOOP) * TAU; setFlask('#eaffb0', '#38e08a', '#0a8f7a', '120,255,170', 'rgba(150,255,200,0.95)');
  bg(g, '#ffb25a', '#c4476a', '#2a1050', 1100, 360); stars(g, ph, 40, 8, '#ffe9c8');
  glow(g, 1200, 380, 520, '120,255,190', 0.28);
  g.save(); g.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(1180 + Math.cos(i * 1.7) * 330, 520 + Math.sin(i * 2.3) * 260, 70 + i * 22, 0, TAU); g.fill(); } g.restore();
  const h = host(g, t, { S: 5.8, hx: 700, hy: 1690, raise: 0.8 });
  rimLight(g, h.J, '255,230,170', 0.2);
  flask(g, h.fx, h.fy, 210, t); sparkles(g, h.fx, h.fy - 60, 240, t, 8, '#d6ffe6');
}
function BADGE(g, t) {  // neon ring badge, pink potion
  const ph = (t / LOOP) * TAU; setFlask('#ffd0f5', '#ff5fd0', '#6a3cff', '255,120,220', 'rgba(255,170,240,0.95)');
  bg(g, '#1c1c6a', '#0c0a35', '#050516'); stars(g, ph, 60, 11);
  glow(g, 960, 560, 560, '127,233,255', 0.22);
  g.save(); g.translate(960, 540);
  neon(g, 'rgba(127,233,255,0.95)', 12, () => { g.beginPath(); g.arc(0, 0, 430, 0, TAU); g.stroke(); }, 30);
  neon(g, 'rgba(255,120,200,0.75)', 6, () => { g.beginPath(); g.arc(0, 0, 468 + Math.sin(ph) * 6, 0, TAU); g.stroke(); }, 20);
  g.restore();
  g.save(); g.beginPath(); g.arc(960, 540, 424, 0, TAU); g.clip(); g.fillStyle = 'rgba(30,30,110,0.5)'; g.fillRect(0, 0, W, H);
  const h = host(g, t, { S: 5.0, hx: 745, hy: 1500 }); g.restore();
  flask(g, h.fx, h.fy, 215, t); sparkles(g, h.fx, h.fy - 60, 240, t, 7, '#ffd9f7');
}
function POP(g, t) {  // sunburst, high contrast, big flask: best at tiny sizes
  setFlask('#fff3a0', '#ff9a3a', '#e0305f', '255,200,100', 'rgba(255,240,200,1)');
  const b = g.createLinearGradient(0, 0, 0, H); b.addColorStop(0, '#2a7bff'); b.addColorStop(1, '#6a3cff'); g.fillStyle = b; g.fillRect(0, 0, W, H);
  g.save(); g.translate(1130, 440); g.rotate((t / LOOP) * (TAU / 14)); g.fillStyle = 'rgba(255,255,255,0.14)';
  for (let i = 0; i < 14; i++) { g.rotate(TAU / 14); g.beginPath(); g.moveTo(0, 0); g.lineTo(1500, -150); g.lineTo(1500, 150); g.closePath(); g.fill(); } g.restore();
  glow(g, 1150, 450, 460, '255,255,255', 0.35);
  const h = host(g, t, { S: 6.0, hx: 700, hy: 1730, raise: 0.76, dx: 70, dy: -135 });
  flask(g, h.fx, h.fy, 250, t); sparkles(g, h.fx, h.fy - 60, 280, t, 8, '#ffffff');
}
function BURST(g, t) {  // what-if icons bursting out of the flask
  const ph = (t / LOOP) * TAU; setFlask('#a6fff0', '#27b6ff', '#7a3cff', '127,233,255', 'rgba(80,220,255,0.95)');
  bg(g, '#2a1b8a', '#120d45', '#05051a'); stars(g, ph, 80, 13);
  glow(g, 700, 940, 480, '255,90,170', 0.22);
  const h = host(g, t, { S: 5.4, hx: 640, hy: 1650, dx: 40, dy: -110 });
  const fx = h.fx, fy = h.fy, items = [[B.planet, 54, 0.0, -0.9], [B.atom, 52, 0.17, -0.4], [B.bolt, 40, 0.34, -1.5], [B.hourglass, 40, 0.5, 0.1], [B.rocket, 36, 0.67, -1.1], [B.planet, 36, 0.84, 0.35]];
  items.forEach(([fn, sz, off, ang]) => {
    const u = (((t / LOOP) + off) % 1 + 1) % 1, d = 80 + u * 520, x = fx + Math.cos(ang) * d * 1.05, y = fy - 40 + Math.sin(ang) * d * 0.9 - u * 40;
    g.save(); g.globalAlpha = Math.min(1, u * 6) * Math.min(1, (1 - u) * 3); fn(g, x, y, sz * (0.5 + u * 0.7), 0); g.restore();
  });
  flask(g, fx, fy, 205, t); sparkles(g, fx, fy - 60, 230, t, 6, '#bff3ff');
}
function CINE(g, t) {  // cinematic: dark, spotlight cone, dust motes, flask lighting the host
  setFlask('#c8fff6', '#2ad0ff', '#4a3cff', '90,230,255', 'rgba(150,240,255,0.95)');
  bg(g, '#16183a', '#0a0b1e', '#020208', 960, 360);
  g.save(); g.globalCompositeOperation = 'lighter'; const cone = g.createLinearGradient(1180, 0, 1180, 900); cone.addColorStop(0, 'rgba(140,220,255,0.28)'); cone.addColorStop(1, 'rgba(140,220,255,0)');
  g.fillStyle = cone; g.beginPath(); g.moveTo(1080, 0); g.lineTo(1280, 0); g.lineTo(1650, 900); g.lineTo(720, 900); g.closePath(); g.fill(); g.restore();
  const r = rng(21); g.fillStyle = '#cfefff';
  for (let i = 0; i < 46; i++) { const x = 600 + r() * 760, y0 = r() * H, sp = 1 + (i % 3), y = (y0 - (t / LOOP) * sp * H + H * 4) % H; g.globalAlpha = 0.1 + 0.3 * r(); g.beginPath(); g.arc(x, y, 1.5 + r() * 2.5, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
  const h = host(g, t, { S: 5.6, hx: 740, hy: 1650 });
  glow(g, h.fx - 40, h.fy + 80, 520, '90,230,255', 0.34);
  glow(g, h.head.x + 90, h.head.y + 20, 260, '140,230,255', 0.2);
  flask(g, h.fx, h.fy, 205, t); sparkles(g, h.fx, h.fy - 60, 230, t, 6, '#d6f8ff');
  const v = g.createRadialGradient(960, 540, 300, 960, 540, 800); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
}
window.drawFrame = function (g, T) {
  const t = ((T % LOOP) + LOOP) % LOOP;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
  ({ lab: LAB, warm: WARM, badge: BADGE, pop: POP, burst: BURST, cine: CINE }[MODE] || LAB)(g, t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
};
})();
