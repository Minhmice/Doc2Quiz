"use client";

import { cn } from "@/lib/utils";

export type ImportFlowTechnicalDetailsProps = Readonly<{
  lines: readonly string[];
  className?: string;
}>;

export function ImportFlowTechnicalDetails({
  lines,
  className,
}: ImportFlowTechnicalDetailsProps) {
  if (lines.length === 0) {
    return null;
  }
  return (
    <details
      className={cn("text-left", className)}
    >
      <summary className="cursor-pointer font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">
        Technical details
      </summary>
      <ul className="mt-3 max-h-48 list-inside list-disc space-y-1 overflow-y-auto font-mono text-[10px] leading-relaxed text-muted-foreground">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </details>
  );
}
