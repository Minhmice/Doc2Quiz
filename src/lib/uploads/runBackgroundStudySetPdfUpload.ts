import {
  isPdfUploadLocalOnlyCapability,
} from "@/lib/uploads/pdfUploadClient";
import {
  runPdfUploadSession,
  type RunPdfUploadSessionOutcome,
  type PdfUploadRunnerState,
} from "@/lib/uploads/runPdfUploadSession";
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
  /** Optional: wire to upload progress UI (Phase 26-02). */
  onRunnerStatus?: (s: PdfUploadRunnerState) => void;
};

function mapPdfUploadSessionOutcome(
  out: RunPdfUploadSessionOutcome,
): RunBackgroundStudySetPdfUploadResult {
  if (out.ok) {
    return { kind: "completed" };
  }
  const { uploadCapability: cap, message } = out;
  if (
    !cap.configured ||
    !cap.providerReady ||
    isPdfUploadLocalOnlyCapability(cap)
  ) {
    return { kind: "skipped" };
  }
  const msg = message?.trim() ?? "";
  if (/cancel/i.test(msg)) {
    return { kind: "aborted" };
  }
  if (msg.length === 0) {
    return { kind: "error", message: "Upload failed." };
  }
  return { kind: "error", message: msg };
}

/**
 * Best-effort multipart upload of the original PDF when the deployment reports
 * `direct-upload` capability. No-ops (returns `skipped`) for local-only mode.
 * Delegates to `runPdfUploadSession` (Phase 26-02).
 */
export async function runBackgroundStudySetPdfUpload(
  args: RunBackgroundStudySetPdfUploadArgs,
): Promise<RunBackgroundStudySetPdfUploadResult> {
  const { file, signal, onProgress, onSession, onRunnerStatus } = args;

  const { promise } = runPdfUploadSession({
    file,
    suggestedSuffix: "document",
    signal,
    onSessionDescriptor: onSession,
    onProgress: (p) => {
      onProgress({
        uploadedBytes: p.uploadedBytes,
        totalBytes: p.totalBytes,
        capability: p.capability,
      });
    },
    onStatus: (s) => {
      onRunnerStatus?.(s.state);
    },
  });

  const outcome = await promise;
  return mapPdfUploadSessionOutcome(outcome);
}
