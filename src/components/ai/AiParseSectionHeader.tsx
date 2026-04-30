"use client";

import { Badge } from "@/components/ui/badge";

export function AiParseSectionHeader({
  processingReady,
}: {
  processingReady: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2
        id="ai-parse-heading"
        className="text-lg font-semibold tracking-tight text-foreground"
      >
        Parse with AI
      </h2>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {processingReady ? (
          <Badge
            variant="secondary"
            className="border border-emerald-500/30 bg-emerald-950/40 text-emerald-400"
          >
            Processing ready
          </Badge>
        ) : (
          <span className="text-muted-foreground">
            Document processing is temporarily unavailable.
          </span>
        )}
      </div>
    </div>
  );
}
