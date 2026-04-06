"use client";

import { useEffect, useState } from "react";
import { useParseProgress } from "@/components/ai/ParseProgressContext";
import { getStudySetMeta } from "@/lib/db/studySetDb";
import { Progress } from "@/components/ui/progress";

function phaseLabel(phase: string): string {
  if (phase === "rendering_pdf") {
    return "Rendering PDF pages…";
  }
  if (phase === "vision_pages") {
    return "Vision parse";
  }
  if (phase === "text_chunks") {
    return "Text parse";
  }
  return "Parse";
}

export function ParseProgressStrip() {
  const { live } = useParseProgress();
  const [setTitle, setSetTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!live?.running || !live.studySetId) {
      setSetTitle(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const meta = await getStudySetMeta(live.studySetId);
      if (!cancelled) {
        setSetTitle(meta?.title ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [live?.running, live?.studySetId]);

  if (!live?.running) {
    return null;
  }

  const indeterminate =
    live.phase === "rendering_pdf" || live.total <= 0;
  const pct =
    !indeterminate && live.total > 0
      ? Math.min(100, Math.round((100 * live.current) / live.total))
      : null;

  return (
    <div
      className="border-b border-border bg-muted/40 px-3 py-2 text-xs sm:px-5"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
        <p className="font-medium text-foreground">
          AI parse
          {setTitle ? (
            <span className="ml-2 font-normal text-muted-foreground">
              · {setTitle.length > 40 ? `${setTitle.slice(0, 40)}…` : setTitle}
            </span>
          ) : null}
        </p>
        <p className="text-muted-foreground sm:flex-1">
          {phaseLabel(live.phase)}
          {live.phase !== "rendering_pdf" && live.total > 0
            ? ` · ${live.current} / ${live.total}`
            : ""}
        </p>
        <div className="min-w-[8rem] sm:w-48">
          {indeterminate || pct === null ? (
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
              aria-hidden
            >
              <div className="h-full w-full animate-pulse bg-primary/50" />
            </div>
          ) : (
            <Progress value={pct} />
          )}
        </div>
      </div>
    </div>
  );
}
