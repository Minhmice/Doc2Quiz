import type { SupabaseClient } from "@supabase/supabase-js";

import { sha256BufferHexSync, sha256Utf8HexSync } from "@/lib/server/sha256Hex";

/**
 * Prefer SHA-256 of PDF bytes (storage); fall back to normalized extracted text fingerprint.
 */
export async function resolveStudySetContentSha256(input: {
  supabase: SupabaseClient;
  media: {
    bucket: string;
    object_path: string;
    sha256: string | null;
  };
  fallbackNormalizedText: string;
}): Promise<{ contentSha256: string; fromPdfBytes: boolean }> {
  const trimmed = input.media.sha256?.trim();
  if (trimmed && trimmed.length > 0) {
    return { contentSha256: trimmed, fromPdfBytes: true };
  }

  const { data, error } = await input.supabase.storage
    .from(input.media.bucket)
    .download(input.media.object_path);

  if (!error && data) {
    const buf = await data.arrayBuffer();
    return {
      contentSha256: sha256BufferHexSync(buf),
      fromPdfBytes: true,
    };
  }

  const text = input.fallbackNormalizedText.trim();
  return {
    contentSha256: sha256Utf8HexSync(`doc2quiz:text:${text}`),
    fromPdfBytes: false,
  };
}
