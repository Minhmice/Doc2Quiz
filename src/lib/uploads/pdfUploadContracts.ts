import { MAX_PDF_BYTES } from "@/lib/pdf/validatePdfFile";
import type { PdfUploadProtocolKind } from "@/types/uploads";

/** Single prefix for all PDF upload object keys (server-enforced allowlist). */
export const PDF_UPLOAD_OBJECT_KEY_PREFIX = "uploads/pdf/" as const;

export const PDF_UPLOAD_ALLOWED_CONTENT_TYPES = [
  "application/pdf",
] as const;

/** Default multipart part size for protocol hints (adapter may adjust). */
export const PDF_UPLOAD_DEFAULT_PART_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Short TTL for upload sessions / presign windows (D-05): 18h within “hours…~1 day”.
 */
export const PDF_UPLOAD_SESSION_TTL_MS = 18 * 60 * 60 * 1000;

export const PDF_UPLOAD_MAX_BYTES = MAX_PDF_BYTES;

export function isPdfUploadContentTypeAllowed(contentType: string): boolean {
  const t = contentType.trim().toLowerCase();
  return (PDF_UPLOAD_ALLOWED_CONTENT_TYPES as readonly string[]).includes(t);
}

export function isPdfUploadObjectKeyAllowed(key: string): boolean {
  return (
    key.startsWith(PDF_UPLOAD_OBJECT_KEY_PREFIX) &&
    !key.includes("..") &&
    !key.includes("\\")
  );
}

export function computePdfUploadExpiresAtIso(fromMs: number = Date.now()): string {
  return new Date(fromMs + PDF_UPLOAD_SESSION_TTL_MS).toISOString();
}

/**
 * Sanitized suffix for `key = {prefix}{uploadId}-{suffix}.pdf` (D-03).
 * Strips path separators / control chars; never returns the raw filename unchanged as a path.
 */
export function sanitizePdfUploadSuffix(raw: string | undefined): string {
  if (raw === undefined) {
    return "pdf";
  }
  let s = raw.replace(/[\u0000-\u001f\u007f\\/]/g, "").trim();
  s = s.replace(/[^a-zA-Z0-9._-]+/g, "-");
  s = s.replace(/^-+|-+$/g, "").toLowerCase();
  if (s.length > 48) {
    s = s.slice(0, 48);
  }
  if (!s) {
    return "pdf";
  }
  return s;
}

export function buildPdfUploadObjectKey(
  uploadId: string,
  sanitizedSuffix: string,
): string {
  const suf = sanitizePdfUploadSuffix(sanitizedSuffix);
  return `${PDF_UPLOAD_OBJECT_KEY_PREFIX}${uploadId}-${suf}.pdf`;
}

export type PdfUploadFinalizeTokenPayloadV1 = {
  v: 1;
  uploadId: string;
  key: string;
  sizeBytes: number;
  contentType: string;
  expiresAt: string;
};

export function stableSerializeFinalizePayload(
  p: PdfUploadFinalizeTokenPayloadV1,
): string {
  const ordered: Record<string, unknown> = {
    v: p.v,
    contentType: p.contentType,
    expiresAt: p.expiresAt,
    key: p.key,
    sizeBytes: p.sizeBytes,
    uploadId: p.uploadId,
  };
  return JSON.stringify(ordered);
}

/** Default protocol hint until an adapter selects resumable vs multipart. */
export function defaultPdfUploadProtocolHint(): PdfUploadProtocolKind {
  return "multipart";
}
