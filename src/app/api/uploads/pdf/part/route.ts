import {
  PDF_UPLOAD_DEFAULT_PART_SIZE_BYTES,
  PDF_UPLOAD_MAX_BYTES,
} from "@/lib/uploads/pdfUploadContracts";
import { getPdfUploadServerCapability } from "@/lib/uploads/pdfUploadServerCapability";
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
  if (
    typeof o.partNumber !== "number" ||
    typeof o.byteStart !== "number" ||
    typeof o.byteEndInclusive !== "number"
  ) {
    return pdfUploadJson(
      { error: "partNumber, byteStart, byteEndInclusive required" },
      400,
    );
  }

  const partNumber = o.partNumber;
  const byteStart = o.byteStart;
  const byteEndInclusive = o.byteEndInclusive;

  if (
    !Number.isInteger(partNumber) ||
    partNumber < 1 ||
    !Number.isInteger(byteStart) ||
    !Number.isInteger(byteEndInclusive) ||
    byteStart < 0 ||
    byteEndInclusive < byteStart
  ) {
    return pdfUploadJson({ error: "Invalid part range" }, 400);
  }

  if (session.sizeBytes < 1 || session.sizeBytes > PDF_UPLOAD_MAX_BYTES) {
    return pdfUploadJson({ error: "Invalid session.sizeBytes" }, 400);
  }

  if (byteEndInclusive >= session.sizeBytes) {
    return pdfUploadJson({ error: "byte range exceeds declared sizeBytes" }, 400);
  }

  const partSizeBytes = PDF_UPLOAD_DEFAULT_PART_SIZE_BYTES;
  const expectedIndex = Math.floor(byteStart / partSizeBytes) + 1;
  if (partNumber !== expectedIndex) {
    return pdfUploadJson(
      { error: "partNumber does not align with byteStart and part size" },
      400,
    );
  }

  if (uploadCapability.mode === "local-only") {
    return pdfUploadJson({ uploadCapability });
  }

  return pdfUploadJson(
    {
      uploadCapability,
      error: "Presigned part URLs are not implemented for this deployment",
    },
    503,
  );
}
