import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireLiveAccess } from "./access";
import { genClassCode } from "./lib/codes";

const MAX_ACTIVE_CLASSES = 3; // rate-limit per teacher (anti-leak cost guardrail)

export const openClass = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireLiveAccess(ctx);
    const active = await ctx.db
      .query("classes")
      .withIndex("by_teacher", (q) => q.eq("teacherUserId", userId))
      .filter((q) => q.neq(q.field("status"), "ended"))
      .collect();
    if (active.length >= MAX_ACTIVE_CLASSES) throw new Error("Too many open classes — end one first.");

    let code = genClassCode();
    for (let i = 0; i < 5; i++) {
      const clash = await ctx.db
        .query("classes")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();
      if (!clash || clash.status === "ended") break;
      code = genClassCode();
    }
    const classId = await ctx.db.insert("classes", {
      teacherUserId: userId,
      code,
      status: "lobby",
      lastActiveAt: Date.now(),
    });
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
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_class", (q) => q.eq("classId", classId))
      .collect();
    const out = [];
    for (const team of teams) {
      const members = await ctx.db
        .query("players")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      out.push({
        teamId: team._id,
        name: team.name,
        locked: team.locked,
        glitchMode: team.glitchMode,
        members: members.map((m) => ({ handle: m.handle, characterId: m.characterId, role: m.role })),
      });
    }
    return { teams: out };
  },
});
