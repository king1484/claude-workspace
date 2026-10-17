// text.js — typography for SCROLL. Fonts (SIL OFL, in assets/fonts): EB Garamond (titles), Caveat (handwriting), Inter (UI).
// Animated titles reveal word by word: each word fades up from a soft blur with a small spring rise and settles its tracking.
// All functions are pure functions of time.
const TXT = (() => {
  const SERIF = '"EB Garamond", "Liberation Serif", serif', HAND = '"Caveat", "DejaVu Sans", cursive', UI = '"Inter", "DejaVu Sans", sans-serif';

  // word-by-word reveal. lt = local time, tIn = start, tOut = when the exit begins.
  // o = { x, y, size, italic, weight, color [r,g,b], stagger, spacing, glow, align, exitDrift }
  function title(g, text, lt, tIn, tOut, o) {
    o = o || {};
    if (lt < tIn - 0.01 || lt > tOut + 1.2) return;
    const size = o.size || 72, col = o.color || [232, 234, 242], stagger = o.stagger == null ? 0.16 : o.stagger, x0 = o.x == null ? 960 : o.x, y0 = o.y == null ? 540 : o.y;
    g.save();
    g.font = `${o.italic === false ? '' : 'italic '}${o.weight || 400} ${size}px ${o.font || SERIF}`;
    g.textBaseline = 'alphabetic';
    const words = text.split(' '), sp = g.measureText(' ').width, widths = words.map(w => g.measureText(w).width);
    const total = widths.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
    let x = (o.align === 'left') ? x0 : x0 - total / 2;
    const exitK = clamp((lt - tOut) / 0.9), exitE = exitK * exitK * (3 - 2 * exitK);
    words.forEach((w, i) => {
      const u = lt - tIn - i * stagger, k = clamp(u / 0.7);
      if (k <= 0) { x += widths[i] + sp; return; }
      const e = 1 - Math.pow(1 - k, 3), rise = (1 - spring(Math.max(0, u) * 1.0, 120, 14)) * size * 0.32;
      const a = e * (1 - exitE), blur = (1 - e) * 10 + exitE * 6;
      g.globalAlpha = a;
      if (blur > 0.3) g.filter = `blur(${blur.toFixed(1)}px)`; else g.filter = 'none';
      if (o.glow) { g.shadowColor = `rgba(${col[0]},${col[1]},${col[2]},0.35)`; g.shadowBlur = size * 0.35; }
      g.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      g.fillText(w, x, y0 + size * 0.33 + rise - exitE * (o.exitDrift == null ? 18 : o.exitDrift));
      x += widths[i] + sp;
    });
    g.restore();
  }
  // a small tracked-caps label that wipes in from the left behind a soft mask (times of day)
  function label(g, text, lt, tIn, tOut, o) {
    o = o || {};
    if (lt < tIn || lt > tOut + 0.6) return;
    const size = o.size || 30, x = o.x == null ? 960 : o.x, y = o.y == null ? 960 : o.y, k = easeOut(clamp((lt - tIn) / 0.6)), out = clamp((lt - tOut) / 0.5);
    g.save(); g.font = `500 ${size}px ${UI}`; g.letterSpacing = `${Math.round(size * 0.3)}px`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(text).width + 40;
    g.globalAlpha = (1 - out) * (o.alpha == null ? 0.9 : o.alpha);
    g.beginPath(); g.rect(x - w / 2, y - size, w * k, size * 2); g.clip();
    g.fillStyle = o.color || 'rgb(214,220,234)'; g.fillText(text, x + (1 - k) * -12, y - out * 8);
    g.strokeStyle = `rgba(214,220,234,${0.5 * (1 - out)})`; g.lineWidth = 2; g.beginPath(); g.moveTo(x - w * 0.28, y + size * 0.95); g.lineTo(x - w * 0.28 + w * 0.56 * k, y + size * 0.95); g.stroke();
    g.restore();
  }
  // a seven-segment digit string. Unlit segments show faintly, like a real LED clock.
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  function sevenSeg(g, str, cx, cy, h, col, glowA) {
    const w = h * 0.52, th = h * 0.12, gap = h * 0.16, chars = str.split('');
    const widthOf = (c) => c === ':' ? h * 0.22 : w; const total = chars.reduce((a, c) => a + widthOf(c), 0) + gap * (chars.length - 1);
    let x = cx - total / 2;
    const seg = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    g.save(); g.lineCap = 'round'; g.lineWidth = th;
    for (const c of chars) {
      if (c === ':') { g.fillStyle = col; g.shadowColor = col; g.shadowBlur = h * 0.25 * glowA; g.beginPath(); g.arc(x + h * 0.11, cy - h * 0.18, th * 0.55, 0, TAU); g.arc(x + h * 0.11, cy + h * 0.18, th * 0.55, 0, TAU); g.fill(); x += widthOf(c) + gap; continue; }
      const on = SEG[c] || '', L = x + th / 2, R = x + w - th / 2, T = cy - h / 2 + th / 2, M = cy, B = cy + h / 2 - th / 2, p = th * 0.7;
      const S = { a: [L + p, T, R - p, T], b: [R, T + p, R, M - p], c: [R, M + p, R, B - p], d: [L + p, B, R - p, B], e: [L, M + p, L, B - p], f: [L, T + p, L, M - p], g: [L + p, M, R - p, M] };
      for (const k in S) { const lit = on.indexOf(k) >= 0; g.strokeStyle = lit ? col : 'rgba(200,210,235,0.06)'; g.shadowColor = col; g.shadowBlur = lit ? h * 0.25 * glowA : 0; seg(...S[k]); }
      x += w + gap;
    }
    g.restore();
  }
  // handwritten note text
  function hand(g, text, x, y, size, col, ang) { g.save(); g.translate(x, y); g.rotate(ang || 0); g.font = `600 ${size}px ${HAND}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = col || '#2b2722'; g.fillText(text, 0, 0); g.restore(); }
  return { title, label, sevenSeg, hand, SERIF, HAND, UI };
})();
