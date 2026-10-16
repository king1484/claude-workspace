# SCROLL — build notes

A silent animated short (230 s, plus 2 s of end silence). Script, sound plan and research are in `docs/`. The picture is a deterministic Canvas 2D film (a pure function of time, rendered frame by frame in headless Chromium and encoded with ffmpeg). The score and effects are rendered by `audio/build_audio.py`.

## Rebuild from a clean checkout

```bash
# once per container
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci                    # repo root
export BROWSER_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome   # or any Chromium
bash Scroll/tools/fetch_piano.sh                             # Salamander Grand Piano samples (CC BY 3.0)
# Freesound recordings (CC0): set FREESOUND_API_KEY, then fetch the ids listed in docs/CREDITS.md into Scroll/assets/sfx/<folder>/<id>.mp3
#   python3 Scroll/tools/freesound_search.py "<query>" --download Scroll/assets/sfx/<folder>

# picture (animatic: half resolution, ~5.5 min)  /  full resolution 1920x1080 (omit --query, use --sub 4 for motion blur)
cd Scroll && node render.mjs --page index.html --query scale=0.5 --fps 30 --sub 1 --from 0 --to 230 --out out/animatic_silent.mp4
# sound
PIANO_DIR=Scroll/assets/piano/SalamanderGrandPianoV3_44.1khz16bit/44.1khz16bit SFX_DIR=Scroll/assets/sfx python3 Scroll/audio/build_audio.py Scroll/out/mix.wav
# mux (holds the last black frame for the 2 s of ending silence)
ffmpeg -i out/animatic_silent.mp4 -i out/mix.wav -vf tpad=stop_mode=clone:stop_duration=2 -c:v libx264 -crf 22 -c:a aac -b:a 192k out/SCROLL_animatic.mp4
```

Stills and contact sheets for review: `node render.mjs --page index.html --stills "name:t" ` and `--contact "t1,t2,..." --cols 6`. Pacing/colour/loudness check of any video: `python3 tools/analyze_reference.py VIDEO`.

## Layout

| Path | What |
|---|---|
| `engine/lib.js, draw.js` | springs, seeded RNG, drawing helpers, film grain |
| `engine/char.js` | the host: pose vectors, two-bone IK, phone-lit head with a rim, wall-shadow mode, hem-to-collar colour wipe |
| `engine/set.js` | the bedroom (world coordinates), the floor shaft, the window, the lighting pass |
| `engine/feed.js` | eight tiny original worlds, the phone UI, the slot-machine lever |
| `shots_a.js, shots_b.js, shots_c.js` | the 30 shots, in order, with global times; `main.js` picks the shot for a time |
| `audio/build_audio.py` | piano score (D–A–G motif; F♯ arrives with the coin at 142 s), foley cue list, per-section loudness riding, limiter |

## Where the film differs from `docs/SCRIPT.md`

- The coin lands at **2:22**, not 2:20 (the phone goes on the shelf at 2:21).
- He crosses the room in **13 steps**, not 6: the room is about 1,150 px wide and a 6-step stride looked like gliding.
- The shaft (the floor hole) only exists during the hook and the pull; the rewound setup scenes (0:20–0:45) have a plain floor.
- Everything is a first pass: the animatic is half resolution with no motion blur.

## Known issues / next polish

- Poses are functional but stiff; walking, sitting down and standing up need weight and overlap.
- Wide shots are small and the character is a little hard to read at phone size; several scenes are still dark.
- The first sound pass was never listened to by me (no audio playback here): levels were set by measurement against `docs/SOUND_DESIGN.md`. Please listen at three volumes and flag anything harsh or repetitive.
- Thumbnails, Shorts and the vertical re-frame are not built yet.
