# THE LAST VARIABLE — Art Style Guide

11 characters (8 Breakers + 3 Glitches), one consistent look. Each needs **full-body card art** + a **head-and-shoulders token crop** from the same drawing.

## ⚠️ License check FIRST (before generating anything)
TpT requires you to (1) hold commercial rights to all art and (2) disclose AI-generated images in the listing. **Confirm your ComfyUI checkpoint/LoRA permits commercial use** before generating 11 cards you may not be able to legally sell. Base SDXL is generally clear; many community checkpoints and most LoRAs are not. Pick the model, verify the license, then generate.

## Locked house style (use in every prompt)
```
flat vector cartoon illustration, bold clean black outlines, cel shading,
neon cyber theme, glowing circuit accents, dark navy-to-black background
with subtle grid, vibrant accent color per character, full body, centered,
friendly stylized proportions, age 12 appeal, sticker-clean edges
```

## Negative prompt (every generation)
```
photorealistic, gore, blood, scary, realistic faces, text, watermark,
signature, extra limbs, blurry, muddy colors, cluttered background
```

## Consistency workflow
- Lock **one seed** for the base style, vary only the subject text per character, OR
- Train/load a single character-style LoRA and reuse it across all 11.
- Keep resolution and aspect ratio identical for all cards (suggest 832×1216 portrait, upscale 2×).
- Render the token icon by cropping head+shoulders from the full-body output — do **not** regenerate, or the face drifts.

## Per-character subject prompts (append to house style)

**Breakers** (accent color in brackets — keep distinct):
1. The Hacker [green] — `teen in a hoodie with glowing green code streaming from their hands, confident smirk`
2. The Medic [cyan] — `teen with a glowing cyan medkit and a steady calm expression, healing aura`
3. The Scout [yellow] — `teen with a visor scanning the area, holographic map floating beside them`
4. The Engineer [orange] — `teen with a wrench and a glowing orange barricade panel, sleeves rolled up`
5. The Runner [magenta] — `teen mid-sprint, motion trails, sneakers glowing magenta`
6. The Decoder [teal] — `teen holding a glowing tablet of shifting symbols, focused, helpful expression`
7. The Guardian [blue] — `teen raising a glowing blue hexagonal firewall shield, protective stance`
8. The Trickster [purple] — `teen grinning, tossing a glowing purple decoy orb, playful`

**The Glitch** (corrupted, menacing but cartoon — NOT scary/gory):
A. The Corruptor [red] — `glitchy humanoid program with red corrupted code fragments, sealing a doorway, looming but cartoonish`
B. The Stalker [crimson] — `sleek shadowy program with glowing crimson tracking eyes, crouched and hunting`
C. The Overclock [hot-pink] — `frenetic program crackling with hot-pink energy, motion-blurred, manic grin`

## Also needed (non-character art)
- Board background: the Mainframe — node-and-line map on a dark grid, 3 generator nodes, 1 exit node, start node.
- Tokens: generator marker, freeze marker, cooldown marker, decoy marker.
- Cover art: the team facing the Glitch, title **THE LAST VARIABLE** in a glitch-style display font.
