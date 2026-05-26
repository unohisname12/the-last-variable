import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../schema";
import { api } from "../_generated/api";

async function liveClass(t: ReturnType<typeof convexTest>) {
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  await t.run((ctx) => ctx.db.insert("teachers", { userId, hasLiveAccess: true }));
  const as = t.withIdentity({ subject: `${userId}|session1`, issuer: "convex" });
  return as.mutation(api.classes.openClass, {});
}

describe("teams", () => {
  it("kid joins by code, gets a token, becomes captain of a new team", async () => {
    const t = convexTest(schema);
    const { code } = await liveClass(t);
    const r = await t.mutation(api.teams.joinClass, { code, handle: "ZoomKid", teamName: "Red" });
    expect(r.sessionToken).toBeTruthy();
    expect(r.isCaptain).toBe(true);
  });

  it("rejects a banned handle", async () => {
    const t = convexTest(schema);
    const { code } = await liveClass(t);
    await expect(
      t.mutation(api.teams.joinClass, { code, handle: "ShitLord", teamName: "Red" }),
    ).rejects.toThrow();
  });

  it("only the captain can lock, and lock needs >= 3 players", async () => {
    const t = convexTest(schema);
    const { code } = await liveClass(t);
    const cap = await t.mutation(api.teams.joinClass, { code, handle: "Cap", teamName: "Blue" });
    const m1 = await t.mutation(api.teams.joinTeam, { code, teamId: cap.teamId, handle: "Mate1" });
    // only 2 players -> lock should fail
    await expect(
      t.mutation(api.teams.lockTeam, { sessionToken: cap.sessionToken, teamId: cap.teamId }),
    ).rejects.toThrow(/3 players/i);
    const m2 = await t.mutation(api.teams.joinTeam, { code, teamId: cap.teamId, handle: "Mate2" });
    // non-captain cannot lock
    await expect(
      t.mutation(api.teams.lockTeam, { sessionToken: m1.sessionToken, teamId: cap.teamId }),
    ).rejects.toThrow(/captain/i);
    // captain locks
    await t.mutation(api.teams.lockTeam, { sessionToken: cap.sessionToken, teamId: cap.teamId });
    expect((await t.query(api.teams.teamView, { sessionToken: m2.sessionToken })).locked).toBe(true);
  });

  it("character uniqueness within a team", async () => {
    const t = convexTest(schema);
    const { code } = await liveClass(t);
    const cap = await t.mutation(api.teams.joinClass, { code, handle: "Cap", teamName: "Green" });
    const m1 = await t.mutation(api.teams.joinTeam, { code, teamId: cap.teamId, handle: "Mate1" });
    await t.mutation(api.teams.pickCharacter, { sessionToken: cap.sessionToken, characterId: "hacker", role: "breaker" });
    await expect(
      t.mutation(api.teams.pickCharacter, { sessionToken: m1.sessionToken, characterId: "hacker", role: "breaker" }),
    ).rejects.toThrow(/taken/i);
  });
});
