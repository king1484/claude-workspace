// scenes.js — "What If You Could Pause Time?" (What If Labs Short, 1080x1920).
// drawFrame(g, t) is a pure function of t. Shots are cut on narration lines (timing.js); events key off word times.
(function (G) {
'use strict';
const W = 1080, H = 1920;
const L = VO.lines;
const END = VO.total + 0.55;
const clean = (s) => s.toLowerCase().replace(/[^a-z']/g, '');
function WT(line, w, n) {                       // start time of word `w` in `line` (n-th match)
  let k = n || 0;
  for (const x of WORDS) if (x.line === line && clean(x.w).startsWith(w)) { if (k-- === 0) return x.s; }
  throw new Error('word not found ' + line + ' ' + w);
}
const T = {
  snap1: WT('l2', 'snap') + 0.12,
  rain: WT('l3', 'raindrops') - 0.12,
  eat: WT('l4', 'eat'), know: WT('l4', 'nobody'),
  amazing: L.l5.s, but: WT('l5', 'but'),
  bounces: WT('l6', 'bounces'), eyes: WT('l6', 'eyes'),
  pause: WT('l7', 'pause'), frozen7: WT('l7', 'frozen'), half: WT('l7', 'halfway'),
  snap2: WT('l8', 'snap') + 0.1, black: WT('l8', 'pitch'),
  frozen9: WT('l9', 'frozen'),
  step: WT('l10', 'step'), concrete: WT('l10', 'concrete'),
  nolight: L.l11.s, nosound: WT('l11', 'sound'), fingers: WT('l11', 'you'),
  snapback: WT('l12', 'snap'), q: L.l13.s
};
G.PT_T = T;

// ------------------------------------------------------------------ small helpers
const P = (x, y) => ({ x, y });
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function lin(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
function rad(g, x, y, r0, r1, stops) { const gr = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
function glow(g, x, y, r, col, a) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a; g.fillStyle = rad(g, x, y, 0, r, [[0, col], [1, 'rgba(0,0,0,0)']]); g.fillRect(x - r, y - r, 2 * r, 2 * r); g.restore(); }
const win = (t, a, b, f) => smooth((t - a) / (f || 0.25)) * (1 - smooth((t - b + (f || 0.25)) / (f || 0.25)));
function layer(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function camera(g, cx, cy, z, rotn) { g.translate(W / 2, H / 2); if (rotn) g.rotate(rotn); g.scale(z, z); g.translate(-cx, -cy); }
function shake(t, t0, amp, dur) { const k = clamp(1 - (t - t0) / dur); if (t < t0 || k <= 0) return [0, 0]; return [Math.sin(t * 91) * amp * k * k, Math.cos(t * 77) * amp * k * k]; }
function font(wt, px) { return wt + ' ' + px + 'px "Inter", sans-serif'; }

// palettes for extras (same rig as the host)
const PAL = { blue: MASCOT.pal('blue'), green: MASCOT.pal('green'), yellow: MASCOT.pal('yellow'), purple: MASCOT.pal('purple'),
  teal: MASCOT.pal('teal'), pink: MASCOT.pal('pink'), white: MASCOT.pal('white'), orange: MASCOT.pal('orange') };
const DARK = Object.assign({}, PAL_REAL, { hood: '#0b0a12', hoodBack: '#08070d', hoodDark: '#060509', hoodLight: '#14121e', string: '#16141f',
  leg: '#08070d', legFar: '#060509', hand: '#0b0a12', handFar: '#08070d', shoe: '#08070d', shoeFar: '#060509',
  rim: '#3a3352', edge: 'rgba(0,0,0,0)', shade: 0.2 });
function host(g, st) { MASCOT.draw(g, st); }

// ------------------------------------------------------------------ city (day) — static layers cached once
const CITY = { sky: null, bld: null };
const BUILD_COLS = ['#f6b8a0', '#a8e0c8', '#ffd98a', '#c6b6f0', '#9fd2f5', '#f5a7be', '#ffe3b0', '#b9e6a6'];
function buildBuildings() {
  const c = layer(1700, 1300), g = c.getContext('2d'), R = rng(7);
  g.translate(310, 0);
  // far skyline
  for (let x = -310; x < 1390; x += 70 + R() * 60) {
    const w = 60 + R() * 90, h = 300 + R() * 420, y = 1000 - h;
    g.fillStyle = mixHex('#b9c7ef', '#d9d2f2', R()); g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let wy = y + 18; wy < 990; wy += 26) for (let wx = x + 10; wx < x + w - 10; wx += 18) if (R() > 0.45) g.fillRect(wx, wy, 7, 11);
  }
  g.fillStyle = lin(g, 0, 650, 0, 1010, [[0, 'rgba(255,226,200,0)'], [1, 'rgba(255,226,200,0.55)']]); g.fillRect(-310, 600, 1700, 420);
  // mid street facades
  let x = -300, i = 0;
  while (x < 1390) {
    const w = 190 + R() * 130, h = 520 + R() * 380, y = 1215 - h, col = BUILD_COLS[i % BUILD_COLS.length];
    g.fillStyle = mixHex(col, '#000000', 0.12); g.fillRect(x - 4, y - 14, w + 8, 18);           // cornice
    g.fillStyle = col; g.fillRect(x, y, w, h);
    g.fillStyle = lin(g, x, 0, x + w, 0, [[0, 'rgba(255,255,255,0.18)'], [0.6, 'rgba(255,255,255,0)'], [1, 'rgba(60,20,80,0.14)']]); g.fillRect(x, y, w, h);
    // windows
    const cols = Math.max(2, Math.floor(w / 70)), gw = w / cols;
    for (let wy = y + 40; wy < 1215 - 210; wy += 96) for (let k = 0; k < cols; k++) {
      const wx = x + k * gw + gw * 0.22, ww = gw * 0.56;
      g.fillStyle = mixHex(col, '#2b2450', 0.55); rr(g, wx, wy, ww, 60, 6); g.fill();
      g.fillStyle = 'rgba(190,230,255,0.75)'; rr(g, wx + 3, wy + 3, ww - 6, 54, 4); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.moveTo(wx + 6, wy + 50); g.lineTo(wx + ww * 0.55, wy + 6); g.lineTo(wx + ww * 0.75, wy + 6); g.lineTo(wx + 14, wy + 50); g.fill();
      g.fillStyle = mixHex(col, '#000000', 0.18); g.fillRect(wx - 4, wy + 60, ww + 8, 6);
    }
    // shopfront + awning
    const sy = 1215 - 190;
    g.fillStyle = mixHex(col, '#2b2450', 0.65); g.fillRect(x + 12, sy, w - 24, 190);
    g.fillStyle = 'rgba(255,236,190,0.85)'; g.fillRect(x + 22, sy + 50, w - 44, 130);
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(x + 22, sy + 50, (w - 44) * 0.3, 130);
    const aw = ['#e8505b', '#2fa36b', '#2f6fe0', '#e8782a'][i % 4];
    for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#fff6e8' : aw; g.beginPath(); const ax = x + 6 + k * (w - 12) / 8, aw2 = (w - 12) / 8; g.moveTo(ax, sy); g.lineTo(ax + aw2, sy); g.lineTo(ax + aw2, sy + 34); g.arc(ax + aw2 / 2, sy + 34, aw2 / 2, 0, Math.PI); g.fill(); }
    x += w + 6; i++;
  }
  return c;
}
function tree(g, x, y, s, t, seed) {
  const R = rng(seed), sw = Math.sin(t * 1.3 + seed) * 2;
  g.fillStyle = '#7a5236'; rr(g, x - 9 * s, y - 120 * s, 18 * s, 120 * s, 6 * s); g.fill();
  const blobs = [[0, -190, 70], [-55, -150, 52], [55, -150, 55], [-30, -230, 50], [35, -228, 48], [0, -140, 50]];
  blobs.forEach(([bx, by, br], k) => { g.fillStyle = k < 3 ? '#4fae5f' : '#5fc070'; g.beginPath(); g.arc(x + (bx + sw * (k % 2 ? 1 : -1)) * s, y + by * s, br * s, 0, TAU); g.fill(); });
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(x + (-20 + sw) * s, y - 215 * s, 26 * s, 0, TAU); g.fill();
  g.fillStyle = 'rgba(20,60,40,0.18)'; g.beginPath(); g.arc(x + 25 * s, y - 150 * s, 40 * s, 0, TAU); g.fill();
}
function lamp(g, x, y, s) {
  g.fillStyle = '#3d3a55'; rr(g, x - 5 * s, y - 330 * s, 10 * s, 330 * s, 4 * s); g.fill();
  g.beginPath(); g.moveTo(x, y - 330 * s); g.quadraticCurveTo(x, y - 360 * s, x + 40 * s, y - 360 * s); g.lineWidth = 8 * s; g.strokeStyle = '#3d3a55'; g.stroke();
  g.fillStyle = '#3d3a55'; rr(g, x + 26 * s, y - 366 * s, 40 * s, 16 * s, 6 * s); g.fill();
  g.fillStyle = '#fff2c4'; rr(g, x + 30 * s, y - 352 * s, 32 * s, 6 * s, 3 * s); g.fill();
}
function cloud(g, x, y, s, a) {
  g.save(); g.globalAlpha = a; g.fillStyle = '#ffffff';
  [[0, 0, 60], [55, 10, 46], [-55, 12, 44], [20, -30, 46], [-25, -22, 38]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, TAU); g.fill(); });
  g.fillStyle = 'rgba(190,200,240,0.35)'; g.fillRect(x - 100 * s, y + 20 * s, 200 * s, 30 * s);
  g.restore();
}
function bird(g, x, y, s, flap, dir) {
  const a = Math.sin(flap) * 0.9;
  g.save(); g.translate(x, y); g.scale(s * (dir || 1), s);
  g.fillStyle = '#5b5a78';
  g.beginPath(); g.ellipse(0, 0, 22, 11, -0.1, 0, TAU); g.fill();                  // body
  g.beginPath(); g.arc(20, -6, 9, 0, TAU); g.fill();                                // head
  g.fillStyle = '#f2a33a'; g.beginPath(); g.moveTo(28, -7); g.lineTo(38, -4); g.lineTo(28, -2); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(23, -8, 2.6, 0, TAU); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(23.8, -8, 1.4, 0, TAU); g.fill();
  g.fillStyle = '#7d7ca0';
  g.beginPath(); g.moveTo(-4, -4); g.quadraticCurveTo(-10, -30 * a - 8, -34, -44 * a - 4); g.quadraticCurveTo(-18, -10 * a, 10, -2); g.fill();   // far wing
  g.fillStyle = '#9897bd';
  g.beginPath(); g.moveTo(-2, -2); g.quadraticCurveTo(-4, -38 * a - 6, -30, -56 * a + 4); g.quadraticCurveTo(-12, -14 * a, 12, 0); g.fill();   // near wing
  g.fillStyle = '#5b5a78'; g.beginPath(); g.moveTo(-20, 0); g.lineTo(-36, -6); g.lineTo(-34, 6); g.fill();
  g.restore();
}
// freeze grade: desaturate + cool, applied over a region
function freezeGrade(g, k) {
  if (k <= 0) return;
  g.save(); g.globalCompositeOperation = 'saturation'; g.globalAlpha = 0.55 * k; g.fillStyle = '#808080'; g.fillRect(-2000, -2000, 6000, 6000);
  g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.5 * k; g.fillStyle = '#5d8cff'; g.fillRect(-2000, -2000, 6000, 6000);
  g.restore();
}
// the street at world time tw (frozen worlds pass a fixed tw); draws in world coords (1080 wide, extra margin both sides)
function street(g, tw, o) {
  o = o || {};
  if (!CITY.bld) CITY.bld = buildBuildings();
  g.fillStyle = lin(g, 0, 0, 0, 1100, [[0, '#7cc6ff'], [0.55, '#bfe3ff'], [1, '#ffe7cf']]); g.fillRect(-400, -400, 1900, 1650);
  glow(g, 860, 300, 420, 'rgba(255,240,200,0.9)', 0.5);
  for (let i = 0; i < 5; i++) cloud(g, ((i * 330 + tw * 14) % 1800) - 400, 180 + (i % 3) * 120, 0.9 + (i % 2) * 0.35, 0.9);
  g.drawImage(CITY.bld, -310, 0);
  // back sidewalk, road, front sidewalk
  g.fillStyle = '#d9d3e6'; g.fillRect(-400, 1212, 1900, 34); g.fillStyle = '#b9b2cc'; g.fillRect(-400, 1244, 1900, 8);
  g.fillStyle = lin(g, 0, 1252, 0, 1440, [[0, '#5d6078'], [1, '#6b6f88']]); g.fillRect(-400, 1252, 1900, 190);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let x = -400; x < 1500; x += 150) g.fillRect(x, 1344, 80, 8);
  for (let k = 0; k < 7; k++) { g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.moveTo(-60 + k * 52, 1262); g.lineTo(-30 + k * 52, 1262); g.lineTo(-56 + k * 62, 1438); g.lineTo(-92 + k * 62, 1438); g.fill(); }
  g.fillStyle = '#c4bdd6'; g.fillRect(-400, 1440, 1900, 16);
  g.fillStyle = lin(g, 0, 1456, 0, 1920, [[0, '#ece6f3'], [1, '#f7eadf']]); g.fillRect(-400, 1456, 1900, 700);
  g.strokeStyle = 'rgba(150,140,175,0.35)'; g.lineWidth = 3;
  for (let y = 1520; y < 2100; y += 90 + (y - 1520) * 0.25) { g.beginPath(); g.moveTo(-400, y); g.lineTo(1500, y); g.stroke(); }
  for (let x = -400; x < 1500; x += 160) { g.beginPath(); g.moveTo(x, 1456); g.lineTo(540 + (x - 540) * 1.9, 2100); g.stroke(); }
  // street furniture behind the walkers
  tree(g, 150, 1214, 1.1, tw, 1); tree(g, 960, 1214, 1.2, tw, 2); lamp(g, 560, 1216, 1.1);
  // walkers on the back sidewalk
  const walkers = [[-120, 70, PAL.blue, 1.05, 1], [300, -60, PAL.green, 1.0, -1], [700, 55, PAL.yellow, 0.95, 1], [1150, -75, PAL.purple, 1.0, -1]];
  walkers.forEach(([x0, v, pal, sp, f], i) => {
    const x = ((x0 + v * tw) % 1900 + 1900) % 1900 - 400;
    host(g, { x, y: 1236, s: 0.92, facing: f, pose: 'walk', phase: tw * sp + i * 0.3, pal, t: tw });
  });
  // a kid jumping a puddle (mid-air when frozen)
  const jp = (tw * 0.9) % 1.6, jy = jp < 0.8 ? -Math.sin(Math.PI * jp / 0.8) * 70 : 0;
  g.fillStyle = 'rgba(120,170,230,0.55)'; g.beginPath(); g.ellipse(840, 1238, 50, 9, 0, 0, TAU); g.fill();
  host(g, { x: 820 + jp * 24, y: 1236 + jy, s: 0.78, facing: 1, pose: jp < 0.8 ? 'cheer' : 'stand', t: tw, pal: PAL.pink, shadow: jy > -5 });
  // cars
  const carPal = (c, d) => Object.assign({}, PAL_REAL, { car: c, carDark: d, carLow: mixHex(d, '#000000', 0.3) });
  const cx1 = ((tw * 260) % 2200) - 500, cx2 = 1500 - ((tw * 200 + 900) % 2200);
  drawCar(g, { x: cx1, y: 1330, s: 0.82, facing: 1, wheel: tw * 9, pal: carPal('#ff8a5c', '#d0582f') });
  drawCar(g, { x: cx2, y: 1420, s: 0.95, facing: -1, wheel: -tw * 7, pal: carPal('#5ab0ff', '#2f74c8') });
  // birds crossing the sky
  for (let i = 0; i < 6; i++) {
    const bx = ((i * 260 + tw * (90 + i * 8)) % 1700) - 300, by = 520 + Math.sin(i * 2.1) * 90 + Math.sin(tw * 1.5 + i) * 10;
    bird(g, bx, by, 0.8 + (i % 3) * 0.15, tw * 13 + i, 1);
  }
  // falling leaves
  for (let i = 0; i < 9; i++) {
    const R = rng(40 + i), x = R() * 1080 + Math.sin(tw * 1.7 + i) * 40, y = ((R() * 1400 + tw * 90) % 1500) + 300;
    g.save(); g.translate(x, y); g.rotate(tw * 2 + i); g.fillStyle = i % 2 ? '#f0a43a' : '#e8644a'; g.beginPath(); g.ellipse(0, 0, 13, 6, 0, 0, TAU); g.fill(); g.restore();
  }
}

// ------------------------------------------------------------------ HUD (live clock that stops)
function hud(g, t, paused, a) {
  if (a <= 0) return;
  const sec = paused ? Math.floor(5 + T.snap1) : Math.floor(5 + t);
  const s2 = ('0' + (sec % 60)).slice(-2);
  g.save(); g.globalAlpha = a;
  g.fillStyle = 'rgba(14,12,30,0.62)'; rr(g, 60, 170, 330, 76, 38); g.fill();
  if (paused) {
    const bl = 0.55 + 0.45 * Math.cos(t * 6);
    g.fillStyle = 'rgba(120,200,255,' + bl + ')'; rr(g, 92, 192, 11, 32, 3); g.fill(); rr(g, 110, 192, 11, 32, 3); g.fill();
    g.fillStyle = '#9fdcff'; g.font = font(800, 30); g.textBaseline = 'middle'; g.fillText('PAUSED', 140, 209);
  } else {
    g.fillStyle = '#ff4d5e'; g.beginPath(); g.arc(106, 208, 10, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.font = font(800, 30); g.textBaseline = 'middle'; g.fillText('LIVE', 128, 209);
  }
  g.fillStyle = '#ffffff'; g.font = font(600, 30); g.fillText('12:41:' + s2, 262, 209);
  g.restore();
}

// ------------------------------------------------------------------ snap FX
function snapFX(g, t, t0, x, y, big) {
  const u = t - t0; if (u < 0 || u > 1.2) return;
  const r = easeOut(u / 0.7) * (big ? 1900 : 900);
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = clamp(1 - u / 0.7) * 0.9;
  g.lineWidth = 26 * (1 - clamp(u / 0.7)) + 3; g.strokeStyle = '#bfe9ff'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  g.lineWidth = 6; g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(x, y, r * 0.86, 0, TAU); g.stroke();
  for (let i = 0; i < 10; i++) {                                    // spark rays
    const a = i / 10 * TAU + 0.3, r0 = 30 + u * 260, r1 = r0 + 70 * (1 - clamp(u / 0.5));
    g.globalAlpha = clamp(1 - u / 0.45); g.lineWidth = 7; g.strokeStyle = '#fff6c8';
    g.beginPath(); g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); g.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); g.stroke();
  }
  g.restore();
  glow(g, x, y, 260, 'rgba(255,255,255,1)', clamp(1 - u / 0.25));
}

G.PT = { W, H, END, T, P, rr, lin, rad, glow, win, layer, camera, shake, font, PAL, DARK, host, street, freezeGrade, hud, snapFX, bird, cloud, WT };
})(window);
