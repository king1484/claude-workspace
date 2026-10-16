// ch6b.js — "The Loop" (43.265 s). Hero vs. his own ghost; the ghost is only a guess; the ouroboros;
// the one thing it can never show: the decision to ignore it; eyes closed; sunrise; surprise.
// Registers CH.ch6b = { draw(g, lt, dur) }. Everything is a pure function of lt.
(function () {
'use strict';
const W = 1920, H = 1080, GY = 820;

// ----------------------------------------------------------------------------- timeline (local seconds, shared with ch6b.cues.json)
const T = {
  ghostIn: 0.9,
  rehearse: [3.3, 4.5],        // hero lifts his LEFT (far) hand to try
  gRightUp: 5.7,               // ghost raises its right (far) hand
  hLeftUp: 6.35,               // hero obeys the rule: raises left
  lower1: 7.45,
  gLeftUp: 7.85,               // "the ghost raises its left hand"
  hRightUp: 9.55,              // "you raise your right"
  gChange: 10.95,              // "the ghost changes"
  pullOut: 12.96,
  infStart: 13.4,
  echoStart: 15.2,
  accel: 17.3,
  cutVoid: 19.55,
  bite: 21.25,
  cutStreet: 22.95,
  ringIn: 23.4,
  ignore: 26.45,               // hero's glow dims: he decides
  shatter: 27.45,
  close: 28.98,
  lidsShut: 29.9,
  dimIn: 30.7,
  beats: [34.85, 35.12, 35.62, 35.89],
  open: 36.35,
  walk0: 37.4,
  birds: 41.12,
};
const HX = 760, GX = 1160;     // hero / ghost spots on the sidewalk
const S0 = 1.25;               // character scale in the test scenes

// ----------------------------------------------------------------------------- small helpers
const bump = (t, a, b, ri, fa) => smooth((t - a) / (ri == null ? 0.3 : ri)) * (1 - smooth((t - b) / (fa == null ? 0.3 : fa)));
const pulseAt = (t, t0, k) => (t < t0 ? 0 : Math.exp(-(t - t0) * k));
function shk(t, t0, amp, decay, f) {
  if (t < t0) return { x: 0, y: 0, r: 0 };
  const u = t - t0, e = Math.exp(-u * decay) * amp; f = f || 38;
  return { x: Math.sin(u * f + 1.3) * e + Math.sin(u * f * 1.9 + 4.1) * e * 0.5, y: Math.cos(u * f * 1.2 + 0.4) * e * 0.8, r: Math.sin(u * f * 0.7 + 2.0) * e * 0.0006 };
}
function ik2(p0, p1, l1, l2, side) {
  let dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy), ux, uy;
  if (d < 1e-6) { ux = 0; uy = 1; d = 1e-6; } else { ux = dx / d; uy = dy / d; }
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { mid: { x: p0.x + ux * a + side * uy * h, y: p0.y + uy * a - side * ux * h }, end: { x: p0.x + ux * dd, y: p0.y + uy * dd } };
}

// standing pose with controllable raised arms.  rF = near arm raise (0..1), rB = far arm raise
function mkPose(o) {
  const lean = o.lean == null ? 0.03 : o.lean;
  const P = walkerPose({ phase: o.phase || 0, walk: o.walk || 0, headDown: o.headDown || 0, lean, bob: o.bob == null ? 0.6 : o.bob,
    eyeOpen: o.eyeOpen || 0, eyeGlow: o.eyeGlow || 0, flutter: o.flutter == null ? 0.12 : o.flutter, step: o.step || 0, time: o.time || 0 });
  const J = P.J, rest = 0.07 + lean * 0.35, tm = o.time || 0;
  function arm(raise, wv, ph, cur) {
    if (raise < 0.003 && !(o.walk > 0.02)) return cur;
    if (raise < 0.003) return cur;
    const phi = lerp(rest, 2.45, raise) + wv * raise * 0.16 * Math.sin(tm * 9 + ph);
    const reach = 71 + 6.4 * raise;
    const tgt = { x: J.x + Math.sin(phi) * reach, y: J.y + Math.cos(phi) * reach };
    const r = ik2(J, tgt, 39, 39, -1);
    return { sh: J, elbow: r.mid, hand: r.end };
  }
  P.armF = arm(o.rF || 0, o.wave || 0, 0, P.armF);
  P.armB = arm(o.rB || 0, o.wave || 0, 1.7, P.armB);
  if (o.hand) {                       // custom near-hand target relative to J (e.g. hand held to chest)
    const tgt = { x: J.x + o.hand.x, y: J.y + o.hand.y }, r = ik2(J, tgt, 39, 39, -1);
    P.armF = { sh: J, elbow: r.mid, hand: r.end };
  }
  if (o.tilt) P.head = Object.assign({}, P.head, { rot: P.head.rot + o.tilt });
  return P;
}
const heroAt = (g, x, y, s, facing, pose) => drawWalker(g, { x, y, s, facing, pose, pal: PAL_REAL, alpha: 1 });
function ghostAt(g, x, y, s, facing, pose, alpha, reveal) {
  g.save();
  if (reveal != null && reveal < 1) {
    const hh = 330 * s, top = y - hh * reveal;
    g.beginPath(); g.rect(x - 260 * s, top, 520 * s, hh * reveal + 60); g.clip();
  }
  drawWalker(g, { x, y, s, facing, pose, pal: palGhost(alpha), alpha: 1 });
  g.restore();
}
const CY = '127,233,255';

// hologram "scan" line that reveals a ghost
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

// fast vector glitch bars over a figure's body (deterministic)
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

// lemniscate (infinity) hologram loop, drawn in WORLD space. draw = 0..1 how much is inked, head moves around it.
function drawInfinity(g, cx, cy, a, t, draw, k) {
  if (draw <= 0.01) return;
  const N = 120, pt = (s) => { const d = 1 + Math.sin(s) * Math.sin(s); return { x: cx + a * Math.cos(s) / d, y: cy + a * 1.15 * Math.sin(s) * Math.cos(s) / d }; };
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
  const upto = Math.floor(N * draw);
  for (let pass = 0; pass < 2; pass++) {
    g.strokeStyle = pass ? 'rgba(225,252,255,0.85)' : 'rgba(' + CY + ',0.28)';
    g.lineWidth = (pass ? 3 : 14) / k;
    g.beginPath();
    for (let i = 0; i <= upto; i++) { const p = pt((i / N) * TAU + Math.PI / 2); if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); }
    g.stroke();
  }
  // travelling pulse with a comet tail
  const sp = 0.62 + 0.45 * smooth((t - T.accel) / 2.0) * 1.8, u = (t * sp) % 1;
  for (let j = 0; j < 26; j++) {
    const uu = (u - j * 0.006 + 1) % 1, p = pt(uu * TAU + Math.PI / 2);
    if (uu * N > upto) continue;
    g.fillStyle = 'rgba(255,255,255,' + (0.9 * (1 - j / 26)) + ')';
    g.beginPath(); g.arc(p.x, p.y, (9 - j * 0.28) / k, 0, TAU); g.fill();
  }
  g.restore();
}

// birds: flapping chevrons
function bird(g, x, y, sz, ph, ang) {
  const f = Math.sin(ph) * 0.9;
  g.save(); g.translate(x, y); g.rotate(ang);
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = '#1a0f26'; g.lineWidth = sz * 0.2;
  g.beginPath(); g.moveTo(-sz, -sz * 0.35 * f - sz * 0.15); g.quadraticCurveTo(-sz * 0.45, -sz * 0.55 * f - sz * 0.35, 0, 0);
  g.quadraticCurveTo(sz * 0.45, -sz * 0.55 * f - sz * 0.35, sz, -sz * 0.35 * f - sz * 0.15); g.stroke();
  g.strokeStyle = 'rgba(255,170,100,0.8)'; g.lineWidth = sz * 0.06;
  g.beginPath(); g.moveTo(sz * 0.05, -sz * 0.04); g.quadraticCurveTo(sz * 0.5, -sz * 0.55 * f - sz * 0.36, sz, -sz * 0.35 * f - sz * 0.15); g.stroke();
  g.restore();
}

// eyelids closing / opening over the whole frame (c: 0 open ... 1 shut)
function drawLids(g, c) {
  if (c <= 0.002) return;
  const e = c * (H / 2 + 40), bulge = 90 * Math.sin(Math.PI * Math.min(1, c)) + 40 * c;
  g.save();
  g.fillStyle = '#05030a';
  g.beginPath(); g.moveTo(-10, -10); g.lineTo(W + 10, -10); g.lineTo(W + 10, e - 0); g.quadraticCurveTo(W / 2, e + bulge, -10, e); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-10, H + 10); g.lineTo(W + 10, H + 10); g.lineTo(W + 10, H - e); g.quadraticCurveTo(W / 2, H - e - bulge, -10, H - e); g.closePath(); g.fill();
  // soft feathered edges
  for (let i = 1; i <= 5; i++) {
    g.strokeStyle = 'rgba(5,3,10,' + (0.2 / i) + ')'; g.lineWidth = i * 9;
    g.beginPath(); g.moveTo(-10, e); g.quadraticCurveTo(W / 2, e + bulge, W + 10, e); g.stroke();
    g.beginPath(); g.moveTo(-10, H - e); g.quadraticCurveTo(W / 2, H - e - bulge, W + 10, H - e); g.stroke();
  }
  g.restore();
}

// ============================================================================= the dark "ouroboros" stage (o4)
function drawLoopStage(g, lt) {
  const u = lt - T.cutVoid;
  const cx = 960, cy = 740, Rx = 740, Ry = 200;
  g.save();
  // slow push-in
  const zz = 1 + 0.05 * (u / 3.4);
  g.translate(W / 2, H * 0.55); g.scale(zz, zz); g.translate(-W / 2, -H * 0.55);
  // background
  let gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#02030a'); gr.addColorStop(0.42, '#060a22'); gr.addColorStop(0.5, '#0d1b4c'); gr.addColorStop(0.505, '#05081c'); gr.addColorStop(1, '#0a0e2a');
  g.fillStyle = gr; g.fillRect(-100, -100, W + 200, H + 200);
  for (let i = 0; i < 70; i++) {
    const r = rng(500 + i), x = r() * W, y = r() * 480, a = (0.2 + 0.6 * r()) * (0.6 + 0.4 * Math.sin(lt * (1 + r() * 2) + i));
    g.fillStyle = 'rgba(200,230,255,' + a * 0.8 + ')'; g.fillRect(x, y, 1.8, 1.8);
  }
  // horizon haze
  g.save(); g.globalCompositeOperation = 'lighter';
  g.translate(W / 2, 535); g.scale(1, 0.07);
  gr = g.createRadialGradient(0, 0, 0, 0, 0, 1100); gr.addColorStop(0, 'rgba(70,170,255,0.55)'); gr.addColorStop(1, 'rgba(40,100,255,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1100, 0, TAU); g.fill(); g.restore();
  // floor pool of light + concentric rings + spokes
  g.save(); g.globalCompositeOperation = 'lighter'; g.translate(cx, cy); g.scale(1, Ry / Rx);
  gr = g.createRadialGradient(0, 0, 0, 0, 0, Rx * 1.5); gr.addColorStop(0, 'rgba(40,150,255,0.30)'); gr.addColorStop(0.6, 'rgba(30,90,230,0.14)'); gr.addColorStop(1, 'rgba(20,60,200,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, Rx * 1.5, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(' + CY + ',0.16)'; g.lineWidth = 2;
  for (let k = 1; k <= 6; k++) { g.beginPath(); g.arc(0, 0, Rx * (k / 4.2), 0, TAU); g.stroke(); }
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(' + CY + ',0.10)';
  for (let k = 0; k < 24; k++) { const a = k / 24 * TAU + lt * 0.05; g.beginPath(); g.moveTo(Math.cos(a) * Rx * 0.3, Math.sin(a) * Rx * 0.3); g.lineTo(Math.cos(a) * Rx * 1.5, Math.sin(a) * Rx * 1.5); g.stroke(); }
  g.restore();

  // ring geometry
  const N = 11, om = TAU / 10, th0 = 0.35 + om * u * 0.9;
  const thHead = th0 - 0.15, gap = lerp(1.0, 0.2, smooth((u - 0.2) / 1.2));
  const at = (th) => ({ x: cx + Rx * Math.cos(th), y: cy + Ry * Math.sin(th), s: lerp(0.62, 1.18, (Math.sin(th) + 1) / 2) });
  // snake body ribbon: head -> tail, thickness tapers
  const SEG = 90, span = TAU - gap;
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < SEG; i++) {
      const f0 = i / SEG, f1 = (i + 1) / SEG;
      const a0 = thHead - f0 * span, a1 = thHead - f1 * span, p0 = at(a0), p1 = at(a1);
      const wd = lerp(30, 3.5, Math.pow(f0, 0.65)) * p0.s;
      g.strokeStyle = pass ? 'rgba(210,250,255,' + (0.8 - 0.4 * f0) + ')' : 'rgba(' + CY + ',' + (0.2 + 0.1 * (1 - f0)) + ')';
      g.lineWidth = pass ? wd * 0.28 : wd;
      g.beginPath(); g.moveTo(p0.x, p0.y + 4); g.lineTo(p1.x, p1.y + 4); g.stroke();
    }
  }
  // scale marks
  for (let i = 0; i < 60; i++) {
    const f = i / 60, a = thHead - f * span, p = at(a), wd = lerp(30, 3.5, Math.pow(f, 0.65)) * p.s;
    g.strokeStyle = 'rgba(' + CY + ',' + (0.35 * (1 - f * 0.6)) + ')'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(p.x - wd * 0.12, p.y + 4 - wd * 0.28); g.lineTo(p.x + wd * 0.12, p.y + 4 + wd * 0.28); g.stroke();
  }
  g.restore();

  // order figures back-to-front by feet y
  const figs = [];
  for (let k = 0; k < N; k++) {
    const th = th0 + k * TAU / N, p = at(th);
    figs.push({ k, th, x: p.x, y: p.y, s: p.s });
  }
  figs.push({ k: -1, x: cx, y: cy + 12, s: 0.98, hero: true });
  figs.sort((a, b) => a.y - b.y);
  const bitePulse = pulseAt(lt, T.bite, 8);
  figs.forEach((f) => {
    if (f.hero) {
      const P = mkPose({ eyeOpen: 1, eyeGlow: 1, time: lt, lean: 0.02, flutter: 0.2, headDown: 0, rF: 0, tilt: 0.06 * Math.sin(lt * 1.3) });
      // the hero turns slowly, watching the circle
      const face = Math.sin(lt * 0.9) > 0 ? 1 : -1;
      heroAt(g, f.x, f.y, f.s, face, P);
      return;
    }
    const wv = Math.sin(TAU * (u * 1.25 - f.k / N));
    const rn = clamp(wv * 2.2) , rb = clamp(-wv * 2.2);
    const P = mkPose({ eyeOpen: 1, eyeGlow: 1, time: lt + f.k, lean: 0.04, flutter: 0.1, rF: rn, rB: rb, wave: 1 });
    const sq = clamp(-Math.sin(f.th) * 2.6, -1, 1);
    const al = lerp(0.62, 0.95, (Math.sin(f.th) + 1) / 2) * (0.88 + 0.12 * Math.sin(lt * 7 + f.k * 2));
    g.save(); g.translate(f.x, 0); g.scale(Math.abs(sq) < 0.12 ? 0.12 * (sq < 0 ? -1 : 1) : sq, 1); g.translate(-f.x, 0);
    drawWalker(g, { x: f.x, y: f.y, s: f.s, facing: 1, pose: P, pal: palGhost(al), alpha: 1 });
    g.restore();
  });

  // snake head at thHead (drawn last so it bites over the front)
  {
    const p = at(thHead), nx = Math.cos(thHead + 0.05), tx = -Rx * Math.sin(thHead), ty = Ry * Math.cos(thHead);
    const ang = Math.atan2(ty, tx), sz = 58 * p.s, open = gap * 0.8 + 0.12 * (1 - bitePulse) - 0.45 * bitePulse + 0.05;
    g.save(); g.translate(p.x, p.y - sz * 0.15); g.rotate(ang * 0.55); g.globalCompositeOperation = 'lighter';
    const hg = g.createRadialGradient(0, 0, 0, 0, 0, sz * 2.2);
    hg.addColorStop(0, 'rgba(160,240,255,0.5)'); hg.addColorStop(1, 'rgba(60,170,255,0)'); g.fillStyle = hg; g.fillRect(-sz * 2.2, -sz * 2.2, sz * 4.4, sz * 4.4);
    g.globalCompositeOperation = 'source-over';
    const jaw = (sgn) => {
      g.save(); g.rotate(sgn * Math.max(0.05, open) * 0.7);
      g.beginPath(); g.moveTo(-sz * 0.2, 0); g.quadraticCurveTo(sz * 0.7, sgn * sz * 0.5, sz * 1.25, sgn * sz * 0.06); g.lineTo(sz * 1.25, 0); g.closePath();
      g.fillStyle = '#bff3ff'; g.fill(); g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.stroke(); g.restore();
    };
    jaw(-1); jaw(1);
    g.beginPath(); g.ellipse(-sz * 0.1, -sz * 0.05, sz * 0.78, sz * 0.52, 0, 0, TAU); g.fillStyle = '#7fe9ff'; g.fill(); g.strokeStyle = '#eaffff'; g.lineWidth = 2.5; g.stroke();
    g.fillStyle = '#04122c'; g.beginPath(); g.ellipse(sz * 0.12, -sz * 0.18, sz * 0.17, sz * 0.11, -0.3, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(sz * 0.16, -sz * 0.2, sz * 0.05, 0, TAU); g.fill();
    g.restore();
  }
  // chomp sparkles at the tail tip
  if (lt > T.bite) {
    const p = at(thHead + gap * 0.8);
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) {
      const r = rng(900 + i), a = r() * TAU, d = (lt - T.bite) * (140 + 220 * r()), al = Math.max(0, 1 - (lt - T.bite) * 1.6);
      g.fillStyle = 'rgba(210,250,255,' + al + ')'; g.beginPath(); g.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.6, 3 + 3 * r(), 0, TAU); g.fill();
    }
    g.restore();
  }
  // floor sparks rising off the ribbon
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 30; i++) {
    const r = rng(1200 + i), th = r() * TAU + om * u, p = at(th), rise = ((lt * (30 + 40 * r()) + r() * 200) % 200);
    g.fillStyle = 'rgba(190,245,255,' + (0.5 * (1 - rise / 200)) + ')'; g.fillRect(p.x + (r() - 0.5) * 30, p.y - rise, 2.2, 2.2);
  }
  g.restore();
  g.restore();
  // the ten-second ring hologram above the loop, counting 10 -> 0 and starting over (screen space)
  const cyc = ((u * 0.9) % 3.4) / 3.4;
  drawTimerRing(g, W / 2, 205, 300, { value: 10 * (1 - cyc), progress: cyc, appear: smooth(u / 0.4), time: lt });
}

// ============================================================================= the main street scenes
function heroState(lt) {
  const s = { x: HX, y: GY, facing: 1, o: { time: lt } };
  const o = s.o;
  o.eyeOpen = clamp(spring(lt - T.ghostIn, 230, 22));
  o.eyeGlow = clamp(spring(lt - (T.ghostIn + 0.15), 200, 22)) * (1 - smooth((lt - T.ignore) / 0.55));
  if (lt >= T.close - 0.05) { o.eyeOpen = Math.max(0, 1 - smooth((lt - T.close) / 0.16)); o.eyeGlow = 0; }
  if (lt >= T.open) { o.eyeOpen = clamp(spring(lt - T.open, 130, 17)); o.eyeGlow = 0; }
  o.flutter = 0.12 + 0.06 * Math.sin(lt * 1.7);
  o.lean = 0.03;
  // arms (test scene)
  o.rB = bump(lt, T.rehearse[0], T.rehearse[1], 0.35, 0.3) + bump(lt, T.hLeftUp, T.lower1, 0.3, 0.25);
  o.rF = bump(lt, T.hRightUp, 12.9, 0.3, 0.45);
  o.wave = 0.6;
  // head tilt: puzzled after the ghost changes
  o.tilt = 0.18 * bump(lt, T.gChange + 0.2, 13.4, 0.2, 0.6) + 0.03 * Math.sin(lt * 1.1);
  // after the experiment: hands drop. in the ignore beat he lowers his head a touch
  o.headDown = 0.0;
  if (lt > T.ignore) o.headDown = 0.16 * smooth((lt - T.ignore) / 0.8);
  if (lt > T.open - 1.2) o.headDown = 0.16 * (1 - smooth((lt - (T.open - 0.3)) / 0.9));
  // waiting in the dark, hand to the chest, heartbeats
  if (lt > T.beats[0] - 0.7 && lt < T.open + 0.3) o.hand = { x: 28, y: 30 };
  // sunrise: stroll, startle, arms up
  let x = HX; o.walk = 0;
  if (lt > T.walk0) {
    const w = (t) => smooth((t - T.walk0) / 0.6) * (1 - smooth((t - (T.birds - 0.25)) / 0.35));
    let d = 0; const v = 52;
    for (let t = T.walk0; t < Math.min(lt, T.birds + 0.4); t += 0.04) d += w(t) * v * 0.04;
    x = HX + d; o.walk = w(lt);
  }
  o.phase = x / 140;
  if (lt > T.birds) {
    const u = lt - T.birds;
    o.step = clamp(spring(u, 240, 20)) * (1 - smooth((u - 0.5) / 0.3));
    const up = bump(lt, T.birds + 0.55, 99, 0.55, 0.3);
    o.rF = Math.max(o.rF, up * 0.92); o.rB = Math.max(o.rB, up * 0.92);
    o.wave = 0.9; o.hand = null;
    o.tilt = -0.32 * up + 0.12 * (1 - up) * Math.exp(-u * 3);
    o.lean = lerp(0.1, -0.02, up);
    o.eyeGlow = 0;
  }
  s.x = x; s.o = o;
  return s;
}

function ghostArms(lt) {
  // returns {rF, rB, flick}: near (its left) and far (its right) hand raises
  let rF = 0, rB = 0, flick = 0;
  rB = bump(lt, T.gRightUp, T.lower1 - 0.05, 0.3, 0.25);
  rF = bump(lt, T.gLeftUp, T.gChange - 0.02, 0.3, 0.1);
  if (lt >= T.gChange) {
    // "the ghost changes" -> snaps to the right hand, then starts to guess back and forth ever faster
    const u = lt - T.gChange;
    if (u < 0.5) { rB = smooth(u / 0.12); rF = 0; }
    else {
      const per = lerp(0.62, 0.2, smooth((lt - 11.4) / 6.0));
      const ph = (u - 0.5) / per;
      const a = Math.floor(ph) % 2 === 0;
      const k = smooth((ph % 1) / 0.35) * (1 - smooth(((ph % 1) - 0.75) / 0.25));
      rB = a ? Math.max(k, 0.0) : 0; rF = a ? 0 : Math.max(k, 0.0);
      rB = a ? 1 : 0.0; rF = a ? 0.0 : 1;
      rB *= 0.55 + 0.45 * Math.sin(ph * Math.PI); rF *= 0.55 + 0.45 * Math.sin(ph * Math.PI);
    }
    flick = 1;
  }
  return { rF, rB, flick };
}

function drawStreet(g, lt) {
  const hs = heroState(lt);
  const hero = hs.o;
  // ---- camera
  let cam;
  const inA = lt < T.pullOut, inB = lt < T.cutVoid, inD = lt >= T.cutStreet && lt < T.close + 0.1;
  const headY = 540;
  if (lt < T.cutVoid) {
    const a = { x: 960, y: 592, z: 1.1 + 0.03 * (lt / 12.9) };
    const b = { x: 1110, y: 575, z: 0.84 };
    const w = spring(lt - T.pullOut, 60, 12);
    cam = { x: lerp(a.x, b.x, w), y: lerp(a.y, b.y, w), z: lerp(a.z, b.z, w), r: 0 };
    cam.z *= 1 + 0.025 * pulseAt(lt, T.gChange, 7);
    const sk = shk(lt, T.gChange, 10, 8); cam.x += sk.x; cam.y += sk.y; cam.r = sk.r;
    cam.x += 14 * Math.sin(lt * 0.6);
    // build-up: slow creeping push
    if (lt > T.accel) cam.z *= 1 + 0.07 * smooth((lt - T.accel) / 2.2);
  } else if (lt < T.close + 0.1) {
    const u = lt - T.cutStreet;
    cam = { x: 1000 + 12 * Math.sin(lt * 0.8), y: 600, z: 1.5 + 0.38 * smooth(u / 5.6), r: 0 };
    const sk = shk(lt, T.shatter, 12, 7); cam.x += sk.x; cam.y += sk.y; cam.r = sk.r;
    cam.z *= 1 + 0.03 * pulseAt(lt, T.ignore, 5);
  } else {
    const u = lt - T.close;
    // wide, slow crane up toward the sky
    const tgtY = 600 - 70 * smooth(u / 7);
    cam = { x: lerp(1010, 900, smooth(u / 2.0)) , y: tgtY, z: lerp(1.5, 0.95, smooth(u / 3.0)), r: 0 };
    if (lt > T.open - 0.6) {
      const w = smooth((lt - (T.open - 0.6)) / 3.2);
      cam.y = lerp(tgtY, 600, w); cam.z = lerp(0.98, 0.9, w); cam.x = lerp(900, hs.x + 150, smooth((lt - T.walk0) / 4.5));
    }
    // heartbeat punches
    let hb = 0; T.beats.forEach((b) => { hb += pulseAt(lt, b, 10) * (lt < T.open ? 1 : 0); });
    cam.z *= 1 + 0.022 * hb;
    if (lt > T.birds - 0.2) {
      const w = smooth((lt - T.birds) / 1.6);
      cam.z *= 1 + 0.05 * pulseAt(lt, T.birds, 6);
      cam.y -= 50 * w; cam.x += 40 * w;
    }
  }
  cam.r = cam.r || 0;

  g.save();
  if (cam.r) { g.translate(W / 2, H / 2); g.rotate(cam.r); g.translate(-W / 2, -H / 2); }
  drawWorld(g, cam, lt + 20);

  // vision grade strength
  let vg = 0.55;
  if (lt < T.ghostIn) vg = 0.55 * smooth(lt / T.ghostIn);
  if (lt >= T.close - 0.2) vg = 0;
  if (inD) vg = 0.5 * (1 - smooth((lt - T.ignore) / 0.8) * 0.7);
  if (vg > 0.003) visionGrade(g, vg);

  // ---- hero (after the grade, so he stays red)
  const hp = mkPose(hero);
  const heroS = lt < T.close ? S0 : 1.12;
  withLayer(g, cam, 1, () => heroAt(g, hs.x, GY, heroS, 1, hp));

  // ---- ghost(s)
  const ga = ghostArms(lt);
  const gx = GX;
  const gEnv = lt < T.close - 0.2 ? 1 : 0;
  let gAlpha = 0.95;
  if (lt < T.cutVoid) {
    const reveal = smooth((lt - T.ghostIn) / 0.9);
    gAlpha = 0.92 * (0.9 + 0.1 * Math.sin(lt * 31)) * (ga.flick ? (hash1(Math.floor(lt * 20)) < 0.1 ? 0.45 : 1) : 1);
    // rapid state tearing as the guess runs away
    const gp = mkPose({ eyeOpen: 1, eyeGlow: 1, time: lt, lean: 0.03, flutter: 0.15, rF: ga.rF, rB: ga.rB, wave: 1 });
    const strain = smooth((lt - T.accel) / 2.0);
    withLayer(g, cam, 1, () => {
      if (lt > T.ghostIn) ghostAt(g, gx, GY, S0, -1, gp, gAlpha, reveal);
      if (reveal < 1) scanLine(g, gx, GY, S0, reveal);
      if (ga.flick) glitchBars(g, gx, GY, S0, lt, 0.25 + 0.6 * strain);
      // the recursion: a chain of ghosts receding to the sun, each reacting to the one before it
      const nE = 5;
      for (let k = 1; k <= nE; k++) {
        const t0 = T.echoStart + 0.32 * (k - 1);
        if (lt < t0) continue;
        const pop = clamp(spring(lt - t0, 220, 17));
        const sc = S0 * Math.pow(0.8, k);
        let ex = gx, d = 150; for (let j = 1; j <= k; j++) { ex += d; d *= 0.74; }
        const per = lerp(0.62, 0.2, smooth((lt - 11.4) / 6.0));
        const ph = (lt - T.gChange - 0.5 - k * 0.22) / per;
        const wv = Math.sin(ph * Math.PI);
        const a = Math.floor(ph) % 2 === 0;
        const ep = mkPose({ eyeOpen: 1, eyeGlow: 1, time: lt + k, lean: 0.03, flutter: 0.1, rF: a ? 0 : (0.55 + 0.45 * wv), rB: a ? (0.55 + 0.45 * wv) : 0, wave: 1 });
        const al = 0.8 * Math.pow(0.74, k - 1) * Math.min(1, pop * 1.5);
        g.save(); g.translate(ex, GY - 8 * k); g.scale(lerp(0.6, 1, pop), lerp(0.6, 1, pop)); g.translate(-ex, -(GY - 8 * k));
        ghostAt(g, ex, GY - 8 * k, sc, -1, ep, al, 1);
        g.restore();
      }
      // thin cyan link between the two heads/chests, with data pulses
      const hJ = walkerJoints({ x: hs.x, y: GY, s: heroS, facing: 1, pose: hp }), gJ = walkerJoints({ x: gx, y: GY, s: S0, facing: -1, pose: gp });
      const la = smooth((lt - (T.ghostIn + 0.7)) / 0.5) * (1 - smooth((lt - 18.8) / 0.6));
      if (la > 0.01) {
        g.save(); g.globalCompositeOperation = 'lighter';
        const x0 = hJ.head.x + 38, y0 = hJ.head.y, x1 = gJ.head.x - 38, y1 = gJ.head.y;
        const lg = g.createLinearGradient(x0, 0, x1, 0);
        lg.addColorStop(0, 'rgba(' + CY + ',0.0)'); lg.addColorStop(0.15, 'rgba(' + CY + ',0.55)'); lg.addColorStop(0.85, 'rgba(' + CY + ',0.55)'); lg.addColorStop(1, 'rgba(' + CY + ',0)');
        g.strokeStyle = lg; g.lineWidth = 3; g.setLineDash([14, 10]); g.lineDashOffset = -lt * 90;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]);
        for (let i = 0; i < 3; i++) {
          const f = ((lt * (0.6 + 0.4 * strain * 2) + i / 3) % 1), f2 = i % 2 ? f : 1 - f;
          g.fillStyle = 'rgba(235,254,255,' + (0.9 * la) + ')';
          g.beginPath(); g.arc(lerp(x0, x1, f2), lerp(y0, y1, f2), 6, 0, TAU); g.fill();
        }
        g.restore();
      }
      // the infinity loop hologram above them
      const ink = smooth((lt - T.infStart) / 1.4) * (1 - smooth((lt - 19.2) / 0.3));
      if (ink > 0.01) drawInfinity(g, 960, 372, 285, lt, ink, zsOf(cam));
    });
  } else if (inD) {
    const u = lt - T.cutStreet;
    // the ghost keeps guessing -> then cannot render the decision at all
    const chaos = smooth((lt - 25.3) / 1.3);
    const per = lerp(0.3, 0.07, chaos);
    const a = Math.floor((lt - T.cutStreet) / per) % 2 === 0;
    const gp = mkPose({ eyeOpen: 1, eyeGlow: 1, time: lt, lean: 0.03, flutter: 0.15, rF: a ? 0 : 1, rB: a ? 1 : 0, wave: 1 });
    const gone = smooth((lt - T.shatter) / 0.28);
    const alpha = 0.92 * (1 - gone) * (chaos > 0.1 && hash1(Math.floor(lt * 30)) < chaos * 0.45 ? 0.35 : 1);
    withLayer(g, cam, 1, () => {
      if (gone < 0.999 && alpha > 0.01) {
        ghostAt(g, gx, GY, S0, -1, gp, alpha, 1);
        if (chaos > 0.05) {
          g.save(); g.translate(14 * chaos * Math.sin(lt * 53), 0); ghostAt(g, gx, GY, S0, -1, gp, alpha * 0.35, 0.9 + 0.1 * Math.sin(lt * 20)); g.restore();
          glitchBars(g, gx, GY, S0, lt, 0.3 + 0.7 * chaos);
        } else glitchBars(g, gx, GY, S0, lt, 0.15);
      }
      // static blocks over it
      if (chaos > 0.05 && gone < 0.99) {
        const fr = Math.floor(lt * 24);
        g.save(); g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 26 * chaos; i++) {
          const r = rng(fr * 13 + i), x = gx + (r() - 0.5) * 200, y = GY - r() * 330 * S0;
          g.fillStyle = 'rgba(200,245,255,' + (0.2 + 0.5 * r()) * (1 - gone) + ')'; g.fillRect(x, y, 6 + r() * 26, 2 + r() * 5);
        }
        g.restore();
      }
      // dissolve into dust
      if (lt >= T.shatter) {
        const v = lt - T.shatter;
        g.save(); g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 110; i++) {
          const r = rng(7000 + i), px = gx + (r() - 0.5) * 150, py = GY - r() * 300 * S0, vx = (r() - 0.5) * 140, vy = -40 - r() * 190;
          const al = Math.max(0, 1 - v * 0.75) * (0.4 + 0.6 * r());
          g.fillStyle = 'rgba(' + (r() < 0.5 ? CY : '235,254,255') + ',' + al + ')';
          g.fillRect(px + vx * v, py + vy * v + 90 * v * v * (r()), 2.5 + r() * 3.5, 2.5 + r() * 3.5);
        }
        g.restore();
      }
    });
    // confused timer ring
    const rg = smooth((lt - T.ringIn) / 0.4) * (1 - smooth((lt - (T.shatter + 0.05)) / 0.1));
    if (rg > 0.01) {
      const sp = project(cam, (hs.x + gx) / 2, 330, 1);
      const p = clamp((lt - T.ringIn) / 10);
      const val = lt > T.ignore ? 10 * hash1(Math.floor(lt * 22) + 11) : 10 * (1 - p);
      drawTimerRing(g, sp.x, 190, 300, { value: val, progress: lt > T.ignore ? hash1(Math.floor(lt * 22) + 3) : p, appear: rg, time: lt });
    }
  }

  // ---- warm dawn: grading + sun bloom + birds
  const warm = smooth((lt - T.open) / 1.6);
  if (warm > 0.003) {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'screen';
    let gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(255,170,120,' + 0.20 * warm + ')'); gr.addColorStop(1, 'rgba(255,200,130,' + 0.10 * warm + ')');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const sp = project(cam, 620, 430, 0.05);
    const br = 1 + 0.03 * Math.sin(lt * 1.4);
    gr = g.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 900 * br);
    gr.addColorStop(0, 'rgba(255,225,160,' + 0.65 * warm + ')'); gr.addColorStop(0.3, 'rgba(255,170,110,' + 0.25 * warm + ')'); gr.addColorStop(1, 'rgba(255,130,100,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // slow golden motes
    for (let i = 0; i < 34; i++) {
      const r = rng(3300 + i), px = (r() * 2100 + lt * (8 + 14 * r())) % 2100 - 90, py = (H + 60 - ((r() * 1300 + lt * (14 + 22 * r())) % 1300));
      const a = (0.2 + 0.5 * r()) * warm * (0.6 + 0.4 * Math.sin(lt * 2 + i));
      g.fillStyle = 'rgba(255,225,170,' + a + ')'; g.beginPath(); g.arc(px, py, 1.5 + 2.5 * r(), 0, TAU); g.fill();
    }
    g.restore();
  }
  if (lt > T.birds - 0.01) {
    const u = lt - T.birds;
    withLayer(g, cam, 1, () => {
      for (let i = 0; i < 20; i++) {
        const r = rng(4100 + i), sx = hs.x + 330 + r() * 150, sy = GY - 30 - r() * 20;
        const ang = -0.95 + r() * 0.8, sp = 320 + r() * 380, dec = 1 - Math.exp(-u * 1.1);
        const vx = Math.cos(ang) * sp / 1.1 * dec, vy = Math.sin(ang) * sp / 1.1 * dec;
        const bx = sx + vx * 1.0 + u * (90 + 70 * r()), by = sy + vy * 1.0 - u * (40 + 60 * r());
        bird(g, bx, by, (14 + 8 * r()) * (0.7 + 0.5 * smooth(u / 1.2)), u * (14 + 6 * r()) + i, Math.atan2(vy - 20, vx + 90) * 0.3);
      }
    });
    // a tree-shaped puff where they burst from
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter';
    const f0 = project(cam, hs.x + 400, GY - 40, 1);
    const fa = pulseAt(lt, T.birds, 5);
    const fg = g.createRadialGradient(f0.x, f0.y, 0, f0.x, f0.y, 260);
    fg.addColorStop(0, 'rgba(255,230,180,' + 0.5 * fa + ')'); fg.addColorStop(1, 'rgba(255,180,120,0)');
    g.fillStyle = fg; g.fillRect(f0.x - 260, f0.y - 260, 520, 520); g.restore();
  }

  // ---- dimming for the "eyes closed" stretch (dusk sky only)
  let dim = 0;
  if (lt >= T.close) {
    dim = 0.9 * smooth((lt - T.dimIn) / 1.0);
    if (lt > T.beats[0] - 0.2 && lt < T.open) { let hb = 0; T.beats.forEach((b) => { hb += pulseAt(lt, b, 9); }); dim -= 0.12 * Math.min(1, hb); }
    if (lt >= T.open) dim = 0.9 * (1 - smooth((lt - T.open) / 1.3));
    dim = clamp(dim, 0, 0.95);
  }
  if (dim > 0.004) {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'multiply';
    const gr = g.createLinearGradient(0, 0, 0, H);
    const dd = (v) => `rgb(${Math.round(255 - (255 - v[0]) * dim)},${Math.round(255 - (255 - v[1]) * dim)},${Math.round(255 - (255 - v[2]) * dim)})`;
    gr.addColorStop(0, dd([70, 52, 96])); gr.addColorStop(0.45, dd([84, 40, 70])); gr.addColorStop(0.62, dd([12, 6, 16])); gr.addColorStop(1, dd([2, 1, 4]));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.restore();
  }
  drawForeground(g, cam, lt + 20);
  g.restore();
}

// ============================================================================= chapter
function draw(g, lt, dur) {
  g.save();
  if (lt >= T.cutVoid && lt < T.cutStreet) {
    drawLoopStage(g, lt);
  } else {
    drawStreet(g, lt);
  }
  // transition hits
  let fl = 0, sp = 0;
  const burst = (t0, a, k, split) => { if (lt >= t0) { const e = Math.exp(-(lt - t0) * k); fl += a * e; sp += split * e; } };
  burst(T.gChange, 0.35, 12, 12);
  burst(T.cutVoid, 0.8, 9, 20);
  burst(T.bite, 0.3, 10, 6);
  burst(T.cutStreet, 0.7, 10, 16);
  burst(T.shatter, 0.5, 8, 14);
  burst(T.open + 0.05, 0.45, 5, 0);
  burst(T.birds, 0.25, 9, 0);
  if (sp > 0.8) rgbSplit(g, sp);
  if (fl > 0.01) flash(g, clamp(fl), lt >= T.open ? '#fff0d0' : '#ffffff');
  // eyelids closing (hero's POV)
  if (lt >= T.close - 0.05 && lt < T.dimIn + 0.3) {
    const c = smooth((lt - T.close) / 0.9);
    const fadeUp = 1 - smooth((lt - (T.lidsShut + 0.25)) / 0.75);
    if (lt < T.lidsShut + 0.25) drawLids(g, c);
    else { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#05030a'; g.globalAlpha = fadeUp; g.fillRect(0, 0, W, H); g.restore(); }
  }
  g.restore();
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

// zoom helper (same as world.js zsOf)
function zsOf(cam) { return 1 + (cam.z - 1) * (0.25 + 0.75 * 1); }

CH.ch6b = { draw, T };
})();
