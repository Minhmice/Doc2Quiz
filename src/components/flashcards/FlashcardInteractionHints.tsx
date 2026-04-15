"use client";

export function FlashcardInteractionHints() {
  return (
    <div className="mt-2 sm:mt-3 lg:mt-6 hidden md:flex flex-wrap justify-center gap-3 sm:gap-6 px-4">
      <div className="flex items-center gap-2 border border-[color:var(--qp-outline-variant)]/15 bg-[color:var(--qp-surface-container-lowest)]/50 backdrop-blur-sm px-4 py-2.5 shadow-sm">
        <span className="font-label text-sm sm:text-base font-bold uppercase tracking-widest text-[color:var(--qp-tertiary)]">
          SPACE
        </span>
        <span className="font-label text-xs sm:text-sm uppercase tracking-[0.15em] text-[color:var(--qp-muted)]">
          Flip Card
        </span>
      </div>
      <div className="flex items-center gap-2 border border-[color:var(--qp-outline-variant)]/15 bg-[color:var(--qp-surface-container-lowest)]/50 backdrop-blur-sm px-4 py-2.5 shadow-sm">
        <span className="font-label text-sm sm:text-base font-bold uppercase tracking-widest text-[color:var(--qp-tertiary)]">
          ← →
        </span>
        <span className="font-label text-xs sm:text-sm uppercase tracking-[0.15em] text-[color:var(--qp-muted)]">
          Navigate
        </span>
      </div>
    </div>
  );
}

