// brand2.js — What If Labs channel icon + banner. Generic brand art (no video characters/world). Loops every 4 s.
(function () {
'use strict';
const W = 1920, H = 1080, LOOP = 4, TAU = Math.PI * 2, CYc = '127,233,255';
const MODE = (new URLSearchParams(location.search)).get('mode') || 'icon';
const glow = (g, x, y, r, c, a) => { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); g.restore(); };
function text(g, str, x, y, size, c1, c2, stroke, glowC) {
  g.save(); g.translate(x, y);
  g.font = `900 ${size}px "Segoe UI Black", "Arial Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.shadowColor = glowC; g.shadowBlur = 22; g.lineWidth = size * 0.13; g.strokeStyle = stroke; g.strokeText(str, 0, 0);
  g.shadowBlur = 0; g.shadowOffsetY = 6; g.shadowColor = 'rgba(0,0,0,0.55)'; g.strokeText(str, 0, 0); g.shadowColor = 'transparent';
  const gr = g.createLinearGradient(0, -size * 0.5, 0, size * 0.5); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
  g.fillStyle = gr; g.fillText(str, 0, 0);
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.15; g.fillStyle = '#fff'; g.fillText(str, 0, -size * 0.02);
  g.restore();
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const neon = (g, col, lw, fn, blur) => { g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = col; g.lineWidth = lw; g.shadowColor = col; g.shadowBlur = blur == null ? lw * 3 : blur; fn(); g.restore(); };

// ---- flask logo mark ----
function flaskPath(g, cx, cy, s) {
  g.beginPath();
  g.moveTo(cx - 0.17 * s, cy - 0.95 * s); g.lineTo(cx - 0.17 * s, cy - 0.4 * s); g.lineTo(cx - 0.62 * s, cy + 0.5 * s);
  g.quadraticCurveTo(cx - 0.74 * s, cy + 0.8 * s, cx - 0.48 * s, cy + 0.84 * s); g.lineTo(cx + 0.48 * s, cy + 0.84 * s);
  g.quadraticCurveTo(cx + 0.74 * s, cy + 0.8 * s, cx + 0.62 * s, cy + 0.5 * s); g.lineTo(cx + 0.17 * s, cy - 0.4 * s); g.lineTo(cx + 0.17 * s, cy - 0.95 * s);
  g.closePath();
}
const FC = { c0: '#a6fff0', c1: '#27b6ff', c2: '#7a3cff', glow: CYc, ring: 'rgba(80,220,255,0.95)' };
function flask(g, cx, cy, s, t) {
  const ph = (t / LOOP) * TAU;
  glow(g, cx, cy + 0.1 * s, s * 1.5, FC.glow, 0.35);
  g.save();
  flaskPath(g, cx, cy, s); g.save(); g.clip();
  g.fillStyle = 'rgba(8,14,40,0.75)'; g.fillRect(cx - s, cy - s, 2 * s, 2 * s);
  const ly = cy + 0.05 * s;
  const lg = g.createLinearGradient(0, ly, 0, cy + 0.85 * s); lg.addColorStop(0, FC.c0); lg.addColorStop(0.45, FC.c1); lg.addColorStop(1, FC.c2);
  g.fillStyle = lg; g.beginPath(); g.moveTo(cx - s, cy + s);
  for (let i = 0; i <= 40; i++) { const u = i / 40, x = cx - s + u * 2 * s; g.lineTo(x, ly + Math.sin(u * TAU * 2 + ph) * 0.028 * s + Math.sin(u * TAU * 3 - ph * 2) * 0.014 * s); }
  g.lineTo(cx + s, cy + s); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 9; i++) {
    const u = (((t / LOOP) * (1 + (i % 3)) + i * 0.173) % 1 + 1) % 1;
    const bx = cx + Math.sin(i * 2.4 + ph * (1 + (i % 2))) * 0.2 * s + (i - 4) * 0.045 * s, by = cy + 0.8 * s - u * 0.85 * s;
    g.globalAlpha = Math.sin(u * Math.PI) * 0.9; g.beginPath(); g.arc(bx, by, (0.025 + (i % 4) * 0.012) * s, 0, TAU); g.fill();
  }
  g.globalAlpha = 1; g.restore();
  g.font = `900 ${0.78 * s}px "Segoe UI Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(255,255,255,0.9)'; g.shadowBlur = 0.12 * s; g.fillStyle = '#fff'; g.globalAlpha = 0.92 + 0.08 * Math.sin(ph * 2);
  g.save(); flaskPath(g, cx, cy, s); g.clip(); g.fillText('?', cx, cy + 0.4 * s); g.restore(); g.globalAlpha = 1; g.shadowBlur = 0;
  flaskPath(g, cx, cy, s); g.lineJoin = 'round'; g.lineWidth = 0.075 * s; g.strokeStyle = '#eaffff'; g.shadowColor = FC.ring; g.shadowBlur = 0.2 * s; g.stroke(); g.shadowBlur = 0;
  rr(g, cx - 0.27 * s, cy - 1.03 * s, 0.54 * s, 0.1 * s, 0.05 * s); g.fillStyle = '#eaffff'; g.fill();
  g.globalAlpha = 0.5; g.lineWidth = 0.04 * s; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(cx - 0.4 * s, cy + 0.4 * s); g.lineTo(cx - 0.12 * s, cy - 0.28 * s); g.stroke(); g.globalAlpha = 1;
  g.restore();
}

// ---- floating "what-if" objects (neon vector icons) ----
function planet(g, x, y, s, t) {
  const ph = (t / LOOP) * TAU; y += Math.sin(ph) * 8; glow(g, x, y, s * 1.8, '255,120,200', 0.22);
  g.save(); g.translate(x, y); g.rotate(-0.38);
  neon(g, 'rgba(255,200,120,0.9)', s * 0.06, () => { g.beginPath(); g.ellipse(0, 0, s * 1.05, s * 0.3, 0, Math.PI, TAU); g.stroke(); }, 14);
  const pg = g.createRadialGradient(-s * 0.2, -s * 0.2, s * 0.05, 0, 0, s * 0.62); pg.addColorStop(0, '#ffd37a'); pg.addColorStop(0.55, '#ff6aa8'); pg.addColorStop(1, '#5a2bd9');
  g.fillStyle = pg; g.beginPath(); g.arc(0, 0, s * 0.6, 0, TAU); g.fill();
  neon(g, 'rgba(255,230,160,0.95)', s * 0.06, () => { g.beginPath(); g.ellipse(0, 0, s * 1.05, s * 0.3, 0, 0, Math.PI); g.stroke(); }, 14);
  g.restore();
}
function atom(g, x, y, s, t) {
  const ph = (t / LOOP) * TAU; y += Math.sin(ph + 1) * 8; glow(g, x, y, s * 1.6, CYc, 0.2);
  g.save(); g.translate(x, y);
  for (let k = 0; k < 3; k++) {
    g.save(); g.rotate(k * Math.PI / 3 + 0.2);
    neon(g, 'rgba(120,230,255,0.9)', s * 0.045, () => { g.beginPath(); g.ellipse(0, 0, s, s * 0.36, 0, 0, TAU); g.stroke(); }, 12);
    const a = ph * (k % 2 ? -1 : 1) + k * 2.1; g.fillStyle = '#fff'; g.shadowColor = '#7fe9ff'; g.shadowBlur = 16; g.beginPath(); g.arc(Math.cos(a) * s, Math.sin(a) * s * 0.36, s * 0.085, 0, TAU); g.fill();
    g.restore();
  }
  const ng = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.2); ng.addColorStop(0, '#fff'); ng.addColorStop(1, '#ff8a3c'); g.fillStyle = ng; g.shadowColor = '#ff8a3c'; g.shadowBlur = 24; g.beginPath(); g.arc(0, 0, s * 0.17, 0, TAU); g.fill();
  g.restore();
}
function bolt(g, x, y, s, t) {
  const ph = (t / LOOP) * TAU; y += Math.sin(ph + 2) * 7; const fl = 0.85 + 0.15 * Math.sin(ph * 3);
  glow(g, x, y, s * 1.6, '255,220,80', 0.25 * fl);
  g.save(); g.translate(x, y); g.beginPath(); g.moveTo(0.12 * s, -s); g.lineTo(-0.5 * s, 0.1 * s); g.lineTo(-0.06 * s, 0.1 * s); g.lineTo(-0.22 * s, s); g.lineTo(0.55 * s, -0.22 * s); g.lineTo(0.1 * s, -0.22 * s); g.closePath();
  const bg = g.createLinearGradient(0, -s, 0, s); bg.addColorStop(0, '#fffbd0'); bg.addColorStop(1, '#ffb020');
  g.shadowColor = '#ffd23f'; g.shadowBlur = 26; g.fillStyle = bg; g.fill(); g.lineJoin = 'round'; g.lineWidth = s * 0.05; g.strokeStyle = '#fff'; g.stroke(); g.restore();
}
function hourglass(g, x, y, s, t) {
  const ph = (t / LOOP) * TAU; y += Math.sin(ph + 3) * 7; glow(g, x, y, s * 1.6, '255,170,80', 0.2);
  g.save(); g.translate(x, y); g.rotate(Math.sin(ph) * 0.08);
  const tri = () => { g.beginPath(); g.moveTo(-0.55 * s, -0.95 * s); g.lineTo(0.55 * s, -0.95 * s); g.lineTo(0.04 * s, -0.02 * s); g.lineTo(0.04 * s, 0.02 * s); g.lineTo(0.55 * s, 0.95 * s); g.lineTo(-0.55 * s, 0.95 * s); g.lineTo(-0.04 * s, 0.02 * s); g.lineTo(-0.04 * s, -0.02 * s); g.closePath(); };
  g.save(); tri(); g.clip();
  const fill = (((t / LOOP) % 1) + 1) % 1;
  g.fillStyle = 'rgba(255,196,90,0.95)';
  g.fillRect(-s, -0.95 * s + fill * 0.8 * s, 2 * s, 0.8 * s * (1 - fill));
  g.fillRect(-s, 0.95 * s - fill * 0.6 * s, 2 * s, fill * 0.6 * s);
  g.fillRect(-0.015 * s, -0.05 * s, 0.03 * s, 0.9 * s);
  g.restore();
  neon(g, '#ffe2b0', s * 0.06, () => { tri(); g.stroke(); g.beginPath(); g.moveTo(-0.65 * s, -0.98 * s); g.lineTo(0.65 * s, -0.98 * s); g.moveTo(-0.65 * s, 0.98 * s); g.lineTo(0.65 * s, 0.98 * s); g.stroke(); }, 14);
  g.restore();
}
function rocket(g, x, y, s, t) {
  const ph = (t / LOOP) * TAU; y += Math.sin(ph + 4) * 9; glow(g, x, y, s * 1.5, '255,110,90', 0.18);
  g.save(); g.translate(x, y); g.rotate(0.6);
  const fl = 0.8 + 0.2 * Math.sin(ph * 6);
  const fg = g.createLinearGradient(0, 0.55 * s, 0, (1.3 + 0.25 * fl) * s); fg.addColorStop(0, '#fff3b0'); fg.addColorStop(0.5, '#ff8a2b'); fg.addColorStop(1, 'rgba(255,60,60,0)');
  g.fillStyle = fg; g.beginPath(); g.moveTo(-0.2 * s, 0.55 * s); g.quadraticCurveTo(0, (1.6 + 0.3 * fl) * s, 0.2 * s, 0.55 * s); g.closePath(); g.fill();
  g.fillStyle = '#ff5a7a'; g.beginPath(); g.moveTo(-0.3 * s, 0.1 * s); g.lineTo(-0.62 * s, 0.7 * s); g.lineTo(-0.25 * s, 0.5 * s); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(0.3 * s, 0.1 * s); g.lineTo(0.62 * s, 0.7 * s); g.lineTo(0.25 * s, 0.5 * s); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(0, -1.1 * s); g.bezierCurveTo(0.5 * s, -0.55 * s, 0.38 * s, 0.2 * s, 0.3 * s, 0.58 * s); g.lineTo(-0.3 * s, 0.58 * s); g.bezierCurveTo(-0.38 * s, 0.2 * s, -0.5 * s, -0.55 * s, 0, -1.1 * s); g.closePath();
  const bg = g.createLinearGradient(-0.4 * s, 0, 0.4 * s, 0); bg.addColorStop(0, '#d8e8ff'); bg.addColorStop(1, '#ffffff'); g.fillStyle = bg; g.shadowColor = '#9fd0ff'; g.shadowBlur = 18; g.fill(); g.shadowBlur = 0;
  g.fillStyle = '#2a7bff'; g.beginPath(); g.arc(0, -0.3 * s, 0.17 * s, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = s * 0.05; g.stroke();
  g.restore();
}
function vortex(g, x, y, s, t) {
  const ph = (t / LOOP) * TAU; y += Math.sin(ph + 5) * 6; glow(g, x, y, s * 1.7, '170,90,255', 0.28);
  g.save(); g.translate(x, y);
  for (let arm = 0; arm < 3; arm++) neon(g, arm % 2 ? 'rgba(150,120,255,0.9)' : 'rgba(120,230,255,0.9)', s * 0.05, () => {
    g.beginPath();
    for (let i = 0; i <= 60; i++) { const u = i / 60, a = u * 5.2 + arm * (TAU / 3) + ph, r = s * (0.12 + u * 0.95); const px = Math.cos(a) * r, py = Math.sin(a) * r * 0.62; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
  }, 12);
  g.fillStyle = '#05061a'; g.shadowColor = '#b06bff'; g.shadowBlur = 24; g.beginPath(); g.ellipse(0, 0, s * 0.2, s * 0.13, 0, 0, TAU); g.fill();
  g.restore();
}
function qmark(g, x, y, s, t, col) {
  const ph = (t / LOOP) * TAU; y += Math.sin(ph + 0.5) * 8;
  g.save(); g.translate(x, y); g.rotate(Math.sin(ph) * 0.06); g.font = `900 ${s}px "Segoe UI Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = s * 0.06; g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 20; g.strokeText('?', 0, 0); g.restore();
}

// ---- backdrop: deep-space gradient, drifting nebula, twinkling stars, multiverse fork tree ----
function space(g, t) {
  const ph = (t / LOOP) * TAU;
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#05061c'); bg.addColorStop(0.55, '#15104a'); bg.addColorStop(1, '#2a0f55');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  glow(g, 360 + Math.sin(ph) * 40, 240, 700, '60,120,255', 0.28);
  glow(g, 1580 + Math.cos(ph) * 40, 300, 720, '170,70,255', 0.30);
  glow(g, 960, 980 + Math.sin(ph) * 20, 900, '255,90,160', 0.20);
  glow(g, 1000, 120, 500, '40,200,255', 0.12);
  const r = rng(11); g.fillStyle = '#e4f3ff';
  for (let i = 0; i < 160; i++) { const x = r() * W, y = r() * H, sz = 0.8 + r() * 2.4, tw = 0.5 + 0.5 * Math.sin(ph * (1 + (i % 3)) + i); g.globalAlpha = 0.12 + 0.6 * tw * r(); g.beginPath(); g.arc(x, y, sz, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
}
function forkTree(g, t) {
  const ph = t / LOOP;
  const P = (x, y) => ({ x, y });
  const root = P(960, 1100);
  const L1 = [P(700, 940), P(1220, 940)];
  const L2 = [[P(560, 820), P(830, 820)], [P(1090, 820), P(1360, 820)]];
  const L3 = { 560: [P(470, 725), P(650, 725)], 830: [P(760, 725), P(900, 725)], 1090: [P(1020, 725), P(1160, 725)], 1360: [P(1270, 725), P(1450, 725)] };
  const cols = ['120,230,255', '150,120,255', '255,130,200', '255,200,110'];
  const edges = [];
  L1.forEach((a, i) => { edges.push([root, a, 0, i]); L2[i].forEach((b, j) => { edges.push([a, b, 1, (i * 2 + j) % 4]); L3[b.x].forEach((c, k) => edges.push([b, c, 2, (i * 4 + j * 2 + k) % 4])); }); });
  const curve = (a, b) => ({ cx: a.x, cy: (a.y + b.y) / 2 });
  g.save(); g.lineCap = 'round';
  edges.forEach(([a, b, d, ci], n) => {
    const c = curve(a, b); const col = cols[ci];
    g.strokeStyle = `rgba(${col},${0.32 - d * 0.05})`; g.lineWidth = 5 - d; g.shadowColor = `rgba(${col},0.9)`; g.shadowBlur = 14;
    g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo(c.cx, c.cy, b.x, b.y); g.stroke();
    const u = (ph * (d + 1) + n * 0.137) % 1, v = 1 - u;
    const px = v * v * a.x + 2 * v * u * c.cx + u * u * b.x, py = v * v * a.y + 2 * v * u * c.cy + u * u * b.y;
    g.shadowBlur = 20; g.fillStyle = '#fff'; g.beginPath(); g.arc(px, py, 5 - d, 0, TAU); g.fill();
  });
  g.shadowBlur = 24;
  edges.filter(e => e[2] === 2).forEach(([a, b, d, ci], n) => { const pu = 0.6 + 0.4 * Math.sin(ph * TAU + n); g.fillStyle = `rgba(${cols[ci]},${pu})`; g.shadowColor = `rgba(${cols[ci]},1)`; g.beginPath(); g.arc(b.x, b.y, 11, 0, TAU); g.fill(); });
  g.restore();
}

// ---- compositions ----
function ICON(g, t) {
  const cx = 960, cy = 540, ph = (t / LOOP) * TAU;
  const bg = g.createRadialGradient(cx, cy - 100, 40, cx, cy, 760); bg.addColorStop(0, '#3a2a9a'); bg.addColorStop(0.55, '#14124f'); bg.addColorStop(1, '#060720');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  glow(g, cx - 160, cy + 200, 420, '255,90,170', 0.22); glow(g, cx + 190, cy - 190, 380, '60,150,255', 0.28);
  const r = rng(7); g.fillStyle = '#d6edff';
  for (let i = 0; i < 70; i++) { const x = 420 + r() * 1080, y = r() * H, tw = 0.5 + 0.5 * Math.sin(ph * (1 + (i % 3)) + i); g.globalAlpha = 0.15 + 0.55 * tw * r(); g.beginPath(); g.arc(x, y, 1.5 + r() * 2.5, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
  g.save(); g.translate(cx, cy + 10);
  const orbits = [[0.25, '120,230,255'], [-0.55, '190,130,255'], [1.15, '255,170,120']];
  orbits.forEach(([rot, col], k) => {
    g.save(); g.rotate(rot); neon(g, `rgba(${col},0.75)`, 6, () => { g.beginPath(); g.ellipse(0, 0, 395, 135, 0, 0, TAU); g.stroke(); }, 14);
    const a = ph * (k % 2 ? -1 : 1) + k * 2.2; g.fillStyle = '#fff'; g.shadowColor = `rgba(${col},1)`; g.shadowBlur = 24; g.beginPath(); g.arc(Math.cos(a) * 395, Math.sin(a) * 135, 15, 0, TAU); g.fill(); g.restore();
  });
  g.restore();
  flask(g, cx, cy + 10, 290, t);
}
function BANNER(g, t) {
  space(g, t);
  forkTree(g, t);
  planet(g, 215, 245, 118, t); hourglass(g, 400, 575, 82, t); vortex(g, 190, 850, 120, t); bolt(g, 470, 135, 78, t);
  atom(g, 1710, 235, 118, t); rocket(g, 1565, 600, 92, t); qmark(g, 1790, 800, 190, t, 'rgba(255,140,210,0.9)'); qmark(g, 1330, 140, 80, t + 1, 'rgba(120,230,255,0.8)');
  const sc = g.createRadialGradient(960, 540, 100, 960, 540, 560); sc.addColorStop(0, 'rgba(6,8,34,0.80)'); sc.addColorStop(0.65, 'rgba(6,8,34,0.45)'); sc.addColorStop(1, 'rgba(6,8,34,0)');
  g.fillStyle = sc; g.fillRect(0, 0, W, H);
  const cy = 526;
  flask(g, 606, cy + 6, 118, t);
  text(g, 'WHAT IF', 1000, cy - 62, 104, '#fff27a', '#ff9a1f', '#0a0a1a', 'rgba(255,170,40,0.7)');
  text(g, 'LABS', 1000, cy + 36, 104, '#ffffff', '#7fe9ff', '#0a0a1a', 'rgba(80,220,255,0.8)');
  g.save(); g.font = '600 30px "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(225,245,255,0.92)'; g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 8;
  g.fillText('Wild questions. Animated answers.', 1010, cy + 112); g.restore();
  const v = g.createRadialGradient(960, 540, 600, 960, 540, 1250); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,12,0.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
}
window.__B = { space, forkTree, text, FC, flask, glow, neon, rr, LOOP, TAU, CYc, planet, atom, bolt, hourglass, rocket, vortex, qmark };
window.drawFrame = function (g, T) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
  (MODE === 'banner' ? BANNER : ICON)(g, ((T % LOOP) + LOOP) % LOOP);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
};
})();
