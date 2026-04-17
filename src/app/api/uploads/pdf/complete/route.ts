import {
  isPdfUploadContentTypeAllowed,
  isPdfUploadObjectKeyAllowed,
} from "@/lib/uploads/pdfUploadContracts";
import { verifyPdfUploadFinalizeToken } from "@/lib/uploads/pdfUploadFinalizeToken";
import {
  getPdfUploadFinalizeSecret,
  getPdfUploadServerCapability,
} from "@/lib/uploads/pdfUploadServerCapability";
import type { PdfUploadSessionDescriptor } from "@/types/uploads";

import { pdfUploadJson } from "../_shared";

function readSession(raw: unknown): PdfUploadSessionDescriptor | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  if (
    typeof o.uploadId !== "string" ||
    typeof o.key !== "string" ||
    typeof o.sizeBytes !== "number" ||
    typeof o.contentType !== "string" ||
    typeof o.expiresAt !== "string" ||
    (o.protocol !== "multipart" && o.protocol !== "resumable")
  ) {
    return null;
  }
  return {
    uploadId: o.uploadId,
    key: o.key,
    sizeBytes: o.sizeBytes,
    contentType: o.contentType,
    expiresAt: o.expiresAt,
    protocol: o.protocol,
  };
}

function readParts(raw: unknown): { ok: true; parts: { partNumber: number; etag?: string }[] } | { ok: false } {
  if (!Array.isArray(raw)) {
    return { ok: false };
  }
  const parts: { partNumber: number; etag?: string }[] = [];
  for (const p of raw) {
    if (typeof p !== "object" || p === null) {
      return { ok: false };
    }
    const o = p as Record<string, unknown>;
    if (typeof o.partNumber !== "number" || !Number.isInteger(o.partNumber)) {
      return { ok: false };
    }
    if (o.etag !== undefined && typeof o.etag !== "string") {
      return { ok: false };
    }
    parts.push({
      partNumber: o.partNumber,
      ...(typeof o.etag === "string" ? { etag: o.etag } : {}),
    });
  }
  return { ok: true, parts };
}

export async function POST(req: Request) {
  const uploadCapability = getPdfUploadServerCapability();

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return pdfUploadJson({ error: "Invalid JSON" }, 400);
  }

  if (typeof parsed !== "object" || parsed === null) {
    return pdfUploadJson({ error: "Invalid body" }, 400);
  }
  const o = parsed as Record<string, unknown>;
  const session = readSession(o.session);
  if (!session) {
    return pdfUploadJson({ error: "session descriptor invalid" }, 400);
  }
  if (typeof o.finalizeToken !== "string" || !o.finalizeToken.trim()) {
    return pdfUploadJson({ error: "finalizeToken required" }, 400);
  }
  const partsResult = readParts(o.parts);
  if (!partsResult.ok) {
    return pdfUploadJson({ error: "parts must be an array of { partNumber }" }, 400);
  }

  if (uploadCapability.mode === "local-only") {
    return pdfUploadJson({
      uploadCapability,
      finalized: false,
    });
  }

  const secret = getPdfUploadFinalizeSecret();
  if (!secret) {
    console.error(
      "[pdf-upload/complete] finalize secret missing while direct-upload is enabled",
    );
    return pdfUploadJson(
      { error: "Upload finalize secret is not configured" },
      500,
    );
  }

  const verified = verifyPdfUploadFinalizeToken(o.finalizeToken.trim(), secret);
  if (!verified.ok) {
    return pdfUploadJson(
      {
        error: "Invalid finalize token",
        userMessage: "Upload session is invalid or expired. Try again.",
      },
      400,
    );
  }

  const payload = verified.payload;
  const expMs = Date.parse(payload.expiresAt);
  if (!Number.isFinite(expMs) || Date.now() > expMs) {
    console.warn("[pdf-upload/complete] finalize rejected: session expired");
    return pdfUploadJson(
      {
        error: "Upload session expired",
        userMessage: "Upload session expired. Start again.",
      },
      400,
    );
  }

  if (
    payload.uploadId !== session.uploadId ||
    payload.key !== session.key ||
    payload.sizeBytes !== session.sizeBytes ||
    payload.contentType !== session.contentType ||
    payload.expiresAt !== session.expiresAt
  ) {
    console.warn("[pdf-upload/complete] finalize rejected: session/token mismatch");
    return pdfUploadJson(
      {
        error: "Session does not match finalize token",
        userMessage: "Upload could not be verified. Try again.",
      },
      400,
    );
  }

  if (!isPdfUploadObjectKeyAllowed(session.key)) {
    console.warn("[pdf-upload/complete] finalize rejected: key not allowed");
    return pdfUploadJson(
      {
        error: "Object key is not allowed",
        userMessage: "Upload could not be completed. Try again.",
      },
      400,
    );
  }

  if (!isPdfUploadContentTypeAllowed(session.contentType)) {
    return pdfUploadJson(
      {
        error: "Content type not allowed",
        userMessage: "Only PDF uploads are supported.",
      },
      400,
    );
  }

  if (partsResult.parts.length === 0) {
    return pdfUploadJson(
      {
        error: "At least one uploaded part is required to finalize",
        userMessage: "Upload did not finish. Try again.",
      },
      400,
    );
  }

  // Adapter not implemented: validations passed but do not claim finalize success.
  return pdfUploadJson({
    uploadCapability,
    finalized: false,
    userMessage:
      "Object storage finalize is not available yet for this deployment.",
  });
}
