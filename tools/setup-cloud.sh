#!/usr/bin/env bash
# From the repository root: bash tools/setup-cloud.sh
# Ubuntu/Debian cloud machines: installs the pinned npm dependency, FFmpeg, Chromium, and browser libraries.
# SKIP_SYSTEM_DEPS=1 skips apt/browser-library provisioning when the image already has those libraries.
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This setup script targets Linux. On Windows/macOS: npm ci, then npm run setup:browser; install FFmpeg separately." >&2
  exit 1
fi
command -v node >/dev/null || { echo "Install Node.js 22 or newer before running this script." >&2; exit 1; }
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) { console.error("Node.js 22 or newer is required."); process.exit(1); }'
command -v npm >/dev/null || { echo "npm is required (normally installed with Node.js)." >&2; exit 1; }
npm ci --ignore-scripts --no-audit --no-fund

if [[ -n "${FFMPEG_PATH:-}" ]] && ! command -v "$FFMPEG_PATH" >/dev/null; then
  echo "FFMPEG_PATH does not name an executable. Correct it or unset it to use ffmpeg on PATH." >&2
  exit 1
fi
if ! command -v "${FFMPEG_PATH:-ffmpeg}" >/dev/null; then
  if [[ "${SKIP_SYSTEM_DEPS:-0}" == "1" ]]; then
    echo "FFmpeg is missing. Install it on PATH or set FFMPEG_PATH; video/contact rendering needs it." >&2
    exit 1
  fi
  command -v apt-get >/dev/null || { echo "Install FFmpeg using this distribution's package manager, then retry." >&2; exit 1; }
  if [[ "$EUID" -eq 0 ]]; then
    apt-get update
    apt-get install -y ffmpeg
  elif command -v sudo >/dev/null; then
    sudo apt-get update
    sudo apt-get install -y ffmpeg
  else
    echo "FFmpeg is missing and system installation needs root/sudo. Ask the environment administrator to install it." >&2
    exit 1
  fi
fi

if [[ -n "${BROWSER_EXECUTABLE_PATH:-}" || -n "${BROWSER_CHANNEL:-}" ]]; then
  echo "Using the configured browser override; skipping managed Chromium installation. Browser system libraries must already be present."
elif [[ "${SKIP_SYSTEM_DEPS:-0}" == "1" ]]; then
  npx --no-install playwright install chromium
else
  npx --no-install playwright install --with-deps chromium
fi
npm run check:renderers
echo "Setup complete. Run npm run smoke for a single-frame rendering check. Full narration/video generation is a separate step."
