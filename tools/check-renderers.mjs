// Syntax validation only: no Chromium download, rendering, or generated production artifacts.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['tools/browser.mjs', 'tools/render-smoke.mjs', 'tools/check-renderers.mjs', 'HundredHourDay/render.mjs', 'FutureSight/render.mjs', 'FutureSight/shorts/vrender.mjs'];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0) {
    console.error(`Syntax check failed: ${file}`, result.error?.message || '');
    process.exit(result.status || 1);
  }
}
console.log(`Syntax OK: ${files.length} renderer/helper files.`);
