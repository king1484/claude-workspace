// ch3b.js — "The Chase" (44.236 s). Thief & bag in the plaza (ghost path, hero steps in front) -> six-lane road with
// ghost cars -> obstacle montage (bus, bike, pigeon, ladder) -> ghost-before-real shot -> impossibly smooth crowd ->
// clock + ghost arrow ("you are not fast, you are early").
// Registers CH.ch3b = { draw(g, lt, dur) }. Everything is a pure function of lt. Needs window.ch3_kit (ch3.js loads first).
(function () {
'use strict';
const W = 1920, H = 1080;
if (!window.CH) window.CH = {};
const K = window.ch3_kit;

// =====================================================================================================
// TIMELINE (local seconds). cues are generated from this block by ch3b.build_cues.mjs
// =====================================================================================================
// @T-BEGIN
const T = {
  dur: 44.236,
  // plaza: snatch, bolt, ghost path, hero steps in, collision, catch
  pl: { end: 12.2, snatch: 5.9, ghost0: 8.05, step0: 9.2, stop: 10.6, turn: 10.72, hit: 11.0, catch: 11.45 },
  // road: ghost cars (12.7..), hero crosses 17.0..22.2, near-miss passes [lane, tPass, horn]
  rd: {
    start: 12.2, ghost0: 12.7, cross0: 17.0, cross1: 22.2, end: 22.95,
    near: [[5, 16.57, 0], [4, 17.65, 1], [5, 18.47, 1], [4, 19.55, 0], [3, 18.59, 0], [2, 19.35, 1], [3, 20.49, 1], [1, 20.0, 0],
      [0, 20.62, 1], [2, 21.25, 0], [1, 21.9, 1], [0, 22.52, 0]]
  },
  // obstacle montage (ghost leads each by `lead`)
  ob: { start: 22.95, bus: 24.0, bike: 24.75, pigeon: 25.45, ladder: 26.2, end: 27.0, lead: 0.45 },
  // ghost-before-real: ball, flowerpot, skateboard, cart (arrival times; ghost leads by `lead`)
  gh: { start: 27.0, obs: [28.4, 29.2, 30.0, 30.9], lead: 0.8, end: 31.857 },
  // slow smooth tracking through the crowd
  sm: { start: 31.857, end: 38.5 },
  // clock + arrow
  ck: { start: 38.5, tick: 0.5, pull: 40.5, arrow: 41.13, end: 44.236 }
};
// @T-END

function ready() { return K && typeof drawWalker === 'function' && typeof drawWorld === 'function' && typeof drawCar === 'function'; }

// =====================================================================================================
// helpers
// =====================================================================================================
const HERO = PAL_REAL;
const camB = (x, y, z, r) => ({ x: x, y: y == null ? 540 : y, z: z == null ? 1 : z, r: r || 0 });
function shake(cam, t, t0, amp, decay) { const s = shakeAt(t, t0, amp, decay); cam.x += s.x; cam.y += s.y; cam.r += s.r; }
function camTransform(g, cam) { if (cam.r) { g.translate(W / 2, H / 2); g.rotate(cam.r); g.translate(-W / 2, -H / 2); } }
function poseMix(A, B, u) {
  if (u <= 0) return A; if (u >= 1) return B;
  const mx = (a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * u;
    if (a && b && typeof a === 'object' && typeof b === 'object') { const r = {}; for (const k in a) r[k] = (k in b) ? mx(a[k], b[k]) : a[k]; return r; }
    return u < 0.5 ? a : b;
  };
  return mx(A, B);
}
const dep = (arr) => arr.sort((a, b) => a.y - b.y).forEach((e) => e.fn());
const glowCol = (a) => 'rgba(127,233,255,' + a + ')';
function entry(t, a, b, fi, fo) { return win(t, a, b, fi, fo); }
// whip out (end of shot) / flash in (start of shot)
function whipOut(g, t, tEnd, dir, seed) {
  const a = smooth((t - (tEnd - 0.3)) / 0.3);
  if (a > 0.01) { K.whip(g, a, dir, seed); flash(g, 0.85 * smooth((t - (tEnd - 0.16)) / 0.16)); }
}
function flashIn(g, t, t0, amt) {
  const a = 1 - smooth((t - t0) / 0.26);
  if (a > 0.01 && t >= t0) { flash(g, (amt == null ? 0.8 : amt) * a); }
}
function ghostGlow(g, x, y, r, a) {
  g.save(); g.globalCompositeOperation = 'lighter';
  K.radial(g, x, y, r, [[0, glowCol(0.35 * a)], [1, glowCol(0)]]);
  g.restore();
}

const NPC_COLS = ['#3a6fe0', '#f2c230', '#2fb59a', '#8a4fd8', '#e8883a', '#d9d2c4', '#4fb6d8', '#c4527f', '#7fb34a', '#e0d060'];
const NPC_PAL = NPC_COLS.map((c) => K.pal(c));
const THIEF_PAL = K.pal('#2b2833', { leg: '#191622' });
const VICTIM_PAL = K.pal('#1fa3a0');

// standard walking pose for crowd members
function walkPose(x, dirn, o) {
  o = o || {};
  const c = { phase: dirn > 0 ? x / STRIDE : -x / STRIDE, walk: o.walk == null ? 1 : o.walk, headDown: o.headDown || 0, phone: o.phone || 0, lean: o.lean == null ? 0.08 : o.lean, bob: 1,
    eyeOpen: o.eyeOpen == null ? 1 : o.eyeOpen, eyeGlow: o.eyeGlow || 0, flutter: o.flutter || 0, step: o.step || 0 };
  return walkerPose(c);
}

// ---------------------------------------------------------------------------------------------------
// SHOT A  plaza (0 .. 12.2): thief snatches a bag, the hero steps in front of where he will be
// ---------------------------------------------------------------------------------------------------
const rampInt2 = (u, d) => { if (u <= 0) return 0; if (u >= d) return d * 0.5 + (u - d); const a = u / d; return d * (a * a * a - a * a * a * a * 0.5); };
const victimX = (t) => 640 + 70 * Math.min(t, T.pl.snatch) + 10 * smooth((t - T.pl.snatch) / 0.4);
const thiefRaw = (t) => {
  const s = T.pl.snatch;
  if (t < s) return 238 + 130 * t;
  const u = t - s;
  return 238 + 130 * s + 130 * u + 125 * rampInt2(u, 0.5);
};
const PSTAR = thiefRaw(T.pl.hit) + 50;           // where the hero will be standing when the thief arrives
const HX0 = PSTAR - 250;
const heroX = (t) => HX0 + (PSTAR - HX0) * smooth((t - T.pl.step0) / (T.pl.stop - T.pl.step0));

// crowd: deterministic walkers, chosen so nobody walks through the key action
const npcX = (n, t) => ((n.x0 + n.v * t + 500) % 3800 + 3800) % 3800 - 500;
let _crowd = null;
function crowd() {
  if (_crowd) return _crowd;
  const out = [], r = rng(2024), N = 30;
  for (let i = 0; i < N; i++) {
    let best = null;
    for (let tries = 0; tries < 12 && !best; tries++) {
      const n = { x0: -400 + (i + 0.5) * (3600 / N) + (r() - 0.5) * 90, v: (i % 2 ? -1 : 1) * (45 + r() * 55), y: 790 + r() * 52, col: (i * 3 + 1) % NPC_PAL.length, phone: r() < 0.4 ? 1 : 0, off: r() };
      let ok = true;
      for (let t = 0; t <= T.pl.end && ok; t += 0.2) {
        const x = npcX(n, t);
        if (Math.abs(x - heroX(t)) < 130) ok = false;
        if (t > 3.4 && t < 7.0 && (Math.abs(x - victimX(t)) < 130 || Math.abs(x - thiefRaw(t)) < 100)) ok = false;
        if (t > 7.0 && t < 11.6 && Math.abs(x - thiefRaw(Math.min(t, T.pl.hit))) < 80 && Math.abs(n.y - 828) < 22) ok = false;
        if (t > 8.4 && Math.abs(x - PSTAR) < 210) ok = false;
      }
      if (ok) best = n; else { n.v = -n.v; }
    }
    if (best) out.push(best);
  }
  return (_crowd = out);
}

function bagDraw(g, x, y, s, rot, a) {
  g.save(); g.translate(x, y); g.rotate(rot || 0); g.scale(s, s); if (a != null) g.globalAlpha = a;
  g.strokeStyle = '#3a2210'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(-9, 2); g.quadraticCurveTo(0, -24, 9, 2); g.stroke();
  K.rrect(g, -19, 2, 38, 44, 6);
  const gr = g.createLinearGradient(-19, 0, 19, 0); gr.addColorStop(0, '#ff9a36'); gr.addColorStop(1, '#d9601a');
  g.fillStyle = gr; g.fill(); g.lineWidth = 3; g.strokeStyle = '#2b1408'; g.stroke();
  g.fillStyle = 'rgba(255,230,190,0.85)'; g.fillRect(-8, 14, 16, 5);
  g.restore();
}

const THIEF_STAND = () => K.S({ eo: 1, a1: 0.18, a2: 0.2 });
const VICTIM_ALARM = K.S({ eo: 1, a1: -0.12, a2: -0.16, hFx: 38, hFy: -34, hBx: 26, hBy: -46, fl: 0.9 });
const THIEF_FALL = K.S({ eo: 1, a1: -0.25, a2: -0.35, hFx: -24, hFy: 26, hBx: -46, hBy: 18, fFx: 34, fFy: 22, fBx: -26, fBy: 10 });
const HERO_PLAZA = K.seq({ eo: 1, eg: 1 }, [
  [10.6, { a1: 0.06, a2: 0.06 }],
  [10.9, { a1: -0.1, a2: -0.12, hFx: 46, hFy: 10, hBx: 34, hBy: 16, fFx: 16, fBx: -16 }, 'o'],
  [11.0, { a1: -0.22, a2: -0.28, hx: -8, hFx: 50, hFy: 4, hBx: 36, hBy: 10, fFx: 16, fBx: -20 }, 's'],
  [11.45, { a1: -0.06, a2: -0.08, hFx: 72, hFy: -34, hBx: 28, hBy: 24 }, 'o'],
  [11.8, { a1: 0.02, a2: 0.0, hFx: 30, hFy: 40, hBx: 8, hBy: 62 }, 'io']
]);

function plaza(g, lt) {
  const t = lt, P = T.pl;
  const th = thiefRaw(Math.min(t, P.hit));
  // ---- camera
  const p1 = lerp(1830, 1020, smooth((t - 2.9) / 2.3));
  let cx = p1;
  if (t >= P.snatch - 0.3) {
    const lead = 280 * smooth((t - 6.0) / 1.0) * (1 - smooth((t - 9.6) / 1.1));
    cx = lerp(p1, th + lead, smooth((t - (P.snatch - 0.3)) / 0.8));
  }
  const push = smooth((t - 10.4) / 0.55) * (1 - smooth((t - 11.5) / 0.9));
  const cam = camB(cx, 612, 1.25 + 0.22 * push, 0);
  shake(cam, t, P.hit, 11, 9);
  g.save(); camTransform(g, cam);
  drawWorld(g, cam, t);

  const ents = [];
  // crowd
  for (const n of crowd()) {
    const x = npcX(n, t), sc = clamp(0.8 + (n.y - 790) / 52 * 0.18, 0.78, 1);
    if (x < cx - 960 / cam.z - 150 || x > cx + 960 / cam.z + 150) continue;
    const dirn = n.v > 0 ? 1 : -1;
    ents.push({ y: n.y, fn: () => withLayer(g, cam, 1, () => K.fig(g, { x, y: n.y, s: sc, facing: dirn, pose: walkPose(x + n.off * 70, dirn, { phone: n.phone, headDown: n.phone ? 0.38 : 0 }), pal: NPC_PAL[n.col] })) });
  }
  // hero
  const hx = heroX(t), hFace = t < P.turn ? 1 : -1;
  {
    const walk = smooth((t - (P.step0 - 0.05)) / 0.15) * (1 - smooth((t - (P.stop - 0.2)) / 0.2));
    const stand = walkPose(hx, 1, { walk, eyeGlow: 0.9, lean: 0.06 });
    let pose = stand;
    if (t >= P.stop - 0.1) pose = poseMix(stand, K.pose(HERO_PLAZA(t), t), smooth((t - (P.stop - 0.1)) / 0.2));
    if (t >= P.turn && t < P.turn + 0.22) {
      const hop = Math.sin(Math.PI * clamp((t - P.turn) / 0.22));
      pose = poseMix(pose, walkerPose({ walk: 0, step: clamp((t - P.turn) / 0.22), eyeOpen: 1, eyeGlow: 1, lean: 0.02 }), 0.55 * hop);
    }
    var hero = { x: hx, y: 820, s: 0.92, facing: hFace, pose: pose, pal: HERO };
    ents.push({ y: 820, fn: () => withLayer(g, cam, 1, () => K.fig(g, hero)) });
  }
  // victim
  {
    const vx = victimX(t), moving = 1 - smooth((t - P.snatch) / 0.3);
    let pose = walkPose(vx, 1, { walk: moving, lean: 0.06 });
    if (t > P.snatch) pose = poseMix(pose, K.pose(VICTIM_ALARM, t), smooth((t - P.snatch - 0.05) / 0.18));
    const vo = { x: vx, y: 822, s: 0.9, facing: 1, pose: pose, pal: VICTIM_PAL };
    ents.push({ y: 822, fn: () => withLayer(g, cam, 1, () => {
      K.fig(g, vo);
      if (t < P.snatch) { const h = K.W(vo, pose.armF.hand); bagDraw(g, h.x, h.y + 4, 0.85, 0.05 * Math.sin(t * 6)); }
    }) });
  }
  // thief
  const thT = (() => {
    const walking = t < P.hit;
    const y = 826 + (t > P.snatch + 0.4 ? 8 * Math.sin((t - P.snatch) * 2.3) * smooth((t - P.snatch - 0.4) / 0.6) : 0);
    const s = 0.92;
    const amp = lerp(0.42, 1.0, smooth((t - P.snatch) / 0.55));
    const lean = lerp(0.2, 0.5, smooth((t - P.snatch) / 0.5));
    let sp = K.run(th / 100, amp, lean);
    const grab = win(t, P.snatch - 0.2, P.snatch + 0.2, 0.12, 0.14);
    if (grab > 0.01) sp = K.mix(sp, K.S({ a1: 0.32, a2: 0.4, hFx: 74, hFy: 8, hBx: -10, hBy: 40, fFx: sp.fFx, fFy: sp.fFy, fBx: sp.fBx, fBy: sp.fBy, hy: sp.hy, eo: 1 }), grab);
    let o = { x: th, y: y, s: s, facing: 1, pal: THIEF_PAL, rot: 0 };
    let pose = K.pose(sp, t);
    if (t >= P.hit) {
      const u = (t - P.hit) / 0.55;
      o.x = th - 80 * easeOut(clamp(u * 1.2));
      o.rot = -1.52 * easeOut(clamp(u)) + 0.06 * Math.sin(clamp(u - 0.5, 0, 1) * 12) * (1 - clamp(u));
      pose = poseMix(pose, K.pose(THIEF_FALL, t), smooth((t - P.hit) / 0.2));
      o.y = y + 4 * smooth(clamp(u * 2));        // lands on the ground
    }
    o.pose = pose;
    return o;
  })();
  ents.push({ y: thT.y, fn: () => withLayer(g, cam, 1, () => {
    g.save(); g.translate(thT.x, thT.y); g.rotate(thT.rot); g.translate(-thT.x, -thT.y);
    K.fig(g, thT); g.restore();
  }) });
  dep(ents);

  // ---- bag: victim -> thief -> flies to the hero's hand
  withLayer(g, cam, 1, () => {
    if (t >= P.snatch && t < P.hit) {
      const h = K.W(thT, thT.pose.armF.hand);
      const vh = { x: victimX(P.snatch) + 40, y: 800 };
      const u = clamp((t - P.snatch) / 0.2);
      const bx = lerp(vh.x, h.x, easeOut(u)), by = lerp(vh.y, h.y + 4, easeOut(u)) - 40 * Math.sin(Math.PI * u);
      bagDraw(g, bx, by, 0.85, -0.2 * Math.sin(th / 20));
    } else if (t >= P.hit) {
      const hp = K.pose(HERO_PLAZA(P.catch), P.catch);
      const hOb = Object.assign({}, hero, { x: HX0 + (PSTAR - HX0) - 8, pose: hp });
      const target = K.W(hOb, hp.armF.hand);
      const hitHand = { x: th + 40, y: 770 };
      if (t < P.catch) {
        const u = (t - P.hit) / (P.catch - P.hit);
        const bx = lerp(hitHand.x, target.x, easeOut(u * 0.9 + 0.1 * u)), by = lerp(hitHand.y, target.y, u) - 190 * 4 * u * (1 - u);
        bagDraw(g, bx, by, 0.85, u * 9);
      } else {
        const h = K.W(hero, hero.pose.armF.hand);
        bagDraw(g, h.x + 2, h.y + 8, 0.85, 0.04 * Math.sin(t * 4), 1);
      }
    }
  });

  // ---- ghost path + interception ring (the thief's future)
  const ga = win(t, P.ghost0, P.hit - 0.05, 0.25, 0.12);
  if (ga > 0.01) {
    withLayer(g, cam, 1, () => {
      const x0 = th + 36, x1 = PSTAR - 30;
      K.dotPath(g, (u) => ({ x: lerp(x0, x1, u), y: 824 - 6 * Math.sin(Math.PI * u) }), smooth((t - P.ghost0) / 0.7), 26, 4.2, ga, t);
      K.ring(g, PSTAR - 28, 826, 112, 26, ga * smooth((t - P.ghost0 - 0.3) / 0.4), t);
      const gp = K.pose(K.run(0.28, 1, 0.5), t);
      K.fig(g, { x: PSTAR - 78, y: 815, s: 0.92, facing: 1, pose: gp, pal: palGhost(0.62 * ga * smooth((t - P.ghost0 - 0.2) / 0.4)) });
    });
    // vision pulse out of the hero's head
    const hd = walkerJoints(hero).head, sp = project(cam, hd.x, hd.y, 1), ru = (t - P.ghost0) / 0.75;
    if (ru > 0 && ru < 1) {
      g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(140,235,255,' + (0.8 * (1 - ru)) + ')'; g.lineWidth = 6 * (1 - ru) + 1.5;
      g.beginPath(); g.arc(sp.x, sp.y, 40 + 520 * easeOut(ru), 0, TAU); g.stroke(); g.restore();
    }
  }
  // ---- snatch / collision fx
  withLayer(g, cam, 1, () => {
    K.puffs(g, victimX(P.snatch) + 20, 806, (t - P.snatch) / 0.5, 5, 18, 5, 'rgba(255,230,200,', 50);
    K.burst(g, th + 46, 770, 78, (t - P.hit) / 0.45, 4);
    if (t > P.hit + 0.5) K.stars(g, thT.x - 168, thT.y - 38, 44, t, 4, 15);
    K.puffs(g, th, 832, (t - P.hit - 0.05) / 0.7, 6, 22, 7, 'rgba(255,214,180,', 90);
  });
  drawForeground(g, cam, t);
  g.restore();
  whipOut(g, t, T.pl.end, 1, 13);
  if (t < 0.3) flash(g, 0);
}

// @DISPATCH-BEGIN
function shots(g, lt) {
  if (lt < T.pl.end) plaza(g, lt);
  else if (lt < T.rd.end) road(g, lt);
  else if (lt < T.ob.end) obstacles(g, lt);
  else if (lt < T.gh.end) ghostRow(g, lt);
  else if (lt < T.sm.end) smooth_shot(g, lt);
  else clockShot(g, lt);
}
// @DISPATCH-END

// ---------------------------------------------------------------------------------------------------
// SHOT B  six-lane road (12.2 .. 22.95): ghost cars a breath ahead of the real ones; the hero walks through the gaps
// ---------------------------------------------------------------------------------------------------
const LANE_Y = [545, 610, 680, 760, 860, 975];
const LANE_DIR = [-1, -1, -1, 1, 1, 1];
const LANE_V = [720, 860, 980, 920, 800, 700];
const LANE_BND = [578, 645, 720, 810, 917];
const dScale = (y) => 0.62 + 0.38 * (y - 480) / 505;
const HY0 = 1030, HY1 = 478, RD_SPD = 106;
const rdU = (t) => t - T.rd.cross0;
const heroDist = (t) => Math.min(RD_SPD * rampInt2(rdU(t), 0.3), HY0 - HY1);
const heroY = (t) => HY0 - heroDist(t);
const heroWX = (t) => 150 * rampInt2(Math.min(Math.max(rdU(t), 0), T.rd.cross1 - T.rd.cross0 + 0.3), 0.4);
const CAR_LEAD = 0.55;
const CAR_COLS = ['#cdc6d8', '#ffb347', '#4fb6d8', '#e8e0c8', '#6a78b0', '#c4527f', '#9ad27a'];
function carSprite(i) {
  return K.cv('b_car' + i, 520, 280, (c) => {
    c.translate(260, 230);
    const P = Object.assign({}, PAL_REAL, { car: CAR_COLS[i], carDark: mixHex(CAR_COLS[i], '#000000', 0.4), carLow: mixHex(CAR_COLS[i], '#000000', 0.65) });
    drawCar(c, { x: 0, y: 0, s: 1, pal: P, alpha: 1, shadow: false });
  });
}
function carGhostSprite() {
  return K.cv('b_carG', 520, 280, (c) => { c.translate(260, 230); drawCar(c, { x: 0, y: 0, s: 1, pal: palGhost(0.9), alpha: 1 }); });
}
let _cars = null;
function cars() {
  if (_cars) return _cars;
  const out = [], r = rng(555), near = T.rd.near;
  for (let k = 0; k < 6; k++) {
    const nt = near.filter((n) => n[0] === k);
    nt.forEach((n) => out.push({ lane: k, tp: n[1], col: ((k * 2 + (n[1] * 3 | 0)) % CAR_COLS.length), vm: 0.95 + 0.1 * r(), horn: n[2], near: true }));
    let t = 11.4 + r() * 0.9;
    while (t < 24) {
      const clash = nt.some((n) => Math.abs(n[1] - t) < 0.85);
      if (!clash) out.push({ lane: k, tp: t, col: (out.length * 3 + k) % CAR_COLS.length, vm: 0.92 + 0.16 * r(), horn: 0, near: false });
      t += 2.0 + r() * 1.7;
    }
  }
  return (_cars = out);
}
const carX = (c, t) => heroWX(c.tp) + LANE_DIR[c.lane] * LANE_V[c.lane] * c.vm * (t - c.tp);

// ---- painted backdrop layers (cached)
function skylineTile(key, w, h, seed, col, winCol, hMin, hMax, wMin, wMax) {
  return K.cv(key, w, h, (c) => {
    const r = rng(seed);
    let x = 0;
    while (x < w) {
      const bw = wMin + r() * (wMax - wMin), bh = hMin + r() * (hMax - hMin), ww = Math.min(bw, w - x);
      c.fillStyle = col; c.fillRect(x, h - bh, ww, bh);
      c.fillStyle = 'rgba(255,170,110,0.18)'; c.fillRect(x + ww - 4, h - bh, 4, bh);
      for (let wy = h - bh + 14; wy < h - 10; wy += 18) for (let wx = x + 8; wx < x + ww - 10; wx += 16) {
        if (r() < 0.22) { c.fillStyle = winCol; c.fillRect(wx, wy, 6, 8); }
      }
      if (r() < 0.25) { c.fillStyle = col; c.fillRect(x + ww * 0.45, h - bh - 24, 3, 24); }
      x += ww + (r() < 0.3 ? 6 : 0);
    }
  });
}
function shopTile() {
  return K.cv('b_shops', 2400, 150, (c) => {
    const r = rng(31), cols = ['#e0587a', '#3fd0c0', '#ffd23f', '#a46bff', '#ff8a4a'];
    for (let x = 0; x < 2400; x += 200) {
      const w = 190, col = cols[(x / 200 + (r() * 2 | 0)) % 5];
      c.fillStyle = '#241848'; c.fillRect(x, 10, w, 140);
      const gr = c.createLinearGradient(0, 60, 0, 150); gr.addColorStop(0, '#ffcf8a'); gr.addColorStop(1, '#e08a52');
      c.fillStyle = gr; c.fillRect(x + 12, 64, w - 24, 80);
      c.fillStyle = col; c.fillRect(x + 6, 44, w - 12, 22);
      c.fillStyle = 'rgba(0,0,0,0.2)'; for (let s = 0; s < w - 12; s += 20) c.fillRect(x + 6 + s, 44, 10, 22);
      c.fillStyle = 'rgba(255,240,200,0.8)'; c.fillRect(x + 30, 26, w - 60, 6);
    }
  });
}
function nearSide() {
  return K.cv('b_nearside', 1400, 420, (c) => {
    let gr = c.createLinearGradient(0, 0, 0, 420); gr.addColorStop(0, '#8a6a98'); gr.addColorStop(1, '#4a3462');
    c.fillStyle = gr; c.fillRect(0, 0, 1400, 420);
    c.strokeStyle = 'rgba(30,12,50,0.35)'; c.lineWidth = 3;
    for (let x = 0; x <= 1400; x += 140) { c.beginPath(); c.moveTo(x, 12); c.lineTo(x - 30, 420); c.stroke(); }
    c.beginPath(); c.moveTo(0, 150); c.lineTo(1400, 150); c.stroke(); c.beginPath(); c.moveTo(0, 290); c.lineTo(1400, 290); c.stroke();
  });
}
function tileDraw(g, img, tw, x0, x1, y, h) {
  const i0 = Math.floor(x0 / tw), i1 = Math.floor(x1 / tw);
  for (let i = i0; i <= i1; i++) g.drawImage(img, i * tw, y, tw, h);
}
function roadBackdrop(g, camx, t, vx0, vx1) {
  // sky (world coordinates, tall rect)
  let gr = g.createLinearGradient(0, -700, 0, 500);
  gr.addColorStop(0, '#1a0f38'); gr.addColorStop(0.45, '#4a2470'); gr.addColorStop(0.75, '#c44a7c'); gr.addColorStop(1, '#ff9a5e');
  g.fillStyle = gr; g.fillRect(vx0, -700, vx1 - vx0, 1200);
  g.save(); g.globalCompositeOperation = 'screen'; K.radial(g, camx + 380, 430, 620, [[0, 'rgba(255,170,100,0.5)'], [1, 'rgba(255,120,100,0)']]); g.restore();
  // far skylines with parallax (drawn so that they drift at p of the camera)
  [[0.25, 'b_sk1', 11, '#5a2f82', 'rgba(255,200,150,0.6)', 60, 230, 50, 120, 440], [0.5, 'b_sk2', 12, '#34205e', 'rgba(255,190,120,0.8)', 90, 320, 70, 150, 482]].forEach((L) => {
    const p = L[0], img = skylineTile(L[1], 3840, 360, L[2], L[3], L[4], L[5], L[6], L[7], L[8]);
    g.save(); g.translate(camx * (1 - p), 0);
    tileDraw(g, img, 3840, vx0 - camx * (1 - p), vx1 - camx * (1 - p), L[9] - 360, 360); g.restore();
  });
  // shop row + far sidewalk
  tileDraw(g, shopTile(), 2400, vx0, vx1, 334, 150);
  gr = g.createLinearGradient(0, 484, 0, 520); gr.addColorStop(0, '#7a5a88'); gr.addColorStop(1, '#5a4272');
  g.fillStyle = gr; g.fillRect(vx0, 484, vx1 - vx0, 38);
  g.fillStyle = 'rgba(255,190,130,0.55)'; g.fillRect(vx0, 520, vx1 - vx0, 3);
  // far lamps
  for (let lx = Math.floor(vx0 / 560) * 560; lx < vx1; lx += 560) {
    g.fillStyle = '#1a1030'; g.fillRect(lx - 3, 360, 6, 130); g.fillRect(lx - 3, 360, 28, 5);
    g.save(); g.globalCompositeOperation = 'lighter'; K.radial(g, lx + 24, 368, 46, [[0, 'rgba(255,220,160,0.7)'], [1, 'rgba(255,180,120,0)']]); g.restore();
  }
  // asphalt
  gr = g.createLinearGradient(0, 522, 0, 1010); gr.addColorStop(0, '#3c2c58'); gr.addColorStop(0.5, '#33244d'); gr.addColorStop(1, '#2a1c42');
  g.fillStyle = gr; g.fillRect(vx0, 522, vx1 - vx0, 488);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) { const lx = Math.floor(vx0 / 700) * 700 + i * 700 + 120; K.radial(g, lx, 700, 380, [[0, 'rgba(255,170,110,0.06)'], [1, 'rgba(255,170,110,0)']]); }
  g.restore();
  // lane markings
  for (let i = 0; i < LANE_BND.length; i++) {
    const y = LANE_BND[i], d = dScale(y), dash = 110 * d, gap = 90 * d;
    const per = dash + gap, sx = Math.floor(vx0 / per) * per;
    if (i === 2) {                                  // median: double yellow
      g.fillStyle = '#e8b53a'; g.fillRect(vx0, y - 4 * d, vx1 - vx0, 2.6 * d); g.fillRect(vx0, y + 2 * d, vx1 - vx0, 2.6 * d);
    } else {
      g.fillStyle = 'rgba(235,225,245,0.72)';
      for (let x = sx; x < vx1; x += per) g.fillRect(x, y - 1.6 * d, dash, 3.4 * d);
    }
  }
  // near sidewalk + curb
  g.fillStyle = '#a07fb0'; g.fillRect(vx0, 1004, vx1 - vx0, 7);
  g.fillStyle = 'rgba(255,190,130,0.6)'; g.fillRect(vx0, 1004, vx1 - vx0, 2.5);
  tileDraw(g, nearSide(), 1400, vx0, vx1, 1010, 420);
}

function road(g, lt) {
  const t = lt, R = T.rd;
  const hx = heroWX(t), hy = heroY(t);
  const q = (HY0 - hy) / (HY0 - HY1);
  const z = 1.3 + 0.08 * smooth((t - R.start - 0.1) / 5) + 0.06 * q;
  const camx = hx + 250 + 40 * q;
  const fy = hy - 150;
  const vx0 = camx - 960 / z - 40, vx1 = camx + 960 / z + 40;
  g.save();
  g.translate(960 - camx * z, 540 - fy * z); g.scale(z, z);
  roadBackdrop(g, camx, t, vx0 - 400, vx1 + 400);

  // ---- entities (cars + hero) sorted by ground line
  const ents = [], ghosts = [];
  const sH = 0.92 * dScale(hy), gA = win(t, R.ghost0, R.end - 0.25, 0.3, 0.2);
  for (const c of cars()) {
    const x = carX(c, t), L = c.lane, sc = dScale(LANE_Y[L]) * 1.05, dir = LANE_DIR[L];
    const xg = carX(c, t + CAR_LEAD);
    const real = x > vx0 - 260 && x < vx1 + 260, gh = gA > 0.01 && xg > vx0 - 260 && xg < vx1 + 260;
    if (!real && !gh) continue;
    if (real) ents.push({ y: LANE_Y[L], fn: () => {
      g.fillStyle = 'rgba(8,3,18,0.38)'; g.beginPath(); g.ellipse(x, LANE_Y[L] + 3, 200 * sc, 15 * sc, 0, 0, TAU); g.fill();
      g.save(); g.translate(x, LANE_Y[L]); g.scale(dir * sc, sc); g.drawImage(carSprite(c.col), -260, -230); g.restore();
      // speed streaks behind it
      g.save(); g.globalCompositeOperation = 'lighter'; const tl = -dir;
      const sg = g.createLinearGradient(x + tl * 190 * sc, 0, x + tl * (190 + 210) * sc, 0);
      sg.addColorStop(0, 'rgba(255,225,200,0.16)'); sg.addColorStop(1, 'rgba(255,225,200,0)');
      g.fillStyle = sg; g.fillRect(Math.min(x + tl * 190 * sc, x + tl * 400 * sc), LANE_Y[L] - 70 * sc, 210 * sc, 5 * sc);
      g.fillRect(Math.min(x + tl * 190 * sc, x + tl * 400 * sc), LANE_Y[L] - 36 * sc, 210 * sc, 4 * sc); g.restore();
    } });
    if (gh) ghosts.push({ c, x, xg, L, sc, dir });
  }
  const hpose = (() => {
    const u = rdU(t);
    const walk = smooth(u / 0.25) * (1 - smooth((t - (R.cross1 - 0.1)) / 0.3));
    const dist = (heroDist(t) * 0.6 + hx) ;
    const ph = dist / (STRIDE * 0.92);
    return walkerPose({ phase: ph, walk, lean: 0.07, bob: 1, eyeOpen: 1, eyeGlow: 0.9, flutter: 0.3 * walk });
  })();
  const hero = { x: hx, y: hy, s: sH, facing: 1, pose: hpose, pal: HERO };
  const gs = carGhostSprite();
  for (const o of ghosts) {
    const gap = Math.abs(o.xg - o.x), fa = gA * clamp(gap / 120);
    if (fa < 0.02) continue;
    ents.push({ y: LANE_Y[o.L] + 1, fn: () => {
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 * fa; g.translate(o.xg, LANE_Y[o.L]); g.scale(o.dir * o.sc, o.sc); g.drawImage(gs, -260, -230); g.restore();
    } });
  }
  ents.push({ y: hy, fn: () => K.fig(g, hero) });
  dep(ents);

  // ---- dotted prediction lines + horns
  for (const o of ghosts) {
    if (!o.c.near) continue;
    const gap = Math.abs(o.xg - o.x), fa = gA * clamp(gap / 160);
    if (fa < 0.05) continue;
    const yy = LANE_Y[o.L] - 14 * o.sc;
    K.dotPath(g, (u) => ({ x: lerp(o.x + o.dir * 190 * o.sc, o.xg + o.dir * 190 * o.sc, u), y: yy }), 1, 9, 2.6 * o.sc, 0.75 * fa, t);
  }
  // horn arcs
  for (const c of cars()) {
    if (!c.horn) continue;
    const u = (t - c.tp + 0.12) / 0.55;
    if (u < 0 || u > 1) continue;
    const x = carX(c, t), L = c.lane, sc = dScale(LANE_Y[L]) * 1.05, dir = LANE_DIR[L];
    g.save(); g.translate(x + dir * 150 * sc, LANE_Y[L] - 100 * sc); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const uu = clamp(u * 1.4 - i * 0.14); if (uu <= 0 || uu >= 1) continue;
      g.strokeStyle = 'rgba(255,240,200,' + (0.8 * (1 - uu)) + ')'; g.lineWidth = 5 * sc;
      g.beginPath(); g.arc(0, 0, (30 + 70 * uu) * sc, dir > 0 ? -0.7 : Math.PI - 0.7, dir > 0 ? 0.7 : Math.PI + 0.7); g.stroke();
    }
    g.restore();
  }
  g.restore();

  // dark foreground poles whipping past (parallax 1.4)
  g.save(); g.fillStyle = '#0c0618';
  for (let i = 0; i < 4; i++) {
    const wx = ((i * 1300 - camx * 1.5) % 5200 + 5200) % 5200 - 800;
    g.globalAlpha = 0.9; g.fillRect(wx, 0, 30, H); g.fillStyle = 'rgba(255,160,100,0.3)'; g.fillRect(wx + 28, 0, 2, H); g.fillStyle = '#0c0618';
  }
  g.restore();
  // vignette for focus
  const vg = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.7);
  vg.addColorStop(0, 'rgba(10,4,24,0)'); vg.addColorStop(1, 'rgba(10,4,24,0.45)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  flashIn(g, t, R.start, 0.85);
  whipOut(g, t, R.end, -1, 21);
}

// ---------------------------------------------------------------------------------------------------
// SHOT C  obstacle montage (22.95 .. 27.0): bus, bike, pigeon, man with a ladder, each led by a cyan ghost
// ---------------------------------------------------------------------------------------------------
const OB = T.ob;
// hero velocity profile (px/s) -> integrated x table
let _obX = null;
function obHeroTable() {
  if (_obX) return _obX;
  const dt = 0.01, n = Math.ceil((OB.end - OB.start) / dt) + 2, tab = new Float32Array(n);
  let x = 2400;
  for (let i = 0; i < n; i++) {
    const t = OB.start + i * dt;
    tab[i] = x;
    let v = 150;
    v *= 1 - 0.97 * smooth((t - 23.55) / 0.22) * (1 - smooth((t - 24.38) / 0.3));            // bus: stop
    v += -230 * Math.exp(-Math.pow((t - OB.bike + 0.02) / 0.14, 2));                           // bike: step back
    v *= 1 - 0.8 * smooth((t - 25.3) / 0.15) * (1 - smooth((t - 25.8) / 0.3));                // pigeon: lean back
    v *= 1 - 0.85 * smooth((t - 25.85) / 0.15) * (1 - smooth((t - 26.55) / 0.25));           // ladder: duck
    x += v * dt;
  }
  return (_obX = tab);
}
function obHx(t) {
  const tab = obHeroTable(), u = clamp((t - OB.start) / 0.01, 0, tab.length - 1.001), i = Math.floor(u);
  return lerp(tab[i], tab[i + 1], u - i);
}
const obWin = (t, a, b, f) => smooth((t - a) / f) * (1 - smooth((t - b) / f));

// ---- painted props (cached)
function busPaint(c, ghost) {
  c.translate(330, 236);
  const body = ghost ? 'rgba(95,217,255,0.55)' : '#e8a23a', dark = ghost ? 'rgba(31,120,255,0.7)' : '#b8701f', glass = ghost ? 'rgba(220,252,255,0.75)' : '#2a3a68';
  c.lineJoin = 'round'; c.lineWidth = 4; c.strokeStyle = ghost ? '#d5fbff' : '#2a1608';
  K.rrect(c, -290, -200, 580, 168, 22); c.fillStyle = body; c.fill(); c.stroke();
  c.fillStyle = dark; c.fillRect(-286, -78, 572, 26);
  c.fillStyle = ghost ? 'rgba(255,255,255,0.35)' : 'rgba(255,240,200,0.35)'; c.fillRect(-282, -196, 564, 8);
  for (let i = 0; i < 6; i++) { K.rrect(c, -262 + i * 78, -178, 64, 70, 8); c.fillStyle = glass; c.fill(); c.lineWidth = 3; c.stroke(); }
  K.rrect(c, 212, -178, 60, 112, 8); c.fillStyle = glass; c.fill(); c.stroke();
  c.fillStyle = ghost ? '#ffffff' : '#ffe9a0'; c.fillRect(276, -70, 14, 18);
  c.fillStyle = ghost ? 'rgba(255,255,255,0.8)' : '#ff7a5a'; c.fillRect(-292, -70, 8, 18);
  [-188, 168].forEach((wx) => {
    c.beginPath(); c.arc(wx, -28, 40, 0, TAU); c.fillStyle = ghost ? 'rgba(31,120,255,0.8)' : '#14101c'; c.fill(); c.lineWidth = 4; c.stroke();
    c.beginPath(); c.arc(wx, -28, 17, 0, TAU); c.fillStyle = ghost ? '#d5fbff' : '#8a84a0'; c.fill();
  });
}
const busSprite = (ghost) => K.cv(ghost ? 'c_busG' : 'c_bus', 660, 270, (c) => busPaint(c, ghost));
const bikeSprite = (ghost) => K.cv(ghost ? 'c_bikeG' : 'c_bike', 520, 330, (c) => {
  c.translate(260, 270);
  drawBike(c, { x: 0, y: 0, s: 1, facing: 1, wheel: 0.6, pedal: 1.2, speed: 2600, pal: ghost ? palGhost(0.9) : PAL_REAL, alpha: 1 });
});
function pigeon(g, x, y, s, flap, face, ghost, a) {
  g.save(); g.translate(x, y); g.scale(face * s, s); g.globalAlpha = a == null ? 1 : a;
  const body = ghost ? '#7fe9ff' : '#8f89a8', wing = ghost ? '#bff6ff' : '#6e688a', dk = ghost ? '#36adff' : '#4a4466', out = ghost ? '#e9feff' : '#241c38';
  g.lineWidth = 3; g.strokeStyle = out; g.lineJoin = 'round';
  // far wing
  g.save(); g.rotate(-0.6 - 0.9 * Math.sin(flap)); g.fillStyle = dk;
  g.beginPath(); g.ellipse(-12, -10, 34, 12, -0.4, 0, TAU); g.fill(); g.stroke(); g.restore();
  // tail
  g.fillStyle = dk; g.beginPath(); g.moveTo(-40, 2); g.lineTo(-74, -6); g.lineTo(-70, 14); g.closePath(); g.fill(); g.stroke();
  // body
  g.fillStyle = body; g.beginPath(); g.ellipse(0, 4, 44, 24, 0.1, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = ghost ? '#ffffff' : '#c9a6e8'; g.beginPath(); g.ellipse(26, 2, 16, 12, 0, 0, TAU); g.fill();
  // head
  g.fillStyle = body; g.beginPath(); g.arc(44, -12, 16, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = ghost ? '#ffd27a' : '#f0a040'; g.beginPath(); g.moveTo(58, -14); g.lineTo(74, -9); g.lineTo(58, -6); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = ghost ? '#0a1a3a' : '#fff'; g.beginPath(); g.arc(49, -15, 4.5, 0, TAU); g.fill();
  g.fillStyle = '#10081c'; g.beginPath(); g.arc(50, -15, 2.2, 0, TAU); g.fill();
  // near wing
  g.save(); g.translate(-6, -8); g.rotate(-0.5 - 1.0 * Math.sin(flap + 0.5)); g.fillStyle = wing;
  g.beginPath(); g.ellipse(-4, -22, 40, 15, -0.2, 0, TAU); g.fill(); g.stroke(); g.restore();
  g.restore();
}
function ladderDraw(g, x, y, len, ang, ghost, a) {
  g.save(); g.translate(x, y); g.rotate(ang); g.globalAlpha = a == null ? 1 : a;
  const col = ghost ? '#aef3ff' : '#d49a48', dk = ghost ? '#36adff' : '#7a4a18', hw = 17;
  g.lineCap = 'round';
  g.strokeStyle = dk; g.lineWidth = 7;
  for (let i = 0; i * 34 <= len; i++) { const lx = -len / 2 + i * 34; g.beginPath(); g.moveTo(lx, -hw); g.lineTo(lx, hw); g.stroke(); }
  g.strokeStyle = col; g.lineWidth = 8;
  g.beginPath(); g.moveTo(-len / 2, -hw); g.lineTo(len / 2, -hw); g.stroke();
  g.beginPath(); g.moveTo(-len / 2, hw); g.lineTo(len / 2, hw); g.stroke();
  g.restore();
}
const LADDER_MAN_POSE = (x, t) => {
  const w = walkPose(x, -1, { lean: 0.02 });
  const kp = K.pose(K.S({ eo: 1, hFx: 34, hFy: -84, hBx: 16, hBy: -92 }), t);
  const J = w.J, KJ = kp.J, mv = (p) => ({ x: J.x + p.x - KJ.x, y: J.y + p.y - KJ.y });
  w.armF = { sh: J, elbow: mv(kp.armF.elbow), hand: mv(kp.armF.hand) };
  w.armB = { sh: J, elbow: mv(kp.armB.elbow), hand: mv(kp.armB.hand) };
  return w;
};
const GHOST_MAN = () => K.cv('c_manG', 320, 380, (c) => {
  c.translate(160, 330);
  K.fig(c, { x: 0, y: 0, s: 0.9, facing: -1, pose: LADDER_MAN_POSE(30, 0), pal: palGhost(0.9), alpha: 1, shadow: false });
});

// obstacle kinematics. All in world coordinates; "x(t)" for the real thing, the ghost uses x(t + lead).
const obBus = (t) => obHx(OB.bus) - 20 - 1650 * (t - OB.bus);
const obBike = (t) => obHx(OB.bike) + 20 - 1250 * (t - OB.bike);
const obPig = (t) => ({ x: obHx(OB.pigeon) + 50 - 1050 * (t - OB.pigeon), y: 600 - 150 * clamp((OB.pigeon - t) / 0.5) - 110 * clamp((t - OB.pigeon) / 0.6) + 12 * Math.sin(t * 19) });
const LAD_TIP = 205;                                  // front tip distance from the man
const obMan = (t) => obHx(OB.ladder - 0.2) + 180 - 560 * (t - (OB.ladder - 0.2));

function obstacles(g, lt) {
  const t = lt;
  const hx = obHx(t);
  const cam = camB(hx + 290, 612, 1.2, 0);
  const cx = cam.x, half = 960 / cam.z + 320;
  g.save(); camTransform(g, cam);
  drawWorld(g, cam, t);

  const ents = [], ghostsDraw = [];
  const lead = OB.lead;
  // ---- hero
  {
    const react = (a, b) => obWin(t, a, b, 0.12);
    const stopW = 1 - clamp(Math.abs(obHx(t + 0.02) - obHx(t - 0.02)) / 0.04 / 140);
    const base = walkPose(hx, 1, { walk: clamp(1 - stopW * 1.0), eyeGlow: 0.95, lean: 0.07 });
    let pose = base;
    const busW = react(23.6, 24.4), bikeW = react(24.5, 24.95), pigW = react(25.3, 25.8), ladW = react(25.85, 26.7);
    if (busW > 0.01) pose = poseMix(pose, K.pose(K.S({ eo: 1, eg: 1, a1: -0.16, a2: -0.2, hFx: 58, hFy: -40, hBx: 42, hBy: -28 }), t), 0.85 * busW);
    if (bikeW > 0.01) pose = poseMix(pose, K.pose(K.S({ eo: 1, eg: 1, a1: -0.24, a2: -0.3, hx: -10, hFx: 36, hFy: -52, hBx: 12, hBy: -34, fFy: 14, fFx: 18, fBx: -22 }), t), 0.9 * bikeW);
    if (pigW > 0.01) pose = poseMix(pose, K.pose(K.S({ eo: 1, eg: 1, a1: -0.34, a2: -0.42, hx: -14, hFx: 28, hFy: -62, hBx: 16, hBy: -44 }), t), 0.9 * pigW);
    if (ladW > 0.01) pose = poseMix(pose, K.pose(K.S({ eo: 1, eg: 1, a1: 0.5, a2: 0.62, hy: 54, hFx: 12, hFy: 34, hBx: -6, hBy: 40, fFx: 14, fBx: -12 }), t), 0.92 * ladW);
    const hero = { x: hx, y: 820, s: 0.92, facing: 1, pose: pose, pal: HERO };
    ents.push({ y: 820, fn: () => withLayer(g, cam, 1, () => K.fig(g, hero)) });
  }
  // ---- bus (on the road, in front of the sidewalk)
  const BY = 905, BS = 0.74;
  for (const gh of [false, true]) {
    const tt = gh ? t + lead : t, x = obBus(tt);
    if (Math.abs(x - cx) > half + 400) continue;
    if (gh) {
      const gap = Math.abs(obBus(t + lead) - obBus(t)), fa = win(t, OB.start + 0.2, OB.bus, 0.15, 0.0) * clamp((gap - 60) / 200);
      if (fa > 0.02 && t < OB.bus + 0.3) ghostsDraw.push(() => withLayer(g, cam, 1, () => { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.6 * fa; g.translate(x, BY); g.scale(-BS, BS); g.drawImage(busSprite(true), -330, -236); g.restore(); }));
    } else if (t < OB.bus + 1.2) {
      ents.push({ y: BY, fn: () => withLayer(g, cam, 1, () => {
        g.fillStyle = 'rgba(8,3,18,0.4)'; g.beginPath(); g.ellipse(x, BY + 2, 300 * BS, 14, 0, 0, TAU); g.fill();
        g.save(); g.translate(x, BY); g.scale(-BS, BS); g.drawImage(busSprite(false), -330, -236); g.restore();
        K.streaks(g, x + 330 * BS, BY - 90 * BS, 1, 0, 300, 0.5, 7, 6, 40);
      }) });
    }
  }
  // ---- bike (on the sidewalk, in front of the hero)
  for (const gh of [false, true]) {
    const tt = gh ? t + lead : t, x = obBike(tt), Y = 842, S = 0.86;
    if (Math.abs(x - cx) > half + 300) continue;
    if (gh) {
      const gap = Math.abs(obBike(t + lead) - obBike(t)), fa = win(t, OB.bus + 0.35, OB.bike, 0.15, 0.0) * clamp((gap - 50) / 150);
      if (fa > 0.02 && t < OB.bike + 0.3) ghostsDraw.push(() => withLayer(g, cam, 1, () => { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.95 * fa; g.translate(x, Y); g.scale(-S, S); g.drawImage(bikeSprite(true), -260, -270); g.restore(); }));
    } else if (t > OB.bike - 1.0 && t < OB.bike + 1.0) {
      ents.push({ y: Y, fn: () => withLayer(g, cam, 1, () => {
        g.fillStyle = 'rgba(8,3,18,0.35)'; g.beginPath(); g.ellipse(x, Y + 3, 150 * S, 11, 0, 0, TAU); g.fill();
        g.save(); g.translate(x, Y); g.scale(-S, S); g.drawImage(bikeSprite(false), -260, -270); g.restore();
      }) });
    }
  }
  // ---- pigeon (flies at head height)
  for (const gh of [false, true]) {
    const tt = gh ? t + lead : t, p = obPig(tt);
    if (Math.abs(p.x - cx) > half + 150) continue;
    if (gh) {
      const gap = Math.abs(obPig(t + lead).x - obPig(t).x), fa = win(t, OB.bike + 0.3, OB.pigeon, 0.12, 0.0) * clamp((gap - 40) / 120);
      if (fa > 0.02 && t < OB.pigeon + 0.3) ghostsDraw.push(() => withLayer(g, cam, 1, () => { g.save(); g.globalCompositeOperation = 'lighter'; pigeon(g, p.x, p.y, 1.1, tt * 34, -1, true, 0.7 * fa); g.restore(); }));
    } else if (t > OB.pigeon - 1.0 && t < OB.pigeon + 1.0) {
      ents.push({ y: 900, fn: () => withLayer(g, cam, 1, () => pigeon(g, p.x, p.y, 1.1, t * 34, -1, false, 1)) });
    }
  }
  // ---- man with a ladder (walks left along the sidewalk; ladder passes over the hero's ducked head)
  for (const gh of [false, true]) {
    const tt = gh ? t + lead : t, mx = obMan(tt), MY = 812;
    if (Math.abs(mx - cx) > half + 360) continue;
    const lx = mx - LAD_TIP + 190 - 190 * 0, tilt = -0.07;
    if (gh) {
      const gap = Math.abs(obMan(t + lead) - obMan(t)), fa = win(t, OB.pigeon + 0.3, OB.ladder, 0.12, 0.0) * clamp((gap - 30) / 90);
      if (fa > 0.02 && t < OB.ladder + 0.3) ghostsDraw.push(() => withLayer(g, cam, 1, () => {
        g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.6 * fa; g.drawImage(GHOST_MAN(), mx - 160, MY - 330); g.restore();
        g.save(); g.globalCompositeOperation = 'lighter'; ladderDraw(g, mx - 10, 604, 340, tilt, true, 0.7 * fa); g.restore();
      }));
    } else if (t > OB.ladder - 1.8 && t < OB.ladder + 1.6) {
      ents.push({ y: MY, fn: () => withLayer(g, cam, 1, () => {
        K.fig(g, { x: mx, y: MY, s: 0.9, facing: -1, pose: LADDER_MAN_POSE(mx, t), pal: NPC_PAL[4] });
        ladderDraw(g, mx - 10, 604, 340, tilt, false, 1);
      }) });
    }
  }
  dep(ents);
  for (const f of ghostsDraw) f();
  g.restore();

  // wind rush on the passing bus
  const bw = obWin(t, OB.bus - 0.25, OB.bus + 0.5, 0.1);
  if (bw > 0.01) K.streaks(g, W * 0.5, 560, -1, 0, 500, bw * 0.55, 11, 8, 220);
  // soft focus vignette
  const vg = g.createRadialGradient(W / 2, H * 0.55, H * 0.4, W / 2, H * 0.55, W * 0.7);
  vg.addColorStop(0, 'rgba(10,4,24,0)'); vg.addColorStop(1, 'rgba(10,4,24,0.4)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  // small ghost flash cue for each obstacle arrival (tiny cyan pulse at the screen edge it comes from)
  flashIn(g, t, OB.start, 0.85);
  whipOut(g, t, OB.end, 1, 33);
}

// ---------------------------------------------------------------------------------------------------
// SHOT D  ghost before real (27.0 .. 31.857): ball, flowerpot, skateboard, cart; each ghost leads the real one by 0.8 s
// ---------------------------------------------------------------------------------------------------
const GHS = T.gh, GA = GHS.obs;
let _ghX = null;
function ghTable() {
  if (_ghX) return _ghX;
  const dt = 0.01, n = Math.ceil((GHS.end - GHS.start) / dt) + 2, tab = new Float32Array(n);
  let x = 5200;
  for (let i = 0; i < n; i++) {
    const t = GHS.start + i * dt;
    tab[i] = x;
    let v = 150;
    v *= 1 - 0.96 * smooth((t - (GA[1] - 0.3)) / 0.15) * (1 - smooth((t - (GA[1] + 0.35)) / 0.3));
    v += -210 * Math.exp(-Math.pow((t - (GA[1] - 0.08)) / 0.11, 2));
    v *= 1 - 0.96 * smooth((t - (GA[3] - 0.25)) / 0.15) * (1 - smooth((t - (GA[3] + 0.45)) / 0.3));
    x += v * dt;
  }
  return (_ghX = tab);
}
function ghHx(t) {
  const tab = ghTable(), u = clamp((t - GHS.start) / 0.01, 0, tab.length - 1.001), i = Math.floor(u);
  return lerp(tab[i], tab[i + 1], u - i);
}
const INK = (gh) => (gh ? '#e9feff' : '#1c0e2a');
function ballPaint(g, x, y, rot, gh, a) {
  g.save(); g.translate(x, y - 26); g.rotate(rot); g.globalAlpha = a == null ? 1 : a;
  g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.fillStyle = gh ? 'rgba(127,233,255,0.8)' : '#f4efe6'; g.fill();
  g.lineWidth = 3; g.strokeStyle = INK(gh); g.stroke();
  g.fillStyle = gh ? '#36adff' : '#1c1428';
  for (let i = 0; i < 5; i++) { const an = i * TAU / 5; g.beginPath(); g.arc(Math.cos(an) * 15, Math.sin(an) * 15, 6.5, 0, TAU); g.fill(); }
  g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill();
  g.restore();
}
function potPaint(g, x, y, rot, gh, a) {
  g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = a == null ? 1 : a;
  g.lineWidth = 3; g.strokeStyle = INK(gh); g.lineJoin = 'round';
  // plant
  g.fillStyle = gh ? 'rgba(95,217,255,0.7)' : '#4fb060';
  [[-18, -58, -0.6], [0, -72, 0], [18, -58, 0.6]].forEach((l) => { g.save(); g.translate(l[0], -44); g.rotate(l[2]); g.beginPath(); g.ellipse(0, -18, 9, 22, 0, 0, TAU); g.fill(); g.stroke(); g.restore(); });
  g.fillStyle = gh ? 'rgba(127,233,255,0.8)' : '#ff6a8a'; g.beginPath(); g.arc(0, -76, 11, 0, TAU); g.fill(); g.stroke();
  // pot
  g.beginPath(); g.moveTo(-28, -52); g.lineTo(28, -52); g.lineTo(20, 0); g.lineTo(-20, 0); g.closePath();
  g.fillStyle = gh ? 'rgba(127,233,255,0.85)' : '#c8643a'; g.fill(); g.stroke();
  g.fillStyle = gh ? 'rgba(95,217,255,0.8)' : '#df7e4c'; g.fillRect(-31, -62, 62, 14); g.strokeRect(-31, -62, 62, 14);
  g.restore();
}
function brokenPot(g, x, y, u) {
  const k = smooth(u);
  g.save(); g.translate(x, y); g.lineWidth = 3; g.strokeStyle = INK(false); g.lineJoin = 'round';
  g.fillStyle = '#3a2418'; g.beginPath(); g.ellipse(0, -4, 34, 9, 0, 0, TAU); g.fill();
  g.fillStyle = '#c8643a';
  [[-36 - 10 * k, 0, -0.4, 20], [30 + 14 * k, 0, 0.5, 18], [-8, -2, 0.1, 14], [48 + 16 * k, 0, 0.9, 10]].forEach((s) => {
    g.save(); g.translate(s[0], s[1]); g.rotate(s[2]); g.beginPath(); g.moveTo(-s[3], 0); g.lineTo(0, -s[3] * 1.1); g.lineTo(s[3], 0); g.closePath(); g.fill(); g.stroke(); g.restore();
  });
  g.fillStyle = '#4fb060'; g.beginPath(); g.ellipse(-4, -10, 12, 6, -0.3, 0, TAU); g.fill();
  g.restore();
}
function boardPaint(g, x, y, rot, gh, a) {
  g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = a == null ? 1 : a; g.lineWidth = 3; g.strokeStyle = INK(gh); g.lineJoin = 'round';
  g.fillStyle = gh ? 'rgba(127,233,255,0.85)' : '#d94a6a';
  g.beginPath(); g.moveTo(-58, -30); g.quadraticCurveTo(-52, -16, -42, -16); g.lineTo(42, -16); g.quadraticCurveTo(52, -16, 58, -30);
  g.lineTo(54, -30); g.quadraticCurveTo(48, -22, 40, -22); g.lineTo(-40, -22); g.quadraticCurveTo(-48, -22, -54, -30); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = gh ? '#d5fbff' : '#f6e8c8';
  [-32, 32].forEach((wx) => { g.beginPath(); g.arc(wx, -9, 9, 0, TAU); g.fill(); g.stroke(); });
  g.restore();
}
function cartPaint(g, x, y, rot, gh, a, t) {
  g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = a == null ? 1 : a; g.lineCap = 'round'; g.lineJoin = 'round';
  const col = gh ? '#d5fbff' : '#c4c0d4', ink = INK(gh);
  g.fillStyle = gh ? 'rgba(127,233,255,0.3)' : 'rgba(60,50,90,0.35)';
  g.beginPath(); g.moveTo(-44, -84); g.lineTo(52, -84); g.lineTo(40, -42); g.lineTo(-34, -42); g.closePath(); g.fill();
  g.strokeStyle = ink; g.lineWidth = 7; g.stroke();
  g.strokeStyle = col; g.lineWidth = 3.6; g.stroke();
  for (let i = 1; i < 6; i++) { const u = i / 6; g.beginPath(); g.moveTo(lerp(-44, 52, u), -84); g.lineTo(lerp(-34, 40, u), -42); g.stroke(); }
  g.beginPath(); g.moveTo(-40, -63); g.lineTo(46, -63); g.stroke();
  g.strokeStyle = ink; g.lineWidth = 7; g.beginPath(); g.moveTo(-44, -84); g.lineTo(-66, -98); g.lineTo(-66, -102); g.stroke();
  g.strokeStyle = col; g.lineWidth = 3.6; g.beginPath(); g.moveTo(-44, -84); g.lineTo(-66, -98); g.lineTo(-66, -102); g.stroke();
  g.strokeStyle = col; g.lineWidth = 3.6; g.beginPath(); g.moveTo(-30, -42); g.lineTo(-28, -14); g.moveTo(34, -42); g.lineTo(32, -14); g.stroke();
  g.fillStyle = gh ? '#36adff' : '#14101c';
  [-28, 32].forEach((wx) => { g.beginPath(); g.arc(wx, -10, 10, 0, TAU); g.fill(); g.lineWidth = 2.4; g.strokeStyle = ink; g.stroke(); });
  g.restore();
}
// kinematics (world x; ground y = 836)
const GY = 836;
const gBall = (t) => ({ x: ghHx(GA[0]) + 15 - 760 * (t - GA[0]), y: GY - 2, rot: 0.0 });
const gPot = (t) => { const T0 = GA[1], u = Math.min(0, t - T0); return { x: ghHx(T0) + 78, y: GY - 1450 * u * u * 1.0 - 0, rot: 0.3 * u }; };
const gBoard = (t) => ({ x: ghHx(GA[2]) + 10 - 640 * (t - GA[2]), y: GY - 2 + 3 * Math.sin(t * 40), rot: 0.02 * Math.sin(t * 33) });
const gCart = (t) => ({ x: ghHx(GA[3]) - 60 + 560 * (t - GA[3]), y: GY, rot: 0.03 * Math.sin(t * 29) });

function ghostRow(g, lt) {
  const t = lt, cam = camB(ghHx(t) + 290, 612, 1.2, 0), cx = cam.x, half = 960 / cam.z + 320, L = GHS.lead;
  g.save(); camTransform(g, cam);
  drawWorld(g, cam, t);
  const ents = [], gl = [];
  const defs = [
    { arr: GA[0], pos: gBall, paint: (x, y, r, gh, a) => ballPaint(g, x + 0, y, -x / 26, gh, a), real: [-1.6, 1.0] },
    { arr: GA[1], pos: gPot, paint: (x, y, r, gh, a) => potPaint(g, x, y, r, gh, a), real: [-0.8, 0] },
    { arr: GA[2], pos: gBoard, paint: (x, y, r, gh, a) => boardPaint(g, x, y, r, gh, a), real: [-1.6, 1.0] },
    { arr: GA[3], pos: gCart, paint: (x, y, r, gh, a) => cartPaint(g, x, y, r, gh, a, t), real: [-1.6, 1.0] }
  ];
  defs.forEach((d, i) => {
    const rp = d.pos(t);
    if (t > d.arr + d.real[0] && t < d.arr + d.real[1] + 0.001 && Math.abs(rp.x - cx) < half + 100) {
      ents.push({ y: GY + i * 0.1, fn: () => withLayer(g, cam, 1, () => {
        if (rp.y > GY - 6 || i !== 1) { g.fillStyle = 'rgba(8,3,18,0.35)'; g.beginPath(); g.ellipse(rp.x, GY + 2, 42, 7, 0, 0, TAU); g.fill(); }
        d.paint(rp.x, rp.y, rp.rot, false, 1);
      }) });
    }
    // ghost: shows where it will be L seconds from now; fades as the real one catches up
    const tg = Math.min(t + L, d.arr + (i === 1 ? 0 : 0.35)), gp = d.pos(tg);
    const ga = win(t, d.arr - L - 0.55, d.arr + 0.05, 0.2, 0.1) * clamp((Math.abs(gp.x - rp.x) + Math.abs(gp.y - rp.y) - 40) / 120);
    if (ga > 0.02 && Math.abs(gp.x - cx) < half + 100) gl.push(() => withLayer(g, cam, 1, () => {
      g.save(); g.globalCompositeOperation = 'lighter';
      K.radial(g, gp.x, gp.y - 30, 90, [[0, glowCol(0.28 * ga)], [1, glowCol(0)]]);
      d.paint(gp.x, gp.y, gp.rot, true, 0.78 * ga);
      g.restore();
      if (i === 1) {                                         // dotted drop line for the pot
        K.dotPath(g, (u) => ({ x: gp.x, y: lerp(rp.y - 60, gp.y - 70, u) }), 1, 10, 3, 0.6 * ga, t);
      } else {
        const dir = Math.sign(gp.x - rp.x) || 1;
        K.dotPath(g, (u) => ({ x: lerp(rp.x, gp.x, u), y: GY - 62 }), 1, 8, 3, 0.55 * ga, t);
      }
    }));
  });
  // pot: shards + wreck after impact
  {
    const u = t - GA[1];
    if (u > 0 && u < 2) {
      ents.push({ y: GY + 0.3, fn: () => withLayer(g, cam, 1, () => {
        const p = gPot(GA[1]);
        brokenPot(g, p.x, GY, clamp(u / 0.3));
        K.puffs(g, p.x, GY - 6, u / 0.9, 5, 36, 77, 'rgba(230,200,170,', 40);
        if (u < 0.3) K.burst(g, p.x + 40, GY - 20, 80, u / 0.3, 31, '#ffb070');
      }) });
    }
  }
  // hero
  {
    const hx = ghHx(t);
    const spd = Math.abs(ghHx(t + 0.02) - ghHx(t - 0.02)) / 0.04;
    const walkAmt = clamp(spd / 120);
    let pose = walkPose(hx, 1, { walk: walkAmt, eyeGlow: 0.95, lean: 0.07 });
    const hopW = (a) => { const u = (t - (a - 0.2)) / 0.4; return u > 0 && u < 1 ? u : -1; };
    let lift = 0;
    for (const a of [GA[0], GA[2]]) {
      const u = hopW(a);
      if (u >= 0) { pose = poseMix(pose, walkerPose({ walk: 0, step: u, eyeOpen: 1, eyeGlow: 1, lean: 0.02 }), 1); lift = 34 * Math.sin(Math.PI * u); }
    }
    const pw = obWin(t, GA[1] - 0.3, GA[1] + 0.7, 0.12), cw = obWin(t, GA[3] - 0.25, GA[3] + 0.8, 0.12);
    if (pw > 0.01) pose = poseMix(pose, K.pose(K.S({ eo: 1, eg: 1, a1: -0.2, a2: -0.26, hx: -8, hFx: 46, hFy: -46, hBx: 30, hBy: -34, fFy: 8 }), t), 0.9 * pw);
    if (cw > 0.01) pose = poseMix(pose, K.pose(K.S({ eo: 1, eg: 1, a1: -0.12, a2: -0.16, hFx: 60, hFy: -22, hBx: 44, hBy: -12 }), t), 0.85 * cw);
    const hero = { x: hx, y: 820 - lift, s: 0.92, facing: 1, pose: pose, pal: HERO };
    ents.push({ y: 820, fn: () => withLayer(g, cam, 1, () => K.fig(g, hero)) });
  }
  dep(ents);
  for (const f of gl) f();
  g.restore();
  const vg = g.createRadialGradient(W / 2, H * 0.55, H * 0.4, W / 2, H * 0.55, W * 0.7);
  vg.addColorStop(0, 'rgba(10,4,24,0)'); vg.addColorStop(1, 'rgba(10,4,24,0.4)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  flashIn(g, t, GHS.start, 0.85);
  whipOut(g, t, GHS.end, -1, 41);
}

// ---------------------------------------------------------------------------------------------------
// SHOT E  impossibly smooth (31.857 .. 38.5): slow dolly, the crowd lurches and scatters around him
// ---------------------------------------------------------------------------------------------------
const SM = T.sm;
const smHx = (u) => 1000 + 88 * u;
const SM_MEET = 3.3, SM_XM = smHx(SM_MEET) - 300;
const smPairA = (u) => SM_XM - 14 - 70 * Math.max(0, SM_MEET - u) + 5 * Math.max(0, u - SM_MEET);
const smPairB = (u) => SM_XM + 16 + 70 * Math.max(0, SM_MEET - u) + 4 * Math.max(0, u - SM_MEET);
let _smN = null;
function smCrowd() {
  if (_smN) return _smN;
  const r = rng(515), out = [], N = 14;
  for (let i = 0; i < N; i++) {
    const front = i % 6 === 5;
    const n = { x0: 100 + (i + 0.5) * (1900 / N) + (r() - 0.5) * 60, v: (i % 2 ? -1 : 1) * (36 + r() * 40), y: front ? 872 + r() * 16 : 772 + r() * 28, col: (i * 3 + 2) % NPC_PAL.length,
      phone: r() < 0.3 ? 1 : 0, off: r(), stum: r() < 0.6 ? 1 : 0 };
    for (let u = 0; u <= 6.7; u += 0.2) {
      const x = n.x0 + n.v * u;
      if (front && Math.abs(x - smHx(u)) < 260) { n.y = 774 + r() * 20; break; }
      if (((Math.abs(x - SM_XM) < 150 && u > 2.4 && u < 6) || Math.abs(x - smPairA(u)) < 120 || Math.abs(x - smPairB(u)) < 120) && Math.abs(n.y - 803) < 44) { n.y = 750 + r() * 8; break; }
    }
    out.push(n);
  }
  return (_smN = out);
}
const SM_STUM = K.S({ eo: 1, a1: -0.3, a2: -0.4, hFx: 62, hFy: -44, hBx: 42, hBy: -26, fl: 0.7 });
const SM_BUMP = K.S({ eo: 1, a1: -0.22, a2: -0.32, hFx: 54, hFy: -60, hBx: 36, hBy: -48, fl: 0.8 });
const SM_HIT = K.S({ eo: 1, a1: -0.3, a2: -0.42, hFx: 40, hFy: -66, hBx: 56, hBy: -54, fFx: 20, fBx: -20 });
const SM_FG = [{ x0: 170, v: 20, s: 2.3, dir: 1, ph: 0.3 }, { x0: 1790, v: -16, s: 2.1, dir: -1, ph: 1.7 }];

function smooth_shot(g, lt) {
  const t = lt, u = t - SM.start, hx = smHx(u);
  const cam = camB(hx + 130 + 10 * u, 625 + 8 * Math.sin(u * 0.6), 1.32 + 0.05 * (u / 6.6), 0);
  g.save(); camTransform(g, cam);
  drawWorld(g, cam, t);
  const ents = [];
  for (const n of smCrowd()) {
    const x = n.x0 + n.v * u;
    if (x < cam.x - 960 / cam.z - 150 || x > cam.x + 960 / cam.z + 150) continue;
    const dx = x - hx, gg = Math.exp(-(dx / 160) * (dx / 160));
    const y = n.y + (n.y >= 818 ? 1 : -1) * 34 * gg;
    const dirn = n.v > 0 ? 1 : -1, sc = clamp(0.8 + (y - 790) / 52 * 0.18, 0.78, 1.02);
    let pose = walkPose(x + n.off * 70, dirn, { phone: n.phone && gg < 0.2 ? 1 : 0, headDown: n.phone && gg < 0.2 ? 0.38 : 0, lean: 0.08 });
    if (n.stum && gg > 0.05) pose = poseMix(pose, K.pose(SM_STUM, t), 0.9 * clamp(gg * 1.6));
    ents.push({ y, fn: () => withLayer(g, cam, 1, () => K.fig(g, { x, y, s: sc, facing: dirn, pose, pal: NPC_PAL[n.col] })) });
  }
  // two walkers bump into each other behind him, papers everywhere
  {
    const ax = smPairA(u), bx = smPairB(u), hit = clamp((u - SM_MEET) / 0.25), wk = 1 - smooth((u - SM_MEET) / 0.15);
    let pa = walkPose(ax, 1, { walk: wk, lean: 0.08 }), pb = walkPose(bx, -1, { walk: wk, lean: 0.08 });
    if (hit > 0) { pa = poseMix(pa, K.pose(SM_HIT, t), hit); pb = poseMix(pb, K.pose(SM_BUMP, t), hit); }
    const jolt = (u > SM_MEET ? -14 * Math.exp(-(u - SM_MEET) * 5) : 0);
    ents.push({ y: 800, fn: () => withLayer(g, cam, 1, () => K.fig(g, { x: ax + jolt, y: 800, s: 0.92, facing: 1, pose: pa, pal: NPC_PAL[3] })) });
    ents.push({ y: 807, fn: () => withLayer(g, cam, 1, () => K.fig(g, { x: bx - jolt, y: 807, s: 0.92, facing: -1, pose: pb, pal: NPC_PAL[0] })) });
  }
  // the hero: unhurried
  {
    const pose = walkPose(hx, 1, { walk: 1, eyeGlow: 0.9, lean: 0.05 });
    ents.push({ y: 820, fn: () => withLayer(g, cam, 1, () => {
      g.save(); g.globalCompositeOperation = 'lighter'; K.radial(g, hx, 700, 190, [[0, 'rgba(255,214,130,0.22)'], [1, 'rgba(255,214,130,0)']]); g.restore();
      K.fig(g, { x: hx, y: 820, s: 1.0, facing: 1, pose, pal: HERO });
    }) });
  }
  dep(ents);
  withLayer(g, cam, 1, () => {
    const a = u - SM_MEET;
    if (a > 0) {
      const r = rng(88);
      for (let i = 0; i < 16; i++) {
        const vx = (r() - 0.5) * 300, h = 120 + r() * 120, fl = 0.5 + r() * 0.5, rest = 828 + r() * 18, ph = r() * 6;
        const x = SM_XM + vx * easeOut(clamp(a / 1.2)) + 14 * Math.sin(a * 5 + ph) * (1 - clamp((a - 1.6) / 0.6));
        const y = Math.min(rest, 770 - h * Math.sin(clamp(a / 0.5) * Math.PI / 2) + Math.max(0, a - 0.5) * (90 / fl));
        const air = y < rest - 0.5, rot = air ? a * 4 + ph : ph * 0.3, wd = air ? 28 * Math.abs(Math.cos(rot)) + 5 : 28;
        g.save(); g.translate(x, y); g.fillStyle = '#f4f0e6'; g.strokeStyle = 'rgba(40,30,50,0.55)'; g.lineWidth = 1.6;
        g.beginPath(); g.ellipse(0, 0, wd * 0.5, air ? 9 : 5, air ? rot * 0.3 : 0, 0, TAU); g.fill(); g.stroke(); g.restore();
      }
      K.burst(g, SM_XM, 770, 60, a / 0.3, 12);
      K.puffs(g, SM_XM, 830, (a - 0.05) / 0.6, 4, 18, 13, 'rgba(255,230,200,', 60);
    }
    // faint golden sparkle trail
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 28; k++) {
      const age = (((u * 0.7 + k / 28) % 1) + 1) % 1 * 2.4, ts = u - age;
      const px = smHx(ts) - 24 - 26 * age + 12 * Math.sin(k * 2.3), py = 735 + 80 * ((k * 0.618) % 1) - 36 * age + 7 * Math.sin(age * 5 + k);
      const al = (1 - age / 2.4) * (0.45 + 0.4 * Math.sin(k * 3 + u * 7)) * smooth(u / 0.8);
      if (al < 0.03) continue;
      g.fillStyle = 'rgba(255,214,120,' + al * 0.9 + ')'; g.beginPath(); g.arc(px, py, 2.4 + 1.6 * ((k * 7) % 3) / 3, 0, TAU); g.fill();
      if (k % 7 === 0) K.radial(g, px, py, 14, [[0, 'rgba(255,214,120,' + al * 0.5 + ')'], [1, 'rgba(255,214,120,0)']]);
    }
    g.restore();
  });
  g.restore();
  // dark foreground silhouettes drifting past the lens
  const sp = K.pal('#0c0818', { leg: '#080512' });
  for (const f of SM_FG) {
    const sx = f.x0 + f.v * u, al = clamp(0.95 * smooth(u / 0.8) * (1 - smooth((u - 5.9) / 0.6)));
    g.save(); g.globalAlpha = al;
    K.fig(g, { x: sx, y: 1180, s: f.s, facing: f.dir, pose: walkPose(sx * 0.4 + f.ph * 100, f.dir, { walk: 0.8, lean: 0.04 }), pal: sp, shadow: false });
    g.restore();
  }
  const vg = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.7);
  vg.addColorStop(0, 'rgba(24,8,20,0)'); vg.addColorStop(1, 'rgba(24,8,20,0.45)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  flashIn(g, t, SM.start, 0.85);
  whipOut(g, t, SM.end, 1, 52);
}

// ---------------------------------------------------------------------------------------------------
// SHOT F  clock + arrow (38.5 .. 44.236)
// ---------------------------------------------------------------------------------------------------
const CK = T.ck, CK_STEP = TAU / 30, CK_A0 = -Math.PI / 2 + 0.35;
const CK_S = 40.35, CK_V = 280, CK_SP = 140, CK_HX = 640, CK_GY = 836;
const ckBg = () => K.cv('c_ckbg', 960, 540, (c) => {
  const gr = c.createLinearGradient(0, 0, 0, 540); gr.addColorStop(0, '#0a1630'); gr.addColorStop(0.55, '#0a2638'); gr.addColorStop(1, '#06121f');
  c.fillStyle = gr; c.fillRect(0, 0, 960, 540);
  const r = rng(404);
  for (let i = 0; i < 90; i++) { c.fillStyle = 'rgba(150,230,255,' + (0.1 + r() * 0.35) + ')'; const s = r() < 0.2 ? 2.4 : 1.3; c.fillRect(r() * 960, r() * 540, s, s); }
  const rg = c.createRadialGradient(480, 270, 40, 480, 270, 520); rg.addColorStop(0, 'rgba(60,200,230,0.18)'); rg.addColorStop(1, 'rgba(60,200,230,0)');
  c.fillStyle = rg; c.fillRect(0, 0, 960, 540);
}, 1);
const clockFace = () => K.cv('c_clockFace', 720, 720, (c) => {
  c.translate(360, 360);
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.arc(6, 12, 326, 0, TAU); c.fill();
  c.fillStyle = '#0c2236'; c.beginPath(); c.arc(0, 0, 326, 0, TAU); c.fill();
  const gr = c.createRadialGradient(0, -80, 30, 0, 0, 310); gr.addColorStop(0, '#194a62'); gr.addColorStop(1, '#0a1c2e');
  c.fillStyle = gr; c.beginPath(); c.arc(0, 0, 304, 0, TAU); c.fill();
  c.strokeStyle = '#3fd0e6'; c.lineWidth = 9; c.beginPath(); c.arc(0, 0, 316, 0, TAU); c.stroke();
  c.lineCap = 'round';
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * TAU, big = i % 5 === 0, r0 = 282, r1 = big ? 244 : 264;
    c.strokeStyle = big ? 'rgba(210,245,252,0.95)' : 'rgba(170,225,240,0.55)'; c.lineWidth = big ? 9 : 4;
    c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.stroke();
  }
}, 2);
function ckHand(g, ang, len, tail, w, col) {
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-Math.cos(ang) * tail, -Math.sin(ang) * tail); g.lineTo(Math.cos(ang) * len, Math.sin(ang) * len); g.stroke();
}
function ckSecond(t) {                    // real hand: ticks every 0.5 s with a little overshoot
  const tt = Math.max(0, t - CK.start), n = Math.floor(tt / CK.tick), f = tt - n * CK.tick;
  return { ang: CK_A0 + CK_STEP * (n - 1 + 1 - Math.exp(-9 * f) * Math.cos(30 * f) + (n === 0 ? 0 : 0)), n, f };
}
function chevron(g, x, y, a, sc) {
  g.save(); g.translate(x, y); g.scale(sc, sc * 0.5); g.globalCompositeOperation = 'lighter';
  K.radial(g, 0, 0, 90, [[0, 'rgba(127,233,255,' + 0.5 * a + ')'], [1, 'rgba(127,233,255,0)']]);
  g.lineJoin = 'round'; g.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    g.strokeStyle = 'rgba(200,250,255,' + a * (i ? 0.45 : 0.95) + ')'; g.lineWidth = 14;
    g.beginPath(); g.moveTo(-34 - i * 34, -40); g.lineTo(6 - i * 34, 0); g.lineTo(-34 - i * 34, 40); g.stroke();
  }
  g.restore();
}

function clockShot(g, lt) {
  const t = lt, tt = t - CK.start;
  g.drawImage(ckBg(), 0, 0, W, H);
  const pb = smooth((t - CK.pull) / 0.8);
  const cs = lerp(1.25 + 0.06 * tt, 0.5, pb), ccx = lerp(960, 1380, pb), ccy = lerp(540, 300, pb), cal = lerp(1, 0.62, pb);
  const sec = ckSecond(t);
  const ghostAng = CK_A0 + CK_STEP * (sec.n + 1);                        // ghost hand sits on the NEXT tick position
  g.save(); g.translate(ccx, ccy); g.scale(cs, cs); g.globalAlpha = cal;
  g.drawImage(clockFace(), -360, -360, 720, 720);
  ckHand(g, -2.0 + 0.0004 * tt, 150, 20, 13, '#cfeaf2');              // hour
  ckHand(g, 0.35, 232, 24, 9, '#cfeaf2');                             // minute
  g.save(); g.globalCompositeOperation = 'lighter';
  const L = 262, gx = Math.cos(ghostAng) * L, gy = Math.sin(ghostAng) * L;
  K.radial(g, gx, gy, 70, [[0, 'rgba(127,233,255,0.45)'], [1, 'rgba(127,233,255,0)']]);
  ckHand(g, ghostAng, L, 40, 7, 'rgba(127,233,255,0.85)');
  const pu = (t - 39.85) / 0.9;                                          // "early" pulse
  if (pu > 0 && pu < 1) { g.strokeStyle = 'rgba(160,245,255,' + (0.9 * (1 - pu)) + ')'; g.lineWidth = 6 * (1 - pu) + 1; g.beginPath(); g.arc(gx, gy, 30 + 150 * easeOut(pu), 0, TAU); g.stroke(); }
  const tp = sec.f / 0.35;                                               // tiny pop each tick
  if (sec.n > 0 && tp < 1) { g.strokeStyle = 'rgba(160,245,255,' + (0.6 * (1 - tp)) + ')'; g.lineWidth = 3; g.beginPath(); g.arc(Math.cos(sec.ang) * L, Math.sin(sec.ang) * L, 14 + 40 * tp, 0, TAU); g.stroke(); }
  g.restore();
  ckHand(g, sec.ang, 258, 50, 6, '#ffd6a0');                             // real second hand
  g.fillStyle = '#ffd6a0'; g.beginPath(); g.arc(0, 0, 15, 0, TAU); g.fill(); g.fillStyle = '#0c2236'; g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill();
  g.restore();
  // ---- the walk
  const wa = smooth((t - (CK.pull + 0.05)) / 0.5);
  if (wa > 0.01) {
    const u = Math.max(0, t - CK_S), D = CK_V * rampInt2(u, 0.3);
    g.save(); g.globalAlpha = wa;
    g.globalCompositeOperation = 'lighter';
    const lg = g.createLinearGradient(0, 0, W, 0); lg.addColorStop(0, 'rgba(127,233,255,0)'); lg.addColorStop(0.15, 'rgba(127,233,255,0.55)'); lg.addColorStop(0.85, 'rgba(127,233,255,0.55)'); lg.addColorStop(1, 'rgba(127,233,255,0)');
    g.fillStyle = lg; g.fillRect(0, CK_GY - 1.5, W, 3);
    g.fillStyle = 'rgba(150,235,255,0.5)';
    for (let x = -(D % 70); x < W + 70; x += 70) g.fillRect(x, CK_GY + 8, 2.5, 12);
    g.globalCompositeOperation = 'source-over';
    const k0 = Math.floor(D / CK_SP) - 1;
    for (let k = Math.max(0, k0); k <= k0 + 4; k++) {
      const rel = CK_SP * (k + 1) - D, age = (200 - rel) / CK_V;
      if (rel > 200 || rel < -70) continue;
      const a = smooth((200 - rel) / 60) * (1 - smooth(-rel / 55));
      const ax = CK_HX + rel;
      chevron(g, ax, CK_GY + 4, a, 1 + 0.12 * Math.sin(t * 9 + k) + 0.3 * (1 - smooth(age / 0.3)));
      if (age >= 0 && age < 0.4) {
        g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(160,245,255,' + (0.8 * (1 - age / 0.4)) + ')'; g.lineWidth = 4;
        g.beginPath(); g.ellipse(ax, CK_GY + 4, 20 + 90 * easeOut(age / 0.4), 8 + 28 * easeOut(age / 0.4), 0, 0, TAU); g.stroke(); g.restore();
      }
      if (rel < 0) { g.save(); g.globalCompositeOperation = 'lighter'; K.radial(g, CK_HX, CK_GY, 80, [[0, 'rgba(200,250,255,' + 0.35 * (1 + rel / 70) + ')'], [1, 'rgba(127,233,255,0)']]); g.restore(); }
    }
    const pose = walkPose(D, 1, { walk: smooth(u / 0.25), eyeGlow: 1, lean: 0.08 });
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(CK_HX, CK_GY + 4, 64, 11, 0, 0, TAU); g.fill();
    K.fig(g, { x: CK_HX, y: CK_GY, s: 1.15, facing: 1, pose, pal: HERO, shadow: false });
    g.restore();
  }
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.7);
  vg.addColorStop(0, 'rgba(2,8,18,0)'); vg.addColorStop(1, 'rgba(2,8,18,0.5)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  flashIn(g, t, CK.start, 0.85);
}

// @PARTS-END

window.CH.ch3b = {
  draw(g, lt, dur) {
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (!ready()) { g.fillStyle = '#120a28'; g.fillRect(0, 0, W, H); g.restore(); return; }
    shots(g, lt);
    g.restore();
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  }
};
})();
