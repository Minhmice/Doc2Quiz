"use client";

import type { ReactNode } from "react";
import { hasValidCorrectIndex } from "@/lib/review/validateMcq";
import type { Question } from "@/types/question";

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
                  ? "border-emerald-500/60 bg-emerald-950/40 text-[var(--d2q-text)]"
                  : "border-[var(--d2q-border)] bg-[var(--d2q-bg)] text-[var(--d2q-text)]"
              }`}
            >
              <span
                className={`inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded text-xs font-semibold ${
                  isCorrect
                    ? "bg-emerald-600 text-white"
                    : "bg-[var(--d2q-surface-elevated)] text-[var(--d2q-muted)] ring-1 ring-[var(--d2q-border)]"
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
                <button
                  key={label}
                  type="button"
                  onClick={() => onSetCorrectIndex(i)}
                  className="cursor-pointer rounded-md border border-[var(--d2q-accent-warm)]/50 bg-[var(--d2q-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--d2q-accent-warm)] shadow-sm transition-colors hover:bg-orange-950/30"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
