"""Builds the YouTube thumbnail (1280x720) for video 2 from two rendered stills: scorching day (left) vs freezing night (right),
split on a diagonal, with a short headline. Render the stills first:
  node render.mjs --page index_full.html --stills "tB:99.5,tC:150.6"
Run: python3 make_thumbnail.py  -> out/thumbnail.png (+ out/thumbnail_alt.png with the alternative headline)
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1280, 720
FONT = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"


def crop_zoom(path, cx, cy, cw, flip=False):
    im = Image.open(path).convert("RGB")
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    ch = cw * H / W
    return im.crop((int(cx - cw / 2), int(cy - ch / 2), int(cx + cw / 2), int(cy + ch / 2))).resize((W, H), Image.LANCZOS)


def outlined(d, xy, text, font, fill, stroke, sw, anchor="mm"):
    d.text(xy, text, font=font, fill=fill, stroke_width=sw, stroke_fill=stroke, anchor=anchor)


def build(lines, out):
    hot = crop_zoom(os.path.join(HERE, "shots", "tB.png"), 905, 556, 1500)
    cold = crop_zoom(os.path.join(HERE, "shots", "tC.png"), 932, 470, 1500, flip=True)   # mirrored so he faces the centre
    # diagonal split: hot on the left, cold on the right
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).polygon([(0, 0), (700, 0), (580, H), (0, H)], fill=255)
    img = Image.composite(hot, cold, mask)
    d = ImageDraw.Draw(img)
    d.line([(700, 0), (580, H)], fill=(255, 255, 255), width=10)
    # darken the top band so the headline reads on any background
    band = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    for y in range(0, 260):
        bd.line([(0, y), (W, y)], fill=(8, 10, 30, int(150 * (1 - y / 260))))
    img = Image.alpha_composite(img.convert("RGBA"), band)
    d = ImageDraw.Draw(img)
    small, big = lines
    f1 = ImageFont.truetype(FONT, 64)
    f2 = ImageFont.truetype(FONT, 150)
    # drop shadow
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.text((W / 2 + 6, 82), small, font=f1, fill=(0, 0, 0, 200), anchor="mm")
    sd.text((W / 2 + 8, 190), big, font=f2, fill=(0, 0, 0, 200), anchor="mm")
    img = Image.alpha_composite(img, sh.filter(ImageFilter.GaussianBlur(6)))
    d = ImageDraw.Draw(img)
    outlined(d, (W / 2, 76), small, f1, (255, 255, 255), (12, 16, 44), 8)
    outlined(d, (W / 2, 184), big, f2, (255, 210, 58), (12, 16, 44), 12)
    # small labels on each side
    f3 = ImageFont.truetype(FONT, 46)
    outlined(d, (170, 660), "50 HOURS", f3, (255, 150, 60), (12, 16, 44), 7)
    outlined(d, (1110, 660), "50 HOURS", f3, (140, 200, 255), (12, 16, 44), 7)
    img.convert("RGB").save(out, quality=95)
    print("wrote", out)


build(("ONE DAY =", "100 HOURS"), os.path.join(HERE, "out", "thumbnail.png"))
build(("SURVIVE A", "100-HOUR DAY"), os.path.join(HERE, "out", "thumbnail_alt.png"))
