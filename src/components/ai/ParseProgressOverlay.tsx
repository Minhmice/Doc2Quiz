"use client";

import { SparklesIcon } from "lucide-react";
import { useMemo } from "react";
import {
  useParseProgress,
  type LiveParseReport,
} from "@/components/ai/ParseProgressContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ParseProgressPhase } from "@/types/studySet";

const PHASE_MESSAGES: Record<ParseProgressPhase, string> = {
  idle: "Preparing…",
  rendering_pdf: "Rendering PDF pages…",
  vision_pages: "Extracting questions with vision…",
  text_chunks: "Extracting questions…",
};

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
  const tot = Math.max(1, live.total || 1);
  const cur = live.current || 0;
  const left = Math.max(0, tot - cur);
  const low = Math.max(2, Math.round(left * 4));
  const high = Math.max(low + 2, Math.round(left * 11));
  return `~${low}–${high}s remaining`;
}

function ProcessingLine({ live }: { live: LiveParseReport }) {
  if (live.phase === "rendering_pdf") {
    const tot = live.renderPageTotal;
    const cur = live.renderPageIndex ?? 0;
    if (tot && cur > 0) {
      return (
        <p className="text-sm font-semibold text-foreground">
          Processing page {cur}/{tot}
        </p>
      );
    }
    return (
      <p className="text-sm font-semibold text-foreground">
        Preparing page images…
      </p>
    );
  }

  if (live.total > 0) {
    return (
      <p className="text-sm font-semibold text-foreground">
        Vision pass {live.current}/{live.total}
      </p>
    );
  }

  return (
    <p className="text-sm font-semibold text-foreground">Working…</p>
  );
}

export function ParseProgressOverlay({
  studySetId,
}: {
  studySetId: string;
}) {
  const { live } = useParseProgress();

  const show = live?.running && live.studySetId === studySetId;

  const phase = live?.phase ?? "idle";
  const message = live ? PHASE_MESSAGES[phase] ?? "Working…" : "";
  const indeterminate =
    live && (phase === "rendering_pdf" || live.total <= 0);
  const pct =
    live && !indeterminate && live.total > 0
      ? Math.min(100, Math.round((100 * live.current) / live.total))
      : null;

  const eta = useMemo(() => (live ? estimateRangeSeconds(live) : null), [live]);

  const extracted = live?.extractedQuestionCount ?? 0;
  const logLines = live?.parseLog ?? [];
  const thumbs = live?.pageThumbnails ?? [];

  if (!show || !live) {
    return null;
  }

  return (
    <Card
      className="relative overflow-hidden border-primary/45 bg-gradient-to-b from-primary/8 via-card to-card shadow-lg"
      role="status"
      aria-live="polite"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14] dark:opacity-[0.2]"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,var(--primary)_50%,transparent_60%)] d2q-shimmer-overlay" />
      </div>

      <CardHeader className="relative space-y-3 pb-2">
        <div className="flex items-center justify-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-inner ring-1 ring-primary/20">
            <SparklesIcon className="size-5" aria-hidden />
          </span>
          <CardTitle className="text-center text-lg font-semibold tracking-tight">
            Parsing with AI
          </CardTitle>
        </div>

        <div className="flex justify-center gap-1.5" aria-hidden>
          <span className="d2q-parse-dot size-1.5 rounded-full bg-primary" />
          <span className="d2q-parse-dot size-1.5 rounded-full bg-primary" />
          <span className="d2q-parse-dot size-1.5 rounded-full bg-primary" />
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4">
        <div className="space-y-1 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {message}
          </p>
          <ProcessingLine live={live} />
          {phase === "vision_pages" ? (
            <p className="text-sm text-primary">
              Extracted{" "}
              <span className="font-bold tabular-nums text-foreground">
                {extracted}
              </span>{" "}
              question{extracted === 1 ? "" : "s"}
            </p>
          ) : null}
          {eta ? (
            <p className="text-xs text-muted-foreground">{eta}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          {indeterminate || pct === null ? (
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/5 rounded-full bg-primary/80 d2q-progress-stripes" />
            </div>
          ) : (
            <Progress
              value={pct}
              className="h-2.5 transition-all duration-500 ease-out"
            />
          )}
        </div>

        {thumbs.length > 0 ? (
          <div>
            <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Page preview
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {thumbs.map((t) => (
                <div
                  key={t.pageIndex}
                  className="relative overflow-hidden rounded-md border border-border bg-muted/40 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.dataUrl}
                    alt=""
                    className="h-14 w-auto max-w-[3.25rem] object-cover object-top"
                  />
                  <span className="absolute bottom-0.5 right-0.5 rounded bg-background/90 px-1 text-[9px] font-medium tabular-nums text-foreground shadow-sm">
                    {t.pageIndex} ✓
                  </span>
                </div>
              ))}
              {phase === "rendering_pdf" &&
              live.renderPageTotal &&
              (live.renderPageIndex ?? 0) < live.renderPageTotal ? (
                <div className="flex h-14 w-12 items-center justify-center rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 text-[10px] font-medium text-muted-foreground">
                  …
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {logLines.length > 0 ? (
          <div className="rounded-lg border border-border/80 bg-muted/30 p-2">
            <p className="mb-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Live log
            </p>
            <ScrollArea className="h-[7.5rem] pr-2">
              <ul className="space-y-1.5 text-left text-[11px] leading-snug text-muted-foreground">
                {logLines.map((line, i) => (
                  <li
                    key={`${i}-${line.slice(0, 24)}`}
                    className="font-mono text-[10px] text-foreground/85"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
