# Resume the What If Labs videos

This is the 16 October 2026 working-source handoff for `king1484/claude-workspace`, branch `claude/youthful-heisenberg-b05x6n`. Local production was stopped at the user's request so Claude Cloud can continue from the saved state. No new c5/c6 production code was saved during the Codex inspection. Preserve useful work and inspect the current checkout before editing.

## Approved scope and priorities

The user approved **What If One Day Lasted 100 Hours?** after reviewing its script, then said to use the same voice as video #1 and improve music, SFX, and graphics. Production approval is already recorded; do not repeat the script-approval interview. They also requested a Short from video #1 with upload metadata.

1. Finish video #2 using the existing **304.500-second** narration/layout and current Canvas 2D engine.
2. Finish the video #1 Short using the current **50.38-second** source plan and cached word timing.
3. Deliver reviewable local files and metadata. **No YouTube/social uploads or publishing.** The GitHub transfer itself is authorized.

The user explicitly rejected HyperFrames for this continuation. Do not install, update, scaffold, or migrate to it. A legacy TTS cache path mentioning HyperFrames is just a historical filesystem location, not an instruction to use that framework.

## Read in this order

1. `HundredHourDay/docs/STORY_V2.md` — current story and clock requirements.
2. `HundredHourDay/docs/V2_BRIEF.md` — shared modules and style; follow STORY_V2 where they disagree.
3. `HundredHourDay/docs/CONTRACT.md` and `CONTRACT_FULL.md` — inherited renderer/API rules; their old-video story, clock, transitions, duration, and cue-count advice are superseded.
4. `HundredHourDay/script.json`, `layout.js`, `SOURCES.md`, existing chapter files, and shared modules.
5. `reference/VIDEO1_ANALYTICS_REVIEW.md` for why the new story uses a continuous survival journey rather than repeated demonstrations. References to original local paths are historical context.
6. `handoff/ASSETS.md` and `handoff/file-manifest.json` for assets, checksums, and any verified download command.

## Current video #2 status

Presence means saved implementation, not final quality approval.

| Chapter | Start / duration in seconds | Present | Missing / remaining |
|---|---:|---|---|
| c1 Hook | 0 / 19.124 | `ch/c1.js`, `ch/c1.cues.json`, cue builder | Final integration and audiovisual review |
| c2 The Rule | 19.124 / 25.682 | `ch/c2.js`, `ch/c2.cues.json`, cue builder | Final integration and audiovisual review |
| c3 Body Clock | 44.806 / 35.120 | `ch/c3.js` | **`ch/c3.cues.json` missing**; finish chapter review |
| c4 Long Day | 79.926 / 49.185 | `ch/c4.js`, `ch/c4.cues.json`, cue builder | Final integration and audiovisual review |
| c5 Long Night | 129.111 / 55.685 | None | **`ch/c5.js`, `ch/c5.cues.json` missing** |
| c6 Weather | 184.796 / 40.136 | None | **`ch/c6.js`, `ch/c6.cues.json` missing** |
| c7 Oceans | 224.932 / 50.350 | None | **`ch/c7.js`, `ch/c7.cues.json` missing** |
| c8 Wrap | 275.282 / 29.218 | None | **`ch/c8.js`, `ch/c8.cues.json` missing** |

All paths in this table are under `HundredHourDay/`. `index_full.html` already loads c1–c8. Missing scripts currently cause load failures; remove that incompleteness by implementing them, not by silently omitting chapters. Shared engine, mascot, globe, time-of-day, narration, layout, and audio synthesis code are present.

`audio_test_cues/` contains experimental cues for all eight chapters. Those are **not finished chapter cue sheets**. Use them only as reference; final audio must read actual `ch/*.cues.json` synchronized to the final picture. There is no completed whole-film render.

## Continuity and factual corrections still pending

Keep `layout.js` and the cached voice assets aligned: **304.500 s total**, with per-line windows already defined. Derive animation events from the relevant `LAYOUT[id].vo` start/end times. Do not casually regenerate the entire narration or shift the timeline. If a factual correction requires replacing spoken words, use the same voice and fit the replacement to its existing line window, then verify synchronization.

- **h2:** “the sun is still high ... for another thirty-four hours” overstates the geometry. At H16, **sunset is 34 hours away**; the sun does not remain high for all 34 hours.
- **b4:** “the sun hasn't moved” is too literal. It moves **slowly**, not zero. Avoid a frozen-sun visual claim.
- **w2 / w4:** stronger and “wilder than anything” weather predictions are speculative. Keep physical mechanisms distinct from uncertain magnitudes/outcomes; soften unsupported certainty.
- **n4:** power from another part of the planet is one possible response, not the only option. Dispatchable generation, storage, and demand adaptation also matter. Avoid implying that all solar-dependent places must simply go dark.
- The original `SOURCES.md` records baseline claims but did not provide external source URLs. See `handoff/SOURCE_LINKS_AND_PENDING_CORRECTIONS.md` for verified links; verify the current source notes and do not treat an unsupported script claim as established evidence.

The HUD clock must never rewind. Required sequence: c1 H16→17; c2 HUD hidden; c3 H17→38; c4 H38→50; c5 H50→66; c6 H70→86; c7 H100 sunrise then years; c8 HUD gone. Make time jumps visibly intentional. Check c4's linear H38→49.9 map against the “hour forty” narration.

**c5 requires deliberate handling:** n6 is late in the narration but says sleep eight hours and wake with 42 hours remaining, which means H50→58. An unimplemented solution is to keep H50 at sunset, hide the story HUD for clearly explanatory n2–n5 cutaways, then show sleep/time lapse H50→58 and stars H58→66. Do not start at H58 and later rewind to H50.

**c7 needs a local H100 HUD fix:** the shared `TOD.hud` wraps 100 to 0. Ensure c7 displays 100 at sunrise before the HUD leaves; do not show a new H00. Then switch unmistakably to years-scale ocean redistribution. The water and slow solid-rock response occur over different timescales; no invented kilometre displacement figure. Freezing in c5 and weather outcomes in c6 must remain hedged where the narration is hedged.

## Style and engine constraints

- Same faceless black head, two white eyes, red hoodie, black pants; use `MASCOT` and `reference/brand/`. Strong reactions, clear intentions, purposeful attempts and consequences. Close/medium shots with a large host; wide shots only when scale matters.
- One continuous survival journey: make it to the next sunrise. Minimal text; primarily HUD and necessary in-world objects/numbers. At most one gag per chapter.
- Quiet, sparse, varied SFX tied to the scene. The user repeatedly rejected loud repetitive whooshes. No whoosh on every cut. Music should leave room for the same approved narration voice.
- Hard cuts are the default. `full.js` owns post-processing and specified boundary dips; chapters do not add their own boundary fades.
- Deterministic 1920×1080 Canvas 2D, pure function of time; no random wall-clock state, timers, frame-order dependence, or per-frame expensive filters. Wrap chapter code in IIFEs and register `CH.<id>`. Keep shared APIs stable.
- Channel: **What If Labs**. CTA wording is “hit like and subscribe.” No invented “part 2.” The thoughts teaser is a separate next-video idea, not part 2 of this film.

## Video #1 Short

Work under `FutureSight/shorts/`. `plan.mjs`, generated `plan.json`, `cams.json`, `vharness.js`, and `vrender.mjs` define the vertical edit. **The current plan duration is 50.38 s.** Use `work/words.json` as the cached transcription/alignment and `work/audio_plan.json` for the matching audio cuts. `METADATA.md`, `metadata.json`, and `short_cover.png` are present.

An older locally rendered `FutureSight_Short.mp4` was stale relative to the current plan. Do not assume any old MP4 is the final current edit, and do not trust the metadata's filename as proof that it exists or is current. A newer **silent** render may be supplied separately; check the verified status, download command, and checksum in `handoff/ASSETS.md` before using it. It still needs matching audio and audiovisual review.

The exact published-video audio is preserved as `FutureSight/assets/published_mix.flac`; the packaged `shorts/audio.py` supports it as a fallback to the original WAV. Check asset availability before audio assembly. Regenerate plans only from the current source/cached words, then render or reuse a verified matching silent picture, assemble audio, normalize/mux, and verify the full 50.38 s with captions and rescue action readable in the vertical crop. Review metadata against the final content. Do not upload it.

## Setup and verification

Run from the repository root:

```bash
bash tools/setup-cloud.sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
```

The setup supports cloud rendering; preserve the existing engine. Do not depend on the old absolute Windows Playwright/model paths. Cached narration avoids a new model download or voice change. See `handoff/ASSETS.md` before requesting or regenerating media.

From `HundredHourDay/`, existing render entry points include:

```bash
node render.mjs --page index_full.html --stills "c5_review:130.611"
node render.mjs --page index_full.html --contact "130.611,132.111,133.611" --contactout c5_review --cols 5
node render.mjs --page index_full.html --from 130 --to 132 --out out/c5_motion_check.mp4 --sub 2
node sfx_full.mjs --check
```

The examples are inspection samples, not a complete QA pass. Use global seconds for rendering and unique names for parallel output. After completion, render with `--to 304.5` explicitly; the renderer's inherited default duration is not the full film. The audio tool's `--mux` / `--mux-only` options use its documented output filenames.

`reference/partial-qa/` records the **source snapshot**, including c1–c4 samples and runtime data. It is not a finished review. The debug audio check passed numerical loudness/integrity checks (−16 LUFS, −2.4 dBTP, no clipping/NaNs; VO above music) but used test cues and was **not listened to**. No complete final film was watched or heard. Slow runtime outliers in the partial report also need evaluation after setup.

Completion requires: chapter error sweeps, monotonic HUD checks, deterministic frames, contacts around 1.5-second intervals, full-resolution key frames, eye direction and hand/prop contact review, meaningful motion/performance samples, then a full picture-and-sound review of each final video. Check speech clarity, repetitive effects, chapter joins, caption timing/crop, final CTA, and ending silence. Report remaining limitations honestly.
