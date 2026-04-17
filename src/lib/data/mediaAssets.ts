"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { createRandomUuid } from "@/lib/ids/createRandomUuid";
import { requireBrowserUserId } from "./user";

type MediaAssetRow = {
  id: string;
  bucket: string;
  object_path: string;
  mime_type: string | null;
};

const DEFAULT_BUCKET = "doc2quiz";

export async function createCloudMediaAssetForBlob(input: {
  studySetId: string;
  blob: Blob;
  kind?: "page_image" | "attachment";
  originalFileName?: string;
  pageNumber?: number;
}): Promise<{ mediaId: string }> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireBrowserUserId();
  const mediaId = createRandomUuid();
  const objectPath = `users/${userId}/study-sets/${input.studySetId}/media/${mediaId}`;

  const { error } = await supabase.from("media_assets").insert({
    user_id: userId,
    id: mediaId,
    study_set_id: input.studySetId,
    kind: input.kind ?? "attachment",
    bucket: DEFAULT_BUCKET,
    object_path: objectPath,
    original_file_name: input.originalFileName ?? null,
    mime_type: input.blob.type || null,
    byte_size: input.blob.size ?? null,
    page_number: input.pageNumber ?? null,
    metadata: {},
  });
  if (error) {
    throw error;
  }

  // Storage upload is intentionally stubbed for now (separate migration todo).
  return { mediaId };
}

export async function getCloudMediaBlob(mediaId: string): Promise<Blob | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("media_assets")
    .select("id, bucket, object_path, mime_type")
    .eq("id", mediaId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  const row = data as MediaAssetRow;

  const { data: blob, error: dlErr } = await supabase.storage
    .from(row.bucket)
    .download(row.object_path);

  if (dlErr) {
    // Storage may not be wired up yet; keep UI resilient.
    return null;
  }

  // Preserve mime type when Supabase returns a generic blob.
  const mime = row.mime_type || blob.type;
  return mime && mime !== blob.type ? new Blob([blob], { type: mime }) : blob;
}

export async function deleteCloudMedia(mediaId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("media_assets").delete().eq("id", mediaId);
  if (error) {
    throw error;
  }
  // Storage delete is intentionally deferred.
}

