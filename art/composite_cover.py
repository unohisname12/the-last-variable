#!/usr/bin/env python3
"""Build a clean 3-vs-1 cover from the ACTUAL character art (no AI regeneration -> nothing drifts).

Cutouts come from rembg, then get hard-cleaned (threshold + morphological opening + largest-blob)
so there is NO soft halo and NO leftover background fringe -- the old version looked like pasted
stickers because of that halo. Characters are then anchored with ground-contact + drop shadows and a
per-character color glow so they sit in the scene instead of floating.

Run with church-slides venv python (has rembg + scipy + models).
Canvas is letter-proportional (8.5:11) so it fills a PDF page without distortion."""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy import ndimage

IMG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "img")
W, H = 1024, 1325                              # 8.5 : 11
HEROES = ["hacker", "engineer", "guardian"]    # 3 Breakers, distinct colors
VILLAIN = "corruptor"

HERO_GLOW = {
    "hacker":   (40, 220, 120),
    "engineer": (255, 150, 50),
    "guardian": (60, 160, 255),
}

FONT = "/home/dre/.local/share/fonts/JetBrainsMonoNerdFontMono-Bold.ttf"
if not os.path.exists(FONT):
    FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

from rembg import remove, new_session
human = new_session("u2net_human_seg")
obj = new_session("isnet-general-use")


def clean_cut(name, session, opening=2, thresh=180):
    """rembg then kill the soft halo + stray bg blobs -> crisp, professional cutout."""
    src = Image.open(os.path.join(IMG, f"{name}.png")).convert("RGBA")
    rgb = np.asarray(src)[..., :3]
    alpha = np.asarray(remove(src, session=session))[..., 3]
    m = alpha > thresh                                       # drop soft halo pixels
    m = ndimage.binary_opening(m, iterations=opening)        # remove specks + thin bridges
    lbl, n = ndimage.label(m, structure=np.ones((3, 3)))
    if n > 1:                                                # keep only the figure
        sizes = ndimage.sum(np.ones_like(lbl), lbl, range(1, n + 1))
        m = lbl == (int(np.argmax(sizes)) + 1)
    m = ndimage.binary_fill_holes(m)
    a = ndimage.gaussian_filter((m * 255).astype(np.uint8), 0.8)   # 1px feather, no jaggies
    cut = Image.fromarray(np.dstack([rgb, a]), "RGBA")
    return cut.crop(cut.getbbox())


def scale_h(im, h):
    return im.resize((max(1, int(im.width * h / im.height)), h), Image.LANCZOS)


def glow(cx, cy, r, color, blur=130):
    g = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    return g.filter(ImageFilter.GaussianBlur(blur))


def drop_shadow(canvas, cut, pos, dx, dy, blur, alpha):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sil = Image.composite(Image.new("RGBA", cut.size, (3, 4, 8, alpha)),
                          Image.new("RGBA", cut.size, (0, 0, 0, 0)), cut.split()[3])
    layer.alpha_composite(sil, (pos[0] + dx, pos[1] + dy))
    return Image.alpha_composite(canvas, layer.filter(ImageFilter.GaussianBlur(blur)))


def ground_shadow(canvas, cx, cy, w, h, alpha=130, blur=24):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse([cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2],
                                  fill=(0, 0, 0, alpha))
    return Image.alpha_composite(canvas, layer.filter(ImageFilter.GaussianBlur(blur)))


def text_line(layer, text, cy, size, fill, track=8):
    f = ImageFont.truetype(FONT, size)
    d = ImageDraw.Draw(layer)
    widths = [d.textlength(c, font=f) for c in text]
    total = sum(widths) + track * (len(text) - 1)
    x = (W - total) / 2
    for c, w in zip(text, widths):
        d.text((x, cy), c, font=f, fill=fill)
        x += w + track


# ---------- background: vertical gradient ----------
bg = Image.new("RGBA", (W, H))
top, bot = (12, 19, 38), (4, 7, 14)
px = bg.load()
for y in range(H):
    t = y / H
    row = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)) + (255,)
    for x in range(W):
        px[x, y] = row

bg = Image.alpha_composite(bg, glow(W // 2, 560, 340, (200, 30, 30, 120)))            # red behind villain
bg = Image.alpha_composite(bg, glow(W // 2, 1180, 480, (20, 170, 200, 60), blur=170))  # cyan floor

# ---------- villain (behind) ----------
villain = scale_h(clean_cut(VILLAIN, obj, opening=3, thresh=195), 600)
vpos = ((W - villain.width) // 2, 320)
bg = drop_shadow(bg, villain, vpos, 18, 22, 22, 150)
bg.alpha_composite(villain, vpos)

# ---------- 3 heroes, in front, anchored ----------
cuts = [scale_h(clean_cut(n, human), 520) for n in HEROES]
step = int(cuts[0].width * 0.74)
span = cuts[0].width + step * (len(cuts) - 1)
x0 = (W - span) // 2
baseline = H - 105
positions = [(x0 + i * step, baseline - cuts[i].height) for i in range(len(cuts))]

# color back-glow + ground contact shadow for every hero (behind all figures)
for i, name in enumerate(HEROES):
    cx = positions[i][0] + cuts[i].width // 2
    bg = Image.alpha_composite(bg, glow(cx, baseline - cuts[i].height // 2, 150,
                                        HERO_GLOW[name] + (60,), blur=95))
for i in range(len(cuts)):
    cx = positions[i][0] + cuts[i].width // 2
    bg = ground_shadow(bg, cx, baseline - 6, int(cuts[i].width * 0.78), 46)

# draw heroes back-to-front (center in front), each with its own drop shadow
for i in [0, 2, 1]:
    bg = drop_shadow(bg, cuts[i], positions[i], 10, 14, 14, 120)
    bg.alpha_composite(cuts[i], positions[i])

# ---------- vignette ----------
vig = Image.new("L", (W, H), 0)
ImageDraw.Draw(vig).ellipse([-W * 0.25, -H * 0.18, W * 1.25, H * 1.18], fill=255)
vig = vig.filter(ImageFilter.GaussianBlur(180))
dark = Image.new("RGBA", (W, H), (0, 0, 0, 150))
bg = Image.composite(bg, Image.alpha_composite(bg, dark), vig)

# ---------- baked title ----------
title = Image.new("RGBA", (W, H), (0, 0, 0, 0))
text_line(title, "THE LAST", 52, 112, (255, 255, 255, 255), track=10)
text_line(title, "VARIABLE", 160, 112, (255, 255, 255, 255), track=10)
text_line(title, "A MIDDLE-SCHOOL MATH ESCAPE GAME", 286, 24, (38, 224, 200, 255), track=4)
bg = Image.alpha_composite(bg, title.filter(ImageFilter.GaussianBlur(10)))   # halo
bg = Image.alpha_composite(bg, title)

out = os.path.join(IMG, "cover.png")
if os.path.exists(out):
    os.replace(out, os.path.join(IMG, "cover_prev.png"))
bg.convert("RGB").save(out, quality=95)
print("clean 3v1 cover ->", out, f"({os.path.getsize(out) // 1024} KB); prev saved cover_prev.png")
