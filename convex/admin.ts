// Admin-only (internal: not callable from the client). Run via `npx convex run admin:addAccessCode '{...}'`.
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const seedClass = internalMutation({
  args: { code: v.optional(v.string()) },
  handler: async (ctx, { code }) => {
    const c = (code || "DEMO1").toUpperCase();
    const existing = await ctx.db.query("classes").withIndex("by_code", (q) => q.eq("code", c)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, { status: "lobby", lastActiveAt: Date.now() });
      return { code: c, classId: existing._id };
    }
    const uid = await ctx.db.insert("users", {} as any);
    const classId = await ctx.db.insert("classes", { teacherUserId: uid, code: c, status: "lobby", lastActiveAt: Date.now() });
    return { code: c, classId };
  },
});

export const addAccessCode = internalMutation({
  args: { code: v.string(), edition: v.string() },
  handler: async (ctx, { code, edition }) => {
    const norm = code.trim().toUpperCase();
    const existing = await ctx.db
      .query("accessCodes")
      .withIndex("by_code", (q) => q.eq("code", norm))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { edition, active: true });
      return { updated: true, code: norm };
    }
    await ctx.db.insert("accessCodes", { code: norm, edition, active: true });
    return { created: true, code: norm };
  },
});
