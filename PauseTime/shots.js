// shots.js — the shot list, captions and finishing for "What If You Could Pause Time?". Needs scenes.js (window.PT).
(function (G) {
'use strict';
const { W, H, END, T, rr, lin, rad, glow, win, layer, camera, shake, font, PAL, DARK, host, street, freezeGrade, hud, snapFX, bird, cloud } = PT;
const L = VO.lines;

// ================================================================== cached textures
const CACHE = {};
function rainBG() {                                    // frozen street, darkened and blurred once
  if (CACHE.rain) return CACHE.rain;
  const c = layer(W, H), g = c.getContext('2d');
  const s = layer(W / 2, H / 2), sg = s.getContext('2d');
  sg.scale(0.5, 0.5); camera(sg, 540, 980, 1.25); street(sg, T.snap1); sg.setTransform(1, 0, 0, 1, 0, 0);
  g.filter = 'blur(14px) saturate(0.55) brightness(0.62)'; g.drawImage(s, -20, -20, W + 40, H + 40); g.filter = 'none';
  g.fillStyle = 'rgba(40,70,140,0.35)'; g.fillRect(0, 0, W, H);
  return (CACHE.rain = c);
}
function noiseTile() {
  if (CACHE.noise) return CACHE.noise;
  const c = layer(256, 256), g = c.getContext('2d'), d = g.createImageData(256, 256), R = rng(99);
  for (let i = 0; i < d.data.length; i += 4) { const v = R() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); return (CACHE.noise = c);
}
G.warm = () => { rainBG(); noiseTile(); };

// ================================================================== shared painters
function blueprint(g, t, tint) {
  g.fillStyle = lin(g, 0, 0, 0, H, [[0, '#0d1d45'], [1, '#081232']]); g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(110,190,255,0.08)'; g.lineWidth = 2;
  for (let x = 0; x <= W; x += 45) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y <= H; y += 45) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.strokeStyle = 'rgba(110,190,255,0.16)';
  for (let x = 0; x <= W; x += 225) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y <= H; y += 225) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  if (tint) { g.fillStyle = tint; g.fillRect(0, 0, W, H); }
  g.strokeStyle = 'rgba(140,210,255,0.5)'; g.lineWidth = 3;
  [[40, 170, 1, 1], [W - 40, 170, -1, 1], [40, H - 140, 1, -1], [W - 40, H - 140, -1, -1]].forEach(([x, y, sx, sy]) => { g.beginPath(); g.moveTo(x, y + 50 * sy); g.lineTo(x, y); g.lineTo(x + 50 * sx, y); g.stroke(); });
}
function label(g, txt, x, y, a, col, size, align) {
  return;                                          // text labels are off: keep the screen text-free
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.font = font(800, size || 34); g.textAlign = align || 'center'; g.textBaseline = 'middle';
  const w = g.measureText(txt).width + 36, x0 = align === 'left' ? x - 18 : align === 'right' ? x - w + 18 : x - w / 2;
  g.fillStyle = 'rgba(8,16,40,0.78)'; rr(g, x0, y - 30, w, 60, 14); g.fill();
  g.strokeStyle = col || '#7fd4ff'; g.lineWidth = 3; g.stroke();
  g.fillStyle = col || '#bfe9ff'; g.fillText(txt, x, y + 1); g.restore();
}
function pauseIcon(g, x, y, s, a, col) {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.translate(x, y); g.scale(s, s);
  g.fillStyle = 'rgba(10,20,50,0.55)'; rr(g, -120, -120, 240, 240, 60); g.fill();
  g.strokeStyle = col || '#9fe2ff'; g.lineWidth = 8; g.stroke();
  g.fillStyle = col || '#c9f0ff'; rr(g, -52, -62, 36, 124, 10); g.fill(); rr(g, 16, -62, 36, 124, 10); g.fill();
  g.restore();
}
function eyeDiagram(g, x, y, s, dim, lit) {
  g.save(); g.translate(x, y); g.scale(s, s); g.rotate(-0.55);
  g.fillStyle = 'rgba(230,245,255,' + (0.95 - dim * 0.55) + ')';
  g.beginPath(); g.moveTo(-150, 0); g.quadraticCurveTo(0, -120, 150, 0); g.quadraticCurveTo(0, 120, -150, 0); g.fill();
  g.strokeStyle = '#7fd4ff'; g.lineWidth = 6; g.stroke();
  g.fillStyle = mixHex('#3a8fe0', '#1a2340', dim); g.beginPath(); g.arc(-10, 0, 62, 0, TAU); g.fill();
  g.fillStyle = '#060912'; g.beginPath(); g.arc(-10, 0, 30 + 6 * lit, 0, TAU); g.fill();
  if (lit > 0.02) { g.globalAlpha = lit; g.fillStyle = '#ff5a5a'; g.beginPath(); g.arc(-12, 2, 10, 0, TAU); g.fill(); g.globalAlpha = 1; }
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(8, -22, 11, 0, TAU); g.fill();
  g.restore();
}
function apple(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#e8434d'; g.beginPath(); g.arc(-34, 0, 62, 0, TAU); g.arc(34, 0, 62, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(0, 20, 88, 70, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(-44, -18, 18, 30, -0.4, 0, TAU); g.fill();
  g.fillStyle = 'rgba(80,0,20,0.25)'; g.beginPath(); g.ellipse(36, 40, 40, 34, 0, 0, TAU); g.fill();
  g.strokeStyle = '#6b3d1f'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -48); g.quadraticCurveTo(4, -80, 16, -96); g.stroke();
  g.fillStyle = '#4fbf5f'; g.beginPath(); g.ellipse(36, -82, 30, 14, -0.5, 0, TAU); g.fill();
  g.restore();
}
function sun(g, x, y, t) {
  glow(g, x, y, 260, 'rgba(255,214,90,1)', 0.55);
  g.save(); g.translate(x, y); g.rotate(t * 0.4);
  g.strokeStyle = '#ffd35a'; g.lineWidth = 10; g.lineCap = 'round';
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * 92, Math.sin(a) * 92); g.lineTo(Math.cos(a) * 120, Math.sin(a) * 120); g.stroke(); }
  g.restore();
  g.fillStyle = rad(g, x - 20, y - 20, 10, 80, [[0, '#fff3b8'], [1, '#ffbf2f']]); g.beginPath(); g.arc(x, y, 76, 0, TAU); g.fill();
}
function drop(g, x, y, r, a, wob) {           // glossy hanging raindrop
  const sx = 1 + (wob || 0), sy = 1 - (wob || 0) * 0.8;
  g.save(); g.translate(x, y); g.scale(sx, sy); g.globalAlpha = a;
  g.fillStyle = rad(g, -r * 0.3, -r * 0.2, r * 0.1, r * 1.3, [[0, 'rgba(235,248,255,0.55)'], [0.7, 'rgba(150,200,255,0.28)'], [1, 'rgba(70,120,210,0.55)']]);
  g.beginPath(); g.moveTo(0, -r * 2.1); g.quadraticCurveTo(r * 0.45, -r * 0.9, r, r * 0.15); g.arc(0, r * 0.15, r, 0, Math.PI); g.quadraticCurveTo(-r * 0.45, -r * 0.9, 0, -r * 2.1); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = Math.max(1.5, r * 0.12); g.beginPath(); g.arc(0, r * 0.15, r * 0.72, Math.PI * 0.95, Math.PI * 1.35); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(-r * 0.32, -r * 0.15, r * 0.16, r * 0.26, -0.4, 0, TAU); g.fill();
  g.restore();
}
function hand(g0, x, y, s, t, strain, rim) {      // big close-up hand (dark mitten, rim lit) for the finale
  if (!CACHE.hand) CACHE.hand = layer(W, H);
  const g = CACHE.hand.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  const sh = Math.sin(t * 43) * 3 * strain, sh2 = Math.cos(t * 37) * 2 * strain;
  g.save(); g.translate(x + sh, y + sh2); g.scale(s, s);
  const body = (fill, stroke) => {
    g.fillStyle = fill; g.strokeStyle = stroke; g.lineWidth = 6;
    // sleeve
    g.beginPath(); g.moveTo(-120, 260); g.lineTo(-90, 120); g.lineTo(90, 120); g.lineTo(130, 260); g.closePath(); g.fill(); if (stroke) g.stroke();
    // palm
    g.beginPath(); g.ellipse(0, 40, 118, 110, 0, 0, TAU); g.fill(); if (stroke) g.stroke();
    // index finger (pressing on thumb)
    g.save(); g.translate(30, -50); g.rotate(-0.55 + 0.08 * strain);
    g.beginPath(); g.roundRect(-34, -150, 68, 170, 34); g.fill(); if (stroke) g.stroke(); g.restore();
    // middle finger (the one that would snap)
    g.save(); g.translate(-30, -40); g.rotate(-0.15 - 0.05 * strain);
    g.beginPath(); g.roundRect(-34, -190, 68, 205, 34); g.fill(); if (stroke) g.stroke(); g.restore();
    // thumb
    g.save(); g.translate(95, 10); g.rotate(-1.05 + 0.1 * strain);
    g.beginPath(); g.roundRect(-36, -150, 72, 165, 36); g.fill(); if (stroke) g.stroke(); g.restore();
  };
  body('#0b0a12', null);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = lin(g, 160, -200, -60, 120, [[0, 'rgba(170,150,255,' + (0.85 * rim) + ')'], [0.45, 'rgba(80,60,160,' + (0.35 * rim) + ')'], [1, 'rgba(0,0,0,0)']]);
  g.fillRect(-300, -400, 600, 700);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 0.6 * rim; body('rgba(0,0,0,0)', 'rgba(170,150,255,0.55)'); g.globalAlpha = 1;
  g.fillStyle = 'rgba(120,20,30,' + (0.5 * rim) + ')'; g.beginPath(); g.moveTo(-120, 260); g.lineTo(-96, 150); g.lineTo(96, 150); g.lineTo(130, 260); g.fill();
  g.restore();
  g0.drawImage(CACHE.hand, 0, 0);
}

// ================================================================== shots
const SH = [];
const shot = (t0, t1, name, fn, capY) => SH.push({ t0, t1, name, fn, capY: capY || (() => 840) });

// 1) the street, the snap, the world stops
shot(0, L.l3.s, 'city', (g, t) => {
  const u = t - T.snap1, raise = smooth((t - (T.snap1 - 0.55)) / 0.4), lower = smooth((t - T.snap1 - 0.9) / 0.5);
  const z = t < T.snap1 ? lerp(1.0, 1.07, smooth(t / T.snap1)) : lerp(1.07, 1.17, smooth(u / 2.6));
  const [sx, sy] = shake(t, T.snap1, 9, 0.35);
  const hero = { x: 540, y: 1770, s: 2.6, facing: 1, t,
    pose: { a: 'stand', b: { name: 'snap', raise: 1 }, k: raise * (1 - lower) },
    expr: t < 0.9 ? { eyes: 'normal', look: 'fwd' } : t < T.snap1 + 0.4 ? { eyes: 'normal', look: 'upfwd' } : t < T.snap1 + 1.4 ? 'wow' : { eyes: 'wide', look: Math.sin(t * 1.8) > 0 ? 'back' : 'fwd' } };
  const J = MASCOT.joints(hero);
  g.save(); camera(g, 540 + sx, 1010 + sy, z);
  if (u < 0) street(g, t);
  else {
    const R = easeOut(u / 0.75) * 2100;
    if (u < 0.8) street(g, t);
    g.save(); g.beginPath(); g.arc(J.handF.x, J.handF.y, R, 0, TAU); g.clip();
    street(g, T.snap1); freezeGrade(g, 1); g.restore();
  }
  host(g, hero);
  snapFX(g, t, T.snap1, J.handF.x, J.handF.y - 10, true);
  g.restore();
  hud(g, t, t >= T.snap1, 1);
  const ps = t - T.snap1;
  if (ps > 0 && ps < 1.1) PT_pause(g, 540, 580, 0.9 + 0.25 * spring(ps, 260, 18), clamp(1 - (ps - 0.6) / 0.5) * 0.9);
});
function PT_pause(g, x, y, s, a) { pauseIcon(g, x, y, s, a); }

// 2) birds frozen mid-flight (looking up), host peeks from below
shot(L.l3.s, T.rain, 'birds', (g, t) => {
  const u = t - L.l3.s;
  g.save(); camera(g, 540, 960 - u * 18, 1 + u * 0.02);
  g.fillStyle = lin(g, 0, -200, 0, 2100, [[0, '#6fb9ff'], [0.7, '#b8dcff'], [1, '#ffe6cf']]); g.fillRect(-200, -200, 1500, 2400);
  cloud(g, 200, 380, 1.6, 0.95); cloud(g, 860, 760, 1.3, 0.9); cloud(g, 420, 1150, 1.1, 0.85);
  bird(g, 330, 560, 3.6, 0.9, 1); bird(g, 800, 980, 2.6, -0.6, -1); bird(g, 250, 1180, 1.9, 0.3, 1); bird(g, 900, 420, 1.5, 1.4, -1);
  // a loose feather, frozen
  g.save(); g.translate(560, 780); g.rotate(0.6); g.fillStyle = '#e7e6f5'; g.beginPath(); g.ellipse(0, 0, 14, 46, 0, 0, TAU); g.fill(); g.strokeStyle = '#9897bd'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -46); g.lineTo(0, 60); g.stroke(); g.restore();
  freezeGrade(g, 1);
  g.restore();
  const hy = 2330 - easeOut(u / 0.7) * 160;
  host(g, { x: 560, y: hy, s: 3.9, facing: 1, pose: 'lookUp', expr: { eyes: 'wide', look: 'up', sparkle: 0.6 }, t, shadow: false });
  hud(g, t, true, 1);
});

// 3) raindrops hanging like glass beads; host walks in and pokes one
const DROPS = (() => { const R = rng(5), a = []; for (let i = 0; i < 190; i++) a.push({ x: R() * 1300 - 110, y: R() * 1900 + 20, z: 0.35 + R() * 1.05 }); return a.sort((p, q) => p.z - q.z); })();
shot(T.rain, L.l4.s, 'rain', (g, t) => {
  const u = t - T.rain, dur = L.l4.s - T.rain;
  g.drawImage(rainBG(), 0, 0);
  const pan = u * 26;
  const walkK = clamp(u / 1.5), hx = lerp(120, 420, easeOut(walkK));
  const touchT = 1.85;
  const hero = { x: hx, y: 1790, s: 2.5, facing: 1, t,
    pose: u < 1.5 ? 'walk' : { a: 'stand', b: { name: 'point', dir: 0.75 }, k: smooth((u - 1.45) / 0.35) }, phase: u * 1.15,
    expr: u < 1.6 ? { eyes: 'normal', look: 'upfwd' } : { preset: 'wow', look: 'upfwd' } };
  const J = MASCOT.joints(hero);
  const tip = { x: J.handF.x + 22, y: J.handF.y - 26 };
  const back = DROPS.filter(d => d.z < 1), front = DROPS.filter(d => d.z >= 1);
  const drawDrops = (arr) => arr.forEach(d => { const r = 7 + 15 * d.z, x = d.x - pan * d.z; if (Math.hypot(x - tip.x, d.y - tip.y) < 70) return; drop(g, x, d.y, r, 0.55 + 0.4 * Math.min(1, d.z), 0); });
  drawDrops(back);
  host(g, hero);
  const w = u > touchT ? Math.sin((u - touchT) * 22) * 0.22 * Math.exp(-(u - touchT) * 3.2) : 0;
  drop(g, tip.x + 6, tip.y - 18, 30, 0.95, w);
  if (u > touchT) { g.save(); g.globalAlpha = clamp(1 - (u - touchT) / 0.6); g.strokeStyle = '#dff4ff'; g.lineWidth = 4; g.beginPath(); g.arc(tip.x + 6, tip.y - 18, 34 + (u - touchT) * 120, 0, TAU); g.stroke(); g.restore(); }
  drawDrops(front);
  hud(g, t, true, 1);
});

// 4) the bakery: eat everything, nobody knows; 5) "but…" push-in on the face
const TRAYS = (() => {                               // display items: kind, x, y, vanish time
  const a = [], R = rng(11), kinds = ['donut', 'donut', 'cup', 'croissant'];
  let k = 0;
  for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) {
    a.push({ kind: row === 0 ? 'donut' : row === 1 ? 'croissant' : 'cup', x: 150 + i * 150 + (row % 2) * 30, y: 1268 + row * 92, c: ['#ff7fb0', '#7b4a2e', '#ffd36b', '#8fd3ff'][Math.floor(R() * 4)], k: k++ });
  }
  return a;
})();
function pastry(g, p, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  if (p.kind === 'donut') {
    g.fillStyle = '#d9a05b'; g.beginPath(); g.ellipse(0, 0, 46, 30, 0, 0, TAU); g.fill();
    g.fillStyle = p.c; g.beginPath(); g.ellipse(0, -5, 41, 24, 0, 0, TAU); g.fill();
    g.fillStyle = '#5a3a2a'; g.beginPath(); g.ellipse(0, -5, 13, 7, 0, 0, TAU); g.fill();
    ['#fff', '#7fe0ff', '#ffe066', '#9b6bff'].forEach((c, i) => { g.fillStyle = c; g.save(); g.translate(Math.cos(i * 1.7) * 26, -5 + Math.sin(i * 1.7) * 13); g.rotate(i); g.fillRect(-5, -1.5, 10, 3); g.restore(); });
  } else if (p.kind === 'croissant') {
    g.fillStyle = '#e8a64a'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(i * 17, -Math.abs(i) * -4 - 6, 16 - Math.abs(i) * 2, 24 - Math.abs(i) * 4, i * 0.3, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(255,240,200,0.5)'; g.beginPath(); g.ellipse(-6, -16, 10, 5, 0, 0, TAU); g.fill();
  } else {
    g.fillStyle = '#ffb36b'; g.beginPath(); g.moveTo(-30, -6); g.lineTo(30, -6); g.lineTo(22, 30); g.lineTo(-22, 30); g.fill();
    g.fillStyle = p.c; g.beginPath(); g.arc(0, -12, 30, Math.PI, 0); g.arc(0, -26, 18, Math.PI, 0); g.fill();
    g.fillStyle = '#e8434d'; g.beginPath(); g.arc(0, -46, 8, 0, TAU); g.fill();
  }
  g.restore();
}
function bakery(g, t, u, eatK, hero) {
  g.fillStyle = lin(g, 0, 0, 0, 1300, [[0, '#ffd6dc'], [1, '#ffc2c9']]); g.fillRect(-300, -300, 1700, 1600);
  g.fillStyle = 'rgba(255,255,255,0.35)'; for (let x = -300; x < 1400; x += 120) g.fillRect(x, -300, 50, 1600);
  // shelves with bread
  for (let s = 0; s < 3; s++) {
    const y = 470 + s * 210;
    g.fillStyle = '#b77a4a'; g.fillRect(40, y, 1000, 22); g.fillStyle = '#8e5a33'; g.fillRect(40, y + 22, 1000, 8);
    for (let i = 0; i < 6; i++) { const bx = 110 + i * 165; g.fillStyle = i % 2 ? '#d99550' : '#c98543'; g.beginPath(); g.ellipse(bx, y - 34, 66, 36, 0, Math.PI, 0); g.fill(); g.fillRect(bx - 66, y - 34, 132, 34); g.strokeStyle = 'rgba(255,230,180,0.7)'; g.lineWidth = 5; for (let c = -1; c <= 1; c++) { g.beginPath(); g.moveTo(bx + c * 26 - 10, y - 52); g.lineTo(bx + c * 26 + 10, y - 26); g.stroke(); } }
  }
  // pendant lamps
  [220, 540, 860].forEach((x) => { g.strokeStyle = '#4a3a55'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, -300); g.lineTo(x, 250); g.stroke(); g.fillStyle = '#2f6f68'; g.beginPath(); g.moveTo(x - 70, 330); g.quadraticCurveTo(x, 210, x + 70, 330); g.fill(); g.fillStyle = '#fff2c4'; g.beginPath(); g.ellipse(x, 330, 50, 12, 0, 0, TAU); g.fill(); glow(g, x, 360, 280, 'rgba(255,230,170,1)', 0.35); });
  // sign
  g.fillStyle = '#2f6f68'; rr(g, 440, 290, 200, 116, 30); g.fill(); pastry(g, { kind: 'donut', c: '#ff7fb0' }, 540, 352, 1.15);
  // baker (frozen mid-reach) behind the counter
  host(g, { x: 260, y: 1290, s: 1.55, facing: 1, pose: { name: 'point', dir: 0.35 }, expr: { eyes: 'happy' }, t: 0.6, pal: PAL.white, shadow: false });
  // counter + glass case
  g.fillStyle = '#7a4a2e'; g.fillRect(0, 1180, W, 420); g.fillStyle = '#a8673f'; g.fillRect(0, 1180, W, 30);
  g.fillStyle = 'rgba(210,240,255,0.25)'; g.fillRect(60, 1210, 960, 320);
  g.fillStyle = '#f2e6d8'; for (let r = 0; r < 3; r++) g.fillRect(70, 1300 + r * 92, 940, 10);
  TRAYS.forEach((p) => { const gone = eatK * TRAYS.length > p.k + 0.5; if (!gone) pastry(g, p, p.x, p.y, 0.85); });
  g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.moveTo(80, 1210); g.lineTo(240, 1210); g.lineTo(120, 1530); g.lineTo(60, 1530); g.fill();
  g.strokeStyle = '#d9c6b0'; g.lineWidth = 8; g.strokeRect(60, 1210, 960, 320);
  // floor
  for (let y = 1600, r = 0; y < 2000; y += 70 + r * 16, r++) for (let x = -300 + (r % 2) * 80; x < 1400; x += 160) { g.fillStyle = (r % 2) ? '#f4ecf6' : '#e2d6ea'; g.fillRect(x, y, 80, 70 + r * 16); }
}
function plateStack(g, x, y, n) {
  for (let i = 0; i < n; i++) { const yy = y - i * 13; g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, yy, 70, 16, 0, 0, TAU); g.fill(); g.strokeStyle = '#c8c4dc'; g.lineWidth = 3; g.stroke(); }
}
shot(L.l4.s, L.l6.s, 'bakery', (g, t) => {
  const u = t - L.l4.s;
  const eatK = clamp((t - T.eat) / (T.know - T.eat - 0.1));
  const turn = t > T.know - 0.1;
  const thumbs = t > T.amazing && t < T.but + 0.3;
  const chew = Math.sin((t - T.eat) * 14) > 0;
  const hero = { x: 760, y: 1840, s: 2.45, facing: turn ? 1 : -1, t,
    pose: thumbs ? 'thumbsUp' : (t > T.eat && !turn) ? (chew ? 'bite' : 'hold') : turn ? 'stand' : 'walk', phase: u * 1.1,
    expr: t > T.but + 0.25 ? { eyes: 'worry', sweat: clamp((t - T.but - 0.6) / 0.6), look: 'fwd', pop: t > T.but + 1.1 ? '?' : null, popT: t - T.but - 1.1 }
        : thumbs ? 'joy' : turn ? { eyes: 'happy', look: 'fwd' } : t > T.eat ? { eyes: chew ? 'happy' : 'closed' } : { eyes: 'wide', look: 'fwd', sparkle: 0.7 } };
  if (u < 0.9) hero.x = lerp(1000, 760, easeOut(u / 0.9));
  const J = MASCOT.joints(hero);
  // push-in on "but"
  const pk = smooth((t - T.but) / 1.8);
  const cx = lerp(540, J.head.x, pk), cy = lerp(1020, J.head.y + 40, pk), z = lerp(1.0, 2.1, pk);
  g.save(); camera(g, cx, cy, z);
  bakery(g, t, u, eatK, hero);
  freezeGrade(g, 1);
  g.save(); g.globalAlpha = pk * 0.55; g.fillStyle = '#0b0820'; g.fillRect(-500, -500, 2200, 3000); g.restore();
  plateStack(g, 940, 1880, Math.round(eatK * 16));
  host(g, hero);
  if (t > T.eat && !turn && !thumbs) pastry(g, TRAYS[Math.min(TRAYS.length - 1, Math.floor(eatK * TRAYS.length))], J.handF.x + 10, J.handF.y - 8, 0.8);
  // crumbs
  if (t > T.eat) for (let i = 0; i < 14; i++) { const R = rng(70 + i), ct = (t * 1.3 + R()) % 1, x = J.head.x + (R() - 0.5) * 90, y = J.chin.y + ct * 280; g.fillStyle = '#d9a05b'; g.globalAlpha = (1 - ct) * (turn ? 0.4 : 1); g.fillRect(x, y, 7, 6); g.globalAlpha = 1; }
  g.restore();
  hud(g, t, true, 1 - pk);
}, (t) => t > T.but + 0.2 ? 1450 : 840);

// 6–7) lab: light bounces into your eye … pause, and it stops halfway
const SUN = { x: 250, y: 520 }, APPLE = { x: 560, y: 1080 }, EYE = { x: 770, y: 1520 };
const PHOT = (() => { const R = rng(21), a = []; for (let i = 0; i < 70; i++) a.push({ te: L.l6.s - 1.2 + i * 0.105, ax: (R() - 0.5) * 120, ay: (R() - 0.5) * 90, sp: 820 + R() * 160 }); return a; })();
function photonPos(p, tau) {
  const A = { x: APPLE.x + p.ax, y: APPLE.y + p.ay }, E = { x: EYE.x - 30 + p.ax * 0.12, y: EYE.y - 10 + p.ay * 0.1 };
  const d1 = Math.hypot(A.x - SUN.x, A.y - SUN.y), d2 = Math.hypot(E.x - A.x, E.y - A.y), s = tau * p.sp;
  if (s < 0) return null;
  if (s < d1) { const k = s / d1; return { x: lerp(SUN.x, A.x, k), y: lerp(SUN.y, A.y, k), seg: 1, k }; }
  if (s < d1 + d2) { const k = (s - d1) / d2; return { x: lerp(A.x, E.x, k), y: lerp(A.y, E.y, k), seg: 2, k }; }
  return { done: true };
}
shot(L.l6.s, L.l8.s, 'lab-light', (g, t) => {
  const paused = t >= T.pause, tf = paused ? T.pause : t, fk = smooth((t - T.pause) / 0.4);
  blueprint(g, t);
  // dashed guide paths
  g.save(); g.setLineDash([14, 14]); g.lineDashOffset = -tf * 60; g.strokeStyle = 'rgba(127,212,255,0.3)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(SUN.x, SUN.y); g.lineTo(APPLE.x, APPLE.y); g.lineTo(EYE.x - 30, EYE.y - 10); g.stroke(); g.restore();
  sun(g, SUN.x, SUN.y, tf);
  apple(g, APPLE.x, APPLE.y, 1.0);
  // arrivals light the pupil (only while photons keep arriving)
  let lit = 0; for (const p of PHOT) { const q = photonPos(p, tf - p.te); if (q && q.done) lit = 1; }
  const lastArrive = paused ? clamp(1 - (t - T.pause) / 0.5) : 1;
  eyeDiagram(g, EYE.x, EYE.y, 1.25, fk * 0.7, lit * lastArrive);
  // photons
  g.save(); g.globalCompositeOperation = 'lighter';
  let halfP = null, best = 9;
  for (const p of PHOT) {
    const q = photonPos(p, tf - p.te); if (!q || q.done) continue;
    if (paused && q.seg === 2 && Math.abs(q.k - 0.5) < best) { best = Math.abs(q.k - 0.5); halfP = q; }
    const col = fk > 0.5 ? 'rgba(150,230,255,1)' : 'rgba(255,220,110,1)';
    if (!paused || t - T.pause < 0.3) for (let k = 1; k <= 5; k++) { const q2 = photonPos(p, tf - p.te - k * 0.012); if (q2 && !q2.done) { g.globalAlpha = 0.35 * (1 - k / 6) * (paused ? 1 - (t - T.pause) / 0.3 : 1); g.fillStyle = col; g.beginPath(); g.arc(q2.x, q2.y, 9, 0, TAU); g.fill(); } }
    g.globalAlpha = 1; g.fillStyle = rad(g, q.x, q.y, 0, 26, [[0, '#ffffff'], [0.3, col], [1, 'rgba(0,0,0,0)']]); g.fillRect(q.x - 26, q.y - 26, 52, 52);
  }
  g.restore();
  if (paused && fk > 0) { g.save(); g.globalAlpha = 0.25 * fk; g.fillStyle = rad(g, 540, 960, 300, 1200, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(120,210,255,1)']]); g.fillRect(0, 0, W, H); g.restore(); }
  label(g, 'LIGHT', SUN.x + 150, SUN.y - 120, smooth((t - L.l6.s - 0.6) / 0.3), '#ffd35a');
  label(g, 'BOUNCES OFF', APPLE.x + 210, APPLE.y + 160, smooth((t - T.bounces) / 0.3) * (1 - fk));
  label(g, 'YOUR EYE', EYE.x - 160, EYE.y + 180, smooth((t - T.eyes) / 0.3) * (1 - smooth((t - T.half) / 0.3)));
  if (halfP) { const a = smooth((t - T.half) / 0.3); g.save(); g.globalAlpha = a; g.strokeStyle = '#ff5a6a'; g.lineWidth = 6; g.beginPath(); g.arc(halfP.x, halfP.y, 46 + 6 * Math.sin(t * 8), 0, TAU); g.stroke(); g.restore(); label(g, 'STUCK HALFWAY', halfP.x - 40, halfP.y - 110, a, '#ff8a96'); }
  const xk = smooth((t - T.half - 0.5) / 0.3);
  if (xk > 0) { label(g, 'NOTHING ARRIVES', EYE.x - 150, EYE.y + 180, xk, '#ff8a96'); g.save(); g.globalAlpha = xk; g.strokeStyle = '#ff4d5e'; g.lineWidth = 14; g.lineCap = 'round'; const e = { x: EYE.x - 10, y: EYE.y - 5 }; g.beginPath(); g.moveTo(e.x - 60, e.y - 60); g.lineTo(e.x + 60, e.y + 60); g.moveTo(e.x + 60, e.y - 60); g.lineTo(e.x - 60, e.y + 60); g.stroke(); g.restore(); }
  // pause stamp: slams in, then parks top-right
  const ps = t - T.pause;
  if (ps > 0) { const park = smooth((ps - 0.7) / 0.4); pauseIcon(g, lerp(540, 900, park), lerp(560, 250, park), lerp(1.2 * spring(ps, 300, 16), 0.42, park), 1); }
});

// 8) the second snap: everything goes pitch black
shot(L.l8.s, L.l9.s, 'black', (g, t) => {
  const u = t - L.l8.s, raise = smooth((t - (T.snap2 - 0.5)) / 0.35);
  const hero = { x: 520, y: 1800, s: 2.9, facing: 1, t, pose: { a: 'stand', b: { name: 'snap', raise: 1 }, k: raise },
    expr: t < T.snap2 + 0.15 ? { eyes: 'normal', look: 'fwd' } : { eyes: 'wide', look: Math.sin(t * 2.4) > 0 ? 'back' : 'fwd', sweat: clamp((t - T.snap2 - 0.6) / 0.5) } };
  const J = MASCOT.joints(hero);
  const dk = smooth((t - T.snap2 - 0.05) / 0.45);
  const [sx, sy] = shake(t, T.snap2, 7, 0.3);
  g.save(); camera(g, 540 + sx, 1260 + sy, 1.45 + u * 0.03);
  street(g, T.snap1); freezeGrade(g, 1); host(g, hero);
  snapFX(g, t, T.snap2, J.handF.x, J.handF.y - 10, false);
  g.restore();
  if (dk > 0) {
    g.fillStyle = 'rgba(0,0,0,' + dk + ')'; g.fillRect(0, 0, W, H);
    g.save(); camera(g, 540 + sx, 1260 + sy, 1.45 + u * 0.03); g.globalAlpha = dk; host(g, Object.assign({}, hero, { pal: DARK, shadow: false })); g.restore();
  }
  hud(g, t, true, 1 - dk);
}, () => 1450);

// 9) air molecules freeze; 10) every step is concrete
const MOL = (() => { const R = rng(33), a = []; for (let i = 0; i < 190; i++) a.push({ x: R() * 1180 - 50, y: 330 + R() * 1450, o2: R() < 0.22, ph: R() * 10, w: 0.8 + R() * 1.6, a: 18 + R() * 30, rot: R() * TAU, vr: (R() - 0.5) * 3 }); return a; })();
function molecule(g, m, t, frost, hot) {
  const x = m.x + Math.sin(t * m.w + m.ph) * m.a + Math.sin(t * 2.3 * m.w + m.ph * 2) * m.a * 0.4;
  const y = m.y + Math.cos(t * m.w * 1.1 + m.ph) * m.a;
  const r = m.rot + t * m.vr, c = m.o2 ? '#ff6b7a' : '#6fb6ff';
  g.save(); g.translate(x, y); g.rotate(r);
  for (const dx of [-11, 11]) { g.fillStyle = rad(g, dx - 4, -4, 1, 16, [[0, '#ffffff'], [0.35, c], [1, mixHex(c, '#0a1030', 0.5)]]); g.beginPath(); g.arc(dx, 0, 14, 0, TAU); g.fill(); }
  if (frost > 0) { g.globalAlpha = frost; g.strokeStyle = '#d9f4ff'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, 0, 32, 20, 0, 0, TAU); g.stroke(); }
  g.restore();
  return { x, y };
}
shot(L.l9.s, L.l11.s, 'air', (g, t) => {
  const tf = Math.min(t, T.frozen9), frost = smooth((t - T.frozen9) / 0.35), push = t >= L.l10.s;
  blueprint(g, t, 'rgba(0,0,0,' + (push ? 0.15 : 0) + ')');
  const hx = push ? 330 + Math.sin(t * 30) * 2 : 470;
  const hero = { x: hx, y: 1660, s: 2.4, facing: 1, t,
    pose: push ? { name: 'push', shake: 1 } : 'stand',
    expr: push ? { eyes: 'angry', sweat: 1, lines: t > T.concrete ? 'shock' : null } : { eyes: t > T.frozen9 ? 'worry' : 'normal', look: Math.sin(t * 2) > 0 ? 'fwd' : 'back' } };
  const J = MASCOT.joints(hero);
  const cK = smooth((t - T.concrete) / 0.5);
  // molecules (behind / around the host); in the push shot they pack into a wall in front of him
  g.save();
  for (const m of MOL) {
    if (push) { if (m.x < 520) continue; }
    else if (Math.abs(m.x - 470) < 120 && m.y > 1060 && m.y < 1700) continue;
    molecule(g, m, tf, frost * 0.8);
  }
  g.restore();
  if (push && cK > 0) {                                   // the wall becomes concrete
    g.save(); g.globalAlpha = cK * 0.92;
    g.fillStyle = lin(g, 520, 0, 1080, 0, [[0, '#9a98a8'], [1, '#7c7a8c']]); g.fillRect(520, 300, 560, 1500);
    const R = rng(4); for (let i = 0; i < 900; i++) { g.fillStyle = R() > 0.5 ? 'rgba(60,58,72,0.5)' : 'rgba(220,218,230,0.4)'; g.fillRect(520 + R() * 560, 300 + R() * 1500, 3 + R() * 4, 3 + R() * 4); }
    g.strokeStyle = 'rgba(40,38,52,0.8)'; g.lineWidth = 4; g.beginPath(); const hp = J.handF;
    for (let k = 0; k < 6; k++) { let x = 524, y = hp.y + (k - 3) * 30; g.moveTo(x, y); const R2 = rng(80 + k); for (let s = 0; s < 6; s++) { x += 30 + R2() * 40; y += (R2() - 0.5) * 70; g.lineTo(x, y); } }
    g.stroke(); g.restore();
  }
  host(g, hero);
  if (push) { g.save(); g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.lineCap = 'round'; for (let k = 0; k < 3; k++) { const a = -1.9 + k * 0.4, r0 = 120 + Math.sin(t * 20 + k) * 8; g.beginPath(); g.moveTo(J.head.x + Math.cos(a) * r0, J.head.y + Math.sin(a) * r0); g.lineTo(J.head.x + Math.cos(a) * (r0 + 40), J.head.y + Math.sin(a) * (r0 + 40)); g.stroke(); } g.restore(); }
  if (!push) {
    label(g, 'AIR MOLECULES', 760, 560, smooth((t - L.l9.s - 0.3) / 0.3) * (1 - smooth((t - T.frozen9) / 0.3)), '#bfe9ff');
    label(g, 'FROZEN SOLID', 760, 560, smooth((t - T.frozen9) / 0.3), '#d9f4ff');
    if (t > T.frozen9) for (let i = 0; i < 26; i++) { const R = rng(300 + i), a = clamp(1 - Math.abs(((t - T.frozen9) * 1.5 + R()) % 1 - 0.5) * 2); g.fillStyle = 'rgba(230,248,255,' + a * 0.9 + ')'; const x = R() * W, y = 350 + R() * 1400; g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 3, y); g.lineTo(x, y + 12); g.lineTo(x - 3, y); g.fill(); g.beginPath(); g.moveTo(x - 12, y); g.lineTo(x, y + 3); g.lineTo(x + 12, y); g.lineTo(x, y - 3); g.fill(); }
  } else label(g, 'LIKE SOLID CONCRETE', 790, 560, cK, '#e6e4f0');
});

// 11–12) darkness: only his eyes; the hand that can't snap
shot(L.l11.s, L.l13.s, 'dark', (g, t) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  if (t < T.fingers) {
    host(g, { x: 520, y: 2050, s: 3.4, facing: 1, t, pose: 'stand', pal: DARK, shadow: false, expr: { eyes: 'worry', look: Math.sin(t * 1.6) > 0.3 ? 'back' : 'fwd' } });
    const a = smooth((t - T.nosound) / 0.3);
    if (a > 0) { g.save(); g.globalAlpha = a * 0.55; g.strokeStyle = '#6b6488'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 1500); for (let x = 0; x <= W; x += 6) g.lineTo(x, 1500 + Math.sin(x * 0.12) * 60 * Math.exp(-(t - T.nosound) * 3.5) * Math.exp(-Math.abs(x - 540) / 260)); g.stroke(); g.restore(); }
  } else {
    const u = t - T.fingers, strain = smooth(u / 0.6) * (0.6 + 0.4 * Math.sin(t * 3) ** 2);
    const rim = smooth(u / 0.5);
    glow(g, 620, 1000, 700, 'rgba(70,50,150,1)', 0.35 * rim);
    hand(g, 540, 1180, 1.7 + u * 0.03, t, strain, rim);
    const pa = smooth((t - T.snapback) / 0.4) * (1 - smooth((t - T.snapback - 0.9) / 0.5));
    if (pa > 0) { g.save(); g.globalAlpha = pa * 0.35; g.strokeStyle = '#9f96d6'; g.lineWidth = 6; g.beginPath(); g.moveTo(500, 520); g.lineTo(600, 580); g.lineTo(500, 640); g.closePath(); g.stroke(); g.restore(); }
  }
});

// 13) would you still press pause?
shot(L.l13.s, END + 1, 'end', (g, t) => {
  const u = t - L.l13.s;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  host(g, { x: 520, y: 1260, s: 2.2, facing: 1, t, pose: 'stand', pal: DARK, shadow: false, expr: { eyes: 'normal', look: 'fwd' } });
  const a = smooth((u - 0.25) / 0.4), press = smooth((t - (T.q + 1.25)) / 0.12) * (1 - smooth((t - (T.q + 1.45)) / 0.2));
  glow(g, 540, 1450, 420, 'rgba(90,190,255,1)', 0.35 * a);
  pauseIcon(g, 540, 1450, (0.95 + 0.03 * Math.sin(u * 5)) * (1 - 0.08 * press), a);
});

// ================================================================== captions (word by word)
const CH = (() => {                                   // group words into short chunks
  const out = []; let cur = null;
  WORDS.forEach((w, i) => {
    const brk = !cur || cur.words.length >= 3 || cur.line !== w.line || /[.?!,…]$/.test(cur.words[cur.words.length - 1].w);
    if (brk) { cur = { line: w.line, words: [] }; out.push(cur); }
    cur.words.push(w);
  });
  out.forEach((c, i) => { c.s = c.words[0].s; const nx = out[i + 1]; c.e = nx && nx.s - c.words[c.words.length - 1].e < 0.45 ? nx.s : c.words[c.words.length - 1].e + 0.25; });
  return out;
})();
const CAPS = new URLSearchParams(location.search).get('caps') === '1';
const EMPH = /^(pause|stops|freeze|frozen|black|concrete|light|snap|nobody|problem|air|halfway|eyes|still)/i;
function captions(g, t, y) {
  const c = CH.find(c => t >= c.s && t < c.e); if (!c) return;
  const words = c.words.map(w => w.w.replace(/…/g, '...').replace(/^\.\.\.$/, ''));
  g.save(); g.font = font(900, 92); g.textBaseline = 'middle';
  const sp = 22, ws = words.map(w => g.measureText(w.toUpperCase()).width), total = ws.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
  const k = Math.min(1, 980 / total); let x = 540 - total * k / 2;
  const pop = spring(t - c.s, 420, 22);
  g.translate(540, y); g.scale(k * (0.9 + 0.1 * pop), k * (0.9 + 0.1 * pop)); g.translate(-540, -y);
  x = 540 - total / 2;
  c.words.forEach((w, i) => {
    const on = t >= w.s, act = t >= w.s && t < (c.words[i + 1] ? c.words[i + 1].s : c.e);
    const txt = words[i].toUpperCase(), wp = spring(t - w.s, 520, 20);
    g.save(); g.translate(x + ws[i] / 2, y - (act ? 6 * wp : 0)); const sc = on ? 0.85 + 0.15 * wp : 0.85; g.scale(sc, sc);
    g.globalAlpha = on ? 1 : 0.0;
    g.lineJoin = 'round'; g.lineWidth = 16; g.strokeStyle = '#0a0612'; g.strokeText(txt, -ws[i] / 2, 0);
    g.fillStyle = act ? (EMPH.test(w.w) ? '#ffd84a' : '#ffffff') : '#ffffff';
    if (act && EMPH.test(w.w)) { g.shadowColor = 'rgba(255,200,60,0.6)'; g.shadowBlur = 24; }
    g.fillText(txt, -ws[i] / 2, 0); g.restore();
    x += ws[i] + sp;
  });
  g.restore();
}

// ================================================================== frame
function post(g, t) {
  g.save();
  g.fillStyle = rad(g, 540, 960, 600, 1250, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.38)']]); g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.045; g.globalCompositeOperation = 'overlay';
  const n = noiseTile(), ox = Math.floor(hash1(Math.floor(t * 30)) * 256), oy = Math.floor(hash1(Math.floor(t * 30) + 7) * 256);
  for (let y = -oy; y < H; y += 256) for (let x = -ox; x < W; x += 256) g.drawImage(n, x, y);
  g.restore();
}
G.drawFrame = function (g, t) {
  const s = SH.find(s => t >= s.t0 && t < s.t1) || SH[SH.length - 1];
  g.save(); s.fn(g, t); g.restore();
  post(g, t);
  if (CAPS) captions(g, t, s.capY(t));        // burned-in captions are off by default; ?caps=1 turns them on
};
G.PT_SHOTS = SH;
})(window);
