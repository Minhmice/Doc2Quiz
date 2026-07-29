import type { User } from "@supabase/supabase-js";

import { resolveUserAiTier } from "@/lib/server/resolveUserAiTier";

type QuotaSupabase = { rpc?: unknown; from?: unknown };

/**
 * Retired direct quota-table writes. Plan 08-06 routes commit reservations via
 * `commitGenerationQuota` after successful pipeline work.
 */
export async function recordQuotaConsumption({
  user,
}: {
  supabase: QuotaSupabase;
  user: User;
  studySetId: string;
  contentKind: "quiz" | "flashcards";
}) {
  if (resolveUserAiTier(user) === "pro") return;
}
