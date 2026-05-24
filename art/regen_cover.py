#!/usr/bin/env python3
"""Regenerate cover.png so the team matches the actual character art (multi-image reference)."""
import os, io, base64, json, requests
from PIL import Image as PILImage

KEY = os.environ["OPENROUTER_API_KEY"]
MODEL = os.environ.get("ART_MODEL", "google/gemini-3-pro-image-preview")
IMG = os.path.join(os.path.dirname(__file__), "img")

# squad shown on cover (5 breakers) + the villain, in this order
REFS = ["hacker", "medic", "scout", "engineer", "guardian", "corruptor"]

def data_url(name):
    im = PILImage.open(os.path.join(IMG, f"{name}.png")).convert("RGB")
    im.thumbnail((640, 640))  # shrink for token cost; design still legible
    buf = io.BytesIO(); im.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

PROMPT = (
    "Create cover art for a middle-school math board game titled 'The Last Variable'. "
    "Compose the FIVE hero characters from the first five reference images together as a team — the Circuit Breakers — "
    "in a dynamic heroic group pose, standing shoulder to shoulder. Behind/above them, looming and menacing, place the "
    "RED glitch villain from the LAST reference image. "
    "Reproduce each character's exact design, outfit, signature color, and props from the references: "
    "Hacker (green hoodie, streaming code), Medic (cyan medkit), Scout (visor + holo-map), Engineer (orange barricade + wrench), "
    "Guardian (blue hexagon shield), and the villain (red corrupted-code robot). "
    "Flat vector cartoon, bold black outlines, cel shading, neon cyber palette, dark glitching mainframe background, dramatic lighting, "
    "sticker-clean edges, no text. Leave clear empty space across the TOP third for a title. Portrait orientation, vertical."
)

content = [{"type": "text", "text": PROMPT}]
for n in REFS:
    content.append({"type": "image_url", "image_url": {"url": data_url(n)}})

body = {"model": MODEL, "messages": [{"role": "user", "content": content}], "modalities": ["image", "text"]}
r = requests.post("https://openrouter.ai/api/v1/chat/completions",
                  headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
                  data=json.dumps(body), timeout=240)
r.raise_for_status()
msg = r.json()["choices"][0]["message"]
imgs = msg.get("images") or []
if not imgs:
    raise SystemExit(f"no image returned: {str(msg)[:300]}")
b64 = imgs[0]["image_url"]["url"].split(",", 1)[1]
out = os.path.join(IMG, "cover.png")
if os.path.exists(out):
    os.replace(out, os.path.join(IMG, "cover_v1.png"))
with open(out, "wb") as f:
    f.write(base64.b64decode(b64))
print("cover regenerated ->", out, f"({os.path.getsize(out)//1024} KB); old saved as cover_v1.png")
