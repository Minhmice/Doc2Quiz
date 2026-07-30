import type { User } from "@supabase/supabase-js";

import { resolveUserAiTier } from "@/lib/server/resolveUserAiTier";

import {
  GenerationInProgressError,
  getGenerationQuotaAvailability,
} from "./generationQuotaReservation";
import { QuotaExceededError } from "./QuotaExceededError";

type QuotaSupabase = {
  rpc: (
    functionName: string,
    args: Record<string, string>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

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

  const availability = await getGenerationQuotaAvailability({ supabase, studySetId });

  if (availability.status === "generation_in_progress") {
    throw new GenerationInProgressError(availability.reservationExpiresAt ?? "");
  }

  if (availability.canGenerate) return;

  throw new QuotaExceededError({
    weeklyUsed: availability.weeklyUsed,
    weeklyLimit: availability.weeklyLimit,
    bonusCredits: availability.bonusCredits,
    weekResetsAt: availability.weekResetsAt,
  });
}
