"use client";

import type { Question } from "@/types/question";

export type PracticeQuestionViewProps = {
  question: Question;
  selectedChoice: 0 | 1 | 2 | 3 | null;
  showFeedback: boolean;
  correctIndex: 0 | 1 | 2 | 3;
  onChoose: (i: 0 | 1 | 2 | 3) => void;
};

export function PracticeQuestionView({
  question,
  selectedChoice,
  showFeedback,
  correctIndex,
  onChoose,
}: PracticeQuestionViewProps) {
  const btnBase =
    "w-full cursor-pointer rounded-lg border px-3 py-2.5 text-left text-sm transition-colors duration-200";

  return (
    <div className="mt-4 space-y-4">
      <p className="whitespace-pre-wrap text-base font-medium text-neutral-900">
        {question.question}
      </p>
      <ul className="space-y-2">
        {question.options.map((opt, i) => {
          const idx = i as 0 | 1 | 2 | 3;
          const letter = String.fromCharCode(65 + i);
          const isSelected = selectedChoice === idx;
          const isCorrect = idx === correctIndex;
          let cls = `${btnBase} border-neutral-200 bg-white text-neutral-800 hover:border-teal-300 hover:bg-teal-50/50`;
          if (showFeedback) {
            if (isCorrect) {
              cls = `${btnBase} border-teal-600 bg-teal-50 text-teal-950`;
            } else if (isSelected && !isCorrect) {
              cls = `${btnBase} border-red-400 bg-red-50 text-red-950`;
            } else {
              cls = `${btnBase} border-neutral-200 bg-neutral-50 text-neutral-500`;
            }
          }
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => onChoose(idx)}
                className={cls}
              >
                <span className="font-semibold text-neutral-600">
                  {letter}
                  <span className="text-neutral-400"> · </span>
                  <span className="text-xs font-normal text-neutral-500">
                    key {i + 1}
                  </span>
                </span>
                <span className="mt-0.5 block pl-0 font-normal">{opt}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
