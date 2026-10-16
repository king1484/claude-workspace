"""Kokoro VO -> out/vo.wav (48 kHz mono) placed at the start times in vo_script.json.
Run: python3 make_vo.py (optional: replaces the saved narration)
"""
import json, os, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(os.path.expanduser("~"), ".cache", "hyperframes", "tts")
MODEL = os.environ.get("KOKORO_MODEL", os.path.join(CACHE, "models", "kokoro-v1.0.onnx"))
VOICES = os.environ.get("KOKORO_VOICES", os.path.join(CACHE, "voices", "voices-v1.0.bin"))
for env_name, filename in (("KOKORO_MODEL", MODEL), ("KOKORO_VOICES", VOICES)):
    if not os.path.isfile(filename):
        raise FileNotFoundError(f"Missing {filename}. Set {env_name} to the existing model/voices file. "
                                "Use the preserved out/ WAVs when continuing without new narration.")
os.makedirs(os.path.join(HERE, "out"), exist_ok=True)

cfg = json.load(open(os.path.join(HERE, "vo_script.json"), encoding="utf-8"))
k = Kokoro(MODEL, VOICES)
OUT_SR = 48000
total = 14.0
buf = np.zeros(int(total * OUT_SR), dtype=np.float32)
report = []

def trim(x, thr=0.004):
    idx = np.where(np.abs(x) > thr)[0]
    return x if len(idx) == 0 else x[idx[0]: idx[-1] + 1]

for ln in cfg["lines"]:
    samples, sr = k.create(ln["text"], voice=cfg["voice"], speed=cfg["speed"], lang="en-us")
    samples = trim(samples.astype(np.float32))
    n_out = int(len(samples) * OUT_SR / sr)
    x = np.interp(np.linspace(0, len(samples) - 1, n_out), np.arange(len(samples)), samples).astype(np.float32)
    # 12 ms fades
    f = int(0.012 * OUT_SR)
    x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
    s = int(ln["start"] * OUT_SR)
    buf[s:s + len(x)] += x
    report.append({"id": ln["id"], "start": ln["start"], "dur": round(len(x) / OUT_SR, 3),
                   "end": round(ln["start"] + len(x) / OUT_SR, 3)})
    sf.write(os.path.join(HERE, "out", f"vo_{ln['id']}.wav"), x, OUT_SR)

end = max(r["end"] for r in report)
buf = buf[: int((end + 0.6) * OUT_SR)]
peak = float(np.max(np.abs(buf)))
buf *= 0.9 / peak
sf.write(os.path.join(HERE, "out", "vo.wav"), buf, OUT_SR)
json.dump(report, open(os.path.join(HERE, "out", "vo_timing.json"), "w"), indent=1)
for r in report:
    print(r)
