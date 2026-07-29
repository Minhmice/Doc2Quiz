"use client";

import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export type StreakFlameChipProps = Readonly<{
  className?: string;
  /** True when pointer is anywhere on the parent streak stat card */
  isCardHovered: boolean;
}>;

export function StreakFlameChip({
  className,
  isCardHovered,
}: StreakFlameChipProps) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg p-3 text-[color:var(--d2q-accent)] transition-colors duration-200",
        isCardHovered
          ? "bg-[color:var(--d2q-accent)]/24"
          : "bg-[color:var(--d2q-accent)]/15",
        className,
      )}
    >
      <Flame className="size-6" aria-hidden />
    </div>
  );
}
