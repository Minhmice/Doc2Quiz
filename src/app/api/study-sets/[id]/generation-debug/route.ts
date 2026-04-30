import { NextResponse } from "next/server";

import {
  EXTRACTION_SCHEMA_VERSION,
  GENERATION_SCHEMA_VERSION,
} from "@/lib/server/generateFromFile/canonicalConstants";
import { isDevEnginePanelEnabled } from "@/lib/server/ai-processing-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function deny(): NextResponse | null {
  if (process.env.NODE_ENV === "production" || !isDevEnginePanelEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}

/**
 * Developer-only: canonical extraction / generation diagnostics (no secrets).
 * Model id is never returned — only a fingerprint suitable for cache keys.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = deny();
  if (denied) {
    return denied;
  }

  const { id: studySetId } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: doc, error } = await supabase
    .from("study_set_documents")
    .select(
      "source_content_sha256,canonical_units,canonical_extraction_schema_version,canonical_model_fingerprint,generation_coverage,last_generation_seed,generation_schema_version",
    )
    .eq("study_set_id", studySetId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const row = doc as {
    source_content_sha256: string | null;
    canonical_units: unknown;
    canonical_extraction_schema_version: number | null;
    canonical_model_fingerprint: string | null;
    generation_coverage: unknown;
    last_generation_seed: number | null;
    generation_schema_version: number | null;
  };

  const units = Array.isArray(row.canonical_units) ? row.canonical_units : [];
  const fingerprint = row.canonical_model_fingerprint ?? "";

  const cov = row.generation_coverage as {
    itemsGenerated?: number;
    extractionCacheHit?: boolean;
    generationCacheHit?: boolean;
    coverageRatio?: number;
  } | null;

  const coverageRatio =
    cov && typeof cov.coverageRatio === "number" ? cov.coverageRatio : null;

  return NextResponse.json({
    studySetId,
    /** Same bytes as upload-derived hash used for canonical + generation cache keys. */
    contentSha256: row.source_content_sha256,
    canonicalUnitCount: units.length,
    extractionCacheHit:
      typeof cov?.extractionCacheHit === "boolean" ? cov.extractionCacheHit : null,
    generationCacheHit:
      typeof cov?.generationCacheHit === "boolean" ? cov.generationCacheHit : null,
    generatedItemCount:
      typeof cov?.itemsGenerated === "number" ? cov.itemsGenerated : null,
    coverageRatio,
    extractionSchemaVersion:
      row.canonical_extraction_schema_version ?? EXTRACTION_SCHEMA_VERSION,
    generationSchemaVersion:
      row.generation_schema_version ?? GENERATION_SCHEMA_VERSION,
    /** Never the raw upstream model id — SHA-256 fingerprint of resolved model id only. */
    modelFingerprint: fingerprint || null,
    generationSeed: row.last_generation_seed,
    /** Compile-time constants for the running build (compare to persisted row versions). */
    activeSchemaVersions: {
      extraction: EXTRACTION_SCHEMA_VERSION,
      generation: GENERATION_SCHEMA_VERSION,
    },
  });
}
