import { NextResponse } from "next/server";

import { AI_PROCESSING_UNAVAILABLE_MESSAGE } from "@/lib/ai/processingMessages";
import {
  getAiProcessingConfig,
  isAiProcessingConfigured,
} from "@/lib/server/ai-processing-config";
import {
  DEFAULT_GENERATION_TARGET_ITEMS,
  EXTRACTION_SCHEMA_VERSION,
  GENERATION_SCHEMA_VERSION,
} from "@/lib/server/generateFromFile/canonicalConstants";
import { computeGenerationOutputCacheKey } from "@/lib/server/generateFromFile/computeGenerationOutputCacheKey";
import {
  getCachedCanonicalUnits,
  upsertCanonicalUnitsCache,
} from "@/lib/server/generateFromFile/canonicalExtractionCache";
import { extractCanonicalSourceUnits } from "@/lib/server/generateFromFile/extractCanonicalSourceUnits";
import {
  getCachedGenerationOutput,
  upsertGenerationOutputCache,
} from "@/lib/server/generateFromFile/generationOutputCache";
import {
  persistFlashcardDraft,
  persistQuizDraft,
} from "@/lib/server/persistStudySetGeneratedDraft";
import { resolveStudySetContentSha256 } from "@/lib/server/generateFromFile/resolveContentSha256";
import { runGenerateItemsFromCanonicalUnits } from "@/lib/server/generateFromFile/runGenerateItemsFromCanonicalUnits";
import {
  validateStrictFlashcards,
  validateStrictQuizQuestions,
} from "@/lib/server/generateFromFile/validateStrictGenerated";
import { resolveUserAiTier } from "@/lib/server/resolveUserAiTier";
import { sha256Utf8HexSync } from "@/lib/server/sha256Hex";
import { pipelineLog } from "@/lib/logging/pipelineLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Question } from "@/types/question";
import type { CanonicalSourceUnit } from "@/types/canonicalSource";
import type { StudyContentKind } from "@/types/studySet";
import type { FlashcardVisionItem } from "@/types/visionParse";

type Body = {
  contentKind?: unknown;
  fileRef?: unknown;
  options?: {
    maxItems?: unknown;
    language?: unknown;
  };
};

function isContentKind(x: unknown): x is StudyContentKind {
  return x === "quiz" || x === "flashcards";
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: studySetId } = await ctx.params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAiProcessingConfigured()) {
    return NextResponse.json(
      { error: AI_PROCESSING_UNAVAILABLE_MESSAGE },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const contentKind = body.contentKind;
  const fileRef = typeof body.fileRef === "string" ? body.fileRef.trim() : "";
  if (!isContentKind(contentKind) || fileRef.length === 0) {
    return NextResponse.json(
      { error: "contentKind and fileRef are required." },
      { status: 400 },
    );
  }

  const maxItemsRaw = body.options?.maxItems;
  const maxItems =
    typeof maxItemsRaw === "number" &&
    Number.isFinite(maxItemsRaw) &&
    maxItemsRaw > 0
      ? Math.floor(maxItemsRaw)
      : undefined;

  const langRaw = body.options?.language;
  const language =
    langRaw === "vi" || langRaw === "en" || langRaw === "auto"
      ? langRaw
      : undefined;

  const effectiveTargetItems = maxItems ?? DEFAULT_GENERATION_TARGET_ITEMS;

  const { data: setRow, error: setErr } = await supabase
    .from("study_sets")
    .select("id,user_id,content_kind,source_file_name")
    .eq("id", studySetId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (setErr) {
    return NextResponse.json({ error: setErr.message }, { status: 500 });
  }
  if (!setRow) {
    return NextResponse.json({ error: "Study set not found." }, { status: 404 });
  }

  const rowKind = (setRow as { content_kind: StudyContentKind | null }).content_kind;
  if (rowKind !== contentKind) {
    return NextResponse.json(
      { error: "Study set content type does not match request." },
      { status: 409 },
    );
  }

  const { data: docRow, error: docErr } = await supabase
    .from("study_set_documents")
    .select("extracted_text,source_pdf_asset_id,source_file_name")
    .eq("study_set_id", studySetId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (docErr) {
    return NextResponse.json({ error: docErr.message }, { status: 500 });
  }
  if (!docRow) {
    return NextResponse.json({ error: "Document not found for study set." }, { status: 404 });
  }

  const sourcePdfId = (docRow as { source_pdf_asset_id: string | null }).source_pdf_asset_id;
  if (!sourcePdfId || sourcePdfId !== fileRef) {
    return NextResponse.json(
      { error: "fileRef does not match the stored document." },
      { status: 400 },
    );
  }

  const { data: mediaRow, error: mediaErr } = await supabase
    .from("media_assets")
    .select("id,bucket,object_path,sha256")
    .eq("id", fileRef)
    .eq("user_id", user.id)
    .eq("study_set_id", studySetId)
    .maybeSingle();

  if (mediaErr) {
    return NextResponse.json({ error: mediaErr.message }, { status: 500 });
  }
  if (!mediaRow) {
    return NextResponse.json({ error: "File reference not found." }, { status: 400 });
  }

  const extractedText = (
    docRow as { extracted_text: string | null; source_file_name: string | null }
  ).extracted_text;
  const docText = typeof extractedText === "string" ? extractedText : "";
  const sourceName =
    (setRow as { source_file_name: string | null }).source_file_name?.trim() ||
    (docRow as { source_file_name: string | null }).source_file_name?.trim() ||
    "document.pdf";

  if (docText.trim().length < 40) {
    return NextResponse.json(
      { error: AI_PROCESSING_UNAVAILABLE_MESSAGE },
      { status: 503 },
    );
  }

  const tier = resolveUserAiTier(user);
  let cfg;
  try {
    cfg = getAiProcessingConfig(tier);
  } catch {
    return NextResponse.json(
      { error: AI_PROCESSING_UNAVAILABLE_MESSAGE },
      { status: 503 },
    );
  }

  const modelFingerprint = sha256Utf8HexSync(cfg.model);

  const media = mediaRow as {
    bucket: string;
    object_path: string;
    sha256: string | null;
  };

  const { contentSha256 } = await resolveStudySetContentSha256({
    supabase,
    media,
    fallbackNormalizedText: docText.trim(),
  });

  const generationCacheKey = computeGenerationOutputCacheKey({
    contentSha256,
    contentKind,
    generationSchemaVersion: GENERATION_SCHEMA_VERSION,
    modelFingerprint,
    targetItemCount: effectiveTargetItems,
  });

  let extractionCacheHit = false;
  let generationCacheHit = false;

  const cachedGen = await getCachedGenerationOutput(supabase, user.id, generationCacheKey);

  let units: CanonicalSourceUnit[] | null = null;
  let questions: Question[] | undefined;
  let flashcards: FlashcardVisionItem[] | undefined;
  let warnings: string[] = [];
  let genMeta: {
    itemsCreated: number;
    lowConfidenceCount: number;
    coverage?: Record<string, unknown>;
    generationSeed?: number;
  };

  const cacheValid =
    cachedGen &&
    cachedGen.generationSchemaVersion === GENERATION_SCHEMA_VERSION &&
    (contentKind === "quiz"
      ? Boolean(cachedGen.questions?.length)
      : Boolean(cachedGen.flashcards?.length));

  if (cacheValid) {
    generationCacheHit = true;
    questions = cachedGen!.questions;
    flashcards = cachedGen!.flashcards;
    warnings = [...(cachedGen!.warnings ?? []), "Reused cached generation output."];
    genMeta = {
      itemsCreated:
        contentKind === "quiz"
          ? cachedGen!.questions!.length
          : cachedGen!.flashcards!.length,
      lowConfidenceCount: cachedGen!.lowConfidenceCount ?? 0,
      coverage: cachedGen!.coverage,
      generationSeed: cachedGen!.generationSeed,
    };
  } else {
    units = await getCachedCanonicalUnits(
      supabase,
      user.id,
      contentSha256,
      EXTRACTION_SCHEMA_VERSION,
      modelFingerprint,
    );

    extractionCacheHit = Boolean(units && units.length > 0);

    if (!units || units.length === 0) {
      const extracted = await extractCanonicalSourceUnits({
        documentText: docText,
        sourceFileLabel: sourceName,
        contentSha256,
        configUrl: cfg.url,
        apiKey: cfg.key,
        model: cfg.model,
      });

      if (!extracted.ok) {
        return NextResponse.json({ error: extracted.error }, { status: 503 });
      }
      units = extracted.units;
      extractionCacheHit = false;

      try {
        await upsertCanonicalUnitsCache(
          supabase,
          user.id,
          contentSha256,
          EXTRACTION_SCHEMA_VERSION,
          modelFingerprint,
          units,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Cache save failed.";
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    const gen = await runGenerateItemsFromCanonicalUnits({
      contentKind,
      units,
      contentSha256,
      sourceFileLabel: sourceName,
      configUrl: cfg.url,
      apiKey: cfg.key,
      model: cfg.model,
      maxItems,
      language,
    });

    if (!gen.ok) {
      return NextResponse.json({ error: gen.error }, { status: 503 });
    }

    warnings = [...gen.warnings];
    genMeta = {
      itemsCreated: gen.itemsCreated,
      lowConfidenceCount: gen.lowConfidenceCount,
      coverage: gen.coverage as Record<string, unknown>,
      generationSeed: gen.generationSeed,
    };

    if (contentKind === "quiz") {
      questions = gen.questions;
    } else {
      flashcards = gen.flashcards;
    }

    if (!extractionCacheHit) {
      warnings.push("Built canonical source map from this document.");
    } else {
      warnings.push("Reused cached canonical source map for this file.");
    }

    try {
      await upsertGenerationOutputCache(supabase, user.id, {
        cacheKey: generationCacheKey,
        generationSchemaVersion: GENERATION_SCHEMA_VERSION,
        contentKind,
        tier,
        modelFingerprint,
        payload: {
          generationSchemaVersion: GENERATION_SCHEMA_VERSION,
          ...(contentKind === "quiz" ? { questions } : { flashcards }),
          coverage: genMeta.coverage,
          warnings: gen.warnings,
          lowConfidenceCount: gen.lowConfidenceCount,
          generationSeed: gen.generationSeed,
        },
      });
    } catch (e) {
      pipelineLog("STUDY_SET", "generation-cache", "warn", "cache upsert failed", {
        studySetId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (generationCacheHit && (!units || units.length === 0)) {
    units = await getCachedCanonicalUnits(
      supabase,
      user.id,
      contentSha256,
      EXTRACTION_SCHEMA_VERSION,
      modelFingerprint,
    );
    extractionCacheHit = Boolean(units?.length);
  }

  const qList = questions ?? [];
  const fList = flashcards ?? [];

  if (contentKind === "quiz") {
    const v = validateStrictQuizQuestions(qList);
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: 503 });
    }
  } else {
    const v = validateStrictFlashcards(fList);
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: 503 });
    }
  }

  const itemsCreated =
    contentKind === "quiz" ? qList.length : fList.length;

  if (itemsCreated === 0) {
    warnings.push("No study items were produced.");
    return NextResponse.json({
      ok: false,
      studySetId,
      contentKind,
      schemaVersion: GENERATION_SCHEMA_VERSION,
      itemsCreated: 0,
      lowConfidenceCount: 0,
      warnings,
    });
  }

  try {
    if (contentKind === "quiz" && qList.length) {
      await persistQuizDraft(supabase, user.id, studySetId, qList);
    } else if (contentKind === "flashcards" && fList.length) {
      await persistFlashcardDraft(supabase, user.id, studySetId, fList);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const now = new Date().toISOString();

  const coverageRatio =
    genMeta.coverage &&
    typeof (genMeta.coverage as { coverageRatio?: unknown }).coverageRatio === "number"
      ? (genMeta.coverage as { coverageRatio: number }).coverageRatio
      : null;

  const generationCoveragePayload = {
    ...(genMeta.coverage ?? {}),
    itemsGenerated: genMeta.itemsCreated,
    extractionCacheHit,
    generationCacheHit,
    coverageRatio,
    lowConfidenceCount: genMeta.lowConfidenceCount,
  };

  const { error: docUpErr } = await supabase
    .from("study_set_documents")
    .update({
      source_content_sha256: contentSha256,
      canonical_units: units ?? null,
      canonical_extraction_schema_version: EXTRACTION_SCHEMA_VERSION,
      canonical_model_fingerprint: modelFingerprint,
      generation_coverage: generationCoveragePayload,
      last_generation_seed: genMeta.generationSeed ?? null,
      generation_schema_version: GENERATION_SCHEMA_VERSION,
      updated_at: now,
    })
    .eq("study_set_id", studySetId)
    .eq("user_id", user.id);

  if (docUpErr) {
    pipelineLog("STUDY_SET", "canonical-gen", "warn", "study_set_documents metadata update failed", {
      studySetId,
      message: docUpErr.message,
    });
  }

  await supabase
    .from("study_sets")
    .update({ status: "draft", updated_at: now })
    .eq("id", studySetId)
    .eq("user_id", user.id);

  return NextResponse.json({
    ok: true,
    studySetId,
    contentKind,
    schemaVersion: GENERATION_SCHEMA_VERSION,
    itemsCreated,
    lowConfidenceCount: genMeta.lowConfidenceCount,
    warnings,
  });
}
