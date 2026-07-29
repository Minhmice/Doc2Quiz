"use client";

import { LocalizedSlangLine } from "@/components/locale/LocalizedCopy";
import { useLocale } from "@/components/locale/LocaleProvider";
import { ConversionProgressShell, type ConversionStep } from "@/components/processing/conversion-progress";
import { Button } from "@/components/ui/button";

export type QuizGenerateProgressState = "generating" | "success" | "error";
export type QuizGenerateProgressCardProps = Readonly<{ state: QuizGenerateProgressState; recommendedCount?: number; generatedCount?: number; errorMessage?: string; onTryAgain?: () => void }>;

export function QuizGenerateProgressCard({ state, recommendedCount, generatedCount, errorMessage, onTryAgain }: QuizGenerateProgressCardProps) {
  const { messages } = useLocale();
  const copy = messages.pipeline.quiz;
  const isGenerating = state === "generating";
  const isError = state === "error";
  const showThinContentNote = !isError && recommendedCount != null && generatedCount != null && generatedCount < recommendedCount;
  const labels = copy.steps;
  const steps: ConversionStep[] = Object.entries(labels).map(([key, label], index) => ({
    key, label, status: state === "success" ? "complete" : index === 0 ? "complete" : index === 1 ? "active" : "pending",
  }));
  const title = isError ? errorMessage ?? copy.fallbackError : state === "success" && generatedCount != null && recommendedCount != null ? copy.successCount(generatedCount, recommendedCount) : copy.title;
  const countSubtitle = !isError && (recommendedCount != null || generatedCount != null) ? copy.count(recommendedCount ?? "—", generatedCount ?? "—") : undefined;

  return <ConversionProgressShell
    error={isError}
    meta={isError ? undefined : isGenerating ? copy.metaGenerating : copy.metaComplete}
    title={title}
    subtitle={isError ? undefined : isGenerating ? copy.subtitle : countSubtitle}
    slang={isError ? undefined : <LocalizedSlangLine context={state === "success" ? "success" : "quizGeneration"} eventKey={state} />}
    steps={isError ? [] : steps}
    showBar={isGenerating}
    footer={<>{showThinContentNote ? <p className="text-sm text-muted-foreground text-pretty">{copy.thinContent}</p> : null}{isError && onTryAgain ? <Button type="button" onClick={onTryAgain}>{messages.retry.action}</Button> : null}</>}
  />;
}
