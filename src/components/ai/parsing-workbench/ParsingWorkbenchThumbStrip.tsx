"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ParsingWorkbenchThumbSlot = Readonly<{
  id: number;
  label: string;
  state: "done" | "active" | "queued";
  thumbSrc?: string | null;
}>;

export type ParsingWorkbenchThumbStripProps = Readonly<{
  caption?: string;
  slots: readonly ParsingWorkbenchThumbSlot[];
}>;

export function ParsingWorkbenchThumbStrip({
  caption = "Processing queue view",
  slots,
}: ParsingWorkbenchThumbStripProps) {
  if (slots.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 pt-1">
      <p className="text-center font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {caption}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {slots.map((s) => (
          <div
            key={s.id}
            className={cn(
              "relative flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden transition-colors",
              s.state === "done" &&
                "border border-chart-2/35 bg-accent/25 dark:bg-accent/15",
              s.state === "active" &&
                "-translate-y-1 border-2 border-chart-3 bg-card shadow-lg ring-4 ring-chart-3/20",
              s.state === "queued" &&
                "cursor-not-allowed border border-border/60 bg-muted/50 opacity-45",
            )}
            aria-current={s.state === "active" ? "step" : undefined}
          >
            {s.thumbSrc ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={s.thumbSrc}
                alt=""
                className="absolute inset-0 size-full object-cover object-top"
              />
            ) : null}
            <span
              className={cn(
                "relative z-[1] font-label text-[10px] font-bold tabular-nums",
                s.state === "active" && "text-chart-3",
                s.state === "done" && "text-chart-2",
                s.state === "queued" && "text-muted-foreground",
                s.thumbSrc && s.state === "done" && "rounded-sm bg-background/85 px-0.5 py-px shadow-sm",
                s.thumbSrc && s.state === "active" && "rounded-sm bg-background/90 px-0.5 py-px shadow-sm",
              )}
            >
              {s.label}
            </span>
            {s.state === "done" ? (
              <span className="absolute -top-1 -right-1 z-[2] flex size-4 items-center justify-center rounded-full bg-chart-2 text-white shadow-sm">
                <Check className="size-2.5" strokeWidth={3} aria-hidden />
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
