import { createRandomUuid } from "@/lib/ids/createRandomUuid";
import {
  normalizeUnknownError,
  pipelineLog,
} from "@/lib/logging/pipelineLogger";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { OcrRunResult } from "@/types/ocr";

const STORAGE_BUCKET = "doc2quiz";

/** Store OCR result for a study set. */
export async function putOcrResult(
  studySetId: string,
  result: OcrRunResult,
): Promise<void> {
  pipelineLog("IDB", "ocr-put", "info", "putOcrResult start", {
    studySetId,
    pageRows: result.pages.length,
    version: result.version,
  });
  try {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      throw new Error("Not authenticated");
    }

    const { data: docRow, error: docErr } = await supabase
      .from("study_set_documents")
      .select("id")
      .eq("user_id", user.id)
      .eq("study_set_id", studySetId)
      .maybeSingle();
    if (docErr) {
      throw docErr;
    }
    const documentId = (docRow as { id: string } | null)?.id ?? null;

    const { data: existingAssets, error: listErr } = await supabase
      .from("media_assets")
      .select("id,bucket,object_path,metadata")
      .eq("user_id", user.id)
      .eq("study_set_id", studySetId)
      .eq("kind", "attachment");
    if (listErr) {
      throw listErr;
    }
    const prev = ((existingAssets ?? []) as { id: string; bucket: string; object_path: string; metadata: unknown }[]).filter(
      (a) => {
        const m = a.metadata as { role?: string } | null | undefined;
        return m?.role === "ocr_run";
      },
    );
    for (const p of prev) {
      await supabase.from("ocr_results").delete().eq("user_id", user.id).eq("asset_id", p.id);
      await supabase.storage.from(p.bucket).remove([p.object_path]);
      await supabase.from("media_assets").delete().eq("user_id", user.id).eq("id", p.id);
    }

    const bytes = new TextEncoder().encode(JSON.stringify(result));
    const objectPath = `${user.id}/${studySetId}/ocr/result.json`;

    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(objectPath, bytes, {
        upsert: true,
        contentType: "application/json",
      });
    if (upErr) {
      throw upErr;
    }

    const assetId = createRandomUuid();
    const { error: insAssetErr } = await supabase.from("media_assets").insert({
      id: assetId,
      user_id: user.id,
      study_set_id: studySetId,
      document_id: documentId,
      kind: "attachment",
      bucket: STORAGE_BUCKET,
      object_path: objectPath,
      mime_type: "application/json",
      byte_size: bytes.byteLength,
      page_number: null,
      metadata: { role: "ocr_run" },
    });
    if (insAssetErr) {
      throw insAssetErr;
    }

    const { error: insOcrErr } = await supabase.from("ocr_results").insert({
      id: createRandomUuid(),
      user_id: user.id,
      asset_id: assetId,
      engine: result.provider,
      result: result as unknown as Record<string, unknown>,
    });
    if (insOcrErr) {
      throw insOcrErr;
    }

    pipelineLog("IDB", "ocr-put", "info", "putOcrResult success", {
      studySetId,
    });
  } catch (raw) {
    pipelineLog("IDB", "ocr-put", "error", "putOcrResult failed", {
      studySetId,
      ...normalizeUnknownError(raw),
      raw,
    });
    throw raw;
  }
}

/** Retrieve OCR result for a study set, or undefined if not yet run. */
export async function getOcrResult(
  studySetId: string,
): Promise<OcrRunResult | undefined> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return undefined;
  }

  const { data: assets, error: aErr } = await supabase
    .from("media_assets")
    .select("id,bucket,object_path,metadata")
    .eq("user_id", user.id)
    .eq("study_set_id", studySetId)
    .eq("kind", "attachment");
  if (aErr || !assets) {
    return undefined;
  }

  const match = (
    assets as { id: string; bucket: string; object_path: string; metadata: unknown }[]
  ).find((a) => {
    const m = a.metadata as { role?: string } | null | undefined;
    return m?.role === "ocr_run";
  });
  if (!match) {
    return undefined;
  }

  const row = match;
  const { data: file, error: dErr } = await supabase.storage
    .from(row.bucket)
    .download(row.object_path);
  if (dErr || !file) {
    return undefined;
  }
  const text = await file.text();
  try {
    return JSON.parse(text) as OcrRunResult;
  } catch {
    return undefined;
  }
}

/** Delete OCR result for a study set. */
export async function deleteOcrResult(studySetId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return;
  }

  const { data: assets, error: aErr } = await supabase
    .from("media_assets")
    .select("id,bucket,object_path,metadata")
    .eq("user_id", user.id)
    .eq("study_set_id", studySetId)
    .eq("kind", "attachment");
  if (aErr || !assets) {
    return;
  }

  const targets = (assets as { id: string; bucket: string; object_path: string; metadata: unknown }[]).filter(
    (a) => {
      const m = a.metadata as { role?: string } | null | undefined;
      return m?.role === "ocr_run";
    },
  );

  for (const t of targets) {
    await supabase.from("ocr_results").delete().eq("user_id", user.id).eq("asset_id", t.id);
    await supabase.storage.from(t.bucket).remove([t.object_path]);
    await supabase.from("media_assets").delete().eq("user_id", user.id).eq("id", t.id);
  }
}
