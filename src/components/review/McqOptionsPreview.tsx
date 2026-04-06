"use client";

import type { ReactNode } from "react";
import { hasValidCorrectIndex } from "@/lib/review/validateMcq";
import type { Question } from "@/types/question";
import { Button } from "@/components/ui/button";

const LABELS = ["A", "B", "C", "D"] as const;

export type McqOptionsPreviewProps = {
  question: Question;
  onSetCorrectIndex?: (index: 0 | 1 | 2 | 3) => void;
  /** Rendered below each option’s text (e.g. stored images). */
  renderAfterOption?: (index: 0 | 1 | 2 | 3) => ReactNode;
  listClassName?: string;
};

export function McqOptionsPreview({
  question,
  onSetCorrectIndex,
  renderAfterOption,
  listClassName = "mt-3 list-none space-y-2 p-0",
}: McqOptionsPreviewProps) {
  const valid = hasValidCorrectIndex(question);
  const { options, correctIndex } = question;

  return (
    <div className="space-y-2">
      <ol className={listClassName}>
        {options.map((opt, idx) => {
          const i = idx as 0 | 1 | 2 | 3;
          const isCorrect = valid && idx === correctIndex;
          return (
            <li
              key={idx}
              className={`flex gap-2 rounded-md border px-3 py-2 text-sm transition-colors duration-200 ${
                isCorrect
                  ? "border-emerald-500/60 bg-emerald-950/40 text-foreground"
                  : "border-border bg-background text-foreground"
              }`}
            >
              <span
                className={`inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded text-xs font-semibold ${
                  isCorrect
                    ? "bg-emerald-600 text-white"
                    : "bg-muted text-muted-foreground ring-1 ring-border"
                }`}
                aria-hidden
              >
                {LABELS[idx]}
              </span>
              <span className="min-w-0 flex-1 leading-snug">
                {opt}
                {renderAfterOption?.(i) ? (
                  <span className="mt-1 block">{renderAfterOption(i)}</span>
                ) : null}
              </span>
              {isCorrect ? (
                <span className="sr-only">(correct answer)</span>
              ) : null}
            </li>
          );
        })}
      </ol>

      {!valid && onSetCorrectIndex ? (
        <div className="rounded-md border border-orange-500/30 bg-orange-950/35 px-3 py-2 text-sm text-amber-100">
          <p className="font-medium text-amber-200">No correct answer set</p>
          <p className="mt-1 text-xs text-amber-100/90">
            Pick A–D below to mark the correct choice.
          </p>
          <div
            className="mt-2 flex flex-wrap gap-2"
            role="group"
            aria-label="Set correct answer"
          >
            {LABELS.map((label, idx) => {
              const i = idx as 0 | 1 | 2 | 3;
              return (
                <Button
                  key={label}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-orange-500/50 text-orange-400 hover:bg-orange-950/30"
                  onClick={() => onSetCorrectIndex(i)}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
