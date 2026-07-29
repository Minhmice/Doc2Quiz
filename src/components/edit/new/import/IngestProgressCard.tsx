"use client";

import { ImportFlowTechnicalDetails } from "@/components/edit/new/import/ImportFlowTechnicalDetails";
import { LocalizedSlangLine } from "@/components/locale/LocalizedCopy";
import { useLocale } from "@/components/locale/LocaleProvider";
import { ConversionProgressShell, type ConversionStep } from "@/components/processing/conversion-progress";

export type IngestProgressStep = "validating" | "uploading" | "converting" | "error";
export type IngestProgressCardProps = Readonly<{ step: IngestProgressStep; errorMessage?: string; technicalDetails?: readonly string[]; showUploadStep?: boolean }>;
const STEP_KEYS = ["validating", "uploading", "converting"] as const;

function stepIndex(step: IngestProgressStep): number {
  if (step === "validating") return 0;
  if (step === "uploading") return 1;
  return 2;
}

export function IngestProgressCard({ step, errorMessage, technicalDetails = [], showUploadStep = true }: IngestProgressCardProps) {
  const { messages } = useLocale();
  const copy = messages.pipeline.ingest;
  const isError = step === "error";
  const visibleKeys = showUploadStep ? STEP_KEYS : STEP_KEYS.filter((key) => key !== "uploading");
  const activeIndex = isError ? -1 : stepIndex(step);
  const steps: ConversionStep[] = visibleKeys.map((key) => {
    const index = STEP_KEYS.indexOf(key);
    return { key, label: copy.steps[key], status: activeIndex > index ? "complete" : activeIndex === index ? "active" : "pending" };
  });
  const currentStep = isError ? 0 : Math.min(stepIndex(step) + 1, visibleKeys.length);
  const slangContext = step === "converting" ? "conversion" : "upload";

  return <ConversionProgressShell
    error={isError}
    meta={isError ? undefined : copy.stepCount(currentStep, visibleKeys.length)}
    title={isError ? errorMessage ?? copy.fallbackError : copy.titles[step]}
    subtitle={isError ? undefined : copy.subtitles[step]}
    slang={isError ? undefined : <LocalizedSlangLine context={slangContext} eventKey={step} />}
    steps={isError ? [] : steps}
    footer={technicalDetails.length > 0 ? <ImportFlowTechnicalDetails lines={technicalDetails} /> : undefined}
  />;
}
