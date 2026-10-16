// ch4b.js — "The Quake" (53.9 s). CH.ch4b.draw(g, lt, dur). Pure function of lt.
// Shots: S1 bills blow away | S2 morning rush + hero freezes + ghost cracks (3.4-11.9) | S4 ghost towers (glass shatter, sway) |
//        S5a seismograph P->S (10 s) | S5b icons light up (lives saved) | S6 three cards (train / surgeon / elevator) |
//        S7 street: no siren, strangers | S8 scream, point, run, crowd follows, QUAKE, dust, aftermath (to the end)
(function () {
'use strict';
const W = 1920, H = 1080;
const T = {
  q1: 0, rush: 3.4, towers: 11.9, scope: 18.2, icons: 23.4, cards: 27.2, street: 33.6,
  eyes: 8.6, glow: 8.8, crackA: 9.0, crackB: 10.9,
  ringIn: 12.2, ringMove: 14.2, crackF: 14.5, glass: 15.45, sway: 16.3,
  P: 20.0, S: 22.85,
  pop1: 27.45, pop2: 29.3, pop3: 31.1,
  siren: 34.0, voice: 35.55, ring: 36.1,
  scream: 41.0, point: 42.05, run: 42.9, quake: 46.1, clear: 48.6, end: 53.893,
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
const MC = {};
function mcol(h) { return MC[h] || (MC[h] = { c: h, d: mixHex(h, '#000000', 0.42), l: mixHex(h, '#ffffff', 0.3) }); }
// cheap crowd figure (feet at x,y; height ~ 200*s)
function mini(g, x, y, s, hex, ph, face, o) {
  o = o || {}; const m = mcol(hex), run = o.run ? 1 : 0, a = Math.sin(ph * TAU) * (run ? 1.05 : 0.6) * (o.idle ? 0.05 : 1);
  const lean = o.lean == null ? (run ? 12 : 3) : o.lean;
  g.save(); g.translate(x, y); g.scale(face * s, s);
  if (!o.noShadow) { g.fillStyle = 'rgba(8,3,18,0.36)'; g.beginPath(); g.ellipse(-6, 1, 34, 6, 0, 0, TAU); g.fill(); }
  if (o.rot) g.rotate(o.rot);
  if (o.crouch) g.scale(1, 1 - 0.24 * o.crouch);
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
  if (o.hands) { // arms thrown up / over the head
    g.strokeStyle = m.c; g.lineWidth = 11; g.beginPath(); g.moveTo(lean, -114); g.lineTo(lean + 18, -168); g.stroke();
  } else arm(a, m.c);
  g.restore();
}
function bill(g, x, y, s, rot, flip, dark) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, flip);
  g.fillStyle = dark ? '#2f7a47' : '#4faa66'; g.fillRect(-28 * s, -13 * s, 56 * s, 26 * s);
  g.fillStyle = dark ? '#5aa771' : '#92d9a3'; g.fillRect(-24 * s, -9.5 * s, 48 * s, 19 * s);
  g.fillStyle = dark ? '#2f7a47' : '#4faa66'; g.beginPath(); g.arc(0, 0, 6.5 * s, 0, TAU); g.fill();
  g.restore();
}
function sparkle(g, x, y, r, a, col) {
  g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = col || 'rgba(255,240,190,1)';
  g.globalAlpha = a; g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill(); g.restore();
}
function txt(g, s, x, y, size, col, al) {
  g.font = '900 ' + size + 'px ' + F_UI; g.textAlign = al || 'center'; g.textBaseline = 'middle'; g.fillStyle = col; g.fillText(s, x, y);
}
const camYc = (y, z) => Math.min(y, 1076 - 540 / z);
function wrapX(x0, d, sp, t, lo, span) { return ((x0 + d * sp * t - lo) % span + span) % span + lo; }

// ---- procedural cracks: segments {x0,y0,x1,y1,o,w}; ky squashes dy for ground-plane cracks
function makeCrack(seed, x0, y0, ang, len, step, ky, spread, nb) {
  const r = rng(seed), segs = []; let maxO = 0;
  function trunk(x, y, a, L, o0, w, depth) {
    let o = o0, run = 0, k = 0;
    while (run < L) {
      a += (r() - 0.5) * spread;
      const s = step * (0.6 + r() * 0.8), nx = x + Math.cos(a) * s, ny = y + Math.sin(a) * s * ky;
      segs.push({ x0: x, y0: y, x1: nx, y1: ny, o, w });
      x = nx; y = ny; run += s; o += s; k++; if (o > maxO) maxO = o;
      if (depth < 2 && k > 2 && r() < nb) trunk(x, y, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.7), L * (0.25 + r() * 0.35) * (depth ? 0.6 : 1), o, w * 0.62, depth + 1);
    }
  }
  trunk(x0, y0, ang, len, 0, 1, 0);
  segs.maxO = maxO || 1;
  return segs;
}
function drawCrack(g, segs, p, wBase, colGlow, colCore, aGlow) {
  const lim = p * segs.maxO * 1.0001;
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    g.strokeStyle = pass ? colCore : colGlow; g.globalAlpha = pass ? 1 : aGlow;
    for (let tier = 1; tier >= 0; tier--) {
      g.beginPath(); let any = false;
      for (const s of segs) {
        if (s.o > lim) continue;
        if ((s.w > 0.8 ? 1 : 0) !== tier) continue;
        g.moveTo(s.x0, s.y0); g.lineTo(s.x1, s.y1); any = true;
      }
      if (any) { g.lineWidth = (pass ? 0.34 : 1.0) * wBase * (tier ? 1 : 0.55); g.stroke(); }
    }
  }
  g.restore();
}

// ---- street helpers (world.js)
const HEX = ['#3b7dd8', '#e0a83a', '#7a5ad8', '#2faa8a', '#d85a8a', '#8a9aa8', '#5aa84a', '#c8643a'];
function cabs(g, cam, fn) { withLayer(g, cam, 1, fn); }
function roll(g, r) { if (r) { g.translate(W / 2, H / 2); g.rotate(r); g.translate(-W / 2, -H / 2); } }
function arcs(g, x, y, fc, t0, t, n, col, R) {
  g.save(); g.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const u = (t - t0 - k * 0.2) / 0.75; if (u <= 0 || u >= 1) continue;
    const r = 34 + R * easeOut(u), a = 0.85 * (1 - u);
    g.strokeStyle = col.replace('A', a); g.lineWidth = 7 * (1 - u * 0.6) + 2;
    g.beginPath(); g.arc(x, y, r, fc > 0 ? -0.75 : Math.PI - 0.75, fc > 0 ? 0.75 : Math.PI + 0.75); g.stroke();
  }
  g.restore();
}
function ringAt(g, lt, cx, cy, diam, val, prog, ap) {
  drawTimerRing(g, cx, cy, diam, { value: val, progress: prog, appear: ap, time: lt });
}

// ================================================================== S1: bills blow away
const BILLS = (() => { const r = rng(515), a = []; for (let i = 0; i < 46; i++) a.push({ t0: 0.05 + r() * 1.7, y: 150 + r() * 760, v: 1000 + r() * 900, ph: r() * TAU, sp: 3 + r() * 6, amp: 40 + r() * 90, s: 0.8 + r() * 0.9, dk: r() < 0.4, sy: r() < 0.5 ? -1 : 1 }); return a; })();
function shotS1(g, lt) {
  const z1 = 1.12 + 0.045 * lt, cam = { x: 905 + 14 * lt, y: camYc(612, z1), z: z1 };
  g.save();
  drawWorld(g, cam, lt);
  const wind = smooth((lt - 1.9) / 0.5);
  const hero = { x: 900, y: 820, s: 0.92, facing: 1, walk: 0, lean: 0.03 - 0.07 * wind, eyeOpen: 1, eyeGlow: 0.3, bob: 0.4, t: lt, flutter: 0.5 * wind, phase: 0 };
  cabs(g, cam, () => man(g, hero));
  // coat tails / hair flutter handled by the rig; bills sweep across the whole screen
  addMode(g, () => { rg(g, 1500 - 600 * (lt / 3.4), 520, 520, [[0, 'rgba(120,255,160,0.10)'], [1, 'rgba(120,255,160,0)']]); });
  for (const b of BILLS) {
    const u = lt - b.t0; if (u < 0) continue;
    const x = -140 + b.v * u * (0.85 + 0.3 * smooth((lt - 1.9) / 0.4)), y = b.y + Math.sin(u * b.sp + b.ph) * b.amp - 40 * u;
    if (x > W + 120) continue;
    bill(g, x, y, b.s, u * b.sp * 0.9 + b.ph, Math.cos(u * b.sp * 1.3 + b.ph) * b.sy, b.dk);
    if (((b.ph * 7) | 0) % 3 === 0) sparkle(g, x + 10, y - 12, 9 * b.s, 0.5 + 0.5 * Math.sin(u * 9 + b.ph), 'rgba(200,255,210,1)');
  }
  g.restore();
}

// ================================================================== S2/S3: morning rush, hero freezes, ghost cracks
const RUSH = (() => { const r = rng(7001), a = []; for (let i = 0; i < 46; i++) a.push({ x0: r() * 3600 - 900, d: r() < 0.5 ? -1 : 1, sp: 60 + r() * 70, y: 824 + r() * 30, s: 0.96 + r() * 0.16, hex: HEX[i % 8], id: i }); return a; })();
const FARPPL = (() => { const r = rng(7002), a = []; for (let i = 0; i < 26; i++) a.push({ x0: r() * 4400 - 1300, d: r() < 0.5 ? -1 : 1, sp: 40 + r() * 40, s: 0.5 + r() * 0.08, hex: HEX[(i * 3) % 8] }); return a; })();
const CARS = [{ x0: -300, v: 360, y: 868, s: 1.0, lane: 'far' }, { x0: 2500, v: -330, y: 985, s: 1.08, lane: 'near' }, { x0: 700, v: 280, y: 905, s: 1.0, lane: 'mid' }, { x0: 2100, v: -400, y: 868, s: 1.0, lane: 'far' }];
const CRACK_R = makeCrack(31, 2650, 925, Math.PI, 2100, 42, 0.32, 0.9, 0.16);
const CRACK_R2 = makeCrack(77, 2100, 1000, Math.PI + 0.1, 1500, 46, 0.3, 0.85, 0.12);
const CRACK_R3 = makeCrack(91, 2000, 880, Math.PI - 0.1, 1100, 38, 0.3, 0.8, 0.14);
const crowdTime = (lt) => (lt < T.glow ? lt : T.glow + (lt - T.glow) * 0.1);
function shotRush(g, lt) {
  const pull = smooth((lt - T.rush) / 2.0), push = clamp(spring(lt - 8.45, 60, 13));
  let z = lerp(1.08, 0.86, pull);
  z = lerp(z, 1.0, push);
  const cam = { x: 900 + 120 * Math.sin((lt - 3.4) * 0.4) * (1 - push), y: camYc(lerp(600, 640, push), z), z, r: 0 };
  g.save();
  drawWorld(g, cam, lt);
  const tc = crowdTime(lt), vis = lt >= T.glow;
  const ents = [];
  for (const p of RUSH) {
    const x = wrapX(p.x0, p.d, p.sp, tc, -900, 3600);
    ents.push({ y: p.y, d: () => mini(g, x, p.y, p.s, p.hex, x / (110 * p.s) * p.d, p.d, {})});
  }
  for (const p of FARPPL) {
    const x = wrapX(p.x0, p.d, p.sp, tc, -1300, 4400);
    ents.push({ y: 815, d: () => mini(g, x, 815, p.s, p.hex, x / (60 * p.s) * p.d, p.d, { noShadow: true }) });
  }
  for (const c of CARS) {
    const x = wrapX(c.x0, 1, c.v, tc, -700, 3800);
    ents.push({ y: c.y + 20, d: () => drawCar(g, { x, y: c.y, s: c.s, pal: PAL_REAL, alpha: 1, wheel: x / 60, shadow: true }) });
  }
  const hp = Math.min(1, clamp((lt - 8.3) / 0.25));
  const hero = { x: CHAR_X, y: 820, s: 0.92, facing: 1, walk: 0, phone: 1 - hp, headDown: lerp(0.4, 0.02, hp), lean: lerp(0.1, 0.02, hp), bob: 0.5, t: lt, phase: 0,
    eyeOpen: clamp(spring(lt - T.eyes, 260, 24)), eyeGlow: clamp(spring(lt - T.glow, 200, 22)), flutter: 0.35 * win(lt, 8.7, 11.3, 0.1, 0.6) };
  if (lt < 8.3) hero.walk = 0.0;
  withLayer(g, cam, 1, () => {
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) if (e.y < 821 || e.y > 822) e.d();
    if (!vis) man(g, hero);
  });
  if (vis) {
    const vg = 0.85 * easeOut((lt - T.glow) / 0.3);
    visionGrade(g, vg);
    // ghost world: cracks race across the road toward him
    const pk = easeInOut(clamp((lt - T.crackA) / (T.crackB - T.crackA)));
    withLayer(g, cam, 1, () => {
      g.save();
      addMode(g, () => {
        for (let i = 0; i < 3; i++) {
          const u = lt - 8.95 - i * 0.28; if (u <= 0 || u > 1.4) continue;
          const e = easeOut(u / 1.4);
          g.strokeStyle = 'rgba(90,220,255,' + 0.5 * (1 - e) + ')'; g.lineWidth = 6 * (1 - e) + 1;
          g.beginPath(); g.ellipse(2100 - 700 * e, 925, 260 + 1500 * e, (260 + 1500 * e) * 0.18, 0, 0, TAU); g.stroke();
        }
        const pulse = 0.75 + 0.25 * Math.sin(lt * 11);
        drawCrack(g, CRACK_R, pk, 16, 'rgba(70,200,255,1)', 'rgba(215,250,255,1)', 0.35 * pulse);
        drawCrack(g, CRACK_R2, clamp(pk * 1.2 - 0.1), 12, 'rgba(70,200,255,1)', 'rgba(215,250,255,1)', 0.3 * pulse);
        drawCrack(g, CRACK_R3, clamp(pk * 1.1 - 0.15), 10, 'rgba(70,200,255,1)', 'rgba(215,250,255,1)', 0.3 * pulse);
        // ghost debris dust floating up out of the cracks
        const r = rng(444);
        for (let i = 0; i < 26; i++) {
          const x = 700 + r() * 1700, y0 = 880 + r() * 170, t0 = T.crackA + 0.2 + r() * 1.4, u = lt - t0; if (u < 0) continue;
          const a = 0.7 * Math.exp(-u * 0.9) * clamp(u * 4), px = x - 30 * u, py = y0 - (60 + r() * 120) * u;
          rg(g, px, py, 5 + r() * 9, [[0, 'rgba(160,240,255,' + a + ')'], [1, 'rgba(100,220,255,0)']]);
        }
      });
      g.restore();
      man(g, hero);
    });
  }
  g.restore();
  // short push on the freeze
  if (lt > 8.6 && lt < 9.0) { const a = 0.35 * Math.exp(-(lt - 8.8) * 12) * smooth((lt - 8.6) / 0.05); if (a > 0.01) { g.save(); g.globalAlpha = a; g.fillStyle = '#bff6ff'; g.fillRect(0, 0, W, H); g.restore(); } }
  // "ten million": tiny people chip
  const ca = win(lt, 5.35, 7.3, 0.25, 0.3);
  if (ca > 0.01) {
    g.save(); g.globalAlpha = ca; g.translate(1560, 170 + (1 - ca) * 14);
    g.fillStyle = 'rgba(10,6,24,0.72)'; rr(g, -150, -46, 300, 92, 46); g.fill();
    g.strokeStyle = 'rgba(255,220,150,0.8)'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#ffd58a';
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(-92 + k * 20, -14, 7, 0, TAU); g.fill(); g.beginPath(); g.moveTo(-102 + k * 20, 20); g.quadraticCurveTo(-102 + k * 20, -2, -92 + k * 20, -2); g.quadraticCurveTo(-82 + k * 20, -2, -82 + k * 20, 20); g.fill(); }
    txt(g, '10M', 44, 2, 56, '#fff1d6');
    g.restore();
  }
}

// ================================================================== S4: ghost towers
const TOWERS = [
  { cx: 250, w: 300, h: 760, ph: 0.0, seed: 11 }, { cx: 600, w: 340, h: 840, ph: 1.7, seed: 12 }, { cx: 1000, w: 400, h: 905, ph: 3.1, seed: 13 },
  { cx: 1400, w: 330, h: 830, ph: 4.6, seed: 14 }, { cx: 1720, w: 300, h: 690, ph: 0.9, seed: 15 },
];
const TBASE = 1010;
const WCW = 46, WCH = 60;
function towerCache(i) {
  const tw = TOWERS[i];
  return layer('tw' + i, tw.w + 20, tw.h + 10, (c, w, h) => {
    const r = rng(tw.seed);
    c.translate(10, 5);
    c.fillStyle = lg(c, 0, 0, tw.w, 0, [[0, '#0a1a38'], [0.5, '#0d2347'], [1, '#07142c']]); c.fillRect(0, 0, tw.w, tw.h);
    // sheen stripe
    c.fillStyle = 'rgba(120,220,255,0.06)'; c.beginPath(); c.moveTo(tw.w * 0.15, 0); c.lineTo(tw.w * 0.45, 0); c.lineTo(tw.w * 0.1, tw.h); c.lineTo(-tw.w * 0.2, tw.h); c.closePath(); c.fill();
    const cols = Math.floor((tw.w - 26) / WCW), rows = Math.floor((tw.h - 50) / WCH);
    for (let rI = 0; rI < rows; rI++) for (let cI = 0; cI < cols; cI++) {
      const x = 18 + cI * WCW + (tw.w - 26 - cols * WCW) / 2, y = 30 + rI * WCH, lit = r() < 0.62, a = lit ? 0.22 + r() * 0.5 : 0.07;
      c.fillStyle = lit ? 'rgba(90,205,255,' + a + ')' : 'rgba(30,80,130,0.35)'; c.fillRect(x, y, 32, 42);
      c.strokeStyle = 'rgba(120,225,255,0.18)'; c.lineWidth = 1.5; c.strokeRect(x, y, 32, 42);
    }
    c.strokeStyle = 'rgba(110,225,255,0.85)'; c.lineWidth = 3.5; c.strokeRect(0, 0, tw.w, tw.h);
    c.strokeStyle = 'rgba(110,225,255,0.2)'; c.lineWidth = 1.5;
    for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(k * tw.w / 4, 0); c.lineTo(k * tw.w / 4, tw.h); c.stroke(); }
  });
}
// breaking windows
const BREAKS = (() => {
  const out = [], r = rng(909);
  [1, 2, 3, 0, 4].forEach((ti, k) => {
    const tw = TOWERS[ti], cols = Math.floor((tw.w - 26) / WCW), rows = Math.floor((tw.h - 50) / WCH), n = k < 3 ? 34 : 18;
    for (let i = 0; i < n; i++) {
      const cI = (r() * cols) | 0, rI = 3 + ((r() * (rows - 12)) | 0);
      const x = 18 + cI * WCW + (tw.w - 26 - cols * WCW) / 2 + 16 - tw.w / 2, y = -tw.h + 30 + rI * WCH + 21;
      if (TBASE + y < 60 || TBASE + y > 900) continue;
      const tb = T.glass + r() * 0.9 + (ti === 2 ? 0 : 0.12), sh = [];
      for (let q = 0; q < 3; q++) sh.push({ vx: (r() - 0.5) * 220, vy: -60 - r() * 120, rv: (r() - 0.5) * 12, a0: r() * TAU, sz: 12 + r() * 18 });
      out.push({ ti, x, y, tb, sh });
    }
  });
  return out;
})();
const FACADE = makeCrack(55, 0, -520, -Math.PI / 2, 560, 34, 1.0, 0.8, 0.22);
const FACADE2 = makeCrack(56, 0, -300, Math.PI / 2 - 0.2, 300, 30, 1.0, 0.8, 0.2);
const GROUNDC = makeCrack(57, 960, TBASE, 0, 1100, 40, 0.18, 0.7, 0.2);
const GROUNDC2 = makeCrack(58, 960, TBASE, Math.PI, 1100, 40, 0.18, 0.7, 0.2);
const scanLayer = () => layer('scan', 4, 6, (c) => { c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(0, 0, 4, 2); });
function ghostBG(g) {
  const c = layer('ghostbg', W, H, (x) => {
    x.fillStyle = lg(x, 0, 0, 0, H, [[0, '#030816'], [0.6, '#08183a'], [1, '#0b2a52']]); x.fillRect(0, 0, W, H);
    const r = rng(61); for (let i = 0; i < 90; i++) { x.fillStyle = 'rgba(150,220,255,' + (0.2 + r() * 0.5) + ')'; x.fillRect(r() * W, r() * 700, 2, 2); }
  });
  g.drawImage(c, 0, 0);
}
function shotTowers(g, lt) {
  const u = lt - T.towers;
  const camY = -22 * smooth(u / 6.3);
  g.save();
  ghostBG(g);
  const sk = lt > T.sway ? shakeAt(lt, T.sway, 3, 0.7, 24) : { x: 0, y: 0, r: 0 };
  const ampS = 0.004 + 0.034 * smooth((lt - T.sway) / 0.9);
  g.translate(sk.x, camY + sk.y);
  const tIn = smooth(u / 1.0);
  // ground fog
  for (let i = 0; i < TOWERS.length; i++) {
    const tw = TOWERS[i], ang = ampS * Math.sin((lt - 11.9) * 2.6 + tw.ph) * (i & 1 ? 1 : -1) * 1.0;
    g.save(); g.globalAlpha = tIn * (0.55 + 0.1 * i * 0 + (i === 2 ? 0.45 : 0.25));
    g.translate(tw.cx, TBASE); g.rotate(ang);
    g.drawImage(towerCache(i), -tw.w / 2 - 10, -tw.h - 5);
    g.globalAlpha = 1;
    // facade cracks on the middle tower
    if (i === 2 && lt >= T.crackF) {
      const p = easeOut((lt - T.crackF) / 0.9);
      addMode(g, () => { drawCrack(g, FACADE, p, 14, 'rgba(70,200,255,1)', 'rgba(225,252,255,1)', 0.4); drawCrack(g, FACADE2, p, 12, 'rgba(70,200,255,1)', 'rgba(225,252,255,1)', 0.4); });
    }
    // broken windows
    for (const b of BREAKS) {
      if (b.ti !== i || lt < b.tb - 0.1) continue;
      const bu = lt - b.tb;
      if (bu < 0) { addMode(g, () => { g.fillStyle = 'rgba(220,250,255,' + (0.8 * (bu + 0.1) / 0.1) + ')'; g.fillRect(b.x - 16, b.y - 21, 32, 42); }); continue; }
      g.fillStyle = '#030a18'; g.fillRect(b.x - 17, b.y - 22, 34, 44);
      g.strokeStyle = 'rgba(160,240,255,0.7)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(b.x - 15, b.y - 18); g.lineTo(b.x + 3, b.y + 2); g.lineTo(b.x + 14, b.y - 12); g.moveTo(b.x + 3, b.y + 2); g.lineTo(b.x - 6, b.y + 20); g.stroke();
    }
    g.restore();
  }
  // falling shards (screen space, not swaying)
  addMode(g, () => {
    for (const b of BREAKS) {
      const bu = lt - b.tb; if (bu < 0 || bu > 2.4) continue;
      const tw = TOWERS[b.ti], ang = ampS * Math.sin((lt - 11.9) * 2.6 + tw.ph) * (b.ti & 1 ? 1 : -1);
      const bx = tw.cx + b.x * Math.cos(ang) - b.y * Math.sin(ang), by = TBASE + b.x * Math.sin(ang) + b.y * Math.cos(ang);
      const a = Math.min(1, (2.4 - bu) / 0.8);
      for (const s of b.sh) {
        const x = bx + s.vx * bu, y = by + s.vy * bu + 0.5 * 1500 * bu * bu, rot = s.a0 + s.rv * bu;
        g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = a * 0.9;
        g.fillStyle = 'rgba(170,240,255,0.9)'; g.beginPath(); g.moveTo(-s.sz * 0.5, s.sz * 0.5); g.lineTo(s.sz * 0.6, 0); g.lineTo(-s.sz * 0.1, -s.sz * 0.7); g.closePath(); g.fill();
        g.restore();
      }
    }
  });
  g.restore();
  // ground cracks + bottom fog (screen space)
  g.save(); g.translate(0, camY);
  const gf = layer('gfog', W, 360, (c) => { c.fillStyle = lg(c, 0, 0, 0, 360, [[0, 'rgba(20,60,110,0)'], [1, 'rgba(25,80,140,0.75)']]); c.fillRect(0, 0, W, 360); });
  g.drawImage(gf, 0, TBASE - 130);
  g.fillStyle = '#050d20'; g.fillRect(0, TBASE + 22, W, 260);
  g.strokeStyle = 'rgba(100,220,255,0.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, TBASE + 22); g.lineTo(W, TBASE + 22); g.stroke();
  if (lt >= T.crackF) {
    const p = easeOut((lt - T.crackF - 0.2) / 1.0);
    addMode(g, () => { drawCrack(g, GROUNDC, p, 16, 'rgba(70,200,255,1)', 'rgba(225,252,255,1)', 0.4); drawCrack(g, GROUNDC2, p, 16, 'rgba(70,200,255,1)', 'rgba(225,252,255,1)', 0.4); });
  }
  g.restore();
  // scanlines
  g.save(); g.globalAlpha = 0.5; g.fillStyle = g.createPattern(scanLayer(), 'repeat'); g.fillRect(0, 0, W, H); g.restore();
  // 10 ring: big in the centre, then tucks into the corner
  const k = smooth((lt - T.ringMove) / 0.55);
  const cx = lerp(960, 1730, k), cy = lerp(470, 190, k), d = lerp(560, 270, k);
  ringAt(g, lt, cx, cy, d, 10, 0.0, smooth((lt - T.ringIn) / 0.4) * (1 - 0 * k));
}

// ================================================================== S5a: seismograph, P -> S = about 10 s
function trace(tau) {
  const n = Math.sin(tau * 31) * 3 + Math.sin(tau * 53 + 1) * 3 + Math.sin(tau * 11) * 2;
  const tP = T.P - T.scope, tS = T.S - T.scope;
  let v = n;
  if (tau > tP) { const e = 1 - Math.exp(-(tau - tP) * 9); v += e * 34 * Math.sin((tau - tP) * 40) * (0.6 + 0.4 * Math.sin(tau * 7)); }
  if (tau > tS) { const e = 1 - Math.exp(-(tau - tS) * 8); v += e * 150 * Math.sin((tau - tS) * 22) * (0.8 + 0.2 * Math.sin(tau * 5)); }
  return v;
}
function shotScope(g, lt) {
  const u = lt - T.scope, sk = shakeAt(lt, T.S, 14, 5, 30);
  g.save();
  g.fillStyle = lg(g, 0, 0, 0, H, [[0, '#04101f'], [1, '#071a33']]); g.fillRect(0, 0, W, H);
  g.translate(sk.x, sk.y);
  // grid
  const grid = layer('scopegrid', W, H, (c) => {
    c.strokeStyle = 'rgba(80,200,255,0.10)'; c.lineWidth = 1;
    for (let x = 0; x <= W; x += 80) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y <= H; y += 80) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.strokeStyle = 'rgba(80,200,255,0.3)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 560); c.lineTo(W, 560); c.stroke();
  });
  g.drawImage(grid, 0, 0);
  const x0 = 140, sc = 1640 / 5.2, base = 610, xh = x0 + clamp(u) * 0 + Math.min(u, 5.2) * sc;
  // trace
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  const tauMax = Math.min(u, 5.2), N = Math.floor(tauMax * 120);
  const path = new Path2D();
  for (let i = 0; i <= N; i++) { const tau = i / 120, x = x0 + tau * sc, y = base - trace(tau) * 1.7; if (i === 0) path.moveTo(x, y); else path.lineTo(x, y); }
  addMode(g, () => { g.strokeStyle = 'rgba(70,200,255,0.35)'; g.lineWidth = 14; g.stroke(path); });
  g.strokeStyle = '#d8fbff'; g.lineWidth = 3.4; g.stroke(path);
  const hy = base - trace(tauMax) * 1.7; rg(g, xh, hy, 26, [[0, 'rgba(255,255,255,0.95)'], [0.3, 'rgba(120,230,255,0.6)'], [1, 'rgba(60,200,255,0)']]);
  g.restore();
  // P and S markers
  const xP = x0 + (T.P - T.scope) * sc, xS = x0 + (T.S - T.scope) * sc;
  const pa = smooth((lt - T.P) / 0.12), sa = smooth((lt - T.S) / 0.1);
  if (pa > 0) {
    g.save(); g.globalAlpha = pa; g.strokeStyle = 'rgba(255,214,120,0.9)'; g.lineWidth = 3; g.setLineDash([12, 10]); g.beginPath(); g.moveTo(xP, 330); g.lineTo(xP, 880); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#ffd58a'; g.beginPath(); g.arc(xP, 330, 34, 0, TAU); g.fill(); txt(g, "P", xP, 332, 40, '#2a1a06'); g.restore();
  }
  if (sa > 0) {
    g.save(); g.globalAlpha = sa; g.strokeStyle = 'rgba(255,90,100,0.9)'; g.lineWidth = 3; g.setLineDash([12, 10]); g.beginPath(); g.moveTo(xS, 330); g.lineTo(xS, 880); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#ff5a68'; g.beginPath(); g.arc(xS, 330, 34, 0, TAU); g.fill(); txt(g, "S", xS, 332, 40, '#fff'); g.restore();
  }
  // the 10-second bracket between them, growing with the trace
  if (lt > T.P) {
    const xe = Math.min(xh, xS), by = 940;
    g.save(); g.strokeStyle = 'rgba(127,233,255,0.95)'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(xP, by); g.lineTo(xe, by); g.moveTo(xP, by - 18); g.lineTo(xP, by + 18); g.stroke();
    if (xe >= xS - 1) { g.beginPath(); g.moveTo(xS, by - 18); g.lineTo(xS, by + 18); g.stroke(); }
    g.restore();
    const pr = clamp((xh - xP) / (xS - xP));
    ringAt(g, lt, (xP + xS) / 2, 160, 240, Math.max(0, 10 * (1 - pr)), pr, smooth((lt - T.P - 0.15) / 0.4));
  }
  // alert pulses on the P arrival
  for (let k = 0; k < 3; k++) { const e = (lt - T.P - k * 0.22) / 0.9; if (e > 0 && e < 1) { addMode(g, () => { g.strokeStyle = 'rgba(255,214,120,' + 0.5 * (1 - e) + ')'; g.lineWidth = 5; g.beginPath(); g.arc(xP, base - trace(T.P - T.scope + 0.05) * 1.7, 40 + 200 * easeOut(e), 0, TAU); g.stroke(); }); } }
  g.restore();
  // S-wave hit flash
  const fl = 0.35 * Math.exp(-(lt - T.S) * 10) * (lt >= T.S ? 1 : 0);
  if (fl > 0.01) { g.save(); g.globalAlpha = fl; g.fillStyle = '#ffd6d6'; g.fillRect(0, 0, W, H); g.restore(); }
  g.save(); g.globalAlpha = 0.4; g.fillStyle = g.createPattern(scanLayer(), 'repeat'); g.fillRect(0, 0, W, H); g.restore();
}

// ================================================================== S5b: icons light up = lives saved
function icon(g, x, y, k, col) {
  g.fillStyle = col; g.beginPath(); g.arc(x, y - 17 * k, 9.5 * k, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(x - 14 * k, y + 22 * k); g.quadraticCurveTo(x - 15 * k, y - 4 * k, x, y - 5 * k); g.quadraticCurveTo(x + 15 * k, y - 4 * k, x + 14 * k, y + 22 * k); g.closePath(); g.fill();
}
const GRID_I = (() => { const r = rng(8123), a = []; for (let rI = 0; rI < 8; rI++) for (let c = 0; c < 22; c++) a.push({ c, rI, tl: 23.75 + (c / 22) * 1.25 + r() * 0.55 + rI * 0.03 }); return a; })();
function shotIcons(g, lt) {
  g.save();
  g.fillStyle = lg(g, 0, 0, 0, H, [[0, '#04101f'], [1, '#08203a']]); g.fillRect(0, 0, W, H);
  const gl = smooth((lt - 24.6) / 1.4);
  addMode(g, () => rg(g, 960, 540, 1000, [[0, 'rgba(70,240,160,' + 0.14 * gl + ')'], [1, 'rgba(70,240,160,0)']]));
  const x0 = 960 - 21 * 36, y0 = 330;
  for (const it of GRID_I) {
    const x = x0 + it.c * 72, y = y0 + it.rI * 78, u = lt - it.tl;
    if (u < 0) { icon(g, x, y, 1, 'rgba(40,70,110,0.8)'); continue; }
    const pop = 1 + 0.35 * Math.exp(-u * 7) * Math.sin(u * 14 + 1.2) + 0.1 * Math.exp(-u * 5);
    const col = mixHex('#c8fff0', '#52e89c', smooth(u / 0.5));
    if (u < 0.45) addMode(g, () => rg(g, x, y, 44, [[0, 'rgba(160,255,220,' + 0.55 * (1 - u / 0.45) + ')'], [1, 'rgba(160,255,220,0)']]));
    icon(g, x, y + 8 * (1 - pop) * 0, pop, col);
  }
  // heart-beat pulse rings after everything is lit
  for (let k = 0; k < 3; k++) {
    const e = (lt - 25.45 - k * 0.5) / 1.3; if (e > 0 && e < 1) addMode(g, () => { g.strokeStyle = 'rgba(90,255,170,' + 0.35 * (1 - e) + ')'; g.lineWidth = 6; g.beginPath(); g.ellipse(960, 560, 120 + 1300 * easeOut(e), (120 + 1300 * easeOut(e)) * 0.5, 0, 0, TAU); g.stroke(); });
  }
  g.restore();
  g.save(); g.globalAlpha = 0.35; g.fillStyle = g.createPattern(scanLayer(), 'repeat'); g.fillRect(0, 0, W, H); g.restore();
}

// ================================================================== S6: three cards
function card(g, cx, cy, tPop, lt, accent, inner) {
  const u = lt - tPop; if (u < -0.02) return;
  const p = clamp(spring(u, 190, 15), 0, 1.2), s = lerp(0.55, 1, p), al = clamp(u / 0.1);
  g.save(); g.globalAlpha = al; g.translate(cx, cy + (1 - p) * 60); g.rotate((1 - p) * 0.12); g.scale(s, s);
  g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 40; g.fillStyle = '#0b1a30'; rr(g, -260, -320, 520, 640, 36); g.fill(); g.shadowBlur = 0;
  g.save(); rr(g, -260, -320, 520, 640, 36); g.clip();
  inner(g, Math.max(0, u));
  g.restore();
  g.strokeStyle = accent; g.lineWidth = 6; rr(g, -260, -320, 520, 640, 36); g.stroke();
  g.restore();
}
function vTrain(g, u) {
  g.fillStyle = lg(g, 0, -320, 0, 320, [[0, '#13355e'], [1, '#07142a']]); g.fillRect(-260, -320, 520, 640);
  const v0 = 900, off = v0 * (u - rampInt(u, 1.6)), sp = u < 1.6 ? v0 * (1 - smooth(u / 1.6)) : 0;
  // poles + skyline scrolling backwards
  g.fillStyle = 'rgba(30,70,120,0.7)'; for (let i = 0; i < 6; i++) { const x = ((i * 190 - off * 0.35) % 1140 + 1140) % 1140 - 400; g.fillRect(x, -60, 80, 140 + (i * 53 % 90)); }
  g.fillStyle = '#0a1830'; g.fillRect(-260, 150, 520, 170);
  g.strokeStyle = '#6a86aa'; g.lineWidth = 6; g.beginPath(); g.moveTo(-260, 156); g.lineTo(260, 156); g.stroke();
  g.strokeStyle = '#27405e'; g.lineWidth = 8; for (let i = 0; i < 12; i++) { const x = ((i * 70 - off) % 840 + 840) % 840 - 300; g.beginPath(); g.moveTo(x, 164); g.lineTo(x - 12, 190); g.stroke(); }
  for (let i = 0; i < 3; i++) { const x = ((i * 330 - off * 0.9) % 990 + 990) % 990 - 350; g.fillStyle = '#35506f'; g.fillRect(x, -220, 8, 380); }
  // signal
  const red = smooth((u - 0.2) / 0.1);
  g.fillStyle = '#16263e'; g.fillRect(200, -250, 26, 74); g.fillStyle = mixHex('#31e08a', '#ff4a4a', red);
  g.beginPath(); g.arc(213, -228, 10, 0, TAU); g.fill(); addMode(g, () => rg(g, 213, -228, 52, [[0, red > 0.5 ? 'rgba(255,60,60,0.7)' : 'rgba(60,255,150,0.6)'], [1, 'rgba(255,60,60,0)']]));
  // train
  const dip = 0.02 * Math.min(1, sp / 400) + 0.015 * Math.exp(-Math.max(0, u - 1.6) * 6) * Math.sin(u * 24);
  g.save(); g.translate(-30, 150); g.rotate(-dip); g.translate(30, -150);
  g.fillStyle = '#e4ecf8'; g.beginPath(); g.moveTo(-290, 140); g.lineTo(-290, 20); g.quadraticCurveTo(-290, 0, -270, 0); g.lineTo(80, 0); g.quadraticCurveTo(210, 4, 262, 110); g.quadraticCurveTo(272, 136, 240, 142); g.closePath(); g.fill();
  g.fillStyle = '#2f6fd6'; g.fillRect(-290, 92, 560, 16);
  g.fillStyle = '#1a2a46'; for (let i = 0; i < 4; i++) { rr(g, -250 + i * 78, 26, 58, 46, 10); g.fill(); }
  g.beginPath(); g.moveTo(90, 26); g.quadraticCurveTo(160, 28, 200, 74); g.lineTo(90, 74); g.closePath(); g.fill();
  g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(250, 112, 8, 0, TAU); g.fill();
  g.restore();
  // wheels
  for (const wx of [-200, -110, 90, 180]) {
    g.save(); g.translate(wx, 150); g.rotate(off / 22); g.fillStyle = '#26354d'; g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.fill();
    g.strokeStyle = '#8fa6c6'; g.lineWidth = 3; for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(-18, 0); g.lineTo(18, 0); g.stroke(); } g.restore();
  }
  // brake sparks
  if (u > 0.15 && u < 1.8) addMode(g, () => {
    const r = rng(33);
    for (let i = 0; i < 16; i++) { const t0 = r() * 0.4, ph = ((u * 3.2 + t0) % 0.4) / 0.4, wx = [-200, -110, 90, 180][i & 3]; const x = wx - 20 - 90 * ph * (0.4 + r()), y = 170 - 40 * ph + 90 * ph * ph + (r() - 0.5) * 10;
      g.fillStyle = 'rgba(255,' + (170 + r() * 60 | 0) + ',80,' + (1 - ph) * Math.min(1, (1.8 - u) / 0.5) + ')'; g.fillRect(x, y, 6, 3); }
  });
  // speed lines fade as it slows
  if (sp > 30) { g.strokeStyle = 'rgba(200,230,255,' + 0.35 * sp / v0 + ')'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { const y = -120 + i * 40, x = ((i * 130 + u * 1500) % 560) - 280; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 140 * sp / v0, y); g.stroke(); } }
}
function vSurgeon(g, u) {
  g.fillStyle = lg(g, 0, -320, 0, 320, [[0, '#0f3a3c'], [1, '#07181f']]); g.fillRect(-260, -320, 520, 640);
  // lamp cone
  g.fillStyle = 'rgba(190,255,240,0.1)'; g.beginPath(); g.moveTo(-60, -250); g.lineTo(60, -250); g.lineTo(230, 160); g.lineTo(-230, 160); g.closePath(); g.fill();
  g.fillStyle = '#9fb7c0'; g.fillRect(-4, -320, 8, 80); g.fillStyle = '#dfeef2'; g.beginPath(); g.ellipse(0, -240, 80, 22, 0, 0, TAU); g.fill();
  // table + patient
  g.fillStyle = '#2b4658'; rr(g, -220, 150, 440, 34, 12); g.fill(); g.fillStyle = '#1b2f40'; g.fillRect(-12, 184, 24, 120);
  g.fillStyle = '#e4b18c'; rr(g, -190, 100, 100, 54, 27); g.fill();
  g.fillStyle = '#2a9a88'; rr(g, -120, 104, 330, 52, 22); g.fill(); g.strokeStyle = '#1b7568'; g.lineWidth = 3; g.stroke();
  // monitor
  g.fillStyle = '#0c1620'; rr(g, 130, -40, 100, 80, 10); g.fill(); g.strokeStyle = '#2a4258'; g.lineWidth = 3; g.stroke();
  g.strokeStyle = '#58f0a0'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i <= 40; i++) { const x = 140 + i * 2.2, ph = ((i * 0.06 + u * 1.5) % 1), y = 0 - (ph > 0.45 && ph < 0.52 ? 30 : ph > 0.52 && ph < 0.58 ? -14 : 0); if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
  // surgeon's arms: working over the patient, then pulled up and away
  const pu = clamp(spring(u - 0.55, 120, 11)), work = 1 - smooth((u - 0.5) / 0.1);
  for (const sd of [-1, 1]) {
    const sx = sd * 200, sy = -300, hx = lerp(sd * 28 + sd * 6 * Math.sin(u * 12) * work, sd * 190, pu), hy = lerp(60 + 5 * Math.sin(u * 14 + sd) * work, -150, pu);
    const lift = (1 - pu) * 0;
    g.lineCap = 'round'; g.strokeStyle = '#2a8f9a'; g.lineWidth = 46; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + sd * 10, (sy + hy) / 2 - 20, hx, hy); g.stroke();
    g.strokeStyle = '#6fd9e0'; g.lineWidth = 6; g.beginPath(); g.moveTo(sx - sd * 10, sy); g.quadraticCurveTo(sx, (sy + hy) / 2 - 20, hx - sd * 8, hy - 4); g.stroke();
    g.fillStyle = '#9fe9ee'; g.beginPath(); g.arc(hx, hy, 24 + 4 * pu, 0, TAU); g.fill();
    if (sd > 0) { g.save(); g.translate(hx, hy - 4); g.rotate(-0.9 + 1.1 * pu); g.fillStyle = '#e8f2f8'; g.fillRect(-4, -78, 8, 70); g.fillStyle = '#9fb7c0'; g.fillRect(-3, -90, 6, 14); g.restore(); }
  }
  if (u > 0.55 && u < 1.2) { const e = (u - 0.55) / 0.65; addMode(g, () => { g.strokeStyle = 'rgba(120,255,220,' + 0.7 * (1 - e) + ')'; g.lineWidth = 6; g.beginPath(); g.arc(0, 110, 40 + 200 * easeOut(e), 0, TAU); g.stroke(); }); }
}
function vElevator(g, u) {
  g.fillStyle = lg(g, 0, -320, 0, 320, [[0, '#151f38'], [1, '#080d1c']]); g.fillRect(-260, -320, 520, 640);
  const v0 = 1300, off = v0 * (u - rampInt(u, 1.6));
  // shaft
  g.fillStyle = '#0a1224'; g.fillRect(-150, -320, 300, 640);
  g.fillStyle = '#2d4468'; for (let i = 0; i < 9; i++) { const y = ((i * 120 - off) % 1080 + 1080) % 1080 - 400; g.fillRect(-150, y, 300, 6); g.fillRect(-150, y, 14, 60); g.fillRect(136, y, 14, 60); }
  g.strokeStyle = '#7c92b4'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, -320); g.lineTo(0, -140); g.stroke();
  const jolt = 10 * Math.exp(-Math.max(0, u - 1.6) * 7) * Math.sin(Math.max(0, u - 1.6) * 28);
  const open = smooth((u - 1.85) / 0.4);
  g.save(); g.translate(0, jolt);
  g.fillStyle = '#c4cfe0'; rr(g, -92, -150, 184, 270, 14); g.fill();
  g.fillStyle = '#1a2540'; rr(g, -74, -126, 148, 232, 8); g.fill();
  addMode(g, () => { g.fillStyle = 'rgba(255,225,150,' + (0.1 + 0.4 * open) + ')'; g.fillRect(-74, -126, 148, 232); });
  // rider
  g.fillStyle = '#ffb36b'; g.beginPath(); g.arc(0, -40, 15, 0, TAU); g.fill(); g.fillStyle = '#d85a8a'; rr(g, -20, -22, 40, 70, 16); g.fill(); g.fillStyle = '#14101c'; g.fillRect(-14, 44, 11, 54); g.fillRect(3, 44, 11, 54);
  // doors
  const dw = 74 * (1 - open);
  g.fillStyle = '#9aa8c0'; g.fillRect(-74, -126, dw, 232); g.fillRect(74 - dw, -126, dw, 232);
  g.strokeStyle = '#6e7c98'; g.lineWidth = 3; g.strokeRect(-74, -126, 148, 232);
  g.restore();
  // floor lamps on the right
  const dn = Math.min(1, u / 1.6);
  for (let i = 0; i < 6; i++) { const on = Math.floor(dn * 5.2) >= i; const col = i === 5 && u > 1.7 ? '#31e08a' : (on ? '#ffd58a' : '#2a3a58'); g.fillStyle = col; g.beginPath(); g.arc(210, -210 + i * 52, 12, 0, TAU); g.fill(); if (on) addMode(g, () => rg(g, 210, -210 + i * 52, 28, [[0, 'rgba(255,210,120,0.45)'], [1, 'rgba(255,210,120,0)']])); }
  // arrow
  g.fillStyle = 'rgba(255,213,138,' + (1 - smooth((u - 1.5) / 0.3)) + ')'; g.beginPath(); g.moveTo(-210, -200); g.lineTo(-180, -170); g.lineTo(-240, -170); g.closePath(); g.fill();
}
function shotCards(g, lt) {
  g.save();
  g.fillStyle = lg(g, 0, 0, 0, H, [[0, '#050d1c'], [1, '#0a1f3a']]); g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(90,200,255,0.07)'; g.lineWidth = 2;
  for (let i = 0; i < 24; i++) { const x = ((i * 90 + lt * 30) % 2160) - 120; g.beginPath(); g.moveTo(x, 0); g.lineTo(x - 300, H); g.stroke(); }
  addMode(g, () => rg(g, 960, 540, 900, [[0, 'rgba(40,120,200,0.14)'], [1, 'rgba(40,120,200,0)']]));
  card(g, 360, 540, T.pop1, lt, '#59b3ff', vTrain);
  card(g, 960, 540, T.pop2, lt, '#58f0c8', vSurgeon);
  card(g, 1560, 540, T.pop3, lt, '#ffd58a', vElevator);
  g.restore();
}

// ================================================================== S7/S8: street — no siren, strangers, scream, run, QUAKE
const GROUP = [
  { id: 0, xs: 830, y: 836, hex: HEX[1], tj: 43.78, v: 410 }, { id: 1, xs: 720, y: 846, hex: HEX[4], tj: 44.0, v: 420 }, { id: 2, xs: 640, y: 830, hex: HEX[2], tj: 44.22, v: 405 },
  { id: 3, xs: 560, y: 844, hex: HEX[3], tj: 44.46, v: 430 }, { id: 4, xs: 480, y: 832, hex: HEX[0], tj: 44.66, v: 415 }, { id: 5, xs: 400, y: 842, hex: HEX[6], tj: 44.86, v: 425 },
];
GROUP.forEach((p) => { p.kind = 'g'; p.off = 330 + p.id * 40; p.s = 1.08; });
const PASS = (() => {
  const r = rng(5150), a = [];
  const spec = [[250, 1, 82, 926, 1.1], [1300, -1, 76, 918, 1.12], [1750, -1, 95, 950, 1.16], [60, 1, 70, 932, 1.1], [1500, -1, 85, 826, 1.0], [-100, 1, 90, 835, 1.02], [1950, -1, 70, 842, 1.04], [1000, 1, 60, 940, 1.14], [850, 1, 88, 960, 1.18], [1650, -1, 66, 828, 1.0], [330, 1, 74, 958, 1.17], [1180, -1, 80, 925, 1.1]];
  spec.forEach((s, i) => a.push({ kind: 'p', id: 6 + i, x0: s[0], dir: s[1], sp: s[2], y: s[3], s: s[4], hex: HEX[(i * 5 + 3) % 8], tj: i < 7 ? 44.1 + i * 0.22 : 0, v: 330 + r() * 90, crouch: r() < 0.45 ? 0.6 + r() * 0.8 : 0, cu: 47.4 + r() * 2.0, down: i === 3 || i === 5 }));
  return a;
})();
const P2 = GROUP.concat(PASS);
P2.forEach((p) => { if (p.kind === 'g') { p.crouch = 1; p.cu = 47.6 + p.id * 0.25; p.down = p.id === 2; } });
function baseX(p, lt) {
  if (p.kind === 'g') return p.xs - p.off * (1 - smooth((lt - 33.6) / 3.9));
  return p.x0 + p.dir * p.sp * (lt - 33.6);
}
function personX(p, lt) {
  if (p.tj && lt > p.tj) {
    const lq = Math.min(lt, T.quake), xj = baseX(p, p.tj);
    return xj + p.v * rampInt(lq - p.tj, 0.35) + (lt > T.quake ? p.v * 0.09 * (1 - Math.exp(-(lt - T.quake) * 12)) : 0);
  }
  return baseX(p, Math.min(lt, T.quake));
}
const heroX = (lt) => {
  const lq = Math.min(lt, T.quake);
  return 1060 + 400 * rampInt(lq - T.run, 0.35) * (lq > T.run ? 1 : 0) + (lt > T.quake ? 40 * (1 - Math.exp(-(lt - T.quake) * 10)) : 0) + 70 * smooth((lt - 49.4) / 2.2);
};
const heroY = (lt) => 856 + 46 * smooth((lt - 49.2) / 1.9);
// fixed world-space quake cracks (real: dark with light edge)
const QX = heroX(T.quake);
const QCR = makeCrack(404, QX + 500, 935, Math.PI, 1500, 36, 0.3, 0.9, 0.2);
const QCR2 = makeCrack(405, QX + 250, 1010, Math.PI - 0.05, 1300, 40, 0.3, 0.8, 0.15);
const QCR3 = makeCrack(406, QX + 650, 870, Math.PI + 0.08, 1000, 34, 0.3, 0.8, 0.18);
const DEBRIS = (() => { const r = rng(6060), a = []; for (let i = 0; i < 34; i++) a.push({ dx: (r() - 0.5) * 2100 - 100, t0: T.quake + 0.12 + r() * 1.6, y0: -40 - r() * 300, vy: 100 + r() * 300, sz: 10 + r() * 34, gy: 840 + r() * 150, col: r() < 0.5 ? '#3c2f48' : '#6a5a6e', rv: (r() - 0.5) * 8, a0: r() * TAU }); return a; })();
const PUFFS = (() => { const r = rng(7070), a = []; for (let i = 0; i < 34; i++) a.push({ dx: (r() - 0.5) * 2300, y: 800 + r() * 200, t0: T.quake + 0.1 + r() * 1.5, R: 120 + r() * 200, dr: 60 + r() * 100, rise: 50 + r() * 140, drift: (r() - 0.5) * 120, k: r() }); return a; })();
const TW2 = [{ wx: QX * 0.78 - 520, w: 330, h: 1500, ph: 0.0, seed: 301 }, { wx: QX * 0.78 + 980, w: 360, h: 1500, ph: 2.0, seed: 302 }];
function nearTower(i) {
  const t = TW2[i];
  return layer('nt' + i, t.w + 20, t.h + 10, (c) => {
    const r = rng(t.seed); c.translate(10, 5);
    c.fillStyle = lg(c, 0, 0, t.w, 0, [[0, '#1a1030'], [0.7, '#241438'], [1, '#34183c']]); c.fillRect(0, 0, t.w, t.h);
    const cols = 6, rows = 24;
    for (let rI = 0; rI < rows; rI++) for (let cI = 0; cI < cols; cI++) {
      const lit = r() < 0.42; c.fillStyle = lit ? (r() < 0.2 ? 'rgba(130,210,255,0.8)' : 'rgba(255,196,110,' + (0.5 + r() * 0.4) + ')') : 'rgba(16,10,30,0.85)';
      c.fillRect(24 + cI * 46, 40 + rI * 56, 28, 34);
    }
    c.fillStyle = 'rgba(255,150,95,0.5)'; c.fillRect(t.w - 6, 0, 6, t.h);
    c.fillStyle = 'rgba(8,4,18,0.35)'; c.fillRect(0, 0, 14, t.h);
  });
}
function mouth(h, fc) { return { x: h.x + fc * h.r * 0.7, y: h.y + h.r * 0.1 }; }

function shotStreet(g, lt) {
  const sk = lt >= T.quake ? shakeAt(lt, T.quake, 30, 0.75, 34) : { x: 0, y: 0, r: 0 };
  const e = lt >= T.quake ? Math.exp(-(lt - T.quake) * 0.55) : 0;
  const hx = heroX(lt), hy = heroY(lt);
  // camera
  let cx0 = 900 + 18 * (lt - T.street), z0 = 1.0 + 0.05 * smooth((lt - T.street) / 7);
  const punch = lt > T.scream ? 0.1 * Math.exp(-(lt - T.scream) * 5) : 0;
  const f = smooth((lt - 42.6) / 1.0), offc = 240 * (1 - smooth((lt - 48.5) / 2.6));
  let cx = lerp(cx0, hx + offc, f), z = lerp(z0, 0.92, f) + punch;
  z = lerp(z, 0.86, smooth((lt - 48.6) / 2.4));
  const cy = camYc(612, z);
  const cam = { x: cx + sk.x * 0.7, y: cy + sk.y * 0.6, z: z * (1 + 0.012 * e * (lt >= T.quake ? 1 : 0)), r: lt >= T.quake ? 0.03 * e * Math.sin((lt - T.quake) * 11) + sk.r * 0 : 0 };
  g.save();
  roll(g, cam.r); if (cam.r) { g.translate(W / 2, H / 2); g.scale(1.05, 1.05); g.translate(-W / 2, -H / 2); }
  drawWorld(g, cam, lt);
  // near towers that tilt during the quake (clipped above the sidewalk line)
  const sidewalkY = project(cam, 0, 826, 1).y;
  g.save(); g.beginPath(); g.rect(0, 0, W, sidewalkY - 2); g.clip();
  for (let i = 0; i < 2; i++) {
    const t = TW2[i], bp = project(cam, t.wx, 860, 0.78), zs = 1 + (cam.z - 1) * (0.25 + 0.75 * 0.78);
    if (bp.x < -400 || bp.x > W + 400) continue;
    const q = Math.max(0, lt - T.quake), tilt = (i ? 1 : -1) * (0.05 * Math.min(1, q / 0.8) * Math.exp(-q * 0.18) * Math.cos(q * 5.5) + 0.018 * Math.min(1, q / 0.4) * Math.sin(q * 15) * Math.exp(-q * 0.5));
    g.save(); g.translate(bp.x, bp.y); g.scale(zs, zs); g.rotate(tilt); g.drawImage(nearTower(i), -t.w / 2 - 10, -t.h - 5); g.restore();
  }
  g.restore();
  // --- entities
  const ents = [];
  const phase = Math.min(lt, T.quake);
  for (const p of P2) {
    const x = personX(p, lt), run = p.tj && lt > p.tj && lt < T.quake;
    if (x < -500 || x > 4000) continue;
    let face = p.kind === 'g' ? 1 : p.dir, ph, idle = false;
    if (run) { face = 1; ph = lt * 3.3 + p.id * 0.37; } else if (lt > T.quake) { ph = 0; idle = true; } else {
      const moving = p.kind === 'g' ? (lt < 37.4) : true; ph = x / (110 * p.s) * face; idle = !moving; if (idle) ph = p.id * 0.3;
    }
    let dx = 0, o = { run: run, idle: idle }, y = p.y;
    if (lt > T.quake) {
      const q = lt - T.quake, d = Math.exp(-q * 0.9);
      dx = Math.sin(lt * 37 + p.id * 2) * 8 * d; y += Math.abs(Math.sin(lt * 29 + p.id)) * 6 * d;
      const cr = p.crouch ? p.crouch * smooth(q / 0.2) * (1 - smooth((lt - p.cu) / 0.5)) : 0.5 * Math.exp(-q * 1.5);
      o.crouch = cr; o.lean = 10 * cr; o.hands = p.crouch && cr > 0.2 && lt < p.cu + 0.3;
      if (p.down) o.rot = -1.35 * smooth(q / 0.25) * (1 - smooth((lt - (p.cu + 1.0)) / 0.6)); // thrown to the ground, then back up
    }
    // "?" reactions of the group
    ents.push({ y: y, d: () => mini(g, x + dx, y, p.s, p.hex, ph, face, o), p, x });
  }
  // hero
  const run = lt > T.run && lt < T.quake;
  const hero = { x: hx, y: hy, s: 0.92, facing: lt < T.point ? -1 : 1, walk: 0, lean: 0.03, eyeOpen: 1, eyeGlow: 0.55, bob: 0.6, t: lt, flutter: 0, step: 0, phase: 0, headDown: 0 };
  if (lt >= T.scream && lt < T.point) { hero.lean = -0.14; hero.eyeGlow = 1; hero.flutter = 0.8; hero.bob = 1; }
  else if (lt >= T.point && lt < T.run) { hero.step = clamp(spring(lt - T.point, 200, 15)); hero.eyeGlow = 1; hero.lean = 0.12; }
  else if (run) { hero.walk = 1; hero.lean = 0.3; hero.eyeGlow = 1; hero.phase = lt * 2.35; hero.bob = 1.2; }
  else if (lt >= T.quake) {
    const q = lt - T.quake; hero.walk = lt > 49.4 ? smooth((lt - 49.4) / 0.5) * (1 - smooth((lt - 51.4) / 0.7)) : 0; hero.phase = (lt - 49.4) * 0.45;
    hero.lean = lerp(0.3, 0.04, smooth((lt - 47.3) / 1.4)); hero.headDown = 0.7 * Math.exp(-q * 0.6) * (1 - smooth((lt - 48.2) / 0.6)); hero.eyeGlow = 1 - 0.7 * smooth((lt - 49) / 1.6); hero.bob = lt > 49.4 ? 0.8 : 0.3;
    hero.flutter = 0.7 * Math.exp(-q * 0.7);
  } else if (lt >= 35.3 && lt < 40.6) { hero.flutter = 0.25 * win(lt, 35.5, 37.5, 0.1, 0.5); hero.lean = 0.05; }
  // hero ghost-tinted by the quake? no: stays real.
  withLayer(g, cam, 1, () => {
    ents.push({ y: hy + 1, d: () => man(g, hero), hero: true });
    ents.sort((a, b) => a.y - b.y);
    for (const e2 of ents) e2.d();
  });
  // ghost helpers: siren icon, voice arcs, "?" bubbles
  const jh = man(g, Object.assign({ nodraw: true }, hero));
  const hs = project(cam, 0, 0, 1);
  const toScr = (p) => ({ x: W / 2 + cam.z * (p.x - cam.x), y: H / 2 + cam.z * (p.y - (540 + (cam.y - 540))) });
  const hHead = toScr(jh.head);
  // siren icon crossed out
  const sa = win(lt, T.siren, 35.5, 0.0001, 0.3), sp2 = clamp(spring(lt - T.siren, 220, 16));
  if (sa > 0.01 && lt >= T.siren) {
    g.save(); g.globalAlpha = sa; g.translate(hHead.x - 40, hHead.y - 170 * cam.z); g.scale(sp2 * 1.15, sp2 * 1.15);
    rg(g, 0, 0, 120, [[0, 'rgba(255,60,60,0.45)'], [1, 'rgba(255,60,60,0)']]);
    g.fillStyle = '#ff4a4a'; g.beginPath(); g.arc(0, 0, 44, Math.PI, 0); g.lineTo(44, 24); g.lineTo(-44, 24); g.closePath(); g.fill();
    g.fillStyle = '#7a1620'; rr(g, -56, 24, 112, 22, 6); g.fill(); g.fillStyle = '#ffd0d0'; g.fillRect(-9, -36, 18, 26);
    g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.arc(0, 0, 76, 0, TAU); g.stroke(); g.strokeStyle = '#ff2f45'; g.lineWidth = 9; g.beginPath(); g.arc(0, 0, 76, 0, TAU); g.moveTo(-54, -54); g.lineTo(54, 54); g.stroke();
    g.restore();
  }
  // voice arcs
  const mv = mouth(hHead, hero.facing);
  if (lt > T.voice && lt < 38.6) arcs(g, hHead.x + (hero.facing) * 10, hHead.y + 4, hero.facing, T.voice, lt, 3, 'rgba(255,236,190,A)', 160);
  if (lt > T.voice + 1.5 && lt < 38.6) arcs(g, hHead.x + hero.facing * 10, hHead.y + 4, hero.facing, T.voice + 1.5, lt, 2, 'rgba(255,236,190,A)', 140);
  // scream
  if (lt > T.scream && lt < 43.2) { arcs(g, hHead.x + hero.facing * 10, hHead.y, hero.facing, T.scream, lt, 4, 'rgba(255,255,255,A)', 420); }
  // doubting "?" over some strangers
  [[38.3, 1], [38.75, 3], [39.2, 0], [39.55, 4]].forEach((q) => {
    const u = lt - q[0]; if (u < 0 || u > 2.9) return;
    const p = GROUP[q[1]], pp = toScr({ x: personX(p, lt), y: 826 - 210 * p.s }), sc = clamp(spring(u, 250, 14)), a = 1 - smooth((u - 2.0) / 0.5);
    g.save(); g.globalAlpha = a; g.translate(pp.x, pp.y - 20 * sc); g.scale(sc * cam.z * 1.05, sc * cam.z * 1.05);
    g.fillStyle = 'rgba(255,255,255,0.93)'; g.beginPath(); g.arc(0, 0, 32, 0, TAU); g.fill(); g.beginPath(); g.moveTo(-8, 28); g.lineTo(2, 46); g.lineTo(10, 28); g.fill();
    txt(g, '?', 0, 3, 46, '#2a2040'); g.restore();
  });
  // --- quake: real cracks, debris, dust
  if (lt >= T.quake) {
    const q = lt - T.quake;
    withLayer(g, cam, 1, () => {
      const pc = easeOut(clamp(q / 0.45));
      for (const c of [QCR, QCR2, QCR3]) {
        g.save(); g.translate(0, 0);
        drawCrack(g, c, pc, 16, 'rgba(12,6,16,1)', 'rgba(8,4,12,1)', 0.85);
        g.translate(0, -3); drawCrack(g, c, pc, 9, 'rgba(200,170,150,1)', 'rgba(22,12,20,1)', 0.25);
        g.restore();
      }
      for (const d of DEBRIS) {
        const u = lt - d.t0; if (u < 0) continue;
        const wxp = QX + 200 + d.dx; let y = d.y0 + d.vy * u + 0.5 * 2200 * u * u; const landed = y >= d.gy;
        if (landed) y = d.gy - 0.0;
        g.save(); g.translate(wxp, y); g.rotate(landed ? d.a0 : d.a0 + d.rv * u); g.fillStyle = d.col; g.fillRect(-d.sz / 2, -d.sz / 2, d.sz, d.sz * 0.7);
        g.fillStyle = 'rgba(255,170,110,0.4)'; g.fillRect(-d.sz / 2, -d.sz / 2, d.sz, 3); g.restore();
      }
      // dust puffs
      for (const p of PUFFS) {
        const u = lt - p.t0; if (u < 0) continue;
        const a = clamp(u / 0.7) * 0.36 * (1 - smooth((lt - T.clear - 0.1 - p.k * 0.9) / 1.2));
        if (a < 0.01) continue;
        const R = p.R + p.dr * u, x = QX + 200 + p.dx + p.drift * u, y = p.y - p.rise * Math.min(u, 3);
        rg(g, x, y, R, [[0, 'rgba(184,150,120,' + a + ')'], [0.6, 'rgba(160,126,100,' + a * 0.7 + ')'], [1, 'rgba(150,118,96,0)']]);
      }
    });
    const hz = 0.4 * smooth((lt - 46.5) / 1.2) * (1 - smooth((lt - 48.0) / 1.4));
    if (hz > 0.01) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = lg(g, 0, 0, 0, H, [[0, 'rgba(168,128,104,' + hz + ')'], [1, 'rgba(120,92,80,' + hz * 0.9 + ')']]); g.fillRect(0, 0, W, H); g.restore(); }
    // after it clears: light shafts + motes
    const ls = smooth((lt - 48.9) / 1.6);
    if (ls > 0.01) {
      addMode(g, () => {
        for (let i = 0; i < 5; i++) {
          const x0 = 300 + i * 340 + 40 * Math.sin(lt * 0.4 + i), w = 120 + 60 * (i % 2);
          g.fillStyle = lg(g, x0, 0, x0 + 420, H, [[0, 'rgba(255,190,120,' + 0.09 * ls + ')'], [1, 'rgba(255,170,100,0)']]);
          g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + w, 0); g.lineTo(x0 + 520 + w, H); g.lineTo(x0 + 520, H); g.closePath(); g.fill();
        }
        const r = rng(99);
        for (let i = 0; i < 44; i++) { const x = (r() * W + lt * (8 + r() * 14)) % W, y = (r() * H - lt * (6 + r() * 10) + H * 3) % H, a = ls * 0.5 * (0.5 + 0.5 * Math.sin(lt * 1.3 + i)); rg(g, x, y, 5 + r() * 5, [[0, 'rgba(255,214,160,' + a + ')'], [1, 'rgba(255,190,120,0)']]); }
      });
    }
  }
  g.restore();
  // the countdown ring (top right) from "ten seconds" to the quake, then a quiet 0
  if (lt >= T.ring) {
    const p = clamp((lt - T.ring) / (T.quake - T.ring)), left = Math.max(0, 10 * (1 - p));
    let ap = smooth((lt - T.ring) / 0.4);
    if (lt >= T.quake) ap = 1 - smooth((lt - T.quake - 0.3) / 0.3);
    if (lt >= 51.4) ap = 0.9 * smooth((lt - 51.4) / 0.4) * (1 - smooth((lt - 52.5) / 0.8));
    if (ap > 0.01) {
      const rx = lt >= 51.4 ? 1520 : 1690, ry = lt >= 51.4 ? 250 : 200, sh = lt >= T.quake && lt < 51.4 ? 1 + 0.15 * Math.exp(-(lt - T.quake) * 20) : 1;
      ringAt(g, lt, rx, ry, 300 * sh, lt >= 51.4 ? 0 : left, lt >= 51.4 ? 1 : p, ap);
    }
  }
  // impact flash
  const fl = lt >= T.quake ? 0.6 * Math.exp(-(lt - T.quake) * 9) : 0;
  if (fl > 0.01) { g.save(); g.globalAlpha = fl; g.fillStyle = '#fff0dc'; g.fillRect(0, 0, W, H); g.restore(); }
}

// ================================================================== main
const SHOTS = [
  [T.q1, shotS1], [T.rush, shotRush], [T.towers, shotTowers], [T.scope, shotScope], [T.icons, shotIcons], [T.cards, shotCards], [T.street, shotStreet],
];
const CUTS = [T.rush, T.towers, T.scope, T.icons, T.cards, T.street];
function draw(g, lt, dur) {
  g.save(); g.fillStyle = '#0a0610'; g.fillRect(0, 0, W, H);
  let fn = SHOTS[0][1];
  for (let i = SHOTS.length - 1; i >= 0; i--) if (lt >= SHOTS[i][0]) { fn = SHOTS[i][1]; break; }
  fn(g, lt);
  g.restore();
  let fl = 0;
  for (const c of CUTS) if (lt >= c && lt < c + 0.3) fl = Math.max(fl, 0.26 * Math.exp(-(lt - c) * 18));
  if (fl > 0.01) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = fl; g.fillStyle = '#e8f6ff'; g.fillRect(0, 0, W, H); g.restore(); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

CH.ch4b = { draw };
})();
