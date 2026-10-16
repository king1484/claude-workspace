# SCROLL — research, claims and packaging (v1)

## What the research supports (and what it doesn't)

| Topic | What I found | How the film uses it |
|---|---|---|
| Endless feeds and stopping cues | Adam Alter argues that infinite scroll removes the natural cues that prompt people to stop ([NYU Stern](https://www.stern.nyu.edu/experience-stern/news/professor-adam-alter-shares-how-design-social-media-platforms-encourages-excessive-use-his-book)). One critical write-up notes there is no controlled experiment comparing infinite scroll with paginated feeds ([HOS Documentary](https://hosdocumentary.com/articles/infinite-scroll), a secondary source). | The film states only what is visible: the feed has no bottom. It does not claim a measured effect. The shaft is a visual metaphor. |
| Who invented infinite scroll | Disputed; one source cites a 2006 patent, another credits Aza Raskin, who says he regrets it. | Not mentioned anywhere. |
| Evening screen use and sleep | A 2024 meta-analysis of 55 papers (about 41,700 people) found electronic media use linked to worse sleep quality, pooled effect about 0.28 for general use and 0.33 for problematic use ([JMIR / PMC11077410](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11077410/)). A 2025 scoping review found a small but consistent link ([PMC12840076](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12840076/)). The evidence is mostly correlational. | No statistic on screen. The description mentions it carefully as "linked to", never "causes". |
| Slot-machine comparison, variable rewards | Common in commentary and design writing, not in controlled studies; one quote about pull-to-refresh could not be attributed. | The lever in shot 9 is a labelled-nowhere visual metaphor. The description says "often compared to". |
| Hooks and retention | Secondary guides agree on the same advice: skip setup, open on something visual, create a question, treat the first 30 seconds as the key window. Their numeric benchmarks conflict (65–70% at 30 s), so I treat them as unverified. | Cold open at the worst moment, question card at 0:05, visual teaser by 0:14. |

Nothing in the film asserts a number from outside the story. The only figures are the story's own clock and "Screen time 7h 12m".

## Measured against the references

From `reference/competitors/ANALYSIS.md`:

- Our previous video held 155 spoken words per minute at a constant -14 LUFS (0.4 LU variation), 47% mean saturation and 20+ locations.
- The references use near-zero speech, 15–27% saturation, 6–8 locations, and 1.4–4.2 LU of loudness variation.
- SCROLL: zero speech, under 25% saturation until the colour payoff, one bedroom plus one street, 6+ LU of variation.

## Packaging (to test, not guaranteed)

- **Title A:** `SCROLL | An Animated Short Film`
- **Title B (test):** `The Feed Has No Bottom | An Animated Short Film`
- Thumbnail tests (one word at most, one idea each):
  1. The man in bed, lit blue, his shadow asleep on the wall behind him.
  2. The bottomless shaft with icons falling.
  3. Close-up of the thumb on the lever.
- Do not reuse the split before/after layout or the raincoat colour reveal from the reference thumbnails.
- **First comment (pinned):** "What time is your last swipe tonight?" A concrete question that invites a short answer.
- **Description:** two lines on the idea, "Decide where it ends", then the sources above, then credits for any CC-BY material.
- **Shorts (about 45 s each, vertical):** (1) the lever and the eight tiny worlds; (2) the coin that never lands, ending with the clink; (3) the charger walk and the sticky note. Each ends on the clink or the note, not a logo.

## Production plan

1. Approve this script, sound design and look.
2. Build the animatic (960×540, placeholder sound) and check pacing against the targets in `SCRIPT.md`.
3. Stills for each shot, contact sheet, critique pass (hook, phone-size readability, motion, colour rule, sound sync).
4. Full animation on the existing deterministic Canvas 2D engine (springs, eased overshoot, 2.5D parallax, phone-glow lighting, motion blur).
5. Score and SFX per `SOUND_DESIGN.md`; mix to the targets; listen at three volumes.
6. Verify with `tools/analyze_reference.py` against the targets; deliver the MP4, Shorts, thumbnails and credits. No upload by me.

## What I need from you (optional but it improves the result)

1. A sampled piano file (free options above), or a track you have the rights to.
2. A Freesound API key, only if you want real recordings instead of synthesized foley.
3. Approval, or edits, on the script.
