"use client";

import { ScrollArea } from "@/components/ui/scroll-area";

export type ParsingWorkbenchLogProps = Readonly<{
  lines: readonly string[];
  title?: string;
  emptyHint?: string;
}>;

export function ParsingWorkbenchLog({
  lines,
  title = "Activity feed",
  emptyHint = "Waiting for log lines…",
}: ParsingWorkbenchLogProps) {
  return (
    <div className="border-t border-border pt-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-label text-[10px] font-black uppercase tracking-widest text-chart-2">
          <span
            className="size-1.5 shrink-0 rounded-full bg-chart-2 motion-safe:animate-pulse"
            aria-hidden
          />
          {title}
        </h3>
      </div>
      <ScrollArea className="h-[9rem] rounded-md border border-border/80 bg-muted/25 pr-2">
        {lines.length === 0 ? (
          <p className="p-3 font-mono text-[10px] text-muted-foreground">{emptyHint}</p>
        ) : (
          <ul className="space-y-1.5 p-2 text-left">
            {lines.map((line, i) => (
              <li
                key={`${i}-${line.slice(0, 32)}`}
                className="font-mono text-[10px] leading-snug text-foreground/90"
              >
                {line}
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
