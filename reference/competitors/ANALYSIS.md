# Reference analysis: three silent-story / narrated animations

Measured on 16 October 2026 with `tools/analyze_reference.py` from the files the user supplied (720p AV1/Opus YouTube downloads). Raw data: `*.json`. Frame sheets: `*_sheet_N.jpg`.

| Video | Length | Role |
|---|---|---|
| Last Soul, "1 MINUTE" (`NeWlC4bJTMs`) | 4:59 | Reference 1 |
| "DISCIPLINE" (`8atK0pF4oJY`, title card read from the last frames; channel inferred as Day One Films, not confirmed) | 2:38 | Reference 2 |
| What If Labs, "What If You Could See 10 Seconds Into the Future?" (`2LQMDJMO8ds`) | 6:01 | User's own |

## What was and was not verified

- **Measured from the files:** cuts, shot lengths, frame-to-frame motion, colour saturation, loudness per 10 s, silences, caption word counts.
- **Seen on contact sheets (stills only):** layout, palette, text style, story structure.
- **Not verified:** views, retention or CTR of the two references. Nothing here shows that these traits *cause* reach. Nobody has *listened* to the audio; loudness figures are measurements of YouTube-transcoded files.
- Cut detection under-counts in dark footage. DISCIPLINE gave 5 cuts at the default threshold (0.30) but 24 at 0.10, which matches the sheets. Compare cut counts across videos with care.

## Side by side

| Measure | 1 MINUTE | DISCIPLINE | What If Labs (yours) |
|---|---:|---:|---:|
| Cuts | 61 | 24 (thr 0.10) | 44 |
| Median shot | 3.4 s | 1.6 s (bursty) | 6.6 s |
| Distinct locations | about 6, reused | about 8, reused | 20+ |
| Mean motion (relative) | 15 | 8 | 23 |
| Mean colour saturation | 15% (range 3–48) | 27% (11–55) | 47% (19–73) |
| Loudness, integrated | -18.0 LUFS | -16.5 | -14.1 |
| Loudness spread across 10 s buckets (std dev) | 4.2 LU | 1.4 | 0.4 |
| Spoken words | 9 | 31 (short refrain) | 934 (155 words/min) |
| Silences of 0.4 s or more | 5 | 1 | 1 |

## Findings

1. **Contrast, not intensity.** 1 MINUTE runs about 60 s loud, then a long quiet stretch (about -22 to -25 LUFS) with swells near the end. Yours sits within 0.4 LU of -14 for 6 minutes, with continuous narration and constant motion, so nothing stands out.
2. **Colour is story.** Both references are near-monochrome (1 MINUTE averages 15% saturation). In 1 MINUTE, saturation rises only at the reward (yellow raincoat, green hill, blue sky). Yours is saturated from the first frame.
3. **A small, reused world.** Both references return to the same few rooms and end where they began (1 MINUTE: shoe store to shoe store). Yours introduces a new setting roughly every 15 s.
4. **Wordless storytelling.** Story is carried by acted beats and a few on-screen words (at most about 8 at a time, in a handwritten-style font above the character's head). Both use black quote or title cards.
5. **An inner antagonist.** DISCIPLINE gives the critic a red voice and body ("you're lazy"). Red appears only for the antagonist. Day counters (DAY 1, DAY 64, DAY 365, back to DAY 1) compress time.
6. **Emotional valley.** Both reach a low point (a character curled in a spotlight, a failed calendar of crosses) before the turn. Your video's low point (the "nothing" ending) comes after most viewers have left.
7. **Length is not the problem.** 1 MINUTE runs five minutes with 61 cuts.

## Implications for the new channel

- Monochrome world, one accent colour (the red hoodie), colour returns as the character acts.
- One or two recurring rooms, bookended.
- Piano with a deliberate quiet middle and a swell at the payoff. Target roughly -16 LUFS integrated with a 6 LU spread.
- No narration. Text in-world, at most about 8 words at a time.
- Low point by about 40% of the runtime, not at the end.
- Do not copy the yellow-raincoat reveal or the character designs; use the red hoodie.
