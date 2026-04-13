"use client";

import { cn } from "@/lib/utils";

export type ParsingWorkbenchMetricsRowProps = Readonly<{
  extractedLabel: string;
  extractedValue: string;
  extractedHint?: string | null;
  currentLabel: string;
  currentValue: string;
  currentHint?: string | null;
  emphasizeCurrent?: boolean;
  elapsedLabel: string;
  elapsedHint?: string | null;
}>;

function MetricTile({
  label,
  value,
  hint,
  borderClass,
  emphasize,
}: Readonly<{
  label: string;
  value: string;
  hint?: string | null;
  borderClass: string;
  emphasize?: boolean;
}>) {
  return (
    <div
      className={cn(
        "border-t-4 bg-card p-5 text-center shadow-sm",
        borderClass,
        emphasize &&
          "z-10 scale-[1.02] ring-4 ring-chart-3/15 dark:ring-chart-3/25",
      )}
    >
      <p className="mb-2 font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="font-heading text-3xl font-black tabular-nums tracking-tight text-chart-4 dark:text-accent-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[9px] font-bold text-chart-2">{hint}</p>
      ) : null}
    </div>
  );
}

export function ParsingWorkbenchMetricsRow({
  extractedLabel,
  extractedValue,
  extractedHint,
  currentLabel,
  currentValue,
  currentHint,
  emphasizeCurrent,
  elapsedLabel,
  elapsedHint,
}: ParsingWorkbenchMetricsRowProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
      <MetricTile
        label={extractedLabel}
        value={extractedValue}
        hint={extractedHint}
        borderClass="border-chart-2"
      />
      <MetricTile
        label={currentLabel}
        value={currentValue}
        hint={currentHint}
        borderClass="border-chart-3"
        emphasize={emphasizeCurrent}
      />
      <MetricTile
        label="Time elapsed"
        value={elapsedLabel}
        hint={elapsedHint}
        borderClass="border-chart-2"
      />
    </div>
  );
}
