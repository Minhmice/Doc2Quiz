"use client";

import { useMemo } from "react";
import {
  useParseProgress,
  type LiveParseReport,
} from "@/components/ai/ParseProgressContext";
import { ParsingWorkbenchLog } from "@/components/ai/parsing-workbench/ParsingWorkbenchLog";
import { ParsingWorkbenchMetricsRow } from "@/components/ai/parsing-workbench/ParsingWorkbenchMetricsRow";
import { ParsingWorkbenchStatusBanner } from "@/components/ai/parsing-workbench/ParsingWorkbenchStatusBanner";
import {
  ParsingWorkbenchThumbStrip,
  type ParsingWorkbenchThumbSlot,
} from "@/components/ai/parsing-workbench/ParsingWorkbenchThumbStrip";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ParseProgressPhase } from "@/types/studySet";

export const PARSE_PHASE_MESSAGES: Record<ParseProgressPhase, string> = {
  idle: "Preparing…",
  rendering_pdf: "Rendering PDF pages…",
  ocr_extract: "Running OCR on page images…",
  vision_pages: "Extracting content with vision…",
  text_chunks: "Extracting content…",
};

export function formatEtaRangeFull(live: LiveParseReport): string | null {
  return estimateRangeSeconds(live);
}

function estimateRangeSeconds(live: LiveParseReport): string | null {
  if (!live.running) {
    return null;
  }
  if (live.phase === "rendering_pdf") {
    const tot = Math.max(1, live.renderPageTotal || 1);
    const cur = live.renderPageIndex || 0;
    const left = Math.max(0, tot - cur);
    const low = Math.max(1, Math.round(left * 1.2));
    const high = Math.max(low + 1, Math.round(left * 2.8));
    return `~${low}–${high}s remaining`;
  }
  if (live.phase === "ocr_extract") {
    const tot = Math.max(1, live.total || 1);
    const cur = live.current || 0;
    const left = Math.max(0, tot - cur);
    const low = Math.max(2, Math.round(left * 3));
    const high = Math.max(low + 2, Math.round(left * 8));
    return `~${low}–${high}s remaining`;
  }
  const tot = Math.max(1, live.total || 1);
  const cur = live.current || 0;
  const left = Math.max(0, tot - cur);
  const low = Math.max(2, Math.round(left * 4));
  const high = Math.max(low + 2, Math.round(left * 11));
  return `~${low}–${high}s remaining`;
}

export function formatEtaPrimary(live: LiveParseReport): string | null {
  const raw = estimateRangeSeconds(live);
  if (!raw) {
    return null;
  }
  const m = raw.match(/~(\d+)/);
  return m ? `~${m[1]}s` : raw.replace(/\s*remaining$/i, "").trim();
}

export function parseProgressBannerHeadline(live: LiveParseReport): string {
  if (live.phase === "rendering_pdf") {
    const tot = live.renderPageTotal ?? 0;
    const cur = live.renderPageIndex ?? 0;
    if (tot > 0) {
      return `Parsing in progress: ${cur}/${tot} pages rasterized`;
    }
    return "Parsing in progress: preparing page images";
  }
  if (live.phase === "ocr_extract" && live.total > 0) {
    return `Parsing in progress: ${live.current}/${live.total} OCR pages`;
  }
  if (live.total > 0) {
    if (live.phase === "vision_pages") {
      return `Parsing in progress: ${live.current}/${live.total} vision passes`;
    }
    return `Parsing in progress: ${live.current}/${live.total} steps`;
  }
  return "Parsing in progress";
}

function buildThumbSlots(live: LiveParseReport): readonly ParsingWorkbenchThumbSlot[] {
  const phase = live.phase;
  const total =
    phase === "rendering_pdf" && (live.renderPageTotal ?? 0) > 0
      ? live.renderPageTotal!
      : (live.documentPageCount ?? 0) > 0
        ? live.documentPageCount!
        : live.total > 0
          ? live.total
          : 0;

  const thumbByPage = new Map(
    (live.pageThumbnails ?? []).map((t) => [t.pageIndex, t.dataUrl] as const),
  );

  if (total <= 0) {
    return (live.pageThumbnails ?? []).map((t) => ({
      id: t.pageIndex,
      label: String(t.pageIndex).padStart(2, "0"),
      state: "done" as const,
      thumbSrc: t.dataUrl,
    }));
  }

  let done = 0;
  if (phase === "rendering_pdf") {
    done = live.renderPageIndex ?? 0;
  } else {
    done = live.current ?? 0;
  }
  const active =
    done < total ? Math.min(done + 1, total) : null;

  return Array.from({ length: total }, (_, idx) => {
    const pageNum = idx + 1;
    let state: ParsingWorkbenchThumbSlot["state"];
    if (active !== null && pageNum === active) {
      state = "active";
    } else if (pageNum <= done) {
      state = "done";
    } else {
      state = "queued";
    }
    return {
      id: pageNum,
      label: String(pageNum).padStart(2, "0"),
      state,
      thumbSrc: thumbByPage.get(pageNum) ?? null,
    };
  });
}

function metricsCopy(live: LiveParseReport): {
  currentLabel: string;
  currentValue: string;
  currentHint: string | null;
  emphasizeCurrent: boolean;
} {
  const phase = live.phase;

  if (phase === "rendering_pdf" && (live.renderPageTotal ?? 0) > 0) {
    const rt = live.renderPageTotal!;
    const rp = live.renderPageIndex ?? 0;
    const cur = rp < rt ? rp + 1 : rt;
    return {
      currentLabel: "Current page",
      currentValue: String(cur).padStart(2, "0"),
      currentHint: `of ${rt}`,
      emphasizeCurrent: true,
    };
  }

  if (live.total > 0) {
    const cur = live.current ?? 0;
    const display = cur < live.total ? cur + 1 : cur;
    const label =
      phase === "ocr_extract"
        ? "Current page"
        : phase === "text_chunks"
          ? "Current chunk"
          : "Current pass";
    return {
      currentLabel: label,
      currentValue: String(display).padStart(2, "0"),
      currentHint: `of ${live.total}`,
      emphasizeCurrent: true,
    };
  }

  if ((live.documentPageCount ?? 0) > 0) {
    const d = live.documentPageCount!;
    return {
      currentLabel: "Document pages",
      currentValue: String(d).padStart(2, "0"),
      currentHint: null,
      emphasizeCurrent: false,
    };
  }

  return {
    currentLabel: "Progress",
    currentValue: "—",
    currentHint: null,
    emphasizeCurrent: false,
  };
}

export type ParseProgressWorkbenchPanelProps = Readonly<{
  studySetId: string;
  onCancel?: () => void;
  /** `standalone` wraps in Card (legacy overlay). `embedded` is body-only for a parent shell. */
  variant?: "standalone" | "embedded";
  className?: string;
  /**
   * When set with `variant="embedded"`, omit status banner and marketing header — parent
   * (`UnifiedImportStatusCard`) owns the top band so ingest and live parse share one shell.
   */
  embeddedBodyOnly?: boolean;
  /**
   * New-set import: collapse metrics, thumbnails, and log behind &quot;Technical details&quot;.
   * Typically used with `embeddedBodyOnly`.
   */
  simplifiedImportFlow?: boolean;
}>;

export function ParseProgressWorkbenchPanel({
  studySetId,
  onCancel,
  variant = "standalone",
  className,
  embeddedBodyOnly = false,
  simplifiedImportFlow = false,
}: ParseProgressWorkbenchPanelProps) {
  const { live } = useParseProgress();

  const show = live?.running && live.studySetId === studySetId;

  const phase = live?.phase ?? "idle";
  const message = live ? (PARSE_PHASE_MESSAGES[phase] ?? "Working…") : "";
  const indeterminate =
    live &&
    (phase === "rendering_pdf" || (phase !== "ocr_extract" && live.total <= 0));
  const pct =
    live && !indeterminate && live.total > 0
      ? Math.min(100, Math.round((100 * live.current) / live.total))
      : null;

  const etaPrimary = useMemo(
    () => (live ? formatEtaPrimary(live) : null),
    [live],
  );
  const headline = useMemo(
    () => (live ? parseProgressBannerHeadline(live) : ""),
    [live],
  );
  const stageEyebrow = message.toUpperCase();
  const thumbSlots = useMemo(
    () => (live ? buildThumbSlots(live) : []),
    [live],
  );

  const extracted = live?.extractedQuestionCount ?? 0;
  const logLines = live?.parseLog ?? [];

  if (!show || !live) {
    return null;
  }

  const metrics = metricsCopy(live);

  const showBannerAndMarketing =
    variant !== "embedded" || !embeddedBodyOnly;

  const body = (
    <>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.1] dark:opacity-[0.16]"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,var(--primary)_50%,transparent_60%)] d2q-shimmer-overlay" />
      </div>

      {showBannerAndMarketing ? (
        <ParsingWorkbenchStatusBanner
          headline={headline}
          stageEyebrow={stageEyebrow}
          etaPrimary={etaPrimary}
          onCancel={onCancel}
        />
      ) : null}

      {showBannerAndMarketing ? (
        <CardHeader className="relative space-y-1 border-b border-border/80 pb-4">
          <CardTitle className="text-center font-heading text-2xl font-black tracking-tight text-chart-4 dark:text-accent-foreground">
            Extracting from your document
          </CardTitle>
          <p className="text-center font-label text-xs font-semibold uppercase tracking-[0.2em] text-chart-2">
            Artificial intelligence at work
          </p>
        </CardHeader>
      ) : null}

      <CardContent className="relative space-y-8 px-6 py-8">
        <div className="mx-auto max-w-2xl space-y-3">
          {indeterminate || pct === null ? (
            <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full bg-muted p-1">
              <div className="h-full w-2/5 rounded-full bg-chart-2" />
              <div className="h-full w-[45%] animate-pulse rounded-full bg-chart-3 shadow-[0_0_12px_color-mix(in_srgb,var(--chart-3)_55%,transparent)]" />
              <div className="h-full flex-1 rounded-full bg-muted-foreground/20" />
            </div>
          ) : (
            <Progress
              value={pct}
              className="h-3 transition-all duration-500 ease-out"
            />
          )}
          <div
            className={`flex justify-between px-1 font-label text-[9px] font-black uppercase tracking-widest text-muted-foreground ${
              simplifiedImportFlow ? "opacity-90" : ""
            }`}
          >
            <span className="text-chart-2">
              {simplifiedImportFlow ? "Progress" : "Pipeline"}
            </span>
            <span className="text-chart-3">
              {pct !== null ? `${pct}%` : "Running"}
            </span>
            <span>{simplifiedImportFlow ? "Study set" : "Assembly"}</span>
          </div>
        </div>

        {simplifiedImportFlow ? (
          <details className="rounded-lg border border-border bg-muted/25 px-3 py-2">
            <summary className="cursor-pointer font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">
              Technical details
            </summary>
            <div className="mt-6 space-y-8 pb-2">
              <ParsingWorkbenchMetricsRow
                extractedLabel="Extracted items"
                extractedValue={String(extracted)}
                extractedHint={
                  phase === "vision_pages" && extracted > 0
                    ? "Items so far"
                    : null
                }
                currentLabel={metrics.currentLabel}
                currentValue={metrics.currentValue}
                currentHint={metrics.currentHint}
                emphasizeCurrent={metrics.emphasizeCurrent}
                elapsedLabel="—"
                elapsedHint={null}
              />

              <ParsingWorkbenchThumbStrip slots={thumbSlots} />

              <ParsingWorkbenchLog lines={logLines} />
            </div>
          </details>
        ) : (
          <>
            <ParsingWorkbenchMetricsRow
              extractedLabel="Extracted items"
              extractedValue={String(extracted)}
              extractedHint={
                phase === "vision_pages" && extracted > 0 ? "Items so far" : null
              }
              currentLabel={metrics.currentLabel}
              currentValue={metrics.currentValue}
              currentHint={metrics.currentHint}
              emphasizeCurrent={metrics.emphasizeCurrent}
              elapsedLabel="—"
              elapsedHint={null}
            />

            <ParsingWorkbenchThumbStrip slots={thumbSlots} />

            <ParsingWorkbenchLog lines={logLines} />
          </>
        )}
      </CardContent>
    </>
  );

  if (variant === "embedded") {
    return (
      <div
        className={cn(
          "relative overflow-hidden border-0 bg-transparent",
          className,
        )}
        role="status"
        aria-live="polite"
      >
        {body}
      </div>
    );
  }

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-primary/45 bg-card shadow-lg",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {body}
    </Card>
  );
}
