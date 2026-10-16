// rigs.js — FutureSight characters & props. Plain globals, Canvas 2D, pure functions of their inputs.
// Exposes: PAL_REAL, palGhost, walkerPose, drawWalker, walkerJoints, drawBike, drawCar, drawTimerRing
// Needs lib.js (clamp, lerp, smooth, TAU, hash1).
(function (G) {
'use strict';

// ------------------------------------------------------------------ palettes
const PAL_REAL = {
  ghost: false, alpha: 1,
  head: '#14101c', hood: '#d63a3a', hoodBack: '#a82d2d', hoodDark: '#8a2226', hoodLight: '#ec5a50', string: '#eadccf',
  leg: '#14101c', legFar: '#0a0710', hand: '#14101c', handFar: '#0a0710', shoe: '#14101c', shoeFar: '#0a0710',
  phone: '#0d0b14', screen: '#dcefff', spill: '170,214,255',
  eye: '#f6f7ff', eyeGlow: '#7fe9ff',
  helmet: '#ffd23f', helmetDark: '#d39d12', frame: '#ffd23f', frameDark: '#c99a14',
  jacket: '#2fb59a', jacketFar: '#1e8a76', jacketLight: '#c4f7e8',
  box: '#ff7a1a', boxDark: '#c85a0c', boxLight: '#ffc08a',
  tire: '#14101c', metal: '#d3cbe0', metalDark: '#8b829e', rack: '#2a2336',
  car: '#cdc6d8', carDark: '#7f7699', carLow: '#4a4264', glass: '#2a2346', glassHi: 'rgba(255,190,150,0.55)',
  arch: '#0b0810', headlamp: '#fff2c4', tail: '#ff3b4a',
  rim: '#ffb36b', edge: 'rgba(12,6,20,0.5)', edgeW: 1.3, shade: 0.34, shadeCol: '30,8,48'
};
function palGhost(alpha) {
  const c1 = '#5fd9ff', c2 = '#36adff', c3 = '#1f78ff', c4 = '#1550e0';
  return {
    ghost: true, alpha: alpha == null ? 0.6 : alpha,
    head: c4, hood: c1, hoodBack: c2, hoodDark: c3, hoodLight: '#d5fbff', string: '#e9feff',
    leg: c3, legFar: c4, hand: c2, handFar: c3, shoe: c2, shoeFar: c3,
    phone: c4, screen: '#ffffff', spill: '150,230,255',
    eye: '#ffffff', eyeGlow: '#ffffff',
    helmet: c1, helmetDark: c3, frame: c1, frameDark: c3,
    jacket: c1, jacketFar: c2, jacketLight: '#e3feff',
    box: c2, boxDark: c3, boxLight: c1,
    tire: c3, metal: '#d5fbff', metalDark: c2, rack: c3,
    car: c1, carDark: c2, carLow: c3, glass: c4, glassHi: 'rgba(220,252,255,0.45)',
    arch: c4, headlamp: '#ffffff', tail: '#c8f6ff',
    rim: null, edge: 'rgba(196,246,255,0.95)', edgeW: 1.5, shade: 0.55, shadeCol: '2,20,110'
  };
}

// ------------------------------------------------------------------ small helpers
const up = (a) => ({ x: Math.sin(a), y: -Math.cos(a) });          // "up" unit vector rotated forward by a
const nr = (a) => ({ x: Math.cos(a), y: Math.sin(a) });           // forward normal of up(a)
const add = (p, q, k) => { k = k == null ? 1 : k; return { x: p.x + q.x * k, y: p.y + q.y * k }; };
const rot = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }; };
const mix2 = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const easeOutBack = (t) => { t = clamp(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

// 2-bone IK. side=+1 bends to the right of the p0->p1 direction (knee forward for a down-pointing leg).
function ik2(p0, p1, l1, l2, side) {
  let dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy);
  let ux, uy;
  if (d < 1e-6) { ux = 0; uy = 1; d = 1e-6; } else { ux = dx / d; uy = dy / d; }
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return {
    mid: { x: p0.x + ux * a + side * uy * h, y: p0.y + uy * a - side * ux * h },
    end: { x: p0.x + ux * dd, y: p0.y + uy * dd }
  };
}
// tapered capsule path between two circles
function capsule(p0, p1, r0, r1) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy) || 1e-6;
  const a = Math.atan2(dy, dx), b = Math.acos(clamp((r0 - r1) / d, -1, 1));
  const p = new Path2D();
  p.arc(p0.x, p0.y, r0, a + b, a - b + Math.PI * 2);
  p.arc(p1.x, p1.y, r1, a - b, a + b);
  p.closePath();
  return p;
}
function limb(pts, rs) {
  const p = new Path2D();
  for (let i = 0; i < pts.length - 1; i++) p.addPath(capsule(pts[i], pts[i + 1], rs[i], rs[i + 1]));
  return p;
}
function roundPoly(pts, rs) {
  const p = new Path2D(), n = pts.length;
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const m0 = mid(pts[n - 1], pts[0]);
  p.moveTo(m0.x, m0.y);
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], m = mid(a, b);
    p.arcTo(a.x, a.y, m.x, m.y, rs[i]);
  }
  p.closePath();
  return p;
}
function circle(c, r) { const p = new Path2D(); p.arc(c.x, c.y, r, 0, Math.PI * 2); p.closePath(); return p; }
function ellipse(c, rx, ry, rotation) { const p = new Path2D(); p.ellipse(c.x, c.y, rx, ry, rotation || 0, 0, Math.PI * 2); p.closePath(); return p; }

// ------------------------------------------------------------------ render environment (reset every draw call)
const E = { g: null, pal: null, ghost: false, rx: -3, ry: 1, lw: 1.3, shade: null };
function setEnv(g, pal, s, facing, box) {
  E.g = g; E.pal = pal; E.ghost = !!pal.ghost;
  E.rx = -3.3 * facing / s; E.ry = 1.3 / s;
  E.lw = pal.edgeW / s;
  const cx = (box.x0 + box.x1) / 2, w = box.x1 - box.x0;
  const gr = g.createLinearGradient(cx + facing * w * 0.55, box.y0, cx - facing * w * 0.55, box.y1);
  gr.addColorStop(0, 'rgba(' + pal.shadeCol + ',0)');
  gr.addColorStop(0.42, 'rgba(' + pal.shadeCol + ',0)');
  gr.addColorStop(1, 'rgba(' + pal.shadeCol + ',' + pal.shade + ')');
  E.shade = gr;
}
// fill + inner shading + orange rim (solid) | bright hologram edge (ghost)
function part(path, fill, o) {
  const g = E.g, pal = E.pal; o = o || {};
  g.lineJoin = 'round';
  if (E.ghost) {
    g.fillStyle = fill; g.fill(path);
  } else {
    if (o.edge !== false) { g.lineWidth = E.lw * 2 * (o.edgeK || 1); g.strokeStyle = pal.edge; g.stroke(path); }   // outer half = dark halo
    if (o.rim !== false) {
      // rim = path minus path shifted toward the shadow side: paint the whole path orange, then the body colour shifted & clipped
      g.fillStyle = pal.rim; g.fill(path);
      g.save(); g.clip(path); g.translate(E.rx, E.ry); g.fillStyle = fill; g.fill(path); g.restore();
    } else { g.fillStyle = fill; g.fill(path); }
  }
  if (o.shade !== false) { g.save(); g.clip(path); g.fillStyle = E.shade; g.fillRect(-900, -900, 1800, 1800); g.restore(); }
  if (E.ghost && o.edge !== false) { g.lineWidth = E.lw * (o.edgeK || 1); g.strokeStyle = pal.edge; g.stroke(path); }
}

// ------------------------------------------------------------------ shadow + scratch compositing
function shadow(g, x, y, rx, alpha) {
  g.save();
  g.translate(x - rx * 0.28, y + 2);
  g.scale(1, 0.13);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, 'rgba(8,3,18,' + (0.5 * alpha) + ')');
  gr.addColorStop(0.6, 'rgba(8,3,18,' + (0.22 * alpha) + ')');
  gr.addColorStop(1, 'rgba(8,3,18,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
  g.restore();
}
const SC = { cv: null, w: 0, h: 0 };
function scratch(w, h) {
  if (!SC.cv) {
    SC.cv = (typeof document !== 'undefined') ? document.createElement('canvas') : new OffscreenCanvas(16, 16);
    SC.w = 16; SC.h = 16;
  }
  if (SC.w < w || SC.h < h) { SC.w = Math.max(SC.w, w); SC.h = Math.max(SC.h, h); SC.cv.width = SC.w; SC.cv.height = SC.h; }
  return SC.cv.getContext('2d');
}

function render(g, st, LB, shadeBox, shadowRx, body) {
  const pal = st.pal || PAL_REAL, s = st.s == null ? 1 : st.s, facing = (st.facing != null && st.facing < 0) ? -1 : 1;
  const alpha = st.alpha == null ? 1 : st.alpha, x = st.x || 0, y = st.y || 0, ghost = !!pal.ghost;
  if (!ghost && st.shadow !== false) shadow(g, x, y, shadowRx * s, alpha);
  if (!ghost && alpha >= 0.999) {
    g.save(); g.translate(x, y); g.scale(facing * s, s);
    setEnv(g, pal, s, facing, shadeBox); body();
    g.restore(); E.g = null; return;
  }
  const T = g.getTransform ? g.getTransform() : { a: 1, b: 0 };
  const k = clamp(Math.hypot(T.a, T.b), 0.3, 3);
  const wx0 = (facing > 0 ? LB.x0 : -LB.x1) * s, wx1 = (facing > 0 ? LB.x1 : -LB.x0) * s;
  const wy0 = LB.y0 * s, wy1 = LB.y1 * s;
  const rw = Math.min(2600, Math.ceil((wx1 - wx0) * k)), rh = Math.min(2600, Math.ceil((wy1 - wy0) * k));
  const c = scratch(rw, rh);
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.filter = 'none';
  c.clearRect(0, 0, rw, rh);
  c.save(); c.scale(k, k); c.translate(-wx0, -wy0); c.scale(facing * s, s);
  setEnv(c, pal, s, facing, shadeBox); body();
  c.restore(); E.g = null;
  if (ghost) {                      // a few horizontal scanline gaps, anchored to world y
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'destination-out';
    const ytop = y + wy0, pitch = 11;
    for (let yb = Math.ceil(ytop / pitch) * pitch; yb < ytop + rh / k; yb += pitch) {
      const idx = yb / pitch, hh = hash1(idx);
      if (hh > 0.7) continue;
      c.fillStyle = 'rgba(0,0,0,' + (0.45 + 0.3 * hh) + ')';
      c.fillRect(0, (yb - ytop) * k, rw, (1.4 + 1.8 * hh) * k);
    }
    c.globalCompositeOperation = 'source-over';
  }
  const dx = x + wx0, dy = y + wy0, dw = rw / k, dh = rh / k;
  const a = alpha * (ghost && pal.alpha != null ? pal.alpha : 1);
  g.save();
  if (ghost) {
    g.globalCompositeOperation = 'lighter';
    if ('filter' in g) {
      g.filter = 'blur(' + (9 * k).toFixed(1) + 'px)'; g.globalAlpha = Math.min(1, a * 0.7);
      g.drawImage(SC.cv, 0, 0, rw, rh, dx, dy, dw, dh);
      g.filter = 'none';
    }
  }
  g.globalAlpha = a;
  g.drawImage(SC.cv, 0, 0, rw, rh, dx, dy, dw, dh);
  g.restore();
}

// ================================================================== WALKER
const AH = 7.5;             // ankle height
const THIGH = 56, SHIN = 56, UARM = 39, FARM = 39;

function gait(u, S, L, w) {
  let x, y, p;
  if (u < 0.6) {
    const q = u / 0.6; x = S * (1 - 2 * q); y = 0;
    p = u < 0.12 ? lerp(0.35, 0, smooth(u / 0.12)) : (u > 0.4 ? lerp(0, -0.6, smooth((u - 0.4) / 0.2)) : 0);
  } else {
    const q = (u - 0.6) / 0.4, e = 0.5 * q + 0.5 * smooth(q);
    x = lerp(-S, S, e); y = -L * Math.sin(Math.PI * Math.pow(q, 0.85));
    p = lerp(-0.6, 0.35, smooth(q));
  }
  return { x, y, p: p * w };
}

// phase is in gait CYCLES (1 = both legs have stepped). Returns an opaque local-space pose (facing +x, feet at y=0).
function walkerPose(o) {
  o = o || {};
  const ph0 = o.phase || 0, cyc = ph0 - Math.floor(ph0), w = clamp(o.walk == null ? 0 : o.walk);
  const phone = clamp(o.phone == null ? 0 : +o.phone), hd = clamp(o.headDown == null ? 0 : o.headDown);
  const lean = o.lean == null ? 0.1 : o.lean, bob = o.bob == null ? 1 : o.bob;
  const step = clamp(o.step || 0), pulse = Math.sin(Math.PI * step), sb = smooth(clamp(pulse * 2.2));
  const ff = o.time != null ? o.time : ph0;
  const S = 36 * w, L = 24 * w;

  const hip = { x: -5 * pulse, y: -112 + 4.2 * bob * w * Math.cos(4 * Math.PI * cyc) + 9 * pulse };

  // ---- legs
  function leg(u, stOff, isBack) {
    const gt = gait(u, S, L, w);
    let ax = stOff + gt.x, ay = -AH + gt.y, p = gt.p;
    ay -= Math.max(0, -p) * 9 + Math.max(0, p) * 4;
    if (sb > 0) {
      const tx = isBack ? -26 - 14 * pulse : 18 + 4 * pulse;
      const ty = -AH - (isBack ? 18 * Math.sin(Math.PI * clamp(step * 2.2)) : 0);
      const tp = isBack ? -0.12 : 0.28 * pulse;
      ax = lerp(ax, tx, sb); ay = lerp(ay, ty, sb); p = lerp(p, tp, sb);
    }
    const r = ik2(hip, { x: ax, y: ay }, THIGH, SHIN, 1);
    return { hip: hip, knee: r.mid, ankle: r.end, pitch: p };
  }
  const legF = leg(cyc, 6, false), legB = leg((cyc + 0.5) % 1, -6, true);

  // ---- spine / head
  const hunch = hd * 0.55 * (1 - 0.8 * pulse);
  const a1 = lean + 0.016 * w * Math.cos(4 * Math.PI * cyc) - 0.30 * pulse;
  const a2 = a1 + hunch;
  const waist = add(hip, up(a1), 32);
  const shTop = add(waist, up(a2), 36);
  const hdEff = hd * (1 - pulse) - 0.2 * pulse;
  const ah = a2 + hdEff * 0.9;
  const headC = add(shTop, up(ah), 36);
  headC.y += 1.4 * bob * w * Math.cos(4 * Math.PI * cyc - 0.8);
  const headRot = ah * 0.75;

  // ---- arms
  const J = add(add(shTop, up(a2), -8), nr(a2), -1);
  const Af = 0.55 * w;
  const swF = -Af * Math.cos(Math.PI * 2 * cyc), swB = -swF * (1 - 0.55 * phone);
  function swing(sw) {
    const ang = 0.07 + sw + lean * 0.35;
    const fwd = Af > 0 ? Math.max(0, sw / Af) : 0, bk = Af > 0 ? Math.max(0, -sw / Af) : 0;
    const reach = 71 - 21 * fwd + 4 * bk;
    return { x: J.x + Math.sin(ang) * reach, y: J.y + Math.cos(ang) * reach };
  }
  let tF = swing(swF), tB = swing(swB);
  const tPhone = add(add(J, nr(a2), 35), up(a2), -25);
  tF = mix2(tF, tPhone, smooth(phone));
  const tStepF = { x: J.x + 56, y: J.y - 8 }, tStepB = { x: J.x - 34, y: J.y - 36 };
  const sa = smooth(clamp(pulse * 1.8));
  tF = mix2(tF, tStepF, sa); tB = mix2(tB, tStepB, sa);
  const aF = ik2(J, tF, UARM, FARM, -1), aB = ik2(J, tB, UARM, FARM, -1);

  return {
    cyc, w, ff, pulse, hunch, a1, a2, hip, waist, shTop, J,
    head: { x: headC.x, y: headC.y, r: 29, rot: headRot },
    legF, legB,
    armF: { sh: J, elbow: aF.mid, hand: aF.end }, armB: { sh: J, elbow: aB.mid, hand: aB.end },
    phone: { amt: phone, ang: -0.32 + 0.4 * (a2 - 0.2) },
    eyeOpen: clamp(o.eyeOpen || 0), eyeGlow: clamp(o.eyeGlow || 0), flutter: clamp(o.flutter || 0)
  };
}

const WALK_BOX = { x0: -60, x1: 90, y0: -250, y1: 20 };
const WALK_LB = { x0: -150, x1: 160, y0: -300, y1: 50 };

function drawWalkerBody(P) {
  const g = E.g, pal = E.pal;
  const hood = P.head;

  // --- helper: sleeve + hand
  function arm(A, col, handCol) {
    const f = { x: A.hand.x - A.elbow.x, y: A.hand.y - A.elbow.y }, fl = Math.hypot(f.x, f.y) || 1;
    const wr = { x: A.hand.x - f.x / fl * 5, y: A.hand.y - f.y / fl * 5 };
    const sleeve = limb([A.sh, A.elbow, wr], [10.8, 9.2, 8]);
    part(sleeve, col);
    g.save(); g.clip(sleeve);                       // cuff band
    const cp = mix2(A.elbow, A.hand, 0.74), nx = -f.y / fl, ny = f.x / fl;
    g.strokeStyle = pal.hoodDark; g.globalAlpha = E.ghost ? 0.7 : 0.9; g.lineWidth = 3.4;
    g.beginPath(); g.moveTo(cp.x - nx * 12, cp.y - ny * 12); g.lineTo(cp.x + nx * 12, cp.y + ny * 12); g.stroke();
    g.restore();
    part(circle({ x: A.hand.x + f.x / fl * 2, y: A.hand.y + f.y / fl * 2 }, 8.4), handCol);
  }
  // --- helper: leg + shoe
  function leg(L, col, shoeCol) {
    part(limb([L.hip, L.knee, L.ankle], [12.5, 10.5, 8]), col);
    const d = { x: Math.cos(L.pitch), y: -Math.sin(L.pitch) };
    part(limb([add(L.ankle, d, -6.5), add(L.ankle, d, 19)], [7.8, 6.2]), shoeCol);
  }

  arm(P.armB, pal.hoodBack, pal.handFar);
  leg(P.legB, pal.legFar, pal.shoeFar);
  leg(P.legF, pal.leg, pal.shoe);

  // --- hoodie torso
  const u1 = up(P.a1), n1 = nr(P.a1), u2 = up(P.a2), n2 = nr(P.a2), Sh = P.shTop, hu = P.hunch;
  const fl = P.flutter, fw = Math.sin(Math.PI * 2 * P.ff * 1.7);
  const hemC = add(P.hip, u1, -13);
  const hemBack = add(add(hemC, n1, -21), { x: -fl * 6 * (0.6 + 0.4 * fw), y: fl * 2 * fw }, 1);
  const pts = [
    hemBack,
    add(hemC, n1, 22),
    add(P.waist, n1, 20.5),
    add(add(Sh, u2, -14), n2, 23.5),
    add(add(Sh, u2, -2), n2, 19),
    add(add(Sh, u2, 9), n2, 2),
    add(add(Sh, u2, -2), n2, -21 - 5 * hu * 6),
    add(add(Sh, u2, -16), n2, -(22 + 7 * hu * 4)),
    add(P.waist, n1, -19.5)
  ];
  const torso = roundPoly(pts, [8, 9, 14, 8, 8, 8, 9, 12, 14]);
  part(torso, pal.hood);
  g.save(); g.clip(torso);
  // hem band
  g.strokeStyle = pal.hoodDark; g.lineWidth = 3; g.globalAlpha = E.ghost ? 0.6 : 0.85;
  const hb0 = add(add(hemC, u1, 7), n1, -24), hb1 = add(add(hemC, u1, 7), n1, 25);
  g.beginPath(); g.moveTo(hb0.x, hb0.y); g.lineTo(hb1.x, hb1.y); g.stroke();
  // kangaroo pocket
  g.lineWidth = 2.2; g.globalAlpha = E.ghost ? 0.5 : 0.7;
  const pk0 = add(add(P.waist, u1, -2), n1, 21), pk1 = add(add(hemC, u1, 20), n1, 2), pk2 = add(add(hemC, u1, 8), n1, 14);
  g.beginPath(); g.moveTo(pk0.x, pk0.y); g.quadraticCurveTo(pk1.x, pk1.y, add(P.waist, n1, -20).x, add(P.waist, u1, -9).y + 2); g.stroke();
  // soft fold under the hood
  g.globalAlpha = E.ghost ? 0.25 : 0.38; g.fillStyle = pal.hoodDark;
  g.beginPath(); g.ellipse(hood.x - 3, hood.y + 34, 27, 16, 0, 0, Math.PI * 2); g.fill();
  g.restore();
  // drawstrings
  if (!E.ghost || true) {
    g.strokeStyle = pal.string; g.lineWidth = 2.1; g.lineCap = 'round'; g.globalAlpha = E.ghost ? 0.9 : 0.95;
    const sb0 = add(add(Sh, u2, -15), n2, 14), sw = 0.5 * Math.sin(Math.PI * 2 * P.ff * 1.3) * fl;
    for (let i = 0; i < 2; i++) {
      const b = add(sb0, n2, i * 5), e = add(add(b, u2, -17 - i * 5), n2, 1.5 + sw * (1 + i));
      g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(e.x, e.y); g.stroke();
    }
    g.globalAlpha = 1; g.lineCap = 'butt';
  }

  // --- hood (behind head): back crescent + cowl, plus fluttering tail
  const hr = hood.rot, hc = { x: hood.x, y: hood.y };
  const hoodC = add(hc, rot({ x: -6.5, y: 4 }, hr));
  {
    const base0 = add(hoodC, rot({ x: -24, y: 4 }, hr)), base1 = add(hoodC, rot({ x: -14, y: 27 }, hr));
    const tl = 1 + 15 * fl, wv = 5 * fl * fw;
    const tip = add(hoodC, rot({ x: -26 - tl, y: 21 + wv }, hr));
    const tail = new Path2D();
    tail.moveTo(base0.x, base0.y);
    const c0 = mix2(base0, tip, 0.55); tail.quadraticCurveTo(c0.x, c0.y - 6 - 6 * fl, tip.x, tip.y);
    const c1 = mix2(base1, tip, 0.5); tail.quadraticCurveTo(c1.x, c1.y + 3, base1.x, base1.y);
    tail.closePath();
    part(tail, pal.hoodBack, { rim: false });
  }
  const hoodPath = new Path2D();
  hoodPath.addPath(circle(hoodC, 33.5));
  hoodPath.addPath(ellipse(add(hc, rot({ x: -2, y: 25 }, hr * 0.6)), 25, 14, hr * 0.6));
  part(hoodPath, pal.hood);
  g.save(); g.clip(hoodPath);                      // soft shadow cast by the head onto the hood
  g.strokeStyle = pal.hoodDark; g.lineWidth = 4; g.globalAlpha = E.ghost ? 0.4 : 0.55;
  g.beginPath(); g.arc(hc.x - 1.5, hc.y + 1, 30.5, 0, Math.PI * 2); g.stroke();
  g.restore();

  // --- head
  part(circle(hc, hood.r), pal.head);
  const headP = circle(hc, hood.r);
  if (P.phone.amt > 0.01 && !E.ghost) {            // cool phone-light on the face
    g.save(); g.clip(headP);
    const pc = phoneCenter(P);
    const gr = g.createRadialGradient(pc.x - 6, pc.y - 4, 0, pc.x - 6, pc.y - 4, 62);
    gr.addColorStop(0, 'rgba(' + pal.spill + ',' + (0.38 * P.phone.amt) + ')'); gr.addColorStop(1, 'rgba(' + pal.spill + ',0)');
    g.fillStyle = gr; g.fillRect(hc.x - 60, hc.y - 60, 120, 120);
    g.restore();
  }
  if (P.eyeOpen > 0.01) {
    g.save(); g.translate(hc.x, hc.y); g.rotate(hr);
    const gl = P.eyeGlow, op = P.eyeOpen;
    const col = gl > 0.01 ? mixHex(pal.eye, pal.eyeGlow, gl) : pal.eye;
    if (gl > 0.01) {
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(15, -3, 0, 15, -3, 40);
      gr.addColorStop(0, 'rgba(127,233,255,' + (0.55 * gl) + ')'); gr.addColorStop(1, 'rgba(127,233,255,0)');
      g.fillStyle = gr; g.fillRect(-30, -50, 90, 90);
      g.globalCompositeOperation = 'source-over';
      g.shadowColor = 'rgba(127,233,255,' + gl + ')'; g.shadowBlur = 16 * gl;
    }
    g.fillStyle = col;
    const ry = Math.max(0.9, 8.4 * op);
    g.beginPath(); g.ellipse(10.5, -3, 4.7, ry, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(23.5, -3.5, 3.2, ry * 0.92, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  // --- near arm + phone
  arm(P.armF, pal.hood, pal.hand);
  if (P.phone.amt > 0.01) drawPhone(P);
}
function phoneCenter(P) { return add(P.armF.hand, rot({ x: 3, y: -11 }, P.phone.ang)); }
function drawPhone(P) {
  const g = E.g, pal = E.pal, amt = P.phone.amt, pc = phoneCenter(P);
  g.save(); g.globalAlpha *= amt;
  if (!E.ghost) {
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(pc.x - 12, pc.y - 4, 0, pc.x - 12, pc.y - 4, 56);
    gr.addColorStop(0, 'rgba(' + pal.spill + ',0.42)'); gr.addColorStop(1, 'rgba(' + pal.spill + ',0)');
    g.fillStyle = gr; g.fillRect(pc.x - 80, pc.y - 70, 140, 140);
    g.globalCompositeOperation = 'source-over';
  }
  g.translate(pc.x, pc.y); g.rotate(P.phone.ang);
  const body = roundPoly([{ x: -5.2, y: -14 }, { x: 5.2, y: -14 }, { x: 5.2, y: 14 }, { x: -5.2, y: 14 }], [3, 3, 3, 3]);
  part(body, pal.phone, { rim: false, shade: false });
  g.fillStyle = pal.screen; g.fillRect(-5.2, -12, 2.6, 24);                 // lit screen face, toward the walker
  g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(-5.2, -12, 1.2, 24);
  g.restore();
}

// st = {x,y,s=1,facing=1,pose,pal=PAL_REAL,alpha=1,shadow=true}
function drawWalker(g, st) {
  const P = st.pose || walkerPose({});
  render(g, st, WALK_LB, WALK_BOX, 74, function () { drawWalkerBody(P); });
}
function walkerJoints(st) {
  const P = st.pose || walkerPose({}), s = st.s == null ? 1 : st.s, f = (st.facing != null && st.facing < 0) ? -1 : 1;
  const x = st.x || 0, y = st.y || 0;
  const W = (p) => ({ x: x + f * s * p.x, y: y + s * p.y });
  const sole = (L) => W({ x: L.ankle.x + 4 * Math.cos(L.pitch), y: L.ankle.y + AH });
  return {
    head: Object.assign(W(P.head), { r: P.head.r * s }),
    shoulder: W(P.J), hip: W(P.hip), handF: W(P.armF.hand),
    footF: sole(P.legF), footB: sole(P.legB),
    phone: W(phoneCenter(P))
  };
}

// ================================================================== BIKE
const BIKE_BOX = { x0: -120, x1: 110, y0: -200, y1: 0 };
const BIKE_LB = { x0: -190, x1: 190, y0: -280, y1: 50 };

function drawBike(g, st) {
  const wheel = st.wheel || 0, pedal = st.pedal || 0, speed = st.speed || 0;
  render(g, st, BIKE_LB, BIKE_BOX, 175, function () { bikeBody(wheel, pedal, speed); });
}
function bikeBody(wheel, pedal, speed) {
  const g = E.g, pal = E.pal, ghost = E.ghost;
  const RW = { x: -78, y: -60 }, FW = { x: 78, y: -60 }, BB = { x: -10, y: -46 };
  const ST = { x: -33, y: -112 }, HT0 = { x: 50, y: -121 }, HT1 = { x: 45, y: -94 }, BAR = { x: 56, y: -136 }, GRIP = { x: 67, y: -133 };
  const lam = 0.9 + 0.24 * clamp(speed / 3000);
  const hipJ = { x: -35, y: -124 };
  const Sh = add(hipJ, up(lam), 62);
  const headC = add(Sh, up(lam + 0.2), 32);
  const spokeA = 1 - 0.65 * clamp((speed - 1200) / 2200);

  // wheels
  function wheelDraw(c) {
    g.save();
    g.strokeStyle = pal.tire; g.lineWidth = 8; g.beginPath(); g.arc(c.x, c.y, 56, 0, Math.PI * 2); g.stroke();
    if (!ghost) {                                    // rim light on the sun side of the tyre
      g.strokeStyle = pal.rim; g.globalAlpha = 0.95; g.lineWidth = 2.6; g.lineCap = 'round';
      g.beginPath(); g.arc(c.x, c.y, 59, -1.35, 0.5); g.stroke();
      g.lineCap = 'butt'; g.globalAlpha = 1;
    } else { g.strokeStyle = pal.edge; g.lineWidth = 1.4; g.beginPath(); g.arc(c.x, c.y, 60, 0, Math.PI * 2); g.stroke(); }
    g.strokeStyle = pal.metal; g.lineWidth = 2.2; g.beginPath(); g.arc(c.x, c.y, 51, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = spokeA; g.lineWidth = 1.3;
    for (let i = 0; i < 16; i++) {
      const a = wheel + i * Math.PI * 2 / 16;
      g.beginPath(); g.moveTo(c.x + Math.cos(a) * 6, c.y + Math.sin(a) * 6); g.lineTo(c.x + Math.cos(a) * 50, c.y + Math.sin(a) * 50); g.stroke();
    }
    g.globalAlpha = 1;
    if (spokeA < 0.95) { g.fillStyle = 'rgba(210,200,226,' + (0.2 * (1 - spokeA)) + ')'; g.beginPath(); g.arc(c.x, c.y, 50, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = pal.metalDark; g.beginPath(); g.arc(c.x, c.y, 6.5, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  wheelDraw(RW); wheelDraw(FW);

  const P1 = add(BB, { x: Math.cos(pedal), y: Math.sin(pedal) }, 25), P2 = add(BB, { x: Math.cos(pedal + Math.PI), y: Math.sin(pedal + Math.PI) }, 25);
  function legIK(P) { return ik2(hipJ, add(P, { x: -8, y: -8 }), 50, 50, 1); }
  function shoe(a, col) { part(limb([add(a, { x: -6, y: 0 }), add(a, { x: 19, y: 1 })], [7.5, 6]), col); }

  // far leg + crank
  const lB = legIK(P2);
  g.strokeStyle = pal.metalDark; g.lineWidth = 4.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(BB.x, BB.y); g.lineTo(P2.x, P2.y); g.stroke(); g.lineCap = 'butt';
  part(limb([hipJ, lB.mid, lB.end], [12, 10, 7.5]), pal.legFar); shoe(lB.end, pal.shoeFar);

  // frame
  const frame = new Path2D();
  const tubes = [[RW, BB, 3.4], [RW, ST, 2.8], [BB, ST, 3.6], [ST, HT0, 3.6], [BB, HT1, 4.2], [HT0, HT1, 4.6], [HT1, FW, 3.2], [HT0, BAR, 3], [BAR, GRIP, 3.4]];
  tubes.forEach((t) => frame.addPath(capsule(t[0], t[1], t[2], t[2])));
  part(frame, pal.frame);
  // saddle + seatpost + rack
  part(limb([ST, { x: -36, y: -120 }], [3, 3]), pal.rack);
  part(ellipse({ x: -37, y: -121 }, 17, 4.6, -0.06), pal.rack, { edgeK: 0.8 });
  part(limb([{ x: -112, y: -130 }, { x: -52, y: -130 }], [2.6, 2.6]), pal.rack);
  part(limb([{ x: -108, y: -130 }, RW], [2, 2]), pal.rack, { rim: false });
  // chainring + near crank
  g.strokeStyle = pal.metalDark; g.lineWidth = 2.4; g.beginPath(); g.arc(BB.x, BB.y, 11, 0, Math.PI * 2); g.stroke();

  // near leg + crank
  const lF = legIK(P1);
  g.strokeStyle = pal.metal; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(BB.x, BB.y); g.lineTo(P1.x, P1.y); g.stroke(); g.lineCap = 'butt';
  part(limb([hipJ, lF.mid, lF.end], [12.5, 10.5, 7.8]), pal.leg); shoe(lF.end, pal.shoe);

  // delivery box
  const box = roundPoly([{ x: -110, y: -192 }, { x: -50, y: -192 }, { x: -50, y: -133 }, { x: -110, y: -133 }], [7, 7, 6, 6]);
  part(box, pal.box);
  g.save(); g.clip(box);
  g.fillStyle = pal.boxDark; g.globalAlpha = ghost ? 0.5 : 0.85; g.fillRect(-120, -192, 80, 11);
  g.globalAlpha = 1; g.fillStyle = pal.boxLight; g.globalAlpha = ghost ? 0.8 : 0.9;
  g.fillRect(-92, -166, 26, 6); g.fillRect(-92, -154, 17, 5);
  g.restore();

  // far arm (behind torso)
  const sJ = add(Sh, up(lam), -5);
  const aB = ik2(sJ, add(GRIP, { x: 1, y: 1 }), 36, 36, -1);
  part(limb([sJ, aB.mid, aB.end], [10.2, 8.8, 7.4]), pal.jacketFar);
  part(circle(aB.end, 7.6), pal.handFar);

  // torso (jacket)
  const torso = limb([add(hipJ, up(lam), -2), add(hipJ, up(lam), 30), Sh], [17.5, 19, 19.5]);
  part(torso, pal.jacket);
  g.save(); g.clip(torso);
  const sp = add(hipJ, up(lam), 36), nn = nr(lam);
  g.strokeStyle = pal.jacketLight; g.lineWidth = 4.5; g.globalAlpha = ghost ? 0.7 : 0.85;
  g.beginPath(); g.moveTo(sp.x - nn.x * 30, sp.y - nn.y * 30); g.lineTo(sp.x + nn.x * 30, sp.y + nn.y * 30); g.stroke();
  g.restore();
  // strap from box to shoulder
  g.strokeStyle = pal.rack; g.lineWidth = 3; g.globalAlpha = ghost ? 0.5 : 0.8;
  g.beginPath(); g.moveTo(-54, -176); g.quadraticCurveTo(-30, -178, sJ.x - 4, sJ.y - 6); g.stroke(); g.globalAlpha = 1;

  // head + helmet
  part(circle(headC, 19.5), pal.head);
  const hc = { x: headC.x - 2, y: headC.y - 3 }, hr = 23.5;
  const helm = new Path2D();
  helm.arc(hc.x, hc.y, hr, Math.PI - 0.12, Math.PI * 2 + 0.5);
  helm.quadraticCurveTo(hc.x + hr + 9, hc.y + 5, hc.x + hr + 15, hc.y + 5);   // peak
  helm.lineTo(hc.x + hr - 2, hc.y + 7.5);
  helm.quadraticCurveTo(hc.x, hc.y + 11, hc.x - hr, hc.y + 3);
  helm.closePath();
  part(helm, pal.helmet);
  g.save(); g.clip(helm);
  g.strokeStyle = pal.helmetDark; g.lineWidth = 2.6; g.globalAlpha = ghost ? 0.6 : 0.85;
  for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(hc.x - 13 + i * 9, hc.y - 26); g.lineTo(hc.x - 18 + i * 9, hc.y + 4); g.stroke(); }
  g.restore();

  // near arm
  const aF = ik2(sJ, GRIP, 36, 36, -1);
  part(limb([sJ, aF.mid, aF.end], [10.8, 9.2, 7.8]), pal.jacket);
  part(circle(add(aF.end, { x: 1, y: 0 }), 8), pal.hand);
}

// ================================================================== CAR
const CAR_BOX = { x0: -200, x1: 200, y0: -150, y1: 0 };
const CAR_LB = { x0: -250, x1: 250, y0: -220, y1: 50 };

function drawCar(g, st) {
  const wheel = st.wheel || 0;
  render(g, st, CAR_LB, CAR_BOX, 215, function () { carBody(wheel); });
}
function carBody(wheel) {
  const g = E.g, pal = E.pal, ghost = E.ghost;
  const WC = [{ x: -118, y: -34 }, { x: 122, y: -34 }];
  const body = new Path2D();
  body.moveTo(-186, -24);
  body.bezierCurveTo(-196, -40, -198, -62, -190, -78);
  body.bezierCurveTo(-184, -88, -170, -92, -150, -92);
  body.lineTo(-112, -93);
  body.bezierCurveTo(-96, -94, -84, -112, -66, -126);
  body.bezierCurveTo(-52, -140, -36, -145, -10, -145);
  body.lineTo(24, -145);
  body.bezierCurveTo(46, -145, 62, -130, 84, -104);
  body.bezierCurveTo(92, -95, 104, -92, 124, -90);
  body.lineTo(160, -84);
  body.bezierCurveTo(184, -80, 196, -66, 194, -46);
  body.bezierCurveTo(194, -36, 192, -26, 184, -22);
  body.lineTo(-180, -22);
  body.closePath();
  part(body, pal.car);

  g.save(); g.clip(body);
  // lower body panel shading + wheel arches
  const lg = g.createLinearGradient(0, -70, 0, -18);
  lg.addColorStop(0, 'rgba(' + pal.shadeCol + ',0)'); lg.addColorStop(1, 'rgba(' + pal.shadeCol + ',' + (ghost ? 0.5 : 0.5) + ')');
  g.fillStyle = lg; g.fillRect(-210, -150, 420, 140);
  g.fillStyle = pal.arch; WC.forEach((c) => { g.beginPath(); g.arc(c.x, c.y, 40, 0, Math.PI * 2); g.fill(); });
  // beltline highlight, door shuts, handles
  g.strokeStyle = pal.metal; g.globalAlpha = ghost ? 0.7 : 0.8; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-186, -80); g.lineTo(-100, -86); g.lineTo(124, -84); g.lineTo(190, -72); g.stroke();
  g.strokeStyle = pal.carDark; g.globalAlpha = 0.8; g.lineWidth = 1.8;
  [[-8, -96, -8, -24], [74, -100, 74, -24], [-102, -92, -102, -34]].forEach((l) => { g.beginPath(); g.moveTo(l[0], l[1]); g.lineTo(l[2], l[3]); g.stroke(); });
  g.lineWidth = 2.6; g.beginPath(); g.moveTo(-40, -76); g.lineTo(-22, -76); g.moveTo(36, -76); g.lineTo(54, -76); g.stroke();
  g.globalAlpha = 1;
  // bumpers
  g.fillStyle = pal.carLow; g.globalAlpha = ghost ? 0.5 : 0.85; g.fillRect(-200, -32, 40, 12); g.fillRect(160, -34, 40, 14); g.globalAlpha = 1;
  g.restore();

  // glass
  const gl1 = roundPoly([{ x: -104, y: -99 }, { x: -82, y: -121 }, { x: -52, y: -136 }, { x: -14, y: -139 }, { x: -14, y: -99 }], [4, 6, 6, 4, 3]);
  const gl2 = roundPoly([{ x: 3, y: -99 }, { x: 3, y: -139 }, { x: 28, y: -139 }, { x: 48, y: -133 }, { x: 76, y: -105 }, { x: 78, y: -99 }], [3, 4, 6, 6, 3, 3]);
  [gl1, gl2].forEach((p) => {
    g.fillStyle = pal.glass; g.fill(p);
    g.save(); g.clip(p);
    g.fillStyle = pal.glassHi; g.beginPath(); g.moveTo(20, -150); g.lineTo(46, -150); g.lineTo(-6, -92); g.lineTo(-32, -92); g.closePath(); g.fill();
    g.fillStyle = pal.glassHi; g.globalAlpha = 0.5; g.beginPath(); g.moveTo(-76, -140); g.lineTo(-66, -140); g.lineTo(-100, -92); g.lineTo(-110, -92); g.closePath(); g.fill();
    g.restore();
    g.lineWidth = E.lw * 1.2; g.strokeStyle = ghost ? pal.edge : 'rgba(10,6,16,0.6)'; g.stroke(p);
  });
  // mirror
  part(roundPoly([{ x: 72, y: -100 }, { x: 88, y: -100 }, { x: 88, y: -90 }, { x: 74, y: -88 }], [3, 3, 3, 3]), pal.car, { edgeK: 0.8 });
  // lamps
  g.save();
  g.fillStyle = pal.headlamp;
  if (!ghost) { g.shadowColor = 'rgba(255,230,160,0.9)'; g.shadowBlur = 14; }
  g.beginPath(); g.ellipse(185, -66, 8, 5.5, -0.15, 0, Math.PI * 2); g.fill();
  g.fillStyle = pal.tail; if (!ghost) { g.shadowColor = 'rgba(255,60,80,0.9)'; g.shadowBlur = 10; }
  g.beginPath(); g.ellipse(-190, -68, 4.5, 8, 0.15, 0, Math.PI * 2); g.fill();
  g.restore();

  // wheels
  WC.forEach((c, wi) => {
    g.fillStyle = pal.tire; g.beginPath(); g.arc(c.x, c.y, 34, 0, Math.PI * 2); g.fill();
    if (!ghost) {
      g.strokeStyle = pal.rim; g.globalAlpha = 0.95; g.lineWidth = 2.4; g.lineCap = 'round';
      g.beginPath(); g.arc(c.x, c.y, 33, -1.4, 0.45); g.stroke(); g.lineCap = 'butt'; g.globalAlpha = 1;
    } else { g.strokeStyle = pal.edge; g.lineWidth = 1.4; g.beginPath(); g.arc(c.x, c.y, 34, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = pal.metal; g.beginPath(); g.arc(c.x, c.y, 21, 0, Math.PI * 2); g.fill();
    g.fillStyle = pal.carLow; g.globalAlpha = ghost ? 0.7 : 0.9;
    const a0 = wheel * (wi ? 1 : 1);
    for (let i = 0; i < 5; i++) {                                     // five spokes (dark gaps)
      const a = a0 + i * Math.PI * 2 / 5 + Math.PI / 5;
      g.beginPath(); g.moveTo(c.x, c.y); g.arc(c.x, c.y, 19, a - 0.34, a + 0.34); g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
    g.strokeStyle = pal.metalDark; g.lineWidth = 1.6; g.beginPath(); g.arc(c.x, c.y, 21, 0, Math.PI * 2); g.stroke();
    g.fillStyle = pal.metalDark; g.beginPath(); g.arc(c.x, c.y, 5, 0, Math.PI * 2); g.fill();
  });
}

// ================================================================== TIMER RING
// size = outer DIAMETER in px. o = {value 10..0, progress 0..1 (elapsed fraction, arc grows clockwise from 12 o'clock), appear 0..1, time (s)}
function drawTimerRing(g, cx, cy, size, o) {
  o = o || {};
  const value = o.value == null ? 10 : o.value, prog = clamp(o.progress || 0), ap = o.appear == null ? 1 : o.appear, time = o.time || 0;
  if (ap <= 0.001) return;
  const R = size / 2, sc = 0.55 + 0.45 * easeOutBack(ap), al = smooth(clamp(ap * 1.6));
  let fl = 0.94 + 0.06 * Math.sin(time * 47) + 0.03 * Math.sin(time * 13.3);
  if (hash1(Math.floor(time * 24)) < 0.07) fl *= 0.7;
  const A = al * fl, C = '127,233,255';
  g.save();
  g.translate(cx, cy); g.scale(sc, sc);
  g.lineCap = 'round';
  // dark glass disc so the number stays legible
  const bg = g.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
  bg.addColorStop(0, 'rgba(4,16,40,' + (0.5 * al) + ')'); bg.addColorStop(0.85, 'rgba(6,28,70,' + (0.3 * al) + ')'); bg.addColorStop(1, 'rgba(10,50,110,' + (0.16 * al) + ')');
  g.fillStyle = bg; g.beginPath(); g.arc(0, 0, R * 0.99, 0, Math.PI * 2); g.fill();

  g.globalCompositeOperation = 'lighter';
  g.shadowColor = 'rgba(' + C + ',' + (0.9 * A) + ')'; g.shadowBlur = R * 0.09;
  // outer hairline ring
  g.strokeStyle = 'rgba(' + C + ',' + (0.9 * A) + ')'; g.lineWidth = Math.max(1.2, R * 0.012);
  g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke();
  // slow rotating dashed ring (outside)
  g.save(); g.rotate(time * 0.22); g.setLineDash([R * 0.012, R * 0.075]); g.lineWidth = Math.max(1, R * 0.01);
  g.strokeStyle = 'rgba(' + C + ',' + (0.45 * A) + ')'; g.beginPath(); g.arc(0, 0, R * 1.07, 0, Math.PI * 2); g.stroke(); g.restore();
  // inner thin ring
  g.lineWidth = Math.max(1, R * 0.008); g.strokeStyle = 'rgba(' + C + ',' + (0.28 * A) + ')';
  g.beginPath(); g.arc(0, 0, R * 0.64, 0, Math.PI * 2); g.stroke();
  // 60 ticks
  for (let i = 0; i < 60; i++) {
    const a = -Math.PI / 2 + i / 60 * Math.PI * 2, major = i % 5 === 0, lit = i / 60 < prog - 1e-6;
    const r0 = R * (major ? 0.83 : 0.87), r1 = R * 0.94;
    g.strokeStyle = lit ? 'rgba(210,250,255,' + (0.95 * A) + ')' : 'rgba(' + C + ',' + ((major ? 0.5 : 0.3) * A) + ')';
    g.lineWidth = Math.max(1, R * (major ? 0.016 : 0.009));
    g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke();
  }
  // progress arc
  if (prog > 0.001) {
    const rA = R * 0.74, a0 = -Math.PI / 2, a1 = a0 + prog * Math.PI * 2;
    g.shadowBlur = R * 0.12;
    g.strokeStyle = 'rgba(' + C + ',' + (0.95 * A) + ')'; g.lineWidth = Math.max(2, R * 0.03);
    g.beginPath(); g.arc(0, 0, rA, a0, a1); g.stroke();
    g.strokeStyle = 'rgba(235,253,255,' + (0.9 * A) + ')'; g.lineWidth = Math.max(1, R * 0.011);
    g.beginPath(); g.arc(0, 0, rA, a0, a1); g.stroke();
    g.fillStyle = 'rgba(255,255,255,' + A + ')'; g.shadowBlur = R * 0.2;
    g.beginPath(); g.arc(Math.cos(a1) * rA, Math.sin(a1) * rA, Math.max(2.2, R * 0.027), 0, Math.PI * 2); g.fill();
  }
  // top marker
  g.shadowBlur = R * 0.06; g.fillStyle = 'rgba(' + C + ',' + (0.95 * A) + ')';
  g.beginPath(); g.moveTo(0, -R * 0.995); g.lineTo(-R * 0.03, -R * 1.06); g.lineTo(R * 0.03, -R * 1.06); g.closePath(); g.fill();

  // number — fixed pitch so it never jitters
  const txt = value.toFixed(1), fs = R * 0.56;
  const cw = (ch) => ch === '.' ? fs * 0.3 : fs * 0.58;
  let tw = 0; for (let i = 0; i < txt.length; i++) tw += cw(txt[i]);
  g.font = fs + 'px "Bahnschrift SemiBold","Segoe UI Black",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const glitch = hash1(Math.floor(time * 30) + 7) < 0.1 ? 2.2 : 0.8;
  const drawTxt = (dx, col, blur) => {
    g.shadowBlur = blur; g.shadowColor = 'rgba(' + C + ',' + (0.9 * A) + ')'; g.fillStyle = col;
    let x = -tw / 2;
    for (let i = 0; i < txt.length; i++) { const w = cw(txt[i]); g.fillText(txt[i], x + w / 2 + dx, R * 0.03); x += w; }
  };
  drawTxt(-glitch, 'rgba(255,60,120,' + (0.28 * A) + ')', 0);
  drawTxt(glitch, 'rgba(60,160,255,' + (0.35 * A) + ')', 0);
  drawTxt(0, 'rgba(232,253,255,' + (0.98 * A) + ')', R * 0.16);
  g.shadowBlur = 0;

  // scanlines + sweep, clipped to the disc
  g.globalCompositeOperation = 'source-over';
  g.save(); g.beginPath(); g.arc(0, 0, R * 0.98, 0, Math.PI * 2); g.clip();
  const off = (time * 26) % 4;
  g.fillStyle = 'rgba(0,12,30,' + (0.2 * al) + ')';
  for (let y = -R + off; y < R; y += 4) g.fillRect(-R, y, R * 2, 1.3);
  g.globalCompositeOperation = 'lighter';
  const sy = (((time * 0.55) % 1) * 2 - 1) * R * 1.1;
  const sg = g.createLinearGradient(0, sy - R * 0.14, 0, sy + R * 0.14);
  sg.addColorStop(0, 'rgba(' + C + ',0)'); sg.addColorStop(0.5, 'rgba(' + C + ',' + (0.12 * A) + ')'); sg.addColorStop(1, 'rgba(' + C + ',0)');
  g.fillStyle = sg; g.fillRect(-R, sy - R * 0.14, R * 2, R * 0.28);
  g.restore();
  g.restore();
}

G.PAL_REAL = PAL_REAL; G.palGhost = palGhost;
G.walkerPose = walkerPose; G.drawWalker = drawWalker; G.walkerJoints = walkerJoints;
G.drawBike = drawBike; G.drawCar = drawCar; G.drawTimerRing = drawTimerRing;
})(typeof window !== 'undefined' ? window : globalThis);
