# The Last Variable — Live: Phase 0 (Shared Engine + Solo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the game rules into a pure, environment-agnostic engine and build a client-only single-Breaker solo game on top of it (vs an AI Glitch), shipping the free TpT "Lite" funnel and validating every rule before any server code exists.

**Architecture:** Move all rules/board/pathfinding logic out of `src/main.jsx` and `src/rules.js` into a pure `src/engine/` (no React, no DOM, importable by both browser and a future Node server). The engine exposes a single deterministic `resolveRound(state, submissions)` reducer that applies the lockstep resolution order; the solo client drives it with one human Breaker and an engine-driven AI Glitch. Difficulty is adaptive and invisible.

**Tech Stack:** React 19 + Vite 7 (existing), vitest (added this phase), pure ES modules for the engine.

**Spec:** `docs/superpowers/specs/2026-05-24-the-last-variable-live-design.md`

---

## State & Type Contract (used by every task — keep names exact)

**Player object:**
```js
{
  id: string,             // "breaker-hacker", "glitch-corruptor"
  cardId: string,         // "hacker", "corruptor"
  role: "breaker" | "glitch",
  name: string,
  node: string,           // node id, e.g. "start"
  frozen: boolean,
  cooldown: number,       // rounds until power reusable
  used: boolean,          // for once-per-game powers
  shielded: boolean,
  difficulty: number,     // breakers only; adaptive, 0..100, start 50
  moveBudget: number      // 3 breaker, 4 glitch
}
```

**Game state:**
```js
{
  mode: "solo",
  round: number,                 // starts 1
  maxRounds: number,             // 12
  roundSeconds: number,          // 75; 0 means untimed
  generators: { fracGen: boolean, algGen: boolean, geoGen: boolean },
  barriers: Array<{ edge: string, rounds: number }>,  // edge = "a-b" sorted
  decoy: string | null,          // node id
  players: Player[],
  log: string[]                  // newest first, capped 8
}
```

**Submission (one per player, fed to `resolveRound`):**
```js
{
  path: string[],   // ordered node ids the player intends to walk this round (excludes current node)
  solve: null | {
    kind: "generator" | "power" | "revive",
    payload: object,        // e.g. { nodeId } | {} | { targetId }
    correct: boolean        // caller has already judged the math (engine.checkAnswer)
  }
}
```
`submissions` is a plain object keyed by player id: `{ [playerId]: Submission }`.

**Resolution order inside `resolveRound` (fixed, every round):**
1. **Moves** — each player advances along the longest valid prefix of their `path` (adjacent, unblocked, within `moveBudget`).
2. **Solves** — for each player whose `solve.correct === true`: generator online / power applied / revive lands; set cooldown or `used`.
3. **Glitch freeze by position** — any Breaker sharing the Glitch's final node freezes unless `shielded` (shield is consumed instead). Breakers who moved away dodge.
4. **Adaptive update** — each Breaker who submitted a solve: correct → difficulty up a step, incorrect → down a step; no submission → unchanged.
5. **Upkeep** — cooldowns decrement (min 0), `shielded` reset to false, barriers decrement and drop at 0, `decoy` cleared, `round` increments.
6. Winner is computed by `getWinner(state)` (not stored; callers read it).

---

## Task 1: Add vitest test runner

**Files:**
- Modify: `package.json`
- Create: `src/engine/smoke.test.js`

- [ ] **Step 1: Add vitest to devDependencies and a test script**

Modify `package.json` — add to `scripts` and add `devDependencies`:
```json
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "vite build",
    "preview": "vite preview --host 0.0.0.0",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: vitest added, no errors.

- [ ] **Step 3: Write a smoke test**

Create `src/engine/smoke.test.js`:
```js
import { describe, it, expect } from "vitest";

describe("vitest", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run it**

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/engine/smoke.test.js
git commit -m "chore: add vitest test runner"
```

---

## Task 2: Extract the board graph into the engine

**Files:**
- Create: `src/engine/board.js`
- Create: `src/engine/board.test.js`

`src/main.jsx` currently holds `nodes`, `edges`, `nodeNames` inline (lines ~23–71) and `src/rules.js` holds `shortestPathStep` / `shortestPathDistance`. Move them into a pure board module so the engine and (later) the server share one source of truth.

- [ ] **Step 1: Write failing tests**

Create `src/engine/board.test.js`:
```js
import { describe, it, expect } from "vitest";
import { nodes, edges, nodeNames, edgeKey, neighbors, shortestPathStep, shortestPathDistance } from "./board.js";

describe("board graph", () => {
  it("has the 12 named nodes including 3 generators and an exit", () => {
    expect(nodes).toHaveLength(12);
    expect(nodes.filter((n) => n.type === "generator").map((n) => n.id).sort())
      .toEqual(["algGen", "fracGen", "geoGen"]);
    expect(nodes.find((n) => n.type === "exit").id).toBe("exit");
    expect(nodeNames.start).toBe("Start");
  });

  it("edgeKey is order-independent", () => {
    expect(edgeKey("exit", "firewall")).toBe(edgeKey("firewall", "exit"));
    expect(edgeKey("firewall", "exit")).toBe("exit-firewall");
  });

  it("neighbors excludes blocked edges", () => {
    expect(neighbors("start", [])).toEqual(expect.arrayContaining(["cache", "archive"]));
    const blocked = [{ edge: edgeKey("start", "cache"), rounds: 1 }];
    expect(neighbors("start", blocked)).not.toContain("cache");
  });

  it("shortestPathStep returns the first hop toward a target", () => {
    expect(shortestPathStep("start", "cache", edges, [])).toBe("cache");
  });

  it("shortestPathDistance counts hops and respects barriers", () => {
    expect(shortestPathDistance("start", "start", edges, [])).toBe(0);
    const direct = shortestPathDistance("firewall", "exit", edges, []);
    expect(direct).toBe(1);
    const blocked = [{ edge: edgeKey("firewall", "exit"), rounds: 1 }];
    expect(shortestPathDistance("firewall", "exit", edges, blocked)).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test src/engine/board.test.js`
Expected: FAIL — cannot resolve `./board.js`.

- [ ] **Step 3: Implement `src/engine/board.js`**

Port the data verbatim from `main.jsx` and the pathfinders from `rules.js`, adding `edgeKey` and `neighbors`:
```js
export const nodeNames = {
  start: "Start", cache: "Cache", fracGen: "Fraction Generator", bridge: "Data Bridge",
  algGen: "Algebra Generator", firewall: "Firewall", geoGen: "Geometry Generator",
  exit: "Exit Node", archive: "Archive", mirror: "Mirror Port", medbay: "Medbay", trap: "Trap Node"
};

export const nodes = [
  { id: "start", x: 10, y: 50, type: "start" },
  { id: "cache", x: 24, y: 25 },
  { id: "fracGen", x: 38, y: 17, type: "generator", skill: "fractions" },
  { id: "bridge", x: 45, y: 48 },
  { id: "algGen", x: 63, y: 28, type: "generator", skill: "algebra" },
  { id: "firewall", x: 74, y: 52 },
  { id: "geoGen", x: 54, y: 77, type: "generator", skill: "geometry" },
  { id: "exit", x: 90, y: 50, type: "exit" },
  { id: "archive", x: 24, y: 74 },
  { id: "mirror", x: 70, y: 82 },
  { id: "medbay", x: 39, y: 57 },
  { id: "trap", x: 58, y: 8 }
];

export const edges = [
  ["start", "cache"], ["start", "archive"], ["cache", "fracGen"], ["cache", "bridge"],
  ["archive", "medbay"], ["archive", "geoGen"], ["fracGen", "bridge"], ["bridge", "algGen"],
  ["bridge", "medbay"], ["bridge", "geoGen"], ["algGen", "firewall"], ["algGen", "trap"],
  ["firewall", "exit"], ["firewall", "mirror"], ["geoGen", "mirror"], ["mirror", "exit"],
  ["trap", "algGen"]
];

export const generatorIds = nodes.filter((n) => n.type === "generator").map((n) => n.id);

export function edgeKey(a, b) {
  return [a, b].sort().join("-");
}

export function neighbors(nodeId, barriers = []) {
  const blocked = new Set(barriers.map((b) => b.edge));
  const out = [];
  for (const [a, b] of edges) {
    if (blocked.has(edgeKey(a, b))) continue;
    if (a === nodeId) out.push(b);
    else if (b === nodeId) out.push(a);
  }
  return out;
}

export function shortestPathStep(from, to, edgeList = edges, barriers = []) {
  const blocked = new Set(barriers.map((b) => b.edge));
  const queue = [[from]];
  const seen = new Set([from]);
  while (queue.length) {
    const path = queue.shift();
    const here = path[path.length - 1];
    if (here === to) return path[1] || from;
    for (const [a, b] of edgeList) {
      if (blocked.has(edgeKey(a, b))) continue;
      const next = a === here ? b : b === here ? a : "";
      if (next && !seen.has(next)) {
        seen.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return from;
}

export function shortestPathDistance(from, to, edgeList = edges, barriers = []) {
  if (from === to) return 0;
  const blocked = new Set(barriers.map((b) => b.edge));
  const queue = [[from, 0]];
  const seen = new Set([from]);
  while (queue.length) {
    const [here, distance] = queue.shift();
    for (const [a, b] of edgeList) {
      if (blocked.has(edgeKey(a, b))) continue;
      const next = a === here ? b : b === here ? a : "";
      if (!next || seen.has(next)) continue;
      if (next === to) return distance + 1;
      seen.add(next);
      queue.push([next, distance + 1]);
    }
  }
  return Infinity;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test src/engine/board.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/board.js src/engine/board.test.js
git commit -m "feat: extract pure board graph + pathfinding into engine"
```

---

## Task 3: Move problem helpers into the engine

**Files:**
- Create: `src/engine/problems.js`
- Create: `src/engine/problems.test.js`

Keep the deck *data* in `src/gameData.js` (it is large and already correct). Move only the logic — `checkAnswer`, `drawProblem` — out of `rules.js` into the engine, importing decks from `gameData.js`.

- [ ] **Step 1: Write failing tests**

Create `src/engine/problems.test.js`:
```js
import { describe, it, expect } from "vitest";
import { checkAnswer, drawProblem, problemDecks } from "./problems.js";

describe("checkAnswer", () => {
  it("matches exact answers ignoring spaces, $, and x=", () => {
    expect(checkAnswer("x = 5", ["x = 5", "5"])).toBe(true);
    expect(checkAnswer("5", ["x = 5", "5"])).toBe(true);
    expect(checkAnswer("$60", ["$60", "60"])).toBe(true);
  });

  it("accepts numerically close percentages", () => {
    expect(checkAnswer("25%", ["25"])).toBe(true);
  });

  it("rejects wrong answers", () => {
    expect(checkAnswer("7", ["x = 5", "5"])).toBe(false);
  });
});

describe("drawProblem", () => {
  it("returns a problem object from a deck", () => {
    const deck = problemDecks.algebra[1];
    const prob = drawProblem(deck);
    expect(deck).toContain(prob);
    expect(prob).toHaveProperty("prompt");
    expect(prob).toHaveProperty("answers");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test src/engine/problems.test.js`
Expected: FAIL — cannot resolve `./problems.js`.

- [ ] **Step 3: Implement `src/engine/problems.js`**

Port `checkAnswer`, `drawProblem`, `normalize`, `closeEnough` from `rules.js`; re-export decks:
```js
import { problemDecks, skillNames } from "../gameData.js";

export { problemDecks, skillNames };

export function drawProblem(deck) {
  return deck[Math.floor(Math.random() * deck.length)];
}

export function checkAnswer(input, answers) {
  const typed = normalize(input);
  return answers.some((answer) => normalize(answer) === typed || closeEnough(typed, normalize(answer)));
}

function normalize(value) {
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\$/g, "")
    .replace(/x\s*=/g, "")
    .replace(/−/g, "-")
    .trim();
}

function closeEnough(a, b) {
  const left = Number(a.replace("%", ""));
  const right = Number(b.replace("%", ""));
  if (Number.isNaN(left) || Number.isNaN(right)) return false;
  return Math.abs(left - right) <= 0.01;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test src/engine/problems.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/problems.js src/engine/problems.test.js
git commit -m "feat: move problem helpers into engine"
```

---

## Task 4: Adaptive difficulty module

**Files:**
- Create: `src/engine/adaptive.js`
- Create: `src/engine/adaptive.test.js`

Difficulty is a numeric 0..100 (start 50). It maps to the existing deck tiers 1/2/3 internally and is never shown to a player.

- [ ] **Step 1: Write failing tests**

Create `src/engine/adaptive.test.js`:
```js
import { describe, it, expect } from "vitest";
import { START_DIFFICULTY, STEP, nextDifficulty, tierForDifficulty } from "./adaptive.js";

describe("adaptive difficulty", () => {
  it("starts mid-range", () => {
    expect(START_DIFFICULTY).toBe(50);
  });

  it("rises on correct, falls on incorrect, by one step", () => {
    expect(nextDifficulty(50, true)).toBe(50 + STEP);
    expect(nextDifficulty(50, false)).toBe(50 - STEP);
  });

  it("clamps to 0..100", () => {
    expect(nextDifficulty(100, true)).toBe(100);
    expect(nextDifficulty(0, false)).toBe(0);
  });

  it("maps difficulty bands to tiers 1/2/3", () => {
    expect(tierForDifficulty(10)).toBe(1);
    expect(tierForDifficulty(50)).toBe(2);
    expect(tierForDifficulty(90)).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test src/engine/adaptive.test.js`
Expected: FAIL — cannot resolve `./adaptive.js`.

- [ ] **Step 3: Implement `src/engine/adaptive.js`**

```js
export const START_DIFFICULTY = 50;
export const STEP = 12;

export function nextDifficulty(current, correct) {
  const delta = correct ? STEP : -STEP;
  return Math.max(0, Math.min(100, current + delta));
}

export function tierForDifficulty(value) {
  if (value < 34) return 1;
  if (value < 67) return 2;
  return 3;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test src/engine/adaptive.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/adaptive.js src/engine/adaptive.test.js
git commit -m "feat: adaptive difficulty module"
```

---

## Task 5: `createGame` + `getWinner`

**Files:**
- Create: `src/engine/game.js`
- Create: `src/engine/game.test.js`

Generalizes `freshGame`/`initialPlayers` from `main.jsx`/`rules.js`. Solo config: one breaker + the AI glitch.

- [ ] **Step 1: Write failing tests**

Create `src/engine/game.test.js`:
```js
import { describe, it, expect } from "vitest";
import { createGame, getWinner } from "./game.js";
import { START_DIFFICULTY } from "./adaptive.js";

const soloConfig = { mode: "solo", breakerIds: ["hacker"], glitchId: "corruptor", roundSeconds: 0 };

describe("createGame", () => {
  it("builds one breaker + one glitch at start with budgets and difficulty", () => {
    const g = createGame(soloConfig);
    expect(g.round).toBe(1);
    expect(g.players).toHaveLength(2);
    const breaker = g.players.find((p) => p.role === "breaker");
    const glitch = g.players.find((p) => p.role === "glitch");
    expect(breaker.node).toBe("start");
    expect(breaker.moveBudget).toBe(3);
    expect(breaker.difficulty).toBe(START_DIFFICULTY);
    expect(glitch.moveBudget).toBe(4);
    expect(g.generators).toEqual({ fracGen: false, algGen: false, geoGen: false });
  });
});

describe("getWinner", () => {
  it("returns empty while the game is live", () => {
    expect(getWinner(createGame(soloConfig))).toBe("");
  });

  it("breakers win when all generators online and a breaker reaches exit", () => {
    const g = createGame(soloConfig);
    g.generators = { fracGen: true, algGen: true, geoGen: true };
    g.players.find((p) => p.role === "breaker").node = "exit";
    expect(getWinner(g)).toBe("Circuit Breakers win");
  });

  it("glitch wins when all breakers frozen", () => {
    const g = createGame(soloConfig);
    g.players.find((p) => p.role === "breaker").frozen = true;
    expect(getWinner(g)).toBe("The Glitch wins");
  });

  it("glitch wins when the round track is exhausted", () => {
    const g = createGame(soloConfig);
    g.round = g.maxRounds + 1;
    expect(getWinner(g)).toBe("The Glitch wins");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test src/engine/game.test.js`
Expected: FAIL — cannot resolve `./game.js`.

- [ ] **Step 3: Implement `createGame` + `getWinner` in `src/engine/game.js`**

```js
import { breakers, glitches } from "../gameData.js";
import { START_DIFFICULTY } from "./adaptive.js";

const MAX_ROUNDS = 12;

export function createGame(config) {
  const breakerPlayers = config.breakerIds.map((id) => {
    const card = breakers.find((c) => c.id === id);
    return {
      id: `breaker-${id}`, cardId: id, role: "breaker", name: card.name,
      node: "start", frozen: false, cooldown: 0, used: false, shielded: false,
      difficulty: START_DIFFICULTY, moveBudget: 3
    };
  });
  const glitchCard = glitches.find((c) => c.id === config.glitchId);
  const glitch = {
    id: `glitch-${config.glitchId}`, cardId: config.glitchId, role: "glitch", name: glitchCard.name,
    node: "start", frozen: false, cooldown: 0, used: false, shielded: false,
    difficulty: 100, moveBudget: 4
  };
  return {
    mode: config.mode || "solo",
    round: 1,
    maxRounds: MAX_ROUNDS,
    roundSeconds: config.roundSeconds ?? 75,
    generators: { fracGen: false, algGen: false, geoGen: false },
    barriers: [],
    decoy: null,
    players: [...breakerPlayers, glitch],
    log: ["The mainframe is collapsing."]
  };
}

export function getWinner(state) {
  const breakersList = state.players.filter((p) => p.role === "breaker");
  const allGenerators = Object.values(state.generators).every(Boolean);
  const escaped = breakersList.some((p) => p.node === "exit");
  const allFrozen = breakersList.length > 0 && breakersList.every((p) => p.frozen);
  if (allGenerators && escaped) return "Circuit Breakers win";
  if (allFrozen) return "The Glitch wins";
  if (state.round > state.maxRounds) return "The Glitch wins";
  return "";
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test src/engine/game.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/game.js src/engine/game.test.js
git commit -m "feat: createGame and getWinner in engine"
```

---

## Task 6: `resolveRound` — movement + upkeep

**Files:**
- Modify: `src/engine/game.js`
- Create: `src/engine/resolve.test.js`

Add `resolveRound(state, submissions)` handling only movement and upkeep first (solves/freeze come in Tasks 7–8). A player advances along the longest valid prefix of their `path`: each hop must be a barrier-free neighbor of the previous node, and total hops ≤ `moveBudget`.

- [ ] **Step 1: Write failing tests**

Create `src/engine/resolve.test.js`:
```js
import { describe, it, expect } from "vitest";
import { createGame, resolveRound } from "./game.js";

const soloConfig = { mode: "solo", breakerIds: ["hacker"], glitchId: "corruptor", roundSeconds: 0 };
const breakerId = "breaker-hacker";
const glitchId = "glitch-corruptor";

function noMove() {
  return { path: [], solve: null };
}

describe("resolveRound — movement", () => {
  it("moves a player along a valid path within budget", () => {
    const g = createGame(soloConfig);
    const next = resolveRound(g, {
      [breakerId]: { path: ["cache", "bridge"], solve: null },
      [glitchId]: noMove()
    });
    expect(next.players.find((p) => p.id === breakerId).node).toBe("bridge");
  });

  it("truncates a path that exceeds move budget", () => {
    const g = createGame(soloConfig);
    // budget 3; give 4 hops, expect to stop at the 3rd
    const next = resolveRound(g, {
      [breakerId]: { path: ["cache", "bridge", "algGen", "firewall"], solve: null },
      [glitchId]: noMove()
    });
    expect(next.players.find((p) => p.id === breakerId).node).toBe("algGen");
  });

  it("stops at the last valid hop when a step is not adjacent", () => {
    const g = createGame(soloConfig);
    const next = resolveRound(g, {
      [breakerId]: { path: ["cache", "exit"], solve: null }, // exit not adjacent to cache
      [glitchId]: noMove()
    });
    expect(next.players.find((p) => p.id === breakerId).node).toBe("cache");
  });

  it("increments the round on upkeep", () => {
    const g = createGame(soloConfig);
    const next = resolveRound(g, { [breakerId]: noMove(), [glitchId]: noMove() });
    expect(next.round).toBe(2);
  });

  it("decrements cooldowns and clears shields on upkeep", () => {
    const g = createGame(soloConfig);
    g.players.find((p) => p.id === breakerId).cooldown = 2;
    g.players.find((p) => p.id === breakerId).shielded = true;
    const next = resolveRound(g, { [breakerId]: noMove(), [glitchId]: noMove() });
    const b = next.players.find((p) => p.id === breakerId);
    expect(b.cooldown).toBe(1);
    expect(b.shielded).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test src/engine/resolve.test.js`
Expected: FAIL — `resolveRound` is not exported.

- [ ] **Step 3: Implement movement + upkeep in `src/engine/game.js`**

Add imports at top of `game.js`:
```js
import { neighbors, edgeKey } from "./board.js";
```
Add functions:
```js
function walk(state, player, path) {
  let node = player.node;
  let used = 0;
  for (const step of path) {
    if (used >= player.moveBudget) break;
    if (!neighbors(node, state.barriers).includes(step)) break;
    node = step;
    used += 1;
  }
  return node;
}

export function resolveRound(state, submissions) {
  // 1. Moves
  let players = state.players.map((p) => {
    const sub = submissions[p.id];
    if (!sub || p.frozen) return p;
    return { ...p, node: walk(state, p, sub.path || []) };
  });

  let next = { ...state, players };

  // (solves + freeze added in later tasks)

  // 5. Upkeep
  next = {
    ...next,
    players: next.players.map((p) => ({
      ...p,
      cooldown: Math.max(0, p.cooldown - 1),
      shielded: false
    })),
    barriers: next.barriers
      .map((b) => ({ ...b, rounds: b.rounds - 1 }))
      .filter((b) => b.rounds > 0),
    decoy: null,
    round: next.round + 1
  };
  return next;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test src/engine/resolve.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/game.js src/engine/resolve.test.js
git commit -m "feat: resolveRound movement and upkeep"
```

---

## Task 7: `resolveRound` — solves (generator, revive, powers)

**Files:**
- Modify: `src/engine/game.js`
- Modify: `src/engine/resolve.test.js`

Apply correct solves between the move step and upkeep. Port the power effects from `applyPower` in `main.jsx` (lines ~200–253) into a pure `applyPower(state, player)` helper. Generators in solo are single-solve (a Breaker standing on the generator node solves → online).

- [ ] **Step 1: Add failing tests to `resolve.test.js`**

Append:
```js
describe("resolveRound — solves", () => {
  it("brings a generator online when a breaker on it solves correctly", () => {
    const g = createGame(soloConfig);
    g.players.find((p) => p.id === breakerId).node = "fracGen";
    const next = resolveRound(g, {
      [breakerId]: { path: [], solve: { kind: "generator", payload: { nodeId: "fracGen" }, correct: true } },
      [glitchId]: { path: [], solve: null }
    });
    expect(next.generators.fracGen).toBe(true);
  });

  it("does not bring a generator online on an incorrect solve", () => {
    const g = createGame(soloConfig);
    g.players.find((p) => p.id === breakerId).node = "fracGen";
    const next = resolveRound(g, {
      [breakerId]: { path: [], solve: { kind: "generator", payload: { nodeId: "fracGen" }, correct: false } },
      [glitchId]: { path: [], solve: null }
    });
    expect(next.generators.fracGen).toBe(false);
  });

  it("hacker power brings one offline generator online and sets cooldown", () => {
    const g = createGame(soloConfig);
    const next = resolveRound(g, {
      [breakerId]: { path: [], solve: { kind: "power", payload: {}, correct: true } },
      [glitchId]: { path: [], solve: null }
    });
    expect(Object.values(next.generators).filter(Boolean)).toHaveLength(1);
    // cooldown was decremented in upkeep from 2 -> 1
    expect(next.players.find((p) => p.id === breakerId).cooldown).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test src/engine/resolve.test.js`
Expected: FAIL — generator stays false / no power applied.

- [ ] **Step 3: Implement solves in `src/engine/game.js`**

`breakers` and `glitches` are already imported (Task 5). Extend the board import line added in Task 6 from `import { neighbors, edgeKey } from "./board.js";` to:
```js
import { nodes, neighbors, edgeKey, shortestPathStep, shortestPathDistance } from "./board.js";
```
(`board.js` does not import `game.js`, so there is no circular dependency.)

Add the card lookup and nearest-breaker helpers:
```js
function cardOf(player) {
  return [...breakers, ...glitches].find((c) => c.id === player.cardId);
}

function nearestBreaker(state, from) {
  return state.players
    .filter((p) => p.role === "breaker" && !p.frozen && p.node !== from)
    .map((p) => ({ p, d: shortestPathDistance(from, p.node, undefined, state.barriers) }))
    .sort((a, b) => a.d - b.d)[0]?.p;
}
```
Power application (ported from `main.jsx applyPower`, generalized to `(state, player)`; returns new state):
```js
function applyPower(state, player) {
  const card = cardOf(player);
  const cooldown = card.cooldown || 0;
  const mark = (s) => ({
    ...s,
    players: s.players.map((p) =>
      p.id === player.id ? { ...p, cooldown: cooldown || p.cooldown, used: card.once ? true : p.used } : p
    )
  });
  switch (player.cardId) {
    case "hacker": {
      const gen = nodes.find((n) => n.type === "generator" && !state.generators[n.id]);
      return mark(gen ? { ...state, generators: { ...state.generators, [gen.id]: true } } : state);
    }
    case "medic": {
      const target = state.players.find((p) => p.role === "breaker" && p.frozen);
      return mark(target
        ? { ...state, players: state.players.map((p) => (p.id === target.id ? { ...p, frozen: false } : p)) }
        : state);
    }
    case "engineer": {
      const n = neighbors(player.node, state.barriers)[0];
      return mark(n ? { ...state, barriers: [...state.barriers, { edge: edgeKey(player.node, n), rounds: 2 }] } : state);
    }
    case "guardian":
      return mark({ ...state, players: state.players.map((p) => (p.id === player.id ? { ...p, shielded: true } : p)) });
    case "trickster":
      return mark({ ...state, decoy: "trap" });
    case "corruptor":
      return mark({ ...state, barriers: [...state.barriers, { edge: edgeKey("firewall", "exit"), rounds: 2 }] });
    case "stalker": {
      const target = nearestBreaker(state, player.node);
      const step = target ? shortestPathStep(player.node, target.node, undefined, state.barriers) : player.node;
      return mark({ ...state, players: state.players.map((p) => (p.id === player.id ? { ...p, node: step } : p)) });
    }
    default:
      // scout (ping), runner (dash), decoder (lifeline), overclock (surge): no engine-state effect in solo
      return mark(state);
  }
}

function applySolve(state, player, solve) {
  if (!solve || !solve.correct) return state;
  if (solve.kind === "generator") {
    const onNode = player.node === solve.payload.nodeId;
    return onNode ? { ...state, generators: { ...state.generators, [solve.payload.nodeId]: true } } : state;
  }
  if (solve.kind === "revive") {
    return { ...state, players: state.players.map((p) => (p.id === solve.payload.targetId ? { ...p, frozen: false } : p)) };
  }
  if (solve.kind === "power") {
    return applyPower(state, player);
  }
  return state;
}
```
Wire it into `resolveRound` after the move step and before upkeep:
```js
  // 2. Solves (in player order)
  for (const p of next.players) {
    const sub = submissions[p.id];
    if (sub && sub.solve) {
      const actor = next.players.find((x) => x.id === p.id);
      next = applySolve(next, actor, sub.solve);
    }
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test src/engine/resolve.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/game.js src/engine/resolve.test.js
git commit -m "feat: resolveRound solves and power effects"
```

---

## Task 8: `resolveRound` — Glitch freeze by position + adaptive update

**Files:**
- Modify: `src/engine/game.js`
- Modify: `src/engine/resolve.test.js`

After solves, freeze any Breaker sharing the Glitch's final node unless shielded (shield consumed instead, no freeze). Then run the adaptive update for Breakers who submitted a solve.

- [ ] **Step 1: Add failing tests to `resolve.test.js`**

Append:
```js
import { START_DIFFICULTY, STEP } from "./adaptive.js";

describe("resolveRound — freeze + adaptive", () => {
  it("freezes a breaker sharing the glitch's final node", () => {
    const g = createGame(soloConfig);
    g.players.find((p) => p.id === breakerId).node = "cache";
    g.players.find((p) => p.id === glitchId).node = "start";
    const next = resolveRound(g, {
      [breakerId]: { path: [], solve: null },
      [glitchId]: { path: ["cache"], solve: null }
    });
    expect(next.players.find((p) => p.id === breakerId).frozen).toBe(true);
  });

  it("a breaker who moves off the node dodges", () => {
    const g = createGame(soloConfig);
    g.players.find((p) => p.id === breakerId).node = "cache";
    g.players.find((p) => p.id === glitchId).node = "start";
    const next = resolveRound(g, {
      [breakerId]: { path: ["bridge"], solve: null }, // cache -> bridge
      [glitchId]: { path: ["cache"], solve: null }
    });
    expect(next.players.find((p) => p.id === breakerId).frozen).toBe(false);
  });

  it("a shield blocks the freeze and is consumed", () => {
    const g = createGame(soloConfig);
    const b = g.players.find((p) => p.id === breakerId);
    b.node = "cache"; b.shielded = true;
    g.players.find((p) => p.id === glitchId).node = "start";
    const next = resolveRound(g, {
      [breakerId]: { path: [], solve: null },
      [glitchId]: { path: ["cache"], solve: null }
    });
    expect(next.players.find((p) => p.id === breakerId).frozen).toBe(false);
  });

  it("raises difficulty on a correct solve, lowers on incorrect", () => {
    const g = createGame(soloConfig);
    g.players.find((p) => p.id === breakerId).node = "fracGen";
    const up = resolveRound(g, {
      [breakerId]: { path: [], solve: { kind: "generator", payload: { nodeId: "fracGen" }, correct: true } },
      [glitchId]: { path: [], solve: null }
    });
    expect(up.players.find((p) => p.id === breakerId).difficulty).toBe(START_DIFFICULTY + STEP);

    const down = resolveRound(g, {
      [breakerId]: { path: [], solve: { kind: "generator", payload: { nodeId: "fracGen" }, correct: false } },
      [glitchId]: { path: [], solve: null }
    });
    expect(down.players.find((p) => p.id === breakerId).difficulty).toBe(START_DIFFICULTY - STEP);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test src/engine/resolve.test.js`
Expected: FAIL — no freeze / shield / difficulty change yet.

- [ ] **Step 3: Implement freeze + adaptive in `resolveRound`**

Add import:
```js
import { nextDifficulty } from "./adaptive.js";
```
Insert after the solves loop, before upkeep:
```js
  // 3. Glitch freeze by final position
  const glitch = next.players.find((p) => p.role === "glitch");
  if (glitch) {
    next = {
      ...next,
      players: next.players.map((p) => {
        if (p.role !== "breaker" || p.frozen) return p;
        if (p.node !== glitch.node) return p;
        if (p.shielded) return { ...p, shielded: false };
        return { ...p, frozen: true };
      })
    };
  }

  // 4. Adaptive difficulty for breakers who attempted a solve
  next = {
    ...next,
    players: next.players.map((p) => {
      if (p.role !== "breaker") return p;
      const sub = submissions[p.id];
      if (!sub || !sub.solve) return p;
      return { ...p, difficulty: nextDifficulty(p.difficulty, sub.solve.correct) };
    })
  };
```
Note: the upkeep step already resets `shielded` to false, so an unused shield does not persist — matching the current `main.jsx` per-round shield behavior.

- [ ] **Step 4: Run to verify pass**

Run: `npm test src/engine/resolve.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/game.js src/engine/resolve.test.js
git commit -m "feat: resolveRound glitch freeze and adaptive update"
```

---

## Task 9: AI Glitch — `chooseGlitchSubmission`

**Files:**
- Create: `src/engine/ai.js`
- Create: `src/engine/ai.test.js`

The AI produces the Glitch's submission each round: a path that steps toward the nearest unfrozen Breaker (up to its move budget), and a power attempt when off cooldown. `rng` is injectable for deterministic tests (`() => 0` always succeeds, `() => 1` always fails the success gate).

- [ ] **Step 1: Write failing tests**

Create `src/engine/ai.test.js`:
```js
import { describe, it, expect } from "vitest";
import { createGame } from "./game.js";
import { chooseGlitchSubmission } from "./ai.js";

const soloConfig = { mode: "solo", breakerIds: ["hacker"], glitchId: "corruptor", roundSeconds: 0 };

describe("chooseGlitchSubmission", () => {
  it("paths toward the nearest unfrozen breaker", () => {
    const g = createGame(soloConfig);
    g.players.find((p) => p.role === "breaker").node = "exit";
    g.players.find((p) => p.role === "glitch").node = "start";
    const sub = chooseGlitchSubmission(g, () => 1);
    expect(sub.path.length).toBeGreaterThan(0);
    expect(sub.path.length).toBeLessThanOrEqual(4); // glitch budget
    // first hop is a real neighbor of start
    expect(["cache", "archive"]).toContain(sub.path[0]);
  });

  it("does not attempt a power when on cooldown", () => {
    const g = createGame(soloConfig);
    g.players.find((p) => p.role === "glitch").cooldown = 2;
    const sub = chooseGlitchSubmission(g, () => 0);
    expect(sub.solve).toBeNull();
  });

  it("attempts a power (correct) when off cooldown and rng passes", () => {
    const g = createGame(soloConfig);
    const sub = chooseGlitchSubmission(g, () => 0);
    expect(sub.solve).toEqual({ kind: "power", payload: {}, correct: true });
  });

  it("returns an empty path when no unfrozen breaker exists", () => {
    const g = createGame(soloConfig);
    g.players.find((p) => p.role === "breaker").frozen = true;
    const sub = chooseGlitchSubmission(g, () => 1);
    expect(sub.path).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test src/engine/ai.test.js`
Expected: FAIL — cannot resolve `./ai.js`.

- [ ] **Step 3: Implement `src/engine/ai.js`**

```js
import { shortestPathStep, shortestPathDistance } from "./board.js";

const AI_POWER_SUCCESS = 0.7; // rng() < this => success

function nearestBreaker(state, from) {
  return state.players
    .filter((p) => p.role === "breaker" && !p.frozen)
    .map((p) => ({ p, d: shortestPathDistance(from, p.node, undefined, state.barriers) }))
    .sort((a, b) => a.d - b.d)[0]?.p;
}

export function chooseGlitchSubmission(state, rng = Math.random) {
  const glitch = state.players.find((p) => p.role === "glitch");
  const target = nearestBreaker(state, glitch.node);

  const path = [];
  if (target) {
    let here = glitch.node;
    for (let i = 0; i < glitch.moveBudget; i += 1) {
      const step = shortestPathStep(here, target.node, undefined, state.barriers);
      if (!step || step === here) break;
      path.push(step);
      here = step;
      if (here === target.node) break;
    }
  }

  const canPower = glitch.cooldown === 0 && !glitch.used;
  const solve = canPower ? { kind: "power", payload: {}, correct: rng() < AI_POWER_SUCCESS } : null;

  return { path, solve };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test src/engine/ai.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/ai.js src/engine/ai.test.js
git commit -m "feat: AI glitch submission chooser"
```

---

## Task 10: Solo client (React) on top of the engine

**Files:**
- Create: `src/modes/solo/SoloGame.jsx`
- Create: `src/modes/solo/useSoloRound.js`
- Modify: `src/main.jsx` (add a mode picker: Solo vs the existing offline hot-seat)
- Modify: `src/styles.css` (round clock + plan bar styles)

This is the only UI task; verification is manual-in-browser per project rule. The solo client: shows the board, lets the human Breaker (a) click reachable nodes to build a `path` (preview, not committed), (b) open one solve via `ChallengeModal`, (c) hit **Resolve Round** (or let the optional clock expire), then calls `resolveRound` with the human submission + `chooseGlitchSubmission` for the AI.

- [ ] **Step 1: Build the round-driver hook `src/modes/solo/useSoloRound.js`**

```js
import { useState, useCallback } from "react";
import { createGame, resolveRound, getWinner } from "../../engine/game.js";
import { chooseGlitchSubmission } from "../../engine/ai.js";
import { checkAnswer, drawProblem, problemDecks } from "../../engine/problems.js";
import { tierForDifficulty } from "../../engine/adaptive.js";

export function useSoloRound(config) {
  const [game, setGame] = useState(() => createGame(config));
  const [plan, setPlan] = useState({ path: [], solve: null }); // human submission-in-progress

  const breaker = game.players.find((p) => p.role === "breaker");
  const winner = getWinner(game);

  const drawForBreaker = useCallback((skill) => {
    const tier = tierForDifficulty(breaker.difficulty);
    return drawProblem(problemDecks[skill][tier]);
  }, [breaker.difficulty]);

  const setPath = useCallback((path) => setPlan((p) => ({ ...p, path })), []);

  const setSolve = useCallback((kind, payload, answer, problem) => {
    setPlan((p) => ({ ...p, solve: { kind, payload, correct: checkAnswer(answer, problem.answers) } }));
  }, []);

  const resolve = useCallback(() => {
    setGame((g) => {
      if (getWinner(g)) return g;
      const glitch = g.players.find((p) => p.role === "glitch");
      const submissions = {
        [breaker.id]: plan,
        [glitch.id]: chooseGlitchSubmission(g)
      };
      return resolveRound(g, submissions);
    });
    setPlan({ path: [], solve: null });
  }, [plan, breaker.id]);

  const restart = useCallback(() => {
    setGame(createGame(config));
    setPlan({ path: [], solve: null });
  }, [config]);

  return { game, plan, winner, breaker, drawForBreaker, setPath, setSolve, resolve, restart };
}
```

- [ ] **Step 2: Build `src/modes/solo/SoloGame.jsx`**

Reuse the presentational pieces already in `main.jsx`. Extract `Board`, `ChallengeModal`, `ObjectivePanel`, `Log`, `PlayerCard`, `GuideModal` into `src/components/` (move, don't rewrite) and import them in both `main.jsx` and `SoloGame.jsx`. Then:
```jsx
import React, { useState } from "react";
import { Play, RotateCcw, ArrowRight, Clock } from "lucide-react";
import { useSoloRound } from "./useSoloRound.js";
import { Board } from "../../components/Board.jsx";
import { ChallengeModal } from "../../components/ChallengeModal.jsx";
import { ObjectivePanel } from "../../components/ObjectivePanel.jsx";
import { Log } from "../../components/Log.jsx";
import { nodes } from "../../engine/board.js";
import { breakers, glitches } from "../../gameData.js";

export function SoloGame({ config, onExit }) {
  const { game, plan, winner, breaker, drawForBreaker, setPath, setSolve, resolve, restart } = useSoloRound(config);
  const [challenge, setChallenge] = useState(null);
  const [answer, setAnswer] = useState("");

  // path planning: clicking a reachable neighbor appends to plan.path (preview)
  // solve: open ChallengeModal for the generator on the breaker's node or a power
  // Resolve Round button => resolve()
  // render Board with `plan.path` highlighted; ObjectivePanel; Log
  // ...wire handlers analogous to the existing main.jsx App, but the board is a *plan preview*,
  //    not an immediate move, and there is no per-player turn cycling.
  return (/* board + controls + ChallengeModal */ null);
}
```
Implement the handlers concretely during execution: clicking a planned node appends it to `plan.path` if it is reachable from the last planned node (use `neighbors` from `engine/board.js`); the **Resolve Round** button calls `resolve()`; the optional clock (if `config.roundSeconds > 0`) counts down and calls `resolve()` at zero.

- [ ] **Step 3: Add a mode picker to `src/main.jsx`**

At the top-level `App`, add a landing choice before the existing setup: **Solo (practice)** → render `<SoloGame config={{ mode: "solo", breakerIds: [pickedBreaker], glitchId: pickedGlitch, roundSeconds: 0 }} />`; **Pass-and-play (offline)** → the existing hot-seat flow unchanged. Solo setup picks exactly **one** Breaker and one Glitch and a clock toggle (Untimed / 75s).

- [ ] **Step 4: Manual QA in the browser**

Run: `npm run dev`
Open `http://localhost:5173/`. Verify:
1. Mode picker appears; choosing Solo shows one-Breaker + one-Glitch setup.
2. Clicking reachable nodes builds a highlighted planned path; clicking an unreachable node is rejected.
3. Standing on a generator and choosing **Bring Generator Online** opens a problem; correct → that generator lights after **Resolve Round**.
4. **Resolve Round** advances the AI Glitch toward you; landing on your node freezes you (unless you moved away).
5. After several solves, problems visibly get harder/easier (difficulty adapting) — confirm by watching the prompts shift tier.
6. Win on 3 generators + reach exit; lose on freeze or round 13.

- [ ] **Step 5: Build check + commit**

```bash
npm run build
```
Expected: `vite build` succeeds.
```bash
git add src/modes src/components src/main.jsx src/styles.css
git commit -m "feat: solo single-Breaker game on the engine"
```

---

## Task 11: Retire dead code paths in `rules.js`

**Files:**
- Modify: `src/rules.js` (or delete if fully superseded)
- Modify: `src/main.jsx` (update imports to engine)

Now that the engine owns rules, the offline hot-seat in `main.jsx` should import from `src/engine/*` instead of `src/rules.js`. Remove the now-duplicated functions from `rules.js`; if nothing imports it, delete it.

- [ ] **Step 1: Repoint `main.jsx` imports**

Replace `import { checkAnswer, drawProblem, initialPlayers, shortestPathDistance, shortestPathStep } from "./rules.js";` with imports from `./engine/problems.js` and `./engine/board.js` (and `createGame` from `./engine/game.js` where `freshGame`/`initialPlayers` was used).

- [ ] **Step 2: Delete dead `rules.js` functions**

Remove any function from `rules.js` now exported by the engine. If the file is empty, `git rm src/rules.js`.

- [ ] **Step 3: Verify nothing broke**

Run: `npm test && npm run build`
Expected: all tests PASS, build succeeds.

- [ ] **Step 4: Manual QA**

Run: `npm run dev` — confirm both Solo and the offline hot-seat still play.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: point main.jsx at engine, drop duplicated rules.js"
```

---

## Phase 0 self-review checklist (run before declaring Phase 0 done)

- [ ] `npm test` — all engine suites green.
- [ ] `npm run build` — succeeds.
- [ ] Solo plays start→win and start→loss in the browser.
- [ ] No labels/tier numbers shown to the player anywhere in Solo UI.
- [ ] Engine modules import nothing from React/DOM (grep `src/engine` for `react`, `window`, `document` → no hits).

---

# Roadmap: Phases 1–5 (each expanded into its own plan when reached)

These are **not** detailed here — their interfaces firm up once Phase 0's engine exists. Each becomes its own `docs/superpowers/plans/` document via the writing-plans skill before implementation.

### Phase 1 — Server + rooms + reconnect
- New `server/` (Node + `ws`), serves built client + websocket from one service.
- In-memory room store keyed by short code; `createRoom`, `joinRoom(code, handle, cardId)`, reconnect-by-code (seat token in client storage).
- No DB, no PII. Lobby only (no gameplay). Tests: room lifecycle, join/reconnect, code collisions.
- Dockerfile (single image).

### Phase 2 — Lockstep state machine (server-authoritative)
- Server wraps the Phase 0 engine: per-round clock, collects `submissions`, calls `resolveRound`.
- **Two-Breaker generators** added here (extends `applySolve`: a generator needs two distinct Breakers to each solve it across rounds — accumulate solver ids, online at two).
- Server-side `checkAnswer` (client never sends `correct`, it sends the typed answer; server judges).
- Per-player split-info views (a Breaker socket never receives another player's problem or hidden data).
- Tests: lockstep resolution parity with engine, server rejects client-claimed correctness.

### Phase 3 — Real-time React board (Live client)
- `src/modes/live/`: ws connection, room join UI, live board rendering authoritative state.
- Parallel planning UI (drag move path + one solve), **Ready** button, round timer, resolution summary in the shared log.
- Reconnect UX. Tests: reducer for incoming server messages; manual multi-tab playtest.

### Phase 4 — Adaptive in Live
- Per-player difficulty held server-side, **persists across games within a room session**, evaporates with the room.
- Optional teacher **override roster** screen (off by default): pin a player up/down.

### Phase 5 — AI Glitch in Live + kid-Glitch switch
- Server runs `chooseGlitchSubmission` each round when no human holds the Glitch.
- Room-setup toggle: hand the Glitch seat to a kid instead of the AI.
- AI aggression scales with Breaker count (reuse the 5-player "+1 move" lever).
