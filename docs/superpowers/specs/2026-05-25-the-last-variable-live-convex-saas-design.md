# The Last Variable — Live on Convex (classroom SaaS) — Design

- **Date:** 2026-05-25
- **Status:** Brainstorm complete, pending user review → writing-plans
- **Repo:** `~/Code/overclock-math/`
- **Supersedes:** the **Architecture / Stack & hosting / Phasing / Join flow** sections of `2026-05-24-the-last-variable-live-design.md`. That spec's **game design is unchanged and still authoritative** — lockstep parallel rounds, adaptive invisible difficulty, no slow-solver penalty, AI Glitch (+ optional kid-Glitch), 75s rounds, two-Breaker generators, move budget 3/4, the resolution order, the solo "Lite" funnel. This document only changes *how the backend, accounts, classroom flow, and selling work.*

## What changed since the 05-24 spec

The 05-24 spec assumed a **self-hosted Node + `ws`** server for Dre's own room, public hosting "later." Dre has now decided this is a **sellable SaaS product**, Kahoot-style, for any teacher. That flips three things:

1. **Backend → Convex Cloud** (managed, multi-tenant), not self-hosted Node+ws.
2. **A class/team hierarchy + teacher accounts**, not flat anonymous rooms.
3. **Monetization is defined now:** TpT sells the PDF; the PDF carries an access code that unlocks the live site for the teacher.

## Locked decisions (this layer)

| Decision | Choice |
|---|---|
| Backend | **Convex Cloud** — reactive doc DB + server-side mutations + subscriptions + scheduler |
| Tenancy | **Multi-tenant SaaS** — many teachers, many classes concurrently |
| Hierarchy | **Class → Team → Player** (3 levels) |
| Classroom flow | **Kahoot-style:** one class code, kids self-pick into teams, captain locks, teacher dashboard |
| Scale target | **40 kids / class, ~8–10 concurrent teams per class**; many classes across teachers |
| Teacher auth | **Convex Auth — Google sign-in + email magic-link** |
| Kid identity | **No accounts.** Class code + display **handle** + `sessionToken` only. No PII, ever |
| Monetization | **Access code printed in the PDF** unlocks the teacher account's `hasLiveAccess` (soft gate) |
| Privacy | Handles only; teacher is sole account holder; class/team/game docs TTL-cleaned |
| Solo "Lite" | **Unchanged** — client-only, no Convex, no account (the free TpT funnel) |

## Architecture

```
overclock-math/
  src/
    engine/            # SHARED pure rules engine (from P0; no DOM/React/Convex) — reused
    modes/solo/        # client-only single-Breaker game (unchanged, no backend)
    modes/live/        # networked client: Convex hooks, lobby, dashboard, live board
  convex/              # Convex backend (NEW)
    schema.ts          # tables: teachers, accessCodes, classes, teams, players, games
    auth.ts            # Convex Auth (Google + magic-link)
    classes.ts         # open/close class, dashboard query
    teams.ts           # create/join team, pick character, captain lock
    games.ts           # lockstep: startRound / submitIntent / resolveRound (mutations)
    ai.ts              # AI Glitch turn (calls shared engine)
    cleanup.ts         # scheduled TTL deletion of stale classes/teams/games
```

**Why Convex fits.** Mutations execute server-side in Convex's runtime, so `checkAnswer` and the pure `planRound`/`resolveRound` engine run **authoritatively** there — a kid with devtools can't claim a correct solve or an illegal move. Reactive **subscriptions** give realtime board/dashboard updates with no socket code, and auto-resume on reconnect (the `sessionToken` in localStorage re-binds the seat). The **scheduler** owns the per-round clock (a scheduled mutation fires resolution at window close). The shared `src/engine/` (pure TS) is imported directly by Convex functions — one rules implementation, two runtimes.

**Departure from 05-24's "no database."** Convex *is* a document store, so rooms are documents, not in-memory. Privacy is preserved by *what* we store (handles, never names) and a **TTL + scheduled cleanup** (`cleanup.ts`) that deletes finished/idle classes, teams, games, and players. Nothing about a child persists past the session.

## Data model (Convex tables)

- `teachers` — `{ authId, email, name, hasLiveAccess: boolean, createdAt }`. The only accounts.
- `accessCodes` — `{ code, edition, active }`. Codes printed in PDF editions; redeeming sets the teacher's `hasLiveAccess = true`.
- `classes` — `{ teacherId, code (short, projector), status: "lobby"|"live"|"ended", createdAt, lastActiveAt }`.
- `teams` — `{ classId, name, captainPlayerId, locked: boolean, glitchMode: "ai"|"kid" }`.
- `players` — `{ classId, teamId, handle, characterId, role: "breaker"|"glitch", sessionToken, connected, lastSeen }`.
- `games` — `{ teamId, state (authoritative engine state JSON), round, roundEndsAt, status, log[] }`. One per team, the live board truth.

All carry timestamps so `cleanup.ts` can TTL them.

## Teacher flow (the account holder)

1. Sign in (Google or magic-link). First time, **redeem the PDF access code** → `hasLiveAccess = true`.
2. **Start Class** → server mints a short class code; teacher screen shows the code + a **live dashboard**.
3. Dashboard (reactive): every team in the class — members, locked/unlocked, in-game progress (generators online, round x/10, win/lose). Controls: **force-start a team**, **lock stragglers**, **pin a player's difficulty**, **end class**.
4. End class → all class/team/game docs flagged for cleanup.

Without `hasLiveAccess`, a signed-in teacher can preview but cannot **Start Class** (the paid gate). Solo/Lite needs no account at all.

## Kid flow (no account)

1. Open site → enter **class code** → enter a **handle** (UI nudges to a nickname, not a real name).
2. **Join or create a team** within the class → pick an unused **character** → see teammates fill in live.
3. The team **captain** (creator, or teacher-assignable) hits **Lock Team** → that team's `game` is created and its first round opens. Teams start independently as they lock (teacher can also force-start).
4. `sessionToken` persists in localStorage → a dropped Chromebook rejoins the same seat mid-game.

## Access / entitlement model (monetization)

- TpT sells the **PDF** (unchanged product). The PDF prints an **access code** (e.g. `LASTVAR-S1-XXXX`) and the site URL.
- Teacher signs in once and **redeems the code** → `hasLiveAccess`. Persists on the account.
- **Soft gate, by design.** Static PDF ⇒ one shared code per edition ⇒ leakable. This matches TpT digital-resource norms; the PDF + curriculum is the protected value. Mitigation: per-edition code rotation (`accessCodes.edition`), deactivate old editions if abuse appears. Per-buyer codes are not feasible on TpT (no per-sale file injection).
- **Billing (Stripe etc.) is out of scope for v1** — the code-redemption gate is the v1 monetization. The `hasLiveAccess` flag is the seam where a subscription could later attach.

## Lockstep round loop on Convex

Carries the 05-24 resolution order verbatim; only the mechanism changes:

1. `startRound(gameId)` mutation deals each player a problem at their adaptive difficulty, sets `roundEndsAt = now + roundLength`, schedules `resolveRound(gameId)` at that time.
2. Clients subscribe to their game; submit via `submitIntent` mutation (planned move path + one solve attempt). Server validates the move is within budget and `checkAnswer` server-side. "Ready" can close early when all submitted.
3. `resolveRound` (the `planRound` engine): **moves → solves → positional freezes → upkeep**, then `getWinner`, writes new `state` + round summary to `log`, and `startRound` for the next — unless won/lost.
4. **Split-info via per-player queries:** a client's subscription returns only its own view (its problem, its team's public board) — never another player's hidden clue or the Glitch's exact problem.

## Multi-tenant scale

- 40 kids/class × ~10 teams; many teachers/classes at once. Convex Cloud handles this load comfortably; the per-round mutation rate is low (one resolve per team per ~75s, plus submits). Sanity-check Convex plan limits (function calls/bandwidth) during P2 against a simulated full class; upgrade plan if needed (cost scales with paying teachers).
- Isolation: every query/mutation is scoped by `classId`/`teamId`/`sessionToken`; one class never sees another's state.

## Cost & "what if it blows up" guardrails

Convex Cloud is usage-billed (function calls, bandwidth, storage). The realistic ceiling for a TpT *math* resource is hundreds of teachers, not millions of users — Convex handles that cheaply, and usage roughly tracks PDF sales because only code-holders open live classes. There is **one catastrophic-cost path** and it gets hard guardrails:

- **Threat:** the shared access code leaks widely → thousands of freeloaders drive Convex usage with **zero** matching revenue.
- **Guardrails (build into P1):**
  1. **Convex spend cap + budget alerts** — a hard monthly ceiling so a leak can never produce a runaway bill; the worst case is the live site throttling/pausing, not bankruptcy.
  2. **Rate-limit class creation per teacher account** (e.g. N concurrent classes, M/day) — a single leaked account can't spin up unlimited classes.
  3. **Per-edition code rotation + deactivation** — kill a code that's clearly leaked; new PDF editions ship new codes.
  4. **Handle profanity filter** at join (minors product — block slurs/inappropriate handles server-side).
- **Graceful fallbacks (low lock-in):** the free **Solo/Lite** mode is client-only → **$0 backend regardless of scale**, so the free funnel never costs anything. The **pure `src/engine/`** is platform-agnostic; the only Convex-specific code is the schema + mutation/subscription glue, so the backend is migratable if Convex pricing ever turns hostile.
- **If it *really* blows up**, the dominant risks become **business/ops, not technical**: school-district **Data Processing Agreements** (districts won't adopt at scale without a signed privacy agreement), support load, and abuse moderation. Those are "good problems" (it's selling) and are handled by process, not architecture — but worth knowing they arrive with success.

## Privacy & compliance (commercial product, minors)

- **No student PII collected** — handles only; no names, emails, or logins for kids.
- Teacher is the **sole account holder** (Google/magic-link); COPPA/FERPA posture = the school's authorized adult holds the account, students are anonymous.
- Class/team/game/player docs are **TTL-cleaned** after session end/idle; no cross-session child data.
- Publish a short **data-handling note** (what's collected, retention) in the TpT listing and an in-app footer.

## Phasing (each independently shippable)

- **P0 — DONE** (in `feat/live-phase0` worktree): pure `src/engine/` + client-only Solo. *Reused as-is.*
- **P1 — Convex foundation + Kahoot lobby.** Convex project, `schema.ts`, Convex Auth (Google + magic-link), access-code redemption + `hasLiveAccess` gate, class open/close, team create/join/character-pick/**captain lock**, teacher **dashboard**. **No gameplay yet** — lobby + dashboard only, multi-tab testable. ← first build slice.
- **P2 — Lockstep engine in Convex.** `startRound`/`submitIntent`/`resolveRound` mutations + scheduler clock + per-player split-info queries + server-side `checkAnswer`, on the shared engine.
- **P3 — Live React board.** `modes/live/` renders authoritative state via subscriptions: parallel planning UI (move path + solve), Ready, round timer, resolution log. Reuses existing `Board`/`PlayerCard`/`ChallengeModal`/`ObjectivePanel`/`Log`.
- **P4 — Adaptive difficulty server-side.** Per-player hidden difficulty in the game doc, persists across games within a class session; optional teacher pin from the dashboard.
- **P5 — AI Glitch + kid-Glitch switch.** `ai.ts` targeting/pathing each round via the engine; team setup toggle hands the Glitch to a kid.
- **P6 — later:** billing/subscription on the `hasLiveAccess` seam, if the code-gate proves insufficient.

## Testing strategy

- **Engine (pure):** existing P0 unit tests on resolution order, two-Breaker generators, win/loss, `checkAnswer`, adaptive bounds. No mocks.
- **Convex functions:** `convex-test` integration tests on access-code redemption gating `Start Class`, class/team lifecycle, captain-lock, **split-info** (a player query never returns another's hidden data), server-side solve validation rejecting client-claimed correctness, TTL cleanup.
- **Lobby (P1):** multi-tab manual playtest (several tabs = several kids forming teams) + teacher dashboard tab.
- **Live (P3):** multi-tab full-class simulation before real students; then classroom playtest.

## Open knobs (playtest, not now)

Round length (75s), move budget (3/4), generator solve count (2), map size, AI aggression, round-track length, adaptive step/bounds, class/team idle TTL, access-code rotation cadence.
