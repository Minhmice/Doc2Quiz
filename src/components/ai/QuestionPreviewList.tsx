import type { Question } from "@/types/question";
import { McqOptionsPreview } from "@/components/review/McqOptionsPreview";

export type QuestionPreviewListProps = {
  questions: Question[];
  onSetCorrectIndex?: (questionId: string, index: 0 | 1 | 2 | 3) => void;
};

export function QuestionPreviewList({
  questions,
  onSetCorrectIndex,
}: QuestionPreviewListProps) {
  if (questions.length === 0) {
    return null;
  }

  return (
    <ul className="mt-4 space-y-3" aria-label="Parsed questions preview">
      {questions.map((q) => (
        <li key={q.id}>
          <article
            className="rounded-lg border border-[var(--d2q-border)] bg-[var(--d2q-surface)] p-4 shadow-md shadow-black/15"
            aria-label={`Question: ${q.question.slice(0, 80)}${q.question.length > 80 ? "…" : ""}`}
          >
            <p className="text-sm font-medium text-[var(--d2q-text)]">{q.question}</p>
            <McqOptionsPreview
              question={q}
              onSetCorrectIndex={
                onSetCorrectIndex
                  ? (idx) => onSetCorrectIndex(q.id, idx)
                  : undefined
              }
              listClassName="mt-3 list-none space-y-2 p-0"
            />
          </article>
        </li>
      ))}
    </ul>
  );
}
