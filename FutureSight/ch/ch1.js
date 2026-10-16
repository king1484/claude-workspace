// ch1.js — "The Rules" (19.5 s). CH.ch1.draw(g, lt, dur). Pure function of lt.
// Shots: S1 ring locks 10.0 | S2 feeling/hunch crossed out | S3 ghost world early | S4 pause/off fail | S5 ribbon never skips | S6 walk to the sun
(function () {
'use strict';
const T0 = LAYOUT.ch1.start;
const SH = { s1: [0, 3.8], s2: [3.8, 6.0], s3: [6.0, 9.9], s4: [9.9, 12.4], s5: [12.4, 14.6], s6: [14.6, 19.5] };
const WALK_T = 12.45, WALK_V = 150;
const HS = 0.92;

function ik2(p0, p1, l1, l2, side) {
  let dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy), ux, uy;
  if (d < 1e-6) { ux = 0; uy = 1; d = 1e-6; } else { ux = dx / d; uy = dy / d; }
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { mid: { x: p0.x + ux * a + side * uy * h, y: p0.y + uy * a - side * ux * h }, end: { x: p0.x + ux * dd, y: p0.y + uy * dd } };
}
function reachTo(st, wx, wy, k, back) {
  const P = st.pose, tx = (wx - st.x) / (st.s * st.facing), ty = (wy - st.y) / st.s;
  const A = back ? P.armB : P.armF;
  const r = ik2(P.J, { x: lerp(A.hand.x, tx, k), y: lerp(A.hand.y, ty, k) }, 39, 39, -1);
  A.elbow = r.mid; A.hand = r.end;
}
const mixCam = (a, b, w) => ({ x: lerp(a.x, b.x, w), y: lerp(a.y, b.y, w), z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), w)) });
function palHood(hood, back, dark) { return Object.assign({}, PAL_REAL, { hood, hoodBack: back, hoodDark: dark, hoodLight: hood }); }
const PAL_GREEN = palHood('#3aa37a', '#2b7d5e', '#1f5c45');

// ---------------------------------------------------------------- hero
function heroAt(lt) {
  const c = { x: CHAR_X, walk: 0, phone: 0, headDown: 0, lean: 0.05, eyeOpen: 0, eyeGlow: 0, flutter: 0, step: 0, bob: 1 };
  c.eyeOpen = clamp(spring(lt - 0.9, 220, 22));
  c.eyeGlow = clamp(spring(lt - 1.15, 160, 20)) * (1 - 0.5 * smooth((lt - 17) / 1.5));
  c.flutter = 0.3 * win(lt, 6.0, 7.2, 0.1, 0.8);
  if (lt > WALK_T) {
    const u = lt - WALK_T;
    c.walk = smooth(u / 0.45); c.x = CHAR_X + WALK_V * rampInt(u, 0.45); c.lean = 0.1; c.flutter = 0.35;
  }
  c.phase = c.x / STRIDE;
  return c;
}
function futureX(lt, tau) { // where the hero will be tau seconds from lt
  const u = lt + tau - WALK_T;
  return CHAR_X + (u > 0 ? WALK_V * rampInt(u, 0.45) : 0);
}

// ---------------------------------------------------------------- camera
function camAt(lt, c) {
  let cam;
  if (lt < SH.s2[0]) {
    cam = mixCam({ x: CHAR_X + 70, y: 598, z: 1.95 }, { x: CHAR_X + 150, y: 612, z: 1.28 + 0.04 * lt / 3.8 }, clamp(spring(lt - 0.85, 46, 12)));
  } else if (lt < SH.s3[0]) {
    const u = (lt - SH.s2[0]) / 2.2;
    cam = { x: CHAR_X + 185 + 25 * u, y: 588, z: 1.9 + 0.14 * u };
  } else if (lt < SH.s4[0]) {
    cam = mixCam({ x: CHAR_X + 210, y: 588, z: 2.04 }, { x: CHAR_X + 150 + 25 * Math.sin((lt - 6) * 0.6), y: 604, z: 0.97 }, clamp(spring(lt - 6.0, 40, 11.5)));
  } else if (lt < SH.s5[0]) {
    const u = (lt - SH.s4[0]) / 2.5;
    cam = { x: CHAR_X + 120 + 18 * u, y: 592, z: 1.7 + 0.1 * u };
  } else {
    const trk = mixCam({ x: c.x + 330, y: 612, z: 1.12 }, { x: c.x + 300, y: 575, z: 1.55 }, smooth((lt - 14.6) / 4.6));
    const w = lt < SH.s5[0] + 0.6 ? 1 : 1;
    cam = trk;
    cam.x += 0 * w;
  }
  const sk = shakeAt(lt, 10.75, 9, 9);
  const sk2 = shakeAt(lt, 11.85, 14, 8);
  const sk3 = shakeAt(lt, 3.8, 8, 12);
  cam.x += sk.x + sk2.x + sk3.x; cam.y += sk.y + sk2.y + sk3.y;
  cam.r = (sk.r + sk2.r) * 1.0;
  return cam;
}

// ---------------------------------------------------------------- small fx
function glow(g, x, y, r, col, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}
function motes(g, x0, y0, w, h, n, tt, a, seed) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const hx = hash1(seed + i * 3), hy = hash1(seed + i * 3 + 1), hs = hash1(seed + i * 3 + 2);
    const x = x0 + hx * w + Math.sin(tt * (0.6 + hs) + i) * 14;
    const y = y0 + (((hy - tt * (0.04 + 0.05 * hs)) % 1) + 1) % 1 * h;
    const al = a * (0.35 + 0.65 * Math.sin(tt * 2 + i * 1.7) ** 2);
    glow(g, x, y, 4 + hs * 6, '150,235,255', al);
  }
  g.restore();
}

// ---------------------------------------------------------------- icons (world space)
function cloud(g, x, y, r, pop, headX, headY, a) {
  g.save(); g.globalAlpha = a;
  const dots = [[0.55, 15], [0.78, 9]];
  g.fillStyle = 'rgba(10,26,60,0.88)'; g.strokeStyle = 'rgba(127,233,255,0.9)'; g.lineWidth = 3;
  for (const d of dots) { const px = lerp(headX, x, d[0]), py = lerp(headY, y, d[0]); g.beginPath(); g.arc(px, py, d[1] * pop, 0, TAU); g.fill(); g.stroke(); }
  g.translate(x, y); g.scale(pop, pop);
  const p = new Path2D();
  const blobs = [[0, 0, 1], [-0.85, 0.2, 0.62], [0.85, 0.2, 0.62], [-0.45, -0.62, 0.62], [0.45, -0.62, 0.62], [-0.4, 0.62, 0.55], [0.4, 0.62, 0.55]];
  for (const b of blobs) { p.moveTo(b[0] * r + b[2] * r, b[1] * r); p.arc(b[0] * r, b[1] * r, b[2] * r, 0, TAU); }
  g.lineWidth = 10; g.stroke(p); g.fill(p);
  g.restore();
}
function heart(g, r) {
  g.beginPath(); g.moveTo(0, r * 0.9);
  g.bezierCurveTo(-r * 1.5, -r * 0.1, -r * 0.6, -r * 1.1, 0, -r * 0.35);
  g.bezierCurveTo(r * 0.6, -r * 1.1, r * 1.5, -r * 0.1, 0, r * 0.9); g.closePath();
  const gr = g.createLinearGradient(0, -r, 0, r); gr.addColorStop(0, '#ff7a96'); gr.addColorStop(1, '#e0264f');
  g.fillStyle = gr; g.fill(); g.lineWidth = 3; g.strokeStyle = '#ffd0da'; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(-r * 0.55, -r * 0.3, r * 0.14, r * 0.26, -0.6, 0, TAU); g.fill();
}
function bulb(g, r) {
  g.save();
  g.strokeStyle = '#ffe9a0'; g.lineWidth = 4; g.lineCap = 'round';
  for (let i = 0; i < 7; i++) { const a = -Math.PI + (i + 0.5) / 7 * Math.PI; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.95, -r * 0.15 + Math.sin(a) * r * 0.95); g.lineTo(Math.cos(a) * r * 1.22, -r * 0.15 + Math.sin(a) * r * 1.22); g.stroke(); }
  const gr = g.createRadialGradient(-r * 0.2, -r * 0.4, 2, 0, -r * 0.15, r * 0.75); gr.addColorStop(0, '#fffbe0'); gr.addColorStop(1, '#ffc531');
  g.fillStyle = gr; g.beginPath(); g.arc(0, -r * 0.15, r * 0.66, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(-r * 0.34, r * 0.4); g.lineTo(r * 0.34, r * 0.4); g.lineTo(r * 0.26, r * 0.78); g.lineTo(-r * 0.26, r * 0.78); g.closePath(); g.fillStyle = '#b9b2c9'; g.fill();
  g.strokeStyle = '#6e6684'; g.lineWidth = 3; g.beginPath(); g.moveTo(-r * 0.3, r * 0.58); g.lineTo(r * 0.3, r * 0.58); g.stroke();
  g.strokeStyle = '#d98a14'; g.lineWidth = 3; g.beginPath(); g.moveTo(-r * 0.2, r * 0.3); g.lineTo(-r * 0.08, -r * 0.05); g.lineTo(r * 0.08, r * 0.3); g.lineTo(r * 0.2, -r * 0.05); g.stroke();
  g.restore();
}
function forbid(g, x, y, r, u) { // u 0..1 draw-on, red "no" sign
  if (u <= 0.001) return;
  g.save(); g.translate(x, y); g.lineCap = 'round';
  const col = '#ff3148';
  g.strokeStyle = 'rgba(40,0,10,0.55)'; g.lineWidth = r * 0.26;
  g.beginPath(); g.arc(0, 0, r, -2.3, -2.3 + TAU * Math.min(1, u * 1.6)); g.stroke();
  g.strokeStyle = col; g.lineWidth = r * 0.18;
  g.beginPath(); g.arc(0, 0, r, -2.3, -2.3 + TAU * Math.min(1, u * 1.6)); g.stroke();
  const k = clamp((u - 0.45) / 0.55);
  if (k > 0) {
    const ax = Math.cos(-2.3) * r, ay = Math.sin(-2.3) * r, bx = -ax, by = -ay;
    g.strokeStyle = 'rgba(40,0,10,0.55)'; g.lineWidth = r * 0.26; g.beginPath(); g.moveTo(ax, ay); g.lineTo(lerp(ax, bx, k), lerp(ay, by, k)); g.stroke();
    g.strokeStyle = col; g.lineWidth = r * 0.18; g.beginPath(); g.moveTo(ax, ay); g.lineTo(lerp(ax, bx, k), lerp(ay, by, k)); g.stroke();
  }
  g.restore();
}

function iconBubble(g, lt, x, y, r, t0, tCross, kind, head) {
  const u = lt - t0; if (u < 0) return;
  const pop = clamp(spring(u, 240, 17)) * (1 - smooth((lt - 6.0) / 0.25) * 1);
  if (pop <= 0.01) return;
  const shk = shakeAt(lt, tCross, 14, 11);
  const cu = clamp((lt - tCross) / 0.28);
  const dim = 1 - 0.4 * smooth((lt - tCross) / 0.2);
  g.save(); g.translate(shk.x, shk.y);
  cloud(g, x, y, r, pop, head.x, head.y, 1);
  g.save(); g.translate(x, y); g.scale(pop, pop); g.globalAlpha = dim;
  g.rotate(0.04 * Math.sin(lt * 5 + x));
  if (kind === 'heart') { const bt = 1 + 0.07 * Math.sin(lt * 9); g.scale(bt, bt); g.translate(0, r * 0.05); heart(g, r * 0.58); } else bulb(g, r * 0.68);
  g.restore();
  g.save(); g.translate(0, 0); g.scale(1, 1);
  if (lt >= tCross) { g.globalCompositeOperation = 'source-over'; forbid(g, x, y, r * 0.95 * pop, cu); }
  g.restore();
  if (lt >= tCross && lt < tCross + 0.45) { // slam ring
    const k = (lt - tCross) / 0.45; g.globalCompositeOperation = 'lighter';
    g.strokeStyle = `rgba(255,70,90,${0.6 * (1 - k)})`; g.lineWidth = 6; g.beginPath(); g.arc(x, y, r * (1 + k * 0.9), 0, TAU); g.stroke();
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
}

// pause + power holograms
function holoRing(g, r, a, col) {
  g.strokeStyle = `rgba(${col},${a})`; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
  g.lineWidth = 1.5; g.strokeStyle = `rgba(${col},${a * 0.6})`; g.beginPath(); g.arc(0, 0, r * 1.14, 0, TAU); g.stroke();
}
function holoIcon(g, kind, r, a, col, brk) {
  g.save(); g.lineCap = 'round';
  g.globalCompositeOperation = 'lighter';
  const bg = g.createRadialGradient(0, 0, r * 0.2, 0, 0, r); bg.addColorStop(0, `rgba(10,50,110,${0.5 * a})`); bg.addColorStop(1, `rgba(40,150,230,${0.18 * a})`);
  g.fillStyle = bg; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  holoRing(g, r, a, col);
  g.strokeStyle = `rgba(235,253,255,${a})`; g.fillStyle = `rgba(235,253,255,${a})`;
  if (kind === 'pause') {
    const dx = brk ? brk.dx : 0;
    g.fillRect(-r * 0.36 - dx, -r * 0.42, r * 0.26, r * 0.84); g.fillRect(r * 0.10 + dx, -r * 0.42, r * 0.26, r * 0.84);
  } else {
    g.lineWidth = r * 0.14;
    g.beginPath(); g.arc(0, 0, r * 0.46, -Math.PI / 2 + 0.6, -Math.PI / 2 - 0.6 + TAU); g.stroke();
    g.beginPath(); g.moveTo(0, -r * 0.62); g.lineTo(0, -r * 0.08); g.stroke();
  }
  // scanlines
  g.globalCompositeOperation = 'source-over';
  g.save(); g.beginPath(); g.arc(0, 0, r * 0.98, 0, TAU); g.clip();
  g.fillStyle = `rgba(0,12,30,${0.22 * a})`; for (let y = -r; y < r; y += 5) g.fillRect(-r, y, r * 2, 1.4);
  g.restore();
  g.restore();
}

// ---------------------------------------------------------------- ghost/real traffic
function ghostWalker(g, x, y, facing, alpha, s) {
  const c = { x, walk: 1, phase: (facing > 0 ? x : -x) / STRIDE, headDown: 0.04, phone: 0, lean: 0.1, bob: 1, eyeOpen: 0, eyeGlow: 0, flutter: 0.3, step: 0 };
  drawWalker(g, walkerSt(c, { y, s: s || HS, facing, pal: palGhost(alpha) }));
}
function pathX(lt, a, b, x0, x1) { return lerp(x0, x1, clamp((lt - a) / (b - a))); }

// ---------------------------------------------------------------- frame
function draw(g, lt, dur) {
  const W = 1920, H = 1080;
  const c = heroAt(lt);
  const cam = camAt(lt, c);
  const tw = T0 + lt;
  g.save();
  if (cam.r) { g.translate(W / 2, H / 2); g.rotate(cam.r); g.translate(-W / 2, -H / 2); }
  drawWorld(g, cam, tw);

  // ---- real traffic (S3) drawn before the grade
  if (lt >= 8.15 && lt < 10.2) {
    const x = pathX(lt, 8.2, 9.85, -420, 2350);
    withLayer(g, cam, 1, () => drawCar(g, { x, y: GROUND.roadFar, s: 1, pal: PAL_REAL, wheel: x / 34 }));
  }
  if (lt >= 8.65 && lt < 10.0) {
    const x = pathX(lt, 8.7, 9.6, -400, 2400);
    withLayer(g, cam, 1, () => drawBike(g, { x, y: GROUND.roadNear, s: 1.08, wheel: x / 58, pedal: lt * 12, speed: 3000, pal: PAL_REAL }));
  }
  if (lt >= 8.0 && lt < 10.4) {
    const x = pathX(lt, 8.2, 10.2, 1900, 180);
    const pc = { x, walk: 1, phase: -x / STRIDE, headDown: 0.3, phone: 1, lean: 0.1, bob: 1, eyeOpen: 0, eyeGlow: 0, flutter: 0.2, step: 0 };
    withLayer(g, cam, 1, () => drawWalker(g, walkerSt(pc, { y: 836, s: 0.95, facing: -1, pal: PAL_GREEN })));
  }

  // ---- vision grade
  let vg = 0;
  if (lt < 3.8) vg = 0.12 * smooth((lt - 1.2) / 1);
  else if (lt < 6.0) vg = 0.3;
  else if (lt < 9.9) vg = lerp(0.3, 0.55, smooth((lt - 6.0) / 0.6));
  else if (lt < 14.6) vg = 0.5;
  else vg = 0.45 * (1 - smooth((lt - 14.6) / 4.0)) + 0.1;
  if (lt >= 6.0 && lt < 6.7) { // cyan scan bar reveals the grade
    const bx = lerp(-100, 2020, easeOut((lt - 6.0) / 0.65));
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.beginPath(); g.rect(0, 0, bx, H); g.clip();
    visionGrade(g, vg); g.restore();
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(bx - 90, 0, bx + 8, 0); gr.addColorStop(0, 'rgba(127,233,255,0)'); gr.addColorStop(1, 'rgba(180,245,255,0.8)');
    g.fillStyle = gr; g.fillRect(bx - 90, 0, 98, H); g.restore();
  } else visionGrade(g, vg);

  // ---- hero (after grade, keeps the red hoodie)
  const st = walkerSt(c, { s: HS });
  const hj = walkerJoints(st);
  if (lt >= 10.45 && lt < 12.4) {
    const ic = { x: hj.shoulder.x + 112, y: hj.shoulder.y - 8 };
    const k1 = smooth((lt - 10.5) / 0.2) * (1 - smooth((lt - 11.2) / 0.25));
    const k2 = smooth((lt - 11.45) / 0.2) * (1 - smooth((lt - 12.1) / 0.25));
    const tap = Math.max(k1 * (1 - 0.35 * Math.sin((lt - 10.72) * 30) * win(lt, 10.72, 11.1, 0.02, 0.2)), k2);
    reachTo(st, ic.x - 14, ic.y, tap);
  }
  withLayer(g, cam, 1, () => drawWalker(g, st));

  // ---- ghost hero(es)
  // S1: echoes marching ahead of him after the ring locks
  if (lt >= 3.0 && lt < 3.8) {
    for (let k = 0; k < 2; k++) {
      const u = lt - 3.0 - k * 0.12; if (u < 0) continue;
      const pop = clamp(spring(u, 230, 15)), gx = CHAR_X + 260 * (k + 1);
      const gc = { x: gx, walk: 1, phase: gx / STRIDE + k * 0.3, headDown: 0.04, phone: 0, lean: 0.1, bob: 1, eyeOpen: 1, eyeGlow: 1, flutter: 0.3, step: 0 };
      withLayer(g, cam, 1, () => { g.save(); g.translate(gx, 820); g.scale(lerp(0.6, 1, pop), lerp(0.6, 1, pop)); g.translate(-gx, -820); drawWalker(g, walkerSt(gc, { pal: palGhost((0.8 - 0.25 * k) * Math.min(1, pop * 1.4)) })); g.restore(); });
    }
  }
  // S3: ghost world — cars, bike, pedestrian a beat ahead of the real ones
  if (lt >= 6.2 && lt < 8.3) {
    const x = pathX(lt, 6.3, 8.0, -420, 2350), al = 0.85 * win(lt, 6.3, 8.0, 0.12, 0.1);
    withLayer(g, cam, 1, () => drawCar(g, { x, y: GROUND.roadFar, s: 1, pal: palGhost(al), wheel: x / 34 }));
  }
  if (lt >= 6.6 && lt < 7.9) {
    const x = pathX(lt, 6.7, 7.7, -400, 2400), al = 0.85 * win(lt, 6.7, 7.7, 0.1, 0.1);
    withLayer(g, cam, 1, () => drawBike(g, { x, y: GROUND.roadNear, s: 1.08, wheel: x / 58, pedal: lt * 12, speed: 3000, pal: palGhost(al) }));
  }
  if (lt >= 6.2 && lt < 8.3) {
    const x = pathX(lt, 6.3, 8.1, 1900, 180), al = 0.85 * win(lt, 6.3, 8.1, 0.15, 0.12);
    withLayer(g, cam, 1, () => ghostWalker(g, x, 836, -1, al, 0.95));
  }
  // S4: ghost world keeps playing behind the failed buttons
  if (lt >= 9.9 && lt < 12.4) {
    const x = pathX(lt, 10.0, 11.7, -420, 2350), al = 0.7 * win(lt, 10.0, 11.7, 0.12, 0.12);
    withLayer(g, cam, 1, () => drawCar(g, { x, y: GROUND.roadFar, s: 1, pal: palGhost(al), wheel: x / 34 }));
    const x2 = pathX(lt, 11.3, 12.4, 2100, -300), al2 = 0.6 * win(lt, 11.3, 12.4, 0.1, 0.1);
    withLayer(g, cam, 1, () => ghostWalker(g, x2, 836, -1, al2, 0.95));
  }

  // S5/S6: the unbroken ribbon of time + ghosts of the walker ahead
  if (lt >= 12.45) {
    const ra = smooth((lt - 12.45) / 0.5) * (1 - 0.35 * smooth((lt - 15) / 3));
    withLayer(g, cam, 1, () => {
      const N = 46, L = 1500, hx = c.x;
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, x = hx + 30 + u * L, tau = (x - hx) / WALK_V;
        const y = 690 + 10 * Math.sin(x * 0.011 + tau * 3.1) * (0.4 + u);
        pts.push([x, y, u]);
      }
      const draw1 = (lw, a, extraGap) => {
        g.lineCap = 'round'; g.lineJoin = 'round';
        for (let i = 0; i < N; i++) {
          const p = pts[i], q = pts[i + 1];
          const fade = (1 - p[2] * 0.82);
          g.strokeStyle = `rgba(${p[2] < 0.5 ? '127,233,255' : '90,190,255'},${a * fade * ra})`;
          g.lineWidth = lw * (1 - p[2] * 0.4);
          g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
        }
      };
      g.save(); g.globalCompositeOperation = 'lighter';
      // skip attempt: a torn slice that snaps closed
      const tear = win(lt, 13.2, 13.5, 0.04, 0.12);
      draw1(26, 0.12); draw1(11, 0.3); draw1(3.5, 0.95);
      for (let i = 0; i < 70; i++) { // time ticks, fixed in the world, flowing into him as he walks
        const x = Math.ceil((hx + 20) / 40) * 40 + i * 40, u = (x - hx) / L; if (u > 1) break;
        const y = 690 + 10 * Math.sin(x * 0.011 + ((x - hx) / WALK_V) * 3.1) * (0.4 + u);
        g.strokeStyle = `rgba(220,252,255,${0.7 * ra * (1 - u * 0.85)})`; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x, y - 12 - 4 * (i % 5 === 0)); g.lineTo(x, y + 12 + 4 * (i % 5 === 0)); g.stroke();
      }
      // travelling highlight
      const hp = ((lt * 0.9) % 1);
      for (let k = 0; k < 3; k++) { const u = (hp + k / 3) % 1, x = hx + 30 + u * L; glow(g, x, 690, 40 * (1 - u * 0.6), '210,250,255', 0.5 * ra * (1 - u)); }
      if (tear > 0.01) {
        const tx = hx + 520;
        g.fillStyle = `rgba(0,10,30,${0.85 * tear})`; g.fillRect(tx - 18, 650, 36 * tear, 80);
        g.fillStyle = `rgba(255,70,120,${0.6 * tear})`; g.fillRect(tx - 24, 683, 48, 3);
        g.fillStyle = `rgba(80,160,255,${0.6 * tear})`; g.fillRect(tx - 20, 695, 52, 3);
      }
      g.restore();
    });
    // ghost walkers at +2.5 / +5 / +7.5 s
    for (let k = 1; k <= 3; k++) {
      const gx = futureX(lt, 2.5 * k), appear = clamp(spring(lt - 12.5 - k * 0.12, 200, 16));
      const gc = { x: gx, walk: 1, phase: gx / STRIDE + 0.1 * k, headDown: 0.04, phone: 0, lean: 0.1, bob: 1, eyeOpen: 1, eyeGlow: 1, flutter: 0.35, step: 0 };
      withLayer(g, cam, 1, () => drawWalker(g, walkerSt(gc, { pal: palGhost((0.62 - 0.14 * k) * appear * (1 - 0.3 * smooth((lt - 17) / 2))) })));
    }
  }

  // ---- timer ring (S1) + "10" ring (S3)
  if (lt < 3.9) {
    const ap = smooth((lt - 1.4) / 0.3) * (1 - smooth((lt - 3.65) / 0.15));
    if (ap > 0.01) {
      const p = clamp((lt - 2.2) / 1.1), sp = project(cam, CHAR_X + 255, 470, 1);
      const lock = lt > 3.3 ? 1 : 0;
      drawTimerRing(g, sp.x, sp.y, 270 * cam.z * (1 + 0.04 * Math.exp(-(lt - 3.3) * 10) * lock), { value: 10 * p, progress: p, appear: ap, time: lt });
    }
  }
  if (lt >= 7.9 && lt < 9.95) {
    const ap = smooth((lt - 7.9) / 0.3) * (1 - smooth((lt - 9.6) / 0.25));
    const p = clamp((lt - 7.95) / 1.7), sp = project(cam, CHAR_X + 20, 420, 1);
    drawTimerRing(g, sp.x, sp.y, 250 * cam.z, { value: 10 * (1 - p), progress: p, appear: ap, time: lt });
  }

  // ---- S2 thought icons
  if (lt >= 4.0 && lt < 6.3) {
    const hh = hj.head;
    withLayer(g, cam, 1, () => {
      iconBubble(g, lt, CHAR_X + 270, 462, 98, 4.2, 4.78, 'heart', { x: hh.x + 30, y: hh.y - 30 });
      iconBubble(g, lt, CHAR_X + 520, 520, 98, 5.12, 5.62, 'bulb', { x: hh.x + 40, y: hh.y - 10 });
    });
  }

  // ---- S4 holograms
  if (lt >= 10.4 && lt < 12.5) {
    const ic = { x: hj.shoulder.x + 112, y: hj.shoulder.y - 8 };
    withLayer(g, cam, 1, () => {
      // pause
      const u1 = lt - 10.45;
      if (u1 > 0 && lt < 11.4) {
        const pop = clamp(spring(u1, 240, 16)), r = 62 * pop;
        const gl = win(lt, 10.75, 11.12, 0.03, 0.03), j = (hash1(Math.floor(lt * 30)) - 0.5);
        const fall = clamp((lt - 11.12) / 0.3);
        const a = 1 - smooth((lt - 11.15) / 0.25);
        if (a > 0.01) {
          g.save(); g.translate(ic.x + j * 22 * gl, ic.y + (hash1(Math.floor(lt * 30) + 9) - 0.5) * 10 * gl + fall * 50 * fall);
          g.rotate(fall * 0.5);
          if (gl > 0.01) { // rgb split ghosts of the icon
            g.save(); g.translate(-10 * gl, 0); holoIcon(g, 'pause', r, 0.5 * a, '255,70,120', null); g.restore();
            g.save(); g.translate(10 * gl, 0); holoIcon(g, 'pause', r, 0.5 * a, '60,140,255', null); g.restore();
          }
          holoIcon(g, 'pause', r, (0.9 - 0.4 * gl * (hash1(Math.floor(lt * 40)) > 0.5 ? 1 : 0)) * a, '127,233,255', { dx: fall * 70 });
          g.restore();
          if (lt >= 11.0 && lt < 11.3) { // red X fail
            const k = (lt - 11.0) / 0.3;
            g.save(); g.translate(ic.x, ic.y); g.globalAlpha = 1 - k; g.strokeStyle = '#ff3148'; g.lineWidth = 12; g.lineCap = 'round';
            const rr = 34 * (0.6 + 0.4 * easeOut(k * 3));
            g.beginPath(); g.moveTo(-rr, -rr); g.lineTo(rr, rr); g.moveTo(rr, -rr); g.lineTo(-rr, rr); g.stroke(); g.restore();
          }
        }
      }
      // power
      const u2 = lt - 11.4;
      if (u2 > 0) {
        const pop = clamp(spring(u2, 240, 16)), r = 62 * pop;
        const off = win(lt, 11.62, 11.88, 0.02, 0.02), flick = hash1(Math.floor(lt * 36)) > 0.45 ? 1 : 0.15;
        const back = lt > 11.9 ? 1 : 0;
        const a = (lt < 11.62 ? 1 : off > 0.5 ? 0.12 * flick : lt < 11.9 ? 0.5 * flick : 1) * (1 - smooth((lt - 12.2) / 0.2));
        if (a > 0.01) {
          g.save(); g.translate(ic.x, ic.y);
          const bump = back * Math.exp(-(lt - 11.9) * 7);
          g.scale(1 + 0.2 * bump, 1 + 0.2 * bump);
          holoIcon(g, 'power', r, a, '127,233,255', null);
          g.restore();
          if (back) { // shock ring
            const k = clamp((lt - 11.9) / 0.5); g.save(); g.globalCompositeOperation = 'lighter';
            g.strokeStyle = `rgba(160,240,255,${0.7 * (1 - k)})`; g.lineWidth = 5; g.beginPath(); g.arc(ic.x, ic.y, r * (1 + 1.6 * easeOut(k)), 0, TAU); g.stroke(); g.restore();
          }
        }
      }
    });
    // fragments of the pause button
    if (lt >= 11.1 && lt < 11.75) {
      withLayer(g, cam, 1, () => {
        g.save(); g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 14; i++) {
          const u = lt - 11.1, a = hash1(i * 7) * TAU, v = 90 + hash1(i * 7 + 1) * 190;
          const x = ic.x + Math.cos(a) * v * u, y = ic.y + Math.sin(a) * v * u + 520 * u * u;
          g.fillStyle = `rgba(190,245,255,${0.9 * (1 - u / 0.65)})`; g.save(); g.translate(x, y); g.rotate(u * 9 + i); g.fillRect(-5, -2.5, 10, 5); g.restore();
        }
        g.restore();
      });
    }
  }

  // ---- ambient cyan motes
  if (lt > 1.0) motes(g, 0, 0, W, H, 18, lt, 0.5 * smooth((lt - 1) / 1), 41);

  // ---- S6 sun bloom
  if (lt > 15.5) {
    const sp = project(cam, 620, 430, 0.05), k = smooth((lt - 15.5) / 3.2);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'screen';
    glow(g, sp.x, sp.y, 900, '255,170,110', 0.28 * k);
    g.restore();
  }

  drawForeground(g, cam, tw);
  g.restore();

  // ---- hits: flashes and splits (screen space)
  let fl = 0, sp = 0, fc = '#ffffff';
  const burst = (t0, a, k, split) => { if (lt >= t0) { const e = Math.exp(-(lt - t0) * k); fl += a * e; sp += split * e; } };
  burst(3.8, 0.35, 26, 5);       // cut to the close-up
  burst(3.4, 0.25, 12, 6);       // ring locks 10.0
  burst(4.78, 0.12, 20, 7); burst(5.62, 0.12, 20, 7);
  burst(6.0, 0.4, 14, 10);
  burst(9.9, 0.3, 24, 8);
  burst(11.0, 0.18, 18, 14);
  burst(11.9, 0.35, 16, 16);
  burst(12.4, 0.2, 22, 6);
  if (sp > 0.8) rgbSplit(g, sp);
  if (fl > 0.01) flash(g, clamp(fl), fc);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

window.CH = window.CH || {};
window.CH.ch1 = { draw };
})();
