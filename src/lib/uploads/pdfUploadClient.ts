import type {
  PdfUploadAbortRequest,
  PdfUploadAbortResponse,
  PdfUploadCapability,
  PdfUploadCompleteRequest,
  PdfUploadCompleteResponse,
  PdfUploadInitResponse,
  PdfUploadPartRequest,
  PdfUploadPartResponse,
} from "@/types/uploads";

function isLocalCapability(cap: PdfUploadCapability): boolean {
  return cap.mode === "local-only";
}

async function postPdfUploadJson<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error("Invalid JSON from upload route");
  }
  if (!res.ok) {
    const msg =
      typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Upload request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

/**
 * `true` when the server reports local-only mode — not an error (D-01).
 */
export function isPdfUploadLocalOnlyCapability(cap: PdfUploadCapability): boolean {
  return isLocalCapability(cap);
}

export async function initPdfUpload(args: {
  file: File;
  suggestedSuffix?: string;
}): Promise<PdfUploadInitResponse> {
  const contentType =
    args.file.type && args.file.type.length > 0
      ? args.file.type
      : "application/pdf";
  const body = {
    contentType,
    sizeBytes: args.file.size,
    ...(args.suggestedSuffix !== undefined
      ? { suggestedSuffix: args.suggestedSuffix }
      : {}),
  };
  return postPdfUploadJson<PdfUploadInitResponse>("/api/uploads/pdf/init", body);
}

export async function getPdfUploadPartUrl(
  args: PdfUploadPartRequest,
): Promise<PdfUploadPartResponse> {
  return postPdfUploadJson<PdfUploadPartResponse>(
    "/api/uploads/pdf/part",
    args,
  );
}

export async function completePdfUpload(
  args: PdfUploadCompleteRequest,
): Promise<PdfUploadCompleteResponse> {
  return postPdfUploadJson<PdfUploadCompleteResponse>(
    "/api/uploads/pdf/complete",
    args,
  );
}

export async function abortPdfUpload(
  args: PdfUploadAbortRequest,
): Promise<PdfUploadAbortResponse> {
  return postPdfUploadJson<PdfUploadAbortResponse>(
    "/api/uploads/pdf/abort",
    args,
  );
}
