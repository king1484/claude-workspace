"""Word-level timings for the VO lines used in the Short (offline faster-whisper, cached model).
Writes shorts/work/words.json: {lineId: {"text":..., "words":[{"w":..,"s":..,"e":..}]}} times local to the line wav (s).
Hook line l4 is cut out of out/vo.wav (starts 7.45 s) into a temp wav first.
Run: py -3.12 -I shorts/words.py
"""
import json, os, sys
import numpy as np
import soundfile as sf
from faster_whisper import WhisperModel

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
VO = os.path.join(ROOT, "out", "vo")
WORK = os.path.join(HERE, "work")
os.makedirs(WORK, exist_ok=True)

ids = ["r1", "r3", "m2", "m3", "p2", "p7", "h2", "h3", "h4", "h5", "z2", "z4", "z5", "z6", "z7", "z8"]
files = {i: os.path.join(VO, i + ".wav") for i in ids}

# hook line l4 -> temp wav
x, sr = sf.read(os.path.join(ROOT, "out", "vo.wav"))
if x.ndim > 1:
    x = x.mean(axis=1)
a = int(7.35 * sr); b = int(10.2 * sr)
sf.write(os.path.join(WORK, "l4_tmp.wav"), x[a:b], sr)
files["l4"] = os.path.join(WORK, "l4_tmp.wav")
l4_offset = 7.35  # seconds into vo.wav

model = WhisperModel("small", device="cpu", compute_type="int8", local_files_only=True)
out = {}
for i, f in files.items():
    segs, info = model.transcribe(f, language="en", word_timestamps=True, beam_size=5, vad_filter=False,
                                  condition_on_previous_text=False)
    words = []
    for s in segs:
        for w in s.words:
            words.append({"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)})
    out[i] = {"words": words}
    print(i, " ".join(f"{w['w']}[{w['s']:.2f}-{w['e']:.2f}]" for w in words))
out["l4"]["offset_in_vo_wav"] = l4_offset
json.dump(out, open(os.path.join(WORK, "words.json"), "w"), indent=1)
