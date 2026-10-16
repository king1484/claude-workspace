# What If Labs — video production handoff

Source snapshot for Claude Cloud to continue the work on [`king1484/claude-workspace`](https://github.com/king1484/claude-workspace), branch **`claude/youthful-heisenberg-b05x6n`**. The user stopped local production to transfer the current work; this is **not a finished-video release**.

**Start with [RESUME_FOR_CLAUDE.md](RESUME_FOR_CLAUDE.md).** It records the approved scope, exact missing files, story issues, and verification limits.

| Directory | Purpose |
|---|---|
| `HundredHourDay/` | Video #2, **What If One Day Lasted 100 Hours?** Existing voice timeline: **304.500 s**. c1/c2/c4 have code and cues; c3 has code but no cues; c5–c8 are missing. |
| `FutureSight/` | Video #1 source and the current **50.38 s** vertical Short plan, captions, cameras, and metadata. The Short still needs its final synchronized render/mix and review. |
| `reference/` | Mascot reference, earlier analytics review, and partial QA of this source snapshot. |
| `handoff/` | [Asset instructions](handoff/ASSETS.md) and [file manifest](handoff/file-manifest.json). Consult these for verified asset availability and integrity. |

From the repository root:

```bash
bash tools/setup-cloud.sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
```

Use the existing deterministic **Canvas 2D** renderer and cached narration. **Do not install or migrate to HyperFrames.** Cloud runtime setup does not change the video framework.

Preserve the cartoon red-hoodie mascot, minimal text, expressive close/medium shots, quiet scene-specific sound effects, and the approved voice. Do not upload or publish either video to YouTube or another video platform; the user handles that. The requested GitHub handoff is the authorized transfer of the working project.

No raw Claude chat logs, credentials, or unrelated private memory are included. Existing stills and numerical audio checks are partial evidence, not a completed watch/listen review.
