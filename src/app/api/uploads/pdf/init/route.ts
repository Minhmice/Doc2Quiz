import { randomUUID } from "node:crypto";

import {
  buildPdfUploadObjectKey,
  computePdfUploadExpiresAtIso,
  defaultPdfUploadProtocolHint,
  isPdfUploadContentTypeAllowed,
  PDF_UPLOAD_DEFAULT_PART_SIZE_BYTES,
  PDF_UPLOAD_MAX_BYTES,
} from "@/lib/uploads/pdfUploadContracts";
import { signPdfUploadFinalizeToken } from "@/lib/uploads/pdfUploadFinalizeToken";
import {
  getPdfUploadFinalizeSecret,
  getPdfUploadServerCapability,
} from "@/lib/uploads/pdfUploadServerCapability";
import type {
  PdfUploadInitRequest,
  PdfUploadSessionDescriptor,
} from "@/types/uploads";

import { pdfUploadJson } from "../_shared";

function readInitBody(raw: unknown): PdfUploadInitRequest | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.contentType !== "string" || typeof o.sizeBytes !== "number") {
    return null;
  }
  if (
    o.suggestedSuffix !== undefined &&
    typeof o.suggestedSuffix !== "string"
  ) {
    return null;
  }
  return {
    contentType: o.contentType,
    sizeBytes: o.sizeBytes,
    ...(typeof o.suggestedSuffix === "string"
      ? { suggestedSuffix: o.suggestedSuffix }
      : {}),
  };
}

export async function POST(req: Request) {
  const uploadCapability = getPdfUploadServerCapability();

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return pdfUploadJson({ error: "Invalid JSON" }, 400);
  }

  const body = readInitBody(parsed);
  if (!body) {
    return pdfUploadJson(
      { error: "contentType (string) and sizeBytes (number) required" },
      400,
    );
  }

  const sizeBytes = body.sizeBytes;
  if (
    !Number.isInteger(sizeBytes) ||
    sizeBytes < 1 ||
    sizeBytes > PDF_UPLOAD_MAX_BYTES
  ) {
    return pdfUploadJson(
      {
        error: `sizeBytes must be an integer from 1 to ${PDF_UPLOAD_MAX_BYTES}`,
      },
      400,
    );
  }

  if (!isPdfUploadContentTypeAllowed(body.contentType)) {
    return pdfUploadJson({ error: "Only application/pdf is allowed" }, 400);
  }

  if (uploadCapability.mode === "local-only") {
    return pdfUploadJson({ uploadCapability });
  }

  const secret = getPdfUploadFinalizeSecret();
  if (!secret) {
    console.error(
      "[pdf-upload/init] D2Q_PDF_UPLOAD_FINALIZE_SECRET missing while direct-upload is enabled",
    );
    return pdfUploadJson(
      { error: "Upload finalize secret is not configured" },
      500,
    );
  }

  const uploadId = randomUUID();
  const key = buildPdfUploadObjectKey(
    uploadId,
    body.suggestedSuffix ?? "pdf",
  );
  const expiresAt = computePdfUploadExpiresAtIso();
  const protocol = defaultPdfUploadProtocolHint();

  const session: PdfUploadSessionDescriptor = {
    uploadId,
    key,
    sizeBytes,
    contentType: body.contentType.trim(),
    expiresAt,
    protocol,
  };

  const finalizeToken = signPdfUploadFinalizeToken(
    {
      v: 1,
      uploadId,
      key,
      sizeBytes,
      contentType: session.contentType,
      expiresAt,
    },
    secret,
  );

  const partSizeBytes = PDF_UPLOAD_DEFAULT_PART_SIZE_BYTES;
  const totalParts = Math.max(1, Math.ceil(sizeBytes / partSizeBytes));

  return pdfUploadJson({
    uploadCapability,
    session,
    finalizeToken,
    multipart: { partSizeBytes, totalParts },
  });
}
