// page.js — the sketchbook insert. A real-looking spread on a wooden desk under the lamp:
// paper tooth and fibres, a spine gutter, page-stack edges, graphite that breaks up on the paper grain, coloured-pencil
// hatching for the sun, and his hand holding the pencil exactly at the tip of the stroke being drawn.
// PAGE.draw(g, E, t, P, o): P = drawing progress 0..1 (0 = only yesterday's line). Pure function of t and P.
const PAGE = (() => {
  const PW = 1240, PH = 800;                         // spread size (page space origin = spread centre)
  let paperTile = null, toothTile = null, woodCan = null, layer = null;

  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function textures() {
    if (paperTile) return;
    paperTile = mkCanvas(512, 512); let x = paperTile.getContext('2d'), r = rng(404);
    for (let i = 0; i < 9000; i++) { const v = r(); x.fillStyle = v < 0.5 ? `rgba(90,80,60,${0.05 * r()})` : `rgba(255,255,250,${0.08 * r()})`; x.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2); }
    x.lineCap = 'round';
    for (let i = 0; i < 260; i++) { const px = r() * 512, py = r() * 512, a = r() * TAU, l = 6 + r() * 22; x.strokeStyle = `rgba(110,100,80,${0.04 + 0.05 * r()})`; x.lineWidth = 0.6 + r() * 0.8; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + 0.6) * l * 0.5, py + Math.sin(a + 0.6) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
    toothTile = mkCanvas(256, 256); x = toothTile.getContext('2d'); r = rng(77);   // the paper's tooth: where graphite skips
    for (let i = 0; i < 7000; i++) { x.fillStyle = `rgba(0,0,0,${0.25 + 0.6 * r()})`; const s = 0.8 + r() * 1.8; x.fillRect(r() * 256, r() * 256, s, s * (0.6 + r())); }
    woodCan = mkCanvas(1920, 1080); x = woodCan.getContext('2d'); r = rng(9);
    const base = x.createLinearGradient(0, 0, 0, 1080); base.addColorStop(0, '#3a2a1e'); base.addColorStop(1, '#22180f'); x.fillStyle = base; x.fillRect(0, 0, 1920, 1080);
    for (let i = 0; i < 160; i++) {                    // long grain lines with knots of curl
      const y0 = r() * 1180 - 50, amp = 3 + r() * 9, fr = 0.002 + r() * 0.004, ph = r() * TAU, dark = r() < 0.6;
      x.strokeStyle = dark ? `rgba(20,12,6,${0.08 + 0.14 * r()})` : `rgba(255,210,160,${0.025 + 0.04 * r()})`; x.lineWidth = 1 + r() * 3.5;
      x.beginPath(); for (let px = -20; px <= 1940; px += 24) { const py = y0 + Math.sin(px * fr + ph) * amp + Math.sin(px * fr * 3.1 + ph * 2) * amp * 0.3 + px * 0.04; px === -20 ? x.moveTo(px, py) : x.lineTo(px, py); } x.stroke();
    }
    for (let i = 0; i < 5; i++) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 160 + i * 230 + r() * 20, 1920, 2); }   // board seams
    layer = mkCanvas(PW, PH);
  }

  // ---------------------------------------------------------------- strokes
  // a stroke is a polyline in page space; drawn to fraction f of its length
  function partial(pts, f) {
    if (f >= 1) return pts.slice();
    const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const target = L[L.length - 1] * f, out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      if (L[i] <= target) { out.push(pts[i]); continue; }
      const k = (target - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]); out.push({ x: lerp(pts[i - 1].x, pts[i].x, k), y: lerp(pts[i - 1].y, pts[i].y, k) }); break;
    }
    return out;
  }
  // graphite: several slightly offset, thin passes (a soft pencil goes over its own line), darker where the passes overlap
  function graphite(x, pts, w, col, a, seed) {
    if (pts.length < 2) return;
    const r = rng(seed); x.lineCap = 'round'; x.lineJoin = 'round';
    for (let pass = 0; pass < 4; pass++) {
      const ox = (r() - 0.5) * w * 0.5, oy = (r() - 0.5) * w * 0.5, j = pass === 0 ? 0 : w * 0.18;
      x.strokeStyle = col; x.globalAlpha = a * (pass === 0 ? 0.55 : 0.28); x.lineWidth = w * (pass === 0 ? 0.8 : 0.45 + 0.35 * r());
      x.beginPath(); pts.forEach((p, i) => { const jx = ox + (r() - 0.5) * j, jy = oy + (r() - 0.5) * j; i ? x.lineTo(p.x + jx, p.y + jy) : x.moveTo(p.x + jx, p.y + jy); }); x.stroke();
    }
    x.globalAlpha = 1;
  }
  const wob = (px, s) => Math.sin(px * 0.021 + s) * 3.2 + Math.sin(px * 0.057 + s * 2) * 1.4;
  const line = (x0, x1, y, s, step) => { const p = []; for (let px = x0; px <= x1 + 0.1; px += step || 8) p.push({ x: px, y: y + wob(px, s) }); return p; };
  const arc = (cx, cy, rad, a0, a1, n) => { const p = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n), rr_ = rad + Math.sin(a * 5) * 1.6; p.push({ x: cx + Math.cos(a) * rr_, y: cy + Math.sin(a) * rr_ }); } return p; };

  // the drawing, in order. [p0, p1, kind, data]
  const SUN = { x: 170, y: 82, r: 118 };
  const PLAN = (() => {
    const L = [];
    L.push([-2, -1, 'g', line(-470, -40, 80, 0.3), 5, 0.75]);                                   // yesterday's line
    L.push([0.0, 0.24, 'g', line(-40, 470, 80, 0.3), 5, 0.8]);                                    // the line, continued
    L.push([0.24, 0.40, 'g', arc(SUN.x, SUN.y, SUN.r, Math.PI, TAU, 40), 4.5, 0.85]);             // the sun's edge
    for (let i = 0; i < 26; i++) {                                                                 // coloured-pencil hatching inside the sun
      const off = -SUN.r * 1.1 + i * 9.4, p0 = 0.40 + i * 0.0045, a = { x: SUN.x + off - 60, y: SUN.y }, b = { x: SUN.x + off + 60, y: SUN.y - 120 };
      L.push([p0, p0 + 0.006, 'h', [a, b], 5, 0.5]);
    }
    for (let i = 0; i < 7; i++) {                                                                   // rays
      const an = Math.PI + 0.25 + i * (Math.PI - 0.5) / 6, p0 = 0.53 + i * 0.013;
      L.push([p0, p0 + 0.012, 'g', [{ x: SUN.x + Math.cos(an) * 140, y: SUN.y + Math.sin(an) * 140 }, { x: SUN.x + Math.cos(an) * 192, y: SUN.y + Math.sin(an) * 192 }], 4, 0.8]);
    }
    const path1 = [], path2 = [];                                                                   // a path to the sunrise
    for (let k = 0; k <= 1.0001; k += 0.05) { path1.push({ x: lerp(-260, 150, k) + Math.sin(k * 7) * 26 * (1 - k), y: lerp(380, 92, Math.pow(k, 0.8)) }); path2.push({ x: lerp(40, 196, k) + Math.sin(k * 7) * 18 * (1 - k), y: lerp(380, 92, Math.pow(k, 0.8)) }); }
    L.push([0.63, 0.70, 'g', path1, 4.5, 0.8]); L.push([0.70, 0.76, 'g', path2, 4, 0.75]);
    const hill1 = [], hill2 = []; for (let k = 0; k <= 1.0001; k += 0.05) { hill1.push({ x: lerp(-560, -60, k), y: 80 + 6 - Math.sin(k * Math.PI) * 60 }); hill2.push({ x: lerp(300, 580, k), y: 80 + 4 - Math.sin(k * Math.PI) * 38 }); }
    L.push([0.76, 0.81, 'g', hill1, 3.5, 0.55]); L.push([0.81, 0.85, 'g', hill2, 3.5, 0.5]);
    for (let i = 0; i < 9; i++) { const x0 = -500 + i * 46, p0 = 0.85 + i * 0.003; L.push([p0, p0 + 0.003, 'g', [{ x: x0, y: 82 }, { x: x0 + 26, y: 82 - 34 * Math.sin((i + 1) / 10 * Math.PI) }], 2.5, 0.35]); }   // shading on the hill
    return L;
  })();
  const FIG = [0.88, 1.0];                                                                          // the small red-hooded figure on the path

  function drawPlan(x, P, s) {
    let tip = null;
    for (const [p0, p1, kind, pts, w, a] of PLAN) {
      const f = p0 < 0 ? 1 : clamp((P - p0) / (p1 - p0)); if (f <= 0) continue;
      const pp = partial(pts, f);
      if (kind === 'h') { x.save(); x.beginPath(); x.arc(SUN.x, SUN.y, SUN.r - 3, Math.PI, TAU); x.closePath(); x.clip(); graphite(x, pp, w, 'rgb(226,128,46)', a, (p0 * 1000) | 0); x.restore(); }
      else graphite(x, pp, w, p0 < 0 ? 'rgb(60,60,66)' : 'rgb(48,48,54)', a * (p0 < 0 ? 0.8 : 1), (p0 * 997 + 3) | 0);
      if (f < 1 && p0 >= 0) tip = pp[pp.length - 1];
    }
    const fk = clamp((P - FIG[0]) / (FIG[1] - FIG[0]));
    if (fk > 0) {                                                                                   // coloured pencil figure: hood, face, two eyes
      x.save(); x.translate(176, 112); x.globalAlpha = 1;
      const hood = arc(0, -20, 20, -Math.PI * 1.15, Math.PI * 0.15, 24); graphite(x, partial(hood, clamp(fk * 2)), 4, 'rgb(196,52,48)', 0.9, 51);
      if (fk > 0.35) { x.save(); x.beginPath(); x.arc(0, -20, 19, 0, TAU); x.clip(); for (let i = 0; i < 9; i++) graphite(x, [{ x: -24 + i * 6, y: 4 }, { x: -12 + i * 6, y: -44 }], 3.5, 'rgb(200,56,50)', 0.55 * clamp((fk - 0.35) * 4 - i * 0.2), 60 + i); x.restore(); }
      if (fk > 0.5) { x.save(); x.beginPath(); x.rect(-16, -6, 32, 40 * clamp((fk - 0.5) * 3)); x.clip(); for (let i = 0; i < 7; i++) graphite(x, [{ x: -18 + i * 6, y: 36 }, { x: -10 + i * 6, y: -6 }], 3.5, 'rgb(196,52,48)', 0.6, 80 + i); x.restore(); }
      if (fk > 0.75) { x.fillStyle = 'rgba(40,40,46,0.85)'; x.beginPath(); x.ellipse(2, -19, 11, 12, 0, 0, TAU); x.fill(); x.fillStyle = 'rgba(246,242,232,1)'; x.fillRect(-3, -24, 3, 7); x.fillRect(5, -24, 3, 7); }
      x.restore();
      if (fk < 1) tip = { x: 176 + Math.sin(fk * 40) * 12, y: 100 + Math.cos(fk * 33) * 14 };
    }
    return tip;
  }

  // ---------------------------------------------------------------- props
  function pencil(g, x, y, ang, roll, len) {          // a hexagonal pencil: facets that roll, sharpened wood cone, graphite tip
    len = len || 300; const w = 18;
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = 'rgba(30,18,8,0.35)'; g.filter = 'blur(6px)'; rr(g, -len + 10, -w / 2 + 12, len + 30, w, 6); g.fill(); g.filter = 'none';
    const fac = ['#3d404b', '#565a68', '#6d7282', '#4a4e5b', '#33363f'], k = ((roll || 0) % 1 + 1) % 1;
    for (let i = 0; i < 3; i++) { const c = fac[(Math.floor(k * 5) + i) % 5]; g.fillStyle = c; g.fillRect(-len, -w / 2 + i * w / 3, len - 2, w / 3 + 0.5); }
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(-len, -w / 2 + ((k * 3) % 1) * w * 0.6, len - 2, 2);
    g.fillStyle = '#9a8a6c'; rr(g, -len - 22, -w / 2, 24, w, 3); g.fill(); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 4; i++) g.fillRect(-len - 18 + i * 5, -w / 2, 1.5, w);   // ferrule
    g.fillStyle = '#d98f86'; rr(g, -len - 40, -w / 2 + 1, 20, w - 2, 5); g.fill();                                  // eraser
    const cone = g.createLinearGradient(0, -w / 2, 0, w / 2); cone.addColorStop(0, '#e8d3ad'); cone.addColorStop(1, '#bb9f74'); g.fillStyle = cone;
    g.beginPath(); g.moveTo(-2, -w / 2); g.quadraticCurveTo(14, -w * 0.32, 34, -3); g.lineTo(34, 3); g.quadraticCurveTo(14, w * 0.32, -2, w / 2); g.closePath(); g.fill();
    g.fillStyle = '#2b2c31'; g.beginPath(); g.moveTo(32, -3.4); g.lineTo(44, 0); g.lineTo(32, 3.4); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(34, -1.5, 6, 1);
    g.restore();
  }
  // his hand holding the pencil, its tip at (tx,ty) in page space. sleeve = hoodie colour [r,g,b]
  // built like a tripod grip seen from above: index finger on top of the pencil, thumb pinching from below, the rest curled under
  function hand(g, tx, ty, sleeve, t) {
    const pa = 0.3, ux = Math.cos(pa), uy = Math.sin(pa), at = (d, n) => ({ x: tx + ux * d - uy * n, y: ty + uy * d + ux * n });   // along / across the pencil
    const K = at(150, -28), W = at(250, 40), C = at(330, 70);                               // knuckle, wrist, cuff
    const thumbs = (x) => { capsule(x, at(170, 58), at(98, 40), 30, 24); x.fill(); capsule(x, at(98, 40), at(52, 16), 24, 18); x.fill(); };
    const fist = (x) => {
      x.beginPath(); const p0 = at(112, -40), p1 = at(200, -62), p2 = at(290, -20), p3 = at(300, 86), p4 = at(190, 92), p5 = at(120, 44);
      x.moveTo(p0.x, p0.y); x.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y); x.lineTo(p3.x, p3.y); x.quadraticCurveTo(p4.x, p4.y, p5.x, p5.y); x.closePath(); x.fill();
      for (let i = 0; i < 3; i++) { const c = at(112 + i * 6, 6 + i * 26); x.beginPath(); x.ellipse(c.x, c.y, 26, 20, pa, 0, TAU); x.fill(); }   // curled fingers under the pencil
      capsule(x, at(150, -30), at(78, -14), 27, 22); x.fill(); capsule(x, at(78, -14), at(30, -4), 22, 17); x.fill();                       // index finger, two joints, on top
    };
    const Wr = at(290, 22), da = 0.85, dx_ = Math.cos(da), dy_ = Math.sin(da), nx = -dy_, ny = dx_;     // the forearm runs off to the bottom right
    const sv = (d, n) => ({ x: Wr.x + dx_ * d + nx * n, y: Wr.y + dy_ * d + ny * n });
    const sleeveShape = (x) => { const a0 = sv(-10, -86), a1 = sv(380, -120), a2 = sv(900, -150), a3 = sv(900, 170), a4 = sv(380, 140), a5 = sv(-10, 88);
      x.beginPath(); x.moveTo(a0.x, a0.y); x.quadraticCurveTo(a1.x, a1.y, a2.x, a2.y); x.lineTo(a3.x, a3.y); x.quadraticCurveTo(a4.x, a4.y, a5.x, a5.y); x.quadraticCurveTo(sv(-30, 0).x, sv(-30, 0).y, a0.x, a0.y); x.fill(); };
    g.save(); g.fillStyle = 'rgba(40,24,10,0.32)'; g.filter = 'blur(12px)'; g.translate(36, 50); thumbs(g); fist(g); sleeveShape(g); g.restore();   // shadow on the paper
    g.fillStyle = '#16171d'; thumbs(g);
    pencil(g, tx + ux * 44, ty + uy * 44, pa + Math.PI, 0.35, 250);
    g.fillStyle = '#131419'; fist(g);
    const sg = g.createLinearGradient(sv(0, -120).x, sv(0, -120).y, sv(0, 160).x, sv(0, 160).y);              // fabric: lit on top, falling into shadow underneath
    sg.addColorStop(0, css(mixc(sleeve, [255, 220, 180], 0.18))); sg.addColorStop(0.45, css(sleeve)); sg.addColorStop(1, css(mixc(sleeve, [0, 0, 0], 0.55)));
    g.fillStyle = sg; sleeveShape(g);
    g.strokeStyle = css(mixc(sleeve, [0, 0, 0], 0.4)); g.lineWidth = 4; g.lineCap = 'round';                                    // a few folds
    for (const [d0, n0, d1, n1] of [[120, -40, 300, -10], [200, 60, 420, 90], [330, -80, 520, -40]]) { const q0 = sv(d0, n0), q1 = sv(d1, n1), qm = sv((d0 + d1) / 2, (n0 + n1) / 2 + 18); g.beginPath(); g.moveTo(q0.x, q0.y); g.quadraticCurveTo(qm.x, qm.y, q1.x, q1.y); g.stroke(); }
    g.fillStyle = css(mixc(sleeve, [0, 0, 0], 0.28));                                                                              // ribbed cuff
    const c0 = sv(-14, -88), c1 = sv(40, -92), c2 = sv(40, 92), c3 = sv(-14, 90); g.beginPath(); g.moveTo(c0.x, c0.y); g.lineTo(c1.x, c1.y); g.lineTo(c2.x, c2.y); g.lineTo(c3.x, c3.y); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 2; for (let i = 1; i < 7; i++) { const q0 = sv(-14 + i * 7.5, -88), q1 = sv(-14 + i * 7.5, 90); g.beginPath(); g.moveTo(q0.x, q0.y); g.lineTo(q1.x, q1.y); g.stroke(); }
    g.strokeStyle = 'rgba(255,206,150,0.38)'; g.lineWidth = 3; g.lineCap = 'round';                                         // lamp rim along the top of the hand
    const r0 = at(30, -16), r1 = at(110, -34), r2 = at(200, -60), r3 = at(270, -44); g.beginPath(); g.moveTo(r0.x, r0.y); g.quadraticCurveTo(r1.x, r1.y, r2.x, r2.y); g.lineTo(r3.x, r3.y); g.stroke();
    g.strokeStyle = 'rgba(255,206,150,0.16)'; g.lineWidth = 2; const k0 = at(80, -12), k1 = at(140, -8); g.beginPath(); g.moveTo(k0.x, k0.y); g.lineTo(k1.x, k1.y); g.stroke();   // the finger's edge
  }
  function draw(g, E, t, P, o) {
    o = o || {}; textures();
    const lamp = o.lamp == null ? 1 : o.lamp, cool = 1 - lamp;
    g.drawImage(woodCan, 0, 0);
    // light: a warm pool from the lamp (top right); cold grey daylight when the lamp is off
    g.fillStyle = `rgba(12,14,20,${0.35 * cool})`; g.fillRect(0, 0, 1920, 1080);
    glow(g, 1450, 160, 1300, WARM, 0.32 * lamp, 'screen'); glow(g, 900, 600, 1100, [160, 170, 190], 0.10 * cool, 'screen');

    g.save(); g.translate(960 + (o.dx || 0), 560 + (o.dy || 0)); g.rotate(-0.045); const z = o.zoom || 1; g.scale(z, z);
    // cast shadow of the book, page-stack edges, the cover peeking out
    g.save(); g.filter = 'blur(18px)'; g.fillStyle = 'rgba(10,6,2,0.55)'; rr(g, -616, -380, 1260, 816, 18); g.fill(); g.restore();
    g.fillStyle = '#2b1f1a'; rr(g, -636, -414, 1272, 834, 14); g.fill();
    for (let i = 5; i >= 1; i--) { g.fillStyle = i % 2 ? '#cfc8b6' : '#e2dccb'; rr(g, -620 - i * 0.6, -400 + i * 1.6, 1240 + i * 1.2, 800 + i * 0.6, 8); g.fill(); }
    // the paper
    const pg = g.createLinearGradient(-620, 0, 620, 0); pg.addColorStop(0, '#e4ddca'); pg.addColorStop(0.12, '#efe9d9'); pg.addColorStop(0.45, '#ebe4d2'); pg.addColorStop(0.5, '#bdb5a0'); pg.addColorStop(0.55, '#ebe4d2'); pg.addColorStop(0.9, '#f1ebdc'); pg.addColorStop(1, '#e2dac6');
    g.fillStyle = pg; rr(g, -620, -400, 1240, 800, 8); g.fill();
    g.save(); rr(g, -620, -400, 1240, 800, 8); g.clip();
    g.globalCompositeOperation = 'multiply'; g.fillStyle = g.createPattern(paperTile, 'repeat'); g.fillRect(-620, -400, 1240, 800); g.globalCompositeOperation = 'source-over';
    const gut = g.createLinearGradient(-140, 0, 140, 0); gut.addColorStop(0, 'rgba(60,48,30,0)'); gut.addColorStop(0.42, 'rgba(60,48,30,0.16)'); gut.addColorStop(0.5, 'rgba(40,30,18,0.42)'); gut.addColorStop(0.58, 'rgba(60,48,30,0.16)'); gut.addColorStop(1, 'rgba(60,48,30,0)');
    g.fillStyle = gut; g.fillRect(-140, -400, 280, 800);
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(-250, -400, 60, 800); g.fillRect(190, -400, 60, 800);   // the pages bow up off the spine and catch the light
    // the drawing: graphite and coloured pencil on a separate layer, broken up by the paper tooth, multiplied into the paper
    const x = layer.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, PW, PH); x.translate(PW / 2, PH / 2);
    const tip = drawPlan(x, P, o.seed || 0);
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'destination-out'; x.globalAlpha = 0.55; x.fillStyle = x.createPattern(toothTile, 'repeat'); x.fillRect(0, 0, PW, PH); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    g.globalCompositeOperation = 'multiply'; g.drawImage(layer, -PW / 2, -PH / 2); g.globalCompositeOperation = 'source-over';
    if (o.ring) { g.strokeStyle = 'rgba(120,80,40,0.16)'; g.lineWidth = 7; g.beginPath(); g.ellipse(430, 250, 82, 78, 0.2, 0.3, TAU - 0.5); g.stroke(); }   // an old mug ring
    // light falloff across the page: the lamp is up and to the right
    const lf = g.createLinearGradient(-620, 400, 620, -400); lf.addColorStop(0, `rgba(30,20,10,${0.22 + 0.1 * cool})`); lf.addColorStop(1, 'rgba(255,230,190,0.0)'); g.fillStyle = lf; g.fillRect(-620, -400, 1240, 800);
    g.restore();
    if (o.pencilRest) pencil(g, o.pencilRest.x, o.pencilRest.y, o.pencilRest.ang || -0.05, o.pencilRest.roll || 0);
    if (o.hand && tip) { const hx = tip.x + (o.jitter ? Math.sin(t * 31) * 1.2 : 0), hy = tip.y + (o.jitter ? Math.cos(t * 27) * 1.2 : 0); hand(g, hx, hy, o.sleeve || GREY, t); }
    else if (o.hand && o.handRest) hand(g, o.handRest.x, o.handRest.y, o.sleeve || GREY, t);
    g.restore();
    if (o.mug) mug(g, 1580, 860);
    SET.vignette(g, E, 0.5); drawGrain(g, 1920, 1080, t, 0.09);
  }
  function mug(g, x, y) {                              // a ceramic mug, gone cold: no steam, a dull skin on the coffee
    g.save(); g.filter = 'blur(14px)'; g.fillStyle = 'rgba(8,5,2,0.55)'; g.beginPath(); g.ellipse(x + 40, y + 120, 130, 40, 0, 0, TAU); g.fill(); g.restore();
    g.strokeStyle = '#3c4150'; g.lineWidth = 24; g.beginPath(); g.arc(x + 100, y + 30, 50, -1.25, 1.25); g.stroke();
    const b = g.createLinearGradient(x - 90, 0, x + 90, 0); b.addColorStop(0, '#2a2e39'); b.addColorStop(0.3, '#4d5364'); b.addColorStop(0.55, '#3a3f4d'); b.addColorStop(1, '#22252e');
    g.fillStyle = b; g.beginPath(); g.moveTo(x - 90, y - 70); g.lineTo(x - 82, y + 104); g.quadraticCurveTo(x, y + 126, x + 82, y + 104); g.lineTo(x + 90, y - 70); g.closePath(); g.fill();
    g.fillStyle = '#545a6b'; g.beginPath(); g.ellipse(x, y - 70, 90, 20, 0, 0, TAU); g.fill();
    g.fillStyle = '#2a1d14'; g.beginPath(); g.ellipse(x, y - 66, 78, 15, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(120,96,72,0.4)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x - 6, y - 66, 60, 10, 0, 0.2, 2.6); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x - 54, y - 50, 14, 140);
  }
  return { draw, pencil };
})();
