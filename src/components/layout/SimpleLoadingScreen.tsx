"use client";

import { cn } from "@/lib/utils";

export interface SimpleLoadingScreenProps {
  message?: string;
  className?: string;
}

export function SimpleLoadingScreen({
  message = "Loading…",
  className,
}: SimpleLoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-[40vh] flex-col items-center justify-center gap-2 p-8 text-center",
        className,
      )}
    >
      <span className="sr-only">{message}</span>
      <p className="font-label text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
