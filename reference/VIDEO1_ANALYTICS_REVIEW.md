# Claude handoff: improve video 2 using video 1's actual analytics

Prepared on 16 October 2026 (IST) for What If Labs.

## What to do with this README

Use this as the user's feedback brief for the next video, **What If One Day Lasted 100 Hours?** Read the existing project and preserve useful work. Correct the script and story structure first, then update narration, scene timing, animation, music and sound effects to match. Recheck the current project state before editing because production may have continued since this review.

The main priority is **sustaining interest after the opening**. Bring consequences forward, reduce repeated explanation, make each scene change the situation, and review the finished audiovisual experience. More effects or a shorter runtime alone will not solve this.

Evidence labels used below:

- **Verified:** directly read from YouTube Studio in the signed-in Opera browser, the public video listing, or the local project/session files.
- **Interpretation:** a plausible explanation supported by those observations, but not a proven reason for YouTube's distribution decisions.
- **Recommendation:** an editorial or production choice to test, not a guaranteed growth formula.

## 1. Source material and project locations

### Published video

- Title: **What If You Could See 10 Seconds Into the Future?**
- Channel: **What If Labs**, handle `@whatiflabsvideos`.
- URL: https://www.youtube.com/watch?v=2LQMDJMO8ds
- Published: **14 October 2026**.
- Runtime: **6:01**.
- Studio: https://studio.youtube.com/video/2LQMDJMO8ds/analytics/tab-overview/period-default
- Project: `C:\Users\Vinay Singirikonda\Projects\FutureSight`
- Reviewed files: `script.json`, `vo_script.json`, `shots\full_contact.png`, and `out\audio_report_full.json`.
- Final upload file identified by the Claude session: `out\FINAL_What_If_You_Could_See_10_Seconds_Into_the_Future.mp4`.

### Claude Code session reviewed

`C:\Users\Vinay Singirikonda\.claude\projects\C--Users-Vinay-Singirikonda\aa5b1fe3-5b1d-4953-9fe2-97908d8e7398.jsonl`

The session contains the development of FutureSight and the start of HundredHourDay. This review read relevant messages and project files; it did not independently watch or listen to the whole final upload. Frame-based observations and audio measurements must not be described as a complete playback review.

### Next video

- Project: `C:\Users\Vinay Singirikonda\Projects\HundredHourDay`
- Script: `script.json`
- Timing: `layout.js`
- Shared brief: `docs\V2_BRIEF.md`
- Existing production contracts: `docs\CONTRACT.md` and `docs\CONTRACT_FULL.md`
- Existing visual/audio modules include `tod.js`, `mascot.js`, `globe.js`, `sfx_full.mjs`, and chapter files under `ch\`.

Retain the user's preferences: the same red-hoodie mascot, cartoon 2.5D style, minimal useful text, the same narration voice (`am_michael`, currently speed `1.06`), better music, and subtle scene-relevant SFX. The user requested roughly 5–6 minutes, but the current generated timeline is about 4:42. Raise the runtime tradeoff honestly; do not pad the video to hit a number.

## 2. Verified analytics snapshot

These values were read on 16 October 2026. Unless specified otherwise, the Studio range was **Since published, 14 October 2026–Now**. They are a snapshot, not a live report.

| Metric | Value | Qualification |
|---|---:|---|
| Views | 518 | Overview and Reach |
| Engaged views | 499 | Engagement tab; a separate metric from total views |
| Thumbnail impressions | 8,303 | Detailed traffic-source table |
| Thumbnail click-through rate | 4.3% | Overall eligible impressions |
| Watch time | 13.0 hours | Since published |
| Average view duration | 1:33 | Overall Engagement/traffic table |
| Retention-report average duration | 1:32 | Separate lifetime retention card |
| Average percentage viewed | 25.6% | Lifetime retention card |
| Retention near 0:30 | 58% | Studio explicitly described this as **typical** |
| Retention at 1:57 | 33.3% | Exact tooltip in the user's original screenshot |
| Flagged dip | Starts around 2:11 | Selecting Studio's Dip chip sought to 2:11 and highlighted a short interval; exact end was not extracted |
| Retention near the ending | Approximately 5–10% | Visual estimate from the curve, not an exported exact value |
| Subscribers gained | +2 | Since published |
| Views from YouTube recommendations | 495 / 95.6% | Overview: Up next plus YouTube Home |
| Likes versus dislikes | 100% positive | Small sample; not evidence that every viewer liked the video |
| End-screen element click rate | 0.0% | Does not by itself explain the limited reach |
| Hype | 0 hypes / 0 points | Not a primary diagnosis |
| Remixes | Nothing to show | Not a primary diagnosis |

The earlier public listing showed 516 views, 4 likes and 1 comment. Studio later showed 518 views. Treat that as a later snapshot, not a contradiction.

### Traffic-source performance

| Source | Views | Share of views | Impressions | CTR | Average view duration |
|---|---:|---:|---:|---:|---:|
| Suggested videos / Up next | 467 | 90.2% | 8,066 | 4.2% | 1:35 |
| Browse features / Home | 28 | 5.4% | 220 | 4.1% | 1:12 |
| Channel pages | 9 | 1.7% | 9 | 88.9% | 1:29 |
| Other YouTube features | 6 | 1.2% | — | — | 0:06 |
| Direct or unknown | 3 | 0.6% | — | — | 0:31 |
| External | 3 | 0.6% | — | — | 0:22 |
| YouTube search | 2 | 0.4% | 8 | 0% | 5:59 |

Percentages are rounded. Views and impression-derived views are not identical populations; do not force `views = impressions × CTR`. Do not generalize from the two search views or nine channel-page views. Suggested videos generated approximately 12.4 of the 13.0 watch hours, so this is the most useful source to diagnose.

External sites/apps showed WhatsApp as 100% of the **external subset**, which was only 0.6% of all views.

The impressions and views curves rose sharply and then flattened around the first one-and-a-half days. The realtime chart showed a burst followed by much lighter activity. This verifies a slowdown in exposure/activity, not the algorithm's reason for it.

### Content suggesting the video

The visible examples included:

- `I Kicked Christen Out of the House!` — 3.4% in the suggesting-content card.
- `World Records That Should Not Exist..` — 3.4%.
- `What happened to FOLTYN..` — 2.3%.
- `Exploring Abandoned Movie Locations on Google Maps!` — 2.3%.
- `I Tested WEIRD BANNED Cat Gadgets on My Kittens (AGAIN)` — 2.3%.

These are small shares of the card's suggesting-content breakdown, not a complete audience profile. They indicate varied entertainment contexts. They do **not** prove that YouTube sent the video to the wrong audience or that changing tags will fix distribution.

### A/B test

The test was running, with **13 days 8 hours left** and **“Not enough information to display data.”** There was no winner or usable watch-time-share result.

| Variant | Title |
|---|---|
| 1 | What If You Could See 10 Seconds Into the Future? |
| 2 | What If You Knew the Future 10 Seconds Early? |
| 3 | What If You Could Predict Everything 10 Seconds Early? |

Each variant also displayed a different thumbnail. This is a comparison of title/thumbnail combinations; it cannot isolate which element caused a difference. All three titles make similar promises.

Studio's own explanation says the winning variant is selected by **watch-time share**. Do not choose a winner based solely on clicks, and do not claim a winner while results are unavailable.

### Audience details and processing limits

- Unique viewers displayed **87**, with **two days of data still processing**. Do not divide 518 by 87 to infer repeat viewing.
- Device shares were by **watch time**, not viewer count: tablet 45.5%, mobile 22.6%, TV 17.8%, computer 12.9%, other 1.3%.
- Displayed top geography shares: India 13.9%, Philippines 11.9%, Australia 9.9%, United States 9.9%. These are partial early data, not a complete or stable geographic profile.
- Subtitle/CC shares: no subtitles 70.3%, English 29.7%.
- Age/gender, audience watch behaviour, and viewers-also-watch lacked enough data. Subscriber watch-time breakdown had nothing to show.
- Full typical-retention comparison was unavailable, even though the intro card specifically classified 58% at 30 seconds as typical.
- The Reach funnel card covered only **14 October**, showing 1.5K impressions, 5.1% CTR, 75 engaged views from impressions, 1:39 duration and 2.07 watch hours. Its narrower/lagged range must not replace the overall 8,303-impression snapshot.

## 3. What the evidence supports

### Highest-confidence conclusion: sustained interest needs work

The audience watches roughly a quarter of a six-minute story. Suggested viewers also average only 1:35, so a few low-quality external clicks are not the main explanation. By 1:57, two-thirds of the initial audience is no longer present at that point in the video.

This makes retention a credible contributor to the slowdown. It does not establish that retention is the only factor or reveal a threshold YouTube applied.

### Important correction: do not call the opening an established failure

An earlier assessment placed too much emphasis on a weak hook. The direct Studio reading changes that: **58% at 30 seconds is classified as typical**. Improve the opening where useful, but prioritize the continuing decline afterward and the flagged dip around 2:11.

### CTR is a secondary improvement opportunity

4.3% shows the packaging attracted some clicks. There is no universal CTR pass/fail number independent of traffic source, topic and audience. Do not label the thumbnail a failure from this number alone. Similarly, do not invent a universal 40% retention requirement or promise that a certain number guarantees recommendations.

### Distribution happened, then slowed

8,303 impressions and 95.6% recommendation-sourced views establish that YouTube exposed the video to viewers. “YouTube never pushed it,” “shadowban,” and “the channel is dead” are not supported explanations.

The varied suggesting videos make audience fit a reasonable hypothesis to consider, not a finding to present as fact.

## 4. What to learn from the FutureSight script and production

### Story progression

Published chapters:

| Time | Section | Editorial concern |
|---|---|---|
| 0:00 | Hook | Demonstrates the premise; could also establish a question worth following |
| 0:11 | Rules | Additional explanation after the premise is already understood |
| 0:30 | Morning | Coffee, inconveniences and dodging illustrate benefits |
| 0:58 | Reflexes | More examples of the same advantage |
| 1:29 | Chase | Changes the setting but continues the unbeatable-power pattern |
| About 2:11 | Flagged dip begins | Near the end of the chase, just before Money |
| 2:13 | Money | Another success sequence before a serious limitation |
| 2:40 | Quake | Higher stakes finally arrive |
| 3:34 | Child | A personal rescue raises emotional stakes |
| 4:03 | Cost | The core downside arrives after most viewers have left |
| 4:38 | Loop | Changes the interpretation of the power |
| 5:21 | Nothing | Final mystery and closing ask reach few viewers |

**Interpretation:** coffee, sports, traffic and money repeatedly answer “what could this power help you do?” The more compelling question—“what can it not solve, and what will it cost?”—arrives late. Each new scene needs to develop the situation, not merely replace the background.

The marked dip's proximity to Money is a reason to review the end of the chase and the transition. It is not proof that the Money topic itself caused abandonment. Viewers may leave or skip, and earlier accumulated boredom can surface at a boundary.

### Visual presentation

The reviewed frame sheet often used wide street scenes with a relatively small mascot and recurring dusk backgrounds. The session itself recorded known weaknesses including a morning that looked like dusk, character overlap/static sprites in the chase, plain casino staging, and heavy quake dust. Some were acknowledged before later revisions; verify the final state rather than assuming every old defect survived.

Recommendations:

- Use close and medium views for decisions, reactions and consequences; reserve wide views for information that needs scale.
- Make the important action readable at a small playback size.
- Give the mascot an intention, an attempt and a reaction. Avoid having him simply stand next to narration.
- Make time of day, geography and lighting match the story.
- Vary composition and action when the meaning changes. Camera motion every 3–5 seconds is not a substitute for story progression.
- Minimal text should still allow essential numbers, time labels and causal diagrams to be clear.

### Audio and review process

The user twice complained about loud/repetitive whooshes, including stacking around 4:20. The session later reported revisions, eventually down to three whooshes. Do not claim the current uploaded mix still has the original problem without listening.

The audio report showed approximately -14.1 LUFS integrated, -1.7 dBTP true peak and no clipped samples. These technical results do not establish that the effects are pleasant, varied or emotionally appropriate.

Claude repeatedly stated it checked still frames and loudness numbers but did not watch/listen to the final video. That leaves an important quality-assurance gap. The next delivery must distinguish technical validation from actual playback review.

## 5. Priority changes for HundredHourDay

### P0 — Fix story progression before polishing more assets

The current `layout.js` has this structure:

| Current timing | Chapter | Action |
|---|---|---|
| 0:00–0:22 | Hook | Show a concrete problem immediately; shorten meta-promises |
| 0:22–0:56 | The Rule | Compress explanation and interleave it with a consequence |
| 0:56–1:30 | Body Clock | Move the first personal difficulty earlier |
| 1:30–2:12 | Long Day | Give the host a goal and a failed attempt, not just a list of heat effects |
| 2:12–2:55 | Long Night | Make the transition feel like a new problem that defeats the prior solution |
| 2:55–3:27 | Weather | Integrate it into the host's journey; avoid an unrelated late lecture |
| 3:27–4:20 | Oceans | Keep only a defensible payoff; clearly distinguish years from the 100-hour cycle |
| 4:20–4:42 | Wrap | Resolve the central question, then make one short CTA |

Times are rounded from the current generated layout and will change after rewriting.

The existing hook plus rules occupies about **56 seconds before the Body Clock chapter begins**. This risks repeating video 1's extended setup. Do not spend most of the first minute promising what will become interesting later.

Recommended progression:

1. Start with the mascot experiencing the mismatch: tired after a familiar day's routine, with strong daylight still outside.
2. Establish the 100-hour premise in one or two short lines while the first consequence unfolds.
3. Show the host trying a solution—sleeping, finding shade, using artificial light or storing power—and encountering a new limitation.
4. Make the transition to night overturn an earlier assumption: relief from sunlight creates a different practical problem.
5. Connect weather/coastal consequences to that journey rather than introducing a disconnected list.
6. Deliver a source-supported ocean explanation with an explicit change of timescale if retained.
7. Answer how people could adapt, including uncertainty, before asking for engagement.

Suggested opening direction, to rewrite in the project's voice:

> Your body is begging for sleep. Outside, it's still broad daylight. On this Earth, one day lasts a hundred hours. How do you live when the sky and your body run on different clocks?

Show the conflict in the same seconds it is narrated. This is an example, not a required verbatim script. Tease the ocean payoff only after its scientific basis is checked. Avoid “Stick around” and “We'll get there” if a specific visual question can do the work.

### P0 — Correct factual and continuity issues in the current script

The following are **review flags**, not a completed scientific literature review. Verify material claims using authoritative sources before keeping them in narration. Store citations, assumptions and any calculations in project notes.

| Location | Current issue | Required correction/check |
|---|---|---|
| c1 h1–h2 | The noon sun is described as not going anywhere for 25 hours | It moves slowly across the sky. Under the project's simplified schedule, sunset is 25 hours after noon; it does not remain overhead throughout. Align animation and narration. |
| c2 r2 | “Turn that down four times” makes 24 hours become 100 | 100/24 is about 4.17. “A little over four times slower” or “roughly a quarter of today's speed” is adequate. Use approximately 400 km/h only as a rounded equatorial illustration; do not imply exact equality. |
| c2 r4 and global clock | Exactly 50 hours of daylight and 50 of night everywhere | Declare a simplified near-equatorial/equinox setting. Latitude and season affect the split. Distinguish the solar day from the rotation period if doing precise calculations. |
| c2 r3b | Venus's “day” is given as 117 Earth days | Identify this as the solar day and verify the source; do not confuse it with the sidereal rotation period. Keep the aside only if it helps the scene. |
| c3 b1 | Sunrise is exactly eight minutes instead of two | Sunrise duration depends on latitude, season and definition. Qualify or remove exact values unless the setting/calculation supports them. |
| c3 b4b | Cave/bunker experiments supposedly show a hard 28-hour body-clock limit | Source and accurately describe the actual experiments. Avoid treating a complex circadian result as a universal limit. |
| c4 d2–d3 | 70°C, burning pavement, crops “cooking” | Distinguish ground/surface temperatures from air temperature. Do not present an unsupported climate simulation as a measured consequence of this scenario. |
| c4 d5 | A slower shadow is presented as why it can be walked alongside | Check the physical/geographic assumptions. Treat a shade-following gag as a local scene, not a universal survival law. |
| c5 n2–n3 | The same desert necessarily freezes after extreme daytime heat | Conditions depend on atmosphere, cloud, humidity, location and thermal inertia. Source or qualify the claim. |
| c5 n4 | “Solar panels? Dead, for fifty hours” | Panels generate no direct solar power during local darkness, but are not broken. Explain storage, other generation and grid transfer without an unsupported universal blackout. |
| c5 n4b | “Nothing alive is built for a night this long” | Remove the absolute claim; life already experiences prolonged polar darkness. Explain which organisms or behaviours would face adjustment. |
| c5 n5 | Sleep eight hours in a 50-hour night, then “Forty more hours” | If sleep starts at sunset, **42 hours remain**. If keeping 40, establish the additional two hours in the timeline. |
| c6 w2–w4 | Broad hurricane changes, cold-to-hot winds, and wind lasting 40 hours | Check the dynamics and assumptions. A change in rotation affects circulation, but does not justify every specific storm, direction or duration asserted here. |
| c7 o2–o6 | Several-kilometre sea-level shifts and countries drowning | Recheck the model, fixed-versus-relaxing solid Earth, ocean mass redistribution, geography, rate of slowing and timescale. A 21 km equatorial radius difference is not directly an ocean-depth displacement. “By my rough math” is insufficient support for spectacular claims. Remove numerical magnitudes if the model cannot substantiate them. |
| c7 and clock HUD | Long-term ocean readjustment appears inside one 100-hour survival story | Clearly signal a transition to years or longer. Do not animate the whole claimed redistribution as happening before hour 100. |
| c8 e2 | “Humans would survive, barely, underground and near the oceans” | This is too definitive without a model and conflicts with the preceding coastal-flooding claims. Explain possible adaptations and uncertainty consistently. |
| c8 e5 | Announces the mind-reading video as “Next up” | Confirm that this is actually the intended next release; otherwise use a general closing line. |

Also fix the chronology: Body Clock reaches hour 24, then Long Day begins “By hour twenty.” Either make the overall clock monotonic or explicitly show a short rewind. The hook begins at noon/hour 25 before returning to sunrise/hour 0; that jump must be immediately understandable. A persistent HUD becomes confusing if its jumps are unexplained.

### P1 — Direct animation around meaning and character

- Use the existing expressive mascot and time-of-day modules where they work; avoid unnecessary rebuilding.
- Alternate close reaction, medium action and wide context based on the story beat.
- A visual change should reveal a consequence, decision, result, comparison or scale. Do not add arbitrary zooms just to satisfy an interval.
- Make one gag serve the scene; do not force a joke that delays the point or clashes with serious stakes.
- Check silhouettes, overlapping characters, eye direction, hand/prop contact and readability of the action.
- Keep dawn, noon, sunset and night visibly distinct and consistent with the HUD.
- Use the globe/diagram to explain a defensible mechanism. Mark exaggerated scale where needed; do not present illustrative maps as calculated forecasts.
- The current brief specifies a dip to black at every chapter boundary. Review each transition: use continuous action/audio or a motivated cut where black would unnecessarily signal a stopping point. Coordinate any change in the shared engine, not independently in every chapter.
- Treat “25–60 cues per chapter” as an implementation allowance, not a quota. Add only cues the scene benefits from.

### P1 — Improve music and SFX through listening

- Keep the same narration identity. Improve sentence rhythm, emphasis and pauses before attempting to fix pacing by speeding up the voice.
- Use the proposed recurring music motif with meaningful changes in mood/instrumentation. Avoid six similar minutes of an unchanging bed.
- Keep narration intelligible at a low playback volume. Evaluate music and effects during speech, not just their separate peaks.
- Use scene-specific sounds sparingly: fan, fabric, footsteps, crickets, a power-down, water, distant thunder. Natural sounds can also become repetitive if attached to every movement.
- Do not place a whoosh on each camera move, chapter cut or text appearance. Avoid stacked effects and abrupt loudness jumps.
- Let important consequences have room to land. Brief intentional quiet can help; dead air and long delayed outros do not.
- Listen on headphones and ordinary speakers where available. Check the most crowded mix moments separately, then replay the full export.

### P2 — Packaging and captions

- Make the next video's title and thumbnail promise a consequence the opening actually delivers.
- Use one dominant visual idea and a readable mascot reaction. Avoid tiny secondary objects and competing labels.
- For a future test, compare meaningfully different accurate angles: the unusual premise, the survival problem, or a verified unexpected consequence. Do not exaggerate unverified ocean/climate claims to increase clicks.
- Keep accurate English captions. The early data showed meaningful CC use; check timing and scientific terms rather than relying on unreviewed automatic captions.
- Leave the current video's running A/B test to gather information. The user asked for improvements to the next video; no deletion or re-upload of video 1 is recommended by this review.

## 6. Production and review checklist

Use these as review criteria. They are not predictions of future retention.

### Before revising scenes

- [ ] Review the current script and layout, including any changes made after this snapshot.
- [ ] Address the factual/continuity flags above and save sources for consequential claims.
- [ ] Establish an observable personal problem in the opening rather than only a promise.
- [ ] Reduce the standalone rules/setup section; make the first consequence happen well before the current 0:56 boundary.
- [ ] Give each section a new development and a reason to continue.
- [ ] Make the 100-hour chronology and any switch to long-term consequences explicit.
- [ ] Resolve the central question before the CTA.

### After script edits

- [ ] Regenerate changed narration and then rebuild timings; do not sync new scenes against old `layout.js` values.
- [ ] Update `docs\V2_BRIEF.md`, chapter assignments and shared time mappings consistently.
- [ ] Reuse correct existing assets; fix staging and content where necessary.
- [ ] Check chapter joins for unintended black gaps, repeated fades, abrupt music changes and overlapping narration.

### Final review

- [ ] Watch the full rendered video continuously at normal speed and log moments that feel repetitive, confusing or slow.
- [ ] Listen to the final mixed export, including dense SFX sections and transitions.
- [ ] Review the opening minute and approximately two-minute region especially carefully; do not treat them as the only regions that matter.
- [ ] Check small-screen readability and large-screen presentation where practical.
- [ ] Confirm captions, on-screen values, clock state and narration agree.
- [ ] Check technical export integrity, clipping and audio/video sync separately from editorial quality.
- [ ] If the agent cannot actually watch or listen with available tools, state that limitation and provide precise review points for the user. Never claim that stills/loudness checks complete this step.
- [ ] Deliver the final video, final script, source notes and a concise change summary listing any unresolved issues.

## 7. What to measure after the next upload

Compare at similar age and by traffic source. A larger/new audience can change CTR and retention even when the video improves.

- Overall and Suggested/Browse impressions, CTR and average view duration.
- Retention at 30 seconds, one minute and two minutes, plus flagged dips.
- Whether viewers survive the first explanation section and the transition to the second major problem.
- Average percentage viewed and the proportion reaching the main payoff.
- Subscriber gains and substantive comments, interpreted with sample size in mind.
- A/B watch-time-share results only after the test has enough information.

Baseline to improve: **58% at 0:30, 33.3% at 1:57, 25.6% average viewed, and 1:35 average duration from Suggested videos**. These are this video's observations, not universal benchmarks. Do not promise a particular number of views, a CTR threshold, or that one edit will restart recommendations.

## 8. Requested response from Claude after applying this brief

Report:

1. What changed in the opening and first two minutes, with the resulting timings.
2. Which repeated explanations were cut or combined and where stakes now escalate.
3. Which factual claims were corrected, qualified or removed, with source notes.
4. What changed in character staging, transitions, music and SFX.
5. Which checks were performed by actual playback and which were only technical/frame checks.
6. The final runtime, output location and any remaining issues requiring review.

The aim is a clearer, more engaging and defensible video. Retention improvements must come from the experience viewers actually receive.
