import type { SupabaseClient } from "@supabase/supabase-js";

import type { UserAiTier } from "@/lib/server/ai-processing-config";
import type { StudyContentKind } from "@/types/studySet";
import type { Question } from "@/types/question";
import type { FlashcardVisionItem } from "@/types/visionParse";

/** Stored in `generation_output_cache.payload` JSONB. */
export type CachedGenerationPayload = {
  generationSchemaVersion: number;
  questions?: Question[];
  flashcards?: FlashcardVisionItem[];
  coverage?: Record<string, unknown>;
  warnings?: string[];
  lowConfidenceCount?: number;
  generationSeed?: number;
};

export async function getCachedGenerationOutput(
  supabase: SupabaseClient,
  userId: string,
  cacheKey: string,
): Promise<CachedGenerationPayload | null> {
  const { data, error } = await supabase
    .from("generation_output_cache")
    .select("payload")
    .eq("user_id", userId)
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  const raw = (data as { payload: unknown }).payload;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  return raw as CachedGenerationPayload;
}

export async function upsertGenerationOutputCache(
  supabase: SupabaseClient,
  userId: string,
  args: {
    cacheKey: string;
    generationSchemaVersion: number;
    contentKind: StudyContentKind;
    tier: UserAiTier;
    modelFingerprint: string;
    payload: CachedGenerationPayload;
  },
): Promise<void> {
  const { error } = await supabase.from("generation_output_cache").upsert(
    {
      user_id: userId,
      cache_key: args.cacheKey,
      generation_schema_version: args.generationSchemaVersion,
      content_kind: args.contentKind,
      tier: args.tier,
      model_fingerprint: args.modelFingerprint,
      payload: args.payload,
    },
    { onConflict: "user_id,cache_key" },
  );
  if (error) {
    throw new Error(error.message);
  }
}
