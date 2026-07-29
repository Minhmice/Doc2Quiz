/**
 * INPUT-VAL-01 contract — MIME allowlist and size limits aligned to docs/pipeline.md.
 */

export const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "image/jpeg",
  "image/png",
  "audio/wav",
  "audio/mpeg",
  "text/html",
  "text/csv",
  "application/json",
  "application/xml",
  "text/xml",
  "text/plain",
] as const;

export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

/** Minimum paste length — aligns with UI-SPEC "few lines" intent. */
export const MIN_PASTE_CHARS = 20;

export const YOUTUBE_HOST_ALLOWLIST = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
] as const;

/** [ASSUMED] Conservative per-format upload limits for Phase 2 enforcement. */
export const MAX_UPLOAD_BYTES_BY_MIME: Record<SupportedMimeType, number> = {
  "application/pdf": 50 * 1024 * 1024, // [ASSUMED] 50 MB
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    25 * 1024 * 1024, // [ASSUMED] 25 MB
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    25 * 1024 * 1024, // [ASSUMED] 25 MB
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    25 * 1024 * 1024, // [ASSUMED] 25 MB
  "application/vnd.ms-excel": 25 * 1024 * 1024, // [ASSUMED] 25 MB
  "image/jpeg": 15 * 1024 * 1024, // [ASSUMED] 15 MB
  "image/png": 15 * 1024 * 1024, // [ASSUMED] 15 MB
  "audio/wav": 100 * 1024 * 1024, // [ASSUMED] 100 MB
  "audio/mpeg": 100 * 1024 * 1024, // [ASSUMED] 100 MB
  "text/html": 10 * 1024 * 1024, // [ASSUMED] 10 MB
  "text/csv": 10 * 1024 * 1024, // [ASSUMED] 10 MB
  "application/json": 10 * 1024 * 1024, // [ASSUMED] 10 MB
  "application/xml": 10 * 1024 * 1024, // [ASSUMED] 10 MB
  "text/xml": 10 * 1024 * 1024, // [ASSUMED] 10 MB
  "text/plain": 10 * 1024 * 1024, // [ASSUMED] 10 MB
};

export type PasteInput = {
  kind: "paste";
  text: string;
};

export type YoutubeInput = {
  kind: "youtube";
  url: string;
};

export type FileInput = {
  kind: "file";
  mimeType: SupportedMimeType;
  sizeBytes: number;
};

export type FileRefInput = {
  kind: "file_ref";
  storagePath: string;
  mimeType: SupportedMimeType;
  filename: string;
  sizeBytes: number;
};

export type PipelineInput = PasteInput | YoutubeInput | FileInput;

export function isSupportedMimeType(mime: string): mime is SupportedMimeType {
  return (SUPPORTED_MIME_TYPES as readonly string[]).includes(mime);
}

export function formatBytesForError(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb % 1 === 0 ? mb : mb.toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    const kb = bytes / 1024;
    return `${kb % 1 === 0 ? kb : kb.toFixed(1)} KB`;
  }
  return `${bytes} bytes`;
}

/** Returns human-readable error or null when valid. */
export function validateFileUpload(
  mimeType: string,
  sizeBytes: number,
): string | null {
  if (!isSupportedMimeType(mimeType)) {
    return `Unsupported file type: ${mimeType}`;
  }
  const max = MAX_UPLOAD_BYTES_BY_MIME[mimeType];
  if (sizeBytes > max) {
    return `File exceeds the ${formatBytesForError(max)} limit for this file type.`;
  }
  return null;
}

/** Returns human-readable error or null when valid. */
export function validatePasteInput(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return "Paste at least a few lines of text before continuing.";
  }
  if (trimmed.length < MIN_PASTE_CHARS) {
    return `Paste at least ${MIN_PASTE_CHARS} characters before continuing.`;
  }
  return null;
}

/** Returns human-readable error or null when valid. */
export function validateYoutubeUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return "Enter a valid YouTube URL (youtube.com or youtu.be).";
  }

  if (parsed.protocol !== "https:") {
    return "YouTube URLs must use HTTPS.";
  }

  const host = parsed.hostname.toLowerCase();
  if (
    !(YOUTUBE_HOST_ALLOWLIST as readonly string[]).includes(host)
  ) {
    return "Enter a valid YouTube URL (youtube.com or youtu.be).";
  }

  return null;
}

/** Reject storage paths outside the owner's study-set prefix. */
export function validateStoragePath(
  storagePath: string,
  userId: string,
  studySetId: string,
): string | null {
  const expectedPrefix = `${userId}/${studySetId}/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    return "Invalid storage path for this study set.";
  }
  const remainder = storagePath.slice(expectedPrefix.length);
  if (!remainder || remainder.includes("..") || remainder.includes("/")) {
    return "Invalid storage path for this study set.";
  }
  return null;
}
