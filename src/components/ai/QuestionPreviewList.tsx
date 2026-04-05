import type { Question } from "@/types/question";

const LABELS = ["A", "B", "C", "D"] as const;

export type QuestionPreviewListProps = {
  questions: Question[];
};

export function QuestionPreviewList({ questions }: QuestionPreviewListProps) {
  if (questions.length === 0) {
    return null;
  }

  return (
    <ul className="mt-4 space-y-3" aria-label="Parsed questions preview">
      {questions.map((q) => (
        <li key={q.id}>
          <article
            className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
            aria-label={`Question: ${q.question.slice(0, 80)}${q.question.length > 80 ? "…" : ""}`}
          >
            <p className="text-sm font-medium text-neutral-900">{q.question}</p>
            <ol className="mt-3 list-none space-y-2 p-0">
              {q.options.map((opt, idx) => {
                const isCorrect = idx === q.correctIndex;
                return (
                  <li
                    key={idx}
                    className={`flex gap-2 rounded-md border px-3 py-2 text-sm transition-colors duration-200 ${
                      isCorrect
                        ? "border-teal-600 bg-teal-50 text-neutral-900"
                        : "border-neutral-100 bg-neutral-50/80 text-neutral-800"
                    }`}
                  >
                    <span
                      className={`inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded text-xs font-semibold ${
                        isCorrect
                          ? "bg-teal-700 text-white"
                          : "bg-neutral-200 text-neutral-700"
                      }`}
                      aria-hidden
                    >
                      {LABELS[idx]}
                    </span>
                    <span className="min-w-0 flex-1 leading-snug">{opt}</span>
                    {isCorrect ? (
                      <span className="sr-only">(correct answer)</span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </article>
        </li>
      ))}
    </ul>
  );
}
