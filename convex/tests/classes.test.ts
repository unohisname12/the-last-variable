import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../schema";
import { api } from "../_generated/api";

async function teacher(t: ReturnType<typeof convexTest>, withAccess: boolean) {
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  if (withAccess) await t.run((ctx) => ctx.db.insert("teachers", { userId, hasLiveAccess: true }));
  return t.withIdentity({ subject: `${userId}|session1`, issuer: "convex" });
}

describe("classes", () => {
  it("openClass requires live access", async () => {
    const t = convexTest(schema);
    const as = await teacher(t, false);
    await expect(as.mutation(api.classes.openClass, {})).rejects.toThrow(/live access/i);
  });

  it("openClass returns a code; dashboard starts empty", async () => {
    const t = convexTest(schema);
    const as = await teacher(t, true);
    const { code, classId } = await as.mutation(api.classes.openClass, {});
    expect(code).toMatch(/^[A-Z2-9]{5}$/);
    expect((await as.query(api.classes.classDashboard, { classId })).teams).toEqual([]);
  });

  it("rate-limits to 3 active classes", async () => {
    const t = convexTest(schema);
    const as = await teacher(t, true);
    await as.mutation(api.classes.openClass, {});
    await as.mutation(api.classes.openClass, {});
    await as.mutation(api.classes.openClass, {});
    await expect(as.mutation(api.classes.openClass, {})).rejects.toThrow(/too many/i);
  });
});
