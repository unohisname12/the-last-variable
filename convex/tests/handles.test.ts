import { describe, it, expect } from "vitest";
import { cleanHandle } from "../lib/handles";
import { genClassCode } from "../lib/codes";

describe("cleanHandle", () => {
  it("trims and caps length to 16", () => {
    expect(cleanHandle("   ZoomKid   ")).toBe("ZoomKid");
    expect(cleanHandle("a".repeat(40))!.length).toBe(16);
  });
  it("rejects empty after trim", () => {
    expect(cleanHandle("   ")).toBeNull();
  });
  it("blocks banned words case-insensitively", () => {
    expect(cleanHandle("ShitLord")).toBeNull();
  });
  it("strips control / non-printable chars but keeps spaces", () => {
    expect(cleanHandle("ok\x07name")).toBe("okname");
    expect(cleanHandle("Cool Kid")).toBe("Cool Kid");
  });
});

describe("genClassCode", () => {
  it("is 5 chars from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      expect(genClassCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
    }
  });
});
