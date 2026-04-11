"use client";

import type { Question } from "@/types/question";
import {
  buildMappingQualityTooltip,
  getMappingQualityTier,
} from "@/lib/learning";
import { Badge } from "@/components/ui/badge";

export function MappingQualityBadge({ question }: { question: Question }) {
  const tier = getMappingQualityTier(question);
  const title = buildMappingQualityTooltip(question);

  if (tier === "unresolved") {
    return (
      <Badge
        variant="destructive"
        className="text-xs"
        title={title}
      >
        Unresolved
      </Badge>
    );
  }

  if (tier === "uncertain") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/60 text-xs text-amber-950 dark:text-amber-100"
        title={title}
      >
        Uncertain
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="text-xs" title={title}>
      Mapped
    </Badge>
  );
}
