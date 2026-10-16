// ch2.js — "Morning" (27.83 s). CH.ch2.draw(g, lt, dur). Pure function of lt.
// Shots: A bedroom (ghost alarm, slap) | B kitchen (ghost mug, catch) | C living room (toe + milk vignettes)
//        D street (bus doors open on arrival, skateboard sidestep, luckiest-person strut, look at the horizon)
(function () {
'use strict';
const T0 = LAYOUT.ch2.start;
const HS = 0.92;
const CUT = 14.45;               // interior -> street

// ---------------------------------------------------------------- helpers
function ik2(p0, p1, l1, l2, side) {
  let dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy), ux, uy;
  if (d < 1e-6) { ux = 0; uy = 1; d = 1e-6; } else { ux = dx / d; uy = dy / d; }
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { mid: { x: p0.x + ux * a + side * uy * h, y: p0.y + uy * a - side * ux * h }, end: { x: p0.x + ux * dd, y: p0.y + uy * dd } };
}
function reach(st, wx, wy, k, back) {
  if (k <= 0.001) return;
  const P = st.pose, tx = (wx - st.x) / (st.s * st.facing), ty = (wy - st.y) / st.s;
  const A = back ? P.armB : P.armF;
  const r = ik2(P.J, { x: lerp(A.hand.x, tx, k), y: lerp(A.hand.y, ty, k) }, 39, 39, -1);
  A.elbow = r.mid; A.hand = r.end;
}
const mixCam = (a, b, w) => ({ x: lerp(a.x, b.x, w), y: lerp(a.y, b.y, w), z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), w)) });
const easeIO = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
function rr(g, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function lg(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); for (const s of stops) gr.addColorStop(s[0], s[1]); return gr; }
function glow(g, x, y, r, col, a) {
  if (a <= 0.003) return;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}
// ghost fill + double stroke on the current path (readable on light and dark walls)
function gp(g, a, fillA) {
  g.fillStyle = `rgba(70,185,255,${(fillA == null ? 0.42 : fillA) * a})`; g.fill();
  g.lineJoin = 'round'; g.strokeStyle = `rgba(8,50,130,${0.5 * a})`; g.lineWidth = 6; g.stroke();
  g.strokeStyle = `rgba(205,251,255,${a})`; g.lineWidth = 2.6; g.stroke();
}
function ellipseShadow(g, x, y, rx, a) { g.fillStyle = `rgba(10,5,20,${a})`; g.beginPath(); g.ellipse(x, y, rx, rx * 0.17, 0, 0, TAU); g.fill(); }

// ---------------------------------------------------------------- set (all world coordinates, floor line 790, standing plane 820)
function drawRoom(g, cam, lt) {
  const hw = 960 / cam.z + 90, x0 = cam.x - hw, x1 = cam.x + hw;
  const yT = cam.y - 540 / cam.z - 90, yB = cam.y + 540 / cam.z + 90;
  const R = [[-600, 1700, '#6d7fa3', '#4d5d84', '#4a2e2e', '#2c1a1e'], [1700, 2900, '#ecca9c', '#d3a97c', '#cdb99a', '#9d8a6c'], [2900, 5400, '#8fb0a5', '#728f88', '#5e4838', '#38291f']];
  for (const r of R) {
    const a = Math.max(x0, r[0]), b = Math.min(x1, r[1]); if (b <= a) continue;
    g.fillStyle = lg(g, 0, yT, 0, 790, [[0, r[3]], [1, r[2]]]); g.fillRect(a, yT, b - a, 790 - yT);
    g.fillStyle = lg(g, 0, 790, 0, 1260, [[0, r[4]], [1, r[5]]]); g.fillRect(a, 790, b - a, 1260 - 790);
    g.fillStyle = 'rgba(20,10,20,0.35)'; g.fillRect(a, 790, b - a, 4);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(a, 774, b - a, 16); // baseboard
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2;
    for (const yy of [838, 890, 962, 1056, 1170]) { g.beginPath(); g.moveTo(a, yy); g.lineTo(b, yy); g.stroke(); }
  }
  // room dividers
  for (const dx of [1700, 2900]) { if (dx > x0 - 40 && dx < x1 + 40) { g.fillStyle = '#e9dcc4'; g.fillRect(dx - 14, yT, 28, 800 - yT); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(dx + 8, yT, 6, 800 - yT); } }
  if (x0 < 1700) drawBedroom(g, lt);
  if (x1 > 1700 && x0 < 2900) drawKitchen(g, lt);
  if (x1 > 2900) drawLiving(g, lt);
}

function drawBedroom(g, lt) {
  // window with dawn sky
  const wx = 1250, wy = 170, ww = 370, wh = 370;
  g.fillStyle = '#efe3d0'; rr(g, wx - 16, wy - 16, ww + 32, wh + 32, 10); g.fill();
  g.save(); rr(g, wx, wy, ww, wh, 4); g.clip();
  g.fillStyle = lg(g, 0, wy, 0, wy + wh, [[0, '#5c7fc0'], [0.45, '#f3a47c'], [0.8, '#ffc08a'], [1, '#ff9a6c']]); g.fillRect(wx, wy, ww, wh);
  glow(g, 1500, 470, 230, '255,230,170', 0.75);
  g.fillStyle = '#fff3c8'; g.beginPath(); g.arc(1500, 472, 34, 0, TAU); g.fill();
  g.fillStyle = '#7a5688';
  const bl = [[1250, 70], [1290, 120], [1340, 90], [1390, 150], [1440, 100], [1480, 60], [1560, 130], [1600, 90]];
  for (let i = 0; i < bl.length; i++) { const w = i < bl.length - 1 ? bl[i + 1][0] - bl[i][0] + 2 : 40; g.fillRect(bl[i][0], 540 - bl[i][1], w, bl[i][1]); }
  g.fillStyle = '#efe3d0'; g.fillRect(wx + ww / 2 - 5, wy, 10, wh); g.fillRect(wx, wy + 175, ww, 9);
  g.restore();
  g.fillStyle = '#d6c6ae'; rr(g, wx - 30, 540, ww + 60, 18, 4); g.fill();
  // curtains
  g.fillStyle = '#3c6f78';
  g.beginPath(); g.moveTo(wx - 26, 130); g.lineTo(wx + 62, 130); g.quadraticCurveTo(wx + 40, 340, wx + 76, 560); g.lineTo(wx - 26, 560); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(wx + ww + 26, 130); g.lineTo(wx + ww - 62, 130); g.quadraticCurveTo(wx + ww - 40, 340, wx + ww - 76, 560); g.lineTo(wx + ww + 26, 560); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 3;
  for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(wx - 8 + i * 22, 140); g.quadraticCurveTo(wx + 8 + i * 20, 340, wx + 10 + i * 24, 550); g.stroke(); g.beginPath(); g.moveTo(wx + ww + 8 - i * 22, 140); g.quadraticCurveTo(wx + ww - 8 - i * 20, 340, wx + ww - 10 - i * 24, 550); g.stroke(); }
  g.fillStyle = '#2b4f56'; g.fillRect(wx - 40, 120, ww + 80, 16);
  // light shaft + floor patch
  g.save(); g.globalCompositeOperation = 'lighter';
  g.fillStyle = lg(g, 1500, 540, 1000, 960, [[0, 'rgba(255,205,150,0.2)'], [1, 'rgba(255,190,130,0)']]);
  g.beginPath(); g.moveTo(1250, 556); g.lineTo(1620, 556); g.lineTo(1340, 1060); g.lineTo(520, 1060); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,200,140,0.1)'; g.beginPath(); g.moveTo(560, 880); g.lineTo(1280, 880); g.lineTo(1340, 1000); g.lineTo(480, 1000); g.closePath(); g.fill();
  g.restore();
  // rug
  g.fillStyle = 'rgba(146,70,92,0.75)'; g.beginPath(); g.ellipse(840, 905, 360, 62, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,220,200,0.35)'; g.lineWidth = 4; g.beginPath(); g.ellipse(840, 905, 320, 50, 0, 0, TAU); g.stroke();
  // poster
  g.fillStyle = '#f2e6d2'; rr(g, 470, 290, 180, 190, 6); g.fill();
  g.fillStyle = lg(g, 0, 306, 0, 464, [[0, '#6f8fd0'], [0.6, '#ffae80'], [1, '#ff7c60']]); g.fillRect(486, 306, 148, 158);
  g.fillStyle = '#ffe9b0'; g.beginPath(); g.arc(560, 430, 34, Math.PI, 0); g.fill(); g.fillStyle = '#5d4b8a'; g.fillRect(486, 430, 148, 34);
  // bed
  ellipseShadow(g, 560, 812, 340, 0.3);
  g.fillStyle = '#5f3f36'; rr(g, 230, 540, 54, 252, 10); g.fill();
  g.fillStyle = '#4a3029'; rr(g, 250, 748, 640, 44, 6); g.fill(); g.fillRect(256, 790, 22, 28); g.fillRect(852, 790, 22, 28);
  g.fillStyle = lg(g, 0, 690, 0, 750, [[0, '#f3edf8'], [1, '#d5cce2']]); rr(g, 276, 690, 604, 62, 16); g.fill();
  g.fillStyle = '#f6f0e4'; rr(g, 292, 656, 120, 48, 20); g.fill();
  g.fillStyle = lg(g, 0, 668, 0, 770, [[0, '#d5627e'], [1, '#a53e5c']]);
  g.beginPath(); g.moveTo(430, 700); g.quadraticCurveTo(520, 640, 640, 690); g.quadraticCurveTo(760, 668, 876, 700); g.lineTo(880, 770); g.lineTo(436, 774); g.quadraticCurveTo(410, 740, 430, 700); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(70,10,30,0.3)'; g.lineWidth = 3; g.beginPath(); g.moveTo(520, 700); g.quadraticCurveTo(560, 730, 540, 764); g.moveTo(690, 694); g.quadraticCurveTo(720, 730, 700, 768); g.stroke();
  // nightstand
  ellipseShadow(g, 955, 816, 66, 0.3);
  g.fillStyle = '#7a5238'; rr(g, 905, 714, 100, 102, 5); g.fill();
  g.fillStyle = '#9a6a48'; rr(g, 898, 706, 114, 14, 4); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.2)'; rr(g, 916, 736, 78, 44, 4); g.fill(); g.fillStyle = '#e1b36a'; g.beginPath(); g.arc(955, 758, 5, 0, TAU); g.fill();
}

function drawKitchen(g, lt) {
  // tile backsplash
  g.fillStyle = '#f4e6cd'; g.fillRect(1950, 500, 690, 235);
  g.strokeStyle = 'rgba(120,90,60,0.22)'; g.lineWidth = 2;
  for (let x = 1950; x <= 2640; x += 46) { g.beginPath(); g.moveTo(x, 500); g.lineTo(x, 735); g.stroke(); }
  for (let y = 500; y <= 735; y += 47) { g.beginPath(); g.moveTo(1950, y); g.lineTo(2640, y); g.stroke(); }
  // upper cabinets
  for (const cx of [1960, 2310]) {
    g.fillStyle = lg(g, 0, 210, 0, 470, [[0, '#c4825a'], [1, '#a76440']]); rr(g, cx, 210, 330, 260, 8); g.fill();
    g.strokeStyle = 'rgba(60,20,10,0.35)'; g.lineWidth = 3; rr(g, cx + 12, 224, 146, 232, 6); g.stroke(); rr(g, cx + 172, 224, 146, 232, 6); g.stroke();
    g.fillStyle = '#e8d6b0'; g.fillRect(cx + 140, 400, 8, 44); g.fillRect(cx + 182, 400, 8, 44);
  }
  // wall clock
  g.fillStyle = '#fff6e4'; g.beginPath(); g.arc(2745, 330, 44, 0, TAU); g.fill(); g.strokeStyle = '#4a3a30'; g.lineWidth = 6; g.stroke();
  g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(2745, 330); g.lineTo(2745, 300); g.moveTo(2745, 330); g.lineTo(2764, 340); g.stroke(); g.lineCap = 'butt';
  // fridge
  ellipseShadow(g, 1830, 816, 100, 0.25);
  g.fillStyle = lg(g, 1740, 0, 1920, 0, [[0, '#d7ece8'], [1, '#a9c9c4']]); rr(g, 1740, 350, 180, 468, 14); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(1744, 560, 172, 5);
  g.fillStyle = '#8fa8a4'; rr(g, 1886, 400, 10, 90, 4); g.fill(); rr(g, 1886, 590, 10, 120, 4); g.fill();
  g.fillStyle = '#ff7a59'; g.beginPath(); g.arc(1790, 450, 12, 0, TAU); g.fill(); g.fillStyle = '#ffd23f'; g.fillRect(1815, 470, 24, 20);
  // base cabinets + counter
  ellipseShadow(g, 2295, 818, 360, 0.25);
  g.fillStyle = lg(g, 0, 735, 0, 818, [[0, '#9a6642'], [1, '#774a2e']]); g.fillRect(1950, 735, 690, 83);
  g.strokeStyle = 'rgba(30,10,5,0.4)'; g.lineWidth = 3;
  for (const xx of [2120, 2292, 2464]) { g.beginPath(); g.moveTo(xx, 750); g.lineTo(xx, 818); g.stroke(); }
  g.fillStyle = '#e8d6b0'; for (const xx of [2096, 2144, 2268, 2316, 2440, 2488]) g.fillRect(xx, 758, 6, 26);
  g.fillStyle = lg(g, 0, 735, 0, 752, [[0, '#f2eee6'], [1, '#cdc5b6']]); rr(g, 1940, 733, 702, 18, 4); g.fill();
  // coffee machine
  g.fillStyle = '#2f2a36'; rr(g, 2232, 604, 106, 130, 10); g.fill();
  g.fillStyle = '#d7433f'; rr(g, 2232, 604, 106, 26, 10); g.fill();
  g.fillStyle = '#0d0b14'; rr(g, 2250, 652, 70, 56, 6); g.fill();
  g.fillStyle = 'rgba(160,210,255,0.35)'; rr(g, 2254, 656, 28, 48, 4); g.fill();
  g.fillStyle = '#7fe9ff'; g.beginPath(); g.arc(2318, 618, 4, 0, TAU); g.fill();
  // doorway to living room
  g.fillStyle = 'rgba(30,18,24,0.35)'; g.fillRect(2800, 360, 100, 432);
  // pendant lamp
  g.strokeStyle = '#2a2230'; g.lineWidth = 3; g.beginPath(); g.moveTo(2440, -320); g.lineTo(2440, 140); g.stroke();
  g.fillStyle = '#e6a63a'; g.beginPath(); g.moveTo(2400, 190); g.lineTo(2480, 190); g.lineTo(2466, 138); g.lineTo(2414, 138); g.closePath(); g.fill();
  g.save(); g.globalCompositeOperation = 'lighter'; glow(g, 2440, 200, 260, '255,200,120', 0.16); g.restore();
}

function drawLiving(g, lt) {
  // window
  g.fillStyle = '#f2e8d6'; rr(g, 3694, 224, 214, 254, 8); g.fill();
  g.fillStyle = lg(g, 0, 236, 0, 466, [[0, '#7fb5e8'], [1, '#d6eeff']]); g.fillRect(3706, 236, 190, 230);
  g.fillStyle = '#f2e8d6'; g.fillRect(3796, 236, 8, 230); g.fillRect(3706, 346, 190, 8);
  // painting
  g.fillStyle = '#5b3d2c'; rr(g, 3086, 350, 210, 160, 6); g.fill();
  g.fillStyle = lg(g, 0, 362, 0, 498, [[0, '#f0b36a'], [1, '#d65a4a']]); g.fillRect(3098, 362, 186, 136);
  g.fillStyle = '#2f5d72'; g.beginPath(); g.moveTo(3098, 498); g.lineTo(3160, 420); g.lineTo(3210, 470); g.lineTo(3250, 430); g.lineTo(3284, 498); g.closePath(); g.fill();
  // rug
  g.fillStyle = 'rgba(168,73,63,0.8)'; g.beginPath(); g.ellipse(3560, 905, 520, 72, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,230,200,0.3)'; g.lineWidth = 4; g.beginPath(); g.ellipse(3560, 905, 470, 58, 0, 0, TAU); g.stroke();
  // sofa
  ellipseShadow(g, 3185, 816, 190, 0.3);
  g.fillStyle = '#d4902f'; rr(g, 3040, 650, 290, 140, 20); g.fill();
  g.fillStyle = '#e8a844'; rr(g, 3050, 735, 270, 62, 14); g.fill();
  g.fillStyle = '#bf7d24'; rr(g, 3024, 690, 52, 118, 16); g.fill(); rr(g, 3294, 690, 52, 118, 16); g.fill();
  g.fillStyle = '#4b2c25'; g.fillRect(3040, 800, 16, 18); g.fillRect(3314, 800, 16, 18);
  g.fillStyle = '#2f7f8c'; rr(g, 3090, 676, 66, 62, 14); g.fill();
  // lamp
  g.strokeStyle = '#2a2230'; g.lineWidth = 6; g.beginPath(); g.moveTo(3392, 818); g.lineTo(3392, 470); g.stroke();
  g.fillStyle = '#f6e3b4'; g.beginPath(); g.moveTo(3350, 480); g.lineTo(3434, 480); g.lineTo(3416, 420); g.lineTo(3368, 420); g.closePath(); g.fill();
  g.save(); g.globalCompositeOperation = 'lighter'; glow(g, 3392, 470, 220, '255,210,140', 0.2); g.restore();
  // coffee table
  ellipseShadow(g, 3500, 818, 100, 0.3);
  g.fillStyle = '#6b4a32'; rr(g, 3426, 764, 150, 14, 5); g.fill(); g.fillRect(3438, 776, 10, 42); g.fillRect(3556, 776, 10, 42);
  g.fillStyle = '#2f7f8c'; g.fillRect(3460, 754, 46, 10); g.fillStyle = '#d65a4a'; g.fillRect(3466, 746, 36, 8);
  // dining table
  ellipseShadow(g, 3756, 818, 150, 0.3);
  g.fillStyle = '#8a5c3a'; rr(g, 3625, 746, 270, 16, 6); g.fill(); g.fillRect(3640, 760, 14, 58); g.fillRect(3866, 760, 14, 58);
  g.fillStyle = '#d7b890'; rr(g, 3925, 690, 18, 128, 6); g.fill(); g.fillRect(3925, 770, 70, 14); g.fillRect(3980, 780, 12, 38);
  // bookshelf
  g.fillStyle = '#6a4630'; rr(g, 4040, 420, 220, 398, 8); g.fill();
  for (let r = 0; r < 4; r++) {
    const y = 440 + r * 94; g.fillStyle = '#3d281c'; g.fillRect(4054, y + 76, 192, 8);
    let x = 4060; for (let i = 0; i < 8; i++) { const w = 14 + hash1(i * 7 + r * 3) * 14, h = 44 + hash1(i * 3 + r) * 28; g.fillStyle = ['#d65a4a', '#2f7f8c', '#e8a844', '#8a6fbf', '#5fb07a'][(i + r) % 5]; g.fillRect(x, y + 76 - h, w, h); x += w + 2; }
  }
}

// foreground silhouettes (parallax 1.35) so every interior shot has a depth element
function drawRoomForeground(g, cam) {
  const P = 1.35, zs = 1 + (cam.z - 1) * (0.25 + 0.75 * P), oy = 540 + (cam.y - 540) * P;
  const base = oy + 560 / zs;
  withLayer(g, cam, P, () => {
    const spots = [[903, 1], [3920, -1], [5230, 1], [-40, -1]];
    for (const sp of spots) {
      const X = sp[0], d = sp[1];
      g.save(); g.translate(X, base); g.scale(d, 1);
      g.fillStyle = 'rgba(14,8,20,0.93)';
      rr(g, -30, -150, 60, 150, 10); g.fill();
      for (let i = 0; i < 7; i++) {
        const a = -2.3 + i * 0.55, L = 190 + 60 * hash1(i + 4);
        g.save(); g.translate(0, -140); g.rotate(a + Math.PI / 2 * 0); g.beginPath();
        g.moveTo(0, 0); g.quadraticCurveTo(L * 0.4, -34, L, 0); g.quadraticCurveTo(L * 0.4, 30, 0, 0); g.fill(); g.restore();
      }
      g.strokeStyle = 'rgba(255,160,90,0.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(28, -148); g.lineTo(28, -6); g.stroke();
      g.restore();
    }
  });
}

// ---------------------------------------------------------------- props
function drawClock(g, x, y, o) { // base centre (x, y bottom). o: gh alpha(0=real), ring 0..1, shake px
  const gh = o.gh || 0, sx = (o.shake || 0);
  g.save(); g.translate(x + sx, y);
  const col = (c) => c;
  // bells
  for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 17, -64, 12, Math.PI, 0); g.closePath(); if (gh) gp(g, gh); else { g.fillStyle = '#e1b150'; g.fill(); g.strokeStyle = '#8a6a22'; g.lineWidth = 2; g.stroke(); } }
  g.strokeStyle = gh ? `rgba(205,251,255,${gh})` : '#6e5a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -72); g.lineTo(0, -64); g.moveTo(-10, -70); g.lineTo(10, -70); g.stroke();
  // legs
  g.beginPath(); g.moveTo(-18, -4); g.lineTo(-26, 4); g.moveTo(18, -4); g.lineTo(26, 4); g.lineWidth = 5; g.lineCap = 'round'; g.strokeStyle = gh ? `rgba(205,251,255,${gh})` : '#5a4a3a'; g.stroke();
  // body
  g.beginPath(); g.arc(0, -32, 29, 0, TAU);
  if (gh) gp(g, gh, 0.5); else { g.fillStyle = lg(g, -20, -60, 20, -4, [[0, '#f3b9a8'], [1, '#d0674f']]); g.fill(); g.strokeStyle = '#7a3425'; g.lineWidth = 2.5; g.stroke(); }
  g.beginPath(); g.arc(0, -32, 21, 0, TAU); g.fillStyle = gh ? `rgba(240,255,255,${0.75 * gh})` : '#fff8ea'; g.fill();
  g.strokeStyle = gh ? `rgba(8,50,130,${gh})` : '#3a2a28'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, -32); g.lineTo(0, -48); g.moveTo(0, -32); g.lineTo(11, -26); g.stroke();
  g.restore();
  // ring arcs
  if (o.ring > 0.01) {
    g.save(); g.translate(x, y - 40); g.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const ph = ((o.time * 3.2 + k / 3) % 1), r = 42 + ph * 44, a = (1 - ph) * o.ring;
      for (const s of [-1, 1]) { g.strokeStyle = gh ? `rgba(190,250,255,${a * 0.9})` : `rgba(255,200,100,${a * 0.9})`; g.lineWidth = 4 - ph * 2; g.beginPath(); g.arc(0, 0, r, s > 0 ? -0.9 : Math.PI - 0.9 + 0.0, s > 0 ? 0.9 : Math.PI + 0.9); g.stroke(); }
    }
    g.restore();
  }
}

function mugPose(u, G, vx0) { // u = seconds since slide start. returns {cx, cy, rot, phase}
  const PX = 2640, PY = 735;
  if (u < 0) return { cx: 2455, cy: 715, rot: 0, ph: 0 };
  if (u < 0.85) { const k = smooth(u / 0.85); return { cx: lerp(2455, 2623, k) + Math.sin(u * 60) * 0.8 * (1 - k), cy: 715, rot: 0, ph: 1 }; }
  const a = 0.55 * smooth((u - 0.85) / 0.3);
  const cr = (aa) => ({ x: PX + (-17) * Math.cos(aa) - (-20) * Math.sin(aa), y: PY + (-17) * Math.sin(aa) + (-20) * Math.cos(aa) });
  if (u < 1.15) { const p = cr(a); return { cx: p.x, cy: p.y, rot: a, ph: 2 }; }
  const p0 = cr(0.55), t = u - 1.15;
  return { cx: p0.x + vx0 * t, cy: p0.y + 0.5 * G * t * t, rot: 0.55 + 2.4 * t, ph: 3, t };
}
function drawMug(g, cx, cy, rot, gh, steam, time) {
  g.save(); g.translate(cx, cy); g.rotate(rot);
  g.lineCap = 'round';
  g.beginPath(); g.arc(-17, 0, 10, Math.PI * 0.5, Math.PI * 1.5);
  if (gh) { g.strokeStyle = `rgba(8,50,130,${0.5 * gh})`; g.lineWidth = 9; g.stroke(); g.strokeStyle = `rgba(205,251,255,${gh})`; g.lineWidth = 4; g.stroke(); } else { g.strokeStyle = '#1f8f84'; g.lineWidth = 6; g.stroke(); }
  rr(g, -17, -20, 34, 40, 6);
  if (gh) gp(g, gh, 0.5); else { g.fillStyle = lg(g, -17, 0, 17, 0, [[0, '#35c3b4'], [0.6, '#27a699'], [1, '#1b7f76']]); g.fill(); g.strokeStyle = 'rgba(10,40,40,0.5)'; g.lineWidth = 1.5; g.stroke(); }
  if (!gh) { g.fillStyle = 'rgba(255,255,255,0.35)'; rr(g, -12, -15, 5, 26, 2); g.fill(); g.fillStyle = '#3a2112'; g.beginPath(); g.ellipse(0, -18, 14, 4, 0, 0, TAU); g.fill(); }
  g.restore();
  if (steam > 0.01) {
    g.save(); g.strokeStyle = `rgba(255,255,255,${0.5 * steam})`; g.lineWidth = 3.4; g.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const x0 = cx - 8 + i * 8, ph = time * 2.2 + i * 1.7; g.beginPath(); g.moveTo(x0, cy - 24); g.bezierCurveTo(x0 + 8 * Math.sin(ph), cy - 40, x0 - 8 * Math.sin(ph + 1), cy - 52, x0 + 5 * Math.sin(ph + 2), cy - 70); g.stroke(); }
    g.restore();
  }
}
function shards(g, x, y, u, n, seed, col, g0) { // deterministic burst
  if (u < 0 || u > 0.9) return;
  g.save(); g.globalCompositeOperation = col ? 'lighter' : 'source-over';
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * (0.1 + 0.8 * hash1(seed + i * 3)), v = 120 + 320 * hash1(seed + i * 3 + 1), sz = 4 + 7 * hash1(seed + i * 3 + 2);
    const px = x + Math.cos(a) * v * u + (hash1(seed + i) - 0.5) * 30 * u, py = y + Math.sin(a) * v * u + 0.5 * (g0 || 1500) * u * u;
    if (py > 826) continue;
    g.globalAlpha = clamp(1 - u / 0.9); g.fillStyle = col || (i % 3 === 0 ? '#27a699' : i % 3 === 1 ? '#f4efe6' : '#3a2112');
    g.save(); g.translate(px, py); g.rotate(u * 9 * (i % 2 ? 1 : -1) + i); g.beginPath(); g.moveTo(-sz, -sz * 0.5); g.lineTo(sz, -sz * 0.2); g.lineTo(sz * 0.2, sz * 0.7); g.closePath(); g.fill(); g.restore();
  }
  g.restore();
}

function drawCarton(g, cx, cy, rot, gh) { // centre origin, 30 x 46 body
  g.save(); g.translate(cx, cy); g.rotate(rot);
  g.beginPath(); g.moveTo(-15, 23); g.lineTo(15, 23); g.lineTo(15, -23); g.lineTo(11, -34); g.lineTo(-11, -34); g.lineTo(-15, -23); g.closePath();
  if (gh) gp(g, gh, 0.5);
  else {
    g.fillStyle = lg(g, -15, 0, 15, 0, [[0, '#ffffff'], [1, '#d6def2']]); g.fill(); g.strokeStyle = 'rgba(30,40,80,0.5)'; g.lineWidth = 1.6; g.stroke();
    g.fillStyle = '#3b7bd4'; g.fillRect(-15, -6, 30, 20);
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -3); g.quadraticCurveTo(7, 6, 0, 11); g.quadraticCurveTo(-7, 6, 0, -3); g.fill();
    g.fillStyle = '#e8eefc'; g.beginPath(); g.moveTo(-11, -34); g.lineTo(0, -44); g.lineTo(11, -34); g.closePath(); g.fill(); g.stroke();
  }
  g.restore();
}

// ---------------------------------------------------------------- bus
function drawBus(g, xc, gy, s, o) {
  const gh = o.gh || 0, open = o.door || 0;
  g.save(); g.translate(xc, gy); g.scale(s, s);
  if (!gh) { g.fillStyle = 'rgba(10,5,20,0.4)'; g.beginPath(); g.ellipse(0, -2, 410, 12, 0, 0, TAU); g.fill(); }
  const WIN = [-350, -255, -160, -65, 30, 125];
  rr(g, -380, -300, 760, 254, 28);
  if (gh) gp(g, gh, 0.38);
  else {
    g.fillStyle = lg(g, 0, -300, 0, -46, [[0, '#ffa63f'], [0.6, '#f27d1f'], [1, '#cf5d1a']]); g.fill();
    g.fillStyle = '#ffd9a0'; g.fillRect(-380, -178, 760, 12);
    g.fillStyle = 'rgba(80,30,10,0.22)'; g.fillRect(-380, -120, 760, 74);
    g.fillStyle = '#c9c2d8'; rr(g, -210, -318, 170, 20, 6); g.fill();
    g.strokeStyle = 'rgba(255,179,107,0.85)'; g.lineWidth = 4; g.beginPath(); g.moveTo(372, -280); g.lineTo(378, -80); g.stroke();
  }
  for (let i = 0; i < WIN.length; i++) {
    g.save(); rr(g, WIN[i], -262, 80, 74, 10);
    if (gh) { g.restore(); g.save(); rr(g, WIN[i], -262, 80, 74, 10); gp(g, gh, 0.25); g.restore(); continue; }
    g.fillStyle = lg(g, 0, -262, 0, -188, [[0, '#46567e'], [1, '#222a46']]); g.fill(); g.clip();
    if (hash1(i * 5 + 3) > 0.3) { const px = WIN[i] + 24 + hash1(i) * 32; g.fillStyle = '#0f1220'; g.beginPath(); g.arc(px, -224, 11, 0, TAU); g.fill(); rr(g, px - 17, -213, 34, 34, 10); g.fill(); }
    g.fillStyle = 'rgba(255,200,150,0.2)'; g.beginPath(); g.moveTo(WIN[i] + 6, -262); g.lineTo(WIN[i] + 36, -262); g.lineTo(WIN[i] + 6, -188); g.closePath(); g.fill();
    g.restore();
  }
  // door
  const DX = 222, DW = 70;
  if (!gh) {
    g.fillStyle = lg(g, 0, -262, 0, -48, [[0, '#ffe4a8'], [1, '#e8a85a']]); g.fillRect(DX, -262, DW, 214);
    g.fillStyle = 'rgba(60,30,10,0.5)'; for (const yy of [-92, -72, -54]) g.fillRect(DX, yy, DW, 3);
    g.fillStyle = '#c9c2d8'; g.fillRect(DX + 46, -262, 5, 214);
    const pw = (DW / 2) * (1 - open);
    for (const side of [0, 1]) {
      const px = side ? DX + DW - pw : DX;
      g.fillStyle = lg(g, 0, -262, 0, -48, [[0, '#f58a2b'], [1, '#cf5d1a']]); g.fillRect(px, -262, pw, 214);
      g.fillStyle = 'rgba(40,52,86,0.9)'; g.fillRect(px + 3, -250, Math.max(0, pw - 6), 118);
    }
    g.strokeStyle = 'rgba(60,25,8,0.6)'; g.lineWidth = 2.5; g.strokeRect(DX, -262, DW, 214);
  } else {
    rr(g, DX, -262, DW, 214, 4); gp(g, gh, open > 0.5 ? 0.12 : 0.35);
  }
  // windshield + sign + lamp
  rr(g, 305, -268, 70, 120, 12);
  if (gh) gp(g, gh, 0.25); else { g.fillStyle = lg(g, 0, -268, 0, -148, [[0, '#51628c'], [1, '#232b48']]); g.fill(); g.fillStyle = '#0f1220'; g.beginPath(); g.arc(340, -214, 12, 0, TAU); g.fill(); rr(g, 324, -203, 34, 40, 10); g.fill(); }
  if (!gh) {
    g.fillStyle = '#0d0b14'; rr(g, 300, -294, 76, 18, 3); g.fill(); g.fillStyle = '#ff9a2a'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(310 + i * 11, -285, 3, 0, TAU); g.fill(); }
    g.fillStyle = '#fff2c4'; g.beginPath(); g.ellipse(372, -96, 8, 15, 0, 0, TAU); g.fill();
    g.save(); g.globalCompositeOperation = 'lighter'; glow(g, 380, -96, 90, '255,230,170', 0.35); g.restore();
    g.fillStyle = '#8b829e'; rr(g, 356, -68, 32, 20, 6); g.fill();
  }
  // wheels
  for (const wx of [-235, 235]) {
    g.beginPath(); g.arc(wx, -44, 54, 0, TAU);
    if (gh) { g.fillStyle = `rgba(8,40,120,${0.5 * gh})`; g.fill(); } else { g.fillStyle = '#0b0810'; g.fill(); }
    g.beginPath(); g.arc(wx, -44, 46, 0, TAU);
    if (gh) gp(g, gh, 0.5); else { g.fillStyle = '#14101c'; g.fill(); g.fillStyle = '#c9c2d8'; g.beginPath(); g.arc(wx, -44, 24, 0, TAU); g.fill(); g.fillStyle = '#6a6280'; for (let k = 0; k < 5; k++) { const a = (o.wheel || 0) + k * TAU / 5; g.beginPath(); g.arc(wx + Math.cos(a) * 14, -44 + Math.sin(a) * 14, 3.5, 0, TAU); g.fill(); } g.beginPath(); g.arc(wx, -44, 6, 0, TAU); g.fill(); }
  }
  g.restore();
}

// ---------------------------------------------------------------- skateboard (riderless)
function drawBoard(g, x, y, gh, wheel, tilt, speedLines) {
  g.save(); g.translate(x, y);
  if (speedLines > 0.01) {
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const L = (160 + 260 * hash1(i * 5)) * speedLines, yy = -8 - 36 * hash1(i * 5 + 1), x0 = 90 + 40 * hash1(i * 5 + 2);
      const gr = g.createLinearGradient(x0, 0, x0 + L, 0); gr.addColorStop(0, gh ? `rgba(160,240,255,${0.7 * gh})` : 'rgba(255,240,210,0.65)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = gr; g.lineWidth = 2 + 3 * hash1(i * 5 + 3); g.beginPath(); g.moveTo(x0, yy); g.lineTo(x0 + L, yy); g.stroke();
    }
    g.restore();
  }
  g.rotate(tilt || 0);
  if (!gh) ellipseShadow(g, 0, 14, 90, 0.35);
  g.beginPath(); g.moveTo(-96, -48); g.lineTo(-80, -33); g.lineTo(80, -33); g.lineTo(96, -48); g.lineTo(98, -48); g.lineTo(82, -24); g.lineTo(-82, -24); g.lineTo(-98, -48); g.closePath();
  if (gh) gp(g, gh, 0.5); else { g.fillStyle = lg(g, 0, -34, 0, -24, [[0, '#33efb0'], [1, '#14a37a']]); g.fill(); g.strokeStyle = '#08382c'; g.lineWidth = 1.5; g.stroke(); g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(-80, -34, 160, 3); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(0, -29, 5, 0, TAU); g.fill(); }
  for (const wx of [-52, 52]) {
    g.beginPath(); g.rect(wx - 11, -24, 22, 6); if (gh) gp(g, gh, 0.5); else { g.fillStyle = '#b8b0c8'; g.fill(); }
    g.beginPath(); g.arc(wx, -13, 13, 0, TAU);
    if (gh) gp(g, gh, 0.55); else { g.fillStyle = '#ffd23f'; g.fill(); g.strokeStyle = '#8a6a12'; g.lineWidth = 1.5; g.stroke(); g.strokeStyle = '#8a6a12'; g.lineWidth = 2; const a = wheel; g.beginPath(); g.moveTo(wx, -13); g.lineTo(wx + Math.cos(a) * 10, -13 + Math.sin(a) * 10); g.stroke(); }
  }
  g.restore();
}

// ---------------------------------------------------------------- icons
function checkIcon(g, x, y, r, pop, t) {
  if (pop <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(pop, pop);
  glow(g, 0, 0, r * 2, '90,255,170', 0.35);
  g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fillStyle = lg(g, 0, -r, 0, r, [[0, '#6bf0a6'], [1, '#1fb86c']]); g.fill(); g.strokeStyle = '#d9ffe9'; g.lineWidth = 4; g.stroke();
  g.strokeStyle = '#fff'; g.lineWidth = r * 0.22; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(-r * 0.42, 0); g.lineTo(-r * 0.1, r * 0.32); g.lineTo(r * 0.46, -r * 0.32); g.stroke();
  g.restore();
  if (t > 0 && t < 0.5) { g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = `rgba(150,255,200,${0.7 * (1 - t / 0.5)})`; g.lineWidth = 5; g.beginPath(); g.arc(x, y, r * (1 + 1.8 * easeOut(t / 0.5)), 0, TAU); g.stroke(); g.restore(); }
}
function clover(g, x, y, r, pop, t) {
  if (pop <= 0.01) return;
  g.save(); g.translate(x, y + Math.sin(t * 3) * 5); g.scale(pop, pop); g.rotate(0.15 * Math.sin(t * 2));
  glow(g, 0, 0, r * 3, '120,255,150', 0.38);
  for (let i = 0; i < 4; i++) {
    g.save(); g.rotate(i * Math.PI / 2 + Math.PI / 4); g.translate(0, -r * 0.55);
    g.beginPath(); g.moveTo(0, r * 0.45); g.bezierCurveTo(-r * 0.9, -r * 0.1, -r * 0.5, -r * 0.8, 0, -r * 0.3); g.bezierCurveTo(r * 0.5, -r * 0.8, r * 0.9, -r * 0.1, 0, r * 0.45); g.closePath();
    g.fillStyle = lg(g, 0, -r * 0.6, 0, r * 0.4, [[0, '#8dff9e'], [1, '#1fa04a']]); g.fill(); g.strokeStyle = '#d5ffd9'; g.lineWidth = 2.4; g.stroke(); g.restore();
  }
  g.strokeStyle = '#2f8a46'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, r * 0.2); g.quadraticCurveTo(r * 0.3, r * 0.9, r * 0.1, r * 1.3); g.stroke();
  g.restore();
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) { const ph = (t * 1.4 + i / 5) % 1, a = Math.sin(ph * Math.PI); glow(g, x + (hash1(i * 4) - 0.5) * r * 3, y - r * 0.2 - ph * r * 1.6, 9 + 5 * hash1(i), '255,250,190', 0.7 * a * pop); }
  g.restore();
}
function starburst(g, x, y, r, rot, a) {
  g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = a;
  g.beginPath(); for (let i = 0; i < 16; i++) { const rad = i % 2 ? r * 0.5 : r; const an = i * Math.PI / 8; g.lineTo(Math.cos(an) * rad, Math.sin(an) * rad); } g.closePath();
  g.fillStyle = '#fff2a0'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#ff7a3a'; g.lineJoin = 'round'; g.stroke();
  g.restore();
}
function footprint(g, x, y, pop, flip, a) {
  if (pop <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(pop * 2.0, pop * 2.0 * 0.6); g.rotate(flip * 0.1);
  g.globalCompositeOperation = 'lighter';
  glow(g, 0, 0, 40, '90,200,255', 0.22 * a);
  g.fillStyle = `rgba(120,225,255,${0.9 * a})`;
  g.beginPath(); g.ellipse(0, 6, 11, 20, 0, 0, TAU); g.fill();
  for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-9 + i * 6, -19 - (i === 0 ? 0 : (i === 3 ? 0 : -2)), 3.4, 0, TAU); g.fill(); }
  g.restore();
}
function confetti(g, x0, y0, u, time) {
  if (u < 0) return;
  const COL = ['#ff4d6d', '#ffd23f', '#3ee0b0', '#5aa9ff', '#c77dff', '#ff9a3c'];
  for (let i = 0; i < 70; i++) {
    const a = -Math.PI / 2 + (hash1(i * 5) - 0.5) * 2.1, v = 260 + 520 * hash1(i * 5 + 1);
    const dr = Math.exp(-u * 1.6);
    const px = x0 + Math.cos(a) * v * (1 - dr) / 1.6 + Math.sin(u * 3 + i) * 14 * (1 - dr);
    const py = y0 + Math.sin(a) * v * (1 - dr) / 1.6 + 220 * u + 260 * u * u * 0.5 * (1 - dr * 0.4);
    const al = clamp(1 - (u - 2.4) / 1.2); if (al <= 0) continue;
    const flip = Math.cos(u * (6 + 6 * hash1(i * 5 + 2)) + i);
    g.save(); g.globalAlpha = al; g.translate(px, py); g.rotate(u * 3 * (hash1(i) - 0.5) * 4 + i);
    g.fillStyle = COL[i % 6]; g.fillRect(-6, -3 * Math.abs(flip) - 0.8, 12, 6 * Math.abs(flip) + 1.6); g.restore();
  }
}

// ---------------------------------------------------------------- timing tables (street hero)
function vD(t) {
  const V = 190;
  if (t < 15.95) return 187;
  if (t < 16.5) return 187 * (1 - smooth((t - 15.95) / 0.2));
  if (t < 16.9) return V * smooth((t - 16.5) / 0.4);
  if (t < 18.4) return V;
  if (t < 19.0) return V * 0.65;
  if (t < 19.45) return V * 0.65 * (1 - smooth((t - 19.0) / 0.45));
  if (t < 20.6) return 0;
  if (t < 21.1) return 170 * smooth((t - 20.6) / 0.5);
  if (t < 25.4) return 170;
  if (t < 26.1) return 170 * (1 - smooth((t - 25.4) / 0.7));
  return 0;
}
let XD = null;
function xD(t) {
  if (!XD) {
    const dt = 1 / 120, n = Math.ceil((28 - CUT) / dt) + 2; XD = new Float32Array(n); XD[0] = 981.3;
    for (let i = 1; i < n; i++) XD[i] = XD[i - 1] + 0.5 * (vD(CUT + (i - 1) * dt) + vD(CUT + i * dt)) * dt;
  }
  const f = clamp((t - CUT) / (1 / 120), 0, XD.length - 2), i = Math.floor(f);
  return lerp(XD[i], XD[i + 1], f - i);
}
const xStraight = (t) => 1280.5 + 190 * rampInt(t - 16.5, 0.4);
function yD(t) {
  const lane = lerp(868, 820, smooth((t - 16.5) / 1.0));
  const side = smooth((t - 18.4) / 0.45), back = smooth((t - 20.6) / 1.2);
  return lane - 30 * side * (1 - back) - 0;
}
const BUS_STOP = 1061;
const busX = (t) => BUS_STOP - 1000 * Math.pow(1 - clamp((t - 14.85) / 1.1), 2);
const ghostBusX = (t) => BUS_STOP + 1700 * easeIn((t - 14.7) / 0.5);
const busOut = (t) => BUS_STOP + 4200 * easeIn((t - 16.65) / 0.95);
const doorOpen = (t) => smooth((t - 15.85) / 0.25) * (1 - smooth((t - 16.45) / 0.2));

// ---------------------------------------------------------------- heroes
function base() { return { x: 0, walk: 0, phone: 0, headDown: 0, lean: 0.04, bob: 1, eyeOpen: 1, eyeGlow: 0, flutter: 0, step: 0, phase: 0 }; }
const GHOST_COL = palGhost;

function heroA(lt, pal) {
  const c = base(); c.x = 1030; c.phase = c.x / STRIDE;
  c.eyeOpen = clamp(spring(lt - 0.45, 200, 22));
  c.eyeGlow = clamp(spring(lt - 1.6, 160, 20)) * (1 - 0.5 * smooth((lt - 3.2) / 1));
  const ks = win(lt, 0.3, 1.6, 0.5, 0.5), kc = smooth((lt - 3.5) / 0.35) * (1 - smooth((lt - 4.2) / 0.35));
  c.lean = 0.02 - 0.12 * ks + 0.1 * kc; c.flutter = 0.15 * kc;
  const st = walkerSt(c, { x: 1030, y: 820, s: HS, facing: -1, pal: pal || PAL_REAL });
  reach(st, st.x - 14, 820 - 236, ks, false); reach(st, st.x + 8, 820 - 236, ks, true);
  const slap = smooth((lt - 3.92) / 0.07);
  reach(st, lerp(968 + 38, 968 + 2, slap), lerp(640, 648, slap), kc, false);
  return st;
}
function xB(lt) { return 2340 + 230 * easeIO((lt - 8.55) / 0.7); }
function heroB(lt, pal, mug) {
  const c = base(); const x = xB(lt); c.x = x; c.phase = x / STRIDE;
  c.walk = smooth((lt - 8.55) / 0.12) * (1 - smooth((lt - 9.3) / 0.3));
  c.lean = 0.06 + 0.32 * smooth((lt - 8.5) / 0.5) * (1 - smooth((lt - 9.45) / 0.5));
  c.eyeGlow = clamp(spring(lt - 5.95, 160, 20)) * (1 - smooth((lt - 9.8) / 0.8));
  c.headDown = 0.14 * win(lt, 5.9, 8.4, 0.3, 0.3);
  const st = walkerSt(c, { x, y: 820, s: HS, facing: 1, pal: pal || PAL_REAL });
  const rk = smooth((lt - 4.9) / 0.45) * (1 - 0.4 * smooth((lt - 6.1) / 0.5));
  reach(st, 2441, 722, rk * (1 - smooth((lt - 8.6) / 0.2)), false);
  if (lt >= 8.6) {
    const ks = smooth((lt - 10.0) / 0.5);
    const T = mug && lt < 9.28 ? { x: mug.cx, y: mug.cy } : { x: lerp(2662, x + 24, ks), y: lerp(758, 662, ks) };
    reach(st, T.x, T.y, smooth((lt - 8.6) / 0.25), false);
  }
  return st;
}
function xC(lt) { return 3158 + 160 * (lt - 11.3); }
function heroC(lt, pal) {
  const c = base(); const x = xC(lt); c.x = x; c.phase = x / STRIDE; c.walk = smooth((lt - 11.3) / 0.1) + 0; c.walk = 1; c.lean = 0.1; c.flutter = 0.25;
  c.eyeGlow = 0.6 * (win(lt, 11.9, 12.9, 0.2, 0.3) + win(lt, 13.2, 14.3, 0.2, 0.3));
  const st = walkerSt(c, { x, y: 852, s: HS, facing: 1, pal: pal || PAL_REAL });
  const k = win(lt, 13.98, 14.34, 0.1, 0.12);
  reach(st, 3660, 722, k, false);
  return st;
}
function heroD(lt, pal) {
  const c = base(); const x = xD(lt), v = vD(lt); c.x = x; c.phase = x / STRIDE;
  c.walk = clamp(v / 120);
  const strut = smooth((lt - 22.0) / 0.45) * (1 - smooth((lt - 25.4) / 0.6));
  c.bob = 1 + 0.7 * strut; c.lean = 0.08 - 0.1 * strut + 0.05 * win(lt, 18.4, 18.9, 0.1, 0.2); c.flutter = 0.2 + 0.4 * strut;
  c.eyeGlow = clamp(spring(lt - 25.6, 140, 18)) + 0.35 * win(lt, 15.9, 17.0, 0.2, 0.4);
  c.headDown = 0.03;
  let y = yD(lt);
  if (lt >= 18.4 && lt < 18.85) y -= 15 * Math.abs(Math.sin(Math.PI * (lt - 18.4) / 0.15));
  const st = walkerSt(c, { x, y, s: HS, facing: 1, pal: pal || PAL_REAL });
  return st;
}
function heroFrame(lt, pal, mug) {
  if (lt < CUT - 3.3) return lt < 4.8 ? heroA(lt, pal) : heroB(lt, pal, mug);
  return null;
}

// ---------------------------------------------------------------- camera
function camAt(lt, hxd) {
  let cam;
  if (lt < CUT) {
    const A = { x: 1135, y: 615, z: 1.28 + 0.08 * clamp(lt / 4) + (lt >= 3.95 ? 0.22 * Math.exp(-(lt - 3.95) * 7) : 0) };
    const zin = smooth((lt - 8.5) / 0.7), zout = smooth((lt - 9.6) / 1.0);
    const B = { x: 2475 + 0.5 * (xB(lt) - 2340), y: 640 + 60 * zin - 40 * zout, z: 1.25 + 0.55 * zin - 0.3 * zout };
    const C = { x: xC(lt) + 170, y: 650, z: 1.14 + 0.02 * (lt - 11.3) };
    if (lt < 11.0) cam = mixCam(A, B, easeIO((lt - 4.3) / 0.45));
    else cam = mixCam(B, C, easeIO((lt - 11.0) / 0.4));
  } else {
    const hx = hxd;
    const off = lerp(260, 300, smooth((lt - 21.5) / 1.5)) + 40 * smooth((lt - 25.5) / 1.5);
    const fx = lerp(1140, hx + 260, smooth((lt - 16.3) / 1.4));
    const strut = smooth((lt - 22.1) / 0.5) * (1 - smooth((lt - 25.5) / 0.8));
    const tail = smooth((lt - 25.5) / 2.3);
    cam = { x: lt < 16.3 ? 1140 : fx + (off - 260) * (lt > 21 ? 1 : 0), y: lerp(650, 705, strut) - 55 * tail * (1 - strut) + 0 * tail, z: 1.2 + 0.18 * strut + 0.03 * smooth((lt - 18.5) / 2) - 0.2 * tail };
    cam.y = lerp(cam.y, 640 - 20 * tail, tail);
    if (lt >= 22.1) cam.y -= 0;
  }
  const sk = shakeAt(lt, 3.95, 9, 11), sk2 = shakeAt(lt, 9.28, 13, 9), sk3 = shakeAt(lt, 7.46, 4, 14), sk4 = shakeAt(lt, 19.5, 6, 10), sk5 = shakeAt(lt, 12.25, 5, 12), sk6 = shakeAt(lt, 18.35, 5, 12);
  cam.x += sk.x + sk2.x + sk3.x + sk4.x + sk5.x + sk6.x; cam.y += sk.y + sk2.y + sk3.y + sk4.y + sk5.y + sk6.y;
  cam.r = (sk.r + sk2.r + sk4.r) * 1.0;
  return cam;
}

// ---------------------------------------------------------------- frame
function frame(g, lt, tw) {
  const W = 1920, H = 1080;
  const hxd = lt >= CUT ? xD(lt) : 0;
  const cam = camAt(lt, hxd);
  g.save();
  if (cam.r) { g.translate(W / 2, H / 2); g.rotate(cam.r); g.translate(-W / 2, -H / 2); }
  const inRoom = lt < CUT;

  // ---- backdrop
  if (inRoom) withLayer(g, cam, 1, () => drawRoom(g, cam, lt));
  else drawWorld(g, cam, tw);

  // ---- real props
  const mugR = mugPose(lt - 7.8, 900, 70), mugG = mugPose(lt - 6.0, 1800, 70);
  let heldMug = null;
  if (inRoom) {
    withLayer(g, cam, 1, () => {
      // A: alarm clock
      if (lt < 5.2 && cam.x < 2400) {
        const ring = lt >= 3.95 && lt < 4.2 ? 1 : 0, sh = ring ? Math.sin(lt * 140) * 2.6 * (1 - smooth((lt - 4.0) / 0.2)) : 0;
        drawClock(g, 968, 708, { gh: 0, ring: ring * (1 - smooth((lt - 4.0) / 0.2)), shake: sh, time: lt });
        // dust motes in the dawn light
        g.save(); g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 16; i++) {
          const hx = hash1(i * 3), hy = hash1(i * 3 + 1), hz = hash1(i * 3 + 2);
          const px = 760 + hx * 520 + Math.sin(lt * (0.5 + hz) + i) * 18, py = 560 + (((hy - lt * (0.03 + 0.04 * hz)) % 1) + 1) % 1 * 420;
          glow(g, px, py, 5 + hz * 5, '255,225,170', 0.4 * (0.4 + 0.6 * Math.sin(lt * 1.7 + i) ** 2));
        }
        g.restore();
      }
      // B: real mug + steam
      if (cam.x > 1500 && cam.x < 3500 && lt < 11.5) {
        const mp = mugR;
        if (lt < 9.28) drawMug(g, mp.cx, mp.cy, mp.rot, 0, mp.ph === 0 || mp.ph === 1 ? 1 : 0, lt);
      }
      // C: real carton
      if (cam.x > 3200 && lt < CUT) {
        const w = lt >= 13.95 ? -0.14 * Math.exp(-(lt - 13.95) * 3.4) * Math.sin((lt - 13.95) * 30) * (1 - smooth((lt - 14.05) / 0.07)) : 0;
        drawCarton(g, 3660, 727, w, 0);
      }
    });
  }
  if (!inRoom) {
    // bus (real)
    const bx = lt < 16.65 ? busX(lt) : busOut(lt);
    withLayer(g, cam, 1, () => {
      drawBus(g, bx, 868, 0.85, { gh: 0, door: doorOpen(lt), wheel: bx / 46 });
    });
  }

  // ---- vision grade
  let vg = 0;
  vg = Math.max(vg, 0.22 * win(lt, 1.9, 4.0, 0.3, 0.1), 0.22 * win(lt, 5.95, 7.7, 0.1, 0.25), 0.18 * win(lt, 11.5, 12.7, 0.2, 0.3), 0.18 * win(lt, 13.15, 14.35, 0.2, 0.2), 0.2 * win(lt, 14.45, 15.5, 0.05, 0.4), 0.2 * win(lt, 17.9, 18.5, 0.1, 0.2));
  if (vg > 0.005) visionGrade(g, vg);

  // ---- hero(es)
  const heroes = [];
  if (inRoom) {
    if (lt < 4.85) heroes.push(['A', heroA(lt)]);
    if (lt >= 4.2 && lt < 11.5) heroes.push(['B', heroB(lt, null, mugR)]);
    if (lt >= 10.9) heroes.push(['C', heroC(lt)]);
  } else heroes.push(['D', heroD(lt)]);

  // lunge afterimages (cyan trail)
  if (inRoom && lt >= 8.7 && lt < 9.5) {
    for (let k = 3; k >= 1; k--) {
      const lt2 = lt - 0.065 * k, sg = heroB(lt2, palGhost(0.34 - 0.08 * k), mugPose(lt2 - 7.8, 900, 70));
      withLayer(g, cam, 1, () => drawWalker(g, sg));
    }
  }
  for (const h of heroes) {
    const st = h[1];
    withLayer(g, cam, 1, () => {
      if (inRoom) ellipseShadow(g, st.x, st.y + 3, 46, 0.32);
      drawWalker(g, st);
    });
  }

  // ---- held / caught mug (follows the hand)
  if (inRoom && lt >= 9.28 && lt < 11.5) {
    const stB = heroes.find((h) => h[0] === 'B');
    if (stB) {
      const hj = walkerJoints(stB[1]);
      const mx = hj.handF.x + 11, my = hj.handF.y - 8;
      const pop = Math.exp(-(lt - 9.28) * 9) * Math.sin((lt - 9.28) * 50) * 4;
      withLayer(g, cam, 1, () => {
        drawMug(g, mx, my + pop, 0, 0, smooth((lt - 9.5) / 0.4), lt);
        // coffee splash
        const u = lt - 9.28;
        if (u < 0.5) {
          g.save();
          for (let i = 0; i < 10; i++) {
            const a = -Math.PI * (0.15 + 0.7 * hash1(i * 3)), v = 90 + 160 * hash1(i * 3 + 1);
            const px = mx + Math.cos(a) * v * u, py = my - 14 + Math.sin(a) * v * u + 700 * u * u;
            g.globalAlpha = 1 - u / 0.5; g.fillStyle = '#4a2a14'; g.beginPath(); g.arc(px, py, 3.4 - 2 * u, 0, TAU); g.fill();
          }
          g.restore();
          g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = `rgba(255,240,200,${0.7 * (1 - u / 0.5)})`; g.lineWidth = 5; g.beginPath(); g.arc(mx, my, 20 + 90 * easeOut(u / 0.5), 0, TAU); g.stroke(); g.restore();
        }
      });
    }
  }

  // ---- ghosts
  try { drawGhosts(g, cam, lt, hxd); } catch (e) { g.restore(); g.save(); }

  // ---- foreground depth element
  if (inRoom) drawRoomForeground(g, cam); else drawForeground(g, cam, tw);

  // ---- screen overlays (timer ring, whip streaks, icons)
  if (lt >= 1.85 && lt < 4.05) {
    const sp = project(cam, 968, 520, 1), p = clamp((lt - 2.0) / 1.95), ap = smooth((lt - 1.85) / 0.25) * (1 - smooth((lt - 3.95) / 0.1));
    drawTimerRing(g, sp.x, sp.y, 215 * cam.z, { value: 10 * (1 - p), progress: p, appear: ap, time: lt });
  }
  if (!inRoom) {
    const bx = lt < 16.65 ? busX(lt) : busOut(lt), dc = bx + 257 * 0.85, sp = project(cam, dc, 520, 1), ck = lt - 15.95;
    if (ck > 0 && ck < 1.1) checkIcon(g, sp.x, sp.y, 34 * cam.z, clamp(spring(ck, 240, 16)) * (1 - smooth((ck - 0.85) / 0.25)), ck);
    // clover
    if (lt >= 23.3 && lt < 25.9) {
      const st = heroD(lt), hj = walkerJoints(st), cp = project(cam, hj.head.x + 10, hj.head.y - 78, 1);
      clover(g, cp.x, cp.y, 38 * cam.z, clamp(spring(lt - 23.3, 200, 14)) * (1 - smooth((lt - 25.4) / 0.5)), lt);
    }
    // end ripple from his head
    if (lt >= 25.7) {
      const st = heroD(lt), hj = walkerJoints(st), cp = project(cam, hj.head.x, hj.head.y, 1);
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineWidth = 3;
      for (let k = 0; k < 3; k++) { const u = (lt - 25.7 - k * 0.45) / 1.7; if (u < 0 || u > 1) continue; g.strokeStyle = `rgba(127,233,255,${0.5 * (1 - u)})`; g.beginPath(); g.arc(cp.x, cp.y, 30 * cam.z + 340 * cam.z * easeOut(u), 0, TAU); g.stroke(); }
      g.restore();
    }
  }
  g.restore();

  // confetti in world space of the street (drawn outside the roll group for simplicity)
  if (!inRoom && lt >= 24.15 && lt < 27.4) {
    const x0 = xD(24.15) + 20;
    g.save(); withLayer(g, cam, 1, () => confetti(g, x0, 560, lt - 24.15, lt)); g.restore();
  }

  // whip-pan streaks + hit flashes
  let fl = 0, sp = 0;
  const burst = (t0, a, k, split) => { if (lt >= t0) { const e = Math.exp(-(lt - t0) * k); fl += a * e; sp += split * e; } };
  burst(3.95, 0.28, 18, 8); burst(9.28, 0.36, 16, 14); burst(7.46, 0.1, 22, 4); burst(CUT, 0.55, 12, 12); burst(12.25, 0.12, 20, 5); burst(18.35, 0.1, 20, 6);
  burst(19.5, 0.12, 14, 8); burst(24.15, 0.14, 12, 4); burst(1.9, 0.12, 14, 3); burst(6.0, 0.12, 14, 3); burst(15.95, 0.14, 14, 3);
  for (const [a, b] of [[4.3, 4.75], [11.0, 11.4]]) {
    if (lt > a && lt < b) {
      const k = Math.sin(Math.PI * (lt - a) / (b - a)) ** 2;
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (let i = 0; i < 18; i++) { const y = hash1(i * 3) * H, L = 400 + 800 * hash1(i * 3 + 1), x = ((hash1(i * 3 + 2) * (W + L) + lt * 3000) % (W + L)) - L; g.strokeStyle = `rgba(255,236,210,${0.22 * k})`; g.lineWidth = 2 + 5 * hash1(i * 3 + 4); g.beginPath(); g.moveTo(x, y); g.lineTo(x + L, y); g.stroke(); }
      g.restore(); sp += 9 * k; fl += 0.06 * k;
    }
  }
  if (sp > 0.8) rgbSplit(g, sp);
  if (fl > 0.01) flash(g, clamp(fl), '#ffffff');
}

function drawGhosts(g, cam, lt, hxd) {
  const inRoom = lt < CUT;
  // ---- A: ghost alarm clock sits on top of the real one
  if (lt >= 1.9 && lt < 4.05) {
    const pop = clamp(spring(lt - 1.9, 230, 15)), a = pop * (1 - smooth((lt - 3.95) / 0.1)) * 0.95;
    withLayer(g, cam, 1, () => {
      const sh = Math.sin(lt * 90) * 2.2 * smooth((lt - 2.0) / 0.3);
      g.save(); g.translate(968, 708 - 32); g.scale(pop, pop); g.translate(-968, -708 + 32);
      drawClock(g, 968, 708, { gh: a, ring: smooth((lt - 2.1) / 0.3), shake: sh, time: lt });
      g.restore();
    });
  }
  // ---- B: ghost mug slides, falls, shatters
  if (lt >= 5.95 && lt < 7.75) {
    const pose = mugPose(lt - 6.0, 1800, 70), fl = pose.ph === 3 ? pose.cy : 0;
    const hit = pose.ph === 3 && pose.cy > 806, tHit = 0.31 + 1.15 + 6.0;
    const a = clamp(spring(lt - 5.95, 220, 16)) * (1 - smooth((lt - 7.55) / 0.2));
    withLayer(g, cam, 1, () => {
      if (!hit) drawMug(g, pose.cx, pose.cy, pose.rot, a * 0.95, 0, lt);
      const u = (lt - tHit) / 0.9;
      if (lt >= tHit - 0.01) {
        shards(g, pose.cx > 0 ? mugPose(tHit - 6.0, 1800, 70).cx : 2700, 800, (lt - tHit) / 0.7, 16, 11, '#9fefff', 1700);
        g.save(); g.globalCompositeOperation = 'lighter'; const k = clamp((lt - tHit) / 0.4); g.strokeStyle = `rgba(190,250,255,${0.8 * (1 - k)})`; g.lineWidth = 5; g.beginPath(); g.ellipse(mugPose(tHit - 6.0, 1800, 70).cx, 816, 20 + 110 * easeOut(k), 5 + 18 * easeOut(k), 0, 0, TAU); g.stroke(); g.restore();
      }
    });
  }
  // ---- C: ghost hero stubs his toe; ghost carton tips and spills
  if (lt >= 11.45 && lt < 12.75) {
    const tHit = 12.25, pop = clamp(spring(lt - 11.45, 220, 16)), fade = 1 - smooth((lt - 12.4) / 0.3);
    const gx = lt < tHit ? xC(lt + 0.55) : xC(tHit + 0.55);
    const c = base(); c.x = gx; c.phase = gx / STRIDE; c.walk = lt < tHit ? 1 : 0; c.lean = lt < tHit ? 0.1 : 0.0; c.flutter = 0.3; c.eyeGlow = 1;
    const u = lt - tHit;
    let hop = 0; if (u > 0) { const hu = u / 0.2; hop = 26 * Math.abs(Math.sin(Math.PI * Math.min(hu, 3))) * (hu < 3 ? 1 - hu / 5 : 0); }
    c.headDown = u > 0 ? 0.25 : 0.04;
    const st = walkerSt(c, { x: gx, y: 820 - hop, s: HS, facing: 1, pal: palGhost(0.72 * pop * fade) });
    if (u > 0) { const hj0 = walkerJoints(st); reach(st, hj0.footF.x + 4, hj0.footF.y - 6, smooth(u / 0.1), false); }
    withLayer(g, cam, 1, () => {
      drawWalker(g, st);
      if (u > 0 && u < 0.7) starburst(g, gx + 44, 806, 36 * (0.6 + 0.4 * easeOut(u / 0.12)), u * 2, (1 - smooth((u - 0.4) / 0.3)) * pop);
    });
  }
  if (lt >= 13.15 && lt < 14.4) {
    const tT = 13.4, a = clamp(spring(lt - 13.15, 220, 16)) * (1 - smooth((lt - 14.1) / 0.25));
    const PXc = 3645, PYc = 750;
    const cr = (th) => ({ x: PXc + 15 * Math.cos(th) + 23 * Math.sin(th), y: PYc + 15 * Math.sin(th) - 23 * Math.cos(th) });
    withLayer(g, cam, 1, () => {
      const u = lt - tT;
      if (u < 0) drawCarton(g, 3660, 727, 0, a * 0.95);
      else if (u < 0.22) { const th = -0.6 * smooth(u / 0.22), p = cr(th); drawCarton(g, p.x, p.y, th, a * 0.95); }
      else {
        const p0 = cr(-0.6), t = u - 0.22, cx = p0.x - 70 * t, cy = p0.y + 0.5 * 1500 * t * t, floorHit = cy > 796;
        const tH = Math.sqrt(2 * (796 - p0.y) / 1500);
        if (!floorHit) drawCarton(g, cx, cy, -0.6 - 4 * t, a * 0.95);
        else {
          const k = clamp((t - tH) / 0.6), px = p0.x - 70 * tH;
          g.beginPath(); g.ellipse(px, 818, 14 + 82 * easeOut(k), 4 + 12 * easeOut(k), 0, 0, TAU); gp(g, a * 0.9, 0.6);
          g.save(); g.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 9; i++) { const aa = -Math.PI * (0.15 + 0.7 * hash1(i * 3)), v = 90 + 150 * hash1(i * 3 + 1), tt = t - tH; if (tt > 0.5) break; g.fillStyle = `rgba(200,250,255,${0.9 * (1 - tt / 0.5) * a})`; g.beginPath(); g.arc(px + Math.cos(aa) * v * tt, 810 + Math.sin(aa) * v * tt + 900 * tt * tt, 3.4, 0, TAU); g.fill(); }
          g.restore();
        }
      }
    });
  }
  if (inRoom) return;
  // ---- D: ghost bus leaves, ghost hero misses it
  if (lt >= CUT && lt < 15.3) {
    const a = 0.7 * win(lt, CUT, 15.25, 0.05, 0.3), gx = lt < 14.7 ? BUS_STOP : ghostBusX(lt);
    withLayer(g, cam, 1, () => drawBus(g, gx, 868, 0.85, { gh: a, door: 0, wheel: gx / 46 }));
  }
  if (lt >= CUT && lt < 15.45) {
    const gx = Math.min(760 + 480 * (lt - CUT), 1200), running = gx < 1199, a = 0.78 * win(lt, CUT, 15.4, 0.05, 0.3);
    const c = base(); c.x = gx; c.phase = gx / (STRIDE * 0.85); c.walk = running ? 1 : 0.0; c.lean = running ? 0.28 : 0.05;
    const u = lt - (CUT + (1200 - 760) / 480);
    c.headDown = running ? 0.05 : 0.3 * smooth(u / 0.2); c.flutter = 0.4; c.eyeGlow = 1;
    const st = walkerSt(c, { x: gx, y: 905, s: HS, facing: 1, pal: palGhost(a) });
    withLayer(g, cam, 1, () => drawWalker(g, st));
  }
  // ---- D: ghost skateboard + ghost straight-walker; shatters at the hit
  if (lt >= 17.9 && lt < 18.8) {
    const tc = 18.38, bxg = (t) => 1715 - 1800 * (t - tc), gxh = xStraight(lt + 0.5);
    const a = 0.9 * clamp(spring(lt - 17.9, 200, 18)) * (1 - smooth((lt - 18.55) / 0.2));
    withLayer(g, cam, 1, () => {
      if (lt < tc + 0.0) {
        const c = base(); c.x = gx2(lt); c.phase = c.x / STRIDE; c.walk = 1; c.lean = 0.1; c.eyeGlow = 1; c.flutter = 0.3;
        const st = walkerSt(c, { x: c.x, y: 820, s: HS, facing: 1, pal: palGhost(0.68 * clamp(spring(lt - 17.9, 200, 16))) });
        drawWalker(g, st);
      } else {
        const u = lt - tc; const x0 = gx2(tc), y0 = 700;
        g.save(); g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 22; i++) {
          const an = -Math.PI * 0.5 + (hash1(i * 3) - 0.5) * 3.6, v = 120 + 380 * hash1(i * 3 + 1);
          g.fillStyle = `rgba(190,248,255,${clamp(1 - u / 0.6)})`;
          g.save(); g.translate(x0 + Math.cos(an) * v * u - 150 * u, y0 + Math.sin(an) * v * u + 700 * u * u); g.rotate(u * 8 + i); g.fillRect(-6, -3, 12, 6); g.restore();
        }
        g.restore();
      }
      const bx = bxg(lt);
      if (bx > -300) drawBoard(g, bx, 838, a, bx / 13, 0, 0.8);
    });
  }
  function gx2(t) { return xStraight(t + 0.5); }
  // ---- D: real skateboard rockets by (drawn after the hero so it passes in front)
  if (lt >= 18.95 && lt < 20.2) {
    const bx = 1812 - 1800 * (lt - 19.5), bounce = -4 * Math.abs(Math.sin(lt * 31));
    withLayer(g, cam, 1, () => {
      drawBoard(g, bx, 842 + bounce, 0, bx / 13, 0.03 * Math.sin(lt * 25), 1);
      // dust kicked up
      g.save(); g.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 9; i++) { const u = clamp((lt - 19.5) * 1 + i * 0.05 + 0.02, 0, 1); const dx = bx + 120 + i * 46, a = 0.22 * (1 - i / 9); g.fillStyle = `rgba(230,200,170,${a})`; g.beginPath(); g.arc(dx, 826 - i * 3, 12 + i * 3, 0, TAU); g.fill(); }
      g.restore();
    });
  }
  // ---- D: three footprints = "three steps to the side"
  if (lt >= 20.3 && lt < 22.4) {
    const hop = [18.55, 18.7, 18.85], fa = 1 - smooth((lt - 21.6) / 0.7);
    withLayer(g, cam, 1, () => {
      g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = `rgba(127,233,255,${0.4 * fa})`; g.lineWidth = 3; g.setLineDash([8, 10]);
      g.beginPath(); g.moveTo(xD(18.4), yD(18.4) + 2); for (let i = 0; i < 3; i++) g.lineTo(xD(hop[i]), yD(hop[i]) + 2); g.stroke(); g.setLineDash([]); g.restore();
      for (let i = 0; i < 3; i++) footprint(g, xD(hop[i]), yD(hop[i]) + 2, clamp(spring(lt - (20.35 + i * 0.4), 240, 15)), i % 2 ? 1 : -1, fa);
    });
  }
}

function draw(g, lt, dur) {
  const tw = T0 + lt;
  frame(g, lt, tw);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

window.CH = window.CH || {};
window.CH.ch2 = { draw };
})();
