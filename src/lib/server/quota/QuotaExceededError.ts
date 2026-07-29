export class QuotaExceededError extends Error {
  readonly statusCode = 402;

  constructor(
    readonly details: {
      weeklyUsed: number;
      weeklyLimit: number;
      bonusCredits: number;
      weekResetsAt: string;
    },
  ) {
    super("Weekly generation quota exceeded.");
    this.name = "QuotaExceededError";
  }
}
