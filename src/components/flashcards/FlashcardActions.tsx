"use client";

import { ArrowLeft, ArrowRight, History } from "lucide-react";
import { Button } from "@/components/ui/button";

export type FlashcardActionsProps = {
  goPrev: () => void;
  goNext: () => void;
  onDone?: () => void;
  index: number;
  total: number;
};

export function FlashcardActions({
  goPrev,
  goNext,
  onDone,
  index,
  total,
}: FlashcardActionsProps) {
  const isDone = total > 0 && index >= total - 1;

  return (
    <div className="mt-2 sm:mt-3 lg:mt-6 mb-1 sm:mb-2 lg:mb-2 flex w-full max-w-[700px] lg:max-w-[850px] flex-col sm:flex-row items-stretch sm:items-center gap-3 px-2">
      <div className="flex gap-2 sm:gap-3 flex-none">
        <Button
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          disabled={index <= 0}
          className="flex h-14 lg:h-16 flex-1 sm:flex-none items-center gap-3 border-[color:var(--qp-outline-variant)]/20 bg-[color:var(--qp-surface-container-low)] px-6 lg:px-8 font-label text-xs lg:text-sm font-bold uppercase tracking-[0.15em] text-[color:var(--qp-secondary)] hover:bg-[color:var(--qp-surface-container)] hover:shadow-sm"
        >
          <ArrowLeft className="h-4 w-4 lg:h-5 lg:w-5" />
          <span className="sm:inline">Prev</span>
        </Button>
        <Button
          variant="outline"
          title="Review Later"
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="h-14 lg:h-16 border-[color:var(--qp-outline-variant)]/20 bg-[color:var(--qp-surface-container-low)] px-5 lg:px-7 text-[color:var(--qp-muted)] hover:text-red-500 hover:shadow-sm"
        >
          <History className="h-5 w-5 lg:h-6 lg:w-6" />
        </Button>
      </div>

      {isDone ? (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onDone?.();
          }}
          className="flex h-14 lg:h-16 flex-1 items-center justify-center gap-3 bg-[color:var(--qp-secondary)] px-8 lg:px-12 font-label text-xs lg:text-sm font-black uppercase tracking-[0.25em] text-white hover:bg-[color:var(--qp-tertiary)] shadow-md hover:shadow-lg transition-all"
        >
          <span>Done</span>
        </Button>
      ) : (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          disabled={index >= total - 1}
          className="flex h-14 lg:h-16 flex-1 items-center justify-center gap-3 bg-[color:var(--qp-on-primary-container)] px-8 lg:px-12 font-label text-xs lg:text-sm font-black uppercase tracking-[0.25em] text-white hover:bg-[color:var(--qp-primary)] shadow-md hover:shadow-lg transition-all dark:border dark:border-[color:var(--qp-outline-variant)]/45"
        >
          <span>Next</span>
          <ArrowRight className="h-4 w-4 lg:h-5 lg:w-5" />
        </Button>
      )}
    </div>
  );
}

