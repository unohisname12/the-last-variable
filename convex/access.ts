import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

async function teacherRow(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not signed in");
  const row = await ctx.db
    .query("teachers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
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
    const found = await ctx.db
      .query("accessCodes")
      .withIndex("by_code", (q) => q.eq("code", norm))
      .unique();
    if (!found || !found.active) throw new Error("Invalid or expired code");
    if (row) await ctx.db.patch(row._id, { hasLiveAccess: true, redeemedCode: norm });
    else await ctx.db.insert("teachers", { userId, hasLiveAccess: true, redeemedCode: norm });
    return { ok: true };
  },
});
