// harness.js — defines window.seek / renderFrame / canvasPNG. ?scale=0.5 renders a smaller canvas (animatic).
(function () {
  const W = 1920, H = 1080, q = new URLSearchParams(location.search), SC = +(q.get('scale') || 1);
  const cv = document.getElementById('c'); cv.width = Math.round(W * SC); cv.height = Math.round(H * SC);
  const g = cv.getContext('2d');
  const acc = document.createElement('canvas'); acc.width = cv.width; acc.height = cv.height; const a = acc.getContext('2d');
  function frame(t) {
    g.setTransform(SC, 0, 0, SC, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
    drawFrame(g, t, { W, H, SC });
  }
  window.seek = (t) => { frame(t); return true; };
  window.renderFrame = (t, fps, sub, type) => {
    sub = Math.max(1, sub | 0); const shutter = 0.5 / fps;
    a.globalCompositeOperation = 'source-over';
    for (let i = 0; i < sub; i++) { const ti = Math.max(0, sub === 1 ? t : t - shutter + shutter * (i / (sub - 1))); frame(ti); a.globalAlpha = 1 / (i + 1); a.drawImage(cv, 0, 0); }
    a.globalAlpha = 1;
    return type === 'png' ? acc.toDataURL('image/png') : acc.toDataURL('image/jpeg', 0.95);
  };
  window.canvasPNG = () => cv.toDataURL('image/png');
  window.__ready = true;
})();
