#!/usr/bin/env python3
"""Sound for "What If You Could Pause Time?": narration (out/vo.wav) + piano score (Salamander Grand Piano, CC BY 3.0,
Alexander Holm) + synthesized SFX + two CC0 Freesound ambiences. Event times come from the same word timings as the picture.
Env: PIANO_DIR (Salamander 44.1khz16bit folder), SFX_DIR (folder with street/212197.mp3, robin_bird_song/179505.mp3)
Run: python3 audio.py   -> out/mix.wav (48 kHz stereo, -14 LUFS integrated, -1.5 dBTP)"""
import os, re, json, wave, subprocess
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
PIANO_DIR = os.environ["PIANO_DIR"]
SFX_DIR = os.environ["SFX_DIR"]
VO = json.load(open(os.path.join(HERE, "out", "vo_timing.json")))
WORDS = json.load(open(os.path.join(HERE, "out", "words.json")))
L = {l["id"]: l for l in VO["lines"]}
END = VO["total"] + 0.55
N_ALL = int((END + 0.05) * SR)

def clean(s): return re.sub(r"[^a-z']", "", s.lower())
def WT(line, w):
    for x in WORDS:
        if x["line"] == line and clean(x["w"]).startswith(w): return x["s"]
    raise KeyError(line + " " + w)
T = dict(snap1=WT("l2", "snap") + 0.12, rain=WT("l3", "raindrops") - 0.12, eat=WT("l4", "eat"), know=WT("l4", "nobody"),
         amazing=L["l5"]["start"], but=WT("l5", "but"), bounces=WT("l6", "bounces"), eyes=WT("l6", "eyes"),
         pause=WT("l7", "pause"), half=WT("l7", "halfway"), snap2=WT("l8", "snap") + 0.1, frozen9=WT("l9", "frozen"),
         push=L["l10"]["start"], concrete=WT("l10", "concrete"), dark=L["l11"]["start"], nosound=WT("l11", "sound"),
         fingers=WT("l11", "you"), snapback=WT("l12", "snap"), q=L["l13"]["start"])

# ------------------------------------------------------------------ utils
rng0 = np.random.default_rng(7)
def tt(n): return np.arange(n) / SR
def db(x): return 10 ** (x / 20)
def env(n, atk, tau): t = tt(n); return np.minimum(1, t / max(atk, 1e-4)) * np.exp(-t / tau)
def noise(n, seed=None): return (np.random.default_rng(seed) if seed is not None else rng0).standard_normal(n)
def filt(x, lo=None, hi=None, tw=0.15):
    n = len(x); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); m = np.ones_like(f)
    if lo: m *= 1 / (1 + np.exp(-(np.log2(np.maximum(f, 1) / lo)) / tw))
    if hi: m *= 1 / (1 + np.exp((np.log2(np.maximum(f, 1) / hi)) / tw))
    return np.fft.irfft(X * m, n)
def sine(f, n): return np.sin(2 * np.pi * f * tt(n))
def ff(path):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.float32).reshape(-1, 2).T.astype(np.float64)

BUS = {k: np.zeros((2, N_ALL)) for k in ("music", "sfx", "amb")}
def put(bus, x, t, gain_db=0.0, pan=0.0):
    if x.ndim == 1: x = np.stack([x * np.sqrt(0.5 * (1 - pan)), x * np.sqrt(0.5 * (1 + pan))]) * np.sqrt(2)
    i = int(t * SR); j = min(N_ALL, i + x.shape[1])
    if i >= N_ALL or j <= 0: return
    BUS[bus][:, max(0, i):j] += x[:, max(0, -i):j - i] * db(gain_db)

# simple stereo reverb: exponentially decaying noise IR, convolved via FFT
def reverb(x, rt=2.2, wet=0.35, seed=3):
    n = int(rt * SR); ir = np.stack([noise(n, seed), noise(n, seed + 1)]) * np.exp(-tt(n) * 6.9 / rt)
    ir = np.stack([filt(ir[0], 200, 7000), filt(ir[1], 200, 7000)]); ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
    if x.ndim == 1: x = np.stack([x, x])
    m = x.shape[1] + n; L2 = 1 << (m - 1).bit_length()
    y = np.stack([np.fft.irfft(np.fft.rfft(x[c], L2) * np.fft.rfft(ir[c], L2), L2)[:m] for c in range(2)])
    out = np.zeros_like(y); out[:, :x.shape[1]] = x * (1 - wet); return out + y * wet * 0.5

# ------------------------------------------------------------------ piano (Salamander)
NAMES = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
def midi(n): m = re.match(r"^([A-G]#?)(-?\d)$", n); return 12 * (int(m.group(2)) + 1) + NAMES[m.group(1)]
SAMP = {}
for f in os.listdir(PIANO_DIR):
    m = re.match(r"^([A-G]#?)(\d)v(\d+)\.wav$", f)
    if m: SAMP.setdefault(midi(m.group(1) + m.group(2)), {})[int(m.group(3))] = os.path.join(PIANO_DIR, f)
_w = {}
def wav(p):
    if p not in _w:
        with wave.open(p) as w: d = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768; _w[p] = d.reshape(-1, w.getnchannels()).T
    return _w[p]
def note(name, vel, dur, tail=2.5):
    m = midi(name); src = min(SAMP, key=lambda k: abs(k - m)); lay = SAMP[src]; v = min(lay, key=lambda k: abs(k - (1 + vel / 127 * 15)))
    s = wav(lay[v]); f = 2 ** ((m - src) / 12) * 44100 / SR; n = int(min(s.shape[1] - 2, (dur + tail) * SR * f) / f)
    idx = np.arange(n) * f; i0 = idx.astype(int); fr = idx - i0; out = s[:, i0] * (1 - fr) + s[:, i0 + 1] * fr
    t = tt(n); return out * np.where(t > dur, np.exp(-(t - dur) / 0.35), 1.0)

def score():
    mus = np.zeros((2, N_ALL))
    def P(name, t, vel=60, dur=0.25, g=0.0):
        x = note(name, vel, dur); i = int(t * SR); j = min(N_ALL, i + x.shape[1]); mus[:, i:j] += x[:, :j - i] * db(g)
    # A: playful staccato motif (C major / lydian), 112 bpm eighths, until the snap
    beat = 60 / 112 / 2; motif = ["C5", "E5", "G5", "E5", "F#5", "A5", "G5", "E5"]; bass = ["C3", "C3", "A2", "A2"]
    t = 0.0; k = 0
    while t < T["snap1"] - 0.05:
        P(motif[k % 8], t, 58, 0.12, -5)
        if k % 4 == 0: P(bass[(k // 4) % 4], t, 52, 0.4, -8)
        t += beat; k += 1
    # B: after the snap the same motif, slow and dreamy (it will be drenched in reverb), through the bakery
    seg = np.zeros((2, N_ALL)); slow = beat * 2.2; t = T["snap1"] + 0.55; k = 0
    while t < T["but"] - 0.2:
        x = note(motif[k % 8].replace("5", "6") if k % 8 in (2, 5) else motif[k % 8], 46, 0.5); i = int(t * SR); j = min(N_ALL, i + x.shape[1]); seg[:, i:j] += x[:, :j - i] * 0.8
        if k % 4 == 0:
            for ch in (["C4", "E4", "G4"] if (k // 4) % 2 == 0 else ["A3", "C4", "E4"]):
                x = note(ch, 38, slow * 4); seg[:, i:i + x.shape[1]] += x[:, :min(x.shape[1], N_ALL - i)] * 0.45
        t += slow; k += 1
    # the bakery gets a little bounce back in
    t = T["eat"]; k = 0
    while t < T["but"] - 0.3:
        x = note(["G5", "E5", "C5", "E5"][k % 4], 50, 0.1); i = int(t * SR); seg[:, i:i + x.shape[1]] += x[:, :min(x.shape[1], N_ALL - i)] * 0.55
        t += beat * 2; k += 1
    # tape-stop feel on "but": fade the cue fast
    tb = int(T["but"] * SR); fadeN = int(0.35 * SR); seg[:, tb:tb + fadeN] *= np.linspace(1, 0, fadeN); seg[:, tb + fadeN:] = 0
    mus += reverb(seg, 3.0, 0.55)[:, :N_ALL] * db(5)
    # C: lab — slow A-minor broken chords, soft
    seq = [("A2", "E3", "C4"), ("F2", "C3", "A3"), ("C3", "G3", "E4"), ("G2", "D3", "B3")]
    t = L["l6"]["start"] - 0.2; k = 0
    while t < T["snap2"]:
        for j, nm in enumerate(seq[k % 4]): P(nm, t + j * 0.18, 44, 1.6, -4)
        P(["E5", "C5", "G5", "B4"][k % 4], t + 0.9, 40, 0.8, -6)
        t += 1.85; k += 1
    # D: ending — one high note on the question, one low note under it
    P("E6", T["q"] + 1.25, 48, 1.5, -2); P("A2", T["q"] + 1.25, 40, 3.0, -4)
    return reverb(mus, 2.0, 0.22)[:, :N_ALL]

# ------------------------------------------------------------------ synthesized SFX
def tick(hi=True):
    n = int(0.05 * SR); f = 3200 if hi else 2500
    return (sine(f, n) * 0.5 + filt(noise(n), 2000, 8000) * 0.5) * env(n, 0.0003, 0.006)
def snap():
    n = int(0.25 * SR)
    hit = filt(noise(n, 11), 1500, 7500) * env(n, 0.0002, 0.012) * 1.4
    body = sine(1150, n) * env(n, 0.0005, 0.02) * 0.35 + sine(260, n) * env(n, 0.001, 0.03) * 0.25
    return reverb(hit + body, 0.6, 0.18)
def freeze_whoosh(dur=1.6):
    n = int(dur * SR); t = tt(n); out = np.zeros(n)
    for f in (1046, 1318, 1568, 2093, 2637): out += np.sin(2 * np.pi * f * t * (1 - 0.06 * t / dur)) * np.exp(-t / 0.7) * 0.18
    air = filt(noise(n, 5), 3000, 12000) * np.exp(-t / 0.25) * 0.5
    sub = sine(55, n) * np.exp(-t / 0.5) * 0.9
    return reverb(out + air + sub, 2.5, 0.5)
def chime(f=2349, dur=1.2):
    n = int(dur * SR); return (sine(f, n) + 0.4 * sine(f * 2.01, n) + 0.2 * sine(f * 2.76, n)) * env(n, 0.002, 0.35) * 0.5
def munch(seed):
    n = int(0.16 * SR); x = filt(noise(n, seed), 400, 3500) * env(n, 0.002, 0.04)
    for k in range(3): i = int((0.03 + 0.035 * k) * SR); x[i:] += filt(noise(n - i, seed + k + 9), 600, 4000) * env(n - i, 0.001, 0.02) * 0.7
    return x
def blip(f=1760):
    n = int(0.12 * SR); return (sine(f, n) + 0.3 * sine(f * 1.5, n)) * env(n, 0.002, 0.04) * 0.6
def thunk():
    n = int(0.5 * SR); t = tt(n); f = 120 * np.exp(-t / 0.08) + 45
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.18) + filt(noise(n, 3), 200, 2000) * env(n, 0.001, 0.02) * 0.5
def powerdown(dur=1.4):
    n = int(dur * SR); t = tt(n); f = 220 * np.exp(-t / 0.35) + 30
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.6) * 0.8 + filt(noise(n, 4), 80, 600) * np.exp(-t / 0.3) * 0.4
def drone(dur, f=55):
    n = int(dur * SR); t = tt(n)
    x = sum(np.sin(2 * np.pi * f * r * t + r) * a for r, a in ((1, 1), (1.5, 0.35), (2.003, 0.25), (3.01, 0.08)))
    return x * (0.8 + 0.2 * np.sin(2 * np.pi * 0.23 * t)) * np.minimum(1, t / 1.5) * np.minimum(1, (dur - t) / 0.6)
def heartbeat():
    n = int(0.6 * SR); t = tt(n)
    def thump(d): m = n - int(d * SR); y = np.zeros(n); y[int(d * SR):] = np.sin(2 * np.pi * 48 * tt(m)) * env(m, 0.004, 0.07); return y
    return thump(0) + 0.7 * thump(0.22)
def crackle(dur=1.0, seed=8):
    r = np.random.default_rng(seed); n = int(dur * SR); out = np.zeros(n)
    for _ in range(int(40 * dur)):
        i = int(r.random() * (n - 2000)); m = int(0.012 * SR); out[i:i + m] += filt(noise(m, int(r.random() * 1e6)), 3000, 11000) * env(m, 0.0002, 0.002) * r.random()
    return out
def strain(dur):
    n = int(dur * SR); t = tt(n); return filt(noise(n, 12), 60, 300) * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * t)) * np.minimum(1, t / 0.3) * np.minimum(1, (dur - t) / 0.3)
def bubbles(dur, seed=13):
    r = np.random.default_rng(seed); n = int(dur * SR); out = np.zeros(n)
    for _ in range(int(55 * dur)):
        i = int(r.random() * (n - 4000)); f0 = 600 + r.random() * 1600; m = int(0.05 * SR); tm = tt(m)
        out[i:i + m] += np.sin(2 * np.pi * np.cumsum(f0 * (1 + 2 * tm)) / SR) * env(m, 0.002, 0.012) * 0.25
    return out

def build_sfx():
    # clock ticking until the snap (time stops), and one last tick at the very end (loops into the start)
    t = 0.0; k = 0
    while t < T["snap1"]: put("sfx", tick(k % 2 == 0), t, -21, 0.3); t += 0.5; k += 1
    put("sfx", tick(True), END - 0.32, -18, 0.3)
    # city ambience cuts dead at the snap
    st = ff(os.path.join(SFX_DIR, "street", "212197.mp3")); bd = ff(os.path.join(SFX_DIR, "robin_bird_song", "179505.mp3"))
    n = int((T["snap1"] + 0.02) * SR); amb = st[:, :n] * 0.9 + bd[:, :n] * 0.35; amb[:, :int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR)); amb[:, -int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
    put("amb", amb, 0.0, 2)
    # snap 1 + time-freeze swell
    put("sfx", snap(), T["snap1"] - 0.01, -2); put("sfx", freeze_whoosh(), T["snap1"], -8)
    # frozen-world room tone (very quiet air), snap → but
    n = int((T["but"] - T["snap1"]) * SR); hum = filt(noise(n, 21), 150, 900) * 0.25; hum[:int(0.4 * SR)] *= np.linspace(0, 1, int(0.4 * SR)); put("amb", np.stack([hum, hum[::-1]]), T["snap1"], -30)
    # rain: poke a hanging drop
    put("sfx", chime(2637), T["rain"] + 1.85, -12, 0.2); put("sfx", chime(3520, 0.8), T["rain"] + 1.93, -18, 0.2)
    # bakery: munching on every bite, plates clinking as the stack grows
    t = T["eat"]; k = 0
    while t < T["know"] - 0.1: put("sfx", munch(k), t + 0.02, -14, -0.1); t += 2 * np.pi / 14; k += 1
    for i in range(16): put("sfx", chime(2093 + (i % 3) * 300, 0.4), T["eat"] + (T["know"] - 0.1 - T["eat"]) * (i + 0.5) / 16, -24, 0.5)
    put("sfx", chime(3136), T["amazing"] + 0.05, -16)
    # "but…": low hit as the music drops
    put("sfx", thunk(), T["but"] + 0.02, -9)
    # lab: label blips, the pause stamp, ice
    for tb in (L["l6"]["start"] + 0.6, T["bounces"], T["eyes"]): put("sfx", blip(), tb, -18, 0.2)
    put("sfx", thunk(), T["pause"], -6); put("sfx", freeze_whoosh(1.2), T["pause"], -16); put("sfx", crackle(0.8), T["pause"] + 0.05, -18)
    put("sfx", blip(988), T["half"], -15); put("sfx", blip(660), T["half"] + 0.5, -15)
    # snap 2 → everything shuts off
    put("sfx", snap(), T["snap2"] - 0.01, -2); put("sfx", powerdown(), T["snap2"] + 0.05, -6)
    # air molecules: busy fizz until they freeze, then ice crackle
    put("sfx", bubbles(T["frozen9"] - L["l9"]["start"]), L["l9"]["start"], -20)
    put("sfx", crackle(1.2, 9), T["frozen9"], -14); put("sfx", chime(1568, 1.5), T["frozen9"], -20)
    # push against the concrete air
    put("sfx", strain(T["dark"] - T["push"]), T["push"], -16); put("sfx", thunk(), T["concrete"], -6)
    # dark drone from the second snap to the end, heartbeat once it's dark
    put("amb", drone(END - T["snap2"] - 0.2, 55), T["snap2"] + 0.2, -26)
    t = T["dark"] - 0.4
    while t < END - 0.6: put("sfx", heartbeat(), t, -12); t += 0.86
    put("sfx", strain(T["q"] - T["fingers"]), T["fingers"], -22)
    # the pause button press
    put("sfx", tick(True), T["q"] + 1.25, -10)

def lufs(x):                                # integrated loudness via ffmpeg ebur128
    import tempfile
    p = tempfile.mktemp(suffix=".wav"); write(p, x)
    r = subprocess.run(["ffmpeg", "-i", p, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True); os.remove(p)
    i = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)[-1]); pk = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r.stderr)[-1]); return i, pk
def write(p, x):
    y = np.clip(x.T, -1, 1); y = (y * 32767).astype(np.int16)
    with wave.open(p, "wb") as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(y.tobytes())

if __name__ == "__main__":
    vo = ff(os.path.join(HERE, "out", "vo.wav"))[:, :N_ALL]; vo = np.pad(vo, ((0, 0), (0, N_ALL - vo.shape[1])))
    BUS["music"] += score(); build_sfx()
    # duck music + ambience under the voice (smoothed envelope)
    e = np.abs(vo[0]); k = int(0.12 * SR); e = np.convolve(e, np.ones(k) / k, "same"); duck = 1 - 0.45 * np.clip(e / (np.percentile(e, 95) + 1e-9), 0, 1)
    mix = vo * db(0) + BUS["music"] * db(-3) * duck + BUS["amb"] * duck + BUS["sfx"] * db(-2)
    i, pk = lufs(mix); mix *= db(-13.6 - i)              # aim a touch hot, then a brick-wall limiter brings peaks to -1.5 dBTP
    import soundfile as sf
    raw = os.path.join(HERE, "out", "mix_raw.wav"); sf.write(raw, mix.T.astype(np.float32), SR, subtype="FLOAT")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af", "alimiter=limit=0.79:attack=3:release=60:level=false,aresample=48000",
                    "-c:a", "pcm_s16le", os.path.join(HERE, "out", "mix.wav")], check=True)
    r = subprocess.run(["ffmpeg", "-i", os.path.join(HERE, "out", "mix.wav"), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    print("mix", re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)[-1], "LUFS  true peak", re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r.stderr)[-1], "dBFS")
