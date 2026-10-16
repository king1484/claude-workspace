// ch/c1.js - Chapter 1 "Hook". Cold open on the conflict: exhausted host, bedtime, but the sun is still high.
// Beats (all times derive from LAYOUT.c1.vo):
//  h1  rub eyes, nod off + jerk awake (the one gag), big yawn, trudge to the bed
//  h2  light flares in from the window, he turns, shields his eyes, walks to the window, sun crawls, he sags
//  h3  push through the window into the sky; a ghost sun runs the 100-tick loop (100 hours, 50 up / 50 down)
//  h4  cut to the street, host realises the goal (idea), thought bubble: sunrise + finish flag, he sets off walking
// Pure function of lt. Caches (room art) are independent of t. Global namespace: window.CH.c1 only.
(function () {
'use strict';
window.CH = window.CH || {};

const W = 1920, HT = 1080;
const L = LAYOUT.c1, V = L.vo;
const T = {
  h1s: V[0].start, h1e: V[0].end, h2s: V[1].start, h2e: V[1].end, h3s: V[2].start, h3e: V[2].end, h4s: V[3].start, h4e: V[3].end, dur: L.dur
};
// derived beat times
T.rub0 = 0; T.rub1 = T.h1s + 0.95;          // rubbing eyes
T.nod0 = T.h1s + 1.2; T.jerk = T.h1s + 1.62; // head drops, then jerks awake
T.yw0 = T.h1s + 2.45; T.yw1 = T.h1s + 3.95;  // the yawn
T.tr0 = T.h1s + 3.95; T.tr1 = T.h2s + 0.25;  // trudge toward the bed
T.flare = T.h2s + 0.2;                       // window flare, turn around
T.wk0 = T.h2s + 1.0; T.wk1 = T.h2s + 2.9;    // walk to the window
T.look0 = T.wk1; T.sag0 = T.h2s + 3.9; T.sag1 = T.h2e - 0.2;
T.zoom0 = T.h3s - 0.45; T.zoom1 = T.h3s + 0.75;    // push through the window
T.gh0 = T.h3s + 0.8; T.gh1 = T.h3e - 0.1;          // ghost sun loop
T.cut = T.h3e + 0.35;                              // hard cut to the street (before h4 starts)
T.idea = T.h4s + 0.75; T.bub = T.h4s + 1.05; T.rise0 = T.h4s + 1.3; T.rise1 = T.h4e - 0.15; T.go = T.h4s + 2.0;
T.hudEnd = T.dur - 0.85;

const sat = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
const ramp = (t, a, d) => smooth(sat((t - a) / d));
const bump = (t, a, b, fi, fo) => ramp(t, a, fi) * (1 - ramp(t, b - fo, fo));
const mixN = (a, b, k) => a + (b - a) * k;
const TWO = Math.PI * 2;

// ---------------------------------------------------------------- time map (HUD hours)
function Hof(lt) {
  if (lt < T.h2s) return 16;
  if (lt < T.h3s) return 16 + 0.75 * smooth((lt - T.h2s) / (T.h2e - T.h2s));
  return 16.75 + 0.25 * smooth((lt - T.h3s) / (T.hudEnd - T.h3s));
}

// ---------------------------------------------------------------- room geometry (room coords == screen coords at camX 0, z 1)
const WIN = { x: 1380, y: 150, w: 560, h: 520 };
const CAM0 = { x: 900, y: 612, z: 1, r: 0 };
const IN_PAL = Object.assign({}, PAL_REAL, { rim: '#ffe6b4', shade: 0.3, shadeCol: '90,52,30' });

function rr(x, px, py, w, h, r) {
  x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath();
}
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

let ROOM = null, ROOM_TOP = null;
function buildRoom() {
  const c = mkCanvas(2500, HT), x = c.getContext('2d');
  // wall
  let gr = x.createLinearGradient(0, 0, 0, 800);
  gr.addColorStop(0, '#f7e8cf'); gr.addColorStop(1, '#ebd2ae'); x.fillStyle = gr; x.fillRect(0, 0, 2500, 815);
  x.fillStyle = 'rgba(176,120,70,0.07)'; for (let i = 0; i < 2500; i += 64) x.fillRect(i, 0, 28, 790);
  // picture rail shadow + baseboard
  x.fillStyle = 'rgba(120,80,40,0.16)'; x.fillRect(0, 96, 2500, 6);
  x.fillStyle = '#fffaf0'; x.fillRect(0, 778, 2500, 36); x.fillStyle = 'rgba(120,80,40,0.28)'; x.fillRect(0, 814, 2500, 4);
  // floor
  gr = x.createLinearGradient(0, 814, 0, HT); gr.addColorStop(0, '#bf8754'); gr.addColorStop(1, '#9c6538'); x.fillStyle = gr; x.fillRect(0, 814, 2500, HT - 814);
  x.strokeStyle = 'rgba(70,38,16,0.28)'; x.lineWidth = 2;
  const rows = 6, r = rng(11);
  for (let i = 0; i <= rows; i++) {
    const y0 = 814 + 266 * Math.pow(i / rows, 1.25), y1 = 814 + 266 * Math.pow((i + 1) / rows, 1.25);
    x.beginPath(); x.moveTo(0, y0); x.lineTo(2500, y0); x.stroke();
    if (i < rows) for (let px = -((i * 173) % 300); px < 2500; px += 300) { x.beginPath(); x.moveTo(px, y0); x.lineTo(px, y1); x.stroke(); }
  }
  void r;
  // rug
  x.save(); x.translate(1180, 966);
  x.fillStyle = 'rgba(40,18,8,0.22)'; x.beginPath(); x.ellipse(6, 10, 470, 82, 0, 0, TWO); x.fill();
  x.fillStyle = '#c4504a'; x.beginPath(); x.ellipse(0, 0, 450, 76, 0, 0, TWO); x.fill();
  x.strokeStyle = '#f1cf86'; x.lineWidth = 7; x.beginPath(); x.ellipse(0, 0, 408, 62, 0, 0, TWO); x.stroke();
  x.fillStyle = '#a53d3b'; x.beginPath(); x.ellipse(0, 0, 360, 50, 0, 0, TWO); x.fill();
  x.restore();
  // ---- bed (side view, head on the left)
  x.fillStyle = 'rgba(40,18,8,0.28)'; x.beginPath(); x.ellipse(430, 806, 410, 18, 0, 0, TWO); x.fill();
  x.fillStyle = '#6a3f2a'; rr(x, 46, 452, 48, 340, 16); x.fill();                       // headboard
  x.fillStyle = '#835139'; rr(x, 58, 470, 24, 40, 10); x.fill();
  x.fillStyle = '#7a4a32'; x.fillRect(80, 748, 700, 44);                                 // frame
  x.fillStyle = '#5b3322'; x.fillRect(86, 786, 26, 30); x.fillRect(742, 786, 26, 30);
  x.fillStyle = '#f5eee2'; rr(x, 92, 668, 690, 86, 26); x.fill();                        // mattress
  x.fillStyle = 'rgba(0,0,0,0.07)'; x.fillRect(92, 738, 690, 14);
  const pg = x.createLinearGradient(0, 612, 0, 690); pg.addColorStop(0, '#ffffff'); pg.addColorStop(1, '#dfe6f4');
  x.fillStyle = pg; rr(x, 112, 616, 190, 78, 34); x.fill();                              // pillow
  x.strokeStyle = 'rgba(70,90,140,0.25)'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(140, 650); x.quadraticCurveTo(206, 636, 276, 652); x.stroke();
  x.fillStyle = '#4a70b8'; rr(x, 318, 640, 466, 120, 30); x.fill();                      // blanket
  x.fillStyle = '#6b8fd2'; rr(x, 318, 640, 466, 36, 18); x.fill();
  x.strokeStyle = 'rgba(20,40,90,0.22)'; x.lineWidth = 3;
  for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(380 + i * 108, 684); x.quadraticCurveTo(402 + i * 108, 722, 372 + i * 108, 760); x.stroke(); }
  // nightstand + lamp + alarm clock
  x.fillStyle = '#7a4a32'; rr(x, 812, 690, 118, 108, 8); x.fill(); x.fillStyle = '#5b3322'; x.fillRect(812, 738, 118, 6); x.fillRect(836, 796, 14, 18); x.fillRect(894, 796, 14, 18);
  x.fillStyle = '#d9c9a8'; x.fillRect(868, 622, 8, 70);
  x.fillStyle = '#f0e0ba'; x.beginPath(); x.moveTo(836, 624); x.lineTo(908, 624); x.lineTo(924, 560); x.lineTo(820, 560); x.closePath(); x.fill();
  x.fillStyle = 'rgba(160,110,50,0.25)'; x.fillRect(820, 560, 104, 10);
  x.fillStyle = '#2f3a58'; rr(x, 828, 654, 40, 36, 8); x.fill(); x.fillStyle = '#ffe9a0'; x.fillRect(836, 662, 24, 12);   // alarm clock
  // pictures above the bed
  const frame = (fx, fy, fw, fh, c1, c2) => {
    x.fillStyle = '#fff6e4'; rr(x, fx, fy, fw, fh, 6); x.fill(); x.strokeStyle = '#8a5a3a'; x.lineWidth = 6; rr(x, fx, fy, fw, fh, 6); x.stroke();
    const g2 = x.createLinearGradient(0, fy, 0, fy + fh); g2.addColorStop(0, c1); g2.addColorStop(1, c2); x.fillStyle = g2; x.fillRect(fx + 12, fy + 12, fw - 24, fh - 24);
    x.fillStyle = 'rgba(255,255,255,0.55)'; x.beginPath(); x.arc(fx + fw * 0.7, fy + fh * 0.35, fh * 0.14, 0, TWO); x.fill();
    x.fillStyle = 'rgba(40,70,60,0.7)'; x.beginPath(); x.moveTo(fx + 12, fy + fh - 12); x.lineTo(fx + fw * 0.4, fy + fh * 0.5); x.lineTo(fx + fw * 0.62, fy + fh - 12); x.fill();
  };
  frame(250, 330, 150, 116, '#8fc4f0', '#e9f2ff'); frame(430, 360, 96, 96, '#f7c98b', '#fff1d4');
  // plant right of the window
  x.fillStyle = '#b8663f'; x.beginPath(); x.moveTo(2010, 706); x.lineTo(2100, 706); x.lineTo(2088, 800); x.lineTo(2022, 800); x.closePath(); x.fill();
  x.fillStyle = '#2f7a4a';
  for (let i = 0; i < 7; i++) { const a = -1.2 + i * 0.4; x.save(); x.translate(2055, 708); x.rotate(a); x.beginPath(); x.ellipse(0, -52, 17, 56, 0, 0, TWO); x.fill(); x.restore(); }
  x.fillStyle = '#3f9a5e';
  for (let i = 0; i < 4; i++) { const a = -0.8 + i * 0.5; x.save(); x.translate(2055, 708); x.rotate(a); x.beginPath(); x.ellipse(0, -44, 11, 40, 0, 0, TWO); x.fill(); x.restore(); }
  // the (dark) window hole is filled with a dark colour so the cache is fully opaque; the live portal paints over it
  x.fillStyle = '#9ec8f0'; x.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
  return c;
}
function buildTop() {
  const c = mkCanvas(2500, HT), x = c.getContext('2d');
  const { x: wx, y: wy, w: ww, h: wh } = WIN;
  // glass sheen
  x.save(); x.beginPath(); x.rect(wx, wy, ww, wh); x.clip();
  x.fillStyle = 'rgba(255,255,255,0.08)';
  x.beginPath(); x.moveTo(wx + 60, wy); x.lineTo(wx + 150, wy); x.lineTo(wx + 40, wy + wh); x.lineTo(wx - 50, wy + wh); x.fill();
  x.beginPath(); x.moveTo(wx + 200, wy); x.lineTo(wx + 230, wy); x.lineTo(wx + 120, wy + wh); x.lineTo(wx + 90, wy + wh); x.fill();
  x.restore();
  // inner shadow along the frame
  x.fillStyle = 'rgba(60,40,20,0.18)'; x.fillRect(wx, wy, ww, 8); x.fillRect(wx, wy, 8, wh);
  // frame
  x.fillStyle = '#fffaf0';
  const fw = 18; x.fillRect(wx - fw, wy - fw, ww + 2 * fw, fw); x.fillRect(wx - fw, wy + wh, ww + 2 * fw, fw); x.fillRect(wx - fw, wy - fw, fw, wh + 2 * fw); x.fillRect(wx + ww, wy - fw, fw, wh + 2 * fw);
  x.fillRect(wx + ww / 2 - 8, wy, 16, wh); x.fillRect(wx, wy + wh * 0.46 - 7, ww, 14);
  x.strokeStyle = 'rgba(120,80,40,0.35)'; x.lineWidth = 2; x.strokeRect(wx - fw, wy - fw, ww + 2 * fw, wh + 2 * fw);
  // sill
  x.fillStyle = '#fff3dc'; rr(x, wx - 40, wy + wh + fw, ww + 80, 24, 6); x.fill(); x.fillStyle = 'rgba(120,80,40,0.25)'; x.fillRect(wx - 40, wy + wh + fw + 20, ww + 80, 5);
  // curtain rod + curtains (open)
  x.fillStyle = '#7a5a3a'; x.fillRect(wx - 120, 112, ww + 240, 8); x.beginPath(); x.arc(wx - 122, 116, 12, 0, TWO); x.arc(wx + ww + 122, 116, 12, 0, TWO); x.fill();
  const curtain = (cx0, cw, dir) => {
    const gx = x.createLinearGradient(cx0, 0, cx0 + cw, 0);
    gx.addColorStop(0, '#f6dba4'); gx.addColorStop(0.25, '#f0cd8a'); gx.addColorStop(0.5, '#fbe8bd'); gx.addColorStop(0.75, '#eec784'); gx.addColorStop(1, '#f6dba4');
    x.fillStyle = gx; x.beginPath(); x.moveTo(cx0, 122); x.lineTo(cx0 + cw, 122); x.lineTo(cx0 + cw + dir * 10, 790); x.lineTo(cx0 + dir * 10, 790); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(150,100,40,0.28)'; x.lineWidth = 3;
    for (let i = 1; i < 5; i++) { const fx = cx0 + cw * i / 5; x.beginPath(); x.moveTo(fx, 126); x.lineTo(fx + dir * 10, 788); x.stroke(); }
    x.fillStyle = '#c99a58'; rr(x, cx0 - 4, 430, cw + 8, 16, 7); x.fill();      // tie-back
  };
  curtain(wx - 118, 96, -1); curtain(wx + ww + 22, 96, 1);
  return c;
}
function rooms() { if (!ROOM) { ROOM = buildRoom(); ROOM_TOP = buildTop(); } }

// ---------------------------------------------------------------- scene transforms
// room layer -> screen: sx = 960 + z*(rx - camX - 960), sy = 600 + z*(ry - 600)
function camOf(lt) {
  const z = 1 + 0.05 * ramp(lt, 0, T.h1e + 0.6) - 0.05 * ramp(lt, T.h2s + 0.4, 2.4) + 0.04 * ramp(lt, T.h2s + 3.2, 2.6) + 0.22 * ramp(lt, T.zoom0, T.zoom1 - T.zoom0);
  const camX = 540 * ramp(lt, T.h2s + 0.6, 2.4);
  return { z, camX };
}
const SX = (c, rx) => 960 + c.z * (rx - c.camX - 960);
const SY = (c, ry) => 600 + c.z * (ry - 600);

// ---------------------------------------------------------------- the host
function trudgeX(lt) { return mixN(1120, 880, smooth(sat((lt - T.tr0) / (T.tr1 - T.tr0)))); }
function winWalkX(lt) { return mixN(880, 1290, smooth(sat((lt - T.wk0) / (T.wk1 - T.wk0)))); }

// returns {x, facing, pose, expr, phase, popFx}
function hostRoom(lt) {
  const S = {};
  const sway = Math.sin(lt * 1.3), swayB = Math.sin(lt * 0.9 + 1);
  if (lt < T.flare) {
    // ----- h1 : sleepy
    S.facing = -1;
    const trud = ramp(lt, T.tr0, 0.3);
    S.x = trudgeX(lt) + (1 - trud) * 7 * sway;
    const rub = bump(lt, T.rub0, T.rub1, 0.12, 0.3);
    const nod = bump(lt, T.nod0, T.jerk, 0.25, 0.04);                 // head sinks until the jerk
    const jerk = bump(lt, T.jerk, T.jerk + 0.55, 0.03, 0.4);          // snap awake
    const yw = bump(lt, T.yw0, T.yw1, 0.55, 0.5);
    const slumpK = 0.3 + 0.1 * sway + 0.5 * nod + 0.15 * yw * 0;
    let pose = { a: 'stand', b: 'slump', k: clamp(slumpK) };
    pose = { a: pose, b: 'wipeBrow', k: rub * 0.95 };
    pose = { a: pose, b: 'throwArms', k: yw };
    pose = { a: pose, b: 'lookUp', k: 0.35 * yw };
    if (trud > 0.01) {
      const wspeed = 0.6;
      S.phase = (1120 - S.x) / (140 * 2.0);
      pose = { a: pose, b: { name: 'walk', speed: wspeed, amp: 0.8, lean: 0.12, headDown: 0.5, phase: S.phase }, k: trud };
    }
    S.pose = pose;
    let eyeK = clamp(0.3 + 0.18 * Math.sin(lt * 2.2 + 1) + 0.8 * nod);
    const ex = { eyes: 'droop', eyes2: 'closed', k: eyeK, look: 'down', blink: false, seed: 3 };
    if (rub > 0.3) { ex.eyes = 'closed'; ex.eyes2 = null; }
    if (yw > 0.15) { ex.eyes = 'squint'; ex.eyes2 = null; }
    if (nod > 0.25) ex.sleepZ = 0.7;
    if (jerk > 0.05) { ex.eyes = 'wide'; ex.eyes2 = null; ex.look = 'center'; ex.pop = '!'; ex.popT = T.jerk; ex.popDur = 0.55; }
    S.expr = ex; S.yawn = yw;
  } else {
    // ----- h2 : flare, turn, walk to the window, look at the sun, sag
    S.facing = 1;
    const wk = lt > T.wk0 ? 1 : 0;
    S.x = lt < T.wk0 ? 880 : winWalkX(lt);
    const shield = bump(lt, T.flare, T.sag0, 0.12, 0.7);
    let pose;
    if (lt < T.wk0) pose = { a: 'stand', b: 'shield', k: shield };
    else if (lt < T.wk1) {
      S.phase = (S.x - 880) / (140 * 2.0);
      pose = { a: { name: 'walk', speed: 0.8, amp: 0.9, lean: 0.14, headDown: 0.6, phase: S.phase }, b: 'shield', k: 0.0 };
    } else pose = { a: 'stand', b: 'shield', k: ramp(lt, T.wk1, 0.55) };
    const sag = ramp(lt, T.sag0, 0.9);
    if (lt >= T.wk1) pose = { a: pose, b: 'slump', k: sag * 0.9 };
    S.pose = pose;
    let ex = { eyes: 'squint', look: 'upfwd', blink: false };
    if (lt > T.sag0) { ex = { eyes: 'droop', look: 'down', blink: false, sweat: 0.0 }; }
    if (lt > T.sag0 + 0.3 && sag > 0.5) ex.eyes2 = 'closed', ex.k = 0.35 + 0.25 * Math.sin(lt * 2.0);
    S.expr = ex; void wk;
  }
  return S;
}

// small yawn mouth drawn on the dark head (mascot has none)
function yawnMouth(g, st, open) {
  if (open < 0.03) return;
  const J = MASCOT.joints(st), hd = J.head, f = st.facing < 0 ? -1 : 1, s = st.s;
  const rot = f > 0 ? hd.rot : Math.PI - hd.rot;
  const lx = 19, ly = 12, cr = Math.cos(rot), sr = Math.sin(rot);
  const px = hd.x + f * s * (lx * cr - ly * sr), py = hd.y + s * (lx * sr + ly * cr);
  g.save(); g.translate(px, py); g.rotate(f * rot * 0.6); g.scale(f * s, s);
  const rx = 4.5 + 5.5 * open, ry = 2.5 + 10.5 * open;
  g.fillStyle = '#33081a'; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TWO); g.fill();
  g.fillStyle = '#e8566f'; g.beginPath(); g.ellipse(0, ry * 0.45, rx * 0.7, ry * 0.42, 0, 0, TWO); g.fill();
  g.strokeStyle = '#ff9fb0'; g.lineWidth = 2.2; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TWO); g.stroke();
  g.restore();
}

// ---------------------------------------------------------------- outside through the window / full sky
// maps TOD frame coordinates -> screen with an affine (scale a, translate tx,ty), clipped to a rect
function outside(g, rect, a, tx, ty, H, lt) {
  g.save();
  g.beginPath(); g.rect(rect.x, rect.y, rect.w, rect.h); g.clip();
  g.translate(tx, ty); g.scale(a, a);
  TOD.drawWorld(g, CAM0, H, { scene: 'city', heat: 0.22, cloud: 0.3, t: lt });
  g.restore();
}

function dustMotes(g, lt, c, amt) {
  if (amt < 0.02) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 34; i++) {
    const h1 = hash1(i * 3.1 + 5), h2 = hash1(i * 7.7 + 2), h3 = hash1(i * 1.9 + 9);
    const bx = mixN(WIN.x - 140, WIN.x + WIN.w + 280, h1), by = mixN(220, 780, h2);
    const rx = bx + 26 * Math.sin(lt * (0.3 + h3 * 0.4) + i), ry = by + 22 * Math.sin(lt * (0.25 + h1 * 0.3) + i * 2.1);
    const al = amt * (0.25 + 0.35 * Math.sin(lt * (0.7 + h2) + i * 1.3) ** 2);
    g.fillStyle = 'rgba(255,244,205,' + al + ')';
    g.beginPath(); g.arc(SX(c, rx), SY(c, ry), (1.6 + 1.8 * h3) * c.z, 0, TWO); g.fill();
  }
  g.restore();
}

function wallClock(g, c, lt) {
  const cx = SX(c, 1130), cy = SY(c, 258), r = 62 * c.z;
  g.save(); g.translate(cx, cy);
  g.fillStyle = 'rgba(60,35,15,0.22)'; g.beginPath(); g.arc(4 * c.z, 6 * c.z, r + 8 * c.z, 0, TWO); g.fill();
  g.fillStyle = '#7a4a32'; g.beginPath(); g.arc(0, 0, r + 8 * c.z, 0, TWO); g.fill();
  g.fillStyle = '#fffdf6'; g.beginPath(); g.arc(0, 0, r, 0, TWO); g.fill();
  g.strokeStyle = '#2a2a3a'; g.lineCap = 'round';
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, l0 = i % 3 ? 0.84 : 0.76; g.lineWidth = (i % 3 ? 2.4 : 4.4) * c.z; g.beginPath(); g.moveTo(Math.sin(a) * r * l0, -Math.cos(a) * r * l0); g.lineTo(Math.sin(a) * r * 0.92, -Math.cos(a) * r * 0.92); g.stroke(); }
  const ang = (11 + (lt * 0.002)) * Math.PI / 6;     // 11:00, the minute hand barely creeps
  g.lineWidth = 6 * c.z; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(ang) * r * 0.5, -Math.cos(ang) * r * 0.5); g.stroke();
  g.lineWidth = 4 * c.z; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -r * 0.76); g.stroke();
  const sa = Math.floor(lt) * Math.PI / 30 + (smooth((lt % 1) * 5) * Math.PI / 30);
  g.strokeStyle = '#d63a3a'; g.lineWidth = 2 * c.z; g.beginPath(); g.moveTo(-Math.sin(sa) * r * 0.16, Math.cos(sa) * r * 0.16); g.lineTo(Math.sin(sa) * r * 0.82, -Math.cos(sa) * r * 0.82); g.stroke();
  g.fillStyle = '#2a2a3a'; g.beginPath(); g.arc(0, 0, 4.5 * c.z, 0, TWO); g.fill();
  g.restore();
}

function drawRoomScene(g, lt, H, e) {
  rooms();
  const c = camOf(lt), glowK = 0.55 + 0.45 * ramp(lt, T.h2s, 4);
  const flare = bump(lt, T.flare - 0.05, T.flare + 1.5, 0.1, 1.2);
  // room art
  g.save();
  g.translate(960, 600); g.scale(c.z, c.z); g.translate(-960 - c.camX, -600);
  g.drawImage(ROOM, 0, 0);
  g.restore();
  wallClock(g, c, lt);
  // outside through the pane (screen-space rect from the same camera), full portal when zooming through
  const R0 = { x: SX(c, WIN.x), y: SY(c, WIN.y), w: WIN.w * c.z, h: WIN.h * c.z };
  const k0 = 0.62, vx0 = 228, vy0 = -18;
  const pr = smooth(e);
  const rect = { x: mixN(R0.x, 0, pr), y: mixN(R0.y, 0, pr), w: mixN(R0.w, W, pr), h: mixN(R0.h, HT, pr) };
  const a0 = k0 * c.z, a = mixN(a0, 1, pr);
  const tx0 = R0.x - vx0 * a0, ty0 = R0.y - vy0 * a0;
  const tx = mixN(tx0, 0, pr), ty = mixN(ty0, 0, pr);
  outside(g, rect, a, tx, ty, H, lt);
  // sun bloom inside the pane
  const sunF = TOD.sunScreen(H, CAM0), spx = tx + a * sunF.x, spy = ty + a * sunF.y;
  g.save(); g.beginPath(); g.rect(rect.x, rect.y, rect.w, rect.h); g.clip();
  g.globalCompositeOperation = 'lighter';
  let gr = g.createRadialGradient(spx, spy, 0, spx, spy, 320 * a);
  gr.addColorStop(0, 'rgba(255,248,215,' + (0.42 * glowK + 0.4 * flare) + ')'); gr.addColorStop(0.35, 'rgba(255,236,180,' + (0.16 * glowK + 0.2 * flare) + ')'); gr.addColorStop(1, 'rgba(255,236,180,0)');
  g.fillStyle = gr; g.fillRect(rect.x, rect.y, rect.w, rect.h);
  if (flare > 0.01) { g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(255,250,235,' + 0.5 * flare + ')'; g.fillRect(rect.x, rect.y, rect.w, rect.h); }
  g.restore();
  // frame + curtains (fade while the portal opens up)
  const topA = 1 - smooth(e * 3);
  if (topA > 0.01) {
    g.save(); g.globalAlpha = topA; g.translate(960, 600); g.scale(c.z, c.z); g.translate(-960 - c.camX, -600); g.drawImage(ROOM_TOP, 0, 0); g.restore();
  }
  // wall + floor light from the window
  if (e < 0.98) {
    const sh = (H - 16) * 170;
    g.save(); g.globalCompositeOperation = 'lighter';
    // floor patch (sun in the east: the patch falls to the right of the window)
    const ptA = [WIN.x + sh, 836], ptB = [WIN.x + WIN.w + sh, 836], ptC = [WIN.x + WIN.w + 430 + sh, 1070], ptD = [WIN.x + 430 + sh, 1070];
    const P = (p) => [SX(c, p[0]), SY(c, p[1])];
    const A = P(ptA), B = P(ptB), C2 = P(ptC), D = P(ptD);
    gr = g.createLinearGradient(0, A[1], 0, C2[1]);
    gr.addColorStop(0, 'rgba(255,232,160,' + (0.36 * glowK + 0.2 * flare) + ')'); gr.addColorStop(1, 'rgba(255,222,140,' + (0.14 * glowK) + ')');
    g.fillStyle = gr; g.globalAlpha = 1 - smooth(e * 2);
    g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.lineTo(C2[0], C2[1]); g.lineTo(D[0], D[1]); g.closePath(); g.fill();
    // window glow on the wall
    const wcx = SX(c, WIN.x + WIN.w / 2), wcy = SY(c, WIN.y + WIN.h / 2);
    gr = g.createRadialGradient(wcx, wcy, 60 * c.z, wcx, wcy, 720 * c.z);
    gr.addColorStop(0, 'rgba(255,238,185,' + (0.22 * glowK + 0.3 * flare) + ')'); gr.addColorStop(1, 'rgba(255,238,185,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, HT);
    g.restore();
    dustMotes(g, lt, c, (0.5 + 0.5 * glowK) * (1 - smooth(e * 2)));
  }
  return c;
}

function drawHostRoom(g, lt, c, alpha) {
  const S = hostRoom(lt), f = S.facing;
  const sc = 2.0 * c.z;
  const st = { x: SX(c, S.x), y: SY(c, 930), s: sc, facing: f, pose: S.pose, t: lt, expr: S.expr, pal: IN_PAL, alpha: alpha, shadow: true };
  if (S.phase != null) st.phase = S.phase;
  MASCOT.draw(g, st);
  if (S.yawn > 0.02) yawnMouth(g, st, S.yawn);
  return { st, S };
}

// ---------------------------------------------------------------- arc / ghost sun (full-screen sky, TOD sun geometry)
function arcPt(h) { const a = TWO * h / 100; return { x: 960 - Math.cos(a) * 860, y: 610 - Math.sin(a) * 518 }; }
function arcOverlay(g, lt, H, vis) {
  if (vis < 0.01) return;
  const u = sat((lt - T.gh0) / (T.gh1 - T.gh0)), gh = 100 * smooth(u);
  g.save(); g.globalAlpha = vis; g.lineCap = 'round';
  // ticks: 100 hours around the full loop (50 above the horizon, 50 below)
  for (let i = 0; i < 100; i++) {
    const k = smooth(sat((gh - i) / 2.5)); if (k < 0.01 && !(i === 0)) continue;
    const p = arcPt(i), major = i % 5 === 0, up = i < 50, r0 = (major ? 6.5 : 4.2) * (0.4 + 0.6 * k) * (up ? 1 : 0.85);
    g.globalAlpha = vis * (up ? 1 : 0.7) * (0.35 + 0.65 * k);
    g.fillStyle = 'rgba(16,22,56,0.8)'; g.beginPath(); g.arc(p.x, p.y, r0 + 2.4, 0, TWO); g.fill();
    g.fillStyle = up ? (major ? '#ffe9a0' : '#ffffff') : (major ? '#bcd0ff' : '#dfe8ff'); g.beginPath(); g.arc(p.x, p.y, r0, 0, TWO); g.fill();
  }
  g.globalAlpha = vis;
  // ghost sun
  const p = arcPt(gh), upG = gh < 50 || gh >= 100, fade = 1 - smooth(sat((lt - (T.gh1 + 0.05)) / 0.2)) * 0;
  const rr0 = 30 + 4 * Math.sin(lt * 9);
  g.globalCompositeOperation = 'lighter';
  let gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, 120);
  gr.addColorStop(0, upG ? 'rgba(255,232,150,0.7)' : 'rgba(170,200,255,0.6)'); gr.addColorStop(1, 'rgba(255,232,150,0)');
  g.fillStyle = gr; g.globalAlpha = vis * fade; g.beginPath(); g.arc(p.x, p.y, 120, 0, TWO); g.fill();
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = vis * fade;
  g.lineWidth = 6; g.strokeStyle = 'rgba(16,22,56,0.85)'; g.beginPath(); g.arc(p.x, p.y, rr0 + 2, 0, TWO); g.stroke();
  g.lineWidth = 4; g.strokeStyle = upG ? '#fff3b8' : '#e6eeff'; g.beginPath(); g.arc(p.x, p.y, rr0, 0, TWO); g.stroke();
  g.fillStyle = upG ? 'rgba(255,214,90,0.55)' : 'rgba(150,180,255,0.45)'; g.beginPath(); g.arc(p.x, p.y, rr0 - 2, 0, TWO); g.fill();
  g.restore();
  // "you are here": a pulsing ring around the real sun until the ghost starts
  const sp = TOD.sunScreen(H, CAM0), hereA = vis * (1 - ramp(lt, T.gh0 + 0.1, 0.4)) * ramp(lt, T.zoom1 - 0.1, 0.3);
  if (hereA > 0.01) {
    g.save(); g.globalAlpha = hereA; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 4;
    const q = (lt * 1.2) % 1; g.beginPath(); g.arc(sp.x, sp.y, 92 + 40 * q, 0, TWO); g.globalAlpha = hereA * (1 - q); g.stroke(); g.restore();
  }
}

// ---------------------------------------------------------------- the goal bubble (sunrise + finish flag)
function goalBubble(g, cx, cy, r, grow, prog, lt) {
  if (grow <= 0.01) return;
  g.save(); g.translate(cx, cy); g.scale(grow, grow);
  g.fillStyle = 'rgba(14,16,44,0.55)'; g.beginPath(); g.arc(5, 8, r + 12, 0, TWO); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, r + 9, 0, TWO); g.fill();
  g.save(); g.beginPath(); g.arc(0, 0, r, 0, TWO); g.clip();
  const gr = g.createLinearGradient(0, -r, 0, r * 0.7);
  gr.addColorStop(0, rgbMix('#1c2a66', '#4a8fe0', prog)); gr.addColorStop(0.55, rgbMix('#7a3f86', '#f19ab0', prog)); gr.addColorStop(1, rgbMix('#e07b4a', '#ffd070', prog));
  g.fillStyle = gr; g.fillRect(-r, -r, 2 * r, 2 * r);
  const hy = r * 0.3;
  // sun rising from behind the hill
  const sy = hy + 56 - prog * 128, sr = 44;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6 + lt * 0.35; g.fillStyle = 'rgba(255,230,150,' + (0.16 * prog) + ')';
    g.beginPath(); g.moveTo(0, sy); g.lineTo(Math.cos(a - 0.09) * r * 1.6, sy + Math.sin(a - 0.09) * r * 1.6); g.lineTo(Math.cos(a + 0.09) * r * 1.6, sy + Math.sin(a + 0.09) * r * 1.6); g.closePath(); g.fill();
  }
  let rg = g.createRadialGradient(0, sy, 0, 0, sy, sr * 3.2); rg.addColorStop(0, 'rgba(255,225,140,0.7)'); rg.addColorStop(1, 'rgba(255,225,140,0)');
  g.fillStyle = rg; g.beginPath(); g.arc(0, sy, sr * 3.2, 0, TWO); g.fill(); g.restore();
  g.fillStyle = '#fff1a8'; g.beginPath(); g.arc(0, sy, sr, 0, TWO); g.fill();
  g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(-4, sy - 4, sr * 0.72, 0, TWO); g.fill();
  // hills
  g.fillStyle = '#3b3a82'; g.beginPath(); g.moveTo(-r, hy + 20); g.quadraticCurveTo(-r * 0.4, hy - 30, 0, hy + 14); g.quadraticCurveTo(r * 0.4, hy - 10, r, hy + 24); g.lineTo(r, r); g.lineTo(-r, r); g.fill();
  g.fillStyle = '#2f7d4f'; g.beginPath(); g.moveTo(-r, hy + 70); g.quadraticCurveTo(-r * 0.2, hy + 20, r * 0.25, hy + 52); g.quadraticCurveTo(r * 0.62, hy + 6, r, hy + 40); g.lineTo(r, r); g.lineTo(-r, r); g.fill();
  // finish flag on the right hill
  const fx = r * 0.46, fy = hy + 22;
  g.strokeStyle = '#f4efe6'; g.lineWidth = 4.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, fy - 84); g.stroke();
  const cols = 4, rows = 3, cw = 14, chh = 11;
  for (let ci = 0; ci < cols; ci++) for (let ri = 0; ri < rows; ri++) {
    const wv = Math.sin(lt * 5 - ci * 0.9) * 4 * (ci / cols + 0.2);
    g.fillStyle = (ci + ri) % 2 ? '#14101c' : '#ffffff';
    g.fillRect(fx + 2 + ci * cw, fy - 84 + ri * chh + wv, cw + 0.5, chh + 0.5);
  }
  g.restore();
  g.restore();
}
function rgbMix(a, b, k) { return mixHex(a, b, k); }

// ---------------------------------------------------------------- street (h4)
function drawStreet(g, lt, H) {
  const goT = Math.max(0, lt - T.go), v = 120;
  const d = goT < 0.5 ? v * goT * goT : v * (goT - 0.25);
  const zs = 1.9, cam = { x: 900 + d, y: 600, z: zs, r: 0 };
  const o = { scene: 'city', heat: 0.12, cloud: 0.3, t: lt };
  TOD.drawWorld(g, cam, H, o);
  const sl = ramp(lt, T.cut, 0.01);
  void sl;
  const hostWx = cam.x - 137;
  // pose / expression
  const tired = 1 - ramp(lt, T.idea - 0.2, 0.5);
  const point = bump(lt, T.idea + 0.2, T.go + 0.2, 0.5, 0.5);
  const walk = ramp(lt, T.go, 0.45);
  let pose = { a: 'stand', b: 'slump', k: 0.85 * tired };
  pose = { a: pose, b: { name: 'point', dir: 0.85 }, k: point * (1 - walk) };
  const phase = d / (140 * 0.92);
  pose = { a: pose, b: { name: 'walk', speed: 0.9, amp: 1, lean: 0.14, headDown: 0.0, phase: phase }, k: walk };
  let ex;
  if (lt < T.idea) ex = { eyes: 'droop', eyes2: 'closed', k: 0.3 + 0.2 * Math.sin(lt * 2), look: 'down', blink: false };
  else if (lt < T.idea + 0.75) ex = { eyes: 'wide', look: 'upfwd', pop: '!', popT: T.idea, popDur: 0.8, sparkle: 0.5, blink: false };
  else ex = { eyes: 'angry', look: 'fwd', blink: false };
  withLayer(g, cam, 1, () => {
    const st = { x: hostWx, y: 820, s: 0.92, facing: 1, pose: pose, t: lt, expr: ex, pal: TOD.heroPal(H, o), alpha: 1, shadow: true };
    st.phase = phase;
    MASCOT.draw(g, st);
  });
  TOD.drawForeground(g, cam, H, o);
  // thought bubble: sits up-right of the head (screen space)
  const gp = ramp(lt, T.bub, 0.55);
  if (gp > 0.01) {
    const hx = 960 - 260 + 20, hy = 540 + zs * (820 - 600) - 0.92 * zs * 215;   // approx head centre on screen
    const bx = 1245, by = 330, br = 190;
    const g2 = spring(lt - T.bub, 190, 14);
    for (let i = 0; i < 3; i++) {
      const q = 0.14 + i * 0.17, r2 = [10, 17, 27][i], pk = spring(lt - T.bub - i * 0.06, 260, 18);
      g.fillStyle = '#fff'; g.strokeStyle = 'rgba(14,16,44,0.5)'; g.lineWidth = 3;
      g.beginPath(); g.arc(mixN(hx + 40, bx - br * 0.6, q * 1.6), mixN(hy - 50, by + br * 0.8, q * 1.6), r2 * pk, 0, TWO); g.fill(); g.stroke();
    }
    goalBubble(g, bx, by, br, g2, smooth(sat((lt - T.rise0) / (T.rise1 - T.rise0))), lt);
  }
}

// ---------------------------------------------------------------- draw
let WARMED = false;
function draw(g, lt, dur) {
  if (!WARMED) { WARMED = true; try { TOD.warm(); } catch (e) { /* optional */ } }
  const H = Hof(lt);
  g.save();
  if (lt < T.cut) {
    const e = sat((lt - T.zoom0) / (T.zoom1 - T.zoom0));
    const c = drawRoomScene(g, lt, H, e);
    if (e < 0.9) {
      const hr = drawHostRoom(g, lt, c, 1 - smooth(e * 3));
      void hr;
      // flash at the turn
      const fl = bump(lt, T.flare - 0.06, T.flare + 0.22, 0.04, 0.2);
      if (fl > 0.01) { g.fillStyle = 'rgba(255,250,235,' + 0.55 * fl + ')'; g.fillRect(0, 0, W, HT); }
    }
    arcOverlay(g, lt, H, ramp(lt, T.zoom1 - 0.2, 0.5));
  } else {
    drawStreet(g, lt, H);
  }
  g.restore();
  TOD.grade(g, H, { scene: 'city' });
  const hudPulse = Math.max(bump(lt, T.h3s + 0.1, T.h3s + 0.8, 0.08, 0.5), bump(lt, T.gh1 - 0.8, T.gh1, 0.08, 0.5) * 0.9, bump(lt, T.hudEnd - 0.05, T.hudEnd + 0.7, 0.08, 0.5));
  TOD.hud(g, H, { alpha: 1, pop: ramp(lt, 0.15, 0.6), pulse: hudPulse });
}

window.CH.c1 = { draw: draw, T: T };
})();
