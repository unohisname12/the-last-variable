#!/usr/bin/env python3
"""Generate The Last Variable card art via OpenRouter image models.
Idempotent: skips files that already exist. Run with --only NAME to force one.
"""
import os, sys, base64, json, requests, time

KEY = os.environ.get("OPENROUTER_API_KEY")
MODEL = os.environ.get("ART_MODEL", "google/gemini-3-pro-image-preview")
OUT = os.path.join(os.path.dirname(__file__), "img")
os.makedirs(OUT, exist_ok=True)

HOUSE = (
    "Flat vector cartoon illustration, bold clean black outlines, cel shading, "
    "neon cyber theme, glowing circuit accents, dark navy-to-black background with a subtle tech grid, "
    "friendly stylized proportions appealing to age 12, sticker-clean edges, no text, no watermark. "
    "Portrait orientation, vertical 3:4 framing, single character centered, full body. "
)

CHARACTERS = {
    # breakers
    "hacker":    "A teenage hero in a hoodie with glowing GREEN streaming code around their hands, confident smirk. Accent color green.",
    "medic":     "A teenage hero holding a glowing CYAN medkit, calm steady expression, soft healing aura. Accent color cyan.",
    "scout":     "A teenage hero wearing a glowing visor, a holographic map floating beside them, alert. Accent color yellow.",
    "engineer":  "A teenage hero with a wrench and a glowing ORANGE barricade panel, sleeves rolled up, determined. Accent color orange.",
    "runner":    "A teenage hero mid-sprint with motion trails, glowing MAGENTA sneakers, fast and fearless. Accent color magenta.",
    "decoder":   "A teenage hero holding a glowing tablet of shifting symbols, focused and helpful. Accent color teal.",
    "guardian":  "A teenage hero raising a glowing BLUE hexagonal energy shield, protective stance. Accent color blue.",
    "trickster": "A teenage hero grinning, tossing a glowing PURPLE decoy orb, playful and sly. Accent color purple.",
    # glitches (menacing but cartoon, NOT gory/scary)
    "corruptor": "A glitchy humanoid computer program made of RED corrupted code fragments, sealing a glowing doorway, looming but cartoonish villain. Accent color red.",
    "stalker":   "A sleek shadowy humanoid program with glowing CRIMSON tracking eyes, crouched and hunting, cartoon villain. Accent color crimson.",
    "overclock": "A frenetic humanoid program crackling with HOT-PINK energy, motion-blurred, manic grin, cartoon villain. Accent color hot pink.",
}

SCENES = {
    "board": ("A top-down game board map of a glitching computer mainframe: glowing nodes connected by circuit lines on a dark "
              "navy grid, three large highlighted generator nodes, one green EXIT node, one blue START node. Flat vector style, "
              "neon cyber, no text, no characters. Landscape orientation, square-ish, clean negative space for tokens."),
    "cover": ("Cover art: a team of stylized teenage cartoon heroes (the Circuit Breakers) standing together facing a looming "
              "glitchy red villain program, dramatic neon cyber lighting, dark mainframe background. Flat vector cartoon, "
              "bold outlines, space at top for a title. Portrait orientation."),
}

def gen(name, subject, house=True):
    path = os.path.join(OUT, f"{name}.png")
    if os.path.exists(path):
        print(f"skip {name} (exists)"); return path
    prompt = (HOUSE + subject) if house else subject
    body = {"model": MODEL, "messages": [{"role": "user", "content": prompt}],
            "modalities": ["image", "text"]}
    for attempt in range(3):
        r = requests.post("https://openrouter.ai/api/v1/chat/completions",
                          headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
                          data=json.dumps(body), timeout=180)
        if r.status_code != 200:
            print(f"  {name} HTTP {r.status_code}: {r.text[:300]}"); time.sleep(3); continue
        msg = r.json()["choices"][0]["message"]
        imgs = msg.get("images") or []
        if not imgs:
            print(f"  {name} no image in response: {str(msg)[:200]}"); time.sleep(3); continue
        url = imgs[0]["image_url"]["url"]
        b64 = url.split(",", 1)[1]
        with open(path, "wb") as f:
            f.write(base64.b64decode(b64))
        print(f"OK   {name} -> {path} ({os.path.getsize(path)//1024} KB)")
        return path
    print(f"FAIL {name}"); return None

if __name__ == "__main__":
    if not KEY:
        sys.exit("OPENROUTER_API_KEY not set (source ~/aidre/secrets.env)")
    only = None
    if "--only" in sys.argv:
        only = sys.argv[sys.argv.index("--only") + 1]
    targets = {**{k: (v, True) for k, v in CHARACTERS.items()},
               **{k: (v, False) for k, v in SCENES.items()}}
    if only:
        targets = {only: targets[only]}
    for name, (subj, house) in targets.items():
        gen(name, subj, house)
