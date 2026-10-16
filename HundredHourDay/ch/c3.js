// ch/c3.js — "Body Clock" (35.12 s). Bedroom blackout nap, Mammoth Cave 1938, dizzy peek, suitcase gag, time-lapse cooking.
// Frame = pure function of lt. All globals prefixed c3_. Needs lib.js, layout.js, tod.js, mascot.js.
(function () {
'use strict';
window.CH = window.CH || {};

const W = 1920, HT = 1080;
const LV = LAYOUT.c3.vo, DUR = LAYOUT.c3.dur;
const A = (i, f) => LV[i].start + (LV[i].end - LV[i].start) * f;      // time at fraction f of line i

// ------------------------------------------------------------------ beat times (all derived from the VO lines)
const T = {
  cordGrab: A(0, 0.47), pull0: A(0, 0.53), pull1: A(0, 0.74),      // blackout curtains close
  cutMask: A(0, 0.77), cutBed: A(0, 0.935),                          // face close-up (mask) -> bed
  maskOn: A(0, 0.86),
  dialPush0: A(1, 0.36), dialPush1: A(1, 0.52), dialBack: A(1, 0.72), // b2 camera
  over24: A(1, 0.50), lightDark: A(1, 0.74),
  caveIn: LV[2].start - 0.04, caveOut: LV[3].start - 0.20,
  clk28: A(2, 0.50), clk24: A(2, 0.58), clkRun: A(2, 0.63), noFollow: A(2, 0.80),
  wake: A(3, 0.38), cutPeek: A(3, 0.56), glare: A(3, 0.74),
  walk0: LV[3].end + 0.02, walk1: LV[4].end + 0.12, drop: LV[4].end - 0.25, cutLapse: LV[5].start - 0.05,
  lapse0: LV[5].start, wake2: A(5, 0.62), cutWin: A(5, 0.74), pull2: A(5, 0.80), pull3: A(5, 1.0) + 0.10
};
const HUD_FADE0 = T.caveIn - 0.15;

// ------------------------------------------------------------------ small helpers
const sat = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
const sm = (a, b, t) => smooth((t - a) / (b - a));
const mix = (a, b, k) => a + (b - a) * k;
function mkc(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arcTo(x + w, y, x + w, y + r, r);
  g.lineTo(x + w, y + h - r); g.arcTo(x + w, y + h, x + w - r, y + h, r); g.lineTo(x + r, y + h); g.arcTo(x, y + h, x, y + h - r, r);
  g.lineTo(x, y + r); g.arcTo(x, y, x + r, y, r); g.closePath();
}
function rad(g, x, y, r, stops) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  for (let i = 0; i < stops.length; i++) gr.addColorStop(stops[i][0], stops[i][1]);
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}
const OUT = '#2a1a14';

// ------------------------------------------------------------------ timeline functions
// HUD hour: monotonic 17 -> 38
function hourAt(lt) {
  const K = [[0, 17.0], [T.cutBed, 17.3], [T.wake, 20.2], [T.walk0, 21.0], [T.lapse0, 22.4]];
  if (lt <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) if (lt <= K[i][0]) return mix(K[i - 1][1], K[i][1], (lt - K[i - 1][0]) / (K[i][0] - K[i - 1][0]));
  const u = sat((lt - T.lapse0) / (T.pull2 + 0.2 - T.lapse0));
  return mix(22.4, 38.0, u * u * (3 - 2 * u));
}
// the sun outside barely drifts while he naps ("the sun hasn't moved"); it only slides once the time-lapse starts
const HW0 = 17 + 0.12 * (22.4 - 17);
function windowHour(lt, H) {
  if (lt < T.lapse0) return 17 + 0.12 * (H - 17);
  const w = sm(T.lapse0 + 0.3, T.pull2 + 0.2, lt);
  return mix(HW0, H, w);
}
// curtain closure 0 (open) .. 1 (closed)
function closureAt(lt) {
  if (lt < T.pull0) return 0;
  if (lt < T.cutPeek + 3) {
    return Math.min(1, smooth((lt - T.pull0) / (T.pull1 - T.pull0)));
  }
  return 1;
}
// peek: right panel pulled aside by a hand
function peekAt(lt) { return sm(T.cutPeek + 0.15, T.cutPeek + 0.6, lt) * (1 - sm(LV[3].end + 0.25, LV[3].end + 0.55, lt)); }

// ------------------------------------------------------------------ cameras
function lerpCam(a, b, k) { return { z: mix(a.z, b.z, k), cx: mix(a.cx, b.cx, k), cy: mix(a.cy, b.cy, k) }; }
const CAMS = {
  win:   { z: 1.12, cx: 1085, cy: 560 },
  face:  { z: 2.7, cx: 1010, cy: 490 },
  bed:   { z: 1.5, cx: 700, cy: 570 },
  dial:  { z: 2.05, cx: 560, cy: 430 },
  wake:  { z: 1.4, cx: 700, cy: 640 },
  peek:  { z: 1.85, cx: 1200, cy: 460 },
  lapse: { z: 1.2, cx: 860, cy: 610 },
  win2:  { z: 1.5, cx: 1180, cy: 530 }
};
function bedroomCam(lt, hostX) {
  if (lt < T.cutMask) return lerpCam(CAMS.win, { z: 1.2, cx: 1085, cy: 540 }, sm(0, T.cutMask, lt));
  if (lt < T.cutBed) return lerpCam(CAMS.face, { z: 2.9, cx: 1010, cy: 480 }, sm(T.cutMask, T.cutBed, lt));
  if (lt < T.caveIn) {
    if (lt < T.dialPush0) return lerpCam(CAMS.bed, { z: 1.56, cx: 700, cy: 570 }, sm(T.cutBed, T.dialPush0, lt));
    if (lt < T.dialBack) return lerpCam({ z: 1.56, cx: 700, cy: 570 }, CAMS.dial, sm(T.dialPush0, T.dialPush1, lt));
    return lerpCam(CAMS.dial, { z: 1.45, cx: 700, cy: 575 }, sm(T.dialBack, T.dialBack + 1.0, lt));
  }
  if (lt < T.cutPeek) return lerpCam(CAMS.wake, { z: 1.5, cx: 640, cy: 650 }, sm(T.caveOut, T.cutPeek, lt));
  if (lt < T.walk0) return lerpCam(CAMS.peek, { z: 2.0, cx: 1210, cy: 470 }, sm(T.cutPeek, T.walk0, lt));
  if (lt < T.cutLapse) { const hx = hostX == null ? 1200 : hostX; return { z: 1.45, cx: hx - 100, cy: 640 }; }
  if (lt < T.cutWin) return lerpCam(CAMS.lapse, { z: 1.28, cx: 840, cy: 620 }, sm(T.lapse0, T.cutWin, lt));
  return lerpCam(CAMS.win2, { z: 1.62, cx: 1170, cy: 520 }, sm(T.cutWin, DUR, lt));
}
function applyCam(g, c) {
  const hw = 960 / c.z, hh = 540 / c.z;
  const cx = Math.max(hw, Math.min(W - hw, c.cx)), cy = Math.max(hh, Math.min(HT - hh, c.cy));
  g.translate(960, 540); g.scale(c.z, c.z); g.translate(-cx, -cy);
}

// ------------------------------------------------------------------ room geometry
const FY = 900;                                   // floor line
const WIN = { x: 1100, y: 130, w: 460, h: 400 };  // window glass
const ROD_Y = 100;
const BED = { hx: 240, fx: 800, top: 770 };       // headboard x, footboard x, mattress top
const CORD_X = 1100;

// ------------------------------------------------------------------ cached room background (static, independent of t)
let ROOM = null;
function roomBG() {
  if (ROOM) return ROOM;
  const c = mkc(W, HT), g = c.getContext('2d');
  // wall
  let gr = g.createLinearGradient(0, 0, 0, FY); gr.addColorStop(0, '#f1dfc2'); gr.addColorStop(1, '#e3c9a2');
  g.fillStyle = gr; g.fillRect(0, 0, W, FY);
  g.fillStyle = 'rgba(190,150,100,0.18)'; for (let x = 20; x < W; x += 80) g.fillRect(x, 0, 36, FY);
  // dado rail
  g.fillStyle = '#d9b98a'; g.fillRect(0, 640, W, 8); g.fillStyle = 'rgba(120,80,40,0.18)'; g.fillRect(0, 648, W, 6);
  g.fillStyle = '#cfa874'; g.fillRect(0, 654, W, FY - 654);
  g.fillStyle = 'rgba(255,255,255,0.10)'; for (let x = 0; x < W; x += 120) g.fillRect(x, 654, 4, FY - 654);
  // baseboard
  g.fillStyle = '#f6efe2'; g.fillRect(0, FY - 36, W, 36); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, FY - 3, W, 3);
  // floor
  gr = g.createLinearGradient(0, FY, 0, HT); gr.addColorStop(0, '#b97f4c'); gr.addColorStop(1, '#8f5a32');
  g.fillStyle = gr; g.fillRect(0, FY, W, HT - FY);
  g.strokeStyle = 'rgba(60,30,12,0.35)'; g.lineWidth = 3;
  for (let i = 0; i < 6; i++) { const y = FY + 8 + i * i * 6 + i * 22; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  const r = rng(77);
  for (let i = 0; i < 40; i++) { const y = FY + 10 + r() * 160, x = r() * W; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 90 + r() * 120, y); g.stroke(); }
  // rug
  g.fillStyle = '#7e3d46'; rr(g, 330, 960, 640, 80, 30); g.fill();
  g.fillStyle = '#c8765f'; rr(g, 360, 972, 580, 56, 24); g.fill();
  g.strokeStyle = '#f0d9a8'; g.lineWidth = 4; rr(g, 376, 982, 548, 36, 16); g.stroke();
  // dresser (far left)
  g.fillStyle = OUT; rr(g, -14, 690, 180, 214, 8); g.fill();
  g.fillStyle = '#9c6a3e'; rr(g, -10, 694, 172, 206, 6); g.fill();
  g.fillStyle = '#b57f4c'; rr(g, -4, 700, 160, 90, 4); g.fill(); rr(g, -4, 796, 160, 90, 4); g.fill();
  g.fillStyle = '#e7c98f'; g.beginPath(); g.arc(76, 745, 9, 0, TAU); g.arc(76, 841, 9, 0, TAU); g.fill();
  // lamp on dresser
  g.fillStyle = '#6b4a2e'; g.fillRect(70, 660, 12, 34);
  g.fillStyle = '#f5e3b8'; g.beginPath(); g.moveTo(40, 662); g.lineTo(112, 662); g.lineTo(98, 612); g.lineTo(54, 612); g.closePath(); g.fill();
  g.strokeStyle = OUT; g.lineWidth = 4; g.stroke();
  // picture frames
  g.fillStyle = OUT; rr(g, 380, 220, 150, 190, 6); g.fill(); g.fillStyle = '#8bc1d8'; rr(g, 390, 230, 130, 170, 4); g.fill();
  g.fillStyle = '#e8c36a'; g.beginPath(); g.arc(455, 290, 24, 0, TAU); g.fill();
  g.fillStyle = '#4f9a62'; g.beginPath(); g.moveTo(390, 400); g.lineTo(440, 330); g.lineTo(470, 370); g.lineTo(500, 340); g.lineTo(520, 400); g.closePath(); g.fill();
  g.fillStyle = OUT; rr(g, 640, 250, 120, 120, 6); g.fill(); g.fillStyle = '#f2b3a6'; rr(g, 648, 258, 104, 104, 4); g.fill();
  g.fillStyle = '#c85a52'; g.beginPath(); g.arc(700, 310, 28, 0, TAU); g.fill();
  // door frame (far right, hall beyond)
  g.fillStyle = OUT; g.fillRect(1668, 250, 232, 654);
  g.fillStyle = '#f9e9bd'; g.fillRect(1678, 260, 212, 644);
  gr = g.createLinearGradient(1678, 0, 1890, 0); gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(1, 'rgba(255,214,140,0.55)');
  g.fillStyle = gr; g.fillRect(1678, 260, 212, 644);
  g.fillStyle = '#c9a171'; g.fillRect(1678, 840, 212, 64);
  // bed: legs, frame, headboard, footboard, mattress
  g.fillStyle = OUT;
  g.fillRect(BED.hx - 24, 520, 70, 380);
  g.fillRect(BED.fx - 10, 730, 44, 170);
  g.fillRect(BED.hx + 40, 830, 760, 20);
  g.fillStyle = '#7b4a2a'; g.fillRect(BED.hx - 18, 526, 58, 372);
  g.fillStyle = '#8f5a34'; g.fillRect(BED.hx - 12, 532, 46, 360);
  g.fillStyle = '#7b4a2a'; g.fillRect(BED.fx - 4, 736, 32, 162);
  g.fillStyle = '#6a3d20'; g.fillRect(BED.hx + 44, 834, 752, 12);
  g.fillStyle = OUT; rr(g, BED.hx + 28, BED.top - 6, BED.fx - BED.hx - 22, 66, 14); g.fill();
  g.fillStyle = '#f7f2ea'; rr(g, BED.hx + 32, BED.top - 2, BED.fx - BED.hx - 30, 58, 12); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(BED.hx + 40, BED.top + 40, BED.fx - BED.hx - 46, 14);
  // pillow
  g.fillStyle = OUT; g.beginPath(); g.ellipse(BED.hx + 112, BED.top - 20, 90, 34, -0.04, 0, TAU); g.fill();
  g.fillStyle = '#fffaf0'; g.beginPath(); g.ellipse(BED.hx + 112, BED.top - 22, 84, 29, -0.04, 0, TAU); g.fill();
  g.fillStyle = 'rgba(120,150,190,0.25)'; g.beginPath(); g.ellipse(BED.hx + 120, BED.top - 12, 70, 14, -0.04, 0, TAU); g.fill();
  ROOM = c; return c;
}

// ------------------------------------------------------------------ window view (TOD world clipped into the window)
const WCAM = { x: 900, y: 612, z: 1, r: 0 };
let WSUN0 = null;
function windowView(g, H, t, bleach) {
  const k = 0.7;
  if (!WSUN0) WSUN0 = TOD.sunScreen(17, WCAM, {});
  const px = 1275, py = 250;                       // where the hour-17 sun sits inside the window
  g.save();
  g.beginPath(); g.rect(WIN.x, WIN.y, WIN.w, WIN.h); g.clip();
  g.translate(px, py); g.scale(k, k); g.translate(-WSUN0.x, -WSUN0.y);
  try {
    TOD.drawWorld(g, WCAM, H, { scene: 'city', heat: 0.85, cloud: 0, t: t });
  } catch (e) { g.fillStyle = '#9ad4ff'; g.fillRect(-2000, -2000, 6000, 6000); }
  g.restore();
  // glass: hot white wash + sun halo (the narration says "full daylight": keep it bright, not apocalyptic)
  const ss = TOD.sunScreen(H, WCAM, {});
  const sx = px + k * (ss.x - WSUN0.x), sy = py + k * (ss.y - WSUN0.y);
  g.save(); g.beginPath(); g.rect(WIN.x, WIN.y, WIN.w, WIN.h); g.clip();
  g.fillStyle = 'rgba(255,248,225,' + (0.12 + 0.3 * bleach) + ')'; g.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
  g.globalCompositeOperation = 'lighter';
  rad(g, sx, sy, 190, [[0, 'rgba(255,250,225,0.95)'], [0.25, 'rgba(255,238,170,0.45)'], [1, 'rgba(255,230,150,0)']]);
  g.restore();
  return { sx: sx, sy: sy };
}
function windowFrame(g) {
  g.strokeStyle = OUT; g.lineWidth = 16; g.strokeRect(WIN.x - 6, WIN.y - 6, WIN.w + 12, WIN.h + 12);
  g.strokeStyle = '#f7f1e6'; g.lineWidth = 9; g.strokeRect(WIN.x - 6, WIN.y - 6, WIN.w + 12, WIN.h + 12);
  g.fillStyle = '#f7f1e6'; g.fillRect(WIN.x + WIN.w / 2 - 5, WIN.y, 10, WIN.h); g.fillRect(WIN.x, WIN.y + WIN.h * 0.55, WIN.w, 9);
  g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(WIN.x + WIN.w / 2 - 5, WIN.y, 10, WIN.h);
  g.fillStyle = OUT; rr(g, WIN.x - 36, WIN.y + WIN.h + 6, WIN.w + 72, 28, 8); g.fill();
  g.fillStyle = '#efe6d4'; rr(g, WIN.x - 32, WIN.y + WIN.h + 9, WIN.w + 64, 21, 6); g.fill();
}

// ------------------------------------------------------------------ curtains
function panel(g, x0, x1, y0, y1, t, sway, tone) {
  const w = x1 - x0; if (w < 3) return;
  const n = Math.max(2, Math.round(w / 26)), sw = w / n;
  g.save();
  for (let i = 0; i < n; i++) {
    const xa = x0 + i * sw, xb = xa + sw, bow = Math.sin(t * 1.3 + i * 0.9) * sway;
    const gr = g.createLinearGradient(xa, 0, xb, 0);
    gr.addColorStop(0, tone[0]); gr.addColorStop(0.5, tone[1]); gr.addColorStop(1, tone[0]);
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(xa, y0); g.lineTo(xb, y0);
    g.lineTo(xb + bow * 0.4, y1 + (i % 2 ? 8 : 0)); g.lineTo(xa + bow * 0.4, y1 + (i % 2 ? 0 : 8)); g.closePath(); g.fill();
  }
  g.strokeStyle = OUT; g.lineWidth = 4; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0, y1); g.moveTo(x1, y0); g.lineTo(x1, y1); g.stroke();
  g.beginPath(); g.moveTo(x0, y1 + 4); g.lineTo(x1, y1 + 4); g.stroke();
  g.restore();
}
function curtains(g, c, peek, edgeL, t) {
  const y0 = ROD_Y + 8, y1 = 650;
  let xL = mix(1096, 1334, c);
  const xR = mix(1566, 1326, c);
  if (edgeL != null && peek > 0.01) xL = mix(xL, edgeL, peek);
  const tone = ['#1f2540', '#3b4470'];
  const sway = 1.2 + 4 * Math.abs(smooth(c) - c) * 4;
  panel(g, 1030, xL, y0, y1, t, sway, tone);
  panel(g, xR, 1636, y0, y1, t, sway, tone);
  // rod
  g.fillStyle = OUT; rr(g, 1000, ROD_Y - 8, 660, 18, 8); g.fill();
  g.fillStyle = '#c99a4a'; rr(g, 1004, ROD_Y - 5, 652, 11, 5); g.fill();
  g.fillStyle = '#c99a4a'; g.beginPath(); g.arc(1000, ROD_Y, 13, 0, TAU); g.arc(1660, ROD_Y, 13, 0, TAU); g.fill();
  g.strokeStyle = OUT; g.lineWidth = 3; g.stroke();
  return { xL: xL, xR: xR };
}

// ------------------------------------------------------------------ props
function dial(g, cx, cy, r, ang, o) {
  o = o || {};
  const t = o.t || 0;
  g.save(); g.translate(cx, cy);
  if (o.rot) g.rotate(o.rot);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(5, 8, r + 6, 0, TAU); g.fill();
  g.fillStyle = OUT; g.beginPath(); g.arc(0, 0, r + 8, 0, TAU); g.fill();
  g.fillStyle = o.rim || '#f4efe4'; g.beginPath(); g.arc(0, 0, r + 2, 0, TAU); g.fill();
  g.save(); g.beginPath(); g.arc(0, 0, r - 10, 0, TAU); g.clip();
  if (o.sky) {
    let gr = g.createLinearGradient(0, -r, 0, r); gr.addColorStop(0, '#6bbcff'); gr.addColorStop(0.5, '#cfeaff'); gr.addColorStop(0.5, '#3a3f86'); gr.addColorStop(1, '#10143a');
    g.fillStyle = gr; g.fillRect(-r, -r, 2 * r, 2 * r);
    // sun (top) and moon + stars (bottom)
    g.fillStyle = '#ffdc5a'; g.beginPath(); g.arc(0, -r * 0.5, r * 0.17, 0, TAU); g.fill();
    g.strokeStyle = '#ffcb2a'; g.lineWidth = 4; g.lineCap = 'round';
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + t * 0.4; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.24, -r * 0.5 + Math.sin(a) * r * 0.24); g.lineTo(Math.cos(a) * r * 0.31, -r * 0.5 + Math.sin(a) * r * 0.31); g.stroke(); }
    g.fillStyle = '#f3f0d6'; g.beginPath(); g.arc(0, r * 0.5, r * 0.15, 0, TAU); g.fill();
    g.fillStyle = '#3a3f86'; g.beginPath(); g.arc(r * 0.07, r * 0.46, r * 0.14, 0, TAU); g.fill();
    g.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { const a = hash1(i * 3 + 1) * 1.6 + 0.2, d = r * (0.3 + hash1(i * 5 + 2) * 0.5); g.fillRect(Math.cos(a) * d * (i % 2 ? 1 : -1) - 1.5, Math.abs(Math.sin(a)) * d + 6, 3.4, 3.4); }
  } else {
    g.fillStyle = o.face || '#fff3d4'; g.fillRect(-r, -r, 2 * r, 2 * r);
  }
  g.restore();
  // ticks
  const n = o.n || 24; g.lineCap = 'round'; g.strokeStyle = OUT;
  for (let i = 0; i < n; i++) {
    const a = i * TAU / n - Math.PI / 2, big = (i % (n / 4) === 0), r0 = r - (big ? 34 : 24), r1 = r - 10;
    g.lineWidth = big ? 6 : 3.2; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke();
  }
  // hand
  g.save(); g.rotate(ang);
  g.fillStyle = OUT; g.beginPath(); g.moveTo(-9, 14); g.lineTo(-7, -r + 22); g.lineTo(0, -r + 6); g.lineTo(7, -r + 22); g.lineTo(9, 14); g.closePath(); g.fill();
  g.fillStyle = o.hand || '#e5483a'; g.beginPath(); g.moveTo(-5.5, 10); g.lineTo(-4, -r + 26); g.lineTo(0, -r + 12); g.lineTo(4, -r + 26); g.lineTo(5.5, 10); g.closePath(); g.fill();
  g.restore();
  g.fillStyle = OUT; g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.fill(); g.fillStyle = o.hand || '#e5483a'; g.beginPath(); g.arc(0, 0, 7.5, 0, TAU); g.fill();
  g.restore();
}
function wallClock(g, x, y, r, tt, fast) {
  g.save(); g.translate(x, y);
  g.fillStyle = OUT; g.beginPath(); g.arc(0, 0, r + 7, 0, TAU); g.fill();
  g.fillStyle = '#fbf6e8'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  g.strokeStyle = OUT; g.lineCap = 'round';
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; g.lineWidth = i % 3 ? 2.5 : 4.5; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78); g.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92); g.stroke(); }
  const hA = tt * TAU / 12 - Math.PI / 2, mA = tt * TAU - Math.PI / 2;
  g.lineWidth = 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(hA) * r * 0.5, Math.sin(hA) * r * 0.5); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(mA) * r * 0.75, Math.sin(mA) * r * 0.75); g.stroke();
  g.fillStyle = OUT; g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill();
  g.restore();
}
function eyeMask(g, J, s, k, alpha) {
  // J = joints; sits over the eyes; k = 0..1 "snap" squash
  const h = J.head, f = J.facing, r = h.rot;
  g.save(); g.globalAlpha *= alpha; g.translate(h.x, h.y); g.rotate(f > 0 ? r : -(r - Math.PI) + Math.PI); // head.rot mirrored for facing -1
  g.scale(f * s, s);
  // strap round the back
  g.fillStyle = '#1c1f3d'; g.fillRect(-30, -7.5, 36, 8);
  g.strokeStyle = OUT; g.lineWidth = 1.6; g.strokeRect(-30, -7.5, 36, 8);
  // patch
  const sq = 1 + 0.12 * Math.sin(Math.PI * k) * (1 - k);
  g.save(); g.translate(16, -3.2); g.scale(1, sq);
  g.fillStyle = OUT; g.beginPath(); g.ellipse(0, 0, 17.5, 14.5, 0, 0, TAU); g.fill();
  g.fillStyle = '#34397a'; g.beginPath(); g.ellipse(0, 0, 15.8, 12.8, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(-3, -5, 9, 3.2, -0.2, 0, TAU); g.fill();
  // printed sleeping eyes
  g.strokeStyle = '#ffd86a'; g.lineWidth = 1.7; g.lineCap = 'round';
  g.beginPath(); g.arc(-5.2, -1.5, 3.8, 0.2, Math.PI - 0.2); g.stroke();
  g.beginPath(); g.arc(7, -1.5, 3.8, 0.2, Math.PI - 0.2); g.stroke();
  g.restore();
  g.restore();
}
function suitcase(g, x, y, s, rot, tagT) {
  // handle point at (x,y); case hangs below
  g.save(); g.translate(x, y); g.rotate(rot || 0); g.scale(s, s);
  const w = 112, h = 82, top = 34;
  g.strokeStyle = OUT; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-17, top); g.lineTo(-17, 6); g.quadraticCurveTo(0, -4, 17, 6); g.lineTo(17, top); g.stroke();
  g.fillStyle = OUT; rr(g, -w / 2 - 4, top - 4, w + 8, h + 8, 14); g.fill();
  g.fillStyle = '#d6572f'; rr(g, -w / 2, top, w, h, 11); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.18)'; rr(g, -w / 2 + 8, top + 7, w - 16, 12, 5); g.fill();
  g.fillStyle = '#8f2c18'; g.fillRect(-w / 2 + 22, top, 7, h); g.fillRect(w / 2 - 29, top, 7, h);
  g.fillStyle = '#e9c35a'; rr(g, -9, top + 36, 18, 12, 3); g.fill();
  // luggage tag with a tiny plane
  g.save(); g.translate(26, 10 + 2 * Math.sin(tagT * 5)); g.rotate(0.35 * Math.sin(tagT * 3.1));
  g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(6, 34); g.stroke();
  g.fillStyle = '#fff8e0'; rr(g, -8, 32, 28, 22, 4); g.fill(); g.lineWidth = 2.4; g.stroke();
  g.fillStyle = '#4a6fc4'; g.beginPath(); g.moveTo(-3, 46); g.lineTo(14, 41); g.lineTo(2, 38); g.lineTo(6, 36); g.lineTo(17, 40); g.lineTo(18, 43); g.lineTo(2, 50); g.closePath(); g.fill();
  g.restore();
  g.restore();
}
function quilt(g, hip, s, dy) {
  // covers the legs: from just past the hips to the toes
  const x0 = hip.x + 6 * s, x1 = hip.x + 140 * s, y1 = BED.top + 4, h = 46 * s * 0.55;
  g.save();
  g.fillStyle = OUT; g.beginPath(); g.moveTo(x0 - 4, y1 + 2); g.quadraticCurveTo(x0 + 4, y1 - h - 4 + dy, x0 + 50, y1 - h - 2 + dy);
  g.quadraticCurveTo((x0 + x1) / 2, y1 - h * 0.6 + dy, x1 - 30, y1 - h * 0.95 + dy); g.quadraticCurveTo(x1 + 8, y1 - h * 0.8 + dy, x1 + 8, y1 + 2); g.closePath(); g.fill();
  g.fillStyle = '#4f93b8';
  g.beginPath(); g.moveTo(x0, y1); g.quadraticCurveTo(x0 + 6, y1 - h + dy, x0 + 50, y1 - h + 2 + dy);
  g.quadraticCurveTo((x0 + x1) / 2, y1 - h * 0.62 + dy, x1 - 30, y1 - h * 0.97 + dy); g.quadraticCurveTo(x1 + 4, y1 - h * 0.8 + dy, x1 + 4, y1); g.closePath(); g.fill();
  g.save(); g.clip();
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 6;
  for (let x = x0 + 18; x < x1; x += 34) { g.beginPath(); g.moveTo(x, y1 - h - 10 + dy); g.lineTo(x - 10, y1 + 6); g.stroke(); }
  g.restore(); g.restore();
}

// ------------------------------------------------------------------ host helpers
const HOST_PAL = null;
function hostDraw(g, st) { try { MASCOT.draw(g, Object.assign({ shadow: false, pal: HOST_PAL }, st)); } catch (e) { /* keep frame alive */ } }
function hostJ(st) { try { return MASCOT.joints(st); } catch (e) { return null; } }
function groundShadow(g, x, y, w, a) { g.fillStyle = 'rgba(30,14,10,' + a + ')'; g.beginPath(); g.ellipse(x, y + 3, w, w * 0.12, 0, 0, TAU); g.fill(); }

// ------------------------------------------------------------------ bedroom scene
function bedroom(g, lt, cam) {
  const H = hourAt(lt), c = closureAt(lt), peek = peekAt(lt);
  const inWake = (lt >= T.caveOut && lt < T.cutPeek);
  const onBed = (lt < T.caveIn && lt >= T.cutBed) || inWake || (lt >= T.lapse0 - 0.05 && lt < T.cutWin);
  const standing1 = lt < T.cutBed;
  const peeking = (lt >= T.cutPeek && lt < T.walk0);
  const walking = (lt >= T.walk0 && lt < T.cutLapse);
  const win2 = lt >= T.cutWin;
  // pull cord / peek progress used for opening in the final beat
  const open2 = win2 ? sm(T.pull2, T.pull3, lt) : 0;
  const cEff = win2 ? 1 - open2 : c;
  const lapseU = sat((lt - T.lapse0) / (T.pull2 - T.lapse0));
  const hot = (lt >= T.lapse0) ? sm(T.lapse0, T.cutWin, lt) : 0;
  const bleach = win2 ? sm(T.pull2 + 0.1, T.pull3 + 0.4, lt) : 0;

  g.save(); applyCam(g, cam);
  g.drawImage(roomBG(), 0, 0);
  // window
  const sunWin = windowView(g, windowHour(lt, H), lt, bleach);
  windowFrame(g);
  // sunlight spill while the curtains are open (floor + wall wash)
  const openness = 1 - cEff + peek * 0.45;
  if (openness > 0.02) {
    g.save(); g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.5 * openness * (1 + 0.5 * bleach);
    g.fillStyle = 'rgba(255,226,150,0.45)';
    g.beginPath(); g.moveTo(1100, 560); g.lineTo(1560, 560); g.lineTo(1500, 1060); g.lineTo(760, 1060); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,240,190,0.25)'; g.fillRect(900, 100, 900, 600);
    g.restore();
  }
  // wall clock
  const clockT = (lt < T.lapse0) ? 0.37 + lt * 0.0008 : 0.37 + (lt - T.lapse0) * (1.6 + 5.0 * lapseU);
  wallClock(g, 950, 330, 62, clockT, false);

  // ---- characters ----
  let hostInfo = null, cu;
  if (standing1) {
    // host stands in front of the curtains (they are on the wall behind him)
    cu = curtains(g, cEff, peek, null, lt);
    hostInfo = hostStanding1(g, lt);
    if (hostInfo && hostInfo.after) hostInfo.after();
  } else if (peeking) {
    hostInfo = hostPeek(g, lt);
    const edgeL = hostInfo.hand ? hostInfo.hand.x - 4 : null;
    cu = curtains(g, cEff, peek, edgeL, lt);
    hostInfo.draw();
  } else {
    cu = curtains(g, cEff, peek, null, lt);
    if (walking) hostInfo = hostWalk(g, lt);
    else if (win2) hostInfo = hostFinal(g, lt);
    if (hostInfo && hostInfo.after) hostInfo.after();
  }
  if (onBed) hostBed(g, lt);
  // objects drawn after the host
  if (onBed && lt >= T.lapse0 - 0.05) suitcase(g, 870, 874, 0.98, 0, 0);
  g.restore();
  return { H: H, c: cEff, peek: peek, hot: hot, bleach: bleach, sunWin: sunWin, cu: cu, lapseU: lapseU, win2: win2, onBed: onBed };
}

// ---- standing at the window, pulling the cord (0 .. cutBed)
function hostStanding1(g, lt) {
  const x = 1000, y = FY;
  const grab = sm(T.cordGrab - 0.3, T.cordGrab + 0.12, lt);
  const pull = sm(T.pull0, T.pull1, lt);
  const ang = mix(1.0, -0.62, pull);
  const releaseUp = sm(T.pull1 + 0.05, T.pull1 + 0.35, lt);
  const tiredEyes = lt < A(0, 0.34) ? { eyes: 'droop' } : (lt < T.pull0 ? { eyes: 'squint', sweat: 0.3 } : { eyes: 'closed', sweat: 0.2 });
  const pose = lt < T.cutMask ? { a: 'stand', b: { name: 'point', dir: ang }, k: grab * (1 - releaseUp) } : { a: 'stand', b: { name: 'wipeBrow' }, k: sm(T.cutMask, T.cutMask + 0.15, lt) };
  let expr = tiredEyes;
  if (lt < A(0, 0.34)) expr = { eyes: 'droop', look: 'down', sleepZ: 0 };
  else if (lt < T.cordGrab) expr = { eyes: 'squint', look: 'fwd', sweat: 0.4 };
  else if (lt < T.cutMask) expr = { eyes: 'droop', look: 'fwd' };
  else expr = { eyes: 'droop', look: 'down' };
  const st = { x: x, y: y, s: 2, facing: 1, pose: pose, t: lt, expr: expr };
  groundShadow(g, x + 10, y, 90, 0.3);
  hostDraw(g, st);
  const J = hostJ(st);
  let hand = J ? J.handF : null;
  const after = function () {
    // cord from the pulley to the hand (or hanging free)
    const cx0 = CORD_X, cy0 = ROD_Y + 8;
    let ex = CORD_X, ey = 470 + 8 * Math.sin(lt * 2.0);
    if (hand && grab > 0.5 && releaseUp < 1) { ex = hand.x; ey = hand.y; }
    if (releaseUp > 0) { ex = mix(ex, CORD_X, releaseUp); ey = mix(ey, 470 + 12 * Math.sin(lt * 3.0) * (1 - releaseUp * 0.7), releaseUp); }
    g.save(); g.lineCap = 'round';
    g.strokeStyle = OUT; g.lineWidth = 7; g.beginPath(); g.moveTo(cx0, cy0); g.quadraticCurveTo(mix(cx0, ex, 0.5) - 4, mix(cy0, ey, 0.5), ex, ey); g.stroke();
    g.strokeStyle = '#e8d6a6'; g.lineWidth = 3.4; g.stroke();
    g.fillStyle = '#c9524a'; g.beginPath(); g.arc(ex, ey + 8, 8, 0, TAU); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2.5; g.stroke();
    g.restore();
  };
  // host is drawn before the cord; redraw hand arm on top is unnecessary (cord thin)
  // the mask: in hand until it snaps on the face
  const mk = sm(T.maskOn - 0.22, T.maskOn, lt);
  if (lt > T.cutMask - 0.2 && J) {
    const from = J.handF, to = { x: J.eyes.x, y: J.eyes.y };
    const px = mix(from.x + 6, to.x, mk), py = mix(from.y - 40 * (1 - mk), to.y, mk);
    if (mk < 1) {
      g.save(); g.translate(px, py); g.scale(2, 2); g.rotate(-0.3 * (1 - mk));
      g.fillStyle = OUT; g.beginPath(); g.ellipse(0, 0, 17.5, 14.5, 0, 0, TAU); g.fill();
      g.fillStyle = '#34397a'; g.beginPath(); g.ellipse(0, 0, 15.8, 12.8, 0, 0, TAU); g.fill();
      g.strokeStyle = '#ffd86a'; g.lineWidth = 1.7; g.lineCap = 'round';
      g.beginPath(); g.arc(-5.2, -1.5, 3.8, 0.2, Math.PI - 0.2); g.stroke(); g.beginPath(); g.arc(7, -1.5, 3.8, 0.2, Math.PI - 0.2); g.stroke();
      g.restore();
    } else eyeMask(g, J, 2, sat((lt - T.maskOn) / 0.25), 1);
  }
  return { hand: hand, after: after };
}

// ---- lying in bed (also waking up / sitting up)
function hostBed(g, lt) {
  const s = 2, x = BED.hx + 330, y = BED.top;
  let pose = 'lie', expr = { eyes: 'closed', sleepZ: 1 }, dy = 0, maskA = 1, sit = 0;
  if (lt >= T.cutBed && lt < T.caveIn) {
    const u = lt - T.cutBed; dy = u < 0 ? 0 : -22 * Math.exp(-5 * u) * Math.cos(13 * u);
  } else if (lt >= T.caveOut && lt < T.cutPeek) {
    // wakes: bolts upright and pushes the mask up
    sit = sm(T.wake, T.wake + 0.4, lt);
    pose = { a: 'lie', b: 'sitGround', k: sit };
    expr = sit < 0.05 ? { eyes: 'closed', sleepZ: 1 } : { eyes: 'wide', look: 'fwd', pop: '?', popT: T.wake + 0.35, popDur: 1.0, sweat: 0.0 };
    maskA = 1 - sm(T.wake - 0.05, T.wake + 0.2, lt);
  } else if (lt >= T.lapse0 - 0.05) {
    const u = lt - (T.lapse0 - 0.05);
    pose = 'lie'; expr = { eyes: 'closed', sleepZ: 1 }; dy = -4 * Math.exp(-4 * u) * Math.cos(10 * u);
    if (lt >= T.wake2) {
      sit = sm(T.wake2, T.wake2 + 0.35, lt);
      pose = { a: 'lie', b: 'sitGround', k: sit };
      expr = sit < 0.05 ? { eyes: 'closed', sleepZ: 1 } : { eyes: 'wide', look: 'fwd', sweat: 1, lines: 'shock' };
      maskA = 1 - sm(T.wake2 - 0.05, T.wake2 + 0.2, lt);
    }
  }
  const st = { x: x, y: y + dy, s: s, facing: 1, pose: pose, t: lt, expr: expr };
  groundShadow(g, x + 40, BED.top + 60, 200, 0.12);
  hostDraw(g, st);
  const J = hostJ(st);
  if (J && maskA > 0.01 && sit < 0.99) eyeMask(g, J, s, 1, maskA * (1 - sit * 0.9));
  else if (J && maskA > 0.01) eyeMask(g, J, s, 1, maskA * 0.1);
  // mask pushed up on the forehead after waking
  if (J && maskA < 0.99 && sit > 0.5) {
    const h = J.head; g.save(); g.translate(h.x + 14 * s * 0.4, h.y - 26 * s); g.rotate(-0.4);
    g.fillStyle = OUT; g.beginPath(); g.ellipse(0, 0, 36, 28, 0, 0, TAU); g.fill();
    g.fillStyle = '#34397a'; g.beginPath(); g.ellipse(0, 0, 32, 25, 0, 0, TAU); g.fill();
    g.restore();
  }
  if (J && sit < 0.6) quilt(g, J.hip, s, dy);
  else if (J) quilt(g, J.hip, s, dy);
  // body-clock bubble with the dial (b2 only)
  if (lt >= T.cutBed && lt < T.caveIn && J) bodyBubble(g, lt, J);
  return J;
}

function dialAngle24(lt) {
  const base = lt - T.cutBed;
  return Math.floor(base * 4) / 4 * (TAU / 24) * (1 + 0);         // 24 ticks per revolution, 4 ticks/s
}
function bodyBubble(g, lt, J) {
  const dx = 560, dyy = 395, r = 128;
  const popK = spring(lt - (T.cutBed + 0.35), 120, 13);
  const sc = Math.max(0.001, popK);
  // trail of thought dots
  const h = J.head;
  const p0 = { x: h.x + 22, y: h.y - 56 };
  for (let i = 0; i < 3; i++) {
    const u = (i + 1) / 4.2, x = mix(p0.x, dx - 60, u), y = mix(p0.y, dyy + r * 0.7, u), rr_ = 8 + i * 6;
    g.save(); g.globalAlpha = sat(popK * 1.4 - i * 0.2);
    g.fillStyle = OUT; g.beginPath(); g.arc(x, y, rr_ + 3, 0, TAU); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, rr_, 0, TAU); g.fill(); g.restore();
  }
  g.save(); g.translate(dx, dyy); g.scale(sc, sc); g.translate(-dx, -dyy);
  // cloud
  g.fillStyle = OUT; g.beginPath(); g.arc(dx, dyy, r + 38, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.arc(dx, dyy, r + 30, 0, TAU); g.fill();
  const tk = lt - T.cutBed;
  // "over 24h": the hand overshoots the top notch by a sliver, then light/dark nudges it back
  let ang = dialAngle24(lt);
  const o24 = lt > T.over24 ? sm(T.over24, T.over24 + 0.6, lt) : 0;
  const nudge = lt > T.lightDark ? sm(T.lightDark, T.lightDark + 0.25, lt) * (1 - sm(T.lightDark + 0.5, T.lightDark + 0.9, lt)) : 0;
  ang += 0.0;
  dial(g, dx, dyy, r, ang - nudge * 0.12, { sky: true, t: lt, n: 24 });
  // overshoot sliver beside the top notch
  if (o24 > 0) {
    g.save(); g.translate(dx, dyy); g.strokeStyle = '#ff9a3a'; g.lineWidth = 8; g.lineCap = 'round';
    g.beginPath(); g.arc(0, 0, r + 15, -Math.PI / 2, -Math.PI / 2 + 0.2 * o24); g.stroke();
    g.fillStyle = OUT; g.beginPath(); g.moveTo(-10, -r - 36); g.lineTo(10, -r - 36); g.lineTo(0, -r - 18); g.closePath(); g.fill();
    g.restore();
  }
  // light & dark keep it in line: sun / moon glints
  if (lt > T.lightDark - 0.1) {
    const a = sm(T.lightDark - 0.1, T.lightDark + 0.3, lt), pulse = 0.5 + 0.5 * Math.sin(lt * 5);
    g.save(); g.globalCompositeOperation = 'lighter';
    rad(g, dx, dyy - r * 0.5, 70, [[0, 'rgba(255,230,120,' + 0.55 * a * pulse + ')'], [1, 'rgba(255,230,120,0)']]);
    rad(g, dx, dyy + r * 0.5, 60, [[0, 'rgba(150,170,255,' + 0.5 * a * (1 - pulse) + ')'], [1, 'rgba(150,170,255,0)']]);
    g.restore();
  }
  g.restore();
}

// ---- peek at the window (cutPeek .. walk0)
// host stands in front of the left curtain panel, arm out, tugging its inner edge to the left (he steps back
// while pulling), which opens a slit over the window where the sun is
function hostPeek(g, lt) {
  const y = FY, s = 2;
  const pk = sm(T.cutPeek + 0.15, T.cutPeek + 0.6, lt);
  const x = mix(1172, 1046, pk);
  const glare = sm(T.glare, T.glare + 0.15, lt);
  const dizzy = sm(T.glare + 0.25, T.glare + 0.5, lt);
  const pose = { a: 'stand', b: { name: 'point', dir: 0.1 }, k: sm(T.cutPeek - 0.05, T.cutPeek + 0.2, lt) };
  let expr;
  if (dizzy > 0.2) expr = { eyes: 'spiral', lines: 'dizzy', sweat: 0.3 };
  else if (glare > 0.2) expr = { eyes: 'squint', sweat: 0.5, look: 'fwd' };
  else expr = { eyes: 'droop', look: 'fwd' };
  const st = { x: x, y: y, s: s, facing: 1, pose: pose, t: lt, expr: expr };
  const J = hostJ(st);
  return { hand: J ? J.handF : null, J: J, glare: glare,
    draw: function () { groundShadow(g, x + 10, y, 90, 0.3); hostDraw(g, st); }, after: function () {} };
}

// ---- suitcase gag walk (walk0 .. cutLapse)
function walkX(lt) { return mix(1690, 900, easeInOut(sat((lt - T.walk0) / (T.drop - T.walk0)))); }
function hostWalk(g, lt) {
  const x = walkX(lt), y = FY, s = 2;
  const moving = lt < T.drop;
  const ph = (1690 - x) / (140 * s);
  const stop = sm(T.drop - 0.25, T.drop, lt);
  const slump = sm(T.drop, T.drop + 0.4, lt);
  const pose = { a: { name: 'walk', amp: 0.8 * (1 - stop), lean: 0.12, headDown: 0.5 }, b: 'slump', k: slump };
  const expr = { eyes: 'droop', look: 'down', sleepZ: slump > 0.5 ? 0.8 : 0.0 };
  const st = { x: x, y: y, s: s, facing: -1, pose: pose, t: lt, phase: ph, expr: expr };
  groundShadow(g, x, y, 100, 0.3);
  hostDraw(g, st);
  const J = hostJ(st);
  const drop = sm(T.drop, T.drop + 0.12, lt);
  if (J) {
    const hx = J.handB.x, hy = J.handB.y;
    if (drop < 1) suitcase(g, mix(hx, 868, drop), mix(hy, 874, drop), 0.98, mix(0.06 * Math.sin(lt * 6.0), 0, drop), lt);
    else suitcase(g, 868, 874, 0.98, 0, 0);
  }
  return { hand: null, after: function () {} };
}

// ---- final: pulling the curtain open, white-hot room (cutWin .. end)
function hostFinal(g, lt) {
  const x = 1000, y = FY, s = 2;
  const grab = sm(T.cutWin, T.cutWin + 0.2, lt);
  const pull = sm(T.pull2, T.pull3, lt);
  const ang = mix(-0.6, 0.95, pull);
  const shield = sm(T.pull3 - 0.15, T.pull3 + 0.25, lt);
  let pose = { a: 'stand', b: { name: 'point', dir: ang }, k: grab * (1 - shield) };
  if (shield > 0.01) pose = { a: pose, b: 'shield', k: shield };
  const expr = lt < T.pull2 ? { eyes: 'wide', sweat: 1, look: 'fwd' } : { eyes: 'squint', sweat: 1 };
  const st = { x: x, y: y, s: s, facing: 1, pose: pose, t: lt, expr: expr };
  groundShadow(g, x + 10, y, 90, 0.3);
  hostDraw(g, st);
  const J = hostJ(st);
  const hand = J ? J.handF : null;
  const after = function () {
    const cx0 = CORD_X, cy0 = ROD_Y + 8;
    let ex = CORD_X, ey = 470;
    if (hand && shield < 0.5) { ex = hand.x; ey = hand.y; } else { ex = CORD_X; ey = 620 - 140 * smooth(shield); }
    g.save(); g.lineCap = 'round';
    g.strokeStyle = OUT; g.lineWidth = 7; g.beginPath(); g.moveTo(cx0, cy0); g.quadraticCurveTo(mix(cx0, ex, 0.5) - 4, mix(cy0, ey, 0.5), ex, ey); g.stroke();
    g.strokeStyle = '#e8d6a6'; g.lineWidth = 3.4; g.stroke();
    g.fillStyle = '#c9524a'; g.beginPath(); g.arc(ex, ey + 8, 8, 0, TAU); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2.5; g.stroke();
    g.restore();
  };
  return { hand: hand, after: after };
}

// ------------------------------------------------------------------ bedroom overlays (darkness, glow, heat)
function bedroomOverlay(g, lt, cam, S) {
  const c = S.c;
  g.save(); applyCam(g, cam);
  // darkness when the blackout curtains are shut
  const dark = 0.6 * smooth(c);
  if (dark > 0.01) { g.fillStyle = 'rgba(10,12,40,' + dark + ')'; g.fillRect(-200, -200, W + 400, HT + 400); }
  // light leaking around the blackout curtains
  const leak = smooth(c) * (0.55 + 0.45 * S.hot);
  if (leak > 0.02) {
    g.save(); g.globalCompositeOperation = 'lighter';
    const seam = 1330, flick = 0.9 + 0.1 * Math.sin(lt * 2.7);
    let gr = g.createLinearGradient(seam - 26, 0, seam + 26, 0);
    gr.addColorStop(0, 'rgba(255,200,120,0)'); gr.addColorStop(0.5, 'rgba(255,244,214,' + (0.95 * leak * flick) + ')'); gr.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gr; g.fillRect(seam - 26, ROD_Y + 8, 52, 560);
    // edges of the panels (outer sides) and under the hem
    const edgeOK = lt >= T.cutBed && !(lt >= T.cutPeek && lt < T.walk0);   // host stands in front of the left edge otherwise
    if (edgeOK) {
      gr = g.createLinearGradient(1030, 0, 1070, 0); gr.addColorStop(0, 'rgba(255,214,140,' + 0.4 * leak + ')'); gr.addColorStop(1, 'rgba(255,214,140,0)');
      g.fillStyle = gr; g.fillRect(1030, ROD_Y + 8, 40, 560);
    }
    gr = g.createLinearGradient(1596, 0, 1636, 0); gr.addColorStop(0, 'rgba(255,214,140,0)'); gr.addColorStop(1, 'rgba(255,214,140,' + 0.4 * leak + ')');
    g.fillStyle = gr; g.fillRect(1596, ROD_Y + 8, 40, 560);
    if (lt >= T.cutPeek && lt < T.walk0) {   // sunlight pours through the slit onto his face and chest
      const pa = peekAt(lt);
      rad(g, 1240, 420, 330, [[0, 'rgba(255,214,140,' + 0.34 * pa + ')'], [1, 'rgba(255,214,140,0)']]);
      if (S.cu && S.cu.xR > S.cu.xL + 4 && pa > 0.02) {   // the slit itself blazes: sun disk visible, the same place it was
        g.save(); g.beginPath(); g.rect(S.cu.xL, WIN.y, S.cu.xR - S.cu.xL, WIN.h); g.clip();
        g.fillStyle = 'rgba(255,238,190,' + 0.3 * pa + ')'; g.fillRect(S.cu.xL, WIN.y, S.cu.xR - S.cu.xL, WIN.h);
        rad(g, S.sunWin.sx, S.sunWin.sy, 150, [[0, 'rgba(255,252,230,' + 0.95 * pa + ')'], [0.3, 'rgba(255,236,160,' + 0.5 * pa + ')'], [1, 'rgba(255,230,150,0)']]);
        g.restore();
      }
    }
    // backlit fabric: the sun's position behind the panels (moves as the hours race by)
    const bx = S.sunWin.sx, by = Math.min(520, Math.max(160, S.sunWin.sy));
    rad(g, bx, by + 60, 240, [[0, 'rgba(255,200,110,' + 0.30 * leak * (0.4 + 0.9 * S.hot) + ')'], [1, 'rgba(255,200,110,0)']]);
    // hem glow spilling onto the sill and floor
    rad(g, 1330, 660, 380, [[0, 'rgba(255,214,150,' + 0.22 * leak + ')'], [1, 'rgba(255,214,150,0)']]);
    g.restore();
  }
  // warm light patch on the wall and floor slides across during the time-lapse
  if (lt >= T.lapse0 && lt < T.cutWin && c > 0.5) {
    const u = S.lapseU, xx = mix(1000, 1400, u);
    g.save(); g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.4 * (0.4 + 0.6 * S.hot);
    g.fillStyle = 'rgba(255,196,110,0.5)';
    g.beginPath(); g.moveTo(xx - 70, 560); g.lineTo(xx + 20, 560); g.lineTo(xx - 260 + 280 * u, 1060); g.lineTo(xx - 560 + 280 * u, 1060); g.closePath(); g.fill();
    g.restore();
  }
  g.restore();
}

// ------------------------------------------------------------------ Mammoth Cave 1938
let CAVE = null;
function caveBG() {
  if (CAVE) return CAVE;
  const c = mkc(W, HT), g = c.getContext('2d'), r = rng(1938);
  let gr = g.createLinearGradient(0, 0, 0, HT); gr.addColorStop(0, '#120c07'); gr.addColorStop(0.5, '#2a1d10'); gr.addColorStop(1, '#1b1209');
  g.fillStyle = gr; g.fillRect(0, 0, W, HT);
  // rock blobs
  for (let i = 0; i < 520; i++) {
    const x = r() * W, y = r() * HT, rx = 30 + r() * 120, ry = 20 + r() * 70, a = 0.05 + r() * 0.1, lum = 30 + r() * 40;
    g.fillStyle = 'rgba(' + (lum + 24) + ',' + (lum + 8) + ',' + (lum - 8) + ',' + a + ')';
    g.beginPath(); g.ellipse(x, y, rx, ry, r() * 3, 0, TAU); g.fill();
  }
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3;
  for (let i = 0; i < 40; i++) { let x = r() * W, y = r() * HT; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 110; y += 20 + r() * 50; g.lineTo(x, y); } g.stroke(); }
  // stalactites
  g.fillStyle = '#17100a';
  for (let i = 0; i < 26; i++) {
    const x = i * 78 + r() * 40, w = 30 + r() * 50, h = 60 + r() * 190;
    g.beginPath(); g.moveTo(x - w / 2, -4); g.lineTo(x + w / 2, -4); g.quadraticCurveTo(x + w * 0.15, h * 0.6, x + (r() - 0.5) * 12, h); g.quadraticCurveTo(x - w * 0.15, h * 0.6, x - w / 2, -4); g.closePath(); g.fill();
    g.fillStyle = 'rgba(120,90,56,0.22)'; g.beginPath(); g.moveTo(x - w * 0.1, 0); g.lineTo(x + w / 2 - 2, 0); g.lineTo(x + 1, h - 6); g.closePath(); g.fill(); g.fillStyle = '#17100a';
  }
  // floor ledge
  gr = g.createLinearGradient(0, 860, 0, HT); gr.addColorStop(0, '#3a2a18'); gr.addColorStop(1, '#17100a');
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, 880); for (let x = 0; x <= W; x += 60) g.lineTo(x, 876 + Math.sin(x * 0.013) * 7 + r() * 5); g.lineTo(W, HT); g.lineTo(0, HT); g.closePath(); g.fill();
  // stalagmites
  g.fillStyle = '#1d140c';
  for (let i = 0; i < 9; i++) { const x = r() * W, w = 34 + r() * 46, h = 40 + r() * 80; if (x > 60 && x < 700) continue; g.beginPath(); g.moveTo(x - w, 884); g.quadraticCurveTo(x - w * 0.2, 884 - h * 0.7, x, 884 - h); g.quadraticCurveTo(x + w * 0.2, 884 - h * 0.7, x + w, 884); g.closePath(); g.fill(); }
  // wooden board for the clocks
  g.fillStyle = '#0d0805'; g.fillRect(842, 192, 1000, 604);
  gr = g.createLinearGradient(0, 200, 0, 790); gr.addColorStop(0, '#7a5434'); gr.addColorStop(1, '#5b3d24');
  g.fillStyle = gr; g.fillRect(850, 200, 984, 588);
  g.strokeStyle = 'rgba(30,16,8,0.6)'; g.lineWidth = 4; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(850, 200 + i * 98); g.lineTo(1834, 200 + i * 98); g.stroke(); }
  g.strokeStyle = 'rgba(30,16,8,0.25)'; g.lineWidth = 2; for (let i = 0; i < 60; i++) { const y = 206 + r() * 576, x = 850 + r() * 900; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 60 + r() * 120, y + (r() - 0.5) * 4); g.stroke(); }
  g.fillStyle = '#2c1c10'; for (const [bx, by] of [[866, 216], [1818, 216], [866, 772], [1818, 772]]) { g.beginPath(); g.arc(bx, by, 7, 0, TAU); g.fill(); }
  // cot (frame + canvas)
  g.fillStyle = OUT; g.fillRect(150, 770, 470, 22); g.fillRect(168, 790, 16, 94); g.fillRect(586, 790, 16, 94);
  g.fillStyle = '#6d5a3a'; g.fillRect(154, 775, 462, 14);
  g.fillStyle = '#8b2f2a'; rr(g, 160, 748, 450, 34, 12); g.fill(); g.strokeStyle = OUT; g.lineWidth = 4; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(180, 754, 400, 8);
  g.fillStyle = '#d9cdb0'; g.beginPath(); g.ellipse(214, 744, 54, 22, 0, 0, TAU); g.fill(); g.stroke();
  // 1938 sign hung from the ceiling on ropes
  g.strokeStyle = '#a58a5a'; g.lineWidth = 4; g.beginPath(); g.moveTo(180, 0); g.lineTo(206, 150); g.moveTo(420, 0); g.lineTo(396, 150); g.stroke();
  g.fillStyle = OUT; rr(g, 190, 130, 224, 100, 10); g.fill();
  g.fillStyle = '#8e6a42'; rr(g, 196, 136, 212, 88, 8); g.fill();
  g.fillStyle = '#f4e6c0'; g.font = '900 64px "Segoe UI Black", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('1938', 302, 182);
  CAVE = c; return c;
}
function caveDrips(g, lt) {
  const r = [260, 640, 960, 1500, 1720];
  for (let i = 0; i < r.length; i++) {
    const per = 2.3 + i * 0.37, u = ((lt + i * 0.9) % per) / per, x = r[i];
    const y0 = 110 + (i % 3) * 40;
    if (u < 0.5) { const q = u / 0.5, y = y0 + (876 - y0) * q * q; g.fillStyle = 'rgba(160,200,230,0.8)'; g.beginPath(); g.ellipse(x, y, 3, 6, 0, 0, TAU); g.fill(); }
    else if (u < 0.62) { const q = (u - 0.5) / 0.12; g.strokeStyle = 'rgba(160,200,230,' + 0.6 * (1 - q) + ')'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, 880, 4 + 16 * q, 2 + 4 * q, 0, 0, TAU); g.stroke(); }
  }
}
const CAVE_PAL = (function () { try { return MASCOT.palette('#8d6a46', { pants: '#43301f', head: '#1a120c' }); } catch (e) { return null; } })();

function cave(g, lt, cam) {
  g.save(); applyCam(g, cam);
  g.drawImage(caveBG(), 0, 0);
  caveDrips(g, lt);
  // lantern (swinging) hanging near the cot
  const sw = 0.05 * Math.sin(lt * 1.2), lx = 740, ly0 = 0, ly = 380;
  g.save(); g.translate(lx, ly0); g.rotate(sw);
  g.strokeStyle = '#5b4630'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, ly - 36); g.stroke();
  g.translate(0, ly);
  const fl = 0.85 + 0.15 * Math.sin(lt * 11) * Math.sin(lt * 7.3);
  g.globalCompositeOperation = 'lighter';
  rad(g, 0, 0, 520, [[0, 'rgba(255,190,90,' + 0.55 * fl + ')'], [0.35, 'rgba(255,150,60,' + 0.18 * fl + ')'], [1, 'rgba(255,120,40,0)']]);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = OUT; rr(g, -22, -30, 44, 64, 8); g.fill();
  g.fillStyle = '#ffd36a'; rr(g, -15, -22, 30, 48, 6); g.fill(); g.fillStyle = '#fff2b0'; g.beginPath(); g.ellipse(0, 4, 8, 16 * fl, 0, 0, TAU); g.fill();
  g.fillStyle = OUT; g.fillRect(-24, -42, 48, 14); g.fillRect(-12, -50, 24, 10); g.fillRect(-24, 32, 48, 8);
  g.restore();

  // researcher on the cot with a notebook
  const fx = 400, fy = 748;
  const look = lt < T.clk28 ? 'down' : (lt < T.noFollow ? 'fwd' : 'fwd');
  const confused = lt > T.noFollow + 0.1;
  const expr = confused ? { eyes: 'worry', look: 'fwd', pop: '?', popT: T.noFollow + 0.15, popDur: 1.4 } : { eyes: 'normal', look: look };
  const st = { x: fx, y: fy, s: 1.6, facing: 1, pose: 'sitBench', seat: 48, t: lt, expr: expr, pal: CAVE_PAL };
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(fx + 20, fy + 8, 150, 12, 0, 0, TAU); g.fill();
  hostDraw(g, st);
  const J = hostJ(st);
  if (J) {
    // notebook + pencil in the front hand
    const hp = J.handF;
    g.save(); g.translate(hp.x + 4, hp.y - 10); g.rotate(-0.25 + 0.04 * Math.sin(lt * 9));
    g.fillStyle = OUT; rr(g, -4, -34, 46, 56, 4); g.fill(); g.fillStyle = '#e9dcb4'; rr(g, -1, -31, 40, 50, 3); g.fill();
    g.strokeStyle = '#8a7a52'; g.lineWidth = 1.6; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(3, -22 + i * 10); g.lineTo(34, -22 + i * 10); g.stroke(); }
    g.restore();
  }

  // dials
  const k28 = spring(lt - T.clk28, 110, 12), k24 = spring(lt - T.clk24, 110, 12);
  const run = Math.max(0, lt - T.clkRun);
  const P28 = 2.8, P24 = 2.4;
  const a28 = TAU * run / P28, a24 = TAU * run / P24;
  const shakeT = lt - T.noFollow, shake = shakeT > 0 && shakeT < 1.4 ? Math.sin(shakeT * 22) * 0.07 * Math.exp(-shakeT * 1.6) : 0;
  const c28 = { x: 1090, y: 480 }, c24 = { x: 1580, y: 480 };
  if (k28 > 0.01) {
    g.save(); g.translate(c28.x, c28.y); g.scale(k28, k28); g.translate(-c28.x, -c28.y);
    dial(g, c28.x, c28.y, 178, a28, { n: 28, face: '#fff1c8', rim: '#d9b26a', hand: '#4a3520', t: lt });
    // plaque with the digits
    g.fillStyle = OUT; rr(g, c28.x - 62, c28.y + 205, 124, 66, 10); g.fill(); g.fillStyle = '#f4e6c0'; rr(g, c28.x - 57, c28.y + 210, 114, 56, 8); g.fill();
    g.fillStyle = '#3a2412'; g.font = '900 46px "Segoe UI Black", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('28', c28.x, c28.y + 240);
    g.restore();
  }
  if (k24 > 0.01) {
    g.save(); g.translate(c24.x, c24.y); g.rotate(shake); g.scale(k24, k24); g.translate(-c24.x, -c24.y);
    const tickA = Math.floor(run / (P24 / 24)) * (TAU / 24);
    dial(g, c24.x, c24.y, 178, run > 0 ? tickA : 0, { n: 24, sky: true, t: lt });
    g.fillStyle = OUT; rr(g, c24.x - 62, c24.y + 205, 124, 66, 10); g.fill(); g.fillStyle = '#f4e6c0'; rr(g, c24.x - 57, c24.y + 210, 114, 56, 8); g.fill();
    g.fillStyle = '#3a2412'; g.font = '900 46px "Segoe UI Black", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('24', c24.x, c24.y + 240);
    g.restore();
  }
  // gap marker between the two hands once they drift apart
  if (run > 1.0 && k24 > 0.9) {
    const gap = Math.abs(a24 - a28) % TAU;
    g.save(); g.globalAlpha = sat((run - 1.0) / 0.8) * 0.9;
    g.strokeStyle = '#ffb347'; g.lineWidth = 7; g.setLineDash([2, 16]); g.lineCap = 'round';
    g.beginPath(); g.moveTo(c28.x + 178 + 20, c28.y + 205); g.bezierCurveTo(c28.x + 270, c28.y + 250 - gap * 8, c24.x - 270, c24.y + 250 - gap * 8, c24.x - 178 - 20, c24.y + 205); g.stroke();
    g.setLineDash([]); g.restore();
  }
  // lantern warmth over everything + sepia old-film tint
  g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(210,160,100,0.5)'; g.fillRect(-100, -100, W + 200, HT + 200);
  g.globalCompositeOperation = 'source-over';
  rad(g, 960, 540, 1250, [[0.55, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.45)']]);
  // old-film flicker + dust motes in the light
  const fk = 0.03 * (hash1(Math.floor(lt * 24)) - 0.5);
  g.fillStyle = 'rgba(255,220,160,' + (0.025 + fk) + ')'; g.fillRect(-100, -100, W + 200, HT + 200);
  for (let i = 0; i < 18; i++) { const px = 380 + hash1(i * 7) * 700 + 20 * Math.sin(lt * 0.5 + i), py = ((hash1(i * 3 + 1) * 700 + lt * (6 + i % 4)) % 700) + 120; g.fillStyle = 'rgba(255,225,170,' + 0.25 * hash1(i * 11) + ')'; g.fillRect(px, py, 2.4, 2.4); }
  g.restore();
}
function caveCam(lt) {
  const a = { z: 1.32, cx: 760, cy: 560 }, b = { z: 1.0, cx: 1180, cy: 540 };
  const drift = lerpCam({ z: 1.3, cx: 740, cy: 575 }, { z: 1.38, cx: 760, cy: 565 }, sm(T.caveIn, T.clk28, lt));
  const k = sm(T.clk28 - 0.5, T.clk28 + 0.45, lt);
  return lerpCam(drift, b, k);
}

// ------------------------------------------------------------------ draw
function drawInner(g, lt) {
  const inCave = lt >= T.caveIn && lt < T.caveOut;
  let S = null;
  if (inCave) {
    cave(g, lt, caveCam(lt));
  } else {
    // camera (walk shot follows the host)
    const cam = bedroomCam(lt, (lt >= T.walk0 && lt < T.cutLapse) ? walkX(lt) : null);
    S = bedroom(g, lt, cam);
    bedroomOverlay(g, lt, cam, S);
    // heat shimmer on the window band + glare while the room cooks
    if (S.hot > 0.02 || S.bleach > 0) {
      const wy0 = Math.max(0, (WIN.y - 540) * cam.z + 540 - 20), wy1 = Math.min(HT, (WIN.y + WIN.h - 540) * cam.z + 540 + 120);
      try { TOD.heatWarp(g, wy0, wy1, 0.35 + 0.65 * Math.max(S.hot, S.bleach), lt); } catch (e) { /* ignore */ }
    }
    if (S.bleach > 0.01) { try { TOD.heatGlare(g, 0.9 * S.bleach, lt); } catch (e) { /* ignore */ } }
    if (S.bleach > 0.01) { g.fillStyle = 'rgba(255,250,236,' + 0.38 * smooth(S.bleach) + ')'; g.fillRect(0, 0, W, HT); }
  }
  // HUD: visible except inside the cave
  const hudA = 1 - sm(HUD_FADE0, T.caveIn + 0.05, lt) + sm(T.caveOut - 0.05, T.caveOut + 0.25, lt);
  const a = lt < T.caveIn ? 1 - sm(HUD_FADE0, T.caveIn, lt) : sm(T.caveOut, T.caveOut + 0.25, lt);
  if (a > 0.01) {
    const race = lt >= T.lapse0 && lt < T.pull2 + 0.4 ? 1 : 0;
    const popBack = lt >= T.caveOut ? sat((lt - T.caveOut) / 0.5) : 1;
    TOD.hud(g, hourAt(lt), { alpha: a, pop: lt < 0.5 ? sat(lt / 0.5) : popBack, pulse: race ? 0.6 + 0.4 * Math.sin(lt * 14) : 0 });
  }
}

window.CH.c3 = {
  draw: function (g, lt, dur) {
    g.save();
    try { drawInner(g, lt); } catch (e) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#e3c9a2'; g.fillRect(0, 0, W, HT);
      if (typeof console !== 'undefined' && !window.__c3err) { window.__c3err = 1; console.error('c3 draw error', e && e.stack || e); }
    }
    g.restore();
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  },
  T: { T: T, DUR: DUR, hourAt: hourAt }
};
})();
