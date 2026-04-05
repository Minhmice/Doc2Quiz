"use client";

import type { Question } from "@/types/question";
import { QuestionCard } from "@/components/review/QuestionCard";

export type ReviewListProps = {
  studySetId: string;
  questions: Question[];
  editingId: string | null;
  onEditRequest: (id: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, next: Question) => void | Promise<void>;
  onDelete: (id: string) => void;
  onSetCorrectIndex?: (id: string, index: 0 | 1 | 2 | 3) => void;
};

export function ReviewList({
  studySetId,
  questions,
  editingId,
  onEditRequest,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onSetCorrectIndex,
}: ReviewListProps) {
  return (
    <ul className="mt-6 space-y-4">
      {questions.map((question, i) => (
        <li key={question.id}>
          <QuestionCard
            studySetId={studySetId}
            question={question}
            index={i + 1}
            isEditing={question.id === editingId}
            onToggleEdit={() => onEditRequest(question.id)}
            onSave={(q) => void onSaveEdit(question.id, q)}
            onCancel={onCancelEdit}
            onDelete={() => onDelete(question.id)}
            onSetCorrectIndex={
              onSetCorrectIndex
                ? (idx) => onSetCorrectIndex(question.id, idx)
                : undefined
            }
          />
        </li>
      ))}
    </ul>
  );
}
