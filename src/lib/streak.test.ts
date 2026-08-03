import { describe, expect, it } from "vitest";
import { isStreakFlameBright, recoveryAvailable, streakTier } from "./streak";

describe("streak helpers", () => {
  it("assigns milestone tiers", () => {
    expect([0, 29, 30, 90, 180, 365].map(streakTier)).toEqual(["base", "base", "30", "90", "180", "365"]);
  });

  it.each([
    [{ currentStreak: 0, lostStreak: 0 }, true],
    [{ currentStreak: 0, lostStreak: 12 }, true],
    [{ currentStreak: 30, lostStreak: 12 }, true],
    [{ currentStreak: 30, lostStreak: 0 }, false],
  ] as const)("marks streak=%j bright=%s", (streak, expected) => {
    expect(isStreakFlameBright(streak)).toBe(expected);
  });

  it("allows recovery only inside 48-hour window and monthly limit", () => {
    const now = Date.parse("2026-07-30T12:00:00Z");
    expect(recoveryAvailable({ currentStreak: 0, lostStreak: 12, lostAt: "2026-07-28T13:00:01Z", recoveryStartedAt: null, recoveryQuizCount: 0, recoveriesThisMonth: 1 }, now)).toBe(true);
    expect(recoveryAvailable({ currentStreak: 0, lostStreak: 12, lostAt: "2026-07-28T11:59:59Z", recoveryStartedAt: null, recoveryQuizCount: 0, recoveriesThisMonth: 1 }, now)).toBe(false);
    expect(recoveryAvailable({ currentStreak: 0, lostStreak: 12, lostAt: "2026-07-30T11:00:00Z", recoveryStartedAt: null, recoveryQuizCount: 0, recoveriesThisMonth: 2 }, now)).toBe(false);
  });
});
