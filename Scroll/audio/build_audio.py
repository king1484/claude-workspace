#!/usr/bin/env python3
"""SCROLL audio: a solo piano score rendered from the Salamander Grand Piano samples (CC BY 3.0, Alexander Holm),
plus foley/SFX (CC0 recordings from Freesound where they exist, synthesized where they do not), mixed to the targets in
docs/SOUND_DESIGN.md. Everything is a pure function of the cue lists below; no randomness without a fixed seed.

Env: PIANO_DIR  folder with the Salamander WAVs (e.g. A0v1.wav)   SFX_DIR  folder of downloaded Freesound previews
Usage: python3 Scroll/audio/build_audio.py OUT.wav
Needs numpy and ffmpeg."""
import os, re, sys, wave, subprocess, glob
import numpy as np

SR = 48000
DUR = 232.0
PIANO_DIR = os.environ.get("PIANO_DIR", "Scroll/assets/piano/SalamanderGrandPianoV3_44.1khz16bit/44.1khz16bit")
SFX_DIR = os.environ.get("SFX_DIR", "Scroll/assets/sfx")
rng0 = np.random.default_rng(20261016)

# ----------------------------------------------------------------------------------------------------------- utils
def T(n): return np.arange(n) / SR
def db(x): return 10 ** (x / 20.0)
def peak_norm(x, pk=1.0): m = np.max(np.abs(x)) + 1e-12; return x * (pk / m)
def env_exp(n, atk, tau): t = T(n); return np.minimum(1, t / max(atk, 1e-4)) * np.exp(-t / tau)
def fade(x, a=0.005, b=0.02):
    x = x.copy(); na, nb = int(a * SR), int(b * SR)
    if na: x[:na] *= np.linspace(0, 1, na)
    if nb: x[-nb:] *= np.linspace(1, 0, nb)
    return x
def fft_filter(x, lo=None, hi=None, tw=0.15):
    n = len(x); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); m = np.ones_like(f)
    if lo: m *= 1 / (1 + np.exp(-(np.log2(np.maximum(f, 1) / lo)) / tw))
    if hi: m *= 1 / (1 + np.exp((np.log2(np.maximum(f, 1) / hi)) / tw))
    return np.fft.irfft(X * m, n)
def noise(n, seed=None): return (np.random.default_rng(seed) if seed is not None else rng0).standard_normal(n)
def band(dur, lo, hi, seed=None): return fft_filter(noise(int(dur * SR), seed), lo, hi)

def ffmpeg_mono(path):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True)
    return np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)
_cache = {}
def sfx_file(sub, fid):
    k = (sub, fid)
    if k not in _cache:
        p = os.path.join(SFX_DIR, sub, f"{fid}.mp3")
        _cache[k] = ffmpeg_mono(p) if os.path.exists(p) else None
    return _cache[k]

# ----------------------------------------------------------------------------------------------------------- piano
NAMES = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
def midi(n):
    m = re.match(r"^([A-G]#?)(-?\d)$", n); return 12 * (int(m.group(2)) + 1) + NAMES[m.group(1)]
_samples = {}
def index_piano():
    for f in os.listdir(PIANO_DIR):
        m = re.match(r"^([A-G]#?)(\d)v(\d+)\.wav$", f)
        if m: _samples.setdefault(midi(m.group(1) + m.group(2)), {})[int(m.group(3))] = os.path.join(PIANO_DIR, f)
_wcache = {}
def load_stereo(path):
    if path not in _wcache:
        with wave.open(path) as w:
            d = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
            _wcache[path] = d.reshape(-1, w.getnchannels()).T if w.getnchannels() > 1 else np.stack([d, d])
    return _wcache[path]
def piano_note(m, vel, dur, tail=5.0):
    src = min(_samples.keys(), key=lambda k: abs(k - m)); layer = int(np.clip(round(1 + vel / 127 * 15), 1, 16))
    layers = _samples[src]; layer = min(layers.keys(), key=lambda k: abs(k - layer))
    s = load_stereo(layers[layer]); f = 2 ** ((m - src) / 12) * 44100 / SR
    n = int(min(s.shape[1] - 2, (dur + tail) * SR * f) / f)
    idx = np.arange(n) * f; i0 = idx.astype(int); fr = (idx - i0).astype(np.float32)
    out = s[:, i0] * (1 - fr) + s[:, i0 + 1] * fr
    t = np.arange(n) / SR; rel = np.where(t > dur, np.exp(-(t - dur) / 0.55), 1.0).astype(np.float32)   # pedal-like release after note-off
    return out * rel
def N(name): return midi(name)

# ----------------------------------------------------------------------------------------------------------- synthesized sounds
def sine(f, n, ph=0.0): return np.sin(2 * np.pi * f * T(n) + ph)
def ping(f, dur=2.0, tau=0.5, bright=0.12):
    n = int(dur * SR); return (sine(f, n) + bright * sine(2 * f, n) + 0.04 * sine(3 * f, n)) * env_exp(n, 0.004, tau)
def bell(f, dur=4.5):
    n = int(dur * SR); out = np.zeros(n)
    for r, a, tau in [(1, 1, 2.4), (2.01, 0.5, 1.5), (2.76, 0.35, 1.1), (4.07, 0.2, 0.7), (5.4, 0.12, 0.45)]: out += a * sine(f * r, n) * env_exp(n, 0.002, tau)
    return out
def click(dur=0.03, f=2200, tau=0.004):
    n = int(dur * SR); return (noise(n) * 0.6 + sine(f, n)) * env_exp(n, 0.0005, tau)
def swipe():
    n = int(0.2 * SR); e = np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5; return band(0.2, 1800, 7000) * e
def whistle_fall(dur, f0=2300, f1=360):
    n = int(dur * SR); t = T(n); f = f1 + (f0 - f1) * np.exp(-t / (dur * 0.38)); f = f * (1 + 0.012 * np.sin(2 * np.pi * 5 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR; a = np.minimum(1, t / 0.25) * np.exp(-t / (dur * 0.7)) * np.minimum(1, (dur - t) / 0.6)
    return (np.sin(ph) + 0.1 * np.sin(2 * ph)) * a
def lever():
    n = int(0.5 * SR); t = T(n); return sine(68, n) * np.exp(-t / 0.09) * 1.0 + band(0.5, 2500, 7000) * np.exp(-t / 0.012) * 0.5 + ping(1450, 0.5, 0.05) * 0.25
def ratchet(dur, r0=28, r1=5):
    n = int(dur * SR); out = np.zeros(n); t = 0.0
    while t < dur: i = int(t * SR); c = click(0.02, 3000, 0.003); out[i:i + len(c)] += c[:max(0, n - i)][:len(out[i:i + len(c)])] * 0.6; t += 1 / (r0 + (r1 - r0) * (t / dur) ** 0.7)
    return out
def tinkle(dur=1.2, seed=1):
    r = np.random.default_rng(seed); n = int(dur * SR); out = np.zeros(n)
    for _ in range(9):
        t0 = r.random() * (dur - 0.3); f = r.choice([2637, 3136, 3520, 4186, 4699]); p = ping(f, 0.35, 0.07, 0.3) * (0.4 + 0.6 * r.random()); i = int(t0 * SR); out[i:i + len(p)] += p[:n - i]
    return out
def alarm_beeps():
    seq = []; n = int(0.17 * SR)
    for rep in range(4):
        for f in (880, 1100): seq.append(np.sin(2 * np.pi * f * T(n)) * np.sin(np.pi * np.linspace(0, 1, n)) ** 0.6)
        seq.append(np.zeros(int(0.08 * SR)))
    seq.append(np.zeros(int(0.5 * SR))); return np.concatenate(seq)
def battery_tone():
    n = int(0.16 * SR); a = np.sin(2 * np.pi * 988 * T(n)) * np.sin(np.pi * np.linspace(0, 1, n)); b = np.sin(2 * np.pi * 740 * T(n)) * np.sin(np.pi * np.linspace(0, 1, n))
    return np.concatenate([a, np.zeros(int(0.06 * SR)), b])
def powerdown():
    n = int(0.55 * SR); t = T(n); f = 700 * np.exp(-t / 0.12) + 50; ph = 2 * np.pi * np.cumsum(f) / SR; out = np.sin(ph) * np.exp(-t / 0.2); c = click(0.02) * 0.3; out[:len(c)] += c; return out
def shimmer(dur=3.0):
    n = int(dur * SR); t = T(n); out = np.zeros(n)
    for f, a in [(1174.7, 1), (1760, 0.7), (1480, 0.55), (2349, 0.3)]: out += a * sine(f, n) * np.sin(np.pi * t / dur) ** 2
    return out
def paper_tap(): n = int(0.07 * SR); return band(0.07, 700, 5000) * env_exp(n, 0.001, 0.014)
def breath(dur, f=1.0):
    n = int(dur * SR); e = np.sin(np.pi * np.linspace(0, 1, n)) ** 2; return band(dur, 300, 2600) * e
def creak(dur=0.5):
    n = int(dur * SR); t = T(n); f = 140 + 40 * t / dur; ph = 2 * np.pi * np.cumsum(f) / SR; return np.sin(ph) * (0.6 + 0.4 * np.sin(2 * np.pi * 22 * t)) * np.sin(np.pi * t / dur)
def thud(f=90, tau=0.08):
    n = int(0.4 * SR); t = T(n); return sine(f, n) * np.exp(-t / tau) + band(0.4, 80, 500) * np.exp(-t / 0.03) * 0.5
def boing():
    n = int(0.35 * SR); t = T(n); f = 500 - 250 * np.minimum(1, t / 0.12) + 160 * np.clip((t - 0.12) / 0.2, 0, 1); ph = 2 * np.pi * np.cumsum(f) / SR; return np.sin(ph) * np.exp(-t / 0.12)
def tension(dur):
    n = int(dur * SR); t = T(n); f = 180 + 80 * t / dur; ph = 2 * np.pi * np.cumsum(f * (1 + 0.01 * np.sin(2 * np.pi * 7 * t))) / SR; return np.sin(ph) * np.sin(np.pi * t / dur) ** 1.2
def wood_slide(dur):
    n = int(dur * SR); t = T(n); return band(dur, 180, 1400) * (0.5 + 0.5 * np.sin(2 * np.pi * 11 * t)) * np.sin(np.pi * t / dur) ** 0.7
def rolling(dur):
    n = int(dur * SR); t = T(n); return band(dur, 70, 700) * np.exp(-t / (dur * 0.5)) * (0.7 + 0.3 * np.sin(2 * np.pi * (14 - 9 * t / dur) * t))
def clock_rewind(dur):
    out = np.zeros(int(dur * SR)); t = 0.0
    while t < dur - 0.05:
        i = int(t * SR); c = click(0.03, 1400, 0.006) * (0.6 + 0.4 * t / dur); out[i:i + len(c)] += c[:len(out[i:i + len(c)])]; t += 0.5 * (0.08 / 0.5) ** (t / dur) + 0.02
    return out
def sub_swell(dur, f=55):
    n = int(dur * SR); return sine(f, n) * np.sin(np.pi * T(n) / dur) ** 2
def street(dur):
    n = int(dur * SR); b = fft_filter(noise(n, 3), None, 280) * 3.0; sw = 0.6 + 0.4 * np.sin(2 * np.pi * T(n) / 7.0); return b * sw + band(dur, 600, 3000, 4) * 0.04
def drone(dur, f=73.42):
    n = int(dur * SR); t = T(n); e = np.sin(np.pi * t / dur) ** 2; return (sine(f, n) + 0.6 * sine(f * 1.5, n) + 0.2 * sine(f * 2, n)) * e

# real-recording helpers
def slices_by_onset(x, win=0.25, thr=0.35, gap=0.3, pre=0.02):
    e = np.convolve(np.abs(x), np.ones(int(0.006 * SR)) / int(0.006 * SR), mode="same"); mx = e.max(); pk = []; last = -1e9
    for i in range(1, len(e) - 1):
        if e[i] > thr * mx and e[i] >= e[i - 1] and e[i] >= e[i + 1] and i - last > gap * SR: pk.append(i); last = i
    return [fade(x[max(0, p - int(pre * SR)): p + int(win * SR)], 0.002, 0.04) for p in pk]
def loop_to(x, n, xf=1.5):
    if x is None: return np.zeros(n)
    xf_n = int(xf * SR); out = np.zeros(n); pos = 0; first = True
    while pos < n:
        seg = x.copy(); seg[:xf_n] *= np.linspace(0, 1, xf_n) if not first else 1; seg[-xf_n:] *= np.linspace(1, 0, xf_n)
        m = min(len(seg), n - pos); out[pos:pos + m] += seg[:m]; pos += len(seg) - xf_n; first = False
    return out

# ----------------------------------------------------------------------------------------------------------- mix buffers
NS = int(DUR * SR)
bus = {k: np.zeros((2, NS), dtype=np.float32) for k in ("piano", "sfx", "amb")}
def put(name, x, t, peak_db, pan=0.0):
    if x is None or len(x) == 0: return
    x = peak_norm(np.asarray(x, dtype=np.float64), db(peak_db)); i = int(t * SR)
    if i < 0 or i >= NS: return
    m = min(len(x), NS - i); l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    bus[name][0, i:i + m] += (x[:m] * l * 1.4142).astype(np.float32); bus[name][1, i:i + m] += (x[:m] * r * 1.4142).astype(np.float32)
def put_gain(name, x, t, gain_db, pan=0.0):            # no normalising: keep a sample's own level, only offset by gain_db
    put_raw(name, x, t, db(gain_db), pan)
def put_raw(name, x, t, g, pan=0.0):
    i = int(t * SR); m = min(len(x), NS - i)
    if m <= 0: return
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    bus[name][0, i:i + m] += (x[:m] * g * l * 1.4142).astype(np.float32); bus[name][1, i:i + m] += (x[:m] * g * r * 1.4142).astype(np.float32)
def put_stereo(name, st, t, gain_db):
    i = int(t * SR); m = min(st.shape[1], NS - i)
    if m > 0: bus[name][:, i:i + m] += st[:, :m] * db(gain_db)
def env_curve(n, pts):                                  # pts: [(t_sec_in_clip, gain)]  linear interpolation
    t = T(n); xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; return np.interp(t, xs, ys)

# ----------------------------------------------------------------------------------------------------------- piano score (see SOUND_DESIGN.md: D centre, D-A-G motif, the third F# arrives with the coin at 142.0)
def score():
    P = []                                              # (t, note, vel, dur)
    a = lambda t, n, v, d: P.append((t, N(n), v, d))
    # hook: low D pedal, half-stated motif
    a(1.0, "D2", 46, 12); a(1.0, "D3", 36, 10); a(8.0, "D4", 36, 4); a(9.9, "A4", 32, 5)
    # setup: the motif twice, wide, long pedal
    a(21.0, "D3", 34, 6); a(21.0, "D4", 38, 3); a(23.0, "A4", 34, 3); a(24.9, "G4", 32, 5)
    a(28.5, "D3", 34, 6); a(28.5, "D4", 38, 3); a(30.4, "A4", 34, 3); a(32.3, "G4", 32, 3); a(31.0, "A2", 30, 6)
    a(37.5, "D5", 30, 4); a(40.6, "A4", 40, 2); a(41.1, "D5", 42, 3)
    # the pull: staccato D-A-G ostinato that tightens and climbs
    pat = ["D4", "A4", "G4", "A4"]; t = 45.0; i = 0
    while t < 80:
        gap = max(0.2, 0.47 - 0.27 * (t - 45) / 25); oct_ = 0 if t < 56 else (12 if t < 66 else 12)
        v = int(46 + 28 * min(1, (t - 45) / 28)); note = midi(pat[i % 4]) + oct_
        P.append((t, note, v, 0.18))
        if t > 62 and i % 2 == 0: P.append((t, note - 12, v - 8, 0.2))
        t += gap; i += 1
    # the shadow: single notes thin out, stop at the false stop
    a(81.0, "D4", 36, 3); a(83.5, "A4", 32, 3); a(85.5, "G4", 30, 3)
    # low point: almost nothing
    a(95.5, "D2", 30, 8); a(109.0, "A1", 28, 6)
    # silence 115-123.  One note.
    a(125.0, "D3", 30, 5)
    # the turn: the motif alone, unresolved ...
    a(131.0, "D4", 32, 3); a(132.9, "A4", 30, 3); a(134.8, "G4", 28, 4); a(137.0, "D3", 30, 5)
    # ... and F# arrives with the coin (142.0)
    a(142.0, "D3", 56, 8); a(142.0, "A3", 50, 8); a(142.0, "F#4", 58, 8); a(142.45, "A4", 48, 7); a(143.5, "D5", 44, 7)
    # colour: the motif in major, octave doubled; a very quiet drone sits underneath (below)
    a(149.0, "D3", 38, 6); a(149.0, "A3", 34, 6)
    a(150.0, "D4", 44, 3); a(151.9, "F#4", 42, 3); a(153.8, "A4", 42, 3); a(155.7, "G4", 38, 3); a(157.4, "F#4", 40, 5)
    a(159.0, "D5", 42, 4); a(159.0, "D4", 38, 4); a(161.0, "A4", 38, 3); a(163.0, "F#4", 38, 4); a(165.0, "D4", 36, 6); a(165.0, "D3", 34, 8)
    a(166.5, "F#4", 34, 5); a(168.2, "A4", 34, 6)
    # replay: the same ostinato, slower and warm, settles with the bell at 182
    pat2 = ["D4", "F#4", "A4", "F#4"]; t = 172.5; i = 0
    while t < 181.8: P.append((t, midi(pat2[i % 4]), int(36 + 10 * (t - 172.5) / 9), 0.4)); t += 0.75; i += 1
    a(182.0, "D3", 52, 8); a(182.0, "F#4", 48, 8); a(182.2, "A4", 46, 8); a(182.4, "D5", 44, 8)
    a(186.0, "D4", 38, 3); a(188.0, "F#4", 36, 3); a(190.0, "A4", 36, 3); a(192.0, "D5", 34, 5)
    a(193.5, "F#4", 32, 4); a(195.5, "A4", 32, 4); a(197.2, "D4", 30, 4)
    a(199.0, "D3", 38, 8); a(199.0, "A3", 34, 8); a(199.0, "F#4", 36, 8); a(201.5, "D4", 26, 5); a(203.5, "D5", 24, 8)
    # coda: the motif, last note decays into silence
    a(206.0, "D4", 30, 3); a(208.0, "A4", 28, 3); a(210.0, "G4", 26, 3); a(212.0, "F#4", 26, 4); a(214.0, "D4", 24, 6); a(214.0, "F#4", 22, 6)
    a(215.2, "D3", 22, 8); a(215.2, "A3", 20, 8)
    a(224.0, "D4", 28, 6); a(224.0, "F#4", 26, 6); a(224.0, "A4", 24, 6)
    return P

def addpad(a, b):
    n = max(len(a), len(b)); out = np.zeros(n); out[:len(a)] += a; out[:len(b)] += b; return out

def swell_reverse(t_peak, dur=4.4, vel=36):
    n1 = piano_note(N("D3"), vel, 3.0, 3.0); n2 = piano_note(N("A3"), vel - 4, 3.0, 3.0); m = min(n1.shape[1], n2.shape[1], int(dur * SR))
    x = (n1[:, :m] + n2[:, :m])[:, ::-1] * np.linspace(0, 1, m) ** 1.6
    put_stereo("piano", np.ascontiguousarray(x), t_peak - m / SR, 0)

# ----------------------------------------------------------------------------------------------------------- foley cue list
def step_times(x0, x1, wk0, wk1, t0, stride=84.0):
    """times when the walker's phase crosses k*pi, for x = lerp(x0,x1,smooth(wk)); wk goes 0..1 between t0+wk0 and t0+wk1"""
    out = []; span = abs(x1 - x0); k = 1
    while k * stride <= span + 1e-6:
        target = k * stride / span; lo, hi = 0.0, 1.0
        for _ in range(40):
            mid = (lo + hi) / 2
            if 3 * mid ** 2 - 2 * mid ** 3 < target: lo = mid
            else: hi = mid
        out.append(t0 + wk0 + (lo + hi) / 2 * (wk1 - wk0)); k += 1
    return out

def build_sfx():
    S = lambda *a, **k: put("sfx", *a, **k)
    # ---- ambience
    room = sfx_file("bedroom_ambience", 761024)
    if room is not None:
        r1 = loop_to(room, int(112.5 * SR)); r1 = peak_norm(r1) * env_curve(len(r1), [(0, 0), (1, 1), (109.5, 1), (112.4, 0)]); put("amb", r1, 3.0, -44)
        r2 = loop_to(room, int(82 * SR)); r2 = peak_norm(r2) * env_curve(len(r2), [(0, 0), (2, 1), (78, 1), (82, 0)]); put("amb", r2, 123.0, -44)
        put("amb", peak_norm(loop_to(room, int(22 * SR))) * env_curve(int(22 * SR), [(0, 0), (1, 1), (21, 1), (22, 0)]), 205.0, -46)
    rain = sfx_file("rain_window", 669621)
    if rain is not None:
        r = loop_to(rain, int(40 * SR), 2.0); r = peak_norm(r) * env_curve(len(r), [(0, 0), (3, 1), (30, 1), (38, 0.0)]); put("amb", r, 118.0, -37)
    birds = sfx_file("robin_bird_song", 179505)
    if birds is not None:
        b = fft_filter(birds, 600, None); b = peak_norm(b) * env_curve(len(b), [(0, 0), (4, 1), (len(b) / SR - 4, 1), (len(b) / SR, 0)]); put("amb", b, 152.0, -43)
    put("amb", peak_norm(street(11)) * env_curve(int(11 * SR), [(0, 0), (1.5, 1), (9, 1), (11, 0)]), 205.0, -42)
    # ---- clock ticks (real kitchen clock recording where it works, synthesized otherwise)
    ticks = sfx_file("wall_clock_tick_quiet", 708022); tk = slices_by_onset(ticks, 0.2, 0.3, 0.4) if ticks is not None else []
    def tickc(i): return tk[i % len(tk)] if len(tk) else click(0.03, 1500, 0.006)
    def tick_run(t0, t1, gap, level):
        t = t0; i = 0
        while t < t1: S(tickc(i), t, level); t += gap(t) if callable(gap) else gap; i += 1
    tick_run(3.5, 14.0, 1.0, -34); tick_run(20.0, 86.0, 1.0, -34); tick_run(86.0, 115.0, lambda t: 1.0 + 0.6 * min(1, (t - 86) / 6), -34); tick_run(123.0, 205.0, 1.0, -37)
    S(clock_rewind(5.6), 14.2, -28)
    # ---- the hook
    S(ping(587.33, 3.2, 0.9), 0.45, -38)
    for t in np.arange(3.0, 14.0, 0.9): S(swipe(), t, -31, pan=0.1)
    for i in range(9): S(ping([587.33, 784, 880][i % 3] * (1 if i % 2 else 0.5), 0.5, 0.08), 8.9 + 0.62 * i, -37)
    S(whistle_fall(4.8), 9.4, -32); S(sub_swell(2.6, 55), 7.9, -32)
    # ---- setup
    S(creak(0.55), 20.3, -33); S(rolling(2.4), 27.0, -34); S(click(0.02, 2400), 29.5, -32)
    pencil = sfx_file("pencil_drawing_paper", 335509); pen_slices = []
    if pencil is not None:
        L = len(pencil); pen_slices = [fade(pencil[int(a * SR):int(b * SR)], 0.02, 0.06) for a, b in [(0, 1.6), (1.4, 3.2), (3.0, 4.8)] if int(b * SR) <= L]
    cloth = [sfx_file("fabric_rustle_blanket", i) for i in (493457, 493462, 493504)]; cloth = [c for c in cloth if c is not None]
    cl = lambda i: cloth[i % len(cloth)] if cloth else band(0.7, 400, 3500) * np.sin(np.pi * np.linspace(0, 1, int(0.7 * SR)))
    S(cl(0), 34.0, -34); S(sine(440, int(0.9 * SR)) * np.sin(np.pi * T(int(0.9 * SR)) / 0.9) ** 2, 34.4, -38)
    sw = sfx_file("light_switch_click", 557505); S(sw if sw is not None else click(0.03), 35.4, -31)
    for t in (39.6, 40.9, 42.2, 43.5): S(swipe(), t, -31)
    S(ping(880, 1.2, 0.3), 40.2, -28); S(ping(587.33, 0.9, 0.2), 41.6, -32); S(ping(784, 0.9, 0.2), 43.0, -32)
    # ---- the pull
    for ts, res in ((45.5, 0), (47.6, 1), (49.7, 2)):
        S(lever(), ts + 0.3, -25); S(ratchet(1.6), ts + 0.1, -33)
        for r in range(3): S(addpad(click(0.04, 900, 0.01), thud(180, 0.04) * 0.5), ts + 0.9 + 0.22 * r + 0.05, -29)
        S(tinkle(1.2, int(ts)), ts + 1.9, -34)
    pent = [587.33, 784, 880, 1174.7, 880, 784, 587.33, 440]
    for i in range(8): S(ping(pent[i], 0.9, 0.12), 52.0 + i, -31)
    for t in (54.0, 56.0, 58.0): S(click(0.03, 1400, 0.006), t, -34)
    S(ping(1568, 0.5, 0.05), 60.5, -30)                                             # the coin leaves his hand
    S(whistle_fall(8.6, 1900, 300), 61.4, -29)
    S(ping(880, 1.0, 0.25), 71.4, -29)
    for t in (72.1, 73.3, 74.4): S(click(0.015, 1800, 0.003), t, -35)
    S(cl(1), 74.7, -37); S(tension(1.2), 75.4, -34); S(boing(), 76.6, -31); S(ping(1174.7, 1.2, 0.3), 76.95, -27); S(swipe(), 78.2, -31)
    # ---- the shadow
    S(cl(2), 80.6, -41); [S(paper_tap(), t, -39) for t in (82.2, 82.6, 83.0)]; S(breath(1.2), 85.4, -44)
    S(thud(110, 0.05), 87.7, -31); S(ping(880, 0.8, 0.15), 90.1, -28); S(cl(0), 90.5, -35); S(cl(1), 88.4, -41); S(cl(2), 91.6, -41)
    # ---- low point
    al = alarm_beeps()
    for k in range(3): S(al, 96.2 + k * 1.75, -24)
    S(sine(440, int(1.2 * SR)) * np.sin(np.pi * T(int(1.2 * SR)) / 1.2) ** 2, 105.4, -36)
    S(battery_tone(), 112.3, -31); S(powerdown(), 114.2, -29)
    # ---- real silence 115-118.5 (nothing placed); then
    S(breath(1.4), 126.0, -44); S(breath(1.8), 127.4, -45)
    # ---- the turn
    S(cl(0), 130.2, -36)
    bf = sfx_file("walking_barefoot_wood_floor", 740294); steps = slices_by_onset(bf, 0.3, 0.3, 0.3) if bf is not None else []
    stepc = lambda i: steps[i % len(steps)] if len(steps) else thud(100, 0.06)
    for k, t in enumerate(step_times(900, 2058, 1.7, 9.1, 130.0, 84.0)): S(stepc(k), t, -31)
    for t in np.arange(131.5, 139.0, 0.9): S(band(0.35, 500, 3000) * np.sin(np.pi * np.linspace(0, 1, int(0.35 * SR))), t, -40)   # cable drag, intermittent
    pl = sfx_file("cable_plug_in", 477621); S(pl if pl is not None else click(0.04), 139.2, -29)
    S(thud(120, 0.05), 141.0, -32)
    coin = sfx_file("coin_drop_clink", 699521)
    S(addpad(bell(1174.7, 4.5) * 0.9, peak_norm(coin) * 0.5 if coin is not None else np.zeros(1)), 142.0, -23)       # the loudest cue in the film: the coin lands
    S(wood_slide(3.0), 142.2, -31); [S(creak(0.3), t, -34) for t in (142.6, 143.4, 144.2)]
    S(paper_tap(), 144.5, -35); S(paper_tap(), 145.6, -33)
    # ---- colour
    for t in step_times(2090, 1850, 0.0, 2.6, 148.0, 84.0): S(thud(100, 0.05), t, -33)
    bl = sfx_file("window_blinds", 532775)
    S(bl if bl is not None else band(1.2, 800, 5000), 151.5, -30); S(cl(0), 151.4, -40)
    for t in step_times(700, 1760, 3.2, 6.4, 148.0, 84.0): S(paper_tap(), t, -41)
    for t in step_times(1850, 1640, 0.0, 1.3, 156.0, 84.0): S(thud(100, 0.05), t, -34)
    S(shimmer(3.5), 164.6, -32)
    if pen_slices:
        for t0, t1 in ((159.0, 164.0), (164.0, 170.0)):
            t = t0; i = 0
            while t < t1 - 1.0: sl = pen_slices[i % len(pen_slices)]; S(sl, t, -31); t += len(sl) / SR + 0.35; i += 1
        for t0, t1 in ((188.0, 191.5), (191.5, 195.5)):
            t = t0; i = 1
            while t < t1 - 0.8: sl = pen_slices[i % len(pen_slices)]; S(sl, t, -32); t += len(sl) / SR + 0.3; i += 1
    # ---- the replay: a floor now
    S(sw if sw is not None else click(0.03), 172.0, -33); S(cl(2), 174.4, -38)
    for t in (176.8, 178.2, 179.6): S(swipe(), t, -34)
    for t, f in ((176.9, 880), (178.3, 784), (179.7, 587.33)): S(ping(f, 0.5, 0.08), t, -35)
    S(bell(1174.7, 5.0), 182.0, -33); S((peak_norm(coin) if coin is not None else click(0.05)) * 0.7, 182.15, -35)
    S(cl(1), 183.2, -37); [S(thud(100, 0.05), t, -35) for t in step_times(760, 920, 0.7, 2.0, 183.0, 84.0)]
    S(thud(120, 0.05), 186.6, -34); S(click(0.02, 2000), 186.65, -33)
    S(cl(0), 195.6, -42); S(sw if sw is not None else click(0.03), 199.0, -31); S(cl(1), 202.0, -40); S(breath(1.6), 203.0, -46)
    # ---- coda: his steps, the stranger's shadow tapping its wrist
    for k in range(1, 27): S(thud(95, 0.05) * 0.8, 205.0 + 10 * k * 84 / 2240, -41)
    [S(paper_tap(), t, -45) for t in (209.6, 210.0, 210.4)]


LIFT = float(os.environ.get('LIFT_DB', '2.5'))           # raises every section equally; the contrast between sections is unchanged
# short-term loudness targets (LUFS) per section; the quiet sections stay quiet on purpose
SECTIONS = [("hook", 0, 20, -22), ("setup", 20, 45, -24), ("pull", 45, 80, -16), ("shadow", 80, 95, -22), ("low", 95, 115, -28), ("silence", 115, 123, None),
            ("turn", 123, 148, -22), ("colour", 148, 170, -20), ("payoff", 170, 205, -20), ("coda", 205, 215, -26), ("cards", 215, 232, -30)]
def short_term(mix):
    tmp = "/tmp/_scroll_meas.wav"; pcm = (np.clip(mix, -1, 1).T * 32767).astype(np.int16)
    with wave.open(tmp, "wb") as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    r = subprocess.run(["ffmpeg", "-nostats", "-i", tmp, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    return [(float(m.group(1)), float(m.group(2))) for m in re.finditer(r"t:\s*([\d.]+)\s.*?S:\s*(-?[\d.]+)", r)]
def ride(mix, passes=2):
    for _ in range(passes):
        st = short_term(mix); off = []
        for n, a, b, tgt in SECTIONS:
            v = sorted(x for t, x in st if a + 1.5 <= t < b - 1.0 and x > -70)
            off.append(0.0 if (tgt is None or not v) else float(np.clip(tgt + LIFT - v[int(len(v) * 0.75)], -20, 24)))
        g = np.zeros(NS)
        for (n, a, b, tgt), o in zip(SECTIONS, off): g[int(a * SR):int(b * SR)] = o
        g[int(SECTIONS[-1][2] * SR):] = off[-1]
        k = int(1.6 * SR); g = np.convolve(g, np.ones(k) / k, mode="same")                    # 1.6 s smoothing at section boundaries
        mix = mix * (10 ** (g / 20.0))[None, :]
        print("ride offsets (dB):", {n: round(o, 1) for (n, *_), o in zip(SECTIONS, off)})
    return mix
def limit(mix, ceiling_db=-2.0):
    lim = db(ceiling_db); pk = np.max(np.abs(mix), axis=0); need = np.minimum(1.0, lim / (pk + 1e-12))
    w = int(0.004 * SR); mn = need.copy()
    for i in np.nonzero(need < 1.0)[0]: lo, hi = max(0, i - w), min(NS, i + w + 1); np.minimum(mn[lo:hi], need[i], out=mn[lo:hi])
    k = int(0.012 * SR); sm = np.convolve(mn, np.hanning(k) / np.hanning(k).sum(), mode="same"); sm = np.minimum(sm, need)
    return mix * sm[None, :]
# ----------------------------------------------------------------------------------------------------------- build + mix
def convolve_fft(x, ir):
    n = len(x) + len(ir) - 1; N_ = 1 << (n - 1).bit_length(); X = np.fft.rfft(x, N_); H = np.fft.rfft(ir, N_); return np.fft.irfft(X * H, N_)[:len(x)]
def reverb_ir(rt60=2.3, predelay=0.018, seed=11):
    n = int(rt60 * 1.1 * SR); t = T(n); r = np.random.default_rng(seed)
    ir = np.stack([np.convolve(r.standard_normal(n), np.ones(7) / 7, mode="same") * 10 ** (-3 * t / rt60) for _ in range(2)])
    pd = int(predelay * SR); ir = np.pad(ir, ((0, 0), (pd, 0))); return ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))

def main(out):
    index_piano()
    for t, m, v, d in score(): put_stereo("piano", piano_note(m, v, d), t, 0)
    swell_reverse(19.9)
    put("piano", drone(24.0, 73.42), 148.0, -52)                                  # the very quiet low drone under the colour section
    build_sfx()
    ir = reverb_ir(2.3); sir = reverb_ir(0.45, 0.004, 5)
    piano = bus["piano"].astype(np.float64); wet = np.stack([convolve_fft(piano[c], ir[c]) for c in (0, 1)]); piano_mix = piano * 0.82 + wet * 0.34
    sfx = bus["sfx"].astype(np.float64); swet = np.stack([convolve_fft(sfx[c], sir[c]) for c in (0, 1)]); sfx_mix = sfx + swet * 0.14
    amb = bus["amb"].astype(np.float64)
    pk = np.max(np.abs(piano_mix)); piano_mix *= db(-16) / pk                                   # piano peaks at -16 dBFS before riding
    mix = piano_mix + sfx_mix + amb
    for c in (0, 1): mix[c] = fft_filter(mix[c], 28, None, 0.3)                               # gentle low cut
    mix = ride(mix)                                                                            # per-section loudness targets (SOUND_DESIGN.md)
    mix = limit(mix, -2.0)
    pcm = (np.clip(mix, -1, 1).T * 32767).astype(np.int16)
    with wave.open(out, "wb") as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print("wrote", out, f"{NS / SR:.1f}s")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "Scroll/out/scroll_mix_v1.wav")
