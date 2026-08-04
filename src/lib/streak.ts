export type LearningStreak = {
  currentStreak: number;
  lostStreak: number;
  lostAt: string | null;
  recoveryStartedAt: string | null;
  recoveryQuizCount: number;
  recoveriesThisMonth: number;
};

export function streakTier(days: number): "base" | "30" | "90" | "180" | "365" {
  if (days >= 365) return "365";
  if (days >= 180) return "180";
  if (days >= 90) return "90";
  if (days >= 30) return "30";
  return "base";
}

export function isStreakFlameBright(streak: Pick<LearningStreak, "currentStreak" | "lostStreak">): boolean {
  return streak.currentStreak === 0 || streak.lostStreak > 0;
}

export function recoveryAvailable(streak: LearningStreak, now = Date.now()): boolean {
  return streak.lostStreak > 0 && streak.lostAt !== null && now - Date.parse(streak.lostAt) <= 48 * 60 * 60 * 1000 && streak.recoveriesThisMonth < 2;
}
