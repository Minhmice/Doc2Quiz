import type { SupabaseClient } from "@supabase/supabase-js";

import type { CanonicalSourceUnit } from "@/types/canonicalSource";

export async function getCachedCanonicalUnits(
  supabase: SupabaseClient,
  userId: string,
  contentSha256: string,
  extractionSchemaVersion: number,
  modelFingerprint: string,
): Promise<CanonicalSourceUnit[] | null> {
  const { data, error } = await supabase
    .from("canonical_document_extractions")
    .select("units")
    .eq("user_id", userId)
    .eq("content_sha256", contentSha256)
    .eq("extraction_schema_version", extractionSchemaVersion)
    .eq("model_fingerprint", modelFingerprint)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  const raw = (data as { units: unknown }).units;
  if (!Array.isArray(raw)) {
    return null;
  }
  return raw as CanonicalSourceUnit[];
}

export async function upsertCanonicalUnitsCache(
  supabase: SupabaseClient,
  userId: string,
  contentSha256: string,
  extractionSchemaVersion: number,
  modelFingerprint: string,
  units: CanonicalSourceUnit[],
): Promise<void> {
  const { error } = await supabase.from("canonical_document_extractions").upsert(
    {
      user_id: userId,
      content_sha256: contentSha256,
      extraction_schema_version: extractionSchemaVersion,
      model_fingerprint: modelFingerprint,
      units,
    },
    {
      onConflict: "user_id,content_sha256,extraction_schema_version,model_fingerprint",
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}
