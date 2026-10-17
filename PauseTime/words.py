"""Word timings for captions: faster-whisper on each narration line, mapped onto the script's own words.
Writes out/words.json: [{"w": word, "s": start, "e": end, "line": id}] in film seconds."""
import json, os, re
import numpy as np, soundfile as sf
from faster_whisper import WhisperModel
HERE = os.path.dirname(os.path.abspath(__file__))
T = json.load(open(os.path.join(HERE, "out", "vo_timing.json")))
model = WhisperModel("small.en", device="cpu", compute_type="int8")
out = []
for ln in T["lines"]:
    script = ln["text"].replace("...", "… ").split()
    x, sr = sf.read(os.path.join(HERE, "out", f"vo_{ln['id']}.wav"), dtype="float32")
    x16 = np.interp(np.arange(0, len(x), sr / 16000), np.arange(len(x)), x).astype(np.float32)
    segs, _ = model.transcribe(x16, word_timestamps=True, language="en")
    ws = []
    for w in (w for s in segs for w in s.words):  # glue pieces like "mid" + "-air" back into one word
        if ws and not w.word.startswith(" "): ws[-1] = type("W", (), {"word": ws[-1].word + w.word, "start": ws[-1].start, "end": w.end})
        else: ws.append(w)
    if len(ws) == len(script):
        tm = [(w.start, w.end) for w in ws]
    else:  # fall back: spread whisper's span over the script words by length
        a = ws[0].start if ws else 0; b = ws[-1].end if ws else ln["end"] - ln["start"]
        L = [len(re.sub(r"\W", "", x)) + 1 for x in script]; tot = sum(L); c = a; tm = []
        for l in L: d = (b - a) * l / tot; tm.append((c, c + d)); c += d
        print("fallback", ln["id"], len(ws), len(script), [w.word for w in ws])
    for w, (s, e) in zip(script, tm):
        out.append({"w": w, "s": round(ln["start"] + s, 3), "e": round(ln["start"] + e, 3), "line": ln["id"]})
json.dump(out, open(os.path.join(HERE, "out", "words.json"), "w"), indent=0)
print(len(out), "words")
