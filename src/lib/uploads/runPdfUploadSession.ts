/**
 * Browser-side PDF upload orchestration (Phase 26-02): init → multipart PUT → finalize.
 * Same-session only; transient network errors retry with backoff. Cancel via `cancel()`.
 */

import {
  abortPdfUpload,
  completePdfUpload,
  getPdfUploadPartUrl,
  initPdfUpload,
  isPdfUploadLocalOnlyCapability,
} from "@/lib/uploads/pdfUploadClient";
import { sleepMs } from "@/lib/ai/pipelineStageRetry";
import { isAbortError } from "@/lib/ai/errors";
import { pipelineLog } from "@/lib/logging/pipelineLogger";
import type {
  PdfUploadCapability,
  PdfUploadSessionDescriptor,
} from "@/types/uploads";

export type PdfUploadRunnerState =
  | "idle"
  | "init"
  | "uploading"
  | "finalizing"
  | "done"
  | "failed"
  | "cancelled"
  | "local_only";

export type RunPdfUploadSessionProgress = {
  uploadedBytes: number;
  totalBytes: number;
  percent: number;
  capability: PdfUploadCapability;
};

export type RunPdfUploadSessionOk = {
  ok: true;
  upload: { uploadId: string; key: string; expiresAt: string };
};

export type RunPdfUploadSessionOutcome =
  | RunPdfUploadSessionOk
  | {
      ok: false;
      uploadCapability: PdfUploadCapability;
      message?: string;
    };

export type RunPdfUploadSessionArgs = {
  file: File;
  /** Coarse hint only — no raw filenames (D-03). */
  suggestedSuffix: string;
  /** Merged with internal controller — aborted when `cancel()` is called. */
  signal?: AbortSignal;
  onProgress: (p: RunPdfUploadSessionProgress) => void;
  onStatus: (s: { state: PdfUploadRunnerState }) => void;
  /** When a server session is established or cleared (e.g. for parent bookkeeping). */
  onSessionDescriptor?: (session: PdfUploadSessionDescriptor | null) => void;
};

function isTransientUploadError(err: unknown): boolean {
  if (isAbortError(err)) {
    return false;
  }
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.toLowerCase();
  return (
    m.includes("429") ||
    m.includes("503") ||
    m.includes("502") ||
    m.includes("fetch") ||
    m.includes("network") ||
    m.includes("failed to fetch")
  );
}

async function withUploadRetries<T>(
  signal: AbortSignal,
  fn: () => Promise<T>,
): Promise<T> {
  const maxAttempts = 4;
  const baseDelays = [200, 450, 900, 1600];
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    if (signal.aborted) {
      throw signal.reason;
    }
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (signal.aborted || isAbortError(e)) {
        throw e;
      }
      if (i < maxAttempts - 1 && isTransientUploadError(e)) {
        const d = baseDelays[i] ?? 400;
        const jitter = Math.floor(Math.random() * 120);
        await sleepMs(d + jitter, signal);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

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

function emit(
  onStatus: RunPdfUploadSessionArgs["onStatus"],
  state: PdfUploadRunnerState,
): void {
  onStatus({ state });
}

/**
 * Starts a PDF upload session. Does not block local IDB work — call from parallel `void` or `Promise` chains.
 * Returns `cancel()` to abort in-flight work and best-effort `abort` on the server session.
 */
export function runPdfUploadSession(
  args: RunPdfUploadSessionArgs,
): { promise: Promise<RunPdfUploadSessionOutcome>; cancel: () => void } {
  const { file, suggestedSuffix, onProgress, onStatus, onSessionDescriptor } =
    args;
  const internal = new AbortController();
  const signal = args.signal;
  if (signal) {
    const onAbort = () => internal.abort(signal.reason);
    if (signal.aborted) {
      internal.abort(signal.reason);
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  }

  const ac = internal.signal;

  const promise = (async (): Promise<RunPdfUploadSessionOutcome> => {
    let session: PdfUploadSessionDescriptor | null = null;
    try {
      emit(onStatus, "init");
      pipelineLog("IDB", "pdf-upload", "info", "session_start", {
        sizeBytes: file.size,
      });

      const init = await withUploadRetries(ac, () =>
        initPdfUpload({ file, suggestedSuffix }),
      );

      if (
        !init.uploadCapability.configured ||
        !init.uploadCapability.providerReady ||
        isPdfUploadLocalOnlyCapability(init.uploadCapability)
      ) {
        emit(onStatus, "local_only");
        pipelineLog("IDB", "pdf-upload", "info", "session_local_only", {
          configured: init.uploadCapability.configured,
          providerReady: init.uploadCapability.providerReady,
        });
        onSessionDescriptor?.(null);
        return { ok: false, uploadCapability: init.uploadCapability };
      }

      const initSession = init.session;
      const finalizeToken = init.finalizeToken;
      const initMultipart = init.multipart;
      if (
        !initSession ||
        !finalizeToken ||
        !initMultipart ||
        init.uploadCapability.mode !== "direct-upload"
      ) {
        emit(onStatus, "local_only");
        onSessionDescriptor?.(null);
        return {
          ok: false,
          uploadCapability: init.uploadCapability,
          message: "Direct upload is not available for this deployment.",
        };
      }

      session = initSession;
      onSessionDescriptor?.(session);
      const activeSession: PdfUploadSessionDescriptor = session;
      const { partSizeBytes, totalParts } = initMultipart;
      const totalBytes = activeSession.sizeBytes;

      onProgress({
        uploadedBytes: 0,
        totalBytes,
        percent: 0,
        capability: init.uploadCapability,
      });
      emit(onStatus, "uploading");

      const buf = await file.arrayBuffer();
      const completedParts: { partNumber: number; etag?: string }[] = [];

      for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
        if (ac.aborted) {
          emit(onStatus, "cancelled");
          onSessionDescriptor?.(null);
          pipelineLog("IDB", "pdf-upload", "info", "session_cancelled", {});
          return {
            ok: false,
            uploadCapability: init.uploadCapability,
            message: "Upload cancelled.",
          };
        }

        const byteStart = (partNumber - 1) * partSizeBytes;
        const byteEndInclusive = Math.min(
          byteStart + partSizeBytes - 1,
          totalBytes - 1,
        );

        const partRes = await withUploadRetries(ac, () =>
          getPdfUploadPartUrl({
            session: activeSession,
            partNumber,
            byteStart,
            byteEndInclusive,
          }),
        );

        const uploadUrl = partRes.uploadUrl?.trim();
        if (!uploadUrl) {
          emit(onStatus, "failed");
          onSessionDescriptor?.(null);
          return {
            ok: false,
            uploadCapability: partRes.uploadCapability,
            message:
              partRes.error?.trim() ||
              "Upload could not start for this deployment.",
          };
        }

        const slice = buf.slice(byteStart, byteEndInclusive + 1);
        const put = await withUploadRetries(ac, async () => {
          const res = await fetch(uploadUrl, {
            method: "PUT",
            body: slice,
            signal: ac,
          });
          if (!res.ok && (res.status >= 500 || res.status === 429)) {
            throw new Error(`Upload failed (${res.status}).`);
          }
          return res;
        });

        if (!put.ok) {
          emit(onStatus, "failed");
          onSessionDescriptor?.(null);
          return {
            ok: false,
            uploadCapability: partRes.uploadCapability,
            message: `Upload failed (${put.status}).`,
          };
        }

        const etag = stripEtag(put.headers.get("etag"));
        completedParts.push({
          partNumber,
          ...(etag !== undefined ? { etag } : {}),
        });

        const uploadedBytes = byteEndInclusive + 1;
        onProgress({
          uploadedBytes,
          totalBytes,
          percent:
            totalBytes > 0
              ? Math.min(100, Math.round((100 * uploadedBytes) / totalBytes))
              : 0,
          capability: partRes.uploadCapability,
        });
      }

      if (ac.aborted) {
        emit(onStatus, "cancelled");
        onSessionDescriptor?.(null);
        return {
          ok: false,
          uploadCapability: init.uploadCapability,
          message: "Upload cancelled.",
        };
      }

      emit(onStatus, "finalizing");
      const done = await withUploadRetries(ac, () =>
        completePdfUpload({
          session: activeSession,
          parts: completedParts,
          finalizeToken,
        }),
      );

      if (!done.finalized) {
        emit(onStatus, "failed");
        onSessionDescriptor?.(null);
        pipelineLog("IDB", "pdf-upload", "warn", "session_finalize_incomplete", {
          uploadId: activeSession.uploadId,
        });
        return {
          ok: false,
          uploadCapability: done.uploadCapability,
          message:
            done.userMessage?.trim() ||
            done.error?.trim() ||
            "Upload could not be finalized.",
        };
      }

      emit(onStatus, "done");
      pipelineLog("IDB", "pdf-upload", "info", "session_done", {
        uploadId: activeSession.uploadId,
      });
      onSessionDescriptor?.(null);
      return {
        ok: true,
        upload: {
          uploadId: activeSession.uploadId,
          key: activeSession.key,
          expiresAt: activeSession.expiresAt,
        },
      };
    } catch (raw) {
      if (ac.aborted || isAbortError(raw)) {
        emit(onStatus, "cancelled");
        onSessionDescriptor?.(null);
        pipelineLog("IDB", "pdf-upload", "info", "session_abort", {});
        return {
          ok: false,
          uploadCapability: {
            configured: true,
            providerReady: true,
            mode: "direct-upload",
          },
          message: "Upload cancelled.",
        };
      }
      const msg =
        raw instanceof Error && raw.message.trim().length > 0
          ? raw.message
          : "Upload failed.";
      emit(onStatus, "failed");
      onSessionDescriptor?.(null);
      pipelineLog("IDB", "pdf-upload", "warn", "session_error", {
        message: msg,
      });
      return {
        ok: false,
        uploadCapability: {
          configured: true,
          providerReady: true,
          mode: "direct-upload",
        },
        message: msg,
      };
    } finally {
      if (ac.aborted && session !== null) {
        try {
          await abortPdfUpload({ session });
        } catch {
          /* best-effort */
        }
      }
    }
  })();

  return {
    promise,
    cancel: () => {
      internal.abort(new DOMException("Aborted", "AbortError"));
    },
  };
}
