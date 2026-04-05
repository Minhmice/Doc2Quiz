"use client";

export type QuestionMapProps = {
  total: number;
  currentIndex: number;
  answeredIndices: Set<number>;
  onSelectIndex: (i: number) => void;
};

export function QuestionMap({
  total,
  currentIndex,
  answeredIndices,
  onSelectIndex,
}: QuestionMapProps) {
  if (total <= 0) {
    return null;
  }

  return (
    <div
      className="mt-4 flex flex-wrap gap-2"
      role="list"
      aria-label="Question map"
    >
      {Array.from({ length: total }, (_, i) => {
        const answered = answeredIndices.has(i);
        const current = i === currentIndex;
        return (
          <button
            key={i}
            type="button"
            role="listitem"
            aria-label={`Question ${i + 1}`}
            aria-current={current ? "step" : undefined}
            onClick={() => onSelectIndex(i)}
            className={`flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold transition-colors duration-200 ${
              current
                ? "border-teal-600 bg-teal-50 text-teal-900 ring-2 ring-teal-600/30"
                : answered
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300"
            }`}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
