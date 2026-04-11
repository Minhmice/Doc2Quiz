"use client";

import type { ParseStrategy } from "@/lib/ai/parseLocalStorage";
import { Label } from "@/components/ui/label";

type Props = {
  parseStrategy: ParseStrategy;
  parseStrategyGroupId: string;
  onSelectStrategy: (s: ParseStrategy) => void;
};

export function AiParseParseStrategyPanel({
  parseStrategy,
  parseStrategyGroupId,
  onSelectStrategy,
}: Props) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <Label
        id={`${parseStrategyGroupId}-label`}
        className="text-sm font-medium text-foreground"
      >
        Parse strategy
      </Label>
      <div
        className="flex flex-col gap-2 text-sm"
        role="radiogroup"
        aria-labelledby={`${parseStrategyGroupId}-label`}
      >
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            className="mt-1 size-4 shrink-0 cursor-pointer accent-primary"
            name={parseStrategyGroupId}
            checked={parseStrategy === "fast"}
            onChange={() => onSelectStrategy("fast")}
          />
          <span>
            <span className="font-medium text-foreground">Fast</span>
            <span className="block text-muted-foreground">
              OCR layout chunks → small text prompts; full-page vision only if
              chunks fail. Needs OCR enabled.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            className="mt-1 size-4 shrink-0 cursor-pointer accent-primary"
            name={parseStrategyGroupId}
            checked={parseStrategy === "hybrid"}
            onChange={() => onSelectStrategy("hybrid")}
          />
          <span>
            <span className="font-medium text-foreground">Hybrid</span>
            <span className="block text-muted-foreground">
              Uses Fast when OCR looks strong (≥85% pages successful, no failed
              pages); otherwise full vision like Accurate.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            className="mt-1 size-4 shrink-0 cursor-pointer accent-primary"
            name={parseStrategyGroupId}
            checked={parseStrategy === "accurate"}
            onChange={() => onSelectStrategy("accurate")}
          />
          <span>
            <span className="font-medium text-foreground">Accurate</span>
            <span className="block text-muted-foreground">
              Full-page vision parse (same as before). Highest recall on hard
              layouts.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
