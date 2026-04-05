"use client";

import type { Question } from "@/types/question";
import { QuestionCard } from "@/components/review/QuestionCard";

export type ReviewListProps = {
  questions: Question[];
  editingId: string | null;
  onEditRequest: (id: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, next: Question) => void;
  onDelete: (id: string) => void;
};

export function ReviewList({
  questions,
  editingId,
  onEditRequest,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: ReviewListProps) {
  return (
    <ul className="mt-6 space-y-4">
      {questions.map((question, i) => (
        <li key={question.id}>
          <QuestionCard
            question={question}
            index={i + 1}
            isEditing={question.id === editingId}
            onToggleEdit={() => onEditRequest(question.id)}
            onSave={(q) => onSaveEdit(question.id, q)}
            onCancel={onCancelEdit}
            onDelete={() => onDelete(question.id)}
          />
        </li>
      ))}
    </ul>
  );
}
