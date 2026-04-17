"use client";

import { useEffect, useState } from "react";
import { useParseProgress } from "@/components/ai/ParseProgressContext";
import { getStudySetMeta } from "@/lib/db/studySetDb";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

function phaseLabel(phase: string): string {
  if (phase === "rendering_pdf") {
    return "Rendering PDF pages…";
  }
  if (phase === "ocr_extract") {
    return "OCR extract";
  }
  if (phase === "vision_pages") {
    return "Vision parse";
  }
  if (phase === "text_chunks") {
    return "Text parse";
  }
  return "Parse";
}

function formatByteProgress(uploaded: number, total: number): string {
  const fmt = (n: number) =>
    n >= 1024 * 1024
      ? `${(n / (1024 * 1024)).toFixed(1)} MB`
      : n >= 1024
        ? `${(n / 1024).toFixed(1)} KB`
        : `${n} B`;
  return `${fmt(uploaded)} / ${fmt(total)}`;
}

export type ParseProgressStripProps = {
  /** Primary control: cancel parse, background transfer, and discard the draft set. */
  onCancelAll?: () => void;
  cancelAllDisabled?: boolean;
};

export function ParseProgressStrip({
  onCancelAll,
  cancelAllDisabled,
}: ParseProgressStripProps) {
  const { live, upload } = useParseProgress();
  const [setTitle, setSetTitle] = useState<string | null>(null);

  const studySetIdForTitle = live?.studySetId ?? upload?.studySetId;

  useEffect(() => {
    if (!studySetIdForTitle) {
      setSetTitle(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const meta = await getStudySetMeta(studySetIdForTitle);
      if (!cancelled) {
        setSetTitle(meta?.title ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studySetIdForTitle]);

  const showUpload =
    upload !== null &&
    upload.capabilityMode === "direct-upload" &&
    (upload.running || upload.uploadedBytes > 0);

  const parseActive = Boolean(live?.running);
  if (!parseActive && !showUpload) {
    return null;
  }

  const parseIndeterminate =
    live &&
    (live.phase === "rendering_pdf" ||
      (live.phase !== "ocr_extract" && live.total <= 0));
  const parsePct =
    live && !parseIndeterminate && live.total > 0
      ? Math.min(100, Math.round((100 * live.current) / live.total))
      : null;

  const uploadPct =
    showUpload && upload.totalBytes > 0
      ? Math.min(
          100,
          Math.round((100 * upload.uploadedBytes) / upload.totalBytes),
        )
      : null;
  const uploadIndeterminate =
    showUpload && upload.running && (upload.totalBytes <= 0 || uploadPct === null);

  return (
    <div
      className={cn(
        "sticky top-0 z-30 w-full border-b border-border bg-muted/40 backdrop-blur-sm",
        "px-3 py-2 text-xs sm:px-5",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="min-w-0 font-medium text-foreground">
            Import in progress
            {setTitle ? (
              <span className="ml-2 font-normal text-muted-foreground">
                · {setTitle.length > 40 ? `${setTitle.slice(0, 40)}…` : setTitle}
              </span>
            ) : null}
          </p>
          {onCancelAll ? (
            <button
              type="button"
              className="shrink-0 cursor-pointer rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
              onClick={onCancelAll}
              disabled={cancelAllDisabled}
            >
              Cancel all
            </button>
          ) : null}
        </div>

        {parseActive && live ? (
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
            <p className="shrink-0 font-medium text-foreground">AI parse</p>
            <p className="text-muted-foreground sm:flex-1">
              {phaseLabel(live.phase)}
              {live.phase !== "rendering_pdf" && live.total > 0
                ? ` · ${live.current} / ${live.total}`
                : ""}
            </p>
            <div className="min-w-[8rem] sm:w-48">
              {parseIndeterminate || parsePct === null ? (
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-muted"
                  aria-hidden
                >
                  <div className="h-full w-full animate-pulse bg-primary/50" />
                </div>
              ) : (
                <Progress value={parsePct} />
              )}
            </div>
          </div>
        ) : null}

        {showUpload && upload ? (
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
            <p className="shrink-0 font-medium text-foreground">Transfer</p>
            <p className="text-muted-foreground sm:flex-1">
              {upload.running ? "Sending PDF…" : "Transfer updated"}
              {upload.totalBytes > 0
                ? ` · ${formatByteProgress(upload.uploadedBytes, upload.totalBytes)}`
                : ""}
            </p>
            <div className="min-w-[8rem] sm:w-48">
              {uploadIndeterminate || uploadPct === null ? (
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-muted"
                  aria-hidden
                >
                  <div className="h-full w-full animate-pulse bg-primary/50" />
                </div>
              ) : (
                <Progress value={uploadPct} />
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
