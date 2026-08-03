"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/locale/LocaleProvider";

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
  const { messages } = useLocale();
  const copy = messages.workflows.practice.flashcards;
  const isDone = total > 0 && index >= total - 1;

  return (
    <div className="mt-2 mb-1 flex w-full max-w-[700px] flex-col items-stretch gap-2 px-2 sm:mt-3 sm:mb-2 sm:flex-row sm:items-center sm:gap-3 lg:mt-6 lg:max-w-[850px]">
      <div className="flex gap-2 sm:gap-3 flex-none">
        <Button
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          disabled={index <= 0}
          className="flex h-12 min-w-0 flex-1 items-center gap-2 border-[color:var(--qp-outline-variant)]/20 bg-[color:var(--qp-surface-container-low)] px-3 font-label text-[10px] font-bold uppercase tracking-[0.1em] text-[color:var(--qp-secondary)] hover:bg-[color:var(--qp-surface-container)] hover:shadow-sm sm:h-14 sm:flex-none sm:gap-3 sm:px-6 sm:text-xs lg:h-16 lg:px-8 lg:text-sm"
        >
          <ArrowLeft className="h-4 w-4 lg:h-5 lg:w-5" />
          <span className="sm:inline">{copy.previous}</span>
        </Button>
      </div>

      {isDone ? (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onDone?.();
          }}
          className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 bg-[color:var(--qp-secondary)] px-3 font-label text-[10px] font-black uppercase tracking-[0.14em] text-white hover:bg-[color:var(--qp-tertiary)] shadow-md hover:shadow-lg transition-all sm:h-14 sm:gap-3 sm:px-8 sm:text-xs lg:h-16 lg:px-12 lg:text-sm"
        >
          <span>{copy.done}</span>
        </Button>
      ) : (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          disabled={index >= total - 1}
          className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 bg-[color:var(--qp-on-primary-container)] px-3 font-label text-[10px] font-black uppercase tracking-[0.14em] text-white hover:bg-[color:var(--qp-primary)] shadow-md hover:shadow-lg transition-all dark:border dark:border-[color:var(--qp-outline-variant)]/45 sm:h-14 sm:gap-3 sm:px-8 sm:text-xs lg:h-16 lg:px-12 lg:text-sm"
        >
          <span>{copy.next}</span>
          <ArrowRight className="h-4 w-4 lg:h-5 lg:w-5" />
        </Button>
      )}
    </div>
  );
}

