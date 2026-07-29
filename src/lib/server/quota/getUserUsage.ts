import type { User } from "@supabase/supabase-js";

import { resolveUserAiTier } from "@/lib/server/resolveUserAiTier";

import { getGenerationQuotaAvailability } from "./generationQuotaReservation";
import { WEEKLY_LIMIT } from "./quotaConstants";
import { getQuotaWeekResetsAtIct } from "./quotaWeek";

type QuotaSupabase = {
  rpc: (
    functionName: string,
    args: Record<string, string>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        limit: (count: number) => PromiseLike<{ data: Array<{ id: string }> | null; error: { message: string } | null }>;
      };
    };
  };
};

type UsageArgs = {
  supabase: QuotaSupabase;
  user: User;
  studySetId?: string;
};

type UserUsage = {
  plan: "free" | "pro";
  weeklyUsed: number;
  weeklyLimit: number;
  weeklyRemaining: number;
  bonusCredits: number;
  weekResetsAt: string;
  canGenerateThisSet?: boolean;
};

async function findAvailabilityProbeStudySetId(
  supabase: QuotaSupabase,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("study_sets")
    .select("id")
    .eq("user_id", userId)
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.id ?? null;
}

function mapAvailabilityToUsage(
  plan: "free",
  availability: Awaited<ReturnType<typeof getGenerationQuotaAvailability>>,
  studySetId?: string,
): UserUsage {
  const weeklyUsed = availability.weeklyUsed;
  const bonusCredits = availability.bonusCredits;
  const usage: UserUsage = {
    plan,
    weeklyUsed,
    weeklyLimit: availability.weeklyLimit,
    weeklyRemaining: Math.max(0, availability.weeklyLimit - weeklyUsed),
    bonusCredits,
    weekResetsAt: availability.weekResetsAt,
  };

  if (!studySetId) return usage;

  return {
    ...usage,
    canGenerateThisSet: availability.canGenerate,
  };
}

export async function getUserUsage({ supabase, user, studySetId }: UsageArgs): Promise<UserUsage> {
  const plan = resolveUserAiTier(user);
  const weekResetsAt = getQuotaWeekResetsAtIct().toISOString();

  if (plan === "pro") {
    return {
      plan,
      weeklyUsed: 0,
      weeklyLimit: WEEKLY_LIMIT,
      weeklyRemaining: WEEKLY_LIMIT,
      bonusCredits: 0,
      weekResetsAt,
      ...(studySetId ? { canGenerateThisSet: true } : {}),
    };
  }

  const availabilityStudySetId = studySetId ?? (await findAvailabilityProbeStudySetId(supabase, user.id));
  if (!availabilityStudySetId) {
    return {
      plan,
      weeklyUsed: 0,
      weeklyLimit: WEEKLY_LIMIT,
      weeklyRemaining: WEEKLY_LIMIT,
      bonusCredits: 0,
      weekResetsAt,
      ...(studySetId ? { canGenerateThisSet: true } : {}),
    };
  }

  const availability = await getGenerationQuotaAvailability({
    supabase,
    studySetId: availabilityStudySetId,
  });

  return mapAvailabilityToUsage(plan, availability, studySetId);
}
