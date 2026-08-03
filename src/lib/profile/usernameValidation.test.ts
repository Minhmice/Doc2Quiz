import { describe, expect, it } from "vitest";

import { friendProfileHref, normalizeUsername, validateUsername } from "./usernameValidation";

describe("usernameValidation", () => {
  it("applies lower(btrim()) normalization", () => {
    expect(normalizeUsername("  Alice  ")).toBe("alice");
    expect(normalizeUsername("BOB_123")).toBe("bob_123");
  });

  it("builds username profile URLs and encodes legacy IDs", () => {
    expect(friendProfileHref("00000000-0000-4000-8000-000000000001", "MinhDoan")).toBe("/profile/minhdoan");
    expect(friendProfileHref("00000000-0000-4000-8000-000000000001", null)).toBe("/profile/00000000-0000-4000-8000-000000000001");
  });

  it("accepts valid username shapes", () => {
    expect(validateUsername("abc")).toBeNull();
    expect(validateUsername(" user_01 ")).toBeNull();
  });

  it("rejects invalid username shapes", () => {
    expect(validateUsername("ab")).toMatch(/3/);
    expect(validateUsername("a".repeat(31))).toMatch(/30/);
    expect(validateUsername("bad-name")).toMatch(/letters/);
    expect(validateUsername(null)).toMatch(/required/i);
  });
});
