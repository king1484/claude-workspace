// ch4.js — "Money" (27.2 s). CH.ch4.draw(g, lt, dur). Pure function of lt.
// Shots: A casino wide + coin | B roulette macro (ghost ball) | C guards + clock | X thrown out | D apartment (zoom into screen)
//        E candle chart with ghost candles | F robot trader, 10 s = eternity | G printing press | H $ counter + money rain | I penthouse curtains
(function () {
'use strict';
const W = 1920, H = 1080;
const T = {
  A: 0, B: 2.45, C: 7.2, X: 8.8, D: 9.65, E: 11.6, F: 15.5, G: 18.6, Hh: 21.3, I: 24.4,
  launch: 2.75, ghostOn: 4.3, land: 6.3,
  chip0: 6.5, door: 8.7, throwT: 8.8, landX: 9.1, slam: 9.38,
};
const F_UI = '"Bahnschrift SemiBold","Segoe UI Black",sans-serif';

// ------------------------------------------------------------------ helpers
const CC = {};
function layer(key, w, h, paint) {
  if (!CC[key]) { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); CC[key] = c; }
  return CC[key];
}
function rg(g, x, y, r, stops) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  for (const s of stops) gr.addColorStop(s[0], s[1]);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}
function lg(g, x0, y0, x1, y1, stops) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  for (const s of stops) gr.addColorStop(s[0], s[1]);
  return gr;
}
function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function addMode(g, fn) { g.save(); g.globalCompositeOperation = 'lighter'; fn(); g.restore(); }
function camT(g, cx, cy, z, r, ox, oy) {
  // clamp the view centre so the cached full-frame layer always covers the screen (no grey edge strips)
  const mx = 960 / z + 14, my = 540 / z + 14;
  cx = mx >= W / 2 ? W / 2 : clamp(cx, mx, W - mx); cy = my >= H / 2 ? H / 2 : clamp(cy, my, H - my);
  g.translate(W / 2 + (ox || 0), H / 2 + (oy || 0)); if (r) g.rotate(r); g.scale(z, z); g.translate(-cx, -cy);
}
const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const PALS = {};
function mp(hex) {
  return PALS[hex] || (PALS[hex] = Object.assign({}, PAL_REAL, { hood: hex, hoodBack: mixHex(hex, '#000000', 0.28), hoodDark: mixHex(hex, '#000000', 0.45), hoodLight: mixHex(hex, '#ffffff', 0.22), string: '#cfc8bd' }));
}
function man(g, o) {
  const s = o.s == null ? 1 : o.s, fc = o.facing || 1;
  const pose = walkerPose({ phase: o.phase || 0, walk: o.walk || 0, headDown: o.headDown || 0, phone: o.phone || 0, lean: o.lean == null ? 0.06 : o.lean, bob: o.bob == null ? 1 : o.bob, eyeOpen: o.eyeOpen || 0, eyeGlow: o.eyeGlow || 0, flutter: o.flutter || 0, step: o.step || 0, time: o.t || 0 });
  const st = { x: o.x, y: o.y, s, facing: fc, pose, pal: o.pal || PAL_REAL, alpha: o.alpha == null ? 1 : o.alpha, shadow: o.shadow };
  if (!o.nodraw) drawWalker(g, st);
  return walkerJoints(st);
}
const phaseOf = (dist, s) => dist / (STRIDE * s / 0.92);
const MC = {};
function mcol(h) { return MC[h] || (MC[h] = { c: h, d: mixHex(h, '#000000', 0.42), l: mixHex(h, '#ffffff', 0.3) }); }
// cheap crowd figure (feet at x,y; height ~ 200*s)
function mini(g, x, y, s, hex, ph, face, o) {
  o = o || {}; const m = mcol(hex), run = o.run ? 1 : 0, a = Math.sin(ph * TAU) * (run ? 1.05 : 0.6);
  const lean = o.lean == null ? (run ? 12 : 3) : o.lean;
  g.save(); g.translate(x, y); g.scale(face * s, s);
  if (!o.noShadow) { g.fillStyle = 'rgba(8,3,18,0.36)'; g.beginPath(); g.ellipse(-6, 1, 34, 6, 0, 0, TAU); g.fill(); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  const leg = (aa, col) => {
    const fx = Math.sin(aa) * (28 + 12 * run), fy = -7 - Math.max(0, Math.cos(aa)) * (10 + 10 * run);
    g.strokeStyle = col; g.lineWidth = 13; g.beginPath(); g.moveTo(0, -68); g.quadraticCurveTo(fx * 0.5 + 8, -38, fx, fy); g.stroke();
  };
  leg(a + Math.PI, '#0a0710'); leg(a, '#14101c');
  const arm = (aa, col) => { g.strokeStyle = col; g.lineWidth = 11; g.beginPath(); g.moveTo(lean, -114); g.lineTo(lean + Math.sin(aa) * (run ? 30 : 20) + (run ? 8 : 0), -114 + 38 - Math.abs(Math.cos(aa)) * 4 * run); g.stroke(); };
  arm(-a + Math.PI, m.d);
  g.strokeStyle = m.c; g.lineWidth = 40; g.beginPath(); g.moveTo(1, -76); g.lineTo(lean, -108); g.stroke();
  g.strokeStyle = m.d; g.lineWidth = 6; g.beginPath(); g.moveTo(-17, -66); g.lineTo(17, -66); g.stroke();
  if (o.rim) { g.strokeStyle = 'rgba(255,179,107,0.85)'; g.lineWidth = 3.2; g.beginPath(); g.moveTo(lean + 19, -104); g.lineTo(20, -76); g.stroke(); }
  g.fillStyle = m.d; g.beginPath(); g.arc(lean - 4, -143, 22, 0, TAU); g.fill();
  g.fillStyle = '#14101c'; g.beginPath(); g.arc(lean + 2, -146, 17.5, 0, TAU); g.fill();
  arm(a, m.c);
  g.restore();
}
function bill(g, x, y, s, rot, flip, dark) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, flip);
  g.fillStyle = dark ? '#2f7a47' : '#4faa66'; g.fillRect(-28 * s, -13 * s, 56 * s, 26 * s);
  g.fillStyle = dark ? '#5aa771' : '#92d9a3'; g.fillRect(-24 * s, -9.5 * s, 48 * s, 19 * s);
  g.fillStyle = dark ? '#2f7a47' : '#4faa66'; g.beginPath(); g.arc(0, 0, 6.5 * s, 0, TAU); g.fill();
  g.restore();
}
function coinIcon(g, x, y, r, spin, a) {
  g.save(); g.globalAlpha = a == null ? 1 : a; g.translate(x, y); g.scale(Math.max(0.12, Math.abs(Math.cos(spin))), 1);
  rg(g, 0, 0, r * 1.9, [[0, 'rgba(255,214,110,0.5)'], [1, 'rgba(255,190,80,0)']]);
  g.fillStyle = lg(g, -r, -r, r, r, [[0, '#fff0a8'], [0.5, '#f2b632'], [1, '#a8700e']]); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  g.strokeStyle = '#8c5a0a'; g.lineWidth = r * 0.12; g.beginPath(); g.arc(0, 0, r * 0.78, 0, TAU); g.stroke();
  g.fillStyle = '#8c5a0a'; g.font = '900 ' + (r * 1.15) + 'px ' + F_UI; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 0, r * 0.06);
  g.restore();
}
function sparkle(g, x, y, r, a, col) {
  g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = col || 'rgba(255,240,190,' + a + ')';
  g.globalAlpha = a; g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill(); g.restore();
}
function bokeh(g, seed, n, y0, y1, cols, a0, t) {
  const r = rng(seed);
  addMode(g, () => {
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = y0 + r() * (y1 - y0), s = 18 + r() * 60, col = cols[(r() * cols.length) | 0], a = a0 * (0.6 + 0.4 * Math.sin(t * (0.6 + r()) + i));
      rg(g, x, y, s, [[0, col.replace('A', a)], [0.7, col.replace('A', a * 0.5)], [1, col.replace('A', 0)]]);
    }
  });
}

// ------------------------------------------------------------------ chart data
const CAND = (() => {
  const r = rng(4242), a = []; let p = 100;
  for (let i = 0; i < 90; i++) {
    const o = p, big = r() < 0.3 ? 2.2 : 1, d = (r() - 0.44) * 13 * big, c = o + d;
    a.push({ o, c, h: Math.max(o, c) + r() * 6, l: Math.min(o, c) - r() * 6 }); p = c;
  }
  return a;
})();

// ================================================================== A: casino
const SLOTS = [];
function casinoLayer() {
  return layer('casino', W, H, (x) => {
    SLOTS.length = 0;
    x.fillStyle = lg(x, 0, 0, 0, H, [[0, '#10050e'], [0.4, '#2a0e1c'], [1, '#12060a']]); x.fillRect(0, 0, W, H);
    // ceiling
    x.beginPath(); x.moveTo(0, 0); x.lineTo(W, 0); x.lineTo(1540, 215); x.lineTo(380, 215); x.closePath();
    x.fillStyle = lg(x, 0, 0, 0, 215, [[0, '#07020a'], [1, '#33122a']]); x.fill();
    x.strokeStyle = 'rgba(224,170,90,0.38)'; x.lineWidth = 3;
    for (const f of [0.28, 0.5, 0.68, 0.84]) { const y = 215 * f; x.beginPath(); x.moveTo(380 * f, y); x.lineTo(W - 380 * f, y); x.stroke(); }
    for (let k = 1; k < 8; k++) { x.beginPath(); x.moveTo(k * W / 8, 0); x.lineTo(lerp(380, 1540, k / 8), 215); x.stroke(); }
    // back wall
    x.fillStyle = lg(x, 0, 215, 0, 640, [[0, '#4d1626'], [1, '#2a0b17']]); x.fillRect(380, 215, 1160, 425);
    x.fillStyle = 'rgba(230,170,90,0.07)'; for (let i = 0; i < 24; i++) x.fillRect(380 + i * 49, 215, 22, 425);
    x.fillStyle = lg(x, 0, 560, 0, 640, [[0, '#2b1210'], [1, '#170807']]); x.fillRect(380, 560, 1160, 80);
    x.fillStyle = 'rgba(224,170,90,0.6)'; x.fillRect(380, 556, 1160, 4);
    // gilded frames
    for (const fx of [455, 1235]) {
      x.fillStyle = '#c99a3c'; rr(x, fx, 290, 235, 215, 8); x.fill();
      x.fillStyle = lg(x, fx, 300, fx + 215, 495, [[0, '#2b1830'], [1, '#6a2e44']]); rr(x, fx + 10, 300, 215, 195, 4); x.fill();
      x.fillStyle = 'rgba(255,190,120,0.18)'; x.beginPath(); x.moveTo(fx + 30, 495); x.lineTo(fx + 120, 300); x.lineTo(fx + 150, 300); x.lineTo(fx + 60, 495); x.fill();
    }
    // sunburst ornament (clock is drawn dynamic on top)
    x.save(); x.translate(960, 335);
    for (let i = 0; i < 24; i++) { x.rotate(TAU / 24); x.fillStyle = i % 2 ? '#d9a844' : '#a87a22'; x.beginPath(); x.moveTo(0, -128); x.lineTo(7, -156); x.lineTo(-7, -156); x.closePath(); x.fill(); }
    x.restore();
    // exit door (back wall, right)
    x.fillStyle = '#1a0a0e'; x.fillRect(1405, 372, 124, 268);
    x.fillStyle = lg(x, 0, 380, 0, 640, [[0, '#2f6f4c'], [1, '#143826']]); x.fillRect(1415, 382, 104, 258);
    x.fillStyle = '#c99a3c'; x.fillRect(1405, 366, 124, 8);
    x.fillStyle = '#12c46a'; rr(x, 1432, 330, 70, 30, 6); x.fill();
    x.fillStyle = '#eafff3'; x.beginPath(); x.moveTo(1444, 345); x.lineTo(1466, 345); x.lineTo(1466, 337); x.lineTo(1488, 345); x.lineTo(1466, 353); x.lineTo(1466, 345); x.fill();
    // side walls
    x.beginPath(); x.moveTo(0, 0); x.lineTo(380, 215); x.lineTo(380, 640); x.lineTo(0, 880); x.closePath();
    x.fillStyle = lg(x, 0, 0, 380, 0, [[0, '#1a0812'], [1, '#341224']]); x.fill();
    x.beginPath(); x.moveTo(W, 0); x.lineTo(1540, 215); x.lineTo(1540, 640); x.lineTo(W, 880); x.closePath();
    x.fillStyle = lg(x, W, 0, 1540, 0, [[0, '#1a0812'], [1, '#341224']]); x.fill();
    // floor
    x.beginPath(); x.moveTo(0, 880); x.lineTo(380, 640); x.lineTo(1540, 640); x.lineTo(W, 880); x.lineTo(W, H); x.lineTo(0, H); x.closePath();
    x.fillStyle = lg(x, 0, 640, 0, H, [[0, '#331018'], [0.5, '#2a0c14'], [1, '#12050a']]); x.fill();
    x.save(); x.clip();
    for (let j = 0; j < 14; j++) {
      const f = j / 13, yy = 640 + 440 * Math.pow(f, 1.7), yn = 640 + 440 * Math.pow((j + 1) / 13, 1.7), cw = lerp(70, 250, Math.pow(f, 1.2));
      for (let xx = -cw; xx < W + cw; xx += cw) {
        const cx = xx + ((j & 1) ? cw / 2 : 0), my = (yy + yn) / 2;
        x.fillStyle = 'rgba(190,70,50,0.16)'; x.beginPath(); x.moveTo(cx, yy); x.lineTo(cx + cw / 2, my); x.lineTo(cx, yn); x.lineTo(cx - cw / 2, my); x.closePath(); x.fill();
        x.strokeStyle = 'rgba(230,170,90,0.14)'; x.lineWidth = 2; x.stroke();
      }
    }
    x.restore();
    // slot machines along both walls
    const slot = (sx, sy, k, hue, left) => {
      const w = 130 * k, h = 270 * k;
      x.fillStyle = 'rgba(8,2,10,0.5)'; x.beginPath(); x.ellipse(sx, sy + 4, w * 0.62, 10 * k, 0, 0, TAU); x.fill();
      x.fillStyle = lg(x, sx - w / 2, 0, sx + w / 2, 0, [[0, '#3a1850'], [1, '#150a24']]); rr(x, sx - w / 2, sy - h, w, h, 10 * k); x.fill();
      x.fillStyle = '#c99a3c'; x.fillRect(sx - w / 2, sy - h + 8 * k, w, 5 * k);
      const scr = { x: sx - w * 0.38, y: sy - h * 0.8, w: w * 0.76, h: h * 0.27 };
      x.fillStyle = hue; rr(x, scr.x, scr.y, scr.w, scr.h, 4 * k); x.fill();
      x.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 1; i < 3; i++) x.fillRect(scr.x + scr.w * i / 3 - 1, scr.y, 2, scr.h);
      x.fillStyle = '#ffe9a0'; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(sx - w * 0.36 + i * w * 0.144, sy - h + 4 * k, 3.4 * k, 0, TAU); x.fill(); }
      x.fillStyle = '#0b0511'; x.fillRect(sx - w * 0.42, sy - h * 0.42, w * 0.84, h * 0.1);
      x.fillStyle = '#e04a58'; x.beginPath(); x.arc(sx + (left ? w * 0.58 : -w * 0.58), sy - h * 0.62, 7 * k, 0, TAU); x.fill();
      x.strokeStyle = '#9a96ac'; x.lineWidth = 4 * k; x.beginPath(); x.moveTo(sx + (left ? w * 0.5 : -w * 0.5), sy - h * 0.5); x.lineTo(sx + (left ? w * 0.58 : -w * 0.58), sy - h * 0.62); x.stroke();
      SLOTS.push({ x: scr.x, y: scr.y, w: scr.w, h: scr.h, hue, s: SLOTS.length });
    };
    const hues = ['#3ad0c4', '#ff6aa0', '#ffd24a', '#7a6aff', '#5ae08a'];
    [[32, 0.0], [140, 0.28], [236, 0.52], [312, 0.72]].forEach((p, i) => { const k = lerp(1.2, 0.5, p[1]), yy = 880 - 240 * (p[0] / 380) + 20 - 20 * p[1]; slot(p[0], yy + 6, k, hues[i % 5], true); });
    [[W - 32, 0.0], [W - 140, 0.28], [W - 236, 0.52], [W - 312, 0.72]].forEach((p, i) => { const k = lerp(1.2, 0.5, p[1]), yy = 880 - 240 * ((W - p[0]) / 380) + 20 - 20 * p[1]; slot(p[0], yy + 6, k, hues[(i + 2) % 5], false); });
    // chandeliers
    [[480, 120, 1.0], [960, 88, 1.25], [1440, 120, 1.0]].forEach((c) => {
      x.strokeStyle = '#c99a3c'; x.lineWidth = 4; x.beginPath(); x.moveTo(c[0], 0); x.lineTo(c[0], c[1] - 30 * c[2]); x.stroke();
      for (let i = 0; i < 3; i++) { const w = (96 - i * 26) * c[2], yy = c[1] - 22 * c[2] + i * 28 * c[2]; x.fillStyle = i % 2 ? '#e8c260' : '#b8862a'; x.beginPath(); x.ellipse(c[0], yy, w, 12 * c[2], 0, 0, TAU); x.fill(); }
      x.fillStyle = '#fff4c8'; for (let i = -4; i <= 4; i++) { x.beginPath(); x.arc(c[0] + i * 21 * c[2], c[1] + 10 * c[2] + Math.abs(i) * 2, 5 * c[2], 0, TAU); x.fill(); }
    });
    // light pools on the floor
    x.save(); x.globalCompositeOperation = 'screen';
    [[480, 800], [960, 780], [1440, 800]].forEach((p) => { x.save(); x.translate(p[0], p[1]); x.scale(1, 0.25); rg(x, 0, 0, 340, [[0, 'rgba(255,170,90,0.36)'], [1, 'rgba(255,170,90,0)']]); x.restore(); });
    x.restore();
  });
}
function casinoDyn(g, lt, clk) {
  casinoLayer();
  addMode(g, () => {
    [[480, 130, 1.0], [960, 100, 1.25], [1440, 130, 1.0]].forEach((c, i) => {
      const f = 0.85 + 0.15 * Math.sin(lt * 7 + i * 2) + (hash1(Math.floor(lt * 14) + i * 9) < 0.06 ? -0.2 : 0);
      rg(g, c[0], c[1], 260 * c[2], [[0, 'rgba(255,205,120,' + 0.55 * f + ')'], [0.3, 'rgba(255,170,90,' + 0.2 * f + ')'], [1, 'rgba(255,150,80,0)']]);
    });
    for (const s of SLOTS) {
      const on = hash1(Math.floor(lt * 5 + s.s * 3.1)) < 0.8 ? 1 : 0.35;
      rg(g, s.x + s.w / 2, s.y + s.h / 2, s.w * 0.9, [[0, 'rgba(255,255,255,' + 0.1 * on + ')'], [0.4, s.hue.replace('#', 'rgba(').length ? 'rgba(255,200,160,' + 0.12 * on + ')' : '', ], [1, 'rgba(255,200,160,0)']]);
    }
  });
  // wall clock on the sunburst
  const cx = 960, cy = 335, r = 100;
  g.save();
  g.fillStyle = '#6b4710'; g.beginPath(); g.arc(cx, cy, r + 14, 0, TAU); g.fill();
  g.fillStyle = lg(g, cx - r, cy - r, cx + r, cy + r, [[0, '#ffe9a8'], [1, '#c9953a']]); g.beginPath(); g.arc(cx, cy, r + 8, 0, TAU); g.fill();
  g.fillStyle = '#fbf4e2'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
  g.strokeStyle = '#3a2a1a'; g.lineCap = 'round';
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.lineWidth = i % 3 ? 3 : 6; g.beginPath(); g.moveTo(cx + Math.sin(a) * r * 0.82, cy - Math.cos(a) * r * 0.82); g.lineTo(cx + Math.sin(a) * r * 0.93, cy - Math.cos(a) * r * 0.93); g.stroke(); }
  const ma = clk.min * TAU, ha = clk.min * TAU / 12 + clk.h0;
  if (clk.blur > 0.01) { g.fillStyle = 'rgba(214,58,58,' + 0.26 * clk.blur + ')'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r * 0.8, ma - Math.PI / 2 - 1.5, ma - Math.PI / 2); g.closePath(); g.fill(); }
  g.lineWidth = 9; g.strokeStyle = '#2a1c14'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(ha) * r * 0.5, cy - Math.cos(ha) * r * 0.5); g.stroke();
  g.lineWidth = 5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(ma) * r * 0.78, cy - Math.cos(ma) * r * 0.78); g.stroke();
  g.fillStyle = '#d63a3a'; g.beginPath(); g.arc(cx, cy, 8, 0, TAU); g.fill();
  g.restore();
}
function tableA(g, lt) {
  const cx = 1040, cy = 790, rx = 380, ry = 74;
  g.save();
  // apron
  g.beginPath(); g.moveTo(cx - rx, cy); g.lineTo(cx - rx, cy + 74); g.ellipse(cx, cy + 74, rx, ry, 0, Math.PI, 0, true); g.lineTo(cx + rx, cy); g.closePath();
  g.fillStyle = lg(g, 0, cy, 0, cy + 150, [[0, '#6a3218'], [1, '#2a1008']]); g.fill();
  g.fillStyle = 'rgba(255,170,100,0.35)'; g.fillRect(cx + rx - 5, cy, 5, 74);
  // felt
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fillStyle = lg(g, cx - rx, cy, cx + rx, cy, [[0, '#14603a'], [0.5, '#1f8250'], [1, '#12563a']]); g.fill();
  g.lineWidth = 12; g.strokeStyle = '#6a3a1c'; g.stroke();
  g.lineWidth = 3; g.strokeStyle = 'rgba(240,200,120,0.5)'; g.beginPath(); g.ellipse(cx, cy, rx - 14, ry - 8, 0, 0, TAU); g.stroke();
  // betting cells
  for (let i = 0; i < 8; i++) { const px = cx + 40 + i * 38 - 6, py = cy - 22 + (i % 2) * 22; g.fillStyle = i % 2 ? 'rgba(210,40,50,0.7)' : 'rgba(10,10,14,0.7)'; g.fillRect(px, py, 30, 18); }
  // wheel (left end)
  const wx = 840, wy = 782;
  g.fillStyle = '#4a2410'; g.beginPath(); g.ellipse(wx, wy + 8, 98, 36, 0, 0, TAU); g.fill();
  g.fillStyle = '#7a4420'; g.beginPath(); g.ellipse(wx, wy, 98, 36, 0, 0, TAU); g.fill();
  const th = lt * 2.2;
  for (let i = 0; i < 18; i++) { const a0 = th + i / 18 * TAU, a1 = th + (i + 1) / 18 * TAU; g.fillStyle = i === 0 ? '#1d8a50' : (i & 1 ? '#c42a36' : '#14101c'); g.beginPath(); g.moveTo(wx + Math.cos(a0) * 38, wy + Math.sin(a0) * 13); g.lineTo(wx + Math.cos(a0) * 80, wy + Math.sin(a0) * 28); g.lineTo(wx + Math.cos(a1) * 80, wy + Math.sin(a1) * 28); g.lineTo(wx + Math.cos(a1) * 38, wy + Math.sin(a1) * 13); g.closePath(); g.fill(); }
  g.fillStyle = '#d8b04a'; g.beginPath(); g.ellipse(wx, wy - 2, 26, 9, 0, 0, TAU); g.fill();
  g.restore();
}
function shotA(g, lt) {
  const u = lt / T.B;
  g.save(); camT(g, 930, 640, 1.0 + 0.1 * smooth(u), 0.0, 0, 0);
  g.drawImage(casinoLayer(), 0, 0);
  casinoDyn(g, lt, { min: lt * 0.02, h0: 2.6, blur: 0 });
  // patrons at the slots / back
  mini(g, 640, 668, 0.62, '#3b6ea8', lt * 0.7, 1, { noShadow: false });
  mini(g, 700, 676, 0.6, '#8a5aa8', lt * 0.7 + 0.3, -1, {});
  mini(g, 1330, 672, 0.6, '#2f9d8a', lt * 0.8, -1, {});
  mini(g, 1190, 666, 0.58, '#d9a02e', lt * 0.65 + 0.5, 1, {});
  // dealer
  const dsh = clamp(spring(lt - 1.9, 120, 16));
  man(g, { x: 1090, y: 758, s: 0.82, facing: -1, pal: mp('#d4cfe3'), lean: 0.02, step: 0, t: lt, headDown: 0.1, bob: 0.4 });
  tableA(g, lt);
  // hero walks in
  const hx = -150 + 310 * Math.min(lt, 2.15), walk = smooth(1 - (lt - 2.0) / 0.45);
  man(g, { x: hx, y: 960, s: 1.12, facing: 1, walk: lt < 2.45 ? walk : 0, phase: phaseOf(hx, 1.12), lean: 0.1, t: lt, flutter: 0.2 });
  // coin icon pops over his head, then flies to the table
  const pop = spring(lt - 0.5, 200, 15), fly = easeIn(clamp((lt - 1.95) / 0.5));
  if (pop > 0.01) {
    const bx = hx + 40, by = 560 - 14 * Math.sin(lt * 4);
    const cx2 = lerp(bx, 880, fly), cy2 = lerp(by, 770, fly) - 120 * Math.sin(fly * Math.PI);
    coinIcon(g, cx2, cy2, 52 * pop * (1 - 0.5 * fly), lt * 7, 1);
    for (let i = 0; i < 4; i++) sparkle(g, cx2 + Math.cos(lt * 3 + i * 1.6) * 80, cy2 + Math.sin(lt * 3 + i * 1.6) * 60, 11, 0.5 + 0.5 * Math.sin(lt * 9 + i), '');
  }
  g.restore();
  // foreground slot silhouette + bokeh
  g.save();
  const fx = 1690 - 12 * lt;
  g.fillStyle = '#07030c'; rr(g, fx, 330, 400, 900, 26); g.fill();
  g.fillStyle = '#12091c'; rr(g, fx + 30, 360, 340, 320, 16); g.fill();
  addMode(g, () => { rg(g, fx + 200, 520, 300, [[0, 'rgba(255,110,160,0.35)'], [1, 'rgba(255,110,160,0)']]); });
  g.fillStyle = 'rgba(255,106,160,0.85)'; rr(g, fx + 50, 400, 300, 120, 10); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(fx + 100 + i * 100, 460, 28, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(255,179,107,0.7)'; g.lineWidth = 3; g.beginPath(); g.moveTo(fx + 2, 346); g.lineTo(fx + 2, 700); g.stroke();
  g.restore();
  bokeh(g, 31, 9, 80, 700, ['rgba(255,200,120,A)', 'rgba(255,150,100,A)'], 0.13, lt);
}

// ================================================================== B: roulette macro
const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const WH = { cx: 900, cy: 400, R: 440, ky: 0.42 };
const IW = 21, PK = TAU / 37;
const wheelAng = (lt) => 0.9 * lt + 0.4;
function ballState(lt) {
  const t0 = T.launch, tL = T.land;
  const th = wheelAng(lt), phiK = (IW + 0.5) * PK;
  let psi, rb, hop = 0;
  if (lt < t0) return null;
  if (lt < tL) {
    const u = (tL - lt) / (tL - t0);
    psi = phiK + (TAU * 6.2) * Math.pow(u, 1.75);
    const fall = smooth((lt - (tL - 1.6)) / 1.35);
    rb = lerp(404, 318, fall);
    const k = clamp((tL - lt) / 0.9);
    if (k < 1) { psi += 0.11 * Math.sin((tL - lt) * 17) * k; hop = Math.abs(Math.sin((tL - lt) * 13)) * 22 * k; rb += 8 * Math.sin((tL - lt) * 21) * k; }
  } else { psi = phiK; rb = 318; }
  return { a: th + psi, r: rb, hop, lift: lt < t0 + 0.12 ? 0 : 0 };
}
const wpt = (r, a) => ({ x: WH.cx + r * Math.cos(a), y: WH.cy + r * Math.sin(a) * WH.ky });
function feltLayer() {
  return layer('felt', W, H, (x) => {
    x.fillStyle = lg(x, 0, 0, 0, 570, [[0, '#0c0409'], [1, '#2a0e16']]); x.fillRect(0, 0, W, 580);
    // back-wall bokeh
    const r = rng(77);
    for (let i = 0; i < 26; i++) { const bx = r() * W, by = 60 + r() * 460, s = 24 + r() * 70; rg(x, bx, by, s, [[0, 'rgba(255,190,110,0.16)'], [1, 'rgba(255,170,100,0)']]); }
    // rail
    x.fillStyle = lg(x, 0, 540, 0, 600, [[0, '#7a3d1a'], [0.5, '#4a2210'], [1, '#2a1008']]); x.fillRect(0, 540, W, 60);
    x.fillStyle = 'rgba(255,200,130,0.5)'; x.fillRect(0, 540, W, 3);
    // felt
    x.fillStyle = lg(x, 0, 596, 0, H, [[0, '#0d4a2c'], [0.4, '#18704a'], [1, '#0b3a24']]); x.fillRect(0, 596, W, H - 596);
    x.fillStyle = lg(x, 0, 0, W, 0, [[0, 'rgba(0,0,0,0.5)'], [0.25, 'rgba(0,0,0,0)'], [0.75, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.5)']]); x.fillRect(0, 596, W, H - 596);
    // betting grid (perspective)
    const yT = 700, yB = 1010, xTl = 640, xTr = 1330, xBl = 400, xBr = 1570;
    const P = (u, v) => ({ x: lerp(lerp(xTl, xTr, u), lerp(xBl, xBr, u), v), y: lerp(yT, yB, v) });
    for (let c = 0; c < 12; c++) for (let rI = 0; rI < 3; rI++) {
      const a = P(c / 12, rI / 3), b = P((c + 1) / 12, rI / 3), d = P((c + 1) / 12, (rI + 1) / 3), e = P(c / 12, (rI + 1) / 3);
      const num = c * 3 + rI + 1; x.fillStyle = REDS.has(num) ? '#b3202e' : '#14101c';
      x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.lineTo(d.x, d.y); x.lineTo(e.x, e.y); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(245,240,225,0.8)'; x.lineWidth = 3; x.stroke();
      x.fillStyle = 'rgba(245,240,225,0.78)'; const m = P((c + 0.5) / 12, (rI + 0.5) / 3); x.beginPath(); x.ellipse(m.x, m.y, 9 + 4 * (rI / 3), 5 + 3 * (rI / 3), 0, 0, TAU); x.fill();
    }
    const z0 = P(-0.07, 0), z1 = P(0, 0), z2 = P(0, 1), z3 = P(-0.07, 1);
    x.fillStyle = '#1b8a50'; x.beginPath(); x.moveTo(z0.x, z0.y); x.lineTo(z1.x, z1.y); x.lineTo(z2.x, z2.y); x.lineTo(z3.x, z3.y); x.closePath(); x.fill(); x.strokeStyle = 'rgba(245,240,225,0.8)'; x.lineWidth = 3; x.stroke();
    x.save(); x.globalCompositeOperation = 'multiply'; x.fillStyle = lg(x, 0, 0, 0, H, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(120,150,130,1)']]); x.fillRect(0, 596, W, H - 596); x.restore();
  });
}
function chipStack(g, x, y, n, col, s) {
  s = s || 1;
  for (let i = 0; i < n; i++) {
    const yy = y - i * 11 * s;
    g.fillStyle = 'rgba(8,3,12,0.45)'; if (i === 0) { g.beginPath(); g.ellipse(x - 6, y + 12 * s, 54 * s, 12 * s, 0, 0, TAU); g.fill(); }
    g.fillStyle = mixHex(col, '#000000', 0.35); g.beginPath(); g.ellipse(x, yy + 8 * s, 46 * s, 15 * s, 0, 0, TAU); g.fill();
    g.fillRect(x - 46 * s, yy - 2 * s, 92 * s, 10 * s);
    g.fillStyle = col; g.beginPath(); g.ellipse(x, yy, 46 * s, 15 * s, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 4 * s; g.setLineDash([9 * s, 9 * s]); g.beginPath(); g.ellipse(x, yy, 37 * s, 11.5 * s, 0, 0, TAU); g.stroke(); g.setLineDash([]);
  }
}
function wheelDraw(g, lt) {
  const th = wheelAng(lt), c = WH;
  g.save();
  // bowl wall
  g.fillStyle = '#2a1208'; g.beginPath(); g.ellipse(c.cx, c.cy + 30, c.R + 34, c.R * c.ky + 16, 0, 0, TAU); g.fill();
  // rim
  g.fillStyle = lg(g, 0, c.cy - 200, 0, c.cy + 200, [[0, '#a8672c'], [0.5, '#6a3716'], [1, '#3a1a0a']]); g.beginPath(); g.ellipse(c.cx, c.cy, c.R + 34, c.R * c.ky + 16, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,200,130,0.7)'; g.lineWidth = 4; g.beginPath(); g.ellipse(c.cx, c.cy, c.R + 32, c.R * c.ky + 15, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  // ball track
  g.fillStyle = lg(g, 0, c.cy - 190, 0, c.cy + 190, [[0, '#d9c6a0'], [1, '#8a7650']]); g.beginPath(); g.ellipse(c.cx, c.cy, c.R, c.R * c.ky, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(40,20,10,0.35)'; g.beginPath(); g.ellipse(c.cx, c.cy, 372, 372 * c.ky, 0, 0, TAU); g.fill();
  // pockets
  for (let i = 0; i < 37; i++) {
    const a0 = th + i * PK, a1 = a0 + PK, n = ORDER[i];
    const p0 = wpt(300, a0), p1 = wpt(362, a0), p2 = wpt(362, a1), p3 = wpt(300, a1);
    g.fillStyle = n === 0 ? '#1d9456' : (REDS.has(n) ? '#c42a3a' : '#17121f');
    g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.lineTo(p3.x, p3.y); g.closePath(); g.fill();
    g.strokeStyle = '#e4c36a'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
    const m = wpt(346, a0 + PK / 2); g.fillStyle = 'rgba(245,240,225,0.8)'; g.beginPath(); g.ellipse(m.x, m.y, 4.2, 2.2, 0, 0, TAU); g.fill();
  }
  g.strokeStyle = '#e4c36a'; g.lineWidth = 3; g.beginPath(); g.ellipse(c.cx, c.cy, 362, 362 * c.ky, 0, 0, TAU); g.stroke(); g.beginPath(); g.ellipse(c.cx, c.cy, 300, 300 * c.ky, 0, 0, TAU); g.stroke();
  // cone
  g.fillStyle = lg(g, 0, c.cy - 130, 0, c.cy + 130, [[0, '#3a1c0c'], [1, '#6a3a18']]); g.beginPath(); g.ellipse(c.cx, c.cy, 300, 300 * c.ky, 0, 0, TAU); g.fill();
  g.fillStyle = lg(g, c.cx - 200, 0, c.cx + 200, 0, [[0, '#7a4a20'], [0.5, '#d8a85a'], [1, '#6a3a18']]); g.beginPath(); g.ellipse(c.cx, c.cy - 8, 215, 215 * c.ky, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(40,20,8,0.7)'; g.lineWidth = 5;
  for (let i = 0; i < 4; i++) { const a = th + i * TAU / 4, p0 = wpt(50, a), p1 = wpt(210, a); g.beginPath(); g.moveTo(p0.x, p0.y - 8); g.lineTo(p1.x, p1.y - 8); g.stroke(); }
  g.fillStyle = '#e8c870'; g.beginPath(); g.ellipse(c.cx, c.cy - 22, 44, 44 * c.ky + 4, 0, 0, TAU); g.fill();
  g.fillStyle = '#fff0b8'; g.beginPath(); g.ellipse(c.cx - 6, c.cy - 30, 14, 8, 0, 0, TAU); g.fill();
  g.fillStyle = '#e8c870'; g.beginPath(); g.moveTo(c.cx - 7, c.cy - 22); g.lineTo(c.cx, c.cy - 70); g.lineTo(c.cx + 7, c.cy - 22); g.fill();
  g.beginPath(); g.arc(c.cx, c.cy - 74, 11, 0, TAU); g.fill();
  g.restore();
}
function ballDraw(g, b, col) {
  const p = wpt(b.r, b.a), sc = 1 + 0.25 * Math.sin(b.a), y = p.y - 8 - b.hop;
  g.fillStyle = 'rgba(10,4,14,0.4)'; g.beginPath(); g.ellipse(p.x + 4, p.y + 2, 12 * sc, 5 * sc, 0, 0, TAU); g.fill();
  g.fillStyle = lg(g, p.x - 8, y - 8, p.x + 8, y + 8, [[0, col ? col[0] : '#ffffff'], [1, col ? col[1] : '#b8b0a8']]); g.beginPath(); g.arc(p.x, y, 11 * sc, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(p.x - 3.5, y - 4, 3.4 * sc, 0, TAU); g.fill();
  return { x: p.x, y };
}
function shotB(g, lt) {
  const u = lt - T.B, since = lt - T.land;
  const punch = since > 0 ? Math.exp(-since * 9) : 0;
  const sk = shakeAt(lt, T.land, 14, 8);
  const z = 1.0 + 0.1 * smooth(u / 3.9) + 0.045 * punch;
  g.save(); camT(g, 960, 540, z, sk.r, sk.x, sk.y);
  g.drawImage(feltLayer(), 0, 0);
  // dealer (shocked at landing)
  const stp = clamp(spring(since - 0.1, 140, 11));
  man(g, { x: 1560, y: 590, s: 1.3, facing: -1, pal: mp('#d4cfe3'), lean: 0.02, step: since > 0 ? stp : 0, t: lt, headDown: 0.12, bob: 0.4 });
  // light pool on table
  addMode(g, () => { g.save(); g.translate(900, 560); g.scale(1, 0.45); rg(g, 0, 0, 760, [[0, 'rgba(255,200,130,0.28)'], [1, 'rgba(255,170,100,0)']]); g.restore(); });
  wheelDraw(g, lt);
  // chips arrive after the landing
  const stacks = [[1250, 830, 9, '#d63a3a'], [1360, 900, 12, '#2f6fd6'], [1120, 930, 7, '#17121f'], [1460, 820, 10, '#e8c24a'], [1240, 985, 14, '#2fb36a'], [1000, 840, 6, '#d63a3a']];
  stacks.forEach((s, i) => {
    const n = Math.min(s[2], Math.floor(Math.max(0, lt - (T.chip0 + i * 0.13)) * 20));
    if (n > 0) chipStack(g, s[0], s[1], n, s[3], 1.0 + (s[1] - 800) / 700);
  });
  // ball
  const b = ballState(lt);
  const on = lt >= T.ghostOn, gk = clamp(spring(lt - T.ghostOn, 130, 14));
  if (b) ballDraw(g, b);
  // ---- vision: grade then ghosts
  g.restore();
  if (on && lt < T.land + 0.9) { const vg = 0.5 * smooth((lt - T.ghostOn) / 0.35) * (1 - smooth((lt - T.land - 0.15) / 0.6)); if (vg > 0.01) visionGrade(g, vg); }
  g.save(); camT(g, 960, 540, z, sk.r, sk.x, sk.y);
  if (on) {
    const th = wheelAng(lt), a0 = th + IW * PK, a1 = a0 + PK, fadeG = 1 - smooth((lt - T.land - 0.6) / 0.6);
    addMode(g, () => {
      const p0 = wpt(298, a0), p1 = wpt(364, a0), p2 = wpt(364, a1), p3 = wpt(298, a1), pulse = 0.65 + 0.35 * Math.sin(lt * 14);
      g.fillStyle = 'rgba(95,217,255,' + (0.8 * gk * pulse * fadeG) + ')'; g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.lineTo(p3.x, p3.y); g.closePath(); g.fill();
      const pc = wpt(331, a0 + PK / 2);
      rg(g, pc.x, pc.y, 110 * gk, [[0, 'rgba(120,230,255,' + (0.6 * gk * fadeG) + ')'], [1, 'rgba(120,230,255,0)']]);
      // beam rising out of the pocket
      g.fillStyle = lg(g, 0, pc.y - 380, 0, pc.y, [[0, 'rgba(120,230,255,0)'], [1, 'rgba(120,230,255,' + (0.35 * gk * fadeG) + ')']]); g.beginPath(); g.moveTo(pc.x - 26, pc.y); g.lineTo(pc.x - 6, pc.y - 380); g.lineTo(pc.x + 6, pc.y - 380); g.lineTo(pc.x + 26, pc.y); g.closePath(); g.fill();
      // future path of the ball
      if (lt < T.land) for (let k = 0; k < 44; k++) {
        const tt = lt + 0.06 + k * ((T.land - lt) / 44), bs = ballState(tt);
        if (!bs) continue;
        const pp = wpt(bs.r, bs.a);
        g.fillStyle = 'rgba(140,235,255,' + (0.8 * (1 - k / 50) * gk) + ')'; g.beginPath(); g.arc(pp.x, pp.y - 8 - bs.hop, 3.2 + 3 * (1 - k / 44), 0, TAU); g.fill();
      }
      const fb = ballState(T.land - 0.001), pbf = wpt(318, th + (IW + 0.5) * PK);
      if (lt < T.land) { g.fillStyle = 'rgba(210,250,255,' + (0.9 * gk) + ')'; g.beginPath(); g.arc(pbf.x, pbf.y - 8, 12, 0, TAU); g.fill(); rg(g, pbf.x, pbf.y - 8, 40, [[0, 'rgba(150,240,255,0.8)'], [1, 'rgba(150,240,255,0)']]); }
    });
  }
  // landing burst
  if (since > 0 && since < 0.8) {
    const th = wheelAng(lt), pc = wpt(331, th + (IW + 0.5) * PK);
    addMode(g, () => {
      g.strokeStyle = 'rgba(255,225,140,' + (0.9 * (1 - since / 0.8)) + ')'; g.lineWidth = 6 * (1 - since / 0.8) + 1; g.beginPath(); g.ellipse(pc.x, pc.y - 8, 20 + 220 * easeOut(since / 0.8), (20 + 220 * easeOut(since / 0.8)) * 0.45, 0, 0, TAU); g.stroke();
      rg(g, pc.x, pc.y - 8, 150 * (1 - since / 0.8), [[0, 'rgba(255,240,180,0.7)'], [1, 'rgba(255,200,100,0)']]);
    });
    for (let i = 0; i < 7; i++) sparkle(g, pc.x + Math.cos(i * 0.9) * (30 + 190 * easeOut(since / 0.8)), pc.y - 40 + Math.sin(i * 1.7) * (20 + 100 * easeOut(since / 0.8)) - since * 60, 14 * (1 - since / 0.8) + 3, 1 - since / 0.8, '');
  }
  // hero in the foreground, eyes opening
  const eo = clamp(spring(lt - T.ghostOn + 0.1, 240, 22)), eg = clamp(spring(lt - T.ghostOn, 160, 20));
  man(g, { x: 270, y: 1135, s: 1.55, facing: 1, lean: 0.14, headDown: 0.18, eyeOpen: eo, eyeGlow: eg, t: lt, flutter: 0.3, bob: 0.5 });
  g.restore();
  bokeh(g, 52, 6, 40, 460, ['rgba(255,190,110,A)'], 0.1, lt);
}

// ================================================================== C: guards + clock, X: thrown out
function shotC(g, lt) {
  const u = lt - T.C;
  const sk = shakeAt(lt, 8.0, 7, 9);
  g.save(); camT(g, 1060 + 30 * u / 1.6, 600, 1.28 + 0.06 * u / 1.6, sk.r, sk.x, sk.y);
  g.drawImage(casinoLayer(), 0, 0);
  const spin = smooth((lt - 7.28) / 0.25) * (1 - smooth((lt - 8.15) / 0.7));
  const clk = { min: 0.4 + 2.8 * easeInOut(clamp((lt - 7.28) / 0.95)) * 2.4, h0: 2.6, blur: spin };
  casinoDyn(g, lt, clk);
  mini(g, 640, 668, 0.62, '#3b6ea8', lt * 0.7, 1, {});
  mini(g, 1330, 672, 0.6, '#2f9d8a', lt * 0.8, -1, {});
  // door glow + exit flash
  const dopen = smooth((lt - T.door + 0.15) / 0.12);
  addMode(g, () => { rg(g, 1467, 520, 150 + 260 * dopen, [[0, 'rgba(120,255,170,' + (0.2 + 0.7 * dopen) + ')'], [1, 'rgba(120,255,170,0)']]); });
  // dealer
  man(g, { x: 1090, y: 758, s: 0.82, facing: -1, pal: mp('#d4cfe3'), lean: 0.02, t: lt, headDown: 0.1, bob: 0.4 });
  tableA(g, lt);
  // actors
  const grab = smooth((lt - 7.95) / 0.22), march = clamp((lt - 8.15) / 0.62);
  const hx0 = 930, hx = hx0 + 440 * easeIn(march) * 0.9 + 60 * march;
  const gx = (k) => lerp(-90 - k * 140, hx0 + (k ? 175 : -175), smooth((lt - 7.2) / 0.78)) + (hx - hx0) * smooth((lt - 7.2) / 0.78);
  const heroY = 905, gy1 = 945, gy2 = 868;
  const gp = mp('#4a5278'), gp2 = mp('#343958');
  const gs = 1.2;
  const g2x = gx(1), g1x = gx(0);
  // far guard (behind)
  const jg2 = man(g, { x: g2x, y: gy2, s: gs * 0.96, facing: 1, walk: lt > 7.3 ? 1 : 0, phase: phaseOf(g2x + 40, gs), lean: 0.12, pal: gp2, t: lt });
  // hero (feet lifted when dragged)
  const lift = 20 * grab;
  const jh = man(g, { x: hx, y: heroY - lift, s: 1.1, facing: 1, walk: 0.9 * grab + (lt > 8.0 ? 0 : 0), phase: phaseOf(lt * 120, 1.1) * 1.4, lean: 0.02, headDown: 0.2 * grab, flutter: 0.8 * grab, t: lt, step: 0 });
  const jg1 = man(g, { x: g1x, y: gy1, s: gs, facing: 1, walk: lt > 7.3 ? 1 : 0, phase: phaseOf(g1x, gs), lean: 0.12, pal: gp, t: lt });
  // grabbing arms (thick capsules from guard shoulder to hero's armpit)
  if (grab > 0.01) {
    const arm = (j, col, col2, off) => {
      const sx = j.shoulder.x, sy = j.shoulder.y, tx = jh.shoulder.x + off, ty = jh.shoulder.y + 10;
      const ex = lerp(sx + 30, tx, grab), ey = lerp(sy + 70, ty, grab);
      g.lineCap = 'round'; g.strokeStyle = col; g.lineWidth = 27; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo((sx + ex) / 2 + 10, (sy + ey) / 2 + 30, ex, ey); g.stroke();
      g.fillStyle = col2; g.beginPath(); g.arc(ex, ey, 14, 0, TAU); g.fill();
    };
    arm(jg2, gp2.hood, '#14101c', 6);
    arm(jg1, gp.hood, '#14101c', -6);
  }
  // ban icon over his head
  const bp = spring(lt - 8.2, 180, 13);
  if (bp > 0.01) {
    const bx = jh.head.x, by = jh.head.y - 150 - 8 * Math.sin(lt * 6), br = 62 * bp;
    g.save(); g.translate(bx, by);
    rg(g, 0, 0, br * 2, [[0, 'rgba(255,60,70,0.4)'], [1, 'rgba(255,60,70,0)']]);
    g.fillStyle = 'rgba(20,8,16,0.8)'; g.beginPath(); g.arc(0, 0, br, 0, TAU); g.fill();
    g.strokeStyle = '#ff3b4a'; g.lineWidth = br * 0.2; g.beginPath(); g.arc(0, 0, br * 0.9, 0, TAU); g.stroke();
    coinIcon(g, 0, 0, br * 0.5, 0.4, 1);
    g.strokeStyle = '#ff3b4a'; g.lineWidth = br * 0.2; g.beginPath(); g.moveTo(-br * 0.64, br * 0.64); g.lineTo(br * 0.64, -br * 0.64); g.stroke();
    g.restore();
  }
  // chips fly out of his pockets
  for (let i = 0; i < 8; i++) {
    const t0 = 8.05 + i * 0.07, a = lt - t0; if (a < 0 || a > 0.9) continue;
    const px = jh.hip.x + (hash1(i) - 0.5) * 60 - a * (60 + 80 * hash1(i + 9)) * -1, py = jh.hip.y - 20 + (-240 * a + 700 * a * a);
    g.fillStyle = ['#d63a3a', '#2f6fd6', '#e8c24a', '#2fb36a'][i % 4]; g.beginPath(); g.ellipse(px, py, 16, 8, a * 9, 0, TAU); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
  }
  g.restore();
  // foreground slot (parallax)
  g.fillStyle = '#07030c'; rr(g, 1640 - 40 * u, 300, 420, 900, 26); g.fill();
  addMode(g, () => rg(g, 1840 - 40 * u, 520, 300, [[0, 'rgba(255,200,90,0.28)'], [1, 'rgba(255,200,90,0)']]));
}
function casinoEntrance(g, lt) {
  // free-standing hotel-casino portal at the back of the sidewalk (world coords, action plane)
  const cx = 1150, base = 800, w = 360, h = 330;
  const open = spring(lt - T.door + 0.05, 160, 17) * (1 - smooth((lt - (T.slam - 0.1)) / 0.07));
  g.save();
  g.fillStyle = 'rgba(12,5,20,0.4)'; g.fillRect(cx - w / 2 - 30, base - h - 70, w + 60, h + 70);
  g.fillStyle = lg(g, 0, base - h - 60, 0, base, [[0, '#4a1426'], [1, '#2a0a18']]); g.fillRect(cx - w / 2 - 20, base - h - 60, w + 40, h + 60);
  g.fillStyle = '#d9a844'; g.fillRect(cx - w / 2 - 24, base - h - 66, w + 48, 12);
  // doorway
  g.fillStyle = '#0c0408'; g.fillRect(cx - 105, base - 250, 210, 250);
  if (open > 0.02) { g.fillStyle = lg(g, 0, base - 250, 0, base, [[0, '#ffe2a0'], [1, '#ff9a50']]); g.fillRect(cx - 105, base - 250, 210, 250); }
  // doors (swing, compressing toward the hinges)
  const dw = 105 * (1 - 0.82 * open);
  g.fillStyle = lg(g, 0, 0, 0, 1, [[0, '#6a1c2a'], [1, '#6a1c2a']]);
  g.fillStyle = '#7a2230'; g.fillRect(cx - 105, base - 250, dw, 250); g.fillRect(cx + 105 - dw, base - 250, dw, 250);
  g.fillStyle = '#d9a844'; g.fillRect(cx - 105 + dw - 5, base - 250, 5, 250); g.fillRect(cx + 105 - dw, base - 250, 5, 250);
  g.fillStyle = 'rgba(255,230,160,0.9)'; g.fillRect(cx - 105 + 12, base - 215, Math.max(0, dw - 30), 120); g.fillRect(cx + 105 - dw + 18, base - 215, Math.max(0, dw - 30), 120);
  g.fillStyle = '#7a2230'; g.fillRect(cx - 105 + 8, base - 215, Math.max(0, dw - 22), 4);
  if (open > 0.3) { mini(g, cx - 28, base - 14, 0.9 * open, '#343958', 0, -1, { noShadow: true }); mini(g, cx + 34, base - 14, 0.9 * open, '#2a2e4a', 0, -1, { noShadow: true }); }
  // marquee arch + bulbs
  g.fillStyle = '#d9a844'; g.beginPath(); g.moveTo(cx - 150, base - 240); g.quadraticCurveTo(cx, base - 340, cx + 150, base - 240); g.lineTo(cx + 150, base - 255); g.quadraticCurveTo(cx, base - 360, cx - 150, base - 255); g.closePath(); g.fill();
  for (let i = 0; i < 17; i++) {
    const a = i / 16, bx = lerp(cx - 142, cx + 142, a), by = base - 248 - 80 * Math.sin(a * Math.PI) * 0.98;
    const on = ((i + Math.floor(lt * 10)) % 3) ? 1 : 0.25;
    g.fillStyle = 'rgba(255,240,190,' + on + ')'; g.beginPath(); g.arc(bx, by, 5, 0, TAU); g.fill();
    addMode(g, () => rg(g, bx, by, 20, [[0, 'rgba(255,200,100,' + 0.5 * on + ')'], [1, 'rgba(255,200,100,0)']]));
  }
  // glow spill onto the sidewalk
  addMode(g, () => { g.save(); g.translate(cx - 30, base + 16); g.scale(1, 0.2); rg(g, 0, 0, 280 + 160 * open, [[0, 'rgba(255,190,100,' + (0.35 + 0.35 * open) + ')'], [1, 'rgba(255,190,100,0)']]); g.restore(); });
  g.restore();
}
function shotX(g, lt) {
  const u = lt - T.X;
  const sk = shakeAt(lt, T.landX, 14, 8), sk2 = shakeAt(lt, T.slam, 18, 10);
  const cam = { x: 930 + sk.x + sk2.x, y: 600 + sk.y + sk2.y, z: 1.2 - 0.05 * u / 0.85, r: 0 };
  g.save();
  drawWorld(g, cam, lt);
  // night-ish tint toward the casino side
  withLayer(g, cam, 1, () => {
    casinoEntrance(g, lt);
    // hero tossed through the air
    const a = clamp((lt - T.throwT) / (T.landX - T.throwT));
    if (lt < T.throwT) return;
    const ex = 1100, ey = 770, lx = 760, ly = 822;
    if (a < 1) {
      const px = lerp(ex, lx, easeOut(a) * 0.65 + a * 0.35), py = lerp(ey, ly, a) - 190 * Math.sin(a * Math.PI);
      const ang = -TAU * a;
      g.fillStyle = 'rgba(14,5,24,0.4)'; g.beginPath(); g.ellipse(px - 20, ly + 6, 70 - 25 * Math.sin(a * Math.PI), 11, 0, 0, TAU); g.fill();
      g.save(); g.translate(px, py - 95); g.rotate(ang); g.translate(-px, -(py - 95));
      man(g, { x: px, y: py, s: 0.96, facing: 1, walk: 0, lean: 0.0, flutter: 1, t: lt, shadow: false });
      g.restore();
      // chips tumble out
      for (let i = 0; i < 6; i++) { const cxp = px + (i - 3) * 22 * a - 40 * a, cyp = py - 40 + i * 12 - 90 * a * (1 - a) * 4 + 50 * a * a; g.fillStyle = ['#d63a3a', '#2f6fd6', '#e8c24a'][i % 3]; g.beginPath(); g.ellipse(cxp, cyp, 13, 7, a * 8 + i, 0, TAU); g.fill(); }
    } else {
      const s2 = lt - T.landX, st = clamp(spring(s2 - 0.02, 150, 12));
      man(g, { x: lx - 24 * st, y: ly, s: 0.96, facing: 1, walk: 0, lean: 0.12, headDown: 0.3 * (1 - smooth(s2 / 0.5)), step: st, t: lt, flutter: 0.6 * Math.exp(-s2 * 3) });
      // dust puff
      for (let i = 0; i < 7; i++) { const dd = clamp(s2 / 0.7); if (dd >= 1) break; rg(g, lx - 40 + (i - 3) * 22 * (0.4 + dd), ly - 6 - 20 * dd * (1 + hash1(i)), 18 + 26 * dd, [[0, 'rgba(230,200,190,' + 0.42 * (1 - dd) + ')'], [1, 'rgba(230,200,190,0)']]); }
      // scattered chips lying on the sidewalk
      for (let i = 0; i < 6; i++) { const cxp = lx - 160 + i * 52 + hash1(i) * 24, cyp = ly + 10 + hash1(i + 5) * 22; g.fillStyle = ['#d63a3a', '#2f6fd6', '#e8c24a'][i % 3]; g.beginPath(); g.ellipse(cxp, cyp, 13, 5, 0, 0, TAU); g.fill(); }
    }
  });
  drawForeground(g, cam, lt);
  g.restore();
  // warm casino spill grade + slam flash
  const fl = lt >= T.slam ? 0.18 * Math.exp(-(lt - T.slam) * 14) : 0;
  if (fl > 0.01) flash(g, fl, '#ffd8a0');
}

// ================================================================== D: apartment, E: chart
function chartMini(g, x, y, w, h, seed, t, col) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = '#04101a'; g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(80,200,255,0.12)'; g.lineWidth = 1;
  for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(x, y + h * i / 5); g.lineTo(x + w, y + h * i / 5); g.stroke(); }
  const pitch = w / 14, off = seed * 9 + t * 1.8, i0 = Math.floor(off), fr = off - i0;
  let mn = 1e9, mx = -1e9;
  for (let i = 0; i < 16; i++) { const c = CAND[(i0 + i) % 90]; mn = Math.min(mn, c.l); mx = Math.max(mx, c.h); }
  const Y = (p) => y + h * 0.88 - (p - mn) / (mx - mn) * h * 0.76;
  for (let i = 0; i < 16; i++) {
    const c = CAND[(i0 + i) % 90], cx = x + (i - fr) * pitch + pitch * 0.5, up2 = c.c >= c.o;
    g.strokeStyle = g.fillStyle = up2 ? '#27d17a' : '#ff4a5a';
    g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, Y(c.h)); g.lineTo(cx, Y(c.l)); g.stroke();
    g.fillRect(cx - pitch * 0.28, Math.min(Y(c.o), Y(c.c)), pitch * 0.56, Math.max(2, Math.abs(Y(c.o) - Y(c.c))));
  }
  g.restore();
}
function aptLayer() {
  return layer('apt', W, H, (x) => {
    x.fillStyle = lg(x, 0, 0, 0, H, [[0, '#0a1020'], [0.7, '#141c34'], [1, '#0a0e1c']]); x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(120,150,255,0.05)'; for (let i = 0; i < 20; i++) x.fillRect(i * 100, 0, 3, 860);
    // floor
    x.fillStyle = lg(x, 0, 860, 0, H, [[0, '#2a1d18'], [1, '#0e0806']]); x.fillRect(0, 860, W, H - 860);
    x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 3; for (let i = -10; i < 30; i++) { x.beginPath(); x.moveTo(960 + (i - 10) * 40, 860); x.lineTo(960 + (i - 10) * 160, H); x.stroke(); }
    x.fillStyle = '#080b16'; x.fillRect(0, 846, W, 16);
    // window with city
    const wx = 70, wy = 100, ww = 650, wh = 580;
    x.save(); x.beginPath(); x.rect(wx, wy, ww, wh); x.clip();
    x.fillStyle = lg(x, 0, wy, 0, wy + wh, [[0, '#050818'], [0.6, '#241446'], [1, '#6a2f6a']]); x.fillRect(wx, wy, ww, wh);
    const r = rng(909);
    for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(255,255,255,' + (0.2 + r() * 0.5) + ')'; x.fillRect(wx + r() * ww, wy + r() * 200, 2, 2); }
    rg(x, wx + 480, wy + 110, 80, [[0, 'rgba(255,245,220,0.9)'], [0.25, 'rgba(255,245,220,0.8)'], [0.28, 'rgba(255,230,200,0.2)'], [1, 'rgba(255,230,200,0)']]);
    for (let layerI = 0; layerI < 3; layerI++) {
      let bx = wx - 30; const col = ['#1c1236', '#120c28', '#0a0618'][layerI];
      while (bx < wx + ww) {
        const bw = 50 + r() * 80, bh = 120 + r() * 240 + layerI * 40 - 40;
        x.fillStyle = col; x.fillRect(bx, wy + wh - bh - layerI * 18, bw, bh + 40);
        for (let k = 0; k < bw * bh / 520; k++) if (r() < 0.55) { x.fillStyle = r() < 0.8 ? 'rgba(255,210,130,' + (0.4 + r() * 0.5) + ')' : 'rgba(130,220,255,0.7)'; x.fillRect(bx + 5 + r() * (bw - 10), wy + wh - bh - layerI * 18 + 8 + r() * (bh - 10), 4, 5); }
        bx += bw + r() * 6;
      }
    }
    x.fillStyle = 'rgba(180,200,255,0.07)'; x.beginPath(); x.moveTo(wx + 100, wy); x.lineTo(wx + 200, wy); x.lineTo(wx + 40, wy + wh); x.lineTo(wx - 60, wy + wh); x.fill();
    x.restore();
    x.strokeStyle = '#05070f'; x.lineWidth = 14; x.strokeRect(wx, wy, ww, wh); x.lineWidth = 8; x.beginPath(); x.moveTo(wx + ww / 2, wy); x.lineTo(wx + ww / 2, wy + wh); x.moveTo(wx, wy + wh * 0.5); x.lineTo(wx + ww, wy + wh * 0.5); x.stroke();
    x.fillStyle = '#10152a'; x.fillRect(wx - 20, wy + wh + 4, ww + 40, 18);
    // desk
    x.fillStyle = '#3a2418'; x.fillRect(790, 716, 1100, 24);
    x.fillStyle = 'rgba(255,200,140,0.35)'; x.fillRect(790, 716, 1100, 3);
    x.fillStyle = lg(x, 0, 740, 0, 860, [[0, '#2a1a12'], [1, '#150c08']]); x.fillRect(808, 740, 1064, 118);
    x.fillStyle = '#10100c'; x.fillRect(808, 740, 8, 118); x.fillRect(1864, 740, 8, 118);
    // monitors (frames)
    const mons = [[880, 440, 330, 210], [1230, 410, 400, 250], [1660, 440, 330, 210], [1010, 190, 300, 170], [1510, 190, 300, 170]];
    x.fillStyle = '#0a0c14'; mons.forEach((m) => { rr(x, m[0] - 12, m[1] - 12, m[2] + 24, m[3] + 24, 10); x.fill(); });
    x.fillStyle = '#1c2030'; [[1030, 650, 14, 66], [1415, 660, 30, 56], [1810, 650, 14, 66]].forEach((s) => x.fillRect(s[0], s[1], s[2], s[3]));
    x.fillRect(1130, 360, 12, 36); x.fillRect(1650, 360, 12, 36);
    // keyboard, cup, lamp
    x.fillStyle = '#12141e'; rr(x, 1180, 696, 280, 20, 6); x.fill(); x.fillStyle = 'rgba(120,200,255,0.4)'; for (let i = 0; i < 14; i++) x.fillRect(1190 + i * 19, 700, 14, 4);
    x.fillStyle = '#d8d0c0'; rr(x, 1600, 680, 30, 36, 5); x.fill();
    // floor lamp
    x.fillStyle = '#c99a3c'; x.fillRect(758, 560, 5, 290); x.beginPath(); x.moveTo(730, 560); x.lineTo(790, 560); x.lineTo(776, 500); x.lineTo(744, 500); x.closePath(); x.fillStyle = '#e8cf8a'; x.fill();
    // chair
    x.fillStyle = '#0c0e18'; rr(x, 1090, 740, 160, 150, 20); x.fill(); x.fillRect(1160, 890, 20, 90);
  });
}
function shotD(g, lt) {
  const u = lt - T.D, zin = easeIn(clamp((lt - 10.55) / 1.05));
  const slide = 380 * Math.exp(-u * 9);
  const cam = { x: lerp(1060, 1230, zin), y: lerp(560, 440, zin), z: lerp(1.0, 3.25, zin) };
  g.save(); camT(g, cam.x, cam.y, cam.z, 0, slide, 0);
  g.drawImage(aptLayer(), 0, 0);
  // screens
  const mons = [[880, 440, 330, 210, 1], [1230, 410, 400, 250, 2], [1660, 440, 330, 210, 3], [1010, 190, 300, 170, 4], [1510, 190, 300, 170, 5]];
  mons.forEach((m) => chartMini(g, m[0], m[1], m[2], m[3], m[4], lt + (m[4] === 2 ? 3 : 0), 0));
  addMode(g, () => {
    mons.forEach((m, i) => rg(g, m[0] + m[2] / 2, m[1] + m[3] / 2, 360, [[0, i === 1 ? 'rgba(80,220,200,0.30)' : 'rgba(80,200,255,0.2)'], [1, 'rgba(60,160,255,0)']]));
    g.save(); g.translate(1230, 726); g.scale(1, 0.14); rg(g, 0, 0, 700, [[0, 'rgba(90,220,230,0.5)'], [1, 'rgba(90,220,230,0)']]); g.restore();
    rg(g, 760, 520, 220, [[0, 'rgba(255,220,150,0.35)'], [1, 'rgba(255,200,120,0)']]);
  });
  // scan lines on screens
  g.fillStyle = 'rgba(0,10,20,0.18)'; mons.forEach((m) => { for (let yy = m[1]; yy < m[1] + m[3]; yy += 4) g.fillRect(m[0], yy, m[2], 1.3); });
  // hero leaning toward the screens
  const eg = 0.8;
  const hx = 830 + 6 * Math.sin(lt * 1.3), ip = clamp((lt - 9.95) / 0.5);
  man(g, { x: 800, y: 905, s: 1.18, facing: 1, lean: 0.2, headDown: 0.25, eyeOpen: 1, eyeGlow: eg, t: lt, bob: 0.3, flutter: 0.15 });
  // ghost tick marks hovering over the center monitor
  g.restore();
}
function shotE(g, lt) {
  const u = lt - T.E, sk = shakeAt(lt, T.E + 0.05, 5, 10);
  const NOW = 1130 - 24 * smooth(u / 3.9), x0 = 120, x1 = 1800, y0 = 190, y1 = 830;
  const idxf = 20 + u * 2.35, k0 = Math.floor(idxf), fr = idxf - k0, pitch = 56;
  g.save();
  g.translate(sk.x, sk.y);
  // screen background
  g.fillStyle = lg(g, 0, 0, 0, H, [[0, '#04101c'], [1, '#02070e']]); g.fillRect(0, 0, W, H);
  addMode(g, () => rg(g, 960, 520, 1100, [[0, 'rgba(40,110,170,0.22)'], [1, 'rgba(40,110,170,0)']]));
  // grid
  g.strokeStyle = 'rgba(80,190,255,0.12)'; g.lineWidth = 1.5;
  for (let i = 0; i <= 8; i++) { const yy = lerp(y0, y1, i / 8); g.beginPath(); g.moveTo(x0, yy); g.lineTo(x1, yy); g.stroke(); }
  const gx0 = (-((u * 2.35 * pitch) % pitch));
  for (let xx = x0 + gx0; xx < x1; xx += pitch * 2) { g.beginPath(); g.moveTo(xx, y0); g.lineTo(xx, y1); g.stroke(); }
  // scale: lerp of min/max windows
  const mm = (k) => { let mn = 1e9, mx = -1e9; for (let i = k - 17; i <= k + 7; i++) { const c = CAND[i]; mn = Math.min(mn, c.l); mx = Math.max(mx, c.h); } return [mn, mx]; };
  const a = mm(k0), b = mm(k0 + 1), mn = lerp(a[0], b[0], fr), mx = lerp(a[1], b[1], fr);
  const Y = (p) => y1 - 20 - (p - mn) / (mx - mn) * (y1 - y0 - 60);
  // ghost zone
  const gz = g.createLinearGradient(NOW, 0, x1, 0); gz.addColorStop(0, 'rgba(80,200,255,0.2)'); gz.addColorStop(1, 'rgba(80,200,255,0.03)');
  g.fillStyle = gz; g.fillRect(NOW, y0 - 20, x1 - NOW, y1 - y0 + 40);
  g.save(); g.beginPath(); g.rect(x0, y0 - 40, x1 - x0, y1 - y0 + 90); g.clip();
  // candles
  for (let i = k0 - 17; i <= k0 + 7; i++) {
    const c = CAND[i], cx = NOW + (i - idxf) * pitch + pitch * 0.5, real = i < k0, cur = i === k0, fut = i > k0;
    let o = c.o, cl = c.c, hi = c.h, lo = c.l;
    if (cur) { const tick = (hash1(Math.floor(lt * 26) + i * 7) - 0.5) * 6; cl = lerp(c.o, c.c, fr) + tick; hi = Math.max(o, cl) + 3; lo = Math.min(o, cl) - 3; }
    const upc = cl >= o;
    if (fut) {
      const al = 0.85 * clamp(1 - (i - k0 - 1) / 8) * clamp((idxf + 7.5 - i) / 1.5);
      addMode(g, () => {
        g.strokeStyle = 'rgba(150,235,255,' + al + ')'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, Y(hi)); g.lineTo(cx, Y(lo)); g.stroke();
        g.fillStyle = 'rgba(80,200,255,' + al * 0.5 + ')'; g.fillRect(cx - 16, Math.min(Y(o), Y(cl)), 32, Math.max(3, Math.abs(Y(o) - Y(cl))));
        g.strokeStyle = 'rgba(200,250,255,' + al + ')'; g.lineWidth = 2; g.strokeRect(cx - 16, Math.min(Y(o), Y(cl)), 32, Math.max(3, Math.abs(Y(o) - Y(cl))));
      });
    } else {
      const col = upc ? '#27d17a' : '#ff4a5a';
      g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, Y(hi)); g.lineTo(cx, Y(lo)); g.stroke();
      g.fillStyle = col; g.fillRect(cx - 16, Math.min(Y(o), Y(cl)), 32, Math.max(3, Math.abs(Y(o) - Y(cl))));
      if (cur) addMode(g, () => { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(cx - 18, Math.min(Y(o), Y(cl)) - 2, 36, Math.max(5, Math.abs(Y(o) - Y(cl)))); });
      // volume
      g.fillStyle = upc ? 'rgba(39,209,122,0.35)' : 'rgba(255,74,90,0.35)'; const vh = 20 + 70 * hash1(i * 5 + 1); g.fillRect(cx - 14, y1 + 30 - vh * 0.6, 28, vh * 0.6);
    }
    // buy / sell markers on strong future candles
    const big = Math.abs(c.c - c.o);
    if (big > 9 && i > k0 - 1 && i <= k0 + 7) {
      const buy = c.c > c.o, ap = clamp(spring(lt - (T.E + (i - 20 - 7) / 2.35 + 0.0), 200, 16));
      const my = buy ? Y(c.l) + 46 : Y(c.h) - 46, sz = 20 * (0.4 + 0.6 * ap);
      g.fillStyle = buy ? '#4dffa0' : '#ff7a8a';
      g.beginPath(); if (buy) { g.moveTo(cx, my - sz); g.lineTo(cx + sz, my + sz * 0.7); g.lineTo(cx - sz, my + sz * 0.7); } else { g.moveTo(cx, my + sz); g.lineTo(cx + sz, my - sz * 0.7); g.lineTo(cx - sz, my - sz * 0.7); } g.closePath(); g.fill();
    }
  }
  // moving average
  g.strokeStyle = 'rgba(255,210,120,0.8)'; g.lineWidth = 3; g.beginPath();
  for (let i = k0 - 17; i < k0; i++) { let s = 0; for (let j = 0; j < 4; j++) s += CAND[i - j].c; const cx = NOW + (i - idxf) * pitch + pitch * 0.5, py = Y(s / 4); if (i === k0 - 17) g.moveTo(cx, py); else g.lineTo(cx, py); }
  g.stroke();
  g.restore();
  // NOW line
  addMode(g, () => {
    g.strokeStyle = 'rgba(120,230,255,0.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(NOW, y0 - 40); g.lineTo(NOW, y1 + 50); g.stroke();
    rg(g, NOW, 540, 340, [[0, 'rgba(120,230,255,0.12)'], [1, 'rgba(120,230,255,0)']]);
  });
  // price tag
  const cur = CAND[k0], pnow = lerp(cur.o, cur.c, fr);
  g.fillStyle = '#122a3c'; rr(g, x1 - 118, Y(pnow) - 17, 112, 34, 6); g.fill();
  g.fillStyle = '#e6fbff'; g.font = '26px ' + F_UI; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((pnow * 3.1).toFixed(2), x1 - 62, Y(pnow) + 1);
  g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.5; g.setLineDash([8, 8]); g.beginPath(); g.moveTo(x0, Y(pnow)); g.lineTo(x1, Y(pnow)); g.stroke(); g.setLineDash([]);
  // balance counter (in-world screen readout)
  const bal = 1000 + Math.pow(Math.max(0, idxf - 20), 1.25) * 3400 + 120 * hash1(Math.floor(lt * 12));
  const balFlash = Math.max(0, 1 - ((idxf * 2.2) % 1) * 3);
  g.save(); g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = '84px ' + F_UI;
  g.shadowColor = 'rgba(60,255,150,0.8)'; g.shadowBlur = 20 + 20 * balFlash; g.fillStyle = '#6dffb4';
  g.fillText('$' + fmt(bal), 150, 100);
  g.restore();
  // ring (10 s) top right
  const rv = 10 - ((u * 1.1) % 10);
  drawTimerRing(g, 1690, 100, 150, { value: rv, progress: 1 - rv / 10, appear: spring(u - 0.3, 120, 14), time: lt });
  // hero foreground (out of focus, in shadow, lit by the screen)
  g.restore();
  g.save(); g.translate(sk.x * 1.5, sk.y * 1.5);
  man(g, { x: 215, y: 1290, s: 2.4, facing: 1, pal: mp('#6a1f2a'), lean: 0.16, headDown: 0.12, eyeOpen: 1, eyeGlow: 1, t: lt, bob: 0.2, flutter: 0.1, shadow: false });
  g.restore();
  // glass reflection + scanlines + bezel
  g.save();
  g.fillStyle = 'rgba(0,12,24,0.16)'; for (let yy = 0; yy < H; yy += 5) g.fillRect(0, yy, W, 1.6);
  g.globalCompositeOperation = 'screen'; g.fillStyle = lg(g, 0, 0, W, H, [[0, 'rgba(255,255,255,0.07)'], [0.35, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(0, 0, W, H);
  g.restore();
  g.fillStyle = '#05070c'; g.fillRect(0, 0, W, 34); g.fillRect(0, H - 34, W, 34); g.fillRect(0, 0, 34, H); g.fillRect(W - 34, 0, 34, H);
}

// ================================================================== F: robot trader
function roomLayer() {
  return layer('room', W, H, (x) => {
    x.fillStyle = lg(x, 0, 0, 0, H, [[0, '#070d1c'], [0.7, '#12203a'], [1, '#080c18']]); x.fillRect(0, 0, W, H);
    // server racks
    const r = rng(321);
    for (let i = 0; i < 9; i++) {
      const rx = 40 + i * 215, rh = 560 + (i % 3) * 20;
      x.fillStyle = '#0a1224'; x.fillRect(rx, 90, 190, rh); x.fillStyle = '#16233f'; x.fillRect(rx + 6, 96, 178, rh - 12);
      for (let j = 0; j < 14; j++) { x.fillStyle = '#0c1630'; x.fillRect(rx + 12, 106 + j * 38, 166, 30); for (let k = 0; k < 6; k++) { x.fillStyle = r() < 0.6 ? 'rgba(80,230,200,0.75)' : (r() < 0.5 ? 'rgba(80,160,255,0.75)' : 'rgba(255,150,80,0.7)'); x.fillRect(rx + 20 + k * 11, 116 + j * 38, 6, 6); } }
      x.fillStyle = 'rgba(120,200,255,0.2)'; x.fillRect(rx + 184, 96, 4, rh - 12);
    }
    // floor
    x.fillStyle = lg(x, 0, 700, 0, H, [[0, '#0a1424'], [1, '#04070e']]); x.fillRect(0, 700, W, H - 700);
    x.strokeStyle = 'rgba(80,170,255,0.14)'; x.lineWidth = 2;
    for (let i = -8; i < 30; i++) { x.beginPath(); x.moveTo(960 + (i - 10) * 70, 700); x.lineTo(960 + (i - 10) * 260, H); x.stroke(); }
    for (let j = 0; j < 8; j++) { const yy = 700 + 380 * Math.pow(j / 8, 1.6); x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke(); }
    x.fillStyle = 'rgba(90,200,255,0.1)'; x.fillRect(0, 700, W, 3);
  });
}
function robotDraw(g, lt, fast, eyeDX, blink) {
  const cx = 780, base = 905;
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.ellipse(cx, base + 6, 190, 22, 0, 0, TAU); g.fill();
  // treads
  g.fillStyle = '#10182a'; rr(g, cx - 160, base - 52, 320, 52, 24); g.fill();
  g.fillStyle = '#3a4a6a'; for (let i = 0; i < 9; i++) g.fillRect(cx - 140 + i * 35, base - 40, 18, 28);
  // body
  g.fillStyle = lg(g, cx - 130, 0, cx + 130, 0, [[0, '#6d7a96'], [0.55, '#aab6cf'], [1, '#e8f0ff']]); rr(g, cx - 130, base - 290, 260, 240, 34); g.fill();
  g.fillStyle = '#17213a'; rr(g, cx - 92, base - 250, 184, 120, 14); g.fill();
  for (let i = 0; i < 5; i++) { const lvl = fast ? hash1(Math.floor(lt * 20) + i * 3) : 0.35 + 0.05 * Math.sin(lt * 0.6 + i); g.fillStyle = 'rgba(80,235,200,0.9)'; g.fillRect(cx - 80 + i * 35, base - 140 - 100 * lvl, 24, 100 * lvl); }
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(cx + 108, base - 280, 6, 220);
  // neck + head
  g.fillStyle = '#4a5878'; g.fillRect(cx - 24, base - 322, 48, 36);
  g.fillStyle = lg(g, cx - 130, 0, cx + 130, 0, [[0, '#7a87a4'], [0.6, '#bcc8e0'], [1, '#f2f6ff']]); rr(g, cx - 130, base - 480, 260, 170, 40); g.fill();
  g.fillStyle = '#0a1226'; rr(g, cx - 104, base - 450, 208, 110, 30); g.fill();
  const ey = base - 396, bl = blink ? 0.12 : 1;
  addMode(g, () => { rg(g, cx + eyeDX, ey, 150, [[0, 'rgba(80,230,255,0.28)'], [1, 'rgba(80,230,255,0)']]); });
  g.fillStyle = '#7af0ff'; rr(g, cx - 66 + eyeDX, ey - 22 * bl, 44, 44 * bl, 12); g.fill(); rr(g, cx + 22 + eyeDX, ey - 22 * bl, 44, 44 * bl, 12); g.fill();
  // antenna
  g.strokeStyle = '#4a5878'; g.lineWidth = 7; g.beginPath(); g.moveTo(cx + 40, base - 480); g.lineTo(cx + 54, base - 540); g.stroke();
  g.fillStyle = Math.floor(lt * 2) % 2 ? '#ff4a5a' : '#6a1f2a'; g.beginPath(); g.arc(cx + 54, base - 546, 11, 0, TAU); g.fill();
  // arms on keyboard
  const typ = fast ? Math.sin(lt * 70) * 8 : 0, typ2 = fast ? Math.sin(lt * 70 + 2) * 8 : 0;
  g.strokeStyle = '#8c98b4'; g.lineWidth = 26; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx + 120, base - 230); g.quadraticCurveTo(cx + 230, base - 180, cx + 300, base - 150 + typ); g.stroke();
  g.beginPath(); g.moveTo(cx + 110, base - 200); g.quadraticCurveTo(cx + 210, base - 150, cx + 270, base - 120 + typ2); g.stroke();
  g.fillStyle = '#e8f0ff'; g.beginPath(); g.arc(cx + 304, base - 150 + typ, 20, 0, TAU); g.fill(); g.beginPath(); g.arc(cx + 274, base - 120 + typ2, 20, 0, TAU); g.fill();
  g.restore();
}
function shotF(g, lt) {
  const u = lt - T.F, slow = smooth((lt - 17.05) / 0.2);
  const fast = lt < 17.1;
  const sk = shakeAt(lt, 17.1, 7, 10);
  g.save(); camT(g, 960 + 20 * u / 3.1, 560, 1.0 + 0.1 * u / 3.1, sk.r, sk.x, sk.y + 300 * Math.exp(-u * 10) * 0);
  g.drawImage(roomLayer(), 0, 0);
  // rack LEDs blink
  addMode(g, () => { for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) { const on = hash1(Math.floor(lt * (fast ? 14 : 2)) + i * 13 + j * 7) < 0.5; rg(g, 70 + i * 215 + j * 24, 120 + j * 120, 30, [[0, on ? 'rgba(80,230,200,0.5)' : 'rgba(80,160,255,0.2)'], [1, 'rgba(80,200,255,0)']]); } });
  // desk
  g.fillStyle = '#10182c'; g.fillRect(940, 770, 880, 26); g.fillStyle = 'rgba(120,210,255,0.3)'; g.fillRect(940, 770, 880, 3);
  g.fillStyle = '#0a0f1e'; g.fillRect(960, 796, 840, 120);
  // monitors with the same chart, frozen when slow
  chartMini(g, 1040, 470, 360, 230, 2, fast ? lt * 4 : 17.1 * 4 + (lt - 17.1) * 0.15, 0);
  chartMini(g, 1470, 470, 260, 230, 3, fast ? lt * 4 : 17.1 * 4 + (lt - 17.1) * 0.15, 0);
  g.strokeStyle = '#05080f'; g.lineWidth = 14; g.strokeRect(1040, 470, 360, 230); g.strokeRect(1470, 470, 260, 230);
  addMode(g, () => rg(g, 1300, 580, 520, [[0, 'rgba(60,200,255,0.2)'], [1, 'rgba(60,160,255,0)']]));
  // robot
  const ex = fast ? Math.sin(lt * 9) * 6 : Math.sin(lt * 0.9) * 28;
  const bl = !fast && (Math.floor((lt - 17.1) * 0.9 + 0.3) % 3 === 1) && ((lt - 17.1) * 0.9 + 0.3) % 1 < 0.14;
  robotDraw(g, lt, fast, ex, bl);
  // speed streaks while fast
  if (fast) addMode(g, () => { for (let i = 0; i < 12; i++) { const yy = 300 + hash1(i) * 500, xx = 400 + hash1(i + 5) * 1400, ln = 200 + hash1(i + 9) * 400, a = 0.4 * hash1(Math.floor(lt * 30) + i); g.fillStyle = 'rgba(160,240,255,' + a + ')'; g.fillRect(xx - ln * ((lt * 6 + hash1(i)) % 1), yy, ln, 2); } });
  // eternity: cobweb, tumbleweed, fly, big slow ring
  if (!fast) {
    const w = clamp(spring(lt - 17.5, 40, 9));
    g.save(); g.strokeStyle = 'rgba(230,240,255,0.5)'; g.lineWidth = 1.8;
    const cx = 1790, cy = 80, R = 420 * w;
    for (let i = 0; i < 6; i++) { const a = Math.PI * 0.55 + i * 0.16; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R * 1.3); g.stroke(); }
    for (let k = 1; k < 6; k++) { g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI * 0.55 + i * 0.16, rr2 = R * k / 6 * (1 - 0.06 * Math.sin(i * 2 + k)); const px = cx + Math.cos(a) * rr2, py = cy + Math.sin(a) * rr2 * 1.3; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.stroke(); }
    g.restore();
    // tumbleweed rolls across the floor
    const tx = lerp(-100, 2000, clamp((lt - 17.2) / 1.5)), tr = 46;
    g.save(); g.translate(tx, 975); g.rotate(tx / tr);
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 3; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, b = a + 1.7; g.beginPath(); g.arc(0, 0, tr * (0.55 + 0.4 * ((i * 7) % 5) / 5), a, b); g.stroke(); }
    g.restore();
    // fly
    const fx = 1100 + Math.cos(lt * 3.1) * 140, fy = 330 + Math.sin(lt * 4.3) * 60;
    g.fillStyle = '#05070c'; g.beginPath(); g.arc(fx, fy, 5, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(200,220,255,0.5)'; g.lineWidth = 2; g.beginPath(); g.ellipse(fx - 4, fy - 5, 7, 3, Math.sin(lt * 60), 0, TAU); g.stroke();
  }
  g.restore();
  // slow ring (ten seconds crawling)
  const ra = spring(lt - 17.15, 100, 13);
  const rv = 10 - (lt - 17.15) * 0.9;
  if (ra > 0.01) drawTimerRing(g, 1520, 250, 380, { value: Math.max(rv, 0), progress: clamp(1 - rv / 10), appear: ra, time: lt });
}

// ================================================================== G: printing press
function pressLayer() {
  return layer('press', W, H, (x) => {
    x.fillStyle = lg(x, 0, 0, 0, H, [[0, '#0c1a14'], [0.6, '#1a3a2c'], [1, '#08140e']]); x.fillRect(0, 0, W, H);
    const r = rng(11);
    for (let i = 0; i < 18; i++) { const bx = r() * W, by = 40 + r() * 600, s = 30 + r() * 80; rg(x, bx, by, s, [[0, 'rgba(120,255,170,0.07)'], [1, 'rgba(120,255,170,0)']]); }
    x.fillStyle = '#0d1d16'; for (let i = 0; i < 6; i++) x.fillRect(120 + i * 330, 0, 24, 700);
    x.fillStyle = lg(x, 0, 880, 0, H, [[0, '#183a2a'], [1, '#06100b']]); x.fillRect(0, 880, W, H - 880);
    x.fillStyle = 'rgba(160,255,200,0.12)'; x.fillRect(0, 880, W, 3);
    // spot light cone
    x.save(); x.globalCompositeOperation = 'screen'; x.fillStyle = lg(x, 0, 0, 0, 880, [[0, 'rgba(180,255,210,0.22)'], [1, 'rgba(180,255,210,0)']]);
    x.beginPath(); x.moveTo(820, 0); x.lineTo(1100, 0); x.lineTo(1500, 880); x.lineTo(500, 880); x.closePath(); x.fill(); x.restore();
  });
}
function shotG(g, lt) {
  const u = lt - T.G, per = 0.42, ph = (u % per) / per, stamp = Math.sin(Math.PI * Math.min(1, ph * 2.2)) * (ph < 0.46 ? 1 : 0);
  const shake = 2.6 * Math.exp(-ph * 9);
  g.save(); camT(g, 1020 - 20 * u / 2.7, 580, 1.0 + 0.1 * u / 2.7, 0, 0, 0);
  g.drawImage(pressLayer(), 0, 0);
  g.translate(Math.sin(u * 90) * shake * 0.5, shake * 0.8);
  // press body
  const bx = 820, by = 880, bw = 640, bh = 330;
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.ellipse(bx + bw / 2, by + 8, bw * 0.62, 24, 0, 0, TAU); g.fill();
  g.fillStyle = lg(g, bx, 0, bx + bw, 0, [[0, '#2a4a7a'], [0.6, '#3f6aa8'], [1, '#6a9ae0']]); rr(g, bx, by - bh, bw, bh, 22); g.fill();
  g.fillStyle = 'rgba(0,0,30,0.3)'; g.fillRect(bx, by - 70, bw, 70);
  g.fillStyle = '#e8c24a'; g.fillRect(bx, by - bh + 20, bw, 8); g.fillRect(bx, by - 52, bw, 8);
  // hopper
  g.fillStyle = '#1e3558'; g.beginPath(); g.moveTo(bx + 80, by - bh); g.lineTo(bx + 560, by - bh); g.lineTo(bx + 480, by - bh - 130); g.lineTo(bx + 160, by - bh - 130); g.closePath(); g.fill();
  g.fillStyle = 'rgba(120,255,200,0.9)'; g.beginPath(); g.moveTo(bx + 170, by - bh - 130); g.lineTo(bx + 470, by - bh - 130); g.lineTo(bx + 450, by - bh - 112); g.lineTo(bx + 190, by - bh - 112); g.closePath(); g.fill();
  addMode(g, () => rg(g, bx + 320, by - bh - 130, 220, [[0, 'rgba(120,255,200,0.4)'], [1, 'rgba(120,255,200,0)']]));
  // rollers
  for (let k = 0; k < 3; k++) {
    const rx = bx + 150 + k * 170, ry = by - 170;
    g.fillStyle = '#1a2a46'; g.beginPath(); g.arc(rx, ry, 70, 0, TAU); g.fill();
    g.fillStyle = '#c9d4ea'; g.beginPath(); g.arc(rx, ry, 52, 0, TAU); g.fill();
    g.strokeStyle = '#3a4a6a'; g.lineWidth = 8; for (let i = 0; i < 6; i++) { const a = u * (k % 2 ? -9 : 9) + i / 6 * TAU; g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + Math.cos(a) * 48, ry + Math.sin(a) * 48); g.stroke(); }
    g.fillStyle = '#e8c24a'; g.beginPath(); g.arc(rx, ry, 11, 0, TAU); g.fill();
  }
  // stamp head
  const sy = by - bh - 40 + 70 * stamp;
  g.fillStyle = '#9fb0cf'; g.fillRect(bx + 290, by - bh - 130 + 10, 60, sy - (by - bh - 130) - 10); g.fillStyle = '#e8c24a'; rr(g, bx + 250, sy - 20, 140, 36, 8); g.fill();
  // chute (right)
  g.fillStyle = '#0c1424'; g.beginPath(); g.moveTo(bx + bw - 6, by - 190); g.lineTo(bx + bw + 90, by - 150); g.lineTo(bx + bw + 90, by - 120); g.lineTo(bx + bw - 6, by - 100); g.closePath(); g.fill();
  const cxs = bx + bw + 70, cys = by - 138;
  // bills
  for (let i = 0; i < 70; i++) {
    const t0 = T.G + 0.25 + i * 0.038, a = lt - t0; if (a < 0 || a > 1.6) continue;
    const vx = 330 + hash1(i) * 220, vy = -300 - hash1(i + 3) * 200, gv = 1100;
    const px = cxs + vx * a, py = cys + vy * a + 0.5 * gv * a * a;
    if (py > 860 + hash1(i + 7) * 30) continue;
    bill(g, px, py, 1.05, a * (4 + hash1(i + 1) * 6) * (hash1(i + 11) < 0.5 ? 1 : -1), Math.cos(a * 11 + i), i % 3 === 0);
  }
  // cash pile growing right of the press
  const ph2 = clamp(u / 2.7), pile = 40 + 150 * ph2;
  g.fillStyle = '#2f7a47'; g.beginPath(); g.moveTo(1560, 880); g.quadraticCurveTo(1650, 880 - pile * 1.1, 1790, 880 - pile * 0.5); g.lineTo(1960, 880); g.closePath(); g.fill();
  g.fillStyle = '#4faa66'; g.beginPath(); g.moveTo(1590, 880); g.quadraticCurveTo(1670, 880 - pile, 1760, 880 - pile * 0.5); g.lineTo(1830, 880); g.closePath(); g.fill();
  g.strokeStyle = '#92d9a3'; g.lineWidth = 3; for (let i = 0; i < 9; i++) { const px = 1600 + i * 22, py = 880 - pile * (0.4 + 0.5 * Math.sin((i + 1) / 10 * Math.PI)); g.beginPath(); g.moveTo(px, py + 10); g.lineTo(px + 26, py + 4); g.stroke(); }
  // hero feeds sheets
  const hx = 520, hs = 1.2;
  const reach = clamp(stamp * 1.0);
  const jh = man(g, { x: hx, y: 905, s: hs, facing: 1, lean: 0.18, step: 0.5 * smooth(ph * 5) * (1 - smooth((ph - 0.3) * 5)), headDown: 0.12, eyeOpen: 1, eyeGlow: 0.9, t: lt, flutter: 0.3, bob: 0.3 });
  // cyan sheet dropping into the hopper
  const sh = (ph * 1.0);
  const sx = lerp(jh.handF.x, bx + 330, easeOut(clamp(ph * 3))), sy2 = lerp(jh.handF.y, by - bh - 120, easeOut(clamp(ph * 3)));
  addMode(g, () => { g.fillStyle = 'rgba(140,240,255,0.9)'; g.save(); g.translate(sx, sy2); g.rotate(-0.2 + ph * 0.6); g.fillRect(-36, -22, 72, 44); g.restore(); rg(g, sx, sy2, 60, [[0, 'rgba(120,230,255,0.5)'], [1, 'rgba(120,230,255,0)']]); });
  // ghost hero a beat ahead, feeding the next sheet
  man(g, { x: hx - 130, y: 915, s: hs, facing: 1, lean: 0.18, step: 0.5 * smooth(((ph + 0.5) % 1) * 5) * (1 - smooth(((ph + 0.5) % 1 - 0.3) * 5)), eyeOpen: 1, eyeGlow: 1, t: lt, pal: palGhost(0.5), alpha: 1 });
  g.restore();
  addMode(g, () => rg(g, 1500, 900, 600, [[0, 'rgba(120,255,170,0.12)'], [1, 'rgba(120,255,170,0)']]));
}

// ================================================================== H: counter + money rain
function vaultLayer() {
  return layer('vault', W, H, (x) => {
    x.fillStyle = lg(x, 0, 0, 0, H, [[0, '#07050f'], [0.5, '#1a1230'], [1, '#08060c']]); x.fillRect(0, 0, W, H);
    const r = rng(8);
    for (let i = 0; i < 30; i++) { const bx = r() * W, by = r() * 700, s = 20 + r() * 80; rg(x, bx, by, s, [[0, 'rgba(255,220,130,0.08)'], [1, 'rgba(255,220,130,0)']]); }
    x.save(); x.globalCompositeOperation = 'screen';
    for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.2; x.fillStyle = lg(x, 960, 0, 960 + Math.cos(a) * 1200, Math.sin(a) * -1200 + 700, [[0, 'rgba(255,220,130,0.07)'], [1, 'rgba(255,220,130,0)']]); x.beginPath(); x.moveTo(960, -40); x.lineTo(960 + Math.cos(a - 0.05) * 1400, 1100); x.lineTo(960 + Math.cos(a + 0.05) * 1400, 1100); x.closePath(); x.fill(); }
    x.restore();
    x.fillStyle = lg(x, 0, 900, 0, H, [[0, '#2a1c0c'], [1, '#080604']]); x.fillRect(0, 900, W, H - 900);
  });
}
function shotH(g, lt) {
  const u = lt - T.Hh;
  const pops = [[21.45, 0], [22.55, 1], [23.35, 2]];
  let vp = 0; pops.forEach((p) => { vp += Math.exp(-(lt - p[0]) * 7) * (lt >= p[0] ? 1 : 0); });
  const sk = shakeAt(lt, 22.5, 10, 8), sk3 = shakeAt(lt, 23.3, 16, 7);
  const z = 1.0 + 0.04 * u / 3.1 + 0.03 * vp;
  g.save(); camT(g, 960, 540, z, 0, sk.x + sk3.x, sk.y + sk3.y);
  g.drawImage(vaultLayer(), 0, 0);
  // value
  let v = 1000;
  if (lt > 22.35) v = Math.pow(10, lerp(3, 6, smooth((lt - 22.35) / 0.28)));
  if (lt > 23.15) v = Math.pow(10, lerp(6, 9, smooth((lt - 23.15) / 0.32)));
  const pop = lt >= 21.4 ? spring(lt - 21.4, 150, 14) : 0;
  // rain behind
  const cnt = Math.floor(lt < 21.45 ? 0 : lt < 22.5 ? 28 : lt < 23.3 ? 70 : 150);
  for (let i = 0; i < cnt; i++) {
    const t0 = T.Hh + hash1(i + 400) * 3, P = 3.2 + hash1(i + 20), age = lt - t0; if (age < 0) continue;
    const a2 = age % P, yy = -60 + a2 * (420 + hash1(i + 30) * 380), xx = hash1(i) * 2000 - 40 + Math.sin(a2 * 3 + i) * 40;
    if (yy > 1100) continue;
    bill(g, xx, yy, 0.8 + hash1(i + 2) * 0.7, a2 * (3 + hash1(i + 4) * 5) * (i % 2 ? 1 : -1), Math.cos(a2 * 9 + i), i % 3 === 0);
  }
  // LED panel
  const px = 960, py = 380, pw = 1560, ph2 = 300;
  g.save(); g.translate(px, py); g.scale(lerp(0.7, 1, pop) * (1 + 0.04 * vp), lerp(0.7, 1, pop) * (1 + 0.04 * vp)); g.globalAlpha = clamp(pop * 2);
  g.fillStyle = '#0a0812'; rr(g, -pw / 2 - 16, -ph2 / 2 - 16, pw + 32, ph2 + 32, 26); g.fill();
  g.strokeStyle = '#d9a844'; g.lineWidth = 8; rr(g, -pw / 2 - 12, -ph2 / 2 - 12, pw + 24, ph2 + 24, 24); g.stroke();
  g.fillStyle = lg(g, 0, -ph2 / 2, 0, ph2 / 2, [[0, '#071a12'], [1, '#031008']]); rr(g, -pw / 2, -ph2 / 2, pw, ph2, 14); g.fill();
  const txt = '$' + fmt(v), fs = 200, cw = fs * 0.58;
  g.font = '900 ' + fs + 'px ' + F_UI; g.textAlign = 'center'; g.textBaseline = 'middle';
  let tw = 0; for (let i = 0; i < txt.length; i++) tw += txt[i] === ',' ? cw * 0.5 : cw;
  let sc = Math.min(1, (pw - 120) / tw);
  g.save(); g.scale(sc, sc);
  const hue = lt < 22.5 ? ['#7dffb0', '60,255,150'] : lt < 23.3 ? ['#b8ff9a', '160,255,100'] : ['#ffe06a', '255,210,80'];
  g.shadowColor = 'rgba(' + hue[1] + ',0.9)'; g.shadowBlur = 40 + 30 * vp; g.fillStyle = hue[0];
  let xx = -tw / 2; for (let i = 0; i < txt.length; i++) { const ch = txt[i], w = ch === ',' ? cw * 0.5 : cw; g.fillText(ch, xx + w / 2, 6); xx += w; }
  g.shadowBlur = 0; g.restore();
  g.fillStyle = 'rgba(0,12,6,0.25)'; for (let yy = -ph2 / 2; yy < ph2 / 2; yy += 5) g.fillRect(-pw / 2, yy, pw, 1.5);
  g.restore();
  // coin burst on each pop
  pops.forEach((p, k) => { const a = lt - p[0]; if (a < 0 || a > 0.9) return; for (let i = 0; i < 9; i++) { const ang = i / 9 * TAU + k, d = 140 + 420 * easeOut(a / 0.9) * (0.6 + hash1(i + k * 9) * 0.6); sparkle(g, 960 + Math.cos(ang) * d, 380 + Math.sin(ang) * d * 0.6, 16 * (1 - a / 0.9) + 4, 1 - a / 0.9, ''); } });
  // cash mountain
  const grow = 0.3 + 0.7 * smooth((lt - 21.4) / 2.7);
  const mh = 260 * grow;
  g.fillStyle = '#245f38'; g.beginPath(); g.moveTo(-100, 1100); g.quadraticCurveTo(500, 1050 - mh * 0.7, 960, 1010 - mh); g.quadraticCurveTo(1500, 1050 - mh * 0.7, 2040, 1100); g.closePath(); g.fill();
  g.fillStyle = '#3f9a5a'; g.beginPath(); g.moveTo(80, 1100); g.quadraticCurveTo(560, 1060 - mh * 0.62, 960, 1030 - mh); g.quadraticCurveTo(1420, 1060 - mh * 0.62, 1840, 1100); g.closePath(); g.fill();
  for (let i = 0; i < 40; i++) { const bxp = 300 + hash1(i + 90) * 1320, ty = 1020 - mh * Math.sin(clamp((bxp - 100) / 1720) * Math.PI) * 0.92 + 18 + hash1(i + 80) * 60; bill(g, bxp, ty, 0.9, (hash1(i + 60) - 0.5) * 0.9, 0.7, i % 2 === 0); }
  // hero atop-left, arms up feeling
  const hy = 1030 - mh * 0.95;
  man(g, { x: 560, y: Math.min(1060, 960 + (1 - grow) * 80) + 0, s: 1.35, facing: 1, lean: -0.02, headDown: -0.1, eyeOpen: 1, eyeGlow: 0.6, t: lt, flutter: 0.4, bob: 0.2, shadow: false });
  g.restore();
}

// ================================================================== I: penthouse + curtains
function pentLayer() {
  return layer('pent', W, H, (x) => {
    x.fillStyle = lg(x, 0, 0, 0, H, [[0, '#0a0814'], [1, '#0e0a14']]); x.fillRect(0, 0, W, H);
    // window: city night
    const wx = 720, wy = 60, ww = 1160, wh = 790;
    x.save(); x.beginPath(); x.rect(wx, wy, ww, wh); x.clip();
    x.fillStyle = lg(x, 0, wy, 0, wy + wh, [[0, '#04061a'], [0.5, '#1e1244'], [0.85, '#a2406a'], [1, '#ff9a6a']]); x.fillRect(wx, wy, ww, wh);
    const r = rng(2468);
    for (let i = 0; i < 90; i++) { x.fillStyle = 'rgba(255,255,255,' + (0.2 + r() * 0.5) + ')'; x.fillRect(wx + r() * ww, wy + r() * 300, 2, 2); }
    rg(x, wx + 880, wy + 150, 110, [[0, 'rgba(255,248,230,0.95)'], [0.4, 'rgba(255,240,210,0.9)'], [0.43, 'rgba(255,220,190,0.2)'], [1, 'rgba(255,220,190,0)']]);
    for (let layerI = 0; layerI < 4; layerI++) {
      let bx = wx - 40; const col = ['#3a2058', '#26163e', '#170e2c', '#0a0618'][layerI];
      while (bx < wx + ww) {
        const bw = 50 + r() * 100, bh = 140 + r() * 330 - layerI * 30;
        const by = wy + wh - bh - layerI * 26 + 20;
        x.fillStyle = col; x.fillRect(bx, by, bw, bh + 60);
        const rows = Math.floor(bh / 16);
        for (let k = 0; k < rows * bw / 20; k++) if (r() < 0.5) { x.fillStyle = r() < 0.85 ? 'rgba(255,214,140,' + (0.35 + r() * 0.55) + ')' : 'rgba(140,225,255,0.7)'; x.fillRect(bx + 4 + r() * (bw - 10), by + 8 + r() * (bh - 12), 4, 6); }
        if (layerI > 1 && r() < 0.3) { x.fillStyle = col; x.fillRect(bx + bw / 2 - 1, by - 40, 3, 40); }
        bx += bw + r() * 8;
      }
    }
    // horizon glow
    x.fillStyle = lg(x, 0, wy + wh - 160, 0, wy + wh, [[0, 'rgba(255,150,100,0)'], [1, 'rgba(255,150,100,0.45)']]); x.fillRect(wx, wy + wh - 160, ww, 160);
    x.restore();
    x.fillStyle = '#05060e';
    x.fillRect(wx - 16, wy - 16, ww + 32, 16); x.fillRect(wx - 16, wy + wh, ww + 32, 16); x.fillRect(wx - 16, wy, 16, wh); x.fillRect(wx + ww, wy, 16, wh);
    x.fillRect(wx + ww * 0.5 - 6, wy, 12, wh); x.fillRect(wx + ww * 0.25 - 4, wy, 8, wh); x.fillRect(wx + ww * 0.75 - 4, wy, 8, wh);
    // wall (left room)
    x.fillStyle = lg(x, 0, 0, 720, 0, [[0, '#120e20'], [1, '#241a36']]); x.fillRect(0, 0, 704, 880);
    // floor
    x.fillStyle = lg(x, 0, 866, 0, H, [[0, '#2c2030'], [0.4, '#1a1220'], [1, '#07050a']]); x.fillRect(0, 866, W, H - 866);
    x.save(); x.globalCompositeOperation = 'screen'; x.fillStyle = lg(x, 0, 866, 0, H, [[0, 'rgba(255,140,100,0.3)'], [1, 'rgba(255,140,100,0)']]); x.fillRect(wx, 866, ww, 214); x.restore();
    x.fillStyle = '#05060e'; x.fillRect(0, 862, W, 6);
    // trading desk + screens (left)
    x.fillStyle = '#2a1a22'; x.fillRect(60, 690, 560, 22); x.fillStyle = '#150c14'; x.fillRect(80, 712, 520, 150);
    [[90, 480, 170, 120], [270, 450, 200, 150], [480, 480, 130, 120]].forEach((m) => { x.fillStyle = '#05070f'; rr(x, m[0] - 8, m[1] - 8, m[2] + 16, m[3] + 16, 8); x.fill(); });
    // cash stacks on the floor
    for (let i = 0; i < 14; i++) { const sx = 90 + (i % 7) * 66 + (i > 6 ? 30 : 0), sy = 905 + (i > 6 ? 40 : 0); for (let k = 0; k < 4 + (i % 3); k++) { x.fillStyle = k % 2 ? '#3f9a5a' : '#4faa66'; x.fillRect(sx, sy - k * 12, 54, 12); } x.fillStyle = '#e8e0c0'; x.fillRect(sx + 22, sy - (3 + (i % 3)) * 12, 10, (4 + (i % 3)) * 12); }
    // plant
    x.fillStyle = '#0c0a14'; x.fillRect(640, 790, 40, 76);
    x.strokeStyle = '#102a22'; x.lineWidth = 9; x.lineCap = 'round'; for (let i = 0; i < 7; i++) { x.beginPath(); x.moveTo(660, 790); x.quadraticCurveTo(660 + (i - 3) * 40, 700 - i % 3 * 20, 660 + (i - 3) * 62, 740 - (i % 2) * 40); x.stroke(); }
  });
}
function curtainPanel(g, xa, xb, top, bot, t, dir) {
  const w = xb - xa; if (w < 2) return;
  const n = Math.max(3, Math.floor(w / 26));
  for (let i = 0; i < n; i++) {
    const x0 = xa + w * i / n, x1 = xa + w * (i + 1) / n, f = (i % 2) ? 0.0 : 1.0;
    const sway = Math.sin(t * 1.3 + i * 0.9) * 2.2;
    g.fillStyle = lg(g, x0, 0, x1, 0, [[0, f ? '#5a1a30' : '#8a2a48'], [0.5, f ? '#7a2640' : '#b13a5a'], [1, f ? '#3a0f20' : '#5a1a30']]);
    g.beginPath(); g.moveTo(x0, top); g.lineTo(x1, top); g.lineTo(x1 + sway, bot); g.lineTo(x0 + sway, bot); g.closePath(); g.fill();
  }
  g.fillStyle = 'rgba(255,170,120,0.18)'; g.fillRect(dir > 0 ? xb - 3 : xa, top, 3, bot - top);
  g.fillStyle = 'rgba(8,3,12,0.35)'; g.fillRect(xa, bot - 70, w, 70);
}
function shotI(g, lt) {
  const u = lt - T.I, z = 1.0 + 0.07 * u / 2.8;
  g.save(); camT(g, 1000, 520, z, 0, 0, 0);
  g.drawImage(pentLayer(), 0, 0);
  // screens
  chartMini(g, 90, 480, 170, 120, 1, lt, 0); chartMini(g, 270, 450, 200, 150, 2, lt, 0); chartMini(g, 480, 480, 130, 120, 3, lt, 0);
  addMode(g, () => { rg(g, 350, 540, 380, [[0, 'rgba(80,220,200,0.24)'], [1, 'rgba(80,220,200,0)']]); rg(g, 1300, 460, 700, [[0, 'rgba(255,170,120,0.1)'], [1, 'rgba(255,170,120,0)']]); });
  // red aviation lights blink
  addMode(g, () => { [[1110, 340], [1520, 260], [1760, 420]].forEach((p, i) => { const on = ((lt * 0.9 + i * 0.3) % 1) < 0.35 ? 1 : 0.15; rg(g, p[0], p[1], 20, [[0, 'rgba(255,60,70,' + on + ')'], [1, 'rgba(255,60,70,0)']]); }); });
  // hero: gazes at the city, then walks and pulls the curtains closed
  const pull0 = 25.05, pu = clamp((lt - pull0) / 1.15);
  const hx = 690 + 380 * easeInOut(pu), mv = pu > 0 && pu < 1 ? 1 : 0;
  const st = 0.5 * smooth((lt - 24.9) / 0.2) * (1 - smooth((lt - 26.55) / 0.3));
  const hopt = { x: hx, y: 935, s: 1.28, facing: 1, walk: 0.7 * mv, phase: phaseOf(hx, 1.28), lean: 0.05, step: st, headDown: 0.05, t: lt, flutter: 0.15, bob: 0.4 };
  const jh = man(g, Object.assign({ nodraw: true }, hopt));
  // curtains (hero is drawn in front of them, after)
  const handX = jh.handF.x, edgeL = lt < 24.95 ? 780 : Math.max(780, Math.min(1290, handX + 18)), edgeR = 1290 + (1290 - edgeL) + 0;
  const top = 40, bot = 870;
  curtainPanel(g, 704, edgeL, top, bot, lt, 1);
  curtainPanel(g, Math.min(1890, edgeR), 1892, top, bot, lt, -1);
  g.fillStyle = '#c99a3c'; g.fillRect(690, top - 18, 1210, 12);
  if (lt > 24.95 && edgeL < 1285) { g.strokeStyle = '#e8cf8a'; g.lineWidth = 5; g.beginPath(); g.moveTo(edgeL, 500); g.lineTo(jh.handF.x, jh.handF.y); g.stroke(); }
  // when closed, the room goes quiet and dim
  const closed = smooth((edgeL - 1180) / 110);
  g.fillStyle = 'rgba(8,4,14,' + 0.4 * closed + ')'; g.fillRect(-200, -200, 2400, 1500);
  man(g, hopt);
  g.restore();
}

// ================================================================== main
const SHOTS = [
  [T.A, shotA], [T.B, shotB], [T.C, shotC], [T.X, shotX], [T.D, shotD], [T.E, shotE], [T.F, shotF], [T.G, shotG], [T.Hh, shotH], [T.I, shotI],
];
const CUTS = [T.B, T.C, T.X, T.D, T.E, T.F, T.G, T.Hh, T.I];
function draw(g, lt, dur) {
  g.save(); g.fillStyle = '#0a0610'; g.fillRect(0, 0, W, H);
  let fn = SHOTS[0][1];
  for (let i = SHOTS.length - 1; i >= 0; i--) if (lt >= SHOTS[i][0]) { fn = SHOTS[i][1]; break; }
  fn(g, lt);
  g.restore();
  // cut punch (light flash right after each cut)
  let fl = 0;
  for (const c of CUTS) if (lt >= c && lt < c + 0.3) fl = Math.max(fl, 0.28 * Math.exp(-(lt - c) * 18));
  if (fl > 0.01) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = fl; g.fillStyle = '#fff1d6'; g.fillRect(0, 0, W, H); g.restore(); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

CH.ch4 = { draw };
})();
