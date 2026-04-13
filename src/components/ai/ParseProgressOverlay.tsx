"use client";

import { ParseProgressWorkbenchPanel } from "@/components/ai/parsing-workbench/ParseProgressWorkbenchPanel";

export function ParseProgressOverlay(
  props: Readonly<{
    studySetId: string;
    onCancel?: () => void;
  }>,
) {
  return <ParseProgressWorkbenchPanel {...props} variant="standalone" />;
}
