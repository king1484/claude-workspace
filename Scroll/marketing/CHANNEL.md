# Channel: Unsaid Lessons (@theunsaidlessons)

## Profile picture (ChatGPT prompts)

The profile picture is always the mascot, shown warm and friendly, so the channel feels like a person rather than a logo.

How to use: open ChatGPT, attach the reference images, paste one prompt. Ask for a square image and upload it to YouTube at 800 × 800. YouTube crops it to a circle and often shows it at 24–48 px, so:
- the head and hood fill the middle of the square, with nothing important near the edges;
- no text or letters;
- check it at 48 px before uploading: if you can't see the hood and the eyes clearly, regenerate.

Attach for every option: `refs/ref7_closeup_red_smile.jpg` (main reference), `refs/ref8_closeup_grey_smile.jpg`, `refs/ref3_character.jpg`

Character description (already inside each prompt):

> The mascot from the attached frames: a perfectly round matte-black head with no mouth or nose, and white eyes that are either two small tall ovals (calm) or two small curved arches like a closed-eye smile (happy). He wears a soft deep-red hoodie with the hood up and two short drawstrings, and has simple rounded mitten-like hands. Flat 2D vector style: soft matte shapes, no outlines, very subtle grain.

### Option 1: The smile and wave (recommended)

```
Create a square 1:1 profile picture for a YouTube channel, featuring the mascot from the attached frames. Keep him exactly as in the references: a perfectly round matte-black head with no mouth or nose, white closed-eye smile arches for eyes (two small curved arches, as in the first reference), a soft deep-red hoodie with the hood up and two short drawstrings, and simple rounded mitten-like hands. Flat 2D vector style: soft matte shapes, no outlines, very subtle grain.

Composition: a friendly head-and-shoulders portrait, slightly from the front, his head tilted a little to one side. He is smiling with his eyes and gives a small, shy wave with one rounded hand raised beside his face. He looks warm, kind and approachable, like a friend saying hello. The head and hood are large and centred, filling most of the middle of the square; nothing important near the edges, because it will be cropped to a circle.

Background: plain soft warm amber, slightly brighter behind his head like the glow of a desk lamp, gently lighting the rim of the red hood.

Bold, simple shapes and strong contrast so it is clear at very small sizes. No text, no letters, no logos, no watermark, no border.
```

### Option 2: The lesson (pencil and lamp)

```
Create a square 1:1 profile picture for a YouTube channel, featuring the mascot from the attached frames. Keep him exactly as in the references: a perfectly round matte-black head with no mouth or nose, white closed-eye smile arches for eyes (two small curved arches, as in the first reference), a soft deep-red hoodie with the hood up and two short drawstrings, and simple rounded mitten-like hands. Flat 2D vector style: soft matte shapes, no outlines, very subtle grain.

Composition: a cosy head-and-shoulders portrait. He looks at the viewer with a content, happy smile in his eyes, holding a yellow pencil in one rounded hand near his chin, as if he has just finished writing something he's proud of. A small warm desk lamp glows just out of frame on one side, lighting one side of his hood. The head and hood are large and centred; nothing important near the edges, because it will be cropped to a circle.

Background: plain deep navy blue, with the warm amber lamplight spilling across it behind him.

Bold, simple shapes and strong warm-versus-cool contrast so it is clear at very small sizes. No text, no letters, no logos, no watermark, no border.
```

### Option 3: The little secret ("unsaid")

```
Create a square 1:1 profile picture for a YouTube channel, featuring the mascot from the attached frames. Keep him exactly as in the references: a perfectly round matte-black head with no mouth or nose, white eyes, a soft deep-red hoodie with the hood up and two short drawstrings, and simple rounded mitten-like hands. Flat 2D vector style: soft matte shapes, no outlines, very subtle grain.

Composition: a playful, friendly head-and-shoulders portrait. He leans in slightly towards the viewer and holds one rounded finger up in front of the lower half of his face in a gentle "shh, I'll tell you a secret" gesture. One eye is a small white closed smile arch and the other a small tall white oval, like a warm wink. He looks kind and a little mischievous, not mysterious or scary. The head and hood are large and centred; nothing important near the edges, because it will be cropped to a circle.

Background: plain soft warm amber, slightly brighter behind his head, gently lighting the rim of the red hood.

Bold, simple shapes and strong contrast so it is clear at very small sizes. No text, no letters, no logos, no watermark, no border.
```

Tips:
- To make him feel human, the eyes matter most: the smile arches read as happy even at tiny sizes. If ChatGPT draws big blank ovals that look empty or creepy, reply: "Make his eyes the small closed-eye smile arches from the first reference."
- If it adds a mouth, nose, or text, reply: "Remove the mouth/nose/text; the face is a plain black circle with only the white eyes."
- Use the same red (about #BC242A), navy and amber in the banner later, so the channel looks like one brand.

## Banner

`channel_banner_2560x1440.jpg` (made with `make_banner.py` from the profile picture `channel_dp.webp`; the exact command is at the top of the script).

- Tagline: *The lessons life never says out loud.*
- The character and text sit inside YouTube's 1546 × 423 safe area, so they show on phones, desktop and TV. The desk at the bottom only shows on TV.
- Upload: YouTube Studio → Customisation → Branding → Banner image → Change, then check the device preview.
