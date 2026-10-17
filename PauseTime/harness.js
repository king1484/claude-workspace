// harness.js — vertical 1080x1920 page logic: window.seek / renderFrame / canvasPNG (same contract as the 16:9 projects).
(function () {
  const W = 1080, H = 1920;
  const cv = document.getElementById('c'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const acc = document.createElement('canvas'); acc.width = W; acc.height = H;
  const a = acc.getContext('2d');
  function frame(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
    drawFrame(g, t);
  }
  window.seek = (t) => { frame(t); return true; };
  window.renderFrame = (t, fps, sub, type) => {
    sub = Math.max(1, sub | 0); const shutter = 0.5 / fps;
    for (let i = 0; i < sub; i++) {
      const ti = Math.max(0, sub === 1 ? t : t - shutter + shutter * (i / (sub - 1)));
      frame(ti); a.globalAlpha = 1 / (i + 1); a.drawImage(cv, 0, 0);
    }
    a.globalAlpha = 1;
    return type === 'png' ? acc.toDataURL('image/png') : acc.toDataURL('image/jpeg', 0.95);
  };
  window.canvasPNG = () => cv.toDataURL('image/png');
  Promise.all(['900 80px "Inter"', '700 40px "Inter"', '500 30px "Inter"'].map(f => document.fonts.load(f)))
    .catch(() => {}).then(() => { try { if (typeof warm === 'function') warm(); } catch (e) { console.error('warm failed', e); } window.__ready = true; });
})();
