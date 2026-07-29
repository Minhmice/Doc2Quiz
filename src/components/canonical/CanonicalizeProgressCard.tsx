"use client";

import { LocalizedSlangLine } from "@/components/locale/LocalizedCopy";
import { useLocale } from "@/components/locale/LocaleProvider";
import { ConversionProgressShell, type ConversionStep } from "@/components/processing/conversion-progress";

export type CanonicalizeProgressCardProps = Readonly<{ error?: boolean; errorMessage?: string; showSubcopy?: boolean }>;

export function CanonicalizeProgressCard({ error = false, errorMessage, showSubcopy = true }: CanonicalizeProgressCardProps) {
  const { messages } = useLocale();
  const copy = messages.pipeline.canonical;
  const steps: ConversionStep[] = [
    { key: "structure", label: copy.steps.structure, status: "active" },
    { key: "language", label: copy.steps.language, status: "pending" },
    { key: "sections", label: copy.steps.sections, status: "pending" },
  ];

  return <ConversionProgressShell
    error={error}
    title={error ? errorMessage ?? copy.fallbackError : copy.title}
    subtitle={error || !showSubcopy ? undefined : copy.subtitle}
    slang={error ? undefined : <LocalizedSlangLine context="conversion" eventKey="canonicalizing" />}
    steps={error ? [] : steps}
  />;
}
