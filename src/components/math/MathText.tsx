"use client";

import { splitMathSegments } from "@/lib/math/splitMathSegments";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

export type MathTextProps = {
  source: string;
  className?: string;
  /** 0 = update as soon as `source` changes (default). Editor should pass 300–500. */
  debounceMs?: number;
};

function useDebouncedSource(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (ms <= 0) {
      setDebounced(value);
      return;
    }
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * Plain-text math segments until MathJax is re-enabled in a later phase.
 * Preserves delimiter splitting so wiring MathJax back in stays localized.
 */
export function MathText({ source, className, debounceMs = 0 }: MathTextProps) {
  const debouncedSource = useDebouncedSource(source, debounceMs ?? 0);
  const segments = useMemo(
    () => splitMathSegments(debouncedSource),
    [debouncedSource],
  );

  return (
    <span className={cn("math-text-root inline-block max-w-full", className)}>
      {segments.map((seg, idx) =>
        seg.kind === "text" ? (
          <span key={idx} className="whitespace-pre-wrap">
            {seg.value}
          </span>
        ) : (
          <span
            key={idx}
            className={cn(
              "font-mono text-[0.95em] text-foreground/90",
              seg.display && "block my-1",
            )}
          >
            {seg.display ? `$$${seg.value}$$` : `$${seg.value}$`}
          </span>
        ),
      )}
    </span>
  );
}
