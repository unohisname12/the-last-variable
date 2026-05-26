import { internalMutation } from "./_generated/server";

const IDLE_MS = 6 * 60 * 60 * 1000; // 6h

export const sweepStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - IDLE_MS;
    const stale = await ctx.db
      .query("classes")
      .filter((q) => q.lt(q.field("lastActiveAt"), cutoff))
      .collect();
    for (const cls of stale) {
      const players = await ctx.db
        .query("players")
        .withIndex("by_class", (q) => q.eq("classId", cls._id))
        .collect();
      for (const p of players) await ctx.db.delete(p._id);
      const teams = await ctx.db
        .query("teams")
        .withIndex("by_class", (q) => q.eq("classId", cls._id))
        .collect();
      for (const tm of teams) await ctx.db.delete(tm._id);
      await ctx.db.delete(cls._id);
    }
    return { swept: stale.length };
  },
});
