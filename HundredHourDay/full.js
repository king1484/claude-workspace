// full.js (video 2) — assembles chapters. drawFullFrame(g, T): pure function of global time T (seconds).
const CH = (typeof window !== 'undefined' && window.CH) || {};
if (typeof window !== 'undefined') window.CH = CH;

const CH_ORDER = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];

// motivated dips only: c4 (time skip into the long afternoon), c7 (sunrise at hour 100 -> years-scale), c8 (return)
const DIP = { c4: 0.18, c7: 0.3, c8: 0.2 };

function chapterAt(T) {
  for (let i = CH_ORDER.length - 1; i >= 0; i--) {
    const id = CH_ORDER[i], L = LAYOUT[id];
    if (T >= L.start) return { id, L, lt: T - L.start, dur: L.dur };
  }
  return { id: CH_ORDER[0], L: LAYOUT[CH_ORDER[0]], lt: Math.max(0, T), dur: LAYOUT[CH_ORDER[0]].dur };
}

// fallback while a chapter is not written yet
function placeholderChapter(g, id, lt, L) {
  const H = 25 + lt * 0.5, cam = { x: 900, y: 612, z: 1.0, r: 0 };
  if (typeof TOD !== 'undefined' && TOD.drawWorld) { TOD.drawWorld(g, cam, H, { scene: 'city', t: lt }); TOD.drawForeground(g, cam, H, { scene: 'city', t: lt }); }
  else { g.fillStyle = '#3a6fb0'; g.fillRect(0, 0, TL.W, TL.H); }
  g.fillStyle = '#fff'; g.font = '72px "Segoe UI Black", sans-serif'; g.textAlign = 'center';
  g.fillText(`[${id}] ${L.title}`, 960, 200);
}

function drawFullFrame(g, T) {
  const W = TL.W, H = TL.H;
  const c = chapterAt(T);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, W, H);
  g.save();
  if (CH[c.id] && CH[c.id].draw) CH[c.id].draw(g, c.lt, c.dur); else placeholderChapter(g, c.id, c.lt, c.L);
  g.restore();
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  postFX(g, T, { vignette: 0.5, grain: 0.05 });
  // Boundaries are hard cuts (the chapters carry continuous action/audio) EXCEPT motivated jumps listed in DIP
  // (key = incoming chapter; seconds of dip-in on that chapter and dip-out on the previous one). Long fade at the very end.
  const idx = CH_ORDER.indexOf(c.id), last = idx === CH_ORDER.length - 1;
  const dIn = DIP[c.id] || 0, dOut = (idx < CH_ORDER.length - 1 && DIP[CH_ORDER[idx + 1]]) || 0;
  const fin = dIn ? 1 - smooth(c.lt / dIn) : 0;
  const fout = last ? smooth((c.lt - (c.dur - 1.4)) / 1.4) : (dOut ? smooth((c.lt - (c.dur - dOut)) / dOut) : 0);
  const black = Math.max(fin, fout);
  if (black > 0.001) { g.fillStyle = `rgba(8,5,14,${black})`; g.fillRect(0, 0, W, H); }
}

if (typeof window !== 'undefined') window.drawFrame = drawFullFrame;
