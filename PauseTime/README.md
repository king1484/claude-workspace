# PauseTime — "What If You Could Pause Time?" (What If Labs Short)

Vertical 1080×1920 Short. Deterministic Canvas 2D (pure function of time), same mascot rig and narration voice as the channel's
long videos (`HundredHourDay/`): `lib.js`, `rigs.js` and `mascot.js` are copies, with three extra poses (`snap`, `push`, `bite`) added to `mascot.js`.

| File | What |
|---|---|
| `script.json` | narration lines (voice `am_michael`, speed 1.06, gap after each line) |
| `make_vo.py` | Kokoro TTS → `out/vo.wav`, `out/vo_timing.json` (needs `KOKORO_MODEL`, `KOKORO_VOICES`) |
| `words.py` | faster-whisper word timings → `out/words.json` (captions + event times) |
| `gen_timing.py` | → `timing.js` (`window.VO`, `window.WORDS`) for the page |
| `scenes.js` | helpers, the street, HUD, snap FX (`window.PT`) |
| `shots.js` | the 10 shots, grain/vignette, `drawFrame`; word-by-word captions only with `?caps=1` (off for the release) |
| `audio.py` | piano score (Salamander), synthesized SFX, CC0 ambiences, ducking, limiter → `out/mix.wav` (needs `PIANO_DIR`, `SFX_DIR`) |
| `render.mjs` | frame renderer (viewport 1080×1920) |
| `METADATA.md` | upload kit |

Rebuild:
```bash
python3 make_vo.py && python3 words.py && python3 gen_timing.py      # only if the script changes
BROWSER_EXECUTABLE_PATH=... node render.mjs --fps 30 --sub 4 --from 0 --to 46.1 --out out/final_silent.mp4
PIANO_DIR=... SFX_DIR=... python3 audio.py
ffmpeg -i out/final_silent.mp4 -i out/mix.wav -c:v copy -c:a aac -b:a 192k -shortest out/PauseTime_Short.mp4
```
Key frames: `node render.mjs --contact "0.5,2.3,7.2,11.5,21.5,27.0,33.0,40.0,44.5" --cols 9 --contactout check`.

Story beats follow the narration: snap at "snap" (l2) freezes the street (freeze spreads from his hand, live HUD clock stops),
birds and raindrops hang, bakery, "but…" push-in, lab diagram of light (photons stop halfway at "pause"), second snap goes black,
air molecules freeze, pushing against concrete air, darkness with only his eyes, the hand that can't snap, the pause button.
The clock tick that stops at the first snap returns on the last frame so the Short loops.
