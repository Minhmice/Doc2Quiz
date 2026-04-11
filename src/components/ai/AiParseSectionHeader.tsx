"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export function AiParseSectionHeader({ hasKey }: { hasKey: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2
        id="ai-parse-heading"
        className="text-lg font-semibold tracking-tight text-foreground"
      >
        Parse with AI
      </h2>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {hasKey ? (
          <Badge
            variant="secondary"
            className="border border-emerald-500/30 bg-emerald-950/40 text-emerald-400"
          >
            API key set
          </Badge>
        ) : (
          <Link
            href="/settings"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Configure API in Settings
          </Link>
        )}
      </div>
    </div>
  );
}
