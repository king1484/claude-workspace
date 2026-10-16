// harness.js — shared page logic for index.html (and world_test.html). Defines window.seek / window.renderFrame.
(function () {
  const W = 1920, H = 1080;
  const cv = document.getElementById('c');
  const g = cv.getContext('2d');
  const acc = document.createElement('canvas'); acc.width = W; acc.height = H;
  const a = acc.getContext('2d');

  function testPattern(g, t) {
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#241648'); gr.addColorStop(0.5, '#d4577a'); gr.addColorStop(1, '#ff9d57');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.fillRect(((t * 300) % (W + 200)) - 100, 480, 120, 120);
    g.font = '64px "Segoe UI Black", sans-serif'; g.textAlign = 'center'; g.fillText('TEST PATTERN  t=' + t.toFixed(3), W / 2, 300);
  }
  function frame(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (typeof drawFrame === 'function') drawFrame(g, t); else testPattern(g, t);
  }
  window.seek = (t) => { frame(t); return true; };
  // Averages `sub` sub-frames across a 180-degree shutter ending at t, returns JPEG data URL.
  window.renderFrame = (t, fps, sub, type) => {
    sub = Math.max(1, sub | 0);
    const shutter = 0.5 / fps;
    a.globalCompositeOperation = 'source-over';
    for (let i = 0; i < sub; i++) {
      const ti = Math.max(0, sub === 1 ? t : t - shutter + shutter * (i / (sub - 1)));
      frame(ti);
      a.globalAlpha = 1 / (i + 1);
      a.drawImage(cv, 0, 0);
    }
    a.globalAlpha = 1;
    return type === 'png' ? acc.toDataURL('image/png') : acc.toDataURL('image/jpeg', 0.97);
  };
  window.canvasPNG = () => cv.toDataURL('image/png');
  try { if (typeof warmWorld === 'function') warmWorld(); } catch (e) { console.error('warmWorld failed', e); }
  window.__ready = true;
})();
