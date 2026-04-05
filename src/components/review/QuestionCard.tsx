"use client";

import type { Question } from "@/types/question";
import { QuestionEditor } from "@/components/review/QuestionEditor";

export type QuestionCardProps = {
  question: Question;
  index: number;
  isEditing: boolean;
  onToggleEdit: () => void;
  onSave: (q: Question) => void;
  onCancel: () => void;
  onDelete: () => void;
};

export function QuestionCard({
  question,
  index,
  isEditing,
  onToggleEdit,
  onSave,
  onCancel,
  onDelete,
}: QuestionCardProps) {
  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">
          {`Q${index}`}
        </h3>
        <div className="flex flex-wrap gap-2">
          {!isEditing ? (
            <button
              type="button"
              onClick={onToggleEdit}
              className="cursor-pointer text-sm font-medium text-teal-800 underline-offset-2 hover:underline"
            >
              Edit
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDelete}
            className="cursor-pointer text-sm font-medium text-red-700 underline-offset-2 hover:underline"
          >
            Remove
          </button>
        </div>
      </div>

      {isEditing ? (
        <QuestionEditor
          question={question}
          onSave={onSave}
          onCancel={onCancel}
        />
      ) : (
        <div className="mt-3 space-y-2 text-sm text-neutral-800">
          <p className="whitespace-pre-wrap">{question.question}</p>
          <ol className="list-none space-y-1 pl-0">
            {question.options.map((opt, i) => (
              <li key={i}>
                <span className="font-medium text-neutral-600">
                  {String.fromCharCode(65 + i)}.
                </span>{" "}
                {opt}
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}
