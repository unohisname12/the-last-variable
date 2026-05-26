# Live P1 — Convex Foundation + Kahoot Lobby — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Convex Cloud backend + Kahoot-style classroom lobby: teacher sign-in, PDF access-code gate, open a class, kids join by code into self-picked teams, a captain locks the team, and the teacher sees every team on a live dashboard. **No gameplay yet** — lobby + dashboard only.

**Architecture:** Convex Cloud is the backend. Teachers authenticate with Convex Auth (Google + Resend magic-link) and are the only accounts; a `hasLiveAccess` flag (set by redeeming a code printed in the PDF) gates `openClass`. Kids are accountless — identified by a `sessionToken` minted on join and stored in localStorage. All state is Convex documents scoped by `classId`/`teamId`/`sessionToken`; a daily cron TTL-cleans stale docs. Client is the existing React/Vite app; the lobby is a new `src/modes/live/` surface.

**Tech Stack:** Convex, `@convex-dev/auth` (Google + Resend), `convex-test` + Vitest (server tests), React 19 + Vite (client), `lucide-react`.

---

## Prerequisites — MANUAL (Dre, interactive; cannot be automated)

These block the live end-to-end run but NOT the `convex-test` unit tests (those run in-process). Do them in this worktree (`~/Code/overclock-math-live`). Run each as `! <cmd>` in the session so output lands here.

- [ ] **P0-a — Convex login + provision.** `npx convex login` (device/browser auth to Dre's Convex account), then `npx convex dev` once — this creates the dev deployment and writes `.env.local` (`CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`). Leave `convex dev` running during client work.
- [ ] **P0-b — Google OAuth creds.** In Google Cloud Console → APIs & Services → Credentials → create an OAuth 2.0 Web client. Authorized redirect URI: `https://<deployment>.convex.site/api/auth/callback/google` (printed by Convex Auth setup). Then:
  `npx convex env set AUTH_GOOGLE_ID <client-id>` and `npx convex env set AUTH_GOOGLE_SECRET <secret>`.
- [ ] **P0-c — Magic-link email (Resend).** Create a Resend account + API key + verified sender domain. `npx convex env set AUTH_RESEND_KEY <key>`.
- [ ] **P0-d — Auth env.** `npx @convex-dev/auth` (the setup CLI) to generate `SITE_URL` / `JWT_PRIVATE_KEY` / `JWKS` env vars on the deployment.

If P0-a is not done yet, agents still complete Tasks 1–9 (schema + functions + tests) via `convex-test`; only Task 10's live wiring and Task 11's multi-tab QA need the live deployment.

---

## File structure

```
overclock-math-live/
  convex/
    schema.ts          # tables: teachers, accessCodes, classes, teams, players
    auth.ts            # convexAuth({ providers: [Google, Resend] })
    auth.config.ts     # auth provider config for the deployment
    access.ts          # redeemCode mutation, requireLiveAccess helper
    classes.ts         # openClass, endClass, classDashboard query
    teams.ts           # createTeam, joinTeam, pickCharacter, lockTeam, teamView query
    lib/handles.ts     # cleanHandle() profanity/format filter (pure)
    lib/codes.ts       # genClassCode() (pure)
    crons.ts           # daily TTL cleanup of stale classes/teams/players
  convex/tests/
    access.test.ts     # convex-test: redeem + gate
    classes.test.ts    # convex-test: openClass gated, dashboard, rate limit
    teams.test.ts      # convex-test: join/pick/lock, captain-only, split scoping
    handles.test.ts    # vitest: cleanHandle pure
  src/
    main.jsx           # add a top-level mode router (Solo/Live) — minimal
    modes/live/
      ConvexClient.jsx  # ConvexReactClient + ConvexAuthProvider wrapper
      TeacherAuth.jsx   # sign-in (Google + magic-link) + access-code redeem
      TeacherClass.jsx  # Start Class, show code, live dashboard
      KidJoin.jsx       # code -> handle -> team pick -> character -> lock
  vitest.config.ts     # convex-test environment
```

---

## Task 1: Project deps + Convex skeleton

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`, `convex/schema.ts` (empty tables placeholder), `convex/tsconfig.json`

- [ ] **Step 1: Install dependencies**

```bash
cd /home/dre/Code/overclock-math-live
npm install convex @convex-dev/auth @auth/core@0.37.0
npm install -D convex-test vitest @edge-runtime/vm typescript
```

- [ ] **Step 2: Add scripts to package.json**

Add to `"scripts"`:
```json
"dev:convex": "convex dev",
"test:convex": "vitest run",
"test:convex:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "edge-runtime", server: { deps: { inline: ["convex-test"] } } },
});
```

- [ ] **Step 4: Create `convex/schema.ts` (tables defined in Task 2 — start minimal to compile)**

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({ ...authTables });
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc -p convex --noEmit`
Expected: no errors (authTables resolves).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts convex/schema.ts convex/tsconfig.json
git commit -m "chore(live): convex + auth + convex-test deps and skeleton"
```

---

## Task 2: Schema — classes / teams / players / accessCodes / teachers

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Define the tables**

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables, // users/sessions for teacher accounts (Convex Auth)

  teachers: defineTable({
    userId: v.id("users"),        // links to Convex Auth user
    hasLiveAccess: v.boolean(),
    redeemedCode: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  accessCodes: defineTable({
    code: v.string(),
    edition: v.string(),
    active: v.boolean(),
  }).index("by_code", ["code"]),

  classes: defineTable({
    teacherUserId: v.id("users"),
    code: v.string(),                                  // short projector code
    status: v.union(v.literal("lobby"), v.literal("live"), v.literal("ended")),
    lastActiveAt: v.number(),
  }).index("by_code", ["code"]).index("by_teacher", ["teacherUserId"]),

  teams: defineTable({
    classId: v.id("classes"),
    name: v.string(),
    captainToken: v.string(),                          // sessionToken of captain
    glitchMode: v.union(v.literal("ai"), v.literal("kid")),
    locked: v.boolean(),
  }).index("by_class", ["classId"]),

  players: defineTable({
    classId: v.id("classes"),
    teamId: v.optional(v.id("teams")),
    handle: v.string(),
    characterId: v.optional(v.string()),
    role: v.union(v.literal("breaker"), v.literal("glitch")),
    sessionToken: v.string(),
    lastSeen: v.number(),
  }).index("by_token", ["sessionToken"]).index("by_class", ["classId"]).index("by_team", ["teamId"]),
});
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc -p convex --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts && git commit -m "feat(live): convex schema for classes/teams/players/access"
```

---

## Task 3: Pure helpers — handle filter + class code

**Files:**
- Create: `convex/lib/handles.ts`, `convex/lib/codes.ts`, `convex/tests/handles.test.ts`

- [ ] **Step 1: Write failing test `convex/tests/handles.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { cleanHandle } from "../lib/handles";

describe("cleanHandle", () => {
  it("trims and caps length to 16", () => {
    expect(cleanHandle("   ZoomKid   ")).toBe("ZoomKid");
    expect(cleanHandle("a".repeat(40)).length).toBe(16);
  });
  it("rejects empty after trim", () => {
    expect(cleanHandle("   ")).toBeNull();
  });
  it("blocks banned words case-insensitively", () => {
    expect(cleanHandle("badword1")).toBeNull(); // replace with a real entry from BANNED
  });
  it("strips control/non-printable chars", () => {
    expect(cleanHandle("okname")).toBe("okname");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run convex/tests/handles.test.ts`
Expected: FAIL (cleanHandle not defined).

- [ ] **Step 3: Implement `convex/lib/handles.ts`**

```ts
// Minimal slur/profanity guard for a minors product. Expand BANNED over time.
const BANNED = ["badword1", /* add real entries */ "fuck", "shit", "bitch", "nigg", "fag", "cunt", "rape", "sex", "porn"];

export function cleanHandle(raw: string): string | null {
  const stripped = String(raw).replace(/[^\x20-\x7E]/g, "").trim().slice(0, 16);
  if (!stripped) return null;
  const low = stripped.toLowerCase();
  if (BANNED.some((b) => low.includes(b))) return null;
  return stripped;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run convex/tests/handles.test.ts`
Expected: PASS (set the third test's input to a real BANNED entry, e.g. `"shitlord"`).

- [ ] **Step 5: Implement `convex/lib/codes.ts`**

```ts
// Unambiguous alphabet (no 0/O/1/I). 5 chars -> ~28M combos, plenty per active class.
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function genClassCode(len = 5): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return out;
}
```

- [ ] **Step 6: Commit**

```bash
git add convex/lib/handles.ts convex/lib/codes.ts convex/tests/handles.test.ts
git commit -m "feat(live): pure handle filter + class-code generator with tests"
```

---

## Task 4: Auth wiring (teachers only)

**Files:**
- Create: `convex/auth.ts`, `convex/auth.config.ts`, `convex/http.ts`

- [ ] **Step 1: `convex/auth.ts`**

```ts
import Google from "@auth/core/providers/google";
import Resend from "@auth/core/providers/resend";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google, Resend({ from: "The Last Variable <play@thelastvariable.app>" })],
});
```

- [ ] **Step 2: `convex/http.ts`**

```ts
import { httpRouter } from "convex/server";
import { auth } from "./auth";
const http = httpRouter();
auth.addHttpRoutes(http);
export default http;
```

- [ ] **Step 3: `convex/auth.config.ts`**

```ts
export default {
  providers: [{ domain: process.env.CONVEX_SITE_URL, applicationID: "convex" }],
};
```

- [ ] **Step 4: Verify compile**

Run: `npx tsc -p convex --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add convex/auth.ts convex/auth.config.ts convex/http.ts
git commit -m "feat(live): Convex Auth (Google + Resend magic-link) for teachers"
```

---

## Task 5: Access-code redemption + live-access gate

**Files:**
- Create: `convex/access.ts`, `convex/tests/access.test.ts`

- [ ] **Step 1: Write failing test `convex/tests/access.test.ts`**

```ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../schema";
import { api } from "../_generated/api";

describe("access codes", () => {
  it("redeem sets hasLiveAccess for an authed teacher", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("accessCodes", { code: "LASTVAR-S1-ABCD", edition: "s1", active: true });
    });
    const asTeacher = t.withIdentity({ subject: "user_1", issuer: "convex" });
    await asTeacher.mutation(api.access.redeemCode, { code: "lastvar-s1-abcd" }); // case-insensitive
    const access = await asTeacher.query(api.access.myAccess, {});
    expect(access.hasLiveAccess).toBe(true);
  });
  it("rejects an unknown/inactive code", async () => {
    const t = convexTest(schema);
    const asTeacher = t.withIdentity({ subject: "user_2", issuer: "convex" });
    await expect(asTeacher.mutation(api.access.redeemCode, { code: "NOPE" })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run convex/tests/access.test.ts`
Expected: FAIL (api.access.* undefined).

- [ ] **Step 3: Implement `convex/access.ts`**

```ts
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

async function teacherRow(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not signed in");
  const row = await ctx.db.query("teachers").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
  return { userId, row };
}

export async function requireLiveAccess(ctx: MutationCtx) {
  const { userId, row } = await teacherRow(ctx);
  if (!row?.hasLiveAccess) throw new Error("No live access — redeem the code from your PDF.");
  return userId;
}

export const myAccess = query({
  args: {},
  handler: async (ctx) => {
    const { row } = await teacherRow(ctx);
    return { hasLiveAccess: !!row?.hasLiveAccess };
  },
});

export const redeemCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const { userId, row } = await teacherRow(ctx);
    const norm = code.trim().toUpperCase();
    const found = await ctx.db.query("accessCodes").withIndex("by_code", (q) => q.eq("code", norm)).unique();
    if (!found || !found.active) throw new Error("Invalid or expired code");
    if (row) await ctx.db.patch(row._id, { hasLiveAccess: true, redeemedCode: norm });
    else await ctx.db.insert("teachers", { userId, hasLiveAccess: true, redeemedCode: norm });
    return { ok: true };
  },
});
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run convex/tests/access.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/access.ts convex/tests/access.test.ts
git commit -m "feat(live): access-code redemption + requireLiveAccess gate (tested)"
```

---

## Task 6: Classes — open (gated + rate-limited), end, dashboard

**Files:**
- Create: `convex/classes.ts`, `convex/tests/classes.test.ts`

- [ ] **Step 1: Write failing test `convex/tests/classes.test.ts`**

```ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../schema";
import { api } from "../_generated/api";

async function teacherWithAccess(t: any, subject: string) {
  const as = t.withIdentity({ subject, issuer: "convex" });
  await t.run(async (ctx: any) => {
    const userId = await ctx.db.query("users").collect().then((u: any[]) => u[0]?._id);
  });
  await t.run(async (ctx: any) => {
    // seed a teacher row with access for `subject` is done via redeem in real flow;
    // here insert directly keyed to the auth user id created lazily by withIdentity.
  });
  return as;
}

describe("classes", () => {
  it("openClass requires live access", async () => {
    const t = convexTest(schema);
    const as = t.withIdentity({ subject: "u_noaccess", issuer: "convex" });
    await expect(as.mutation(api.classes.openClass, {})).rejects.toThrow(/live access/i);
  });

  it("openClass returns a code, dashboard lists no teams yet", async () => {
    const t = convexTest(schema);
    const as = t.withIdentity({ subject: "u_ok", issuer: "convex" });
    // grant access
    await t.run(async (ctx) => {
      const uid = (await ctx.db.query("users").collect())[0]?._id
        ?? await ctx.db.insert("users", {} as any);
      await ctx.db.insert("teachers", { userId: uid, hasLiveAccess: true });
    });
    const { code, classId } = await as.mutation(api.classes.openClass, {});
    expect(code).toMatch(/^[A-Z2-9]{5}$/);
    const dash = await as.query(api.classes.classDashboard, { classId });
    expect(dash.teams).toEqual([]);
  });
});
```

> Note: convex-test creates the `users` row lazily for a given `subject`. If `getAuthUserId` returns null in the seed block, insert a `users` row and a `teachers` row pointing at it; `withIdentity({subject})` must map to that user. Confirm the mapping in the first run and adjust the seed (this is the one spot to verify interactively).

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run convex/tests/classes.test.ts`
Expected: FAIL (api.classes.* undefined).

- [ ] **Step 3: Implement `convex/classes.ts`**

```ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireLiveAccess } from "./access";
import { genClassCode } from "./lib/codes";

const MAX_ACTIVE_CLASSES = 3; // rate-limit per teacher (anti-leak guardrail)

export const openClass = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireLiveAccess(ctx);
    const active = await ctx.db.query("classes")
      .withIndex("by_teacher", (q) => q.eq("teacherUserId", userId))
      .filter((q) => q.neq(q.field("status"), "ended")).collect();
    if (active.length >= MAX_ACTIVE_CLASSES) throw new Error("Too many open classes — end one first.");
    let code = genClassCode();
    // ensure unique among non-ended classes
    for (let i = 0; i < 5; i++) {
      const clash = await ctx.db.query("classes").withIndex("by_code", (q) => q.eq("code", code)).unique();
      if (!clash || clash.status === "ended") break;
      code = genClassCode();
    }
    const classId = await ctx.db.insert("classes", { teacherUserId: userId, code, status: "lobby", lastActiveAt: Date.now() });
    return { classId, code };
  },
});

export const endClass = mutation({
  args: { classId: v.id("classes") },
  handler: async (ctx, { classId }) => {
    const userId = await requireLiveAccess(ctx);
    const cls = await ctx.db.get(classId);
    if (!cls || cls.teacherUserId !== userId) throw new Error("Not your class");
    await ctx.db.patch(classId, { status: "ended", lastActiveAt: Date.now() });
    return { ok: true };
  },
});

export const classDashboard = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, { classId }) => {
    const teams = await ctx.db.query("teams").withIndex("by_class", (q) => q.eq("classId", classId)).collect();
    const out = [];
    for (const team of teams) {
      const members = await ctx.db.query("players").withIndex("by_team", (q) => q.eq("teamId", team._id)).collect();
      out.push({ teamId: team._id, name: team.name, locked: team.locked, glitchMode: team.glitchMode,
        members: members.map((m) => ({ handle: m.handle, characterId: m.characterId, role: m.role })) });
    }
    return { teams: out };
  },
});
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run convex/tests/classes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/classes.ts convex/tests/classes.test.ts
git commit -m "feat(live): openClass (gated+rate-limited), endClass, dashboard (tested)"
```

---

## Task 7: Teams — join by code, pick character, captain lock, scoped view

**Files:**
- Create: `convex/teams.ts`, `convex/tests/teams.test.ts`

- [ ] **Step 1: Write failing test `convex/tests/teams.test.ts`**

```ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../schema";
import { api } from "../_generated/api";

async function liveClass(t: any) {
  const as = t.withIdentity({ subject: "u_teacher", issuer: "convex" });
  await t.run(async (ctx: any) => {
    const uid = (await ctx.db.query("users").collect())[0]?._id ?? await ctx.db.insert("users", {} as any);
    await ctx.db.insert("teachers", { userId: uid, hasLiveAccess: true });
  });
  const { classId, code } = await as.mutation(api.classes.openClass, {});
  return { code, classId };
}

describe("teams", () => {
  it("kid joins by code, gets a sessionToken + becomes captain of a new team", async () => {
    const t = convexTest(schema);
    const { code } = await liveClass(t);
    const r = await t.mutation(api.teams.joinClass, { code, handle: "ZoomKid", teamName: "Red" });
    expect(r.sessionToken).toBeTruthy();
    expect(r.isCaptain).toBe(true);
  });

  it("rejects a banned handle", async () => {
    const t = convexTest(schema);
    const { code } = await liveClass(t);
    await expect(t.mutation(api.teams.joinClass, { code, handle: "shitlord", teamName: "Red" })).rejects.toThrow();
  });

  it("only the captain can lock the team", async () => {
    const t = convexTest(schema);
    const { code } = await liveClass(t);
    const cap = await t.mutation(api.teams.joinClass, { code, handle: "Cap", teamName: "Blue" });
    const member = await t.mutation(api.teams.joinTeam, { code, teamId: cap.teamId, handle: "Mate" });
    await expect(t.mutation(api.teams.lockTeam, { sessionToken: member.sessionToken, teamId: cap.teamId })).rejects.toThrow(/captain/i);
    await t.mutation(api.teams.lockTeam, { sessionToken: cap.sessionToken, teamId: cap.teamId });
    const view = await t.query(api.teams.teamView, { sessionToken: member.sessionToken });
    expect(view.locked).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run convex/tests/teams.test.ts`
Expected: FAIL (api.teams.* undefined).

- [ ] **Step 3: Implement `convex/teams.ts`**

```ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { cleanHandle } from "./lib/handles";

function newToken() { return crypto.randomUUID(); }

async function classByCode(ctx: any, code: string) {
  const cls = await ctx.db.query("classes").withIndex("by_code", (q: any) => q.eq("code", code.trim().toUpperCase())).unique();
  if (!cls || cls.status === "ended") throw new Error("Class not found");
  return cls;
}

// Join a class and CREATE a new team (this player becomes captain).
export const joinClass = mutation({
  args: { code: v.string(), handle: v.string(), teamName: v.string() },
  handler: async (ctx, { code, handle, teamName }) => {
    const cls = await classByCode(ctx, code);
    const h = cleanHandle(handle);
    if (!h) throw new Error("Pick a different name");
    const token = newToken();
    const playerId = await ctx.db.insert("players", {
      classId: cls._id, handle: h, role: "breaker", sessionToken: token, lastSeen: Date.now(),
    });
    const teamId = await ctx.db.insert("teams", {
      classId: cls._id, name: teamName.slice(0, 20) || "Team", captainToken: token, glitchMode: "ai", locked: false,
    });
    await ctx.db.patch(playerId, { teamId });
    return { sessionToken: token, teamId, isCaptain: true };
  },
});

// Join an EXISTING team in the class.
export const joinTeam = mutation({
  args: { code: v.string(), teamId: v.id("teams"), handle: v.string() },
  handler: async (ctx, { code, teamId, handle }) => {
    const cls = await classByCode(ctx, code);
    const team = await ctx.db.get(teamId);
    if (!team || team.classId !== cls._id) throw new Error("Team not found");
    if (team.locked) throw new Error("Team is locked");
    const h = cleanHandle(handle);
    if (!h) throw new Error("Pick a different name");
    const token = newToken();
    await ctx.db.insert("players", { classId: cls._id, teamId, handle: h, role: "breaker", sessionToken: token, lastSeen: Date.now() });
    return { sessionToken: token, teamId, isCaptain: false };
  },
});

export const pickCharacter = mutation({
  args: { sessionToken: v.string(), characterId: v.string(), role: v.union(v.literal("breaker"), v.literal("glitch")) },
  handler: async (ctx, { sessionToken, characterId, role }) => {
    const me = await ctx.db.query("players").withIndex("by_token", (q) => q.eq("sessionToken", sessionToken)).unique();
    if (!me?.teamId) throw new Error("Join a team first");
    if (me.role !== role) {
      // taking the glitch seat must be unique per team
      if (role === "glitch") {
        const existingGlitch = await ctx.db.query("players").withIndex("by_team", (q) => q.eq("teamId", me.teamId!))
          .filter((q) => q.eq(q.field("role"), "glitch")).collect();
        if (existingGlitch.some((p) => p._id !== me._id)) throw new Error("Glitch seat taken");
      }
    }
    // character uniqueness within team
    const sameChar = await ctx.db.query("players").withIndex("by_team", (q) => q.eq("teamId", me.teamId!))
      .filter((q) => q.eq(q.field("characterId"), characterId)).collect();
    if (sameChar.some((p) => p._id !== me._id)) throw new Error("Character taken");
    await ctx.db.patch(me._id, { characterId, role });
    return { ok: true };
  },
});

export const lockTeam = mutation({
  args: { sessionToken: v.string(), teamId: v.id("teams") },
  handler: async (ctx, { sessionToken, teamId }) => {
    const team = await ctx.db.get(teamId);
    if (!team) throw new Error("Team not found");
    if (team.captainToken !== sessionToken) throw new Error("Only the captain can lock the team");
    const members = await ctx.db.query("players").withIndex("by_team", (q) => q.eq("teamId", teamId)).collect();
    if (members.length < 3) throw new Error("Need at least 3 players");
    await ctx.db.patch(teamId, { locked: true });
    return { ok: true };
  },
});

// Per-player scoped view (split-info: only this player's team + own seat).
export const teamView = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const me = await ctx.db.query("players").withIndex("by_token", (q) => q.eq("sessionToken", sessionToken)).unique();
    if (!me?.teamId) return null;
    const team = await ctx.db.get(me.teamId);
    const members = await ctx.db.query("players").withIndex("by_team", (q) => q.eq("teamId", me.teamId)).collect();
    return {
      teamId: me.teamId, name: team?.name, locked: !!team?.locked, glitchMode: team?.glitchMode,
      youAreCaptain: team?.captainToken === sessionToken,
      me: { handle: me.handle, characterId: me.characterId, role: me.role },
      members: members.map((m) => ({ handle: m.handle, characterId: m.characterId, role: m.role })),
    };
  },
});

// Public list of joinable teams in a class (names + counts only — no PII beyond handles).
export const teamsInClass = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const cls = await classByCode(ctx, code);
    const teams = await ctx.db.query("teams").withIndex("by_class", (q) => q.eq("classId", cls._id)).collect();
    const out = [];
    for (const team of teams) {
      const n = (await ctx.db.query("players").withIndex("by_team", (q) => q.eq("teamId", team._id)).collect()).length;
      out.push({ teamId: team._id, name: team.name, locked: team.locked, count: n });
    }
    return out;
  },
});
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run convex/tests/teams.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/teams.ts convex/tests/teams.test.ts
git commit -m "feat(live): team join/pick/lock + captain gate + scoped view (tested)"
```

---

## Task 8: TTL cleanup cron

**Files:**
- Create: `convex/crons.ts`, `convex/cleanup.ts`

- [ ] **Step 1: Implement `convex/cleanup.ts`**

```ts
import { internalMutation } from "./_generated/server";

const IDLE_MS = 6 * 60 * 60 * 1000; // 6h

export const sweepStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - IDLE_MS;
    const stale = await ctx.db.query("classes").filter((q) => q.lt(q.field("lastActiveAt"), cutoff)).collect();
    for (const cls of stale) {
      const players = await ctx.db.query("players").withIndex("by_class", (q) => q.eq("classId", cls._id)).collect();
      for (const p of players) await ctx.db.delete(p._id);
      const teams = await ctx.db.query("teams").withIndex("by_class", (q) => q.eq("classId", cls._id)).collect();
      for (const tm of teams) await ctx.db.delete(tm._id);
      await ctx.db.delete(cls._id);
    }
    return { swept: stale.length };
  },
});
```

- [ ] **Step 2: Implement `convex/crons.ts`**

```ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
crons.interval("sweep stale classes", { hours: 1 }, internal.cleanup.sweepStale, {});
export default crons;
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc -p convex --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add convex/crons.ts convex/cleanup.ts && git commit -m "feat(live): hourly TTL sweep of idle classes/teams/players"
```

---

## Task 9: Run full server test suite

- [ ] **Step 1: Run all convex tests**

Run: `npx vitest run`
Expected: all PASS (handles, access, classes, teams).

- [ ] **Step 2: Commit any fixes, then tag the milestone**

```bash
git commit --allow-empty -m "test(live): P1 server suite green"
```

---

## Task 10: Client — mode router, teacher auth/dashboard, kid join

> Requires P0-a (live deployment + `VITE_CONVEX_URL`). Build the components regardless; they wire to Convex hooks.

**Files:**
- Create: `src/modes/live/ConvexClient.jsx`, `TeacherAuth.jsx`, `TeacherClass.jsx`, `KidJoin.jsx`
- Modify: `src/main.jsx` (add a minimal Solo/Live/HotSeat top-level picker that renders `<LiveApp/>`)

- [ ] **Step 1: `src/modes/live/ConvexClient.jsx`**

```jsx
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
export const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);
export function LiveProviders({ children }) {
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}
```

- [ ] **Step 2: `TeacherAuth.jsx` — sign in + redeem code**

```jsx
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function TeacherAuth({ children }) {
  const { signIn } = useAuthActions();
  const access = useQuery(api.access.myAccess);
  const redeem = useMutation(api.access.redeemCode);
  const [email, setEmail] = useState(""); const [code, setCode] = useState(""); const [err, setErr] = useState("");
  if (access === undefined) return <p>Loading…</p>;
  if (access === null) {
    return (
      <div className="teacherAuth">
        <h2>Teacher sign-in</h2>
        <button onClick={() => signIn("google")}>Sign in with Google</button>
        <form onSubmit={(e) => { e.preventDefault(); signIn("resend", { email }); }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.org" type="email" />
          <button type="submit">Email me a magic link</button>
        </form>
      </div>
    );
  }
  if (!access.hasLiveAccess) {
    return (
      <div className="teacherAuth">
        <h2>Enter your PDF access code</h2>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="LASTVAR-S1-XXXX" />
        <button onClick={async () => { try { await redeem({ code }); } catch (e) { setErr(String(e)); } }}>Unlock</button>
        {err && <p className="err">{err}</p>}
      </div>
    );
  }
  return children;
}
```

- [ ] **Step 3: `TeacherClass.jsx` — start class + dashboard**

```jsx
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function TeacherClass() {
  const open = useMutation(api.classes.openClass);
  const end = useMutation(api.classes.endClass);
  const [cls, setCls] = useState(null);
  const dash = useQuery(api.classes.classDashboard, cls ? { classId: cls.classId } : "skip");
  if (!cls) return <button onClick={async () => setCls(await open({}))}>Start Class</button>;
  return (
    <div className="dashboard">
      <h1>Join code: <b>{cls.code}</b></h1>
      <div className="teamGrid">
        {(dash?.teams ?? []).map((t) => (
          <div key={t.teamId} className={`teamCard ${t.locked ? "locked" : ""}`}>
            <h3>{t.name} {t.locked ? "🔒" : ""}</h3>
            <ul>{t.members.map((m, i) => <li key={i}>{m.handle} — {m.characterId ?? "picking…"} {m.role === "glitch" ? "(Glitch)" : ""}</li>)}</ul>
          </div>
        ))}
      </div>
      <button onClick={() => { end({ classId: cls.classId }); setCls(null); }}>End Class</button>
    </div>
  );
}
```

- [ ] **Step 4: `KidJoin.jsx` — code → handle → team → character → lock**

```jsx
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { breakers, glitches } from "../../gameData.js";

const TOKEN_KEY = "tlv_session";

export function KidJoin() {
  const [code, setCode] = useState("");
  const [handle, setHandle] = useState("");
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || "");
  const teams = useQuery(api.teams.teamsInClass, code.length === 5 ? { code } : "skip");
  const view = useQuery(api.teams.teamView, token ? { sessionToken: token } : "skip");
  const joinClass = useMutation(api.teams.joinClass);
  const joinTeam = useMutation(api.teams.joinTeam);
  const pick = useMutation(api.teams.pickCharacter);
  const lock = useMutation(api.teams.lockTeam);
  useEffect(() => { if (token) localStorage.setItem(TOKEN_KEY, token); }, [token]);

  if (view) {
    return (
      <div className="kidTeam">
        <h2>{view.name} {view.locked ? "🔒 locked — get ready" : ""}</h2>
        <ul>{view.members.map((m, i) => <li key={i}>{m.handle} {m.characterId ? `· ${m.characterId}` : ""}</li>)}</ul>
        {!view.locked && (
          <>
            <div className="charPick">
              {breakers.map((c) => <button key={c.id} onClick={() => pick({ sessionToken: token, characterId: c.id, role: "breaker" })}>{c.name}</button>)}
              {view.glitchMode === "kid" && glitches.map((c) => <button key={c.id} onClick={() => pick({ sessionToken: token, characterId: c.id, role: "glitch" })}>{c.name}</button>)}
            </div>
            {view.youAreCaptain && <button onClick={() => lock({ sessionToken: token, teamId: view.teamId })}>Lock Team</button>}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="kidJoin">
      <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CLASS CODE" maxLength={5} />
      <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Your handle" maxLength={16} />
      {teams && (
        <div className="teamList">
          {teams.filter((t) => !t.locked).map((t) => (
            <button key={t.teamId} onClick={async () => setToken((await joinTeam({ code, teamId: t.teamId, handle })).sessionToken)}>
              Join {t.name} ({t.count})
            </button>
          ))}
          <button onClick={async () => setToken((await joinClass({ code, handle, teamName: handle + "'s team" })).sessionToken)}>+ New Team</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Wire a minimal mode picker in `src/main.jsx`**

Add an entry screen: buttons for **Solo (offline)** → existing app, and **Live (classroom)** → renders `<LiveProviders>` wrapping a Teacher/Kid toggle (`TeacherAuth`+`TeacherClass` for teachers, `KidJoin` for kids). Keep the existing hot-seat reachable. (Minimal routing via `useState`, no router lib.)

- [ ] **Step 6: Typecheck + build**

Run: `npx vite build`
Expected: build succeeds (with `VITE_CONVEX_URL` set; if not yet provisioned, this task's runtime verification waits on P0-a).

- [ ] **Step 7: Commit**

```bash
git add src/modes/live src/main.jsx && git commit -m "feat(live): client lobby — teacher auth/dashboard + kid join/pick/lock"
```

---

## Task 11: Live multi-tab QA (requires P0-a..d done)

- [ ] **Step 1:** `npx convex dev` (one terminal) + `npm run dev` (another).
- [ ] **Step 2:** Seed an access code: `npx convex run --no-push access:_seed` — or insert via dashboard: a row in `accessCodes` `{code:"LASTVAR-S1-TEST", edition:"s1", active:true}`.
- [ ] **Step 3:** Teacher tab: sign in (Google), redeem `LASTVAR-S1-TEST`, Start Class, read the code.
- [ ] **Step 4:** 3+ kid tabs (incognito): enter code, handle, one creates a team, others join, pick characters, captain Locks.
- [ ] **Step 5:** Confirm the teacher dashboard shows the team filling in live and flips to 🔒 on lock. Confirm a banned handle is rejected and a non-captain can't lock.
- [ ] **Step 6:** Drop a kid tab, reopen → same seat (sessionToken from localStorage).

---

## Self-review notes (gaps to confirm during execution)

- **convex-test ↔ Convex Auth user creation:** the exact way `withIdentity({subject})` materializes a `users` row is the one spot to verify on first run (Task 6 Step 1 note). Adjust the seed helper once confirmed; all access/class/team tests depend on it.
- **Resend `from` domain** must be verified before magic-link works (P0-c).
- **Out of P1 scope (later phases):** any board/round/gameplay, adaptive difficulty, AI Glitch — P1 ends at a locked team + live dashboard.
