import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { cleanHandle } from "./lib/handles";

function newToken() {
  return crypto.randomUUID();
}

async function classByCode(ctx: QueryCtx | MutationCtx, code: string) {
  const cls = await ctx.db
    .query("classes")
    .withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase()))
    .unique();
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
      classId: cls._id,
      handle: h,
      role: "breaker",
      sessionToken: token,
      lastSeen: Date.now(),
    });
    const teamId = await ctx.db.insert("teams", {
      classId: cls._id,
      name: teamName.slice(0, 20) || "Team",
      captainToken: token,
      glitchMode: "ai",
      locked: false,
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
    await ctx.db.insert("players", {
      classId: cls._id,
      teamId,
      handle: h,
      role: "breaker",
      sessionToken: token,
      lastSeen: Date.now(),
    });
    return { sessionToken: token, teamId, isCaptain: false };
  },
});

export const pickCharacter = mutation({
  args: {
    sessionToken: v.string(),
    characterId: v.string(),
    role: v.union(v.literal("breaker"), v.literal("glitch")),
  },
  handler: async (ctx, { sessionToken, characterId, role }) => {
    const me = await ctx.db
      .query("players")
      .withIndex("by_token", (q) => q.eq("sessionToken", sessionToken))
      .unique();
    if (!me?.teamId) throw new Error("Join a team first");
    const teamId = me.teamId;
    if (role === "glitch") {
      const glitches = await ctx.db
        .query("players")
        .withIndex("by_team", (q) => q.eq("teamId", teamId))
        .filter((q) => q.eq(q.field("role"), "glitch"))
        .collect();
      if (glitches.some((p) => p._id !== me._id)) throw new Error("Glitch seat taken");
    }
    const sameChar = await ctx.db
      .query("players")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .filter((q) => q.eq(q.field("characterId"), characterId))
      .collect();
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
    const members = await ctx.db
      .query("players")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .collect();
    if (members.length < 1) throw new Error("Team is empty");
    // Any size plays — the game scales objectives/difficulty to team size (see balance below).
    await ctx.db.patch(teamId, { locked: true });
    return { ok: true };
  },
});

// Per-player scoped view (split-info: only this player's team + own seat).
export const teamView = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const me = await ctx.db
      .query("players")
      .withIndex("by_token", (q) => q.eq("sessionToken", sessionToken))
      .unique();
    if (!me?.teamId) return null;
    const team = await ctx.db.get(me.teamId);
    const members = await ctx.db
      .query("players")
      .withIndex("by_team", (q) => q.eq("teamId", me.teamId))
      .collect();
    return {
      teamId: me.teamId,
      name: team?.name,
      locked: !!team?.locked,
      glitchMode: team?.glitchMode,
      youAreCaptain: team?.captainToken === sessionToken,
      me: { handle: me.handle, characterId: me.characterId, role: me.role },
      members: members.map((m) => ({ handle: m.handle, characterId: m.characterId, role: m.role })),
    };
  },
});

// Public list of joinable teams in a class (names + counts only).
export const teamsInClass = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const cls = await classByCode(ctx, code);
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_class", (q) => q.eq("classId", cls._id))
      .collect();
    const out = [];
    for (const team of teams) {
      const n = (
        await ctx.db
          .query("players")
          .withIndex("by_team", (q) => q.eq("teamId", team._id))
          .collect()
      ).length;
      out.push({ teamId: team._id, name: team.name, locked: team.locked, count: n });
    }
    return out;
  },
});
