import { describe, expect, it } from "vitest";

import { getStreakFlameClass } from "./StreakButton";

describe("getStreakFlameClass", () => {
  it("uses bright muted colors for zero or lost streaks", () => {
    expect(getStreakFlameClass({ currentStreak: 0, lostStreak: 0 })).toBe("text-amber-600 dark:text-amber-400");
    expect(getStreakFlameClass({ currentStreak: 0, lostStreak: 12 })).toBe("text-amber-600 dark:text-amber-400");
    expect(getStreakFlameClass({ currentStreak: 30, lostStreak: 12 })).toBe("text-amber-600 dark:text-amber-400");
  });

  it("uses existing tier colors for active and recovered streaks", () => {
    expect(getStreakFlameClass({ currentStreak: 30, lostStreak: 0 })).toBe("text-yellow-500");
    expect(getStreakFlameClass({ currentStreak: 90, lostStreak: 0 })).toBe("scale-110 text-amber-500");
  });
});
