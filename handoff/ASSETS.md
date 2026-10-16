# Assets and preservation

The source branch includes both renderers, all saved chapter code/cues, the existing voice recordings, timing, reference mascot, source/story notes and Shorts metadata.

- `HundredHourDay/out/vo/`: 42 narration WAVs, 26.19 MB. Keep the approved `am_michael` voice.
- `FutureSight/out/vo/`: 79 WAVs, 27.89 MB, plus `out/vo.wav` for the hook.
- `FutureSight/assets/published_mix.flac`: the exact published 48 kHz stereo 24-bit mix, losslessly compressed from `out/mix_full.wav`. The Shorts audio script can read it directly.
- `FutureSight/shorts/work/words.json`: cached word timings; no Whisper download is needed.
- `reference/brand/`: selected channel mascot profile artwork.
- `reference/partial-qa/`: contact sheets captured during the interrupted check. The numeric report completed c1–c3 only. Capturing stills is not a full visual/playback approval.

The WAV and FLAC decode to the same PCM SHA-256 when decoded as signed 32-bit little-endian samples:

`842e30789d89d6a49a306ec0a40a34f9bda2e09a81703b553aea950b8c72a24a`

## Latest rendered Short picture

The latest saved silent render is approximately 151 MB and exceeds GitHub's per-file Git limit. It is preserved separately as the `FutureSight_Short_latest_silent.mp4` release asset under tag `video-handoff-2026-10-16`. It matches the latest saved cut plan; the older final MP4 predates that plan and should not be treated as final.

From the repository root, download the silent picture to the path expected by the audio/mux instructions:

```bash
mkdir -p FutureSight/shorts/work
gh release download video-handoff-2026-10-16 --repo king1484/claude-workspace --pattern FutureSight_Short_latest_silent.mp4 --output FutureSight/shorts/work/silent.mp4
```

For a cloud environment without GitHub CLI:

```bash
mkdir -p FutureSight/shorts/work
curl -fL https://github.com/king1484/claude-workspace/releases/download/video-handoff-2026-10-16/FutureSight_Short_latest_silent.mp4 -o FutureSight/shorts/work/silent.mp4
```

See `file-manifest.json` for source and release-asset sizes/hashes. Rendered full-video versions, duplicate mixes, temporary frames, and model caches are excluded. The original local projects are unchanged. All creative production is left for Claude to resume.

