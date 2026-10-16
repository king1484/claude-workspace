# Resume audio and the FutureSight Short in a cloud checkout

The saved narration and layouts are the source of timing. Continue with them to preserve the voice, delivery, and synchronization. Do not run the optional TTS scripts during normal setup. Both projects use `am_michael`, speed `1.06`, language `en-us`; regenerating even the same settings can change durations.

## Dependencies

Use Python 3.12, Node.js 22 or newer, and FFmpeg with AAC, libx264, `loudnorm`, and `ebur128`. From the repository root:

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
ffmpeg -version
node --version
```

The pinned Python versions match the environment used for the packaging smoke test. `soundfile` also needs libsndfile; its supported binary wheels normally include it. If installing from source on Linux, install the system libsndfile package first. Set up Playwright/Chromium and fonts as described in the repository setup instructions before rendering pictures. Audio assembly itself requires no browser, network, model, or API key.

## Preserved inputs

- `HundredHourDay/out/vo/*.wav`: the 42 original line recordings, with `out/layout.json` and `layout.js`. Keep both layouts aligned. Its synthesizer reads these WAVs directly.
- `FutureSight/out/vo/*.wav` and `FutureSight/out/vo.wav`: original line recordings and the original hook recording. Retain these if continuing the long video.
- `FutureSight/assets/published_mix.flac`: the exact published stereo mix, compressed losslessly. It preserves the Short's narration, music, and effects without rerunning synthesis.
- `FutureSight/shorts/work/words.json`: cached word timings. `plan.mjs` uses this directly; no Whisper installation is needed for the saved edit.
- `FutureSight/shorts/{plan.mjs,plan.json,cams.json,vharness.js}` and `shorts/work/audio_plan.json`: current cuts, picture offsets, cameras, captions, and audio ranges.

See [handoff/ASSETS.md](../handoff/ASSETS.md) for the saved assets and restoration instructions. The published WAV and packaged FLAC decode to identical `pcm_s32le` bytes: SHA256 `842e30789d89d6a49a306ec0a40a34f9bda2e09a81703b553aea950b8c72a24a`. The asset manifest provides the FLAC file hash separately. `shorts/audio.py` uses `out/mix_full.wav` if it exists, then falls back to `assets/published_mix.flac`; its source log identifies the selected file. A new synthesized `out/mix_full.wav` would take precedence, so confirm that log when preserving the published sound.

## HundredHourDay audio resume

Read `HundredHourDay/docs/STORY_V2.md` first. The latest production mix from the interrupted session was incomplete and is not a final master. Complete and review the chapter cues before generating the final mix. The independent test-cue run passed at -16 LUFS, -2.4 dBTP, zero clipped/NaN samples, and 12.2–14.8 dB narration-over-music margin in the 300–4000 Hz speech band. Those measurements validate the test mix, not the final chapters.

From the repository root, a diagnostic run is:

```bash
cd HundredHourDay
node --check sfx_full.mjs
node sfx_full.mjs --wav-only --check --cues-dir audio_test_cues --out debug
```

The test fixtures intentionally contain an unsupported `laserBeam` cue to exercise warning handling. Debug files have a suffix and do not replace the main mix. The main script uses only Node built-ins and FFmpeg; it needs no npm audio packages.

After every chapter's final cues are ready:

```bash
node sfx_full.mjs --wav-only --check
```

Inspect `out/audio_check.txt` and `out/audio_report_full.json`, then listen to the finished mix for narration clarity, restrained effects, joins, and the ending. The numerical report is not a listening review. Main outputs are `out/audio_mix.wav`, the duplicate `out/mix_full.wav`, and QC reports. Once the matching 304.5-second silent picture is rendered to `out/silent_full.mp4`:

```bash
node sfx_full.mjs --mux-only
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,sample_rate,channels -of json out/final_full.mp4
```

## FutureSight Short resume

The previous final MP4 predates the latest plan and silent render. It needs an updated mux before delivery. Download the existing latest silent render to `FutureSight/shorts/work/silent.mp4` using [handoff/ASSETS.md](../handoff/ASSETS.md) when the saved cut plan and picture are unchanged. That avoids rerendering the preserved edit. The saved plan is 50.38 seconds at 30 fps; the renderer rounds to 1511 frames, yielding a 50.366667-second picture. The 13 ms difference is inside the final fade.

From the repository root:

```bash
cd FutureSight
node shorts/plan.mjs
python --version
```

With the virtual environment already activated, run the following commands instead of invoking any TTS or Whisper step:

```bash
python shorts/audio.py
ffmpeg -y -i shorts/work/audio_raw.wav -af "loudnorm=I=-14:TP=-1.5:LRA=9" -ar 48000 -c:a pcm_s24le shorts/work/audio_normalized.wav
ffmpeg -y -i shorts/work/silent.mp4 -i shorts/work/audio_normalized.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart shorts/FutureSight_Short.mp4
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,sample_rate,channels -of json shorts/FutureSight_Short.mp4
ffmpeg -hide_banner -nostats -i shorts/FutureSight_Short.mp4 -af "ebur128=peak=true" -f null -
```

The Short target is about -14 LUFS, distinct from the long video's -16 LUFS mix target. Check 1080×1920, 30 fps, duration under 59 seconds, intelligible narration, synchronized captions, and safe placement against Shorts interface overlays. The raw assembly measured -13.55 LUFS / -2.08 dBTP before normalization; measure the final AAC file after muxing. Inspect the cover and metadata in `shorts/short_cover.png`, `shorts/metadata.json`, and `shorts/METADATA.md`. Preserve the full-video URL `https://www.youtube.com/watch?v=2LQMDJMO8ds`. Nothing in these commands uploads or publishes.

Only if changing the picture, camera, captions, or cut plan, set up the browser and fonts, inspect the stills, and replace the silent render before the mux commands above:

```bash
node shorts/vrender.mjs --stills "0,0.5,1,3,10,25,40,50.33"
node shorts/vrender.mjs --out shorts/work/silent.mp4 --sub 4
```

Packaging smoke test: the FLAC fallback assembled 2,418,240 stereo frames at 48 kHz (50.38 seconds), peak 0.758577466, all samples finite. The resulting float32 audio samples were identical to assembly from the original WAV, with maximum absolute difference zero and PCM SHA256 `6e8c8ff9088e4799565f5c1b5f50ce296c1a76d7c814d800592fdc79b3b41c5f`. No voice, main mix, picture render, normalization, or final mux was generated during packaging.

If the cut list or voice timing changes, cached captions may require revision. `shorts/words.py` is an optional transcription tool using `faster-whisper` with the `small` model, CPU/int8, and `local_files_only=True`. It requires a separately prepared local model cache. The current cached `words.json` avoids that dependency.

## Optional new narration only

The three TTS scripts are `FutureSight/make_vo.py`, `FutureSight/make_vo_full.py`, and `HundredHourDay/make_vo_full.py`. They accept `KOKORO_MODEL` and `KOKORO_VOICES`. If omitted, they retain the legacy `~/.cache/hyperframes/tts/` model/voice paths; that directory name does not require installing HyperFrames. Missing model files produce a clear error.

If intentionally replacing narration, install optional dependencies and obtain the existing model files from the official release. Run from the repository root:

```bash
python -m pip install -r requirements-tts.txt
mkdir -p .models/kokoro
curl -fL --retry 3 -o .models/kokoro/kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -fL --retry 3 -o .models/kokoro/voices-v1.0.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
export KOKORO_MODEL="$PWD/.models/kokoro/kokoro-v1.0.onnx"
export KOKORO_VOICES="$PWD/.models/kokoro/voices-v1.0.bin"
```

Use the fp32 model as above. Do not substitute an int8 model: the original work noted truncated output with it. Running a `make_vo_full.py` overwrites WAVs and both layout files, requiring a fresh visual/cue/caption synchronization review. The stored original narration is the reliable way to preserve the existing performance. Keep downloaded model weights and generated audio/video outputs out of source Git.
