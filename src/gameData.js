export const skillNames = {
  fractions: "Fractions",
  algebra: "Algebra",
  geometry: "Geometry",
  percentages: "Percentages",
  mixed: "Mixed",
  any: "Any"
};

export const breakers = [
  {
    id: "hacker",
    name: "The Hacker",
    power: "Override",
    effect: "Bring one offline generator online from anywhere in this digital build.",
    skill: "algebra",
    cooldown: 2,
    img: import.meta.env.BASE_URL + "art/img/hacker.png"
  },
  {
    id: "medic",
    name: "The Medic",
    power: "Reboot",
    effect: "Revive one frozen teammate anywhere on the board.",
    skill: "percentages",
    cooldown: 1,
    img: import.meta.env.BASE_URL + "art/img/medic.png"
  },
  {
    id: "scout",
    name: "The Scout",
    power: "Ping",
    effect: "Reveal The Glitch's location in the system log.",
    skill: "geometry",
    cooldown: 1,
    img: import.meta.env.BASE_URL + "art/img/scout.png"
  },
  {
    id: "engineer",
    name: "The Engineer",
    power: "Barricade",
    effect: "Jam the first adjacent corridor for 2 rounds.",
    skill: "fractions",
    cooldown: 2,
    img: import.meta.env.BASE_URL + "art/img/engineer.png"
  },
  {
    id: "runner",
    name: "The Runner",
    power: "Dash",
    effect: "Gain 3 extra movement this turn.",
    skill: "mixed",
    cooldown: 1,
    img: import.meta.env.BASE_URL + "art/img/runner.png"
  },
  {
    id: "decoder",
    name: "The Decoder",
    power: "Translate",
    effect: "Spend your once-per-game table lifeline.",
    skill: "any",
    once: true,
    img: import.meta.env.BASE_URL + "art/img/decoder.png"
  },
  {
    id: "guardian",
    name: "The Guardian",
    power: "Firewall",
    effect: "Shield yourself from the next freeze.",
    skill: "fractions",
    cooldown: 2,
    img: import.meta.env.BASE_URL + "art/img/guardian.png"
  },
  {
    id: "trickster",
    name: "The Trickster",
    power: "Decoy",
    effect: "Drop a decoy signal on the Trap Node.",
    skill: "geometry",
    cooldown: 2,
    img: import.meta.env.BASE_URL + "art/img/trickster.png"
  }
];

export const glitches = [
  {
    id: "corruptor",
    name: "The Corruptor",
    power: "Lockdown",
    effect: "Seal the final exit corridor for 2 rounds.",
    skill: "algebra",
    cooldown: 2,
    img: import.meta.env.BASE_URL + "art/img/corruptor.png"
  },
  {
    id: "stalker",
    name: "The Stalker",
    power: "Trace",
    effect: "Step toward the nearest unfrozen Breaker.",
    skill: "geometry",
    cooldown: 1,
    img: import.meta.env.BASE_URL + "art/img/stalker.png"
  },
  {
    id: "overclock",
    name: "The Overclock",
    power: "Surge",
    effect: "Prepare an extra turn surge.",
    skill: "mixed",
    cooldown: 2,
    img: import.meta.env.BASE_URL + "art/img/overclock.png"
  }
];

export const problemDecks = {
  fractions: {
    1: [
      p("fractions-t1-01", "1/4 + 2/4 = ?", ["3/4"]),
      p("fractions-t1-02", "5/8 - 2/8 = ?", ["3/8"]),
      p("fractions-t1-03", "2/5 + 1/5 = ?", ["3/5"]),
      p("fractions-t1-04", "1/3 x 1/2 = ?", ["1/6"]),
      p("fractions-t1-05", "7/10 - 3/10 = ?", ["4/10", "2/5"]),
      p("fractions-t1-06", "3/7 + 2/7 = ?", ["5/7"])
    ],
    2: [
      p("fractions-t2-01", "1/2 + 1/3 = ?", ["5/6"]),
      p("fractions-t2-02", "3/4 - 1/6 = ?", ["7/12"]),
      p("fractions-t2-03", "2/3 x 3/5 = ?", ["6/15", "2/5"]),
      p("fractions-t2-04", "1/2 / 1/4 = ?", ["2"]),
      p("fractions-t2-05", "5/6 - 1/4 = ?", ["7/12"]),
      p("fractions-t2-06", "2/3 + 3/4 = ?", ["17/12", "1 5/12"])
    ],
    3: [
      p("fractions-t3-01", "2 1/2 + 1 3/4 = ?", ["17/4", "4 1/4"]),
      p("fractions-t3-02", "3 1/3 - 1 5/6 = ?", ["9/6", "3/2", "1 1/2"]),
      p("fractions-t3-03", "2 2/3 x 1 1/2 = ?", ["4"]),
      p("fractions-t3-04", "3 3/4 / 1 1/2 = ?", ["5/2", "2 1/2"]),
      p("fractions-t3-05", "4/5 x 2 1/2 = ?", ["2"]),
      p("fractions-t3-06", "5 1/6 - 2 3/4 = ?", ["29/12", "2 5/12"])
    ]
  },
  algebra: {
    1: [
      p("algebra-t1-01", "x + 7 = 12", ["x = 5", "5"]),
      p("algebra-t1-02", "x - 4 = 9", ["x = 13", "13"]),
      p("algebra-t1-03", "3x = 21", ["x = 7", "7"]),
      p("algebra-t1-04", "x/2 = 6", ["x = 12", "12"]),
      p("algebra-t1-05", "x + 15 = 20", ["x = 5", "5"]),
      p("algebra-t1-06", "5x = 45", ["x = 9", "9"])
    ],
    2: [
      p("algebra-t2-01", "2x + 3 = 11", ["x = 4", "4"]),
      p("algebra-t2-02", "3x - 5 = 16", ["x = 7", "7"]),
      p("algebra-t2-03", "x/4 + 2 = 6", ["x = 16", "16"]),
      p("algebra-t2-04", "5x + 7 = 32", ["x = 5", "5"]),
      p("algebra-t2-05", "4x - 9 = 7", ["x = 4", "4"]),
      p("algebra-t2-06", "2x - 8 = -2", ["x = 3", "3"])
    ],
    3: [
      p("algebra-t3-01", "3(x + 2) = 21", ["x = 5", "5"]),
      p("algebra-t3-02", "2(x - 4) + 3 = 11", ["x = 8", "8"]),
      p("algebra-t3-03", "5x - 3 = 2x + 12", ["x = 5", "5"]),
      p("algebra-t3-04", "4(x + 1) = 2x + 14", ["x = 5", "5"]),
      p("algebra-t3-05", "6x + 2 = 4x + 18", ["x = 8", "8"]),
      p("algebra-t3-06", "3x + 7 = 5x - 9", ["x = 8", "8"])
    ]
  },
  geometry: {
    1: [
      p("geometry-t1-01", "Rectangle, length 8, width 3. Find the area.", ["24"]),
      p("geometry-t1-02", "Rectangle, length 8, width 3. Find the perimeter.", ["22"]),
      p("geometry-t1-03", "Triangle, base 10, height 4. Find the area.", ["20"]),
      p("geometry-t1-04", "Square, side 6. Find the area.", ["36"]),
      p("geometry-t1-05", "Square, side 6. Find the perimeter.", ["24"]),
      p("geometry-t1-06", "Triangle, base 8, height 5. Find the area.", ["20"])
    ],
    2: [
      p("geometry-t2-01", "Circle, radius 5. Find the area.", ["78.5"]),
      p("geometry-t2-02", "Circle, radius 5. Find the circumference.", ["31.4"]),
      p("geometry-t2-03", "Parallelogram, base 12, height 4. Find the area.", ["48"]),
      p("geometry-t2-04", "Circle, radius 10. Find the area.", ["314"]),
      p("geometry-t2-05", "Circle, diameter 14. Find the circumference.", ["43.96"]),
      p("geometry-t2-06", "Trapezoid, bases 6 and 10, height 4. Find the area.", ["32"])
    ],
    3: [
      p("geometry-t3-01", "Rectangular prism, 4 x 3 x 5. Find the volume.", ["60"]),
      p("geometry-t3-02", "Cube, side 4. Find the surface area.", ["96"]),
      p("geometry-t3-03", "Cylinder, radius 3, height 10. Find the volume.", ["282.6"]),
      p("geometry-t3-04", "Triangular prism: triangle base 6, height 4, prism length 10. Find the volume.", ["120"]),
      p("geometry-t3-05", "Rectangular prism, 5 x 3 x 2. Find the surface area.", ["62"]),
      p("geometry-t3-06", "Cylinder, radius 5, height 4. Find the volume.", ["314"])
    ]
  },
  percentages: {
    1: [
      p("percentages-t1-01", "10% of 50", ["5"]),
      p("percentages-t1-02", "25% of 80", ["20"]),
      p("percentages-t1-03", "50% of 24", ["12"]),
      p("percentages-t1-04", "20% of 60", ["12"]),
      p("percentages-t1-05", "10% of 200", ["20"]),
      p("percentages-t1-06", "75% of 40", ["30"])
    ],
    2: [
      p("percentages-t2-01", "15% of 60", ["9"]),
      p("percentages-t2-02", "30% of 90", ["27"]),
      p("percentages-t2-03", "What percent of 48 is 12?", ["25", "25%"]),
      p("percentages-t2-04", "40% of 75", ["30"]),
      p("percentages-t2-05", "12% of 150", ["18"]),
      p("percentages-t2-06", "What percent of 30 is 18?", ["60", "60%"])
    ],
    3: [
      p("percentages-t3-01", "A $80 item is 25% off. What is the sale price?", ["$60", "60"]),
      p("percentages-t3-02", "A $50 item has 8% sales tax. What is the total?", ["$54", "54"]),
      p("percentages-t3-03", "A price rises from 40 to 50. What is the percent increase?", ["25", "25%"]),
      p("percentages-t3-04", "A $120 item is 15% off. What is the sale price?", ["$102", "102"]),
      p("percentages-t3-05", "A price drops from 60 to 45. What is the percent decrease?", ["25", "25%"]),
      p("percentages-t3-06", "A $200 item has 6% sales tax. What is the total?", ["$212", "212"])
    ]
  }
};

function p(id, prompt, answers) {
  return { id, prompt, answers };
}
