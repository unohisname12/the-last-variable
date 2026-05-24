# The Last Variable — Live (networked multiplayer + solo) — Design

- **Date:** 2026-05-24
- **Status:** Approved (brainstorm complete), ready for implementation plan
- **Repo:** `~/Code/overclock-math/`
- **Supersedes:** the single-device hot-seat app in `src/main.jsx` becomes one mode among three; the lockstep/networked model is the new main path.

## Problem

The current digital app (`src/main.jsx`) is single-device **hot-seat**: `game.active` cycles 0→1→2→3 and one player acts at a time on one shared screen. In a classroom that means each kid is idle ~75% of the time waiting for a turn — low engagement, low math throughput. Dre wants: everyone playing at once, real pressure, **without** breaking the special-ed learning design (split-info, the struggling kid is required, no shaming the slow solver).

## Goals

1. **Parallel play** — all Breakers and the Glitch act in the same window; no turn-waiting.
2. **Pressure without punishing slow learners** — a shared per-round clock, never fastest-finger-wins.
3. **Differentiation with zero teacher setup** — adaptive, invisible difficulty; no tier labels.
4. **Teacher-light** — launch and walk the room; AI runs the antagonist by default.
5. **Ships as a website** with a backend (Dre already intends to launch online).
6. **Solo practice / funnel mode** — a single player vs the AI Glitch, no server needed.

## Non-goals (YAGNI)

- No user accounts, no login, no stored per-child data. Ever. (Minors + schools → FERPA/COPPA posture: collect nothing.)
- No database. Rooms are in-memory and ephemeral.
- No persistent leaderboards / cross-session progress.
- No big modular map at launch — map sizing is a playtest tuning knob (see below).
- No public-internet hosting hardening in v1 beyond what self-host needs; deploy-to-public is a later step.

## Locked design decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Device model | Networked multi-device (own screen each) + a no-server solo mode |
| Pressure model | **Lockstep shared-clock parallel rounds** (not twitch real-time) |
| Difficulty | **Adaptive, invisible, no labels**; optional teacher override, off by default |
| Slow-solver penalty | **None** — unsolved action just doesn't fire; freezes are positional only |
| Antagonist | **AI Glitch by default**, with an optional "let a kid be the Glitch" switch |
| Privacy | No accounts, no PII, ephemeral in-memory rooms, reconnect-by-code |
| Session length | **Multiple short games per period**, not one long map |
| Solo mode | **Single-Breaker run** vs AI Glitch (doubles as the free TpT "Lite" funnel) |
| Move budget | Keep current **3 (Breaker) / 4 (Glitch)** |
| Round length | **75s default**, teacher-adjustable |
| Practice/offline | Keep an offline mode (solo); existing hot-seat may be retired or kept as local-pass-and-play |

## The three modes

1. **Solo (single-Breaker run)** — *Phase 0, no server.* One human Breaker vs the AI Glitch, runs entirely client-side on the shared rules engine. Clock optional. Simpler objective set (a single Breaker can't satisfy two-Breaker generators — see Objectives). This is the rehearsal tool **and** the free TpT Lite funnel edition.
2. **Live (classroom multiplayer)** — *Phases 1–5.* Teacher opens a room, kids join by code on their own devices, lockstep parallel rounds, AI or kid Glitch.
3. **Offline hot-seat (existing)** — kept as-is for now (local pass-and-play / no-network fallback). Not the focus; do not invest in it.

## Architecture

```
overclock-math/
  src/                     # React/Vite client (existing board + components reused)
    modes/solo/            # client-only single-Breaker game loop
    modes/live/            # networked client: ws connection, room UI, live board
    engine/                # SHARED rules engine (pure, no DOM, no React)
  server/                  # Node + ws authoritative server (Live only)
```

**Shared rules engine (`src/engine/`).** Today the rules live in `src/rules.js` (`initialPlayers`, `drawProblem`, `checkAnswer`, `shortestPathStep`, `shortestPathDistance`) and board data is inline in `main.jsx` (`nodes`, `edges`, `nodeNames`, win logic). Refactor these into a **pure, environment-agnostic engine module** importable by both the browser (solo) and Node (server). No React, no DOM, no `window`. This is the foundation both Solo and Live build on.

Engine surface (target):
- `boardGraph` — `nodes`, `edges`, `nodeNames`, generator/exit metadata (lifted from `main.jsx`).
- `createGame(config)` — initial authoritative state (generalizes `freshGame` + `initialPlayers`).
- `planRound(state, submissions)` — pure reducer: takes a state + all players' submitted intents for the round, returns the next state via the fixed resolution order below.
- `checkAnswer`, `drawProblem` (existing, moved).
- `getWinner(state)` (lifted from `main.jsx`).
- Pathfinding (`shortestPathStep`, `shortestPathDistance`) for the AI Glitch and move validation.

**Authoritative server.** Clients never hold the truth. The server owns game state, the clock, the problem each player is solving, and validates every solve (`checkAnswer` runs server-side). Clients receive only what their player is allowed to see (split-info preserved — a Breaker never receives another Breaker's hidden clue or the Glitch's exact problem). This is why a backend is required: a client-authoritative version could be trivially peeked/cheated by a kid with devtools.

## The lockstep round loop (Live)

The server owns one clock per round. Each round:

1. **Window opens** (default 75s, teacher-adjustable). Server deals each player their problem (at that player's current adaptive difficulty). All Breakers **and** the Glitch act in parallel:
   - drag/select a planned move path within move budget (3 Breaker / 4 Glitch),
   - work their own math problem on their own screen,
   - optionally hit **Ready** to lock early.
2. **Window closes** when the timer hits 0 *or* all players are Ready.
3. **Server resolves, in this fixed order, every round:**
   1. **Moves** — all players snap to their final planned positions simultaneously.
   2. **Solves** — correct solves fire their action: generators come online, powers apply, revives land. Unsolved/incorrect/timed-out → the action simply does not fire (no penalty).
   3. **Glitch freezes by final position** — any Breaker sharing the Glitch's final node is frozen, unless shielded (shield consumes instead). Freeze is positional only; a Breaker who moved off the node **dodges**.
   4. **Upkeep** — cooldowns tick down, barriers decay, round counter advances, `getWinner` checked.
4. Server broadcasts the resolved state + a per-round resolution summary (for the shared log), then opens the next round.

**Why this order matters:** resolving moves before freezes means the slow solver is never punished *for being slow* — only for being *caught by position*. A kid who didn't finish their fraction still moved and may have dodged. Pressure stays collective ("we didn't crack the generator this round"), never personal.

## Player actions per round

- **Move** is free (no solve needed), up to the move budget.
- **One solve attempt** per round: the generator the player ends on, a character power, or a revive. (Matches the current `beginChallenge` kinds: `generator` / `power` / `revive`.)
- Finishing the solve in the window → action fires at resolution. Not finishing → move still counts, action doesn't fire.

## Objectives & win conditions

- **Live (team):** all 3 generators online (`fracGen`, `algGen`, `geoGen`) **+** at least one Breaker on an exit node, before the round track runs out. Generators require **two** Breakers (split-info: two different Breakers must each solve at the generator) — this is the moat that makes every kid required. Glitch wins on clock or all-Breakers-frozen. (Carries the RULES.md balance-patch v2 intent into the digital team game; note the *current* `main.jsx` still does single-solve generators — Live must implement two-Breaker.)
- **Solo (single Breaker):** can't satisfy two-Breaker generators, so solo uses a **single-solve** objective — light all generators solo + reach exit before the clock/round track, a personal math-survival run. Tuned independently from the team game.

## Adaptive difficulty

- Per-player hidden difficulty value (continuous, bounded), starting mid-range, held only in the ephemeral session.
- Clean solve → nudge up a small step. Miss or timeout → ease down a small step. Bounded so it can't yo-yo to extremes.
- Maps to the existing tiered problem pools in `gameData.js` (`problemDecks[skill][tier]`) — the tier index becomes an internal, never-displayed function of the difficulty value, **not** a player-facing label.
- **No labels, no levels shown to anyone.** Since each kid solves on their own screen, nobody sees anyone else's difficulty — the "hide the easy group" moat strengthens.
- **Optional teacher override**, off by default: a roster screen lets the teacher pin a player's difficulty up/down. Out of the box the teacher does nothing.
- Print-and-play PDF keeps its physical tier cards; the two products intentionally differ.

## The Glitch

- **AI (default):** each round the AI picks a target (nearest unfrozen Breaker, or a generator to guard if Breakers are clustered on objectives), solves its own problem to power up, and advances toward the target using the engine pathfinder. Aggression/sight scales to room size (more Breakers → more reach), reusing the existing 5-player "+1 move" lever.
- **Kid (optional switch at room setup):** that kid gets the Glitch hunter screen instead of the AI. Same lockstep submission as everyone else.

## Session structure

- A 50-min period = ~5 min intro + **2–3 full games** (~15 min each at 75s rounds) + debrief, **not** one long map.
- Between games: re-pick characters; adaptive difficulty **persists across games within the same room session** so it keeps climbing, then evaporates with the room.
- Rationale: for a learning tool, **math reps > map size**. A tight board run several times yields more problems solved than a big board walked once.

## Map sizing

- The 12-node board is sized for a tense ~15-min game, not a 50-min slog.
- Risk: with 4 Breakers in parallel, a single game may resolve too fast/easy.
- **This is a playtest tuning knob, not a launch blocker.** Knobs available before touching the map: round length, move budget, generator solve count, AI aggression, round track length. Only enlarge the map (a couple nodes, a second objective) if playtest shows single games dying too quickly. Do **not** pre-bloat.

## Join flow & privacy

- Teacher opens a room → server generates a short room code (e.g. 4 chars) shown on the projector.
- Kids open the site → enter code → pick a character → enter a **display handle only** (not a real name; UI nudges toward handles).
- No accounts, no login, no PII stored. Room state is in-memory.
- **Reconnect-by-code:** a dropped Chromebook rejoins the same room/seat mid-game.
- Room evaporates on game-session end or idle timeout. Nothing about a child persists anywhere.

## Stack & hosting

- **Client:** existing React/Vite app; reuse board/components (`Board`, `PlayerCard`, `ChallengeModal`, `ObjectivePanel`, `Log`, `GuideModal`).
- **Server:** Node + `ws` (raw WebSocket; socket.io only if reconnection/room semantics prove worth the dependency). Serves the built client **and** the websocket from one service.
- **State store:** in-memory map of rooms. No DB.
- **Packaging:** Dockerized single image. Runs on Dre's homelab for his room; same image deploys to Fly/Render later for public/sellable access. (Respects self-hosted-first; public hosting is a later, opt-in step.)

## Phasing (each phase independently playable/testable)

- **Phase 0 — Shared engine + Solo.** Refactor `rules.js` + inline board data into pure `src/engine/`. Build the single-Breaker solo mode client-side on it (AI Glitch, adaptive difficulty, optional clock). No server. Ships as the free Lite funnel. *Validates board, resolution, adaptive, AI before any network code.*
- **Phase 1 — Server + rooms + reconnect.** Node+ws service, room create/join by code, display-handle join, in-memory store, reconnect-by-code, no-PII. Lobby only (no gameplay yet).
- **Phase 2 — Lockstep state machine.** Server-authoritative round clock + `planRound` resolution in fixed order; per-player split-info views; server-side `checkAnswer`.
- **Phase 3 — Real-time React board.** Live client renders authoritative state, parallel planning UI (drag move path + solve), Ready button, round timer, resolution summary log.
- **Phase 4 — Adaptive engine in Live.** Per-player hidden difficulty server-side, persists across games in a room session; optional teacher override roster screen.
- **Phase 5 — AI Glitch in Live + kid-Glitch switch.** AI targeting/pathing each round; setup toggle to hand the Glitch to a kid.

## Testing strategy

- **Engine (pure):** unit tests on `planRound` resolution order (move-dodges-freeze, shield consumption, two-Breaker generator gating, win/loss), `checkAnswer`, adaptive step bounds. No mocks — pure functions.
- **Server:** integration tests on room lifecycle, join/reconnect-by-code, split-info (a Breaker socket never receives another player's hidden data), server-side solve validation rejects client-claimed correctness.
- **Solo:** manual QA in browser per Dre's rule (actually play it); plus engine tests cover the rules.
- **Live:** manual multi-tab playtest (several browser tabs = several kids) before classroom; then real-student playtest.

## Open tuning knobs (decided by playtest, not now)

- Round length (start 75s), move budget (start 3/4), generator solve count (2 in Live), map size, AI aggression, round-track length, adaptive step size/bounds.
