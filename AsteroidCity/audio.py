"""Score + sound design for the asteroid Short, synthesised with numpy (no samples), mixed under the narration.
Cue times come from out/layout.json with the same formulas as src/shots.js.
Run: ../.venv/bin/python audio.py  -> out/mix.wav (48 kHz stereo, -14 LUFS-ish after ffmpeg loudnorm in the mux step)
"""
import json, os
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
LAY = json.load(open(os.path.join(HERE, "out", "layout.json")))
L = {l["id"]: l for l in LAY["lines"]}
DUR = LAY["total"]
N = int(round(DUR * SR))
t = np.arange(N) / SR
rng = np.random.default_rng(7)

def tAt(i, phrase):
    l = L[i]; k = l["text"].index(phrase); return l["start"] + l["dur"] * k / len(l["text"])

# --- the same cut times as src/shots.js ---
T1 = L["v1"]["end"] + 0.2; T2 = L["v3"]["start"] - 0.05; T3 = L["v3"]["start"] + 2.25; TI = L["v3"]["end"] + 0.25
T5 = L["v4"]["start"] + 1.1; T6 = L["v5"]["start"] - 0.05; T7 = L["v6"]["start"] - 0.05; T8 = L["v6"]["start"] + 1.55
T9 = L["v7"]["start"] - 0.05; T10 = L["v8"]["start"] - 0.05; T11 = L["v9"]["start"] - 0.05; T12 = L["v10"]["start"] - 0.3
T13 = L["v11"]["start"] - 0.1; T14 = L["v12"]["start"] - 0.15; TDI = tAt("v11", "into an asteroid") + 0.15
THIT = T8 + 0.855 * (T9 - T8)                       # dust wall reaches the camera (see shots.js 'hit')
TBOOM = TI + 0.35

# ---------------- helpers ----------------
def env(points):
    """piecewise-linear envelope from [(time, value), ...]"""
    ts, vs = zip(*points); return np.interp(t, ts, vs)

def ss(a, b, x):
    k = np.clip((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k)

def stft_filter(x, gain_fn, n=2048, hop=512):
    """time-varying zero-phase EQ: gain_fn(time_sec, freqs) -> gains for that frame"""
    w = np.hanning(n).astype(np.float32)
    pad = np.concatenate([np.zeros(n), x, np.zeros(n)]).astype(np.float32)
    out = np.zeros_like(pad); norm = np.zeros_like(pad)
    f = np.fft.rfftfreq(n, 1 / SR)
    for s in range(0, len(pad) - n, hop):
        X = np.fft.rfft(pad[s:s + n] * w)
        g = gain_fn((s + n / 2 - n) / SR, f)
        out[s:s + n] += np.fft.irfft(X * g, n) * w; norm[s:s + n] += w * w
    out /= np.maximum(norm, 1e-3)
    return out[n:n + len(x)]

def lp_gain(fc, order=2):
    return lambda tt, f: 1 / np.sqrt(1 + (f / max(fc(tt) if callable(fc) else fc, 1)) ** (2 * order))

def bp_gain(fc, q=1.0):
    def g(tt, f):
        c = fc(tt) if callable(fc) else fc
        return 1 / np.sqrt(1 + (q * (f / c - c / np.maximum(f, 1))) ** 2)
    return g

def noise(kind="white", n=N):
    w = rng.standard_normal(n).astype(np.float32)
    if kind == "white": return w
    F = np.fft.rfft(w); f = np.fft.rfftfreq(n, 1 / SR); f[0] = f[1]
    F /= (f ** (0.5 if kind == "pink" else 1.0)); x = np.fft.irfft(F, n)
    return (x / np.std(x)).astype(np.float32)

def saw_additive(freq, amp_env, fc=None, harmonics=40, detune=0.0, phase=0.0):
    """band-limited saw by additive synthesis; fc (array or float): lowpass cutoff per sample"""
    out = np.zeros(N, np.float32)
    f0 = freq * (1 + detune)
    for h in range(1, harmonics + 1):
        fh = f0 * h
        if fh > 16000: break
        a = 1.0 / h
        if fc is not None: a = a / np.sqrt(1 + (fh / fc) ** 4)
        out += (a * np.sin(2 * np.pi * fh * t + phase * h)).astype(np.float32)
    return out * amp_env

def reverb(x, secs=3.0, wet=0.3, seed=1, damp=4000):
    r = np.random.default_rng(seed); n = int(secs * SR)
    ir = r.standard_normal(n) * np.exp(-np.arange(n) / (SR * secs / 6.9))
    F = np.fft.rfft(ir); f = np.fft.rfftfreq(n, 1 / SR); ir = np.fft.irfft(F / np.sqrt(1 + (f / damp) ** 2), n)
    ir /= np.sqrt(np.sum(ir ** 2))
    m = len(x) + n; M = 1 << (m - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, M) * np.fft.rfft(ir, M), M)[:len(x)]
    return x * (1 - wet) + y.astype(np.float32) * wet

def place(dst, src, at, gain=1.0):
    i = int(at * SR)
    if i >= len(dst): return
    j = min(len(dst), i + len(src)); dst[i:j] += src[:j - i] * gain

def burst(secs, att=0.005, dec=None):
    n = int(secs * SR); k = np.arange(n) / SR
    e = np.minimum(1, k / max(att, 1e-4)) * np.exp(-k / (dec or secs / 4))
    return e.astype(np.float32)

def kick(f0=70, f1=38, secs=0.9, click=0.3):
    n = int(secs * SR); k = np.arange(n) / SR
    fr = f1 + (f0 - f1) * np.exp(-k * 18)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    y = np.sin(ph) * np.exp(-k * 4.5) + click * rng.standard_normal(n) * np.exp(-k * 120)
    return y.astype(np.float32)

def tom(f=95, secs=1.4):
    n = int(secs * SR); k = np.arange(n) / SR
    fr = f * (1 + 0.6 * np.exp(-k * 25))
    y = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-k * 3.2) + 0.25 * rng.standard_normal(n) * np.exp(-k * 30)
    return y.astype(np.float32)

def glide(f0, f1, secs, curve=2.0):
    n = int(secs * SR); k = np.arange(n) / SR / secs
    fr = f0 + (f1 - f0) * k ** curve
    return np.sin(2 * np.pi * np.cumsum(fr) / SR).astype(np.float32)

def pluck(f, secs=1.2, bright=6):
    n = int(secs * SR); k = np.arange(n) / SR
    y = sum((1 / h) * np.sin(2 * np.pi * f * h * k) * np.exp(-k * (2.5 + h * bright / 6)) for h in range(1, 7))
    return (y * np.minimum(1, k / 0.004)).astype(np.float32)

NOTE = lambda name: 440 * 2 ** ((({"C": -9, "C#": -8, "Db": -8, "D": -7, "Eb": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "Ab": -1, "A": 0, "Bb": 1, "B": 2}[name[:-1]]) + 12 * (int(name[-1]) - 4)) / 12)

# ======================= MUSIC =======================
mus = np.zeros(N, np.float32)

# 1) tension drone (start -> impact) and again in the loop tail, rising into the start
dr_amp = env([(0, 0.55), (T1, 0.6), (T3, 0.8), (TI - 0.05, 1.0), (TI, 0.0), (T14 - 0.2, 0.0), (T14 + 0.6, 0.45), (DUR, 0.55)])
dr_fc = env([(0, 500), (T3, 900), (TI, 2200), (TI + 0.01, 400), (T14, 300), (DUR, 500)])
for f, det in [(NOTE("D2"), 0), (NOTE("D2"), 0.006), (NOTE("A2"), -0.004), (NOTE("D1"), 0.002)]:
    mus += saw_additive(f, dr_amp * 0.09, fc=dr_fc, harmonics=30, detune=det, phase=rng.random() * 6)
# tremolo string cluster creeping up over the hook/entry
trem = (0.6 + 0.4 * np.sin(2 * np.pi * 7.5 * t)).astype(np.float32)
cl_amp = env([(0, 0.0), (1.0, 0.25), (T2, 0.45), (TI - 0.05, 0.9), (TI, 0), (T14, 0), (DUR, 0.3)])
for f in [NOTE("D4"), NOTE("Eb4"), NOTE("A4")]:
    mus += saw_additive(f, cl_amp * trem * 0.018, fc=2500, harmonics=12, detune=rng.random() * 0.004)

# 2) heartbeat pulse speeding up toward impact
beats = []; b = 0.15; per = 0.95
while b < TI - 0.15:
    beats.append(b); per = max(0.36, per * 0.955); b += per
for bt in beats:
    k = kick(62, 36, 0.8, 0.15); place(mus, k, bt, 0.42 * (0.6 + 0.4 * bt / TI)); place(mus, k, bt + 0.2, 0.22 * (0.6 + 0.4 * bt / TI))
for bt in np.arange(T14 + 0.3, DUR + 0.01, 0.6):
    place(mus, kick(62, 36, 0.8, 0.15), bt, 0.3)

# 3) braams on the big cuts
def braam(at, gain=1.0, root="D1"):
    secs = 2.2; n = int(secs * SR); k = np.arange(n) / SR
    y = np.zeros(n, np.float32); fc = 200 + 1800 * np.exp(-k * 2.2) * np.minimum(1, k / 0.06)
    for f in [NOTE(root), NOTE(root) * 1.5, NOTE(root) * 2, NOTE(root) * 2 * 1.003]:
        for h in range(1, 25):
            fh = f * h; y += (1 / h) / np.sqrt(1 + (fh / fc) ** 4) * np.sin(2 * np.pi * fh * k)
    y = np.tanh(y * 1.4) * np.exp(-k * 1.3) * np.minimum(1, k / 0.04)
    place(mus, y.astype(np.float32), at, 0.22 * gain)
braam(T1 - 0.03, 0.8); braam(T2 - 0.03, 0.9); braam(T3 - 0.03, 1.0)

# 4) riser into the impact
r_len = TI - T3 + 0.6
rz = glide(180, 1400, r_len, 2.2) * 0.05 + glide(90, 700, r_len, 2.2) * 0.05
place(mus, rz * np.linspace(0.2, 1, len(rz)).astype(np.float32) ** 2, T3 - 0.6)

# 5) epic section: drums + low ostinato (from v4 until the crater)
E0, E1 = L["v4"]["start"] - 0.2, T9 + 0.4
bpm = 100; beat = 60 / bpm
prog = [("D2", "F2", "A2"), ("Bb1", "D2", "F2"), ("G1", "Bb1", "D2"), ("A1", "C#2", "E2")]
bar = 4 * beat
i = 0
for b0 in np.arange(E0, E1, beat / 2):
    ch = prog[int((b0 - E0) / bar) % 4]
    n_ = ch[i % 3] if i % 4 != 3 else ch[0]
    p = pluck(NOTE(n_) * 2, 0.6, bright=3) * 0.5 + pluck(NOTE(n_), 0.6, bright=2) * 0.5
    place(mus, p, b0, 0.17 * (1 if b0 > T6 else 0.7))
    i += 1
for b0 in np.arange(E0, E1, beat):
    pos = round((b0 - E0) / beat) % 8
    if pos in (0, 3, 4, 6): place(mus, tom(70 if pos == 0 else 88, 1.2), b0, 0.42)
    if pos in (2, 6): place(mus, kick(90, 50, 0.4, 0.5), b0, 0.2)
pad_amp = env([(E0, 0), (E0 + 1.5, 0.5), (T9, 0.6), (E1, 0)])
for k_, ch in enumerate(prog * 6):
    s0 = E0 + k_ * bar
    if s0 > E1: break
    a = pad_amp * ss(s0 - 0.05, s0 + 0.3, t) * (1 - ss(s0 + bar - 0.2, s0 + bar + 0.3, t))
    for nm in ch:
        mus += saw_additive(NOTE(nm) * 2, a * 0.03, fc=1400, harmonics=14, detune=0.003)

# 6) somber choir pad (crater, ejecta, globe)
C0, C1 = T9 - 0.2, T12 + 0.6
choir = np.zeros(N, np.float32)
cprog = [("D3", "F3", "A3", "E4"), ("Bb2", "D3", "F3", "C4"), ("G2", "Bb2", "D3", "A3"), ("A2", "C#3", "E3", "A3")]
seg = (C1 - C0) / 4
for k_, ch in enumerate(cprog):
    s0 = C0 + k_ * seg
    a = env([(0, 0), (s0 - 0.4, 0), (s0 + 0.6, 1), (s0 + seg, 1), (s0 + seg + 0.6, 0), (DUR, 0)])
    for nm in ch:
        vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t + rng.random() * 6)
        for det in (-0.004, 0.004):
            choir += saw_additive(NOTE(nm) * (1 + det), a * 0.03, fc=2600, harmonics=16) * vib
choir = stft_filter(choir, lambda tt, f: 0.25 + 1.1 * np.exp(-((f - 700) / 220) ** 2) + 0.8 * np.exp(-((f - 1150) / 260) ** 2) + 0.4 * np.exp(-((f - 2600) / 400) ** 2))
mus += choir * env([(0, 0), (C0, 0), (C0 + 0.5, 1), (C1, 1), (C1 + 0.4, 0), (DUR, 0)])
for bt in [T10 + 0.3, T10 + 1.5, T10 + 2.4, T11 + 0.2]:
    place(mus, tom(60, 1.6), bt, 0.32)

# 7) hope: major lift (orbits + DART)
H0_, H1_ = T12 - 0.1, T14 + 0.2
hprog = [("F2", "A2", "C3", "F3"), ("C2", "G2", "C3", "E3"), ("D2", "A2", "D3", "F3"), ("Bb1", "F2", "Bb2", "D3")]
hseg = (H1_ - H0_) / 4
for k_, ch in enumerate(hprog):
    s0 = H0_ + k_ * hseg
    a = env([(0, 0), (s0 - 0.25, 0), (s0 + 0.5, 1), (s0 + hseg, 1), (s0 + hseg + 0.5, 0), (DUR, 0)])
    for nm in ch:
        mus += saw_additive(NOTE(nm) * 2, a * 0.022, fc=1800, harmonics=14, detune=0.003)
        mus += saw_additive(NOTE(nm) * 2, a * 0.018, fc=1800, harmonics=14, detune=-0.004)
    arp = [ch[1], ch[2], ch[3], ch[2]]
    for j, b0 in enumerate(np.arange(s0, s0 + hseg, 0.25)):
        place(mus, pluck(NOTE(arp[j % 4]) * 4, 0.9, bright=4), b0, 0.09)
# DART hit accent + swell
braam(TDI - 0.02, 0.7, root="F1")
sw = noise("pink", int(1.2 * SR)) * np.linspace(0, 1, int(1.2 * SR)).astype(np.float32) ** 3
place(mus, stft_filter(sw, lambda tt, f: 1 / np.sqrt(1 + (f / 7000) ** 2) * (f > 2000)) * 0.08, TDI - 1.2)

mus = reverb(mus, 2.8, 0.28, seed=3)
# silence around the flash (only the ear-ring survives)
gap = 1 - ss(TI - 0.06, TI, t) * (1 - ss(TBOOM + 0.6, TBOOM + 2.6, t))
mus *= gap.astype(np.float32)

# ======================= SFX =======================
sfx = np.zeros(N, np.float32)
brown = noise("brown"); pinkn = noise("pink"); white = noise("white")

# fireball roar: hook, entry, plunge, loop
roar_amp = env([(0, 0.8), (T1 - 0.1, 0.9), (T1, 0.05), (T2 - 0.1, 0.05), (T2, 0.45), (T3, 0.9), (TI - 0.05, 1.25), (TI, 0), (T14, 0), (T14 + 1.0, 0.25), (DUR, 0.8)])
roar_fc = env([(0, 1300), (T2, 1300), (T3, 2200), (TI, 4000), (TI + 0.01, 400), (DUR, 1300)])
roar = stft_filter(brown * 0.5 + pinkn * 0.6, lambda tt, f: 1 / np.sqrt(1 + (f / np.interp(tt, t[::480], roar_fc[::480])) ** 4))
am = (1 + 0.35 * np.sin(2 * np.pi * 3.1 * t) * np.sin(2 * np.pi * 0.7 * t)).astype(np.float32)
sfx += roar * roar_amp * am * 0.26
# crackle for the burning head
cr = (rng.random(N) < 0.0009).astype(np.float32) * rng.standard_normal(N).astype(np.float32)
cr = stft_filter(cr, lambda tt, f: (f > 1500) / np.sqrt(1 + (f / 7000) ** 2))
sfx += cr * env([(0, 0.6), (T1, 0.6), (T1 + 0.01, 0), (T2, 0), (T2 + 0.01, 1.0), (TI, 1.4), (TI + 0.01, 0), (T14, 0), (DUR, 0.6)]) * 1.4

# cut whooshes
def whoosh(at, secs=0.9, f0=300, f1=4000, gain=0.3, rev=False):
    n = int(secs * SR); k = np.linspace(0, 1, n)
    x = white[:n] * (np.sin(np.pi * k) ** 2)
    fc = (f0 + (f1 - f0) * (k if not rev else 1 - k))
    y = stft_filter(x, lambda tt, f: bp_gain(np.interp(tt, np.linspace(0, secs, n), fc), 1.2)(tt, f), n=1024, hop=256)
    place(sfx, y.astype(np.float32), at - secs * 0.6, gain)
whoosh(T1, 0.8, 4000, 300, 0.35); whoosh(T2, 0.8, 300, 3000, 0.3); whoosh(T3, 0.7, 500, 5000, 0.3)
# space: low hum + passing rush
sp_amp = env([(0, 0), (T1 - 0.05, 0), (T1 + 0.2, 0.6), (T2 - 0.1, 0.6), (T2, 0), (DUR, 0)])
sfx += (np.sin(2 * np.pi * 42 * t) * 0.5 + np.sin(2 * np.pi * 63 * t) * 0.25).astype(np.float32) * sp_amp * 0.25
sfx += stft_filter(pinkn, bp_gain(1800, 2.0)) * sp_amp * 0.06

# IMPACT: ear-ring, then the boom
ring_n = int(3.0 * SR); kk = np.arange(ring_n) / SR
ear = (np.sin(2 * np.pi * 3150 * kk) * 0.6 + np.sin(2 * np.pi * 3170 * kk) * 0.4) * np.exp(-kk / 1.1) * np.minimum(1, kk / 0.02)
place(sfx, ear.astype(np.float32), TI + 0.02, 0.06)
bn = int(7 * SR); kb = np.arange(bn) / SR
sub = np.sin(2 * np.pi * np.cumsum(24 + 40 * np.exp(-kb * 1.5)) / SR) * np.exp(-kb / 1.3) * np.minimum(1, kb / 0.01)
body = stft_filter(brown[:bn] * 1.0, lp_gain(260, 2)) * np.exp(-kb / 1.1) * np.minimum(1, kb / 0.02)
crack = stft_filter(white[:bn], bp_gain(900, 0.7)) * np.exp(-kb / 0.12)
blast = stft_filter(pinkn[:bn], bp_gain(700, 0.45)) * np.exp(-kb / 0.9) * np.minimum(1, kb / 0.008)
boom = (np.tanh((sub * 1.2 + body * 1.1 + crack * 0.8 + blast * 1.4) * 1.6)).astype(np.float32)
place(sfx, boom, TBOOM, 0.95)
# rolling thunder / rumble bed after the boom (dome, mushroom)
rum_amp = env([(0, 0), (TBOOM + 0.5, 0), (TBOOM + 2, 0.7), (T6, 0.55), (T7, 0.4), (T9, 0.3), (T12, 0.0), (DUR, 0)])
rum = stft_filter(brown, lp_gain(170, 2)) * (0.8 + 0.4 * np.sin(2 * np.pi * 0.23 * t) * np.sin(2 * np.pi * 0.37 * t + 1))
sfx += rum.astype(np.float32) * rum_amp * 0.35
sfx += stft_filter(pinkn, bp_gain(320, 0.7)).astype(np.float32) * rum_amp * 0.12
# engulf: fire roar crescendo + glass
fire_amp = env([(0, 0), (T6 - 0.1, 0), (T6 + 0.3, 0.35), (T7 - 0.2, 1.0), (T7, 0.3), (T8, 0.2), (T9, 0.25), (T11, 0.2), (T11 + 0.5, 0), (DUR, 0)])
fire = stft_filter(pinkn, bp_gain(700, 0.6)) * (0.8 + 0.4 * np.abs(np.sin(2 * np.pi * 1.7 * t)))
sfx += fire.astype(np.float32) * fire_amp * 0.4
sfx += cr * fire_amp * 1.1
for k_ in range(14):
    at = T6 + 0.5 + rng.random() * (T7 - T6 - 0.6)
    n = int(0.6 * SR); kg = np.arange(n) / SR
    g = sum(np.sin(2 * np.pi * (3000 + 5000 * rng.random()) * kg) * np.exp(-kg * (12 + 20 * rng.random())) * (kg > 0.03 * rng.random()) for _ in range(6))
    g = g * 0.12 + stft_filter(white[:n], lambda tt, f: (f > 3000) * 1.0, n=512, hop=128) * np.exp(-kg * 25) * 0.4
    place(sfx, g.astype(np.float32), at, 0.18)
# shock: blast whoosh + collapse thuds
whoosh(T7 + 0.4, 1.4, 200, 2500, 0.45)
for k_ in range(7):
    place(sfx, tom(45 + 20 * rng.random(), 1.4), T7 + 0.3 + k_ * 0.2 + rng.random() * 0.1, 0.22)
# hit: wind wall crescendo, slam, debris
wind_amp = env([(0, 0), (T8 - 0.2, 0), (THIT - 0.05, 0.9), (THIT + 0.3, 0.6), (T9, 0.3), (T9 + 0.4, 0), (DUR, 0)])
wind = stft_filter(pinkn, lambda tt, f: bp_gain(500 + 1500 * np.clip((tt - T8) / max(THIT - T8, 0.1), 0, 1), 0.8)(tt, f))
sfx += wind.astype(np.float32) * wind_amp * 0.6
slam = np.tanh(kick(80, 30, 2.0, 0.8) * 2.0 + stft_filter(white[:int(2 * SR)], lp_gain(1200, 2)) * np.exp(-np.arange(int(2 * SR)) / SR / 0.4))
place(sfx, slam.astype(np.float32), THIT, 0.7)
deb = (rng.random(N) < 0.004).astype(np.float32) * rng.standard_normal(N).astype(np.float32)
deb = stft_filter(deb, bp_gain(2500, 0.8))
sfx += deb * env([(0, 0), (THIT, 0), (THIT + 0.05, 1.2), (T9, 0.4), (T9 + 0.3, 0), (DUR, 0)]) * 0.8
# crater + ejecta: distant booms, whistles, impacts
for k_ in range(5):
    place(sfx, kick(50, 28, 2.0, 0.05), T9 + 0.6 + k_ * 0.8 + rng.random() * 0.3, 0.18)
for k_ in range(16):
    at = T10 + rng.random() * (T11 - T10 - 0.8)
    d = 0.8 + rng.random() * 1.0
    w_ = glide(2600 + 1500 * rng.random(), 500 + 300 * rng.random(), d, 1.3) * np.sin(np.linspace(0, np.pi, int(d * SR))) ** 2
    place(sfx, w_.astype(np.float32), at, 0.03 + 0.03 * rng.random())
    place(sfx, kick(55, 30, 1.0, 0.3), at + d, 0.12)
# globe: airy wind
sfx += stft_filter(pinkn, bp_gain(400, 1.0)) * env([(0, 0), (T11 - 0.2, 0), (T11 + 0.4, 0.25), (T12, 0.2), (T12 + 0.4, 0), (DUR, 0)])
# orbits: twinkles
for k_ in range(22):
    at = T12 + 0.3 + rng.random() * (T13 - T12 - 0.6)
    place(sfx, pluck(NOTE("A5") * 2 ** (rng.integers(0, 12) / 12 * 0 + [0, 3 / 12, 7 / 12, 1][rng.integers(0, 4)]), 1.2, bright=2), at, 0.03)
# DART: approach whoosh, crunch + boom
whoosh(TDI, 1.6, 200, 3000, 0.35)
place(sfx, np.tanh(kick(75, 35, 1.8, 0.9) * 2).astype(np.float32), TDI, 0.6)
place(sfx, (stft_filter(white[:int(1.5 * SR)], bp_gain(1500, 0.5)) * np.exp(-np.arange(int(1.5 * SR)) / SR / 0.25)).astype(np.float32), TDI, 0.35)
# loop: whoosh into the restart
whoosh(DUR + 0.1, 1.4, 200, 2500, 0.3)

sfx = reverb(sfx, 2.2, 0.18, seed=5)

# ======================= MIX =======================
vo, sr = sf.read(os.path.join(HERE, "out", "vo.wav"), dtype="float32")
assert sr == SR
vo = np.pad(vo, (0, max(0, N - len(vo))))[:N]
# ducking envelope from the narration
e = np.abs(vo); k = int(0.05 * SR); e = np.convolve(e, np.ones(k) / k, mode="same")
vo_act = np.clip(e / 0.02, 0, 1)
duck_m = 1 - 0.5 * vo_act; duck_s = 1 - 0.6 * vo_act
vo_c = np.tanh(vo * 1.6) / 1.2                     # gentle compression on the voice

def stereo(x, width=0.0):
    """mono -> stereo; width>0 adds a short Haas-style side signal"""
    if width == 0: return np.stack([x, x], 1)
    d = int(0.012 * SR); y = np.concatenate([np.zeros(d, np.float32), x[:-d]])
    return np.stack([x + y * width, x - y * width], 1) / (1 + width * 0.5)

mix = stereo(vo_c * 1.0) + stereo(mus * duck_m * 1.2, 0.35) + stereo(sfx * duck_s * 0.95, 0.25)
if os.environ.get("STEMS"):
    for nm, x in [("vo", vo_c), ("mus", mus * duck_m * 0.95), ("sfx", sfx * duck_s * 0.95)]:
        sf.write(os.path.join(HERE, "out", f"stem_{nm}.wav"), x.astype(np.float32), SR)
# loop seam: short fade at both ends (the loop restarts on a roar)
fade = int(0.02 * SR); mix[:fade] *= np.linspace(0, 1, fade)[:, None]; mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
pk = np.max(np.abs(mix)); mix = mix / pk * 0.89
sf.write(os.path.join(HERE, "out", "mix.wav"), mix.astype(np.float32), SR, subtype="PCM_24")
print("wrote out/mix.wav", f"{DUR:.2f}s", "peak-normalised from", round(float(pk), 3))
print("cues: T1 %.2f T2 %.2f T3 %.2f TI %.2f T6 %.2f T7 %.2f T8 %.2f THIT %.2f T9 %.2f T10 %.2f T11 %.2f T12 %.2f T13 %.2f TDI %.2f T14 %.2f" % (T1, T2, T3, TI, T6, T7, T8, THIT, T9, T10, T11, T12, T13, TDI, T14))
