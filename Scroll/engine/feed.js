// feed.js — everything that lives on the phone: eight tiny original "worlds", the phone UI, the slot-machine lever.
// All drawing is in a local rect (0,0,w,h) and is a pure function of t. No real apps, logos or interfaces.
const FEED = (() => {
  const BLUE = [74, 168, 255];

  // ----------------------------------------------------------------- eight tiny worlds (portrait cards, nominal 300x540)
  const WORLDS = [
    function catVacuum(g, w, h, t) {           // a cat riding a robot vacuum
      const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#2fb7b0'); bg.addColorStop(1, '#1e7f86'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = '#d9c9a4'; g.fillRect(0, h * 0.7, w, h * 0.3);
      const x = w * (0.5 + 0.28 * Math.sin(t * 2.6)), y = h * 0.7, dir = Math.cos(t * 2.6) > 0 ? 1 : -1;
      g.fillStyle = '#2a2d36'; g.beginPath(); g.ellipse(x, y, 70, 16, 0, 0, TAU); g.fill(); g.fillStyle = '#ff6a5a'; g.beginPath(); g.arc(x + dir * 40, y - 3, 4, 0, TAU); g.fill();
      g.save(); g.translate(x, y - 14 + Math.sin(t * 9) * 2); g.scale(dir, 1);
      g.fillStyle = '#f2a04a'; g.beginPath(); g.ellipse(0, -32, 34, 26, 0, 0, TAU); g.fill();
      g.beginPath(); g.arc(26, -56, 20, 0, TAU); g.fill(); g.beginPath(); g.moveTo(14, -70); g.lineTo(18, -92); g.lineTo(28, -72); g.fill(); g.beginPath(); g.moveTo(30, -72); g.lineTo(40, -90); g.lineTo(42, -64); g.fill();
      g.strokeStyle = '#f2a04a'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(-30, -34); g.quadraticCurveTo(-60, -50 + Math.sin(t * 7) * 14, -52, -84); g.stroke();
      g.fillStyle = '#16181f'; g.beginPath(); g.arc(32, -58, 3.4, 0, TAU); g.arc(21, -58, 3.4, 0, TAU); g.fill(); g.restore();
    },
    function pancake(g, w, h, t) {             // flipping a pancake
      g.fillStyle = '#f2b94b'; g.fillRect(0, 0, w, h); g.fillStyle = '#e0912e'; g.fillRect(0, h * 0.68, w, h * 0.32);
      const k = (t * 1.3) % 1, py = h * 0.55 - Math.sin(k * Math.PI) * h * 0.34, rot = k * TAU * 2;
      g.save(); g.translate(w * 0.5, h * 0.62 + Math.sin(k * Math.PI) * 0); g.rotate(-0.15 * Math.sin(k * 6));
      g.fillStyle = '#2b2d34'; g.beginPath(); g.ellipse(0, 0, 76, 14, 0, 0, TAU); g.fill(); g.fillRect(70, -5, 90, 10); g.restore();
      g.save(); g.translate(w * 0.5, py); g.scale(1, Math.abs(Math.cos(rot)) * 0.8 + 0.18); g.fillStyle = '#c98a45'; g.beginPath(); g.arc(0, 0, 54, 0, TAU); g.fill(); g.fillStyle = '#e6b06c'; g.beginPath(); g.arc(0, -4, 46, 0, TAU); g.fill(); g.restore();
      for (let i = 0; i < 5; i++) { const fx = w * 0.5 - 60 + i * 30, fh = 22 + 14 * Math.sin(t * 12 + i * 2); g.fillStyle = i % 2 ? '#ff6a2e' : '#ffd23e'; g.beginPath(); g.moveTo(fx - 10, h * 0.72); g.quadraticCurveTo(fx, h * 0.72 - fh, fx + 10, h * 0.72); g.fill(); }
    },
    function argument(g, w, h, t) {            // two figures, two angry bubbles
      g.fillStyle = '#7b4bd6'; g.fillRect(0, 0, w, h); g.fillStyle = '#5a30b0'; g.fillRect(0, h * 0.72, w, h * 0.28);
      for (const s of [-1, 1]) {
        const x = w * 0.5 + s * 76, sh = Math.sin(t * 22 + s) * 2.4;
        g.fillStyle = '#16181f'; g.beginPath(); g.arc(x + sh, h * 0.58, 30, 0, TAU); g.fill(); g.fillRect(x - 24 + sh, h * 0.58 + 26, 48, 96);
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x + sh - s * 8, h * 0.58 - 2, 5, 8, 0, 0, TAU); g.ellipse(x + sh - s * 22, h * 0.58 - 2, 5, 8, 0, 0, TAU); g.fill();
        const by = h * 0.26 + (s > 0 ? 38 : 0) + Math.sin(t * 6 + s) * 4; g.fillStyle = '#fff'; rr(g, x - 54, by, 108, 58, 18); g.fill();
        g.strokeStyle = '#e24a5a'; g.lineWidth = 6; g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i < 6; i++) g.lineTo(x - 40 + i * 16, by + 29 + (i % 2 ? -14 : 14)); g.stroke();
      }
    },
    function houseTour(g, w, h, t) {           // a front door opening on a warm room
      g.fillStyle = '#7fc4f0'; g.fillRect(0, 0, w, h); g.fillStyle = '#6ab25a'; g.fillRect(0, h * 0.74, w, h * 0.26);
      const z = 1 + 0.12 * Math.sin(t * 2); g.save(); g.translate(w / 2, h * 0.62); g.scale(z, z);
      g.fillStyle = '#f3e1c4'; g.fillRect(-100, -120, 200, 150); g.fillStyle = '#c85a4a'; g.beginPath(); g.moveTo(-124, -118); g.lineTo(0, -214); g.lineTo(124, -118); g.closePath(); g.fill();
      const open = clamp(0.5 + 0.5 * Math.sin(t * 3 - 1)); g.fillStyle = '#ffd98a'; g.fillRect(-28, -56, 56, 86);
      g.fillStyle = '#7a4a2e'; g.beginPath(); g.moveTo(-28, -56); g.lineTo(-28 + 56 * (1 - open) * 0.5, -50); g.lineTo(-28 + 56 * (1 - open) * 0.5, 36); g.lineTo(-28, 30); g.closePath(); g.fill();
      g.fillStyle = '#9fd6f5'; g.fillRect(-84, -86, 40, 36); g.fillRect(44, -86, 40, 36); g.restore();
    },
    function diet(g, w, h, t) {                // a salad and a scale
      g.fillStyle = '#3fbf72'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a9a5a'; g.fillRect(0, h * 0.7, w, h * 0.3);
      g.fillStyle = '#f4f4ef'; g.beginPath(); g.ellipse(w / 2, h * 0.52, 96, 30, 0, 0, TAU); g.fill();
      const r = rng(8); for (let i = 0; i < 14; i++) { g.fillStyle = ['#87d957', '#e24a3a', '#f5d54a', '#4aa84a'][i % 4]; g.beginPath(); g.arc(w / 2 - 70 + r() * 140, h * 0.5 - r() * 22, 12 + r() * 8, 0, TAU); g.fill(); }
      const fy = Math.sin(t * 5) * 6; g.strokeStyle = '#d9d9de'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(w / 2 + 60, h * 0.4 + fy); g.lineTo(w / 2 + 130, h * 0.18 + fy); g.stroke();
      g.fillStyle = '#16181f'; rr(g, w / 2 - 80, h * 0.78, 160, 44, 12); g.fill(); g.fillStyle = '#dff7e8'; g.font = `bold ${Math.round(h * 0.06)}px "DejaVu Sans Mono"`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((74 - Math.floor((t * 3) % 6)) + '.' + Math.floor((t * 17) % 10), w / 2, h * 0.78 + 22);
    },
    function dance(g, w, h, t) {               // a tiny dancer and floating notes
      const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#d63a9a'); bg.addColorStop(1, '#6a3ad6'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
      const b = Math.sin(t * 9), cx = w / 2, cy = h * 0.62; g.strokeStyle = '#16181f'; g.fillStyle = '#16181f'; g.lineWidth = 12; g.lineCap = 'round';
      g.beginPath(); g.arc(cx + b * 4, cy - 96, 24, 0, TAU); g.fill(); g.beginPath(); g.moveTo(cx, cy - 70); g.lineTo(cx + b * 6, cy + 10); g.stroke();
      g.beginPath(); g.moveTo(cx, cy - 56); g.lineTo(cx - 54, cy - 90 + b * 30); g.moveTo(cx, cy - 56); g.lineTo(cx + 54, cy - 90 - b * 30); g.stroke();
      g.beginPath(); g.moveTo(cx + b * 6, cy + 10); g.lineTo(cx - 36 + b * 10, cy + 84); g.moveTo(cx + b * 6, cy + 10); g.lineTo(cx + 36 - b * 10, cy + 84); g.stroke();
      for (let i = 0; i < 4; i++) { const k = (t * 0.7 + i * 0.25) % 1; g.fillStyle = `rgba(255,255,255,${1 - k})`; g.font = `${Math.round(h * 0.07)}px "DejaVu Sans"`; g.fillText('♪', w * (0.2 + i * 0.2), h * 0.4 - k * h * 0.3); }
    },
    function wedding(g, w, h, t) {             // two figures under an arch, confetti
      g.fillStyle = '#f7d9e4'; g.fillRect(0, 0, w, h); g.fillStyle = '#e9b9cc'; g.fillRect(0, h * 0.72, w, h * 0.28);
      g.strokeStyle = '#fff'; g.lineWidth = 14; g.beginPath(); g.arc(w / 2, h * 0.5, 104, Math.PI, 0); g.stroke(); g.beginPath(); g.moveTo(w / 2 - 104, h * 0.5); g.lineTo(w / 2 - 104, h * 0.74); g.moveTo(w / 2 + 104, h * 0.5); g.lineTo(w / 2 + 104, h * 0.74); g.stroke();
      for (const s of [-1, 1]) { const x = w / 2 + s * 32; g.fillStyle = '#16181f'; g.beginPath(); g.arc(x, h * 0.58, 22, 0, TAU); g.fill(); g.fillRect(x - 17, h * 0.58 + 18, 34, 78); }
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(w / 2 + 12, h * 0.72); g.lineTo(w / 2 + 52, h * 0.72); g.lineTo(w / 2 + 40, h * 0.58); g.closePath(); g.fill();
      const r = rng(3); for (let i = 0; i < 40; i++) { const k = (t * (0.4 + r() * 0.5) + r()) % 1; g.fillStyle = ['#ff5a7a', '#ffd23e', '#4aa8ff', '#7be07a'][i % 4]; g.fillRect(r() * w, k * h, 8, 14); }
    },
    function rocket(g, w, h, t) {              // a rocket and streaking stars
      g.fillStyle = '#0d1b4a'; g.fillRect(0, 0, w, h); const r = rng(12);
      for (let i = 0; i < 28; i++) { const k = (t * (0.8 + r()) + r()) % 1, x = r() * w; g.fillStyle = `rgba(255,255,255,${0.9 - k * 0.5})`; g.fillRect(x, k * h, 3, 10 + r() * 24); }
      g.save(); g.translate(w / 2 + Math.sin(t * 30) * 2, h * 0.5);
      g.fillStyle = '#ff7a2e'; g.beginPath(); g.moveTo(-18, 70); g.quadraticCurveTo(0, 150 + Math.sin(t * 24) * 20, 18, 70); g.fill();
      g.fillStyle = '#f2f2f6'; g.beginPath(); g.moveTo(0, -100); g.quadraticCurveTo(46, -30, 34, 76); g.lineTo(-34, 76); g.quadraticCurveTo(-46, -30, 0, -100); g.fill();
      g.fillStyle = '#e24a5a'; g.beginPath(); g.moveTo(-34, 40); g.lineTo(-62, 90); g.lineTo(-34, 76); g.fill(); g.beginPath(); g.moveTo(34, 40); g.lineTo(62, 90); g.lineTo(34, 76); g.fill();
      g.fillStyle = '#4aa8ff'; g.beginPath(); g.arc(0, -20, 15, 0, TAU); g.fill(); g.restore();
    }
  ];
  const worldCard = (g, i, x, y, w, h, t, r) => { g.save(); rr(g, x, y, w, h, r == null ? 28 : r); g.clip(); g.translate(x, y); g.scale(w / 300, h / 540); WORLDS[((i % 8) + 8) % 8](g, 300, 540, t); g.restore(); };

  // ----------------------------------------------------------------- the phone UI (portrait w x h, screen only)
  // o = { card: world index, k: 0..1 scroll slide between cards, dot: notification pulse 0..1, dim: 0..1 (battery), overlay: 'screentime' }
  function screen(g, w, h, t, o) {
    o = o || {};
    g.save(); rr(g, 0, 0, w, h, w * 0.1); g.clip();
    g.fillStyle = '#0a0d14'; g.fillRect(0, 0, w, h);
    const ch = h * 0.72, cw = w * 0.9, cx = w * 0.05, cy = h * 0.1, slide = (o.k || 0) * (ch + 14);
    worldCard(g, o.card || 0, cx, cy - slide, cw, ch, t, w * 0.06);
    worldCard(g, (o.card || 0) + 1, cx, cy - slide + ch + 14, cw, ch, t + 0.37, w * 0.06);
    // status bar + bottom bar, generic glyphs
    g.fillStyle = 'rgba(8,10,16,0.82)'; g.fillRect(0, 0, w, h * 0.07); g.fillRect(0, h * 0.9, w, h * 0.1);
    g.fillStyle = '#9aa7c2'; g.fillRect(w * 0.08, h * 0.028, w * 0.12, h * 0.012); g.fillRect(w * 0.72, h * 0.028, w * 0.2, h * 0.014);
    for (let i = 0; i < 4; i++) { g.fillStyle = i === 1 ? '#4aa8ff' : '#6d7b99'; g.beginPath(); g.arc(w * (0.15 + i * 0.23), h * 0.95, w * 0.034, 0, TAU); g.fill(); }
    if (o.dot) { const p = 1 + 0.22 * Math.sin(t * 9); g.fillStyle = css(BLUE); g.beginPath(); g.arc(w * 0.89, h * 0.88, w * 0.052 * p * o.dot, 0, TAU); g.fill(); g.fillStyle = 'rgba(74,168,255,0.25)'; g.beginPath(); g.arc(w * 0.89, h * 0.88, w * 0.12 * p * o.dot, 0, TAU); g.fill(); }
    if (o.overlay === 'screentime') {
      g.fillStyle = 'rgba(8,10,16,0.92)'; g.fillRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#7f8db0'; g.font = `${Math.round(w * 0.075)}px "DejaVu Sans"`; g.fillText('Screen time', w / 2, h * 0.36);
      g.fillStyle = '#e6edff'; g.font = `bold ${Math.round(w * 0.2)}px "DejaVu Sans"`; g.fillText('7h 12m', w / 2, h * 0.5);
      g.fillStyle = '#3a4466'; rr(g, w * 0.14, h * 0.62, w * 0.72, h * 0.022, 8); g.fill(); g.fillStyle = css(BLUE); rr(g, w * 0.14, h * 0.62, w * 0.72 * clamp(((t * 0.8) % 1.4)), h * 0.022, 8); g.fill();
    }
    if (o.dim) { g.fillStyle = `rgba(0,0,0,${o.dim})`; g.fillRect(0, 0, w, h); }
    g.restore();
  }
  // phone with bezel at world/screen position, centred; ang radians
  function phone(g, x, y, ang, s, o) {
    const w = 52, h = 104;
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
    g.fillStyle = '#07080c'; rr(g, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 12); g.fill();
    g.translate(-w / 2, -h / 2); if ((o && o.on) !== 0) screen(g, w, h, (o && o.t) || 0, o); else { g.fillStyle = '#0b0d12'; rr(g, 0, 0, w, h, 8); g.fill(); }
    g.restore();
  }

  // ----------------------------------------------------------------- slot-machine lever (shot 9)
  // The phone's pull-to-refresh becomes a lever; reels spin and land on three glyphs. pulls: [[tStart, resultIndexes], ...]
  function glyph(g, i, x, y, r) {
    g.save(); g.translate(x, y); const c = ['#4aa8ff', '#ffb25a', '#9ad06a', '#e36a8a', '#f2f2f6'][i % 5]; g.fillStyle = c;
    if (i % 5 === 0) { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); }
    else if (i % 5 === 1) { g.beginPath(); g.moveTo(0, -r); g.lineTo(r, r * 0.8); g.lineTo(-r, r * 0.8); g.closePath(); g.fill(); }
    else if (i % 5 === 2) { g.fillRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7); }
    else if (i % 5 === 3) { g.beginPath(); g.moveTo(0, r); g.bezierCurveTo(r * 1.6, -r * 0.2, r * 0.7, -r * 1.2, 0, -r * 0.4); g.bezierCurveTo(-r * 0.7, -r * 1.2, -r * 1.6, -r * 0.2, 0, r); g.fill(); }
    else { g.beginPath(); for (let k = 0; k < 10; k++) { const a = k * TAU / 10 - Math.PI / 2, rr2 = k % 2 ? r * 0.45 : r; g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } g.closePath(); g.fill(); }
    g.restore();
  }
  function slot(g, E, t, pulls) {
    g.fillStyle = '#05070c'; g.fillRect(0, 0, 1920, 1080); glow(g, 960, 560, 900, [60, 130, 255], 0.22, 'screen');
    // machine body
    const bx = 560, by = 200, bw = 800, bh = 640;
    g.fillStyle = '#10141f'; rr(g, bx, by, bw, bh, 46); g.fill(); g.strokeStyle = '#1e2740'; g.lineWidth = 8; g.stroke();
    g.fillStyle = '#060810'; rr(g, bx + 70, by + 120, bw - 140, 330, 26); g.fill();
    // reels
    let lever = 0, spinning = false;
    for (let r = 0; r < 3; r++) {
      const rx = bx + 90 + r * 213, ry = by + 140, rw = 190, rh = 290; g.save(); rr(g, rx, ry, rw, rh, 16); g.clip(); g.fillStyle = '#0d1220'; g.fillRect(rx, ry, rw, rh);
      let off = 0, res = 0;
      for (const [ts, idx] of pulls) {
        const lt = t - ts, stop = 0.9 + r * 0.22;
        if (lt >= 0 && lt < stop) { spinning = true; off = lt * 9 + r * 0.31; res = idx[r]; } else if (lt >= stop && lt < stop + 0.35) { const k = (lt - stop) / 0.35; off = Math.ceil(stop * 9 + r * 0.31) + (1 - spring(k * 0.4, 280, 14)) * 0.18; res = idx[r]; } else if (lt >= stop + 0.35) { off = 0; res = idx[r]; }
      }
      const fr = off - Math.floor(off), spin = Math.abs(off) > 0.001 && spinning;
      for (let i = -2; i <= 2; i++) { const gy = ry + rh / 2 + (i + fr) * 100, id = Math.floor(off) + i + res; g.globalAlpha = spin ? 0.7 : 1; glyph(g, ((id % 5) + 5) % 5, rx + rw / 2, gy, 34); }
      g.globalAlpha = 1; g.restore();
    }
    for (const [ts] of pulls) { const lt = t - ts; if (lt >= -0.25 && lt < 0.55) lever = lt < 0 ? 0 : lt < 0.35 ? easeOut(lt / 0.35) : 1 - easeInOut((lt - 0.35) / 0.2); }
    // lever on the right
    const lx = bx + bw + 14, ly = by + 260, a = lever * 1.1; g.save(); g.translate(lx, ly); g.strokeStyle = '#3a4466'; g.lineWidth = 22; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(60, -150 + a * 280); g.stroke();
    g.fillStyle = '#e24a5a'; g.beginPath(); g.arc(60, -150 + a * 280, 34, 0, TAU); g.fill(); g.restore();
    // coin tinkles when a pull has landed
    for (const [ts] of pulls) { const lt = t - ts - 1.9; if (lt > 0 && lt < 1.3) for (let i = 0; i < 9; i++) { const rr3 = rng(ts * 7 + i), k = lt, x = 960 + (rr3() - 0.5) * 260 + (rr3() - 0.5) * 360 * k, y = 640 + (-520 * k + 900 * k * k) * (0.5 + rr3() * 0.5); g.fillStyle = `rgba(214,184,112,${1 - k / 1.3})`; g.beginPath(); g.ellipse(x, y, 16, 16 * Math.abs(Math.cos(k * 10 + i)), 0, 0, TAU); g.fill(); } }
    // thumb dragging down on the right
    const th = clamp(lever); g.fillStyle = '#0e0e12'; rr(g, 1500 + th * 40, 330 + th * 300, 60, 150, 30); g.fill();
  }

  return { WORLDS, worldCard, screen, phone, slot, glyph, BLUE };
})();
