import { describe, expect, it } from "vitest";

import { normalizeUsername, validateUsername } from "./usernameValidation";

describe("usernameValidation", () => {
  it("applies lower(btrim()) normalization", () => {
    expect(normalizeUsername("  Alice  ")).toBe("alice");
    expect(normalizeUsername("BOB_123")).toBe("bob_123");
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
