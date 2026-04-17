"use client";

import { Button } from "@/components/buttons/button";
import { cn } from "@/lib/utils";
import type { PdfUploadRunnerState } from "@/lib/uploads/runPdfUploadSession";

export type PdfUploadProgressRowProps = {
  className?: string;
  runnerState: PdfUploadRunnerState;
  percent: number;
  uploadedBytes: number;
  totalBytes: number;
  errorMessage?: string;
  onCancel: () => void;
  onReupload?: () => void;
};

function fmtMb(n: number): string {
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function labelForState(state: PdfUploadRunnerState): string {
  if (state === "init") {
    return "Preparing upload…";
  }
  if (state === "finalizing") {
    return "Finalizing upload…";
  }
  if (state === "uploading") {
    return "Uploading PDF…";
  }
  if (state === "done") {
    return "Upload complete";
  }
  if (state === "cancelled") {
    return "Upload cancelled";
  }
  if (state === "failed") {
    return "Upload issue";
  }
  return "PDF transfer";
}

export function PdfUploadProgressRow({
  className,
  runnerState,
  percent,
  uploadedBytes,
  totalBytes,
  errorMessage,
  onCancel,
  onReupload,
}: PdfUploadProgressRowProps) {
  const showBytes = totalBytes > 0;
  const busy =
    runnerState === "init" ||
    runnerState === "uploading" ||
    runnerState === "finalizing";
  const showCancel = busy;
  const showError = runnerState === "failed" && errorMessage;
  const showCancelled = runnerState === "cancelled";

  return (
    <div
      className={cn(
        "rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5 text-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{labelForState(runnerState)}</p>
          {showBytes ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {Math.round(percent)}% · {fmtMb(uploadedBytes)} / {fmtMb(totalBytes)}
            </p>
          ) : null}
        </div>
        {showCancel ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
      </div>
      {busy ? (
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(percent)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      ) : null}
      {showError ? (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {showError && onReupload ? (
        <div className="mt-2">
          <Button type="button" size="sm" variant="secondary" onClick={onReupload}>
            Re-upload
          </Button>
        </div>
      ) : null}
      {showCancelled ? (
        <p className="mt-2 text-xs text-muted-foreground">You can continue working locally.</p>
      ) : null}
    </div>
  );
}
