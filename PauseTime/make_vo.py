"""Kokoro narration -> out/vo.wav (48 kHz mono) + out/vo_timing.json, lines placed back to back with each line's gap.
Run: KOKORO_MODEL=... KOKORO_VOICES=... python3 make_vo.py
Voice and speed match the channel's earlier videos (script.json)."""
import json, os
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.environ["KOKORO_MODEL"]
VOICES = os.environ["KOKORO_VOICES"]
cfg = json.load(open(os.path.join(HERE, "script.json"), encoding="utf-8"))
k = Kokoro(MODEL, VOICES)
OUT_SR = 48000

def trim(x, thr=0.004):
    idx = np.where(np.abs(x) > thr)[0]
    return x if len(idx) == 0 else x[idx[0]: idx[-1] + 1]

parts, report, t = [], [], cfg["lead"]
for ln in cfg["lines"]:
    s, sr = k.create(ln["text"], voice=cfg["voice"], speed=cfg["speed"], lang="en-us")
    s = trim(s.astype(np.float32))
    n = int(len(s) * OUT_SR / sr)
    x = np.interp(np.linspace(0, len(s) - 1, n), np.arange(len(s)), s).astype(np.float32)
    f = int(0.012 * OUT_SR); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
    d = len(x) / OUT_SR
    report.append({"id": ln["id"], "text": ln["text"], "start": round(t, 3), "end": round(t + d, 3)})
    parts.append((t, x)); sf.write(os.path.join(HERE, "out", f"vo_{ln['id']}.wav"), x, OUT_SR)
    t += d + ln["gap"]
buf = np.zeros(int((t + 0.1) * OUT_SR), np.float32)
for st, x in parts: i = int(st * OUT_SR); buf[i:i + len(x)] += x
buf *= 0.9 / float(np.max(np.abs(buf)))
sf.write(os.path.join(HERE, "out", "vo.wav"), buf, OUT_SR)
json.dump({"total": round(t, 3), "lines": report}, open(os.path.join(HERE, "out", "vo_timing.json"), "w"), indent=1)
print("total", round(t, 2))
for r in report: print(r["id"], r["start"], r["end"])
