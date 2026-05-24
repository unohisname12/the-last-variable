#!/usr/bin/env python3
"""Build cover.png by compositing the ACTUAL character cutouts (rembg) so it matches the cards exactly.
Run with the church-slides venv python (has rembg + cached models)."""
import os
from PIL import Image, ImageDraw, ImageFilter
from rembg import remove, new_session

IMG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "img")
W, H = 1024, 1536
HEROES = ["hacker", "medic", "scout", "engineer", "guardian"]

human = new_session("u2net_human_seg")
obj = new_session("isnet-general-use")

def cut(name, session):
    src = Image.open(os.path.join(IMG, f"{name}.png")).convert("RGBA")
    out = remove(src, session=session)
    return out.crop(out.getbbox())  # tight crop to subject

def scale_to_h(im, h):
    w = int(im.width * h / im.height)
    return im.resize((w, h), Image.LANCZOS)

def scale_to_w(im, w):
    h = int(im.height * w / im.width)
    return im.resize((w, h), Image.LANCZOS)

# ---- background: dark navy + grid + glows ----
bg = Image.new("RGBA", (W, H), (11, 18, 36, 255))
d = ImageDraw.Draw(bg)
for x in range(0, W, 48):
    d.line([(x, 0), (x, H)], fill=(28, 40, 70, 90), width=1)
for y in range(0, H, 48):
    d.line([(0, y), (W, y)], fill=(28, 40, 70, 90), width=1)
# neon circuit accents
for (x0, y0, x1, y1, col) in [(80, 300, 300, 300, (25,230,200,70)), (700,420,940,420,(120,80,255,70)),
                              (120,700,120,1000,(25,230,200,60)), (904,760,904,1040,(255,77,77,60))]:
    d.line([(x0,y0),(x1,y1)], fill=col, width=3)

def glow(cx, cy, r, color):
    g = Image.new("RGBA", (W, H), (0,0,0,0))
    ImageDraw.Draw(g).ellipse([cx-r, cy-r, cx+r, cy+r], fill=color)
    return g.filter(ImageFilter.GaussianBlur(120))

bg = Image.alpha_composite(bg, glow(W//2, 560, 380, (255, 40, 40, 120)))   # red behind villain
bg = Image.alpha_composite(bg, glow(W//2, 1240, 460, (25, 200, 220, 70)))  # cyan under heroes

# ---- villain looming ----
villain = scale_to_w(cut("corruptor", obj), int(W*0.60))
vx = (W - villain.width)//2
vy = 150
bg.alpha_composite(villain, (vx, vy))

# ---- hero lineup across the bottom ----
hero_h = 470
cuts = [scale_to_h(cut(n, human), hero_h) for n in HEROES]
total = sum(c.width for c in cuts)
gap = (W - total) // (len(cuts) + 1)
if gap < -20:  # too wide -> overlap evenly
    gap = (W - total) // (len(cuts) - 1)
x = gap if gap > 0 else 0
baseline = H - 30
for c in cuts:
    bg.alpha_composite(c, (x, baseline - c.height))
    x += c.width + (gap if gap > 0 else gap)

out = os.path.join(IMG, "cover.png")
if os.path.exists(out):
    os.replace(out, os.path.join(IMG, "cover_v2.png"))
bg.convert("RGB").save(out, quality=95)
print("composited cover ->", out, f"({os.path.getsize(out)//1024} KB); prev saved as cover_v2.png")
