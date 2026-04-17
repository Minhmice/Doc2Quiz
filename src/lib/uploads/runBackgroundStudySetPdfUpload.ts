import {
  abortPdfUpload,
  completePdfUpload,
  getPdfUploadPartUrl,
  initPdfUpload,
  isPdfUploadLocalOnlyCapability,
} from "@/lib/uploads/pdfUploadClient";
import type {
  PdfUploadCapability,
  PdfUploadSessionDescriptor,
} from "@/types/uploads";

export type BackgroundPdfUploadProgress = {
  uploadedBytes: number;
  totalBytes: number;
  capability: PdfUploadCapability;
};

export type RunBackgroundStudySetPdfUploadResult =
  | { kind: "skipped" }
  | { kind: "completed" }
  | { kind: "aborted" }
  | { kind: "error"; message: string };

export type RunBackgroundStudySetPdfUploadArgs = {
  file: File;
  signal: AbortSignal;
  /** Invoked when a direct-upload session is created or cleared (best-effort cleanup). */
  onSession?: (session: PdfUploadSessionDescriptor | null) => void;
  onProgress: (p: BackgroundPdfUploadProgress) => void;
};

function stripEtag(h: string | null): string | undefined {
  if (!h) {
    return undefined;
  }
  const t = h.trim();
  if (t.length === 0) {
    return undefined;
  }
  return t.replace(/^W\//i, "").replace(/^"([\s\S]*)"$/, "$1");
}

/**
 * Best-effort multipart upload of the original PDF when the deployment reports
 * `direct-upload` capability. No-ops (returns `skipped`) for local-only mode.
 */
export async function runBackgroundStudySetPdfUpload(
  args: RunBackgroundStudySetPdfUploadArgs,
): Promise<RunBackgroundStudySetPdfUploadResult> {
  const { file, signal, onProgress, onSession } = args;
  let session: PdfUploadSessionDescriptor | null = null;

  try {
    const suggested =
      file.name.replace(/\.pdf$/i, "").trim().slice(0, 64) || "pdf";
    const init = await initPdfUpload({ file, suggestedSuffix: suggested });

    if (isPdfUploadLocalOnlyCapability(init.uploadCapability)) {
      onSession?.(null);
      return { kind: "skipped" };
    }

    if (
      !init.session ||
      !init.finalizeToken ||
      !init.multipart ||
      init.uploadCapability.mode !== "direct-upload"
    ) {
      onSession?.(null);
      return { kind: "skipped" };
    }

    session = init.session;
    onSession?.(session);

    const { partSizeBytes, totalParts } = init.multipart;
    const totalBytes = session.sizeBytes;
    onProgress({
      uploadedBytes: 0,
      totalBytes,
      capability: init.uploadCapability,
    });

    const buf = await file.arrayBuffer();
    const completedParts: { partNumber: number; etag?: string }[] = [];

    for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
      if (signal.aborted) {
        return { kind: "aborted" };
      }
      const byteStart = (partNumber - 1) * partSizeBytes;
      const byteEndInclusive = Math.min(
        byteStart + partSizeBytes - 1,
        totalBytes - 1,
      );

      const partRes = await getPdfUploadPartUrl({
        session,
        partNumber,
        byteStart,
        byteEndInclusive,
      });

      if (!partRes.uploadUrl?.trim()) {
        return {
          kind: "error",
          message:
            partRes.error?.trim() ||
            "Upload could not start for this deployment.",
        };
      }

      const slice = buf.slice(byteStart, byteEndInclusive + 1);
      const put = await fetch(partRes.uploadUrl, {
        method: "PUT",
        body: slice,
        signal,
      });
      if (!put.ok) {
        return {
          kind: "error",
          message: `Upload failed (${put.status}).`,
        };
      }

      const etag = stripEtag(put.headers.get("etag"));
      completedParts.push({
        partNumber,
        ...(etag !== undefined ? { etag } : {}),
      });

      onProgress({
        uploadedBytes: byteEndInclusive + 1,
        totalBytes,
        capability: partRes.uploadCapability,
      });
    }

    if (signal.aborted) {
      return { kind: "aborted" };
    }

    const done = await completePdfUpload({
      session,
      parts: completedParts,
      finalizeToken: init.finalizeToken,
    });

    if (!done.finalized) {
      return {
        kind: "error",
        message:
          done.userMessage?.trim() ||
          done.error?.trim() ||
          "Upload could not be finalized.",
      };
    }

    return { kind: "completed" };
  } catch (raw) {
    if (signal.aborted) {
      return { kind: "aborted" };
    }
    const msg =
      raw instanceof Error && raw.message.trim().length > 0
        ? raw.message
        : "Upload failed.";
    return { kind: "error", message: msg };
  } finally {
    if (signal.aborted && session) {
      try {
        await abortPdfUpload({ session });
      } catch {
        /* best-effort */
      }
    }
    onSession?.(null);
  }
}
