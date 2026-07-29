import type { User } from "@supabase/supabase-js";

import { resolveUserAiTier } from "@/lib/server/resolveUserAiTier";

import { QuotaExceededError } from "./QuotaExceededError";
import { getUserUsage } from "./getUserUsage";

type QuotaSupabase = { from: (table: string) => any };

export async function assertGenerationQuota({
  supabase,
  user,
  studySetId,
}: {
  supabase: QuotaSupabase;
  user: User;
  studySetId: string;
}) {
  if (resolveUserAiTier(user) === "pro") return;

  const usage = await getUserUsage({ supabase, user, studySetId });
  if (usage.canGenerateThisSet) return;

  throw new QuotaExceededError({
    weeklyUsed: usage.weeklyUsed,
    weeklyLimit: usage.weeklyLimit,
    bonusCredits: usage.bonusCredits,
    weekResetsAt: usage.weekResetsAt,
  });
}
