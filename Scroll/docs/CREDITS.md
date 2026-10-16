# SCROLL — credits and licences

Every outside asset is logged here with its source and licence before it is used. Nothing is used until it appears in this table.

| Asset | Source | Licence | Credit required in the video description |
|---|---|---|---|
| Piano samples | Salamander Grand Piano V3 (Yamaha C5, 16 velocity layers) by Alexander Holm, from FreePats: https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html | CC BY 3.0 (stated on that page) | "Piano: Salamander Grand Piano by Alexander Holm, CC BY 3.0" |

Fetch with `Scroll/tools/fetch_piano.sh` (checks the archive's SHA-256).

## Sound-effect sources (status checked 16 October 2026 from the cloud environment)

| Source | Reachable | Notes |
|---|---|---|
| Mixkit | Yes, test file downloaded | Licence text not yet read; read it before use |
| Wikimedia Commons | Yes (search API works) | Mixed licences; check each file; avoid share-alike unless acceptable |
| Internet Archive | Yes (search works) | Mixed licences; check each item |
| Kenney, OpenGameArt | Pages load; direct downloads not yet tested | Kenney packs are CC0; OpenGameArt is mixed |
| Freesound | Site loads; API returns 401 | Needs an API key for CC0-filtered search and previews |
| BBC Sound Effects | Loads | Terms limit free use to personal/educational projects, so not usable for a monetised channel |
| Zapsplat, Sonniss, Pixabay | 403 | Blocked from this environment (policy or the sites' own bot protection; not verified which) |

## Recordings used in the animatic (Freesound, all licensed CC0, so no credit is required; logged for the record)

| Freesound ID | Title | Author | Used for |
|---|---|---|---|
| 761024 | Very Quiet Indoor Roomtone | IENBA | bedroom room tone |
| 669621 | Rain on window | Nickisawsome74 | rain on the window, 1:58–2:30 |
| 179505 | E.spring, country lane, robin song | AnemoneBlondie | morning birds, from 2:32 |
| 708022 | Kitchen Wall Clock Ticking SFX | Soup_UnderScore | the nightstand clock |
| 335509 | writing-long-sketch-01 | newagesoup | pencil on paper |
| 493457, 493462, 493504 | Clothes Rustling Movement | Joao_Janz | fabric and bedding |
| 557505 | Foley_Object_Flashlight_Headlamp_SingleButton_Mono | Nox_Sound | lamp switch |
| 532775 | roller shade up | twinpix | the curtain |
| 477621 | Power Cord Plug 1_2 | Joao_Janz | the charger plug |
| 699521 | Coin_Drop_26 | Valenspire | the coin (layered under a synthesized bell) |
| 740294 | male walking barefoot on wood floor 1 | FOSSarts | his footsteps |

Everything else (pings, lever, reels, falling whistle, alarm, bells, shimmer, breaths, creaks, street bed) is synthesized in `Scroll/audio/build_audio.py`.
