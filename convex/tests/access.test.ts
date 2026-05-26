import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../schema";
import { api } from "../_generated/api";

// Convex Auth's getAuthUserId() reads identity.subject formatted as `${userId}|${sessionId}`.
async function authedTeacher(t: ReturnType<typeof convexTest>) {
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  return { userId, as: t.withIdentity({ subject: `${userId}|session1`, issuer: "convex" }) };
}

describe("access codes", () => {
  it("redeem sets hasLiveAccess for an authed teacher (case-insensitive)", async () => {
    const t = convexTest(schema);
    await t.run((ctx) =>
      ctx.db.insert("accessCodes", { code: "LASTVAR-S1-ABCD", edition: "s1", active: true }),
    );
    const { as } = await authedTeacher(t);
    await as.mutation(api.access.redeemCode, { code: "lastvar-s1-abcd" });
    expect((await as.query(api.access.myAccess, {})).hasLiveAccess).toBe(true);
  });

  it("rejects an unknown/inactive code", async () => {
    const t = convexTest(schema);
    const { as } = await authedTeacher(t);
    await expect(as.mutation(api.access.redeemCode, { code: "NOPE" })).rejects.toThrow();
  });

  it("an inactive code does not unlock", async () => {
    const t = convexTest(schema);
    await t.run((ctx) =>
      ctx.db.insert("accessCodes", { code: "OLD-EDITION", edition: "s0", active: false }),
    );
    const { as } = await authedTeacher(t);
    await expect(as.mutation(api.access.redeemCode, { code: "OLD-EDITION" })).rejects.toThrow();
  });
});
