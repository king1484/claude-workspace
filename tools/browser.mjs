// Shared browser and encoder discovery. Import from renderers; no global npm path is assumed.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);

export function browserLaunchOptions(env = process.env, platform = process.platform) {
  const options = {
    headless: true,
    args: ['--allow-file-access-from-files'],
  };
  if (platform === 'win32') {
    // Preserve the original local renderer's Chrome/D3D11 path.
    options.args.unshift('--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force_high_performance_gpu');
  } else if (platform === 'linux') {
    // Small /dev/shm volumes are common in cloud containers. Chromium can use software rendering.
    options.args.push('--disable-dev-shm-usage');
  }
  if (env.BROWSER_EXECUTABLE_PATH) options.executablePath = env.BROWSER_EXECUTABLE_PATH;
  else if (env.BROWSER_CHANNEL) options.channel = env.BROWSER_CHANNEL;
  else if (platform === 'win32') options.channel = 'chrome';
  // With no channel/path on Linux or macOS, Playwright selects its managed Chromium.
  return options;
}

export async function launchRenderBrowser() {
  const specifier = process.env.PLAYWRIGHT_PATH || 'playwright';
  let chromium;
  try {
    ({ chromium } = require(specifier));
    if (!chromium?.launch) throw new Error('The selected package does not export chromium.launch.');
  } catch (error) {
    throw new Error(`Playwright could not be loaded (${specifier}). Run npm ci at the repository root, or set PLAYWRIGHT_PATH to an existing Playwright package. ${error.message}`, { cause: error });
  }
  try {
    return await chromium.launch(browserLaunchOptions());
  } catch (error) {
    const setup = process.platform === 'linux'
      ? 'Run bash tools/setup-cloud.sh at the repository root (or npx playwright install --with-deps chromium).'
      : process.platform === 'win32'
        ? 'Install Chrome, or run npm run setup:browser and set BROWSER_CHANNEL=chromium.'
        : 'Run npm run setup:browser at the repository root to install managed Chromium.';
    throw new Error(`Cannot launch the render browser. ${setup} BROWSER_EXECUTABLE_PATH selects an existing browser binary; BROWSER_CHANNEL selects an installed browser channel. ${error.message}`, { cause: error });
  }
}

export function requireFfmpeg() {
  const executable = process.env.FFMPEG_PATH || 'ffmpeg';
  const result = spawnSync(executable, ['-version'], { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) {
    throw new Error(`FFmpeg is required for contact sheets and video encoding. Install ffmpeg on PATH (Linux: apt-get install ffmpeg), or set FFMPEG_PATH to its executable. ${result.error?.message || result.stderr || `Exit code ${result.status}`}`);
  }
  return executable;
}

export async function writeVideoFrame(ffmpeg, buffer) {
  if (ffmpeg.exitCode !== null || ffmpeg.stdin.destroyed) throw new Error('FFmpeg stopped before the video frame could be written. See its encoder diagnostic above.');
  if (ffmpeg.stdin.write(buffer)) return;
  await new Promise((resolve, reject) => {
    const cleanup = () => {
      ffmpeg.stdin.off('drain', onDrain);
      ffmpeg.stdin.off('error', onError);
      ffmpeg.off('close', onClose);
    };
    const onDrain = () => { cleanup(); resolve(); };
    const onError = error => { cleanup(); reject(new Error(`FFmpeg input failed: ${error.message}`, { cause: error })); };
    const onClose = code => { cleanup(); reject(new Error(`FFmpeg stopped while encoding a frame (exit ${code}). See its encoder diagnostic above.`)); };
    ffmpeg.stdin.once('drain', onDrain);
    ffmpeg.stdin.once('error', onError);
    ffmpeg.once('close', onClose);
  });
}
