import type { User } from "@supabase/supabase-js";

import { resolveUserAiTier } from "@/lib/server/resolveUserAiTier";

import { WEEKLY_LIMIT } from "./quotaConstants";
import { getQuotaWeekResetsAtIct, getQuotaWeekStartIct } from "./quotaWeek";

type QuotaSupabase = {
  from: (table: string) => any;
};

type UsageArgs = {
  supabase: QuotaSupabase;
  user: User;
  studySetId?: string;
};

export async function getUserUsage({ supabase, user, studySetId }: UsageArgs) {
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

  const weekStart = getQuotaWeekStartIct().toISOString();
  const { count, error: countError } = await supabase
    .from("quota_consumptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("consumed_at", weekStart);
  if (countError) throw new Error(countError.message);

  const { data: wallet, error: walletError } = await supabase
    .from("user_quota_wallet")
    .select("bonus_credits")
    .eq("user_id", user.id)
    .maybeSingle();
  if (walletError) throw new Error(walletError.message);

  const weeklyUsed = count ?? 0;
  const bonusCredits = wallet?.bonus_credits ?? 0;
  const usage = {
    plan,
    weeklyUsed,
    weeklyLimit: WEEKLY_LIMIT,
    weeklyRemaining: Math.max(0, WEEKLY_LIMIT - weeklyUsed),
    bonusCredits,
    weekResetsAt,
  };

  if (!studySetId) return usage;

  const { data: existing, error: existingError } = await supabase
    .from("quota_consumptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("study_set_id", studySetId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  return {
    ...usage,
    canGenerateThisSet: Boolean(existing) || weeklyUsed < WEEKLY_LIMIT || bonusCredits > 0,
  };
}
