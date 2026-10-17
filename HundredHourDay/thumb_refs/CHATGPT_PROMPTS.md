# ChatGPT prompts — video #2 thumbnails + titles (3 variants for A/B testing)

Upload these with the first prompt (from `HundredHourDay/thumb_refs/`):
1_style_split_day_night.jpg, 2_hero_hot_day.jpg, 3_hero_freezing_night.jpg, 4_bedtime_sun_outside.jpg, 5_globe_oceans_moved.jpg, 6_hour100_sunrise.jpg
Optionally also attach the review video `WhatIf100Hours_review_720p.mp4`. ChatGPT may only sample a few frames from a video, so the stills are the real reference.

---

## Prompt 1 — context (send first, with the images)

```
I run a YouTube channel called "What If Labs" (animated "what if" science videos). I'm uploading my second video and want 3 thumbnail + title pairs for YouTube's Test & Compare (A/B) feature.

The attached images are frames from the video. Use them as the style and character reference:
- Main character: a cartoon stick-figure man with a round, solid black head and two small white oval eyes (no other face features), a red hoodie, black trousers and dark shoes. In hot scenes he wears a white-and-blue striped sweatband and sweats. In cold scenes he wears a blue knit beanie and an orange-striped scarf.
- Style: clean, flat 2.5D cartoon with soft gradients, warm cinematic lighting, simple shapes, no outlines on backgrounds, and a slight film-grain glow. Keep it in this exact style (not 3D Pixar, not anime, not photo-real).
- Image 1 is a thumbnail I already made (split day/night). One of the three thumbnails must follow this concept.

What the video actually shows (don't promise anything beyond this):
- On an Earth that spins about 4 times slower, one day lasts 100 hours: about 50 hours of daylight, then 50 hours of night (near the equator).
- It opens at bedtime, but the sun is still high and sunset is 34 hours away. The goal is to survive until the next sunrise.
- Hour 40: the ground bakes (the Lut desert already hits about 70 °C ground temperature today). The character flees to the beach and the shade.
- Hour 50: sunset, then a 50-hour night. Deserts could drop below freezing, solar power and batteries run out, city lights flicker off, and the stars barely move.
- Hour 70: wind and storms change, and hurricanes would struggle (a weaker Coriolis effect).
- Hour 100: sunrise; he made it. The big twist: over years, the oceans slide toward the poles, uncovering seafloor at the equator.
- Ending: could people live there? Maybe, with lots of engineering.

Rules for every thumbnail:
- 16:9, 1280x720, readable on a phone at small size.
- At most 4 big words of text, a heavy rounded sans-serif (like Inter ExtraBold or Montserrat Black), yellow or white with a thick dark navy outline.
- One clear focal point. Strong contrast. The character's emotion must be readable.
- Keep the bottom-right corner free of important content (YouTube's timestamp covers it).
- No YouTube logos, arrows pointing at nothing, fake UI or clickbait the video doesn't deliver.

Rules for titles:
- Under 60 characters, curiosity-driven and honest to the content above.
- The thumbnail text should add to the title, not repeat it word for word.

Reply "ready" and wait. I'll ask for each thumbnail separately.
```

## Prompt 2 — thumbnail A (required: split day / night)

```
Thumbnail A, the split concept from image 1, redrawn cleaner and more dramatic:
- The frame is split by a diagonal white line from top-centre-right to bottom-centre-left.
- LEFT, scorching day: a blazing sun, heat shimmer, orange desert sand, cracked ground. The character (striped sweatband, sweat drops flying) is wiping his forehead, exhausted, facing right toward the centre. A tall thermometer is maxed out in red.
- RIGHT, freezing night: deep navy night with a big moon, frost creeping in from the edge, snowflakes. The same character (blue beanie, scarf) is shivering, hugging himself, breath visible, facing left toward the centre. A thermometer is frozen near the bottom in blue.
- TOP, across both halves: small white text "SURVIVE A" and below it huge yellow text "100-HOUR DAY".
- Small labels at the bottom corners: "50 HOURS" in orange on the left and "50 HOURS" in light blue on the right (keep the right one slightly away from the very corner).
Use title: "What If One Day Lasted 100 Hours?"
Give me the image plus 2 backup titles for this thumbnail.
```

## Prompt 3 — thumbnail B (bedtime, but the sun won't set)

```
Thumbnail B, the opening conflict:
- A cosy bedroom at night-time: a wall clock clearly showing 11 o'clock, the bed turned down, a lamp on.
- But the big window behind is blasting bright midday sunlight into the room, with long hard sunbeams.
- The character in his red hoodie stands by the bed, exhausted and squinting, shielding his eyes from the window, with dark tired circles under his white eyes. He looks shocked and fed up.
- Text, top left: huge yellow "SUNSET IN" and below it an even bigger white "34 HOURS".
Use title: "Can You Survive a 100-Hour Day?"
Give me the image plus 2 backup titles.
```

## Prompt 4 — thumbnail C (the oceans move)

```
Thumbnail C, the twist:
- A big, glowing cartoon Earth (like image 5) on a dark starry background, slightly oblate. At the equator a broad band of exposed, sandy seafloor where the ocean has drained away. Water is visibly piled up toward the north and south poles, flooding the far north and south.
- The tiny character (red hoodie, blue beanie) stands on the dry seafloor at the equator next to a stranded sailboat and a fish skeleton, looking up in shock, with a small "!" above his head.
- A subtle curved arrow around Earth showing the spin slowing (a "4x slower" spin feel), but no extra text for it.
- Text at the top: huge yellow "THE OCEANS MOVE".
Use title: "What If Earth Spun 4 Times Slower?"
Give me the image plus 2 backup titles.
```

## Prompt 5 — final pick

```
Now review all three thumbnail + title pairs as a YouTube packaging expert. For each one, tell me in one line what it promises, check that it's honest to the video content I gave you, and name any readability problem at small (mobile) size. Then suggest one tweak per thumbnail. Don't invent statistics.
```

---

### After generating
- Check each image for the character's look (black round head, white eyes only, red hoodie), spelling of the text, and that nothing important sits bottom-right.
- In YouTube Studio > the video > Test & Compare, upload A, B and C. YouTube picks the winner by watch-time share, not clicks.
