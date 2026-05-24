# The Last Variable

A digital classroom version of **The Last Variable**, a middle-school math escape game.

Circuit Breakers race to bring three generators online and escape the mainframe while The Glitch hunts them. Character powers, generators, revives, and Glitch surges all require solving math from differentiated decks.

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The digital app builds into `web-dist/` so the printable PDF can stay in `dist/`.

## Source Material

The original print-and-play rules, character roster, differentiation guide, problem decks, PDF builder, and art prompts remain in this repository:

- `RULES.md`
- `characters.md`
- `differentiation-guide.md`
- `problem-decks/`
- `dist/TheLastVariable.pdf`

## Digital Version

The browser game supports:

- 3 or 4 Circuit Breakers plus 1 Glitch
- private tier selection per Breaker
- Tier 3 timed Glitch problems
- generator activation, revives, cooldowns, freezing, barricades, decoys, and escape checks
- built-in answer checking with flexible typed answers
