"use client";

import type { Question } from "@/types/question";
import { isMcqComplete } from "@/lib/review/validateMcq";
import { Button } from "@/components/buttons/button";
import { cn } from "@/lib/utils";

export type QuestionReviewFinishProps = {
  statusLine: string;
  canApprove: boolean;
  onDone: () => void;
};

export type QuestionReviewNavigatorProps = {
  questions: Question[];
  activeQuestionId: string | null;
  onSelect: (questionId: string) => void;
  className?: string;
  /** When set, status + Done render in the same card as the navigator (single shell). */
  finish?: QuestionReviewFinishProps;
  /** Only enable an internal scroll region when the navigator would otherwise exceed the viewport. */
  scrollable?: boolean;
};

export function QuestionReviewNavigator({
  questions,
  activeQuestionId,
  onSelect,
  className,
  finish,
  scrollable = false,
}: Readonly<QuestionReviewNavigatorProps>) {
  if (questions.length === 0) {
    return null;
  }

  const header = (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="font-heading text-sm font-bold tracking-tight text-foreground">
        Question navigator
      </h3>
      <span className="font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {questions.length} items
      </span>
    </div>
  );

  const grid = (
    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
      {questions.map((q, i) => {
        const complete = isMcqComplete(q);
        const active = q.id === activeQuestionId;
        return (
          <button
            key={q.id}
            type="button"
            title={`Question ${i + 1}`}
            onClick={() => onSelect(q.id)}
            className={cn(
              "flex aspect-square items-center justify-center rounded-sm border text-[10px] font-bold transition-colors",
              active
                ? "border-d2q-accent bg-chart-4/15 text-chart-4 ring-2 ring-d2q-accent/30"
                : complete
                  ? "border-border bg-muted/40 text-foreground hover:border-d2q-accent/50"
                  : "border-amber-500/40 bg-amber-500/5 text-amber-950 hover:border-amber-500/70 dark:text-amber-50",
            )}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );

  const legend = (
    <p className="mt-3 font-label text-[9px] uppercase tracking-wider text-muted-foreground">
      Amber = incomplete · focus = current
    </p>
  );

  if (finish) {
    return (
      <div
        className={cn(
          "rounded-sm border border-border/60 bg-card/80 shadow-sm backdrop-blur-sm",
          scrollable &&
            "lg:grid lg:max-h-[calc(100dvh-8rem)] lg:grid-rows-[minmax(0,1fr)_auto] lg:overflow-hidden",
          className,
        )}
      >
        <div
          className={cn(
            "px-4 pt-4 pb-4",
            scrollable && "lg:min-h-0 lg:overflow-y-auto lg:pb-3",
          )}
        >
          {header}
          {grid}
          {legend}
        </div>
        <div className="shrink-0 border-t border-border/60 bg-card/95 px-4 py-3 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">
              {finish.statusLine}
            </p>
            <Button
              type="button"
              size="sm"
              className="w-full shrink-0 sm:w-auto"
              disabled={!finish.canApprove}
              onClick={() => void finish.onDone()}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-sm border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      {header}
      {grid}
      {legend}
    </div>
  );
}
