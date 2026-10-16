// Render exactly one frame into memory. No video or production output is written.
// npm run smoke -- --project FutureSight --page index_full.html --time 1
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchRenderBrowser } from './browser.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  if (!['--project', '--page', '--time'].includes(key) || process.argv[i + 1] == null) throw new Error('Usage: npm run smoke -- --project HundredHourDay|FutureSight --page index_full.html --time 1');
  args[key.slice(2)] = process.argv[i + 1];
}
const project = args.project || 'HundredHourDay';
if (!['HundredHourDay', 'FutureSight'].includes(project)) throw new Error('Choose HundredHourDay or FutureSight.');
const pageName = args.page || 'index_full.html';
const pageFile = path.resolve(root, project, pageName);
const relative = path.relative(path.join(root, project), pageFile);
if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(pageFile)) throw new Error(`The requested HTML page does not exist inside ${project}: ${pageName}`);
const time = Number(args.time ?? 1);
if (!Number.isFinite(time) || time < 0) throw new Error('--time must be a non-negative number.');
const browser = await launchRenderBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [], missing = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => missing.push(`${request.url()}: ${request.failure()?.errorText}`));
  await page.goto(pathToFileURL(pageFile).href);
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  const frame = await page.evaluate(t => {
    window.seek(t);
    const canvas = document.querySelector('canvas');
    const g = canvas.getContext('2d');
    const pixels = g.getImageData(0, 0, canvas.width, canvas.height).data;
    let min = 255, max = 0;
    for (let i = 0; i < pixels.length; i += 388) {
      min = Math.min(min, pixels[i], pixels[i + 1], pixels[i + 2]);
      max = Math.max(max, pixels[i], pixels[i + 1], pixels[i + 2]);
    }
    return { width: canvas.width, height: canvas.height, encodedBytes: window.canvasPNG().length, colorRange: max - min };
  }, time);
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  if (frame.width !== 1920 || frame.height !== 1080 || frame.colorRange < 10 || frame.encodedBytes < 5000) throw new Error(`Unexpected/blank frame: ${JSON.stringify(frame)}`);
  // This handoff intentionally contains unfinished chapters. Missing source files remain visible.
  for (const entry of missing) console.warn(`Missing resource (handoff may be incomplete): ${entry}`);
  console.log(JSON.stringify({ status: 'single-frame-ok', project, page: pageName, time, ...frame, missingResources: missing.length }, null, 2));
} finally {
  await browser.close();
}
