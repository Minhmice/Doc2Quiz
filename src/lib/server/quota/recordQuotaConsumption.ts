import type { User } from "@supabase/supabase-js";

import { resolveUserAiTier } from "@/lib/server/resolveUserAiTier";

import { WEEKLY_LIMIT } from "./quotaConstants";
import { getUserUsage } from "./getUserUsage";

type QuotaSupabase = { from: (table: string) => any };

export async function recordQuotaConsumption({
  supabase,
  user,
  studySetId,
  contentKind,
}: {
  supabase: QuotaSupabase;
  user: User;
  studySetId: string;
  contentKind: "quiz" | "flashcards";
}) {
  if (resolveUserAiTier(user) === "pro") return;

  const { data: existing, error: existingError } = await supabase
    .from("quota_consumptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("study_set_id", studySetId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return;

  const usage = await getUserUsage({ supabase, user });
  const usedBonus = usage.weeklyUsed >= WEEKLY_LIMIT;
  const { error: insertError } = await supabase.from("quota_consumptions").insert({
    user_id: user.id,
    study_set_id: studySetId,
    content_kind: contentKind,
    used_bonus: usedBonus,
  });
  if (insertError) throw new Error(insertError.message);

  if (!usedBonus) return;

  const { error: walletError } = await supabase
    .from("user_quota_wallet")
    .upsert({ user_id: user.id, bonus_credits: Math.max(0, usage.bonusCredits - 1), updated_at: new Date().toISOString() });
  if (walletError) throw new Error(walletError.message);
}
