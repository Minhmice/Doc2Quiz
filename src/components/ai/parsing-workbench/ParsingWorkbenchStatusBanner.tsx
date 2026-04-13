"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/buttons/button";

export type ParsingWorkbenchStatusBannerProps = Readonly<{
  headline: string;
  stageEyebrow: string;
  etaPrimary: string | null;
  etaHint?: string;
  onCancel?: () => void;
}>;

export function ParsingWorkbenchStatusBanner({
  headline,
  stageEyebrow,
  etaPrimary,
  etaHint = "Estimated remaining",
  onCancel,
}: ParsingWorkbenchStatusBannerProps) {
  return (
    <div className="flex flex-col gap-4 border-l-4 border-d2q-accent bg-chart-4 p-4 text-white shadow-lg md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <div
          className="motion-safe:animate-pulse flex size-8 shrink-0 items-center justify-center rounded-sm bg-chart-3"
          aria-hidden
        >
          <Loader2 className="size-[1.15rem] text-chart-4" />
        </div>
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-bold leading-tight tracking-tight">
            {headline}
          </h2>
          <p className="mt-0.5 font-label text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
            {stageEyebrow}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-4 font-label text-sm font-bold uppercase tracking-widest">
        {etaPrimary ? (
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-xl font-black tabular-nums tracking-normal text-chart-3">
              {etaPrimary}
            </span>
            <span className="text-[9px] font-semibold normal-case tracking-wide text-white/60">
              {etaHint}
            </span>
          </div>
        ) : null}
        {etaPrimary && onCancel ? (
          <div className="hidden h-10 w-px bg-white/20 sm:block" aria-hidden />
        ) : null}
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="cursor-pointer border-white/30 bg-transparent text-xs font-bold uppercase tracking-widest text-white hover:bg-white/10"
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}
