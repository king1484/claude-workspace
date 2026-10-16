// rigs_shot.mjs — screenshots rigs_test.html (modes: sheet, walkzoom, vehzoom, ghostzoom) into shots/
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('C:\\Users\\Vinay Singirikonda\\AppData\\Roaming\\npm\\node_modules\\playwright');
const dir = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(dir, 'shots'), { recursive: true });
const modes = process.argv.slice(2).length ? process.argv.slice(2) : ['sheet', 'walkzoom', 'vehzoom', 'ghostzoom'];
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
for (const m of modes) {
  await page.goto(pathToFileURL(path.join(dir, 'rigs_test.html')).href + '?mode=' + m);
  await page.waitForFunction(() => document.title === 'done', null, { timeout: 15000 });
  const out = path.join(dir, 'shots', m === 'sheet' ? 'rigs.png' : 'rigs_' + m + '.png');
  await page.locator('#c').screenshot({ path: out });
  console.log('wrote', out);
}
await browser.close();
