"use client";

import { cn } from "@/lib/utils";

type HintItem = {
  key: string;
  label: string;
};

export function QuizInteractionHints({
  items = [
    { key: "1–4", label: "Choose" },
    { key: "← →", label: "Navigation" },
  ],
  className,
}: Readonly<{
  items?: readonly HintItem[];
  className?: string;
}>) {
  return (
    <div
      className={cn(
        "mt-2 sm:mt-3 lg:mt-6 hidden md:flex flex-wrap justify-center gap-3 sm:gap-6 px-4",
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.key}
          className="flex items-center gap-2 border border-[color:var(--qp-outline-variant)]/15 bg-[color:var(--qp-surface-container-lowest)]/50 backdrop-blur-sm px-4 py-2.5 shadow-sm"
        >
          <span className="font-label text-sm sm:text-base font-bold uppercase tracking-widest text-[color:var(--qp-tertiary)]">
            {item.key}
          </span>
          <span className="font-label text-xs sm:text-sm uppercase tracking-[0.15em] text-[color:var(--qp-muted)]">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

