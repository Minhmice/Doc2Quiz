"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { createRandomUuid } from "@/lib/ids/createRandomUuid";
import type { OcrRunResult } from "@/types/ocr";
import { requireBrowserUserId } from "./user";
import { toJson } from "./json";

type OcrResultRow = {
  id: string;
  engine: string | null;
  result: unknown;
  created_at: string;
  media_assets?: { id: string; study_set_id: string } | null;
};

function parseOcrRunResult(raw: unknown): OcrRunResult | undefined {
  if (raw === null || typeof raw !== "object") return undefined;
  const rec = raw as Record<string, unknown>;
  const version = rec["version"];
  const provider = rec["provider"];
  const savedAt = rec["savedAt"];
  const pages = rec["pages"];
  if (version !== 1 && version !== 2) return undefined;
  if (provider !== "openai" && provider !== "custom") return undefined;
  if (typeof savedAt !== "string" || savedAt.trim().length === 0) return undefined;
  if (!Array.isArray(pages)) return undefined;
  return raw as OcrRunResult;
}

/**
 * Persist OCR result as JSON in `ocr_results`, keyed by a synthetic attachment
 * `media_assets` row for the study set (storage upload is a follow-up).
 */
export async function putCloudOcrResult(
  studySetId: string,
  result: OcrRunResult,
): Promise<void> {
  // Keep this module buildable even if Supabase schema typing isn't fully wired.
  const supabase = createSupabaseBrowserClient() as any;
  const userId = await requireBrowserUserId();

  const assetId = createRandomUuid();
  const objectPath = `users/${userId}/study-sets/${studySetId}/ocr/${assetId}.json`;

  const { error: assetErr } = await supabase.from("media_assets").insert({
    user_id: userId,
    id: assetId,
    study_set_id: studySetId,
    kind: "attachment",
    bucket: "doc2quiz",
    object_path: objectPath,
    original_file_name: "ocr.json",
    mime_type: "application/json",
    byte_size: null,
    metadata: { kind: "ocr_json" },
  });
  if (assetErr) {
    throw assetErr;
  }

  const { error: ocrErr } = await supabase.from("ocr_results").insert({
    user_id: userId,
    asset_id: assetId,
    engine: result.provider,
    result: toJson(result),
  });
  if (ocrErr) {
    throw ocrErr;
  }
}

export async function getCloudOcrResult(
  studySetId: string,
): Promise<OcrRunResult | undefined> {
  const supabase = createSupabaseBrowserClient() as any;
  const { data, error } = await supabase
    .from("ocr_results")
    .select(
      `
        id,
        engine,
        result,
        created_at,
        media_assets:media_assets!inner (
          id,
          study_set_id
        )
      `,
    )
    .eq("media_assets.study_set_id", studySetId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return undefined;
  }
  const row = data as OcrResultRow;
  return parseOcrRunResult(row.result);
}

export async function deleteCloudOcrResult(studySetId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient() as any;
  const { data: ocr, error } = await supabase
    .from("ocr_results")
    .select(
      `
        id,
        media_assets:media_assets!inner (
          id,
          study_set_id
        )
      `,
    )
    .eq("media_assets.study_set_id", studySetId);
  if (error) {
    throw error;
  }
  const assetIds = (ocr ?? [])
    .map((r: { media_assets?: { id: string } | null }) => r.media_assets?.id)
    .filter((x: string | undefined): x is string => typeof x === "string");
  if (assetIds.length === 0) {
    return;
  }
  const { error: delOcrErr } = await supabase
    .from("ocr_results")
    .delete()
    .in("asset_id", assetIds);
  if (delOcrErr) {
    throw delOcrErr;
  }
  const { error: delAssetErr } = await supabase
    .from("media_assets")
    .delete()
    .in("id", assetIds);
  if (delAssetErr) {
    throw delAssetErr;
  }
}

