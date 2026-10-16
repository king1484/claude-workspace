#!/usr/bin/env python3
"""Search Freesound for CC0 sounds and list candidates (optionally download previews).

Key comes from the FREESOUND_API_KEY environment variable (never stored in the repo).
Usage: FREESOUND_API_KEY=... python3 Scroll/tools/freesound_search.py "clock tick" [--max-dur 15] [--n 5] [--download DIR]
Only 'Creative Commons 0' results are returned. Previews are lossy MP3s; use them for quiet foley,
or fetch originals with OAuth if higher quality is needed.
"""
import argparse, json, os, sys, time, urllib.error, urllib.parse, urllib.request

API = "https://freesound.org/apiv2/search/text/"

def fetch(req, tries=5):
    """Freesound occasionally answers 403/429/5xx transiently; retry with backoff."""
    for i in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code not in (403, 429, 500, 502, 503) or i == tries - 1:
                raise
            time.sleep(2 ** i)


def search(query, max_dur, n):
    key = os.environ.get("FREESOUND_API_KEY")
    if not key:
        sys.exit("Set FREESOUND_API_KEY")
    params = {
        "query": query,
        "filter": f'license:"Creative Commons 0" duration:[0.2 TO {max_dur}]',
        "sort": "rating_desc",
        "page_size": n,
        "fields": "id,name,duration,license,username,avg_rating,num_ratings,num_downloads,previews,tags,url",
    }
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params),
                                 headers={"Authorization": f"Token {key}", "User-Agent": "scroll-sfx-search/1.0"})
    return json.loads(fetch(req))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("query")
    ap.add_argument("--max-dur", type=float, default=15)
    ap.add_argument("--n", type=int, default=5)
    ap.add_argument("--download")
    a = ap.parse_args()
    d = search(a.query, a.max_dur, a.n)
    print(f"{a.query!r}: {d['count']} CC0 results")
    for s in d["results"]:
        print(f"  {s['id']:>8}  {s['duration']:6.1f}s  rating {s.get('avg_rating', 0):.1f} ({s.get('num_ratings', 0)})  dl {s.get('num_downloads', 0):>6}  {s['name'][:48]:48}  by {s['username']}")
        if a.download:
            os.makedirs(a.download, exist_ok=True)
            url = s["previews"]["preview-hq-mp3"]
            out = os.path.join(a.download, f"{s['id']}.mp3")
            req = urllib.request.Request(url, headers={"User-Agent": "scroll-sfx-search/1.0"})
            with open(out, "wb") as f:
                f.write(fetch(req))
    return 0

if __name__ == "__main__":
    sys.exit(main())
