"use client";

import type { Question } from "@/types/question";
import { McqOptionsPreview } from "@/components/review/McqOptionsPreview";
import { QuestionEditor } from "@/components/review/QuestionEditor";
import { StoredImage } from "@/components/media/StoredImage";

export type QuestionCardProps = {
  studySetId: string;
  question: Question;
  index: number;
  isEditing: boolean;
  onToggleEdit: () => void;
  onSave: (q: Question) => void;
  onCancel: () => void;
  onDelete: () => void;
  onSetCorrectIndex?: (index: 0 | 1 | 2 | 3) => void;
};

export function QuestionCard({
  studySetId,
  question,
  index,
  isEditing,
  onToggleEdit,
  onSave,
  onCancel,
  onDelete,
  onSetCorrectIndex,
}: QuestionCardProps) {
  return (
    <article className="rounded-lg border border-[var(--d2q-border)] bg-[var(--d2q-surface)] p-4 shadow-md shadow-black/15">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--d2q-text)]">
          {`Q${index}`}
        </h3>
        <div className="flex flex-wrap gap-2">
          {!isEditing ? (
            <button
              type="button"
              onClick={onToggleEdit}
              className="cursor-pointer text-sm font-medium text-[var(--d2q-accent-hover)] underline-offset-2 hover:underline"
            >
              Edit
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDelete}
            className="cursor-pointer text-sm font-medium text-red-400 underline-offset-2 hover:underline"
          >
            Remove
          </button>
        </div>
      </div>

      {isEditing ? (
        <QuestionEditor
          studySetId={studySetId}
          question={question}
          onSave={onSave}
          onCancel={onCancel}
        />
      ) : (
        <div className="mt-3 space-y-2 text-sm text-[var(--d2q-text)]">
          <p className="whitespace-pre-wrap">{question.question}</p>
          {question.questionImageId ? (
            <StoredImage
              mediaId={question.questionImageId}
              alt=""
            />
          ) : null}
          <McqOptionsPreview
            question={question}
            onSetCorrectIndex={onSetCorrectIndex}
            renderAfterOption={(i) => {
              const oid = question.optionImageIds?.[i];
              return oid ? <StoredImage mediaId={oid} alt="" /> : null;
            }}
          />
        </div>
      )}
    </article>
  );
}
