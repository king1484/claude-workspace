"""Assemble the Short audio from the published mix using shorts/work/audio_plan.json.
Run: python3 shorts/audio.py   -> shorts/work/audio_raw.wav (48k stereo float, before loudness normalisation)
Uses out/mix_full.wav when present, otherwise the lossless packaged assets/published_mix.flac.
Equal-power 50 ms crossfades at every cut, 5 ms fade-in at t=0 (no soft start), 0.45 s fade-out at the end.
"""
import json, os
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
plan = json.load(open(os.path.join(HERE, "work", "audio_plan.json"), encoding="utf-8"))
sources = [os.path.join(ROOT, "out", "mix_full.wav"),
           os.path.join(ROOT, "assets", "published_mix.flac")]
source = next((p for p in sources if os.path.isfile(p)), None)
if source is None:
    raise FileNotFoundError("Short audio needs out/mix_full.wav or assets/published_mix.flac. "
                            "Restore the packaged published mix; do not regenerate the voice.")
print("source:", os.path.relpath(source, ROOT))
mix, sr = sf.read(source, dtype="float64")
if mix.ndim == 1:
    mix = np.stack([mix, mix], axis=1)
assert sr == 48000, sr
XF = 0.050
H = XF / 2
n_total = int(round(plan["dur"] * sr)) + 1
out = np.zeros((n_total, 2))
segs = plan["segs"]
for i, s in enumerate(segs):
    first, last = i == 0, i == len(segs) - 1
    a0 = s["A0"] - (0 if first else H)
    a1 = s["A1"] + (0 if last else H)
    o0 = s["s0"] - (0 if first else H)
    i0, i1 = int(round(a0 * sr)), int(round(a1 * sr))
    chunk = mix[i0:i1].copy()
    n = len(chunk)
    nx = int(XF * sr)
    if not first:
        t = np.linspace(0, np.pi / 2, nx)
        chunk[:nx] *= np.sin(t)[:, None]
    else:
        nf = int(0.005 * sr)
        chunk[:nf] *= np.linspace(0, 1, nf)[:, None]
    if not last:
        t = np.linspace(0, np.pi / 2, nx)
        chunk[-nx:] *= np.cos(t)[:, None]
    p = int(round(o0 * sr))
    out[p:p + n] += chunk[: max(0, min(n, n_total - p))]
# end fade-out
nf = int(0.45 * sr)
dur_n = int(round(plan["dur"] * sr))
out = out[:dur_n]
out[-nf:] *= np.linspace(1, 0, nf)[:, None] ** 1.5
sf.write(os.path.join(HERE, "work", "audio_raw.wav"), out, sr, subtype="FLOAT")
print("wrote audio_raw.wav", len(out) / sr, "s; peak", np.abs(out).max())
