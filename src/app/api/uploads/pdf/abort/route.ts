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
  if (!readSession(o.session)) {
    return pdfUploadJson({ error: "session descriptor invalid" }, 400);
  }

  return pdfUploadJson({ uploadCapability, ok: true });
}
