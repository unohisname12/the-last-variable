#!/usr/bin/env python3
"""Assemble the print-and-play PDF for The Last Variable from art/img + embedded data."""
import os
from PIL import Image as PILImage, ImageDraw
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Image, Table, TableStyle, PageBreak,
                                NextPageTemplate)

ROOT = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(ROOT, "img")  # set below
IMG = os.path.join(ROOT, "art", "img")
DIST = os.path.join(ROOT, "dist")
os.makedirs(DIST, exist_ok=True)
OUT = os.path.join(DIST, "TheLastVariable.pdf")
PLAY_URL = "https://unohisname12.github.io/the-last-variable/"

NAVY = colors.HexColor("#0b1224")
NEON = colors.HexColor("#19e6c8")
RED = colors.HexColor("#ff4d4d")
INK = colors.HexColor("#11182a")

# ---------- data ----------
BREAKERS = [
    ("hacker", "The Hacker", "Override", "Bring one generator online or open one exit from an adjacent node.", "Algebra", "2 rounds", "“There’s always a backdoor.”"),
    ("medic", "The Medic", "Reboot", "Revive a frozen teammate within 2 nodes (after its 1-round lockout).", "Percentages", "2 rounds", "“Stay with me — you’re not deleted yet.”"),
    ("scout", "The Scout", "Ping", "Reveal 3 hidden tiles and the Glitch’s location this turn.", "Geometry", "1 round", "“I see everything in here.”"),
    ("engineer", "The Engineer", "Barricade", "Jam a door or corridor for 2 rounds. The Glitch can’t pass.", "Fractions", "2 rounds", "“Try getting through THAT.”"),
    ("runner", "The Runner", "Dash", "Move +3 extra nodes this turn (6 total).", "Mixed (quick)", "1 round", "“Catch me.”"),
    ("decoder", "The Decoder", "Translate", "Read one teammate’s split-info clue to the table. Once per game.", "Any deck", "1× game", "“Hand me that — I’ll read it.”"),
    ("guardian", "The Guardian", "Firewall", "Block one freeze against yourself or an adjacent teammate.", "Fractions", "2 rounds", "“Not on my watch.”"),
    ("trickster", "The Trickster", "Decoy", "Drop a fake signal; the Glitch must move toward it next turn.", "Geometry", "2 rounds", "“Look over there. No — over THERE.”"),
]
GLITCHES = [
    ("corruptor", "The Corruptor", "Lockdown", "Seal one exit or freeze one tile for 2 rounds.", "Algebra (T3, timed)", "2 rounds", "“This door is mine now.”"),
    ("stalker", "The Stalker", "Trace", "Reveal the nearest Breaker and move +2 toward them now.", "Geometry (T3, timed)", "1 round", "“I can smell the math on you.”"),
    ("overclock", "The Overclock", "Surge", "Take one extra full turn right now.", "Mixed (T3, timed)", "2 rounds", "“Faster. Faster. FASTER.”"),
]

DECKS = {
    "Fractions": {
        1: ["1/4 + 2/4 = ?", "5/8 − 2/8 = ?", "2/5 + 1/5 = ?", "1/3 × 1/2 = ?", "7/10 − 3/10 = ?", "3/7 + 2/7 = ?"],
        2: ["1/2 + 1/3 = ?", "3/4 − 1/6 = ?", "2/3 × 3/5 = ?", "1/2 ÷ 1/4 = ?", "5/6 − 1/4 = ?", "2/3 + 3/4 = ?"],
        3: ["2 1/2 + 1 3/4 = ?", "3 1/3 − 1 5/6 = ?", "2 2/3 × 1 1/2 = ?", "3 3/4 ÷ 1 1/2 = ?", "4/5 × 2 1/2 = ?", "5 1/6 − 2 3/4 = ?"],
    },
    "Algebra": {
        1: ["x + 7 = 12", "x − 4 = 9", "3x = 21", "x/2 = 6", "x + 15 = 20", "5x = 45"],
        2: ["2x + 3 = 11", "3x − 5 = 16", "x/4 + 2 = 6", "5x + 7 = 32", "4x − 9 = 7", "2x − 8 = −2"],
        3: ["3(x + 2) = 21", "2(x − 4) + 3 = 11", "5x − 3 = 2x + 12", "4(x + 1) = 2x + 14", "6x + 2 = 4x + 18", "3x + 7 = 5x − 9"],
    },
    "Geometry": {
        1: ["Rectangle 8×3: area?", "Rectangle 8×3: perimeter?", "Triangle b10 h4: area?", "Square side 6: area?", "Square side 6: perimeter?", "Triangle b8 h5: area?"],
        2: ["Circle r5: area? (π=3.14)", "Circle r5: circumference?", "Parallelogram b12 h4: area?", "Circle r10: area?", "Circle d14: circumference?", "Trapezoid b6,b10 h4: area?"],
        3: ["Prism 4×3×5: volume?", "Cube side 4: surface area?", "Cylinder r3 h10: volume?", "Tri-prism (b6 h4) len10: volume?", "Prism 5×3×2: surface area?", "Cylinder r5 h4: volume?"],
    },
    "Percentages": {
        1: ["10% of 50", "25% of 80", "50% of 24", "20% of 60", "10% of 200", "75% of 40"],
        2: ["15% of 60", "30% of 90", "12 is what % of 48?", "40% of 75", "12% of 150", "18 is what % of 30?"],
        3: ["$80 item, 25% off: price?", "$50 item, 8% tax: total?", "40→50: % increase?", "$120 item, 15% off: price?", "60→45: % decrease?", "$200 item, 6% tax: total?"],
    },
}
ANSWERS = {
    "Fractions": {1: ["3/4", "3/8", "3/5", "1/6", "2/5", "5/7"], 2: ["5/6", "7/12", "2/5", "2", "7/12", "1 5/12"], 3: ["4 1/4", "1 1/2", "4", "2 1/2", "2", "2 5/12"]},
    "Algebra": {1: ["5", "13", "7", "12", "5", "9"], 2: ["4", "7", "16", "5", "4", "3"], 3: ["5", "8", "5", "5", "8", "8"]},
    "Geometry": {1: ["24", "22", "20", "36", "24", "20"], 2: ["78.5", "31.4", "48", "314", "43.96", "32"], 3: ["60", "96", "282.6", "120", "62", "314"]},
    "Percentages": {1: ["5", "20", "12", "12", "20", "30"], 2: ["9", "27", "25%", "30", "18", "60%"], 3: ["$60", "$54", "25%", "$102", "25%", "$212"]},
}

# ---------- styles ----------
ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Heading1"], textColor=NAVY, fontSize=22, spaceAfter=10)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], textColor=RED, fontSize=14, spaceBefore=10, spaceAfter=4)
BODY = ParagraphStyle("BODY", parent=ss["BodyText"], fontSize=10.5, leading=15)
CARD_NAME = ParagraphStyle("CN", parent=ss["Heading2"], fontSize=15, textColor=NAVY, alignment=TA_CENTER, spaceAfter=0)
CARD_TEAM = ParagraphStyle("CT", fontSize=8, textColor=colors.grey, alignment=TA_CENTER, spaceAfter=4)
CARD_PWR = ParagraphStyle("CP", fontSize=11, textColor=RED, alignment=TA_CENTER, spaceAfter=2, fontName="Helvetica-Bold")
CARD_TXT = ParagraphStyle("CX", fontSize=9, leading=11.5, alignment=TA_CENTER)
CARD_META = ParagraphStyle("CM", fontSize=8.5, textColor=NAVY, alignment=TA_CENTER, fontName="Helvetica-Bold")
CARD_FLAV = ParagraphStyle("CF", fontSize=7.5, textColor=colors.grey, alignment=TA_CENTER, fontName="Helvetica-Oblique")
PCARD = ParagraphStyle("PC", fontSize=13, leading=16, alignment=TA_CENTER, fontName="Helvetica-Bold", textColor=NAVY)
PCARD_HDR = ParagraphStyle("PH", fontSize=8, alignment=TA_CENTER, textColor=RED, fontName="Helvetica-Bold")

# ---------- helpers ----------
def circle_token(src, dst, size=420):
    im = PILImage.open(src).convert("RGBA")
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, 0, (w - s) // 2 + s, s)).resize((size, size))
    mask = PILImage.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size, size), fill=255)
    out = PILImage.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    out.save(dst)

def char_card(rec, accent):
    key, name, power, effect, solve, cd, flav = rec
    img = Image(os.path.join(IMG, f"{key}.png"), width=2.2 * inch, height=2.95 * inch)
    inner = [
        [img],
        [Paragraph(name, CARD_NAME)],
        [Paragraph(power, CARD_PWR)],
        [Paragraph(effect, CARD_TXT)],
        [Paragraph(f"Solve: {solve} &nbsp;|&nbsp; Cooldown: {cd}", CARD_META)],
        [Paragraph(flav, CARD_FLAV)],
    ]
    t = Table(inner, colWidths=[3.05 * inch])
    t.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("BOX", (0, 0), (-1, -1), 2, accent),
        ("LINEBELOW", (0, 0), (0, 0), 1, accent),
        ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#f3f6fc")),
    ]))
    return t

def grid(cards, cols, colw):
    rows = [cards[i:i + cols] for i in range(0, len(cards), cols)]
    for r in rows:
        while len(r) < cols:
            r.append("")
    t = Table(rows, colWidths=[colw] * cols)
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t

def problem_card(skill, tier, prob):
    inner = [[Paragraph(f"{skill.upper()} · TIER {tier}", PCARD_HDR)], [Spacer(1, 14)], [Paragraph(prob, PCARD)], [Spacer(1, 10)]]
    t = Table(inner, colWidths=[2.15 * inch], rowHeights=[0.25*inch, 0.18*inch, 0.7*inch, 0.2*inch])
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 1.2, NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#eef3fb")),
    ]))
    return t

# ---------- page templates ----------
def cover_page(canvas, doc):
    canvas.saveState()
    pw, ph = letter
    # title is baked into the image; canvas is letter-proportional -> full-bleed, no distortion
    canvas.drawImage(os.path.join(IMG, "cover.png"), 0, 0, width=pw, height=ph, preserveAspectRatio=False, mask=None)
    canvas.restoreState()

def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.grey)
    canvas.drawCentredString(letter[0] / 2, 0.35 * inch, f"The Last Variable  —  p. {doc.page}")
    canvas.restoreState()

def build():
    # circular tokens for token sheet
    tokdir = os.path.join(IMG, "tok")
    os.makedirs(tokdir, exist_ok=True)
    for key in ["hacker", "medic", "scout", "runner", "corruptor"]:
        circle_token(os.path.join(IMG, f"{key}.png"), os.path.join(tokdir, f"{key}.png"))

    doc = BaseDocTemplate(OUT, pagesize=letter, leftMargin=0.5*inch, rightMargin=0.5*inch, topMargin=0.55*inch, bottomMargin=0.6*inch)
    port = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="p")
    lpw, lph = landscape(letter)
    land = Frame(0.5*inch, 0.5*inch, lpw - inch, lph - inch, id="l")
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[Frame(0, 0, letter[0], letter[1], id="c")], onPage=cover_page, pagesize=letter),
        PageTemplate(id="portrait", frames=[port], onPage=footer, pagesize=letter),
        PageTemplate(id="landscape", frames=[land], onPage=footer, pagesize=landscape(letter)),
    ])

    S = []
    # cover
    S += [NextPageTemplate("portrait"), Spacer(1, 1), PageBreak()]

    # rules
    S += [Paragraph("How to Play", H1)]
    play = Table([[Paragraph(
        f'<b>▶ PLAY THE FREE DIGITAL VERSION</b> — same game, solved on any device (Chromebook, tablet, phone):<br/>'
        f'<a href="{PLAY_URL}"><b>{PLAY_URL.replace("https://", "")}</b></a>',
        ParagraphStyle("play", parent=BODY, textColor=NAVY, alignment=TA_CENTER, leading=15))]],
        colWidths=[doc.width])
    play.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NEON),
        ("BOX", (0, 0), (-1, -1), 1.2, NAVY),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    S += [play, Spacer(1, 12)]
    S += [Paragraph("The school’s mainframe is collapsing. A rogue program — <b>The Glitch</b> — is deleting everything inside it, one variable at a time. A team of <b>Circuit Breakers</b> is trapped. Bring three generators back online and reach the exit before the Glitch deletes you all — before one of you becomes the last variable.", BODY)]
    S += [Paragraph("Players & Roles", H2),
          Paragraph("4–5 players. One is <b>The Glitch</b> (the hunter, solo). The rest are <b>Circuit Breakers</b> (the team). Deal the Glitch role with the rotation cards — it passes every game, and everyone plays it before anyone repeats.", BODY)]
    S += [Paragraph("Setup (5 min)", H2),
          Paragraph("1. Lay out the board; place 3 generator markers and the exit/start tokens.<br/>2. Deal roles (rotation cards).<br/>3. Each Breaker picks 1 of 8 character cards (no repeats); the Glitch picks 1 of 3.<br/>4. Each player has a <b>difficulty tier (1–3)</b> — you assign it or they choose. The Glitch defaults to Tier 3 (a struggling student may drop to Tier 2).<br/>5. All tokens start on the Start node. Set the turn track to <b>10</b>. (5 players? The Glitch starts with +1 move.)", BODY)]
    S += [Paragraph("Turns", H2),
          Paragraph("<b>Breaker turn:</b> move up to 3 nodes → (optional) activate power → interact (generator / door / teammate).<br/><b>Glitch turn:</b> move up to 4 nodes (<b>+1 per generator already online</b>) → (optional) power. If the Glitch shares a node with a Breaker, that Breaker is <b>frozen</b> — locked for 1 full round, then revivable.", BODY)]
    S += [Paragraph("Powers — the engine", H2),
          Paragraph("To fire any power: draw a problem card of its skill <b>at your tier</b>, solve it, check the key. <b>Correct → power fires. Wrong → turn ends.</b> A Tier-1 and a Tier-3 player fire the same power — they just pull different cards. Most powers have a cooldown. <b>Solve at Tier 3 and that cooldown drops by 1 (min 0)</b> — harder math lets you use your power more often.", BODY)]
    S += [Paragraph("Generators & Winning", H2),
          Paragraph("<b>Each generator needs TWO Breakers</b> — each solves a card from the node's deck at their tier (one holds half the code). No soloing the objectives. <b>Rubber-band:</b> every generator that comes online gives the Glitch +1 move; once all 3 are online, freezes last 2 rounds.<br/><b>Circuit Breakers win</b> when all 3 generators are online AND a Breaker reaches any exit before the turn track runs out.<br/><b>The Glitch wins</b> if the track runs out, or every Breaker is frozen at once. Revive a frozen Breaker (after its 1-round lockout) with The Medic (within 2 nodes), or by moving onto their node and solving a Percentages card at your tier.", BODY)]
    tref = Table([["", "Breakers", "The Glitch"],
                  ["Players", "3–4", "1"],
                  ["Move / turn", "3 nodes", "4 nodes, +1 per generator online"],
                  ["Problem tier", "assigned/choice 1–3; T3 = −1 cooldown", "Tier 3 default (timed), may drop to T2"],
                  ["Generators", "2 Breakers each solve to bring 1 online", "—"],
                  ["Win by", "all 3 generators + reach any exit", "run out clock OR freeze all"]],
                 colWidths=[1.3*inch, 3.1*inch, 2.6*inch])
    tref.setStyle(TableStyle([("BOX",(0,0),(-1,-1),1,NAVY),("INNERGRID",(0,0),(-1,-1),0.5,colors.grey),
                              ("BACKGROUND",(0,0),(-1,0),NAVY),("TEXTCOLOR",(0,0),(-1,0),colors.white),
                              ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("FONTSIZE",(0,0),(-1,-1),9.5),
                              ("VALIGN",(0,0),(-1,-1),"MIDDLE"),("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4)]))
    S += [Spacer(1, 8), tref]

    # board (landscape)
    S += [NextPageTemplate("landscape"), PageBreak()]
    bw = lpw - 1.4*inch
    S += [Paragraph("The Mainframe — Game Board", H1),
          Image(os.path.join(IMG, "board.png"), width=bw, height=bw*0.74),
          Paragraph("Yellow bursts = generator nodes (objectives). Green hexes = exit nodes. Blue platform = start. Dots = path nodes; move along the lines.", CARD_TXT)]

    # character cards (portrait)
    S += [NextPageTemplate("portrait"), PageBreak(), Paragraph("Circuit Breakers — pick 1 of 8", H1)]
    bcards = [char_card(r, NEON) for r in BREAKERS]
    S += [grid(bcards[:4], 2, 3.6*inch), PageBreak(), Paragraph("Circuit Breakers (cont.)", H1), grid(bcards[4:8], 2, 3.6*inch)]
    S += [PageBreak(), Paragraph("The Glitch — pick 1 of 3", H1), grid([char_card(r, RED) for r in GLITCHES], 2, 3.6*inch)]

    # problem cards
    for skill, tiers in DECKS.items():
        cards = [problem_card(skill, t, p) for t in (1, 2, 3) for p in tiers[t]]
        S += [PageBreak(), Paragraph(f"{skill} Deck — cut-apart cards", H1), grid(cards, 3, 2.45*inch)]

    # answer keys
    S += [PageBreak(), Paragraph("Answer Keys", H1)]
    for skill in DECKS:
        S += [Paragraph(skill, H2)]
        for t in (1, 2, 3):
            ans = "  ".join(f"{i+1}) {a}" for i, a in enumerate(ANSWERS[skill][t]))
            S += [Paragraph(f"<b>Tier {t}:</b> {ans}", BODY)]

    # token sheet
    S += [PageBreak(), Paragraph("Token Sheet — cut out & play", H1),
          Paragraph("Sample player tokens (use any character’s head crop) and marker tokens. Print on cardstock.", BODY), Spacer(1, 8)]
    toks = []
    for key in ["hacker", "medic", "scout", "runner", "corruptor"]:
        toks.append(Image(os.path.join(IMG, "tok", f"{key}.png"), width=0.95*inch, height=0.95*inch))
    S += [grid(toks, 5, 1.4*inch)]
    # marker tokens drawn as colored labels
    def marker(label, col):
        t = Table([[Paragraph(f"<b>{label}</b>", ParagraphStyle('m', fontSize=8, alignment=TA_CENTER, textColor=colors.white))]], colWidths=[1.0*inch], rowHeights=[0.55*inch])
        t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),col),("BOX",(0,0),(-1,-1),1,colors.black),("VALIGN",(0,0),(-1,-1),"MIDDLE")]))
        return t
    markers = []
    for lbl, col in [("GENERATOR", colors.HexColor("#e0a800")), ("GENERATOR", colors.HexColor("#e0a800")), ("GENERATOR", colors.HexColor("#e0a800")),
                     ("FREEZE", colors.HexColor("#3aa0ff")), ("FREEZE", colors.HexColor("#3aa0ff")),
                     ("COOLDOWN", colors.HexColor("#6c757d")), ("COOLDOWN", colors.HexColor("#6c757d")),
                     ("DECOY", colors.HexColor("#8a4dff"))]:
        markers.append(marker(lbl, col))
    S += [Spacer(1, 14), grid(markers, 4, 1.6*inch)]

    doc.build(S)
    print("built", OUT, f"({os.path.getsize(OUT)//1024} KB)")

if __name__ == "__main__":
    build()
