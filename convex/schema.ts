import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables, // users/sessions for teacher accounts (Convex Auth)

  teachers: defineTable({
    userId: v.id("users"),
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
    code: v.string(),
    status: v.union(v.literal("lobby"), v.literal("live"), v.literal("ended")),
    lastActiveAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_teacher", ["teacherUserId"]),

  teams: defineTable({
    classId: v.id("classes"),
    name: v.string(),
    captainToken: v.string(),
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
  })
    .index("by_token", ["sessionToken"])
    .index("by_class", ["classId"])
    .index("by_team", ["teamId"]),
});
