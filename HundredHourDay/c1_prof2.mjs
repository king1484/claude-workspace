import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/Vinay Singirikonda/AppData/Roaming/npm/node_modules/playwright');
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(ROOT, 'index_full.html')).href);
await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
console.log(await page.evaluate(() => {
  const g = document.getElementById('c').getContext('2d');
  const sync = () => g.getImageData(0, 0, 1, 1);
  const M = (name, fn, n = 10) => { fn(0); sync(); fn(1); sync(); const t0 = performance.now(); for (let i = 0; i < n; i++) { fn(i); sync(); } return name + ' ' + ((performance.now() - t0) / n).toFixed(1); };
  const o = [];
  const cam = TOD.DEFCAM;
  for (const H of []) {
    o.push(M('H' + H + ' fixed', () => TOD.drawWorld(g, cam, H, { scene: 'city', heat: .2, cloud: .3, t: 1 })));
    o.push(M('H' + H + ' heat0', () => TOD.drawWorld(g, cam, H, { scene: 'city', heat: 0, cloud: .3, t: 1 })));
    o.push(M('H' + H + ' cloud0', () => TOD.drawWorld(g, cam, H, { scene: 'city', heat: 0, cloud: 0, t: 1 })));
    o.push(M('H' + H + ' varying', (i) => TOD.drawWorld(g, cam, H + i * 0.002, { scene: 'city', heat: .2, cloud: .3, t: 1 + i * .03 })));
  }
  const cam2 = { x: 1000, y: 600, z: 1.9, r: 0 };
  o.push(M('zoom1.9 varying', (i) => TOD.drawWorld(g, cam2, 16.9 + i * 0.002, { scene: 'city', heat: .12, cloud: .3, t: 1 + i * .03 })));
  o.push(M('zoom1.9 again', (i) => TOD.drawWorld(g, cam2, 16.95 + i * 0.002, { scene: 'city', heat: .12, cloud: .3, t: 1 + i * .03 })));
  o.push(M('H17.2 fixed', () => TOD.drawWorld(g, cam, 17.2, { scene: 'city', heat: .2, cloud: .3, t: 1 })));
  return o.join('\n');
}));
await browser.close();
