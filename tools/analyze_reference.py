#!/usr/bin/env python3
"""Measure pacing, motion, colour, loudness and speech of a reference video.

Usage: python3 tools/analyze_reference.py VIDEO [--vtt SUBS.vtt] [--out DIR] [--name NAME]

Needs only ffmpeg/ffprobe and the standard library. Writes DIR/NAME.json,
DIR/NAME_sheet_*.jpg (contact sheets) and prints a short summary.
"""
import argparse, json, math, os, re, subprocess, sys

CUT_THRESHOLD = 0.30      # default scene-score spike treated as a hard cut (use --cut-threshold for dark footage)
ANALYSIS_FPS = 5          # frames per second sampled for motion / cut detection
BUCKET = 10               # seconds per timeline bucket


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe(path):
    r = run(["ffprobe", "-v", "error", "-show_entries",
             "format=duration:stream=codec_type,width,height,r_frame_rate", "-of", "json", path])
    d = json.loads(r.stdout)
    v = next(s for s in d["streams"] if s["codec_type"] == "video")
    return {"duration": float(d["format"]["duration"]), "width": v["width"], "height": v["height"],
            "has_audio": any(s["codec_type"] == "audio" for s in d["streams"])}


def motion_and_cuts(path):
    """Per-sample scene score (frame-to-frame change) at ANALYSIS_FPS."""
    vf = f"fps={ANALYSIS_FPS},scale=160:-1,select='gte(scene,0)',metadata=print:file=-"
    r = run(["ffmpeg", "-v", "error", "-i", path, "-an", "-vf", vf, "-f", "null", "-"])
    out, t = [], None
    for line in r.stdout.splitlines():
        m = re.search(r"pts_time:([\d.]+)", line)
        if m:
            t = float(m.group(1))
        m = re.search(r"lavfi.scene_score=([\d.]+)", line)
        if m and t is not None:
            out.append((t, float(m.group(1))))
    return out


def colour_timeline(path, duration):
    """Mean RGB of each second (1x1 downscale)."""
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-an", "-vf", "fps=1,scale=1:1",
                        "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True)
    data = r.stdout
    return [tuple(data[i:i + 3]) for i in range(0, len(data) - 2, 3)]


def loudness(path):
    r = run(["ffmpeg", "-nostats", "-i", path, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"])
    short = []  # (t, short-term LUFS)
    for line in r.stderr.splitlines():
        m = re.search(r"t:\s*([\d.]+)\s.*?S:\s*(-?[\d.]+|-inf)", line)
        if m and m.group(2) != "-inf":
            short.append((float(m.group(1)), float(m.group(2))))
    integ = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    peak = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r.stderr)
    sil = run(["ffmpeg", "-nostats", "-i", path, "-vn", "-af", "silencedetect=n=-45dB:d=0.4", "-f", "null", "-"])
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", sil.stderr)]
    ends = re.findall(r"silence_end: ([\d.]+) \| silence_duration: ([\d.]+)", sil.stderr)
    silences = [(float(e), float(d)) for e, d in ends]
    silences = [(round(e - d, 2), round(d, 2)) for e, d in silences]
    return {"short": short, "integrated": float(integ[-1]) if integ else None,
            "true_peak": float(peak[-1]) if peak else None, "silences": silences}


def parse_vtt(path):
    """Unique spoken lines (no [music]/sfx tags), with the cue start time."""
    if not path or not os.path.exists(path):
        return None
    lines, last, t0 = [], None, 0.0
    for raw in open(path, encoding="utf-8", errors="ignore"):
        raw = raw.rstrip("\n")
        m = re.match(r"(\d+):(\d+):([\d.]+) -->", raw)
        if m:
            t0 = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
            continue
        txt = re.sub(r"<[^>]+>", "", raw).replace("&gt;", ">").replace("&amp;", "&").strip()
        txt = re.sub(r"\[[^\]]*\]", "", txt).replace(">>", "").strip()
        if txt and txt != last and (not lines or txt not in lines[-1][1]):
            lines.append((round(t0, 2), txt))
        if txt:
            last = txt
    # drop lines that are a prefix of the next (YouTube rolls captions)
    cleaned = [l for i, l in enumerate(lines)
               if not (i + 1 < len(lines) and lines[i + 1][1].startswith(l[1]))]
    return cleaned


def sheets(path, duration, out, name, per_sheet=40, step=None):
    step = step or max(2, math.ceil(duration / 120))
    paths = []
    for k, start in enumerate(range(0, int(duration), step * per_sheet)):
        p = os.path.join(out, f"{name}_sheet_{k + 1}.jpg")
        vf = f"fps=1/{step},scale=256:-1,tile=8x5:padding=3:margin=3:color=white"
        run(["ffmpeg", "-v", "error", "-y", "-ss", str(start), "-t", str(step * per_sheet), "-i", path,
             "-an", "-vf", vf, "-frames:v", "1", p])
        if os.path.exists(p):
            paths.append(p)
    return paths, step


def bucketise(samples, duration, fn):
    n = int(math.ceil(duration / BUCKET))
    buckets = [[] for _ in range(n)]
    for t, v in samples:
        i = min(int(t // BUCKET), n - 1)
        buckets[i].append(v)
    return [fn(b) if b else None for b in buckets]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--vtt")
    ap.add_argument("--out", default="analysis")
    ap.add_argument("--name")
    ap.add_argument("--cut-threshold", type=float, default=CUT_THRESHOLD)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    name = a.name or os.path.splitext(os.path.basename(a.video))[0]
    info = probe(a.video)
    dur = info["duration"]

    ms = motion_and_cuts(a.video)
    cuts = [round(t, 2) for t, s in ms if s >= a.cut_threshold]
    # collapse cuts closer than 0.5 s
    merged = []
    for t in cuts:
        if not merged or t - merged[-1] > 0.5:
            merged.append(t)
    edges = [0.0] + merged + [dur]
    shots = [b - a_ for a_, b in zip(edges, edges[1:])]
    motion_b = bucketise([(t, s) for t, s in ms if s < a.cut_threshold], dur,
                         lambda b: round(sum(b) / len(b), 4))
    cuts_b = bucketise([(t, 1) for t in merged], dur, lambda b: len(b))
    cuts_b = [c or 0 for c in cuts_b]

    col = colour_timeline(a.video, dur)
    def sat_lum(c):
        r, g, b = [x / 255 for x in c]
        mx, mn = max(r, g, b), min(r, g, b)
        return (0 if mx == 0 else (mx - mn) / mx, 0.2126 * r + 0.7152 * g + 0.0722 * b)
    sl = [sat_lum(c) for c in col]
    sat_b = bucketise([(i, s[0]) for i, s in enumerate(sl)], dur, lambda b: round(sum(b) / len(b), 3))
    lum_b = bucketise([(i, s[1]) for i, s in enumerate(sl)], dur, lambda b: round(sum(b) / len(b), 3))
    hex_b = bucketise([(i, c) for i, c in enumerate(col)], dur,
                      lambda b: "#%02x%02x%02x" % tuple(round(sum(x[k] for x in b) / len(b)) for k in range(3)))

    audio = loudness(a.video) if info["has_audio"] else None
    lufs_b = bucketise(audio["short"], dur, lambda b: round(sum(b) / len(b), 1)) if audio else None
    speech = parse_vtt(a.vtt)
    sheet_paths, step = sheets(a.video, dur, a.out, name)

    res = {
        "name": name, **info,
        "cuts": len(merged), "cut_times": merged,
        "avg_shot_s": round(sum(shots) / len(shots), 2), "median_shot_s": round(sorted(shots)[len(shots) // 2], 2),
        "longest_shot_s": round(max(shots), 2),
        "cuts_per_10s": cuts_b, "motion_per_10s": motion_b,
        "saturation_per_10s": sat_b, "luminance_per_10s": lum_b, "mean_colour_per_10s": hex_b,
        "loudness": ({"integrated_lufs": audio["integrated"], "true_peak_dbfs": audio["true_peak"],
                      "short_term_per_10s": lufs_b, "silences_s": audio["silences"]} if audio else None),
        "speech_lines": speech, "speech_words": sum(len(t.split()) for _, t in speech) if speech else None,
        "contact_sheets": sheet_paths, "sheet_step_s": step,
    }
    json.dump(res, open(os.path.join(a.out, f"{name}.json"), "w"), indent=1)
    print(json.dumps({k: v for k, v in res.items() if k not in ("cut_times", "speech_lines")}, indent=1))


if __name__ == "__main__":
    sys.exit(main())
