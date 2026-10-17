// scroll.js — the phone, seen from the front, with a feed that actually scrolls.
// Physics: a swipe = thumb touches (press), drags the content with it for ~half the distance, lets go; the rest is a fling that
// decelerates and settles into the next post with a small damped overshoot. A swipe past the end of the feed (bounce:true)
// moves the content only a little against resistance and springs back: the feed has a floor.
// All functions are pure functions of t. Swipe list: [{ t, n = posts to advance, d = drag seconds, bounce }]
const SCR = (() => {
  const ITEM = 0.92;                                   // one post = 92% of the screen height

  function pos(t, swipes, start) {
    let p = start || 0;
    for (const s of swipes) {
      const lt = t - s.t, d = s.d || 0.24, n = s.n == null ? 1 : s.n;
      if (lt <= 0) continue;
      if (s.bounce) { p += lt < d ? 0.16 * n * smooth(lt / d) : 0.16 * n * (1 - spring(lt - d, 180, 13)); continue; }
      const drag = 0.3 * n * smooth(Math.min(1, lt / d));            // content follows the finger 1:1 while touching...
      p += lt < d ? drag : 0.3 * n + 0.7 * n * spring(lt - d, 150, 19);   // ...then the fling carries it the rest of the way
    }
    return p;
  }
  // thumb tip in phone-normalised coords (0..1), press 0..1
  function thumb(t, swipes) {
    const rest = { x: 0.74, y: 0.84 }; let x = rest.x + Math.sin(t * 1.3) * 0.006, y = rest.y + Math.sin(t * 0.9) * 0.008, press = 0;
    for (const s of swipes) {
      const lt = t - s.t, d = s.d || 0.24, n = s.bounce ? 0.35 : Math.min(1, s.n == null ? 1 : s.n);
      const sx = 0.62, sy = 0.74, ey = sy - 0.28 * n;
      if (lt < -0.2 || lt > d + 0.55) continue;
      if (lt < 0) { const k = smooth((lt + 0.2) / 0.2); x = lerp(rest.x, sx, k); y = lerp(rest.y, sy, k); press = k * k; }
      else if (lt < d) { const k = smooth(lt / d); x = lerp(sx, sx - 0.05, k); y = lerp(sy, ey, k); press = 1; }
      else if (lt < d + 0.12) { const k = (lt - d) / 0.12; x = sx - 0.05 - 0.01 * k; y = ey - 0.06 * easeOut(k); press = 1 - k; }
      else { const k = smooth((lt - d - 0.12) / 0.43); x = lerp(sx - 0.06, rest.x, k); y = lerp(ey - 0.06, rest.y, k); press = 0; }
    }
    return { x, y, press };
  }

  // ---------------------------------------------------------------- feed items (drawn in screen-local px, w x h of the screen)
  const AV = ['#e36a8a', '#4aa8ff', '#f2b94b', '#7be07a', '#a07bf0', '#ff8a5a', '#5ad6c8', '#f07bd0'];
  function post(g, i, w, h, t) {
    const pad = w * 0.045, ih = h * ITEM;
    g.fillStyle = '#0d1018'; g.fillRect(0, 0, w, ih);
    // header
    g.fillStyle = AV[((i % 8) + 8) % 8]; g.beginPath(); g.arc(pad + w * 0.045, pad + w * 0.045, w * 0.045, 0, TAU); g.fill();
    g.fillStyle = '#c9d2e6'; rr(g, pad * 2 + w * 0.09, pad + w * 0.02, w * (0.28 + 0.1 * ((i * 37) % 3) / 2), w * 0.03, w * 0.015); g.fill();
    g.fillStyle = '#5c6680'; rr(g, pad * 2 + w * 0.09, pad + w * 0.06, w * 0.16, w * 0.022, w * 0.011); g.fill();
    // media: one of the eight tiny worlds
    const my = pad * 2 + w * 0.09, mh = ih * 0.66;
    FEED.worldCard(g, i, pad, my, w - pad * 2, mh, t + i * 1.7, w * 0.04);
    // action row (generic outline glyphs) and caption bars
    const ay = my + mh + w * 0.07; g.strokeStyle = '#c9d2e6'; g.lineWidth = Math.max(1, w * 0.012); g.lineJoin = 'round';
    const hx = pad + w * 0.035, hr = w * 0.03; g.beginPath(); g.moveTo(hx, ay + hr * 0.9); g.bezierCurveTo(hx + hr * 1.6, ay - hr * 0.2, hx + hr * 0.7, ay - hr * 1.2, hx, ay - hr * 0.4); g.bezierCurveTo(hx - hr * 0.7, ay - hr * 1.2, hx - hr * 1.6, ay - hr * 0.2, hx, ay + hr * 0.9); g.stroke();
    g.beginPath(); g.arc(hx + w * 0.11, ay, hr, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(hx + w * 0.19, ay + hr); g.lineTo(hx + w * 0.22 + hr, ay - hr); g.lineTo(hx + w * 0.19 + hr * 0.4, ay); g.closePath(); g.stroke();
    g.fillStyle = '#7d879e'; rr(g, pad, ay + w * 0.06, w * 0.62, w * 0.022, w * 0.011); g.fill(); rr(g, pad, ay + w * 0.1, w * 0.4, w * 0.022, w * 0.011); g.fill();
    g.fillStyle = '#1a1f2c'; g.fillRect(0, ih - 2, w, 2);
  }
  function floorItem(g, w, h) {                         // the end of tonight's feed: a wooden floor with a line on it
    const ih = h * ITEM; g.fillStyle = '#1a1410'; g.fillRect(0, 0, w, ih);
    for (let k = 0; k < 9; k++) { const y = ih * 0.38 + k * ih * 0.07; g.fillStyle = k % 2 ? '#5b4636' : '#644d3b'; g.fillRect(0, y, w, ih * 0.068); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(((k * 97) % 70) / 100 * w, y, 2, ih * 0.068); }
    const lg = g.createLinearGradient(0, ih * 0.38, 0, ih); lg.addColorStop(0, 'rgba(0,0,0,0.55)'); lg.addColorStop(0.4, 'rgba(0,0,0,0)'); g.fillStyle = lg; g.fillRect(0, ih * 0.38, w, ih * 0.62);
    g.strokeStyle = 'rgba(255,214,150,0.9)'; g.lineWidth = Math.max(1.5, w * 0.012); g.shadowColor = 'rgba(255,200,130,0.9)'; g.shadowBlur = w * 0.05; g.beginPath(); g.moveTo(w * 0.1, ih * 0.38); g.lineTo(w * 0.9, ih * 0.38); g.stroke(); g.shadowBlur = 0;
    g.fillStyle = '#f3dcb4'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `600 ${Math.round(w * 0.1)}px ${TXT.UI}`; g.fillText('11:30', w / 2, ih * 0.22);
    g.font = `500 ${Math.round(w * 0.055)}px ${TXT.UI}`; g.fillStyle = '#c9b494'; g.fillText("That's the bottom for tonight.", w / 2, ih * 0.3);
  }

  // a thumb: two tapered segments with a knuckle, rooted at B, tip at T, sized by phone width w; press 0..1 (contact shadow)
  function finger(g, B, T, w, press) {
    const lift = 1 - press, dx = T.x - B.x, dy = T.y - B.y, L = Math.hypot(dx, dy) || 1;
    const J = { x: (B.x + T.x) / 2 + (dy / L) * w * 0.07, y: (B.y + T.y) / 2 - (dx / L) * w * 0.07 };
    g.fillStyle = `rgba(0,0,0,${0.22 + 0.25 * press})`; g.beginPath(); g.ellipse(T.x + w * 0.015 + lift * w * 0.05, T.y + w * 0.03 + lift * w * 0.06, w * 0.085 + lift * w * 0.04, w * 0.1, 0.5, 0, TAU); g.fill();
    g.fillStyle = '#0e0e13'; g.strokeStyle = 'rgba(120,180,255,0.32)'; g.lineWidth = Math.max(1, w * 0.01);
    capsule(g, B, J, w * 0.15, w * 0.12); g.fill(); g.stroke(); capsule(g, J, T, w * 0.12, w * (0.095 + 0.01 * lift)); g.fill(); g.stroke();
    g.beginPath(); g.arc(J.x, J.y, w * 0.118, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(160,200,255,0.18)'; g.lineWidth = Math.max(1, w * 0.008); g.beginPath(); g.arc(T.x - (dx / L) * w * 0.035, T.y - (dy / L) * w * 0.035, w * 0.05, Math.atan2(dy, dx) - 1.2, Math.atan2(dy, dx) + 1.2); g.stroke();   // nail
  }
  // ---------------------------------------------------------------- the phone
  // o = { swipes, start, floorAt (index of the floor item), dot, thumb:true, hand:true, glow, dim, clock:'1:13', battery }
  function phone(g, cx, cy, w, ang, t, o) {
    o = o || {}; const h = w * 2.05, sw = o.swipes || [];
    const sx = -w / 2 + w * 0.04, sy = -h / 2 + w * 0.04, SW = w * 0.92, SH = h - w * 0.08;
    const p = pos(t, sw, o.start), v = (p - pos(t - 1 / 60, sw, o.start)) * 60;
    g.save(); g.translate(cx, cy); g.rotate(ang || 0);
    if (o.glow !== 0) glow(g, 0, 0, w * 2.4, [70, 150, 255], 0.2 * (o.glow == null ? 1 : o.glow) * (1 - (o.dim || 0)), 'screen');
    // hand behind the phone
    if (o.hand) {                                       // right hand: palm behind the lower half, fingertips curling round the left edge
      g.fillStyle = '#0c0c10'; g.beginPath(); g.ellipse(w * 0.28, h * 0.36, w * 0.42, h * 0.27, -0.35, 0, TAU); g.fill();
      for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(-w * 0.5, -h * 0.02 + k * h * 0.105, w * 0.085, h * 0.045, 0.15, 0, TAU); g.fill(); }
    }
    // body
    const bg = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); bg.addColorStop(0, '#2a2e38'); bg.addColorStop(0.5, '#0d0f14'); bg.addColorStop(1, '#1d2028');
    g.fillStyle = bg; rr(g, -w / 2, -h / 2, w, h, w * 0.15); g.fill();
    g.strokeStyle = 'rgba(160,180,220,0.25)'; g.lineWidth = Math.max(1, w * 0.012); g.stroke();
    g.fillStyle = '#1b1e26'; g.fillRect(w / 2 - 1, -h * 0.22, w * 0.02, h * 0.12); g.fillRect(-w / 2 - w * 0.015, -h * 0.28, w * 0.02, h * 0.08);
    // screen
    g.save(); rr(g, sx, sy, SW, SH, w * 0.11); g.clip(); g.translate(sx, sy);
    g.fillStyle = '#080a10'; g.fillRect(0, 0, SW, SH);
    const ih = SH * ITEM, top = SH * 0.075, drawCol = (off, alpha) => {
      g.save(); g.globalAlpha = alpha;
      const first = Math.floor(p) - 1;
      for (let i = first; i <= first + 3; i++) { const y = top + (i - p) * ih + off; if (y > SH || y + ih < 0) continue; g.save(); g.translate(0, y); if (o.floorAt != null && i >= o.floorAt) floorItem(g, SW, SH); else post(g, i + (o.seed || 0), SW, SH, t); g.restore(); }
      g.restore();
    };
    if (o.content) o.content(g, SW, SH, t); else drawCol(0, 1);
    if (!o.content && Math.abs(v) > 1.0) { const m = Math.min(1, (Math.abs(v) - 1.0) / 3); for (const [f, a] of [[-0.012, 0.16], [0.012, 0.12], [-0.024, 0.08]]) drawCol(Math.sign(v) * ih * f * m, a * m); }
    // status bar
    g.fillStyle = 'rgba(8,10,16,0.92)'; g.fillRect(0, 0, SW, top);
    g.fillStyle = '#e6ecfa'; g.font = `600 ${Math.max(6, SW * 0.07)}px ${TXT.UI}`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(o.clock || '', SW * 0.09, top * 0.55);
    g.fillStyle = '#000'; rr(g, SW * 0.36, top * 0.22, SW * 0.28, top * 0.56, top * 0.28); g.fill();
    const bat = o.battery == null ? 0.62 : o.battery; g.strokeStyle = '#e6ecfa'; g.lineWidth = Math.max(0.8, SW * 0.008); rr(g, SW * 0.8, top * 0.36, SW * 0.11, top * 0.36, 2); g.stroke(); g.fillStyle = bat < 0.1 ? '#ff5a5a' : '#e6ecfa'; g.fillRect(SW * 0.81, top * 0.42, SW * 0.09 * Math.max(0.06, bat), top * 0.24);
    // home bar, notification dot
    g.fillStyle = 'rgba(230,236,250,0.7)'; rr(g, SW * 0.34, SH - SH * 0.022, SW * 0.32, SH * 0.008, SH * 0.004); g.fill();
    if (o.dot) { const pp = 1 + 0.18 * Math.sin(t * 9); g.fillStyle = 'rgba(74,168,255,0.28)'; g.beginPath(); g.arc(SW * 0.86, SH * 0.9, SW * 0.11 * pp * o.dot, 0, TAU); g.fill(); g.fillStyle = '#4aa8ff'; g.beginPath(); g.arc(SW * 0.86, SH * 0.9, SW * 0.05 * pp * o.dot, 0, TAU); g.fill(); }
    for (const lt0 of (o.likes || [])) {                // a heart pops on the post: the small reward
      const u = (t - lt0) / 0.62; if (u < 0 || u > 1) continue;
      const sc = SW * 0.16 * (u < 0.25 ? spring(u * 1.6, 260, 12) : 1) * (1 + 0.15 * u), a = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3, hx = SW * 0.5, hy = SH * 0.36 - u * SH * 0.04;
      g.save(); g.globalAlpha = a; g.translate(hx, hy); g.shadowColor = 'rgba(255,80,120,0.8)'; g.shadowBlur = SW * 0.08; g.fillStyle = '#ff4f7b';
      g.beginPath(); g.moveTo(0, sc * 0.9); g.bezierCurveTo(sc * 1.6, -sc * 0.2, sc * 0.7, -sc * 1.2, 0, -sc * 0.4); g.bezierCurveTo(-sc * 0.7, -sc * 1.2, -sc * 1.6, -sc * 0.2, 0, sc * 0.9); g.fill(); g.restore();
      for (let k = 0; k < 8; k++) { const an = k / 8 * TAU, d = SW * (0.18 + 0.2 * easeOut(u)); g.fillStyle = `rgba(255,170,190,${(1 - u) * 0.9})`; g.beginPath(); g.arc(hx + Math.cos(an) * d, hy + Math.sin(an) * d, SW * 0.012 * (1 - u) + 0.5, 0, TAU); g.fill(); }
    }
    if (o.banner) {                                     // a notification drops in from the top: frosted card, app glyph, one line
      const k = clamp((t - o.banner.t) / 0.45), e = k < 1 ? spring(k * 0.9, 220, 16) : 1, by = lerp(-SH * 0.12, top + SH * 0.012, e);
      g.save(); g.globalAlpha = clamp(k * 3); g.fillStyle = 'rgba(38,44,60,0.94)'; rr(g, SW * 0.04, by, SW * 0.92, SH * 0.085, SW * 0.05); g.fill();
      g.fillStyle = '#4aa8ff'; rr(g, SW * 0.08, by + SH * 0.018, SW * 0.1, SW * 0.1, SW * 0.025); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(SW * 0.13, by + SH * 0.018 + SW * 0.05, SW * 0.02, 0, TAU); g.fill();
      g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#eef2fb'; g.font = `600 ${SW * 0.052}px ${TXT.UI}`; g.fillText(o.banner.title, SW * 0.22, by + SH * 0.03);
      g.fillStyle = '#aab3c8'; g.font = `500 ${SW * 0.046}px ${TXT.UI}`; g.fillText(o.banner.text, SW * 0.22, by + SH * 0.058); g.restore();
    }
    if (o.dim) { g.fillStyle = `rgba(0,0,0,${o.dim})`; g.fillRect(0, 0, SW, SH); }
    // touch ripple under the thumb
    const th = thumb(t, sw);
    if (o.thumb !== false && th.press > 0.05) { g.fillStyle = `rgba(255,255,255,${0.12 * th.press})`; g.beginPath(); g.arc(th.x * SW, th.y * SH, SW * 0.13 * th.press, 0, TAU); g.fill(); }
    g.restore();
    // glass reflection
    g.save(); rr(g, sx, sy, SW, SH, w * 0.11); g.clip(); const rf = g.createLinearGradient(-w / 2, -h / 2, w * 0.2, h * 0.1); rf.addColorStop(0, 'rgba(255,255,255,0.08)'); rf.addColorStop(0.5, 'rgba(255,255,255,0.0)'); g.fillStyle = rf; g.fillRect(-w / 2, -h / 2, w, h); g.restore();
    if (o.thumb !== false) {                            // the thumb: two tapered segments with a knuckle, rooted in the palm
      const tx = sx + th.x * SW, ty = sy + th.y * SH, lift = 1 - th.press, B = { x: w * 0.56, y: h * 0.4 };
      finger(g, B, { x: tx + lift * w * 0.03, y: ty + lift * w * 0.02 }, w, th.press);
    }
    g.restore();
    return { p, v };
  }
  // the phone in a character's hand in a medium/wide shot: seen at three-quarters (screen turned toward his face),
  // with the real feed scrolling on it in sync with his thumb. w = width in world px; a = screen brightness 0..1.
  function held(g, x, y, ang, t, o) {
    o = o || {}; const w = o.w || 30, a = o.a == null ? 1 : o.a, sq = o.squash || 0.5, h = w * 2.05;
    g.save(); g.translate(x, y); g.rotate(ang || 0);
    g.fillStyle = '#060709'; rr(g, -w * sq / 2 + w * 0.12, -h / 2 + 1, w * sq, h, w * 0.12); g.fill();          // the back edge
    g.transform(sq, -0.08, 0, 1, 0, 0);
    if (a > 0.02) phone(g, 0, 0, w, 0, t, { swipes: o.swipes || [], start: o.start, floorAt: o.floorAt, thumb: o.grip !== false, hand: o.grip !== false, glow: 0, dim: 1 - a, clock: '', seed: o.seed, likes: o.likes });
    else { g.fillStyle = '#0a0b0f'; rr(g, -w / 2, -h / 2, w, h, w * 0.15); g.fill(); g.fillStyle = 'rgba(160,180,220,0.12)'; rr(g, -w / 2 + 2, -h / 2 + 2, w - 4, h * 0.4, w * 0.12); g.fill(); }
    g.restore();
  }
  // a periodic thumb rhythm as a swipe list: one swipe every `period` s from t0 to t1
  const every = (t0, t1, period, extra) => { const L = []; for (let x = t0; x < t1; x += period) L.push(Object.assign({ t: x }, extra || {})); return L; };
  return { pos, thumb, phone, held, every, finger, ITEM };
})();
