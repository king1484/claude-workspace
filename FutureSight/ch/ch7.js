// ch7.js — "Nothing" (34.576 s). Weeks of happy ghost-guided life; the ghost goes quiet; empty black street;
// a 10-second ring that counts toward nothing; the ghost that never blinks; flicker out at zero.
// Registers CH.ch7 = { draw(g, lt, dur) }. Everything is a pure function of lt.
(function () {
'use strict';
const W = 1920, H = 1080, GY = 820;
const CY = '127,233,255';

const T = {
  quiet: 6.95,          // z2 "the ghost world goes quiet"
  ghostFlick: 7.1,      // companion ghost starts to tear
  ghostGone: 8.7,
  stop: 8.2,            // hero comes to rest
  black: [9.6, 13.4],   // sky goes black
  ringIn: 14.9,         // z4 ring appears at 10.0
  gIn: [16.0, 16.9],    // ghost materialises
  blink: [19.55, 20.5], // hero blinks (ghost never)
  hands: [22.8, 25.6],  // z6 hero looks at his hands
  count0: 23.3,         // ring starts counting
  lookUp: 26.6,         // z7
  open: 29.3,           // z8 hero opens his arms
  end: 33.3,            // zero
};
const HX0 = 600;
const S0 = 1.25;

const bump = (t, a, b, ri, fa) => smooth((t - a) / (ri == null ? 0.3 : ri)) * (1 - smooth((t - b) / (fa == null ? 0.3 : fa)));
const pulseAt = (t, t0, k) => (t < t0 ? 0 : Math.exp(-(t - t0) * k));
function ik2(p0, p1, l1, l2, side) {
  let dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy), ux, uy;
  if (d < 1e-6) { ux = 0; uy = 1; d = 1e-6; } else { ux = dx / d; uy = dy / d; }
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { mid: { x: p0.x + ux * a + side * uy * h, y: p0.y + uy * a - side * ux * h }, end: { x: p0.x + ux * dd, y: p0.y + uy * dd } };
}
function mkPose(o) {
  const lean = o.lean == null ? 0.03 : o.lean;
  const P = walkerPose({ phase: o.phase || 0, walk: o.walk || 0, headDown: o.headDown || 0, lean, bob: o.bob == null ? 0.6 : o.bob,
    eyeOpen: o.eyeOpen == null ? 1 : o.eyeOpen, eyeGlow: o.eyeGlow || 0, flutter: o.flutter == null ? 0.1 : o.flutter, step: 0, time: o.time || 0 });
  const J = P.J, rest = 0.07 + lean * 0.35;
  function arm(raise, cur) {
    if (raise < 0.003) return cur;
    const phi = lerp(rest, 2.45, raise);
    const reach = 71 + 6.4 * raise;
    const tgt = { x: J.x + Math.sin(phi) * reach, y: J.y + Math.cos(phi) * reach };
    const r = ik2(J, tgt, 39, 39, -1);
    return { sh: J, elbow: r.mid, hand: r.end };
  }
  P.armF = arm(o.rF || 0, P.armF);
  P.armB = arm(o.rB || 0, P.armB);
  if (o.tilt) P.head = Object.assign({}, P.head, { rot: P.head.rot + o.tilt });
  return P;
}
function ghostAt(g, x, y, s, facing, pose, alpha, reveal) {
  g.save();
  if (reveal != null && reveal < 1) {
    const hh = 330 * s, top = y - hh * reveal;
    g.beginPath(); g.rect(x - 260 * s, top, 520 * s, hh * reveal + 60); g.clip();
  }
  drawWalker(g, { x, y, s, facing, pose, pal: palGhost(alpha), alpha: 1 });
  g.restore();
}
function scanLine(g, x, y, s, reveal) {
  if (reveal <= 0 || reveal >= 1) return;
  const yy = y - 330 * s * reveal;
  g.save(); g.globalCompositeOperation = 'lighter';
  const gr = g.createLinearGradient(x - 220 * s, 0, x + 220 * s, 0);
  gr.addColorStop(0, 'rgba(' + CY + ',0)'); gr.addColorStop(0.5, 'rgba(220,252,255,0.95)'); gr.addColorStop(1, 'rgba(' + CY + ',0)');
  g.fillStyle = gr; g.fillRect(x - 220 * s, yy - 2, 440 * s, 4);
  const g2 = g.createLinearGradient(0, yy - 40, 0, yy);
  g2.addColorStop(0, 'rgba(' + CY + ',0)'); g2.addColorStop(1, 'rgba(' + CY + ',0.28)');
  g.fillStyle = g2; g.fillRect(x - 200 * s, yy - 40, 400 * s, 40);
  g.restore();
}
function glitchBars(g, x, y, s, t, amt) {
  if (amt <= 0.02) return;
  const fr = Math.floor(t * 24);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const r = rng(fr * 31 + i * 7);
    if (r() > amt) continue;
    const yy = y - 20 - r() * 300 * s, w = (80 + r() * 220) * s, xx = x + (r() - 0.5) * 220 * s - w / 2;
    g.fillStyle = r() < 0.5 ? 'rgba(' + CY + ',' + (0.25 + 0.4 * r()) + ')' : 'rgba(255,255,255,' + (0.15 + 0.3 * r()) + ')';
    g.fillRect(xx, yy, w, 2 + r() * 9 * s);
  }
  g.restore();
}

// hero x(t): numeric integral of a walk envelope, tabulated once
const WALK = (function () {
  const dt = 0.02, n = 500, a = [0];
  const env = (t) => smooth(t / 0.5) * (1 - smooth((t - 7.3) / 0.9));
  for (let i = 1; i <= n; i++) a.push(a[i - 1] + env(i * dt) * 74 * dt);
  return { a, dt, n, env };
})();
function heroX(lt) {
  const f = clamp(lt / WALK.dt, 0, WALK.n - 1), i = Math.floor(f);
  return HX0 + lerp(WALK.a[i], WALK.a[i + 1], f - i);
}

// night multiplier colours (sky nearly black, pavement faintly visible)
function nightAt(lt) {
  let n = 0;
  if (lt < T.quiet) {
    // time-lapse: a few quick day/dusk pulses ("weeks pass")
    const c = 0.5 - 0.5 * Math.cos(TAU * lt / 1.75);
    n = 0.38 * c * smooth(lt / 0.5) * (1 - smooth((lt - 5.3) / 0.8)) - 0.0;
    n = Math.max(0, n);
  } else if (lt < T.black[0]) n = 0.22 * smooth((lt - T.quiet) / 2.0);
  else n = lerp(0.22, 1, smooth((lt - T.black[0]) / (T.black[1] - T.black[0])));
  return n;
}

function drawLoop(g, lt) {
  // ---- hero / camera
  const hx = heroX(lt);
  const walkEnv = WALK.env(Math.min(lt, 8.5));
  const ho = { time: lt, phase: hx / 140, walk: walkEnv, lean: 0.03 + 0.03 * walkEnv, flutter: 0.1, eyeOpen: 1, eyeGlow: 1 };
  // glow fades when the ghost world goes quiet
  ho.eyeGlow = 1 - smooth((lt - T.quiet) / 1.2);
  // blink
  const blink = (t0) => 1 - bump(lt, t0 - 0.0, t0 + 0.2, 0.06, 0.08) * 1.0;
  ho.eyeOpen = Math.min(blink(T.blink[0]), blink(T.blink[1]), blink(11.9), blink(15.6), blink(24.9), blink(28.4), blink(31.6));
  // look at hands, then look up
  const hd = bump(lt, T.hands[0], T.hands[1], 0.5, 0.5);
  ho.headDown = 0.22 * hd;
  const handsUp = bump(lt, T.hands[0] + 0.1, T.hands[1] - 0.1, 0.5, 0.5) * 0.45;
  const open = smooth((lt - T.open) / 1.6);
  ho.rF = handsUp + 0.62 * open; ho.rB = handsUp * 0.9 + 0.62 * open;
  const upTilt = smooth((lt - T.lookUp) / 0.8);
  ho.tilt = -0.28 * upTilt - 0.08 * Math.sin(lt * 0.9) * 0.3 + (lt < T.stop ? 0 : 0.0);
  if (lt > T.ringIn && lt < T.lookUp) ho.tilt += -0.12 * smooth((lt - T.ringIn) / 0.9) * (1 - hd);
  if (lt > T.quiet && lt < T.stop + 1.4) ho.tilt += 0.10 * bump(lt, T.quiet + 0.2, T.stop + 1.2, 0.4, 0.5); // looks back at the empty spot
  const hp = mkPose(ho);

  // camera
  let cz = 1.05, cx = hx + 230, cy = 604;
  if (lt >= 8) {
    const w = smooth((lt - 8) / 5.5);
    cz = lerp(1.05, 0.82, w); cy = lerp(604, 590, w); cx = lerp(hx + 230, hx + 60, w);
  }
  if (lt >= 14) {
    const w = smooth((lt - 14.5) / 6);
    cz = lerp(0.82, 1.0, w); cx = lerp(hx + 60, hx + 190, w);
  }
  if (lt >= 18.8) {
    const w = smooth((lt - 18.8) / 1.2) * (1 - smooth((lt - 22.0) / 1.2));
    cz += 0.32 * w; cx += 0.0 * w;
  }
  if (lt >= 23) {
    const w = smooth((lt - 23) / 10);
    cz = lerp(cz, 1.12, w); cx = lerp(cx, hx + 70, w); cy = lerp(cy, 560, w * 0.6);
  }
  const cam = { x: cx + 10 * Math.sin(lt * 0.5), y: cy, z: cz, r: 0 };
  const gx = hx + 430;
  const heroS = S0;

  drawWorld(g, cam, lt + 40);

  // ---- ghost-vision grade while the ghost world is still alive
  const vg = 0.42 * smooth(lt / 0.6) * (1 - smooth((lt - T.quiet) / 1.0));
  if (vg > 0.003) visionGrade(g, vg);

  // ---- night multiply
  const night = nightAt(lt);
  if (night > 0.004) {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'multiply';
    const gr = g.createLinearGradient(0, 0, 0, H);
    const dd = (v) => `rgb(${Math.round(255 - (255 - v[0]) * night)},${Math.round(255 - (255 - v[1]) * night)},${Math.round(255 - (255 - v[2]) * night)})`;
    gr.addColorStop(0, dd([3, 4, 10])); gr.addColorStop(0.42, dd([8, 10, 22])); gr.addColorStop(0.62, dd([20, 24, 46])); gr.addColorStop(1, dd([8, 10, 20]));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.restore();
  }
  // stars sneak in once the sky is black, then a few drift
  if (night > 0.6) {
    const a = smooth((night - 0.6) / 0.4);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < 46; i++) {
      const r = rng(8800 + i), x = r() * W, y = r() * 380;
      g.fillStyle = 'rgba(190,210,255,' + 0.5 * a * (0.5 + 0.5 * Math.sin(lt * (0.8 + r() * 1.6) + i * 3)) + ')';
      g.fillRect(x, y, 1.6, 1.6);
    }
    g.restore();
  }

  // ---- lone spotlight pool on the hero as the city goes dark
  const sp = project(cam, hx, GY, 1);
  const pool = smooth((lt - 9.2) / 2.0);
  if (pool > 0.003) {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter';
    const rr = 330 * cam.z;
    g.save(); g.translate(sp.x, sp.y + 6); g.scale(1, 0.22);
    let gr = g.createRadialGradient(0, 0, 0, 0, 0, rr);
    gr.addColorStop(0, 'rgba(110,140,230,' + 0.38 * pool + ')'); gr.addColorStop(1, 'rgba(60,90,200,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.fill(); g.restore();
    const hy = sp.y - 150 * cam.z;
    gr = g.createRadialGradient(sp.x, hy, 0, sp.x, hy, 330 * cam.z);
    gr.addColorStop(0, 'rgba(120,150,235,' + 0.10 * pool + ')'); gr.addColorStop(1, 'rgba(60,90,200,0)');
    g.fillStyle = gr; g.fillRect(sp.x - 340 * cam.z, hy - 340 * cam.z, 680 * cam.z, 680 * cam.z);
    g.restore();
  }

  // ---- hero
  withLayer(g, cam, 1, () => { drawWalker(g, { x: hx, y: GY, s: heroS, facing: 1, pose: hp, pal: PAL_REAL, alpha: 1 }); });

  // ---- the companion ghost (weeks of happy life) goes quiet
  if (lt < T.ghostGone + 0.3) {
    const walkG = Math.max(0, walkEnv);
    const gp = mkPose({ time: lt + 3, phase: hx / 140 + 0.5, walk: walkG, eyeGlow: 1, lean: 0.03 + 0.03 * walkG, flutter: 0.15 });
    const fl = lt > T.ghostFlick ? 1 : 0;
    const gone = smooth((lt - (T.ghostGone - 0.5)) / 0.5);
    let al = 0.82 * smooth((lt - 0.2) / 0.5) * (1 - gone);
    if (fl) al *= hash1(Math.floor(lt * 18)) < 0.35 ? 0.25 : 1;
    const gax = hx + 190 + 40 * Math.sin(lt * 0.7);
    if (al > 0.01) withLayer(g, cam, 1, () => {
      // it hovers a touch ahead of him; during the quiet it lags and judders
      ghostAt(g, gax, GY, S0, 1, gp, al, 1);
      if (fl) glitchBars(g, gax, GY, S0, lt, 0.2 + 0.6 * smooth((lt - T.ghostFlick) / 1.2));
    });
    // little gold motes: the millions
    if (lt < T.quiet + 0.4) {
      const k = 1 - smooth((lt - T.quiet) / 0.4);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 26; i++) {
        const r = rng(2200 + i), px = (r() * 2000 + lt * (30 + 40 * r())) % 2100 - 90, py = 1100 - ((r() * 1200 + lt * (30 + 50 * r())) % 1300);
        g.fillStyle = 'rgba(255,214,120,' + (0.2 + 0.4 * r()) * k * smooth(lt / 0.8) + ')'; g.beginPath(); g.arc(px, py, 1.6 + 2.6 * r(), 0, TAU); g.fill();
      }
      g.restore();
    }
  }

  // ---- the waiting ghost (never blinks, never moves)
  if (lt >= T.gIn[0] - 0.05) {
    const rev = smooth((lt - T.gIn[0]) / (T.gIn[1] - T.gIn[0]));
    const gp = mkPose({ time: 0, eyeGlow: 1, eyeOpen: 1, lean: 0.0, bob: 0, flutter: 0, rF: 0, rB: 0 });
    let al = 0.9, vis = 1;
    const out = lt - T.end;
    if (out > 0) { vis = out < 0.06 ? 1 : (hash1(Math.floor(lt * 26)) < 0.4 ? 0.3 : 0.85) * (1 - smooth((out - 0.1) / 0.28)); }
    al *= vis;
    if (al > 0.01) withLayer(g, cam, 1, () => {
      ghostAt(g, gx, GY, S0, -1, gp, al, rev);
      scanLine(g, gx, GY, S0, rev);
      if (out > 0) glitchBars(g, gx, GY, S0, lt, 0.9);
      // pixel dust as it ends
      if (out > 0.05) {
        const v = out - 0.05;
        g.save(); g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 90; i++) {
          const r = rng(6600 + i), px = gx + (r() - 0.5) * 150, py = GY - r() * 300 * S0, vx = (r() - 0.5) * 120, vy = -30 - r() * 160;
          const a = Math.max(0, 1 - v * 0.9) * (0.4 + 0.6 * r());
          g.fillStyle = 'rgba(' + CY + ',' + a + ')'; g.fillRect(px + vx * v, py + vy * v, 2.5 + r() * 3.5, 2.5 + r() * 3.5);
        }
        g.restore();
      }
    });
    // faint cyan thread from ghost's eyes toward hero while it waits
    if (rev >= 1 && out <= 0) {
      const gJ = walkerJoints({ x: gx, y: GY, s: S0, facing: -1, pose: gp }), hJ = walkerJoints({ x: hx, y: GY, s: heroS, facing: 1, pose: hp });
      const la = 0.5 * smooth((lt - 17.2) / 0.8);
      g.save(); g.globalCompositeOperation = 'lighter';
      const x0 = hJ.head.x + 40, y0 = hJ.head.y, x1 = gJ.head.x - 40, y1 = gJ.head.y;
      const lg = g.createLinearGradient(x0, 0, x1, 0);
      lg.addColorStop(0, 'rgba(' + CY + ',0)'); lg.addColorStop(0.2, 'rgba(' + CY + ',' + la + ')'); lg.addColorStop(0.8, 'rgba(' + CY + ',' + la + ')'); lg.addColorStop(1, 'rgba(' + CY + ',0)');
      g.strokeStyle = lg; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.restore();
    }
  }

  // ---- the ring: static 10.0 until the count begins, then ticking toward nothing
  const ra = smooth((lt - T.ringIn) / 0.5);
  if (ra > 0.01) {
    const p = clamp((lt - T.count0) / 10);
    const hs = project(cam, hx + 150, 300, 1);
    const ry = 190 + 6 * Math.sin(lt * 0.8);
    let val = 10 * (1 - p), prog = p;
    if (lt < T.count0) { val = 10; prog = 0; }
    drawTimerRing(g, clamp(hs.x, 420, 1500), ry, 340, { value: val, progress: prog, appear: ra, time: lt });
  }

  drawForeground(g, cam, lt + 40);
}

// ---- outro: like + subscribe (z9 starts 34.2; "like" ~36.1, "subscribe" ~36.9)
const OUT = { in: 33.9, like: 35.65, sub: 36.3, click: 37.1 };
const popK = (t, t0) => { const x = (t - t0) / 0.45; if (x <= 0) return 0; if (x >= 1) return 1; const c = 2.2; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
function rrect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
function drawThumb(g, cx, cy, s, glow) {
  g.save(); g.translate(cx, cy); g.scale(s, s);
  g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff'; g.lineJoin = 'round'; g.lineWidth = 8;
  rrect(g, -86, -6, 44, 92, 8); g.fill();
  g.beginPath(); g.moveTo(-30, 2); g.lineTo(2, -62); g.quadraticCurveTo(12, -92, 36, -80); g.quadraticCurveTo(52, -70, 40, -34); g.lineTo(34, -18);
  g.lineTo(88, -18); g.quadraticCurveTo(110, -14, 104, 8); g.lineTo(98, 52); g.quadraticCurveTo(94, 78, 70, 84); g.lineTo(-30, 84); g.closePath(); g.fill(); g.stroke();
  g.restore();
  if (glow > 0.01) { // cyan ring pulse
    g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(' + CY + ',' + 0.7 * (1 - glow) + ')'; g.lineWidth = 5;
    g.beginPath(); g.arc(cx, cy, 90 + 160 * glow, 0, TAU); g.stroke(); g.restore();
  }
}
function drawBell(g, cx, cy, s, rot) {
  g.save(); g.translate(cx, cy - 34 * s); g.rotate(rot); g.translate(0, 34 * s); g.scale(s, s);
  g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(-34, 22); g.quadraticCurveTo(-30, -2, -26, -22); g.quadraticCurveTo(0, -52, 26, -22); g.quadraticCurveTo(30, -2, 34, 22); g.closePath(); g.fill();
  g.fillRect(-40, 20, 80, 8); g.beginPath(); g.arc(0, 40, 9, 0, TAU); g.fill();
  g.restore();
}
function drawOutro(g, lt) {
  const a = smooth((lt - OUT.in) / 1.0);
  if (a < 0.003) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = 'rgba(6,8,18,' + 0.88 * a + ')'; g.fillRect(0, 0, W, H);
  let gr = g.createRadialGradient(W / 2, 540, 0, W / 2, 540, 700);
  gr.addColorStop(0, 'rgba(60,110,200,' + 0.22 * a + ')'); gr.addColorStop(1, 'rgba(60,110,200,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // like
  const pl = popK(lt, OUT.like);
  if (pl > 0.001) drawThumb(g, 690, 520 - 14 * Math.sin(Math.max(0, lt - OUT.like) * 2.2) * Math.min(1, (lt - OUT.like) / 1), 1.25 * pl, clamp((lt - OUT.like) / 0.7) < 1 ? clamp((lt - OUT.like) / 0.7) : 0);
  // subscribe button
  const ps = popK(lt, OUT.sub), done = lt >= OUT.click + 0.12;
  if (ps > 0.001) {
    const press = lt > OUT.click - 0.1 && lt < OUT.click + 0.25 ? 0.94 : 1;
    g.save(); g.translate(1230, 520); g.scale(ps * press, ps * press);
    g.fillStyle = done ? '#3b3f4c' : '#ff2d3a'; rrect(g, -190, -52, 380, 104, 52); g.fill();
    g.fillStyle = '#fff'; g.font = '700 38px "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(done ? 'SUBSCRIBED' : 'SUBSCRIBE', done ? 26 : 0, 3);
    if (done) { g.restore(); g.save(); const bt = lt - OUT.click - 0.12; drawBell(g, 1115, 520, 0.62, 0.45 * Math.sin(bt * 17) * Math.exp(-bt * 2.2)); }
    g.restore();
    // cursor
    const cx0 = lerp(1520, 1250, smooth((lt - (OUT.sub + 0.3)) / (OUT.click - OUT.sub - 0.4))), cy0 = lerp(700, 545, smooth((lt - (OUT.sub + 0.3)) / (OUT.click - OUT.sub - 0.4)));
    const ca = smooth((lt - (OUT.sub + 0.2)) / 0.3) * (1 - smooth((lt - (OUT.click + 0.8)) / 0.5));
    if (ca > 0.01) {
      g.save(); g.globalAlpha = ca; g.translate(cx0, cy0); g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 46); g.lineTo(12, 36); g.lineTo(22, 58); g.lineTo(31, 53); g.lineTo(21, 32); g.lineTo(36, 31); g.closePath(); g.fill(); g.stroke(); g.restore();
    }
  }
  g.restore();
}

function draw(g, lt, dur) {
  g.save();
  drawLoop(g, lt);
  drawOutro(g, lt);
  let fl = 0, sp = 0;
  const burst = (t0, a, k, split) => { if (lt >= t0) { const e = Math.exp(-(lt - t0) * k); fl += a * e; sp += split * e; } };
  burst(T.quiet, 0.25, 9, 8);
  burst(T.ringIn, 0.28, 8, 6);
  burst(T.gIn[1], 0.2, 8, 5);
  burst(T.end, 0.55, 5, 16);
  if (sp > 0.8) rgbSplit(g, sp);
  if (fl > 0.01) flash(g, clamp(fl), '#ffffff');
  g.restore();
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

CH.ch7 = { draw, T };
})();
