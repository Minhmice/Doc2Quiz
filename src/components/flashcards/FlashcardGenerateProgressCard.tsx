"use client";

import { LocalizedSlangLine } from "@/components/locale/LocalizedCopy";
import { useLocale } from "@/components/locale/LocaleProvider";
import { ConversionProgressShell, type ConversionStep } from "@/components/processing/conversion-progress";
import { Button } from "@/components/ui/button";

export type FlashcardGenerateProgressState = "generating" | "success" | "error";
export type FlashcardGenerateProgressCardProps = Readonly<{ status: FlashcardGenerateProgressState; recommendedCount?: number; generatedCount?: number; detectedFormat?: string; errorMessage?: string; onRetry?: () => void }>;

export function FlashcardGenerateProgressCard({ status, recommendedCount, generatedCount, detectedFormat, errorMessage, onRetry }: FlashcardGenerateProgressCardProps) {
  const { messages } = useLocale();
  const copy = messages.pipeline.flashcards;
  const isGenerating = status === "generating";
  const isError = status === "error";
  const showThinContentNote = !isError && recommendedCount != null && generatedCount != null && generatedCount < recommendedCount;
  const steps: ConversionStep[] = Object.entries(copy.steps).map(([key, label], index) => ({
    key, label, status: status === "success" ? "complete" : index === 0 ? "complete" : index === 1 ? "active" : "pending",
  }));
  const knownFormat = detectedFormat && detectedFormat in copy.formats ? copy.formats[detectedFormat as keyof typeof copy.formats] : detectedFormat;
  const countSubtitle = !isError && (recommendedCount != null || generatedCount != null) ? copy.count(recommendedCount ?? "—", generatedCount ?? "—") : undefined;
  const formatSubtitle = !isError && knownFormat ? copy.format(knownFormat) : undefined;
  const subtitle = isError ? undefined : isGenerating ? copy.subtitle : [countSubtitle, formatSubtitle].filter(Boolean).join(" · ") || undefined;
  const title = isError ? errorMessage ?? copy.fallbackError : status === "success" && generatedCount != null && recommendedCount != null ? copy.successCount(generatedCount, recommendedCount) : copy.title;

  return <ConversionProgressShell
    error={isError}
    meta={isError ? undefined : isGenerating ? copy.metaGenerating : copy.metaComplete}
    title={title}
    subtitle={subtitle}
    slang={isError ? undefined : <LocalizedSlangLine context={status === "success" ? "success" : "flashcardGeneration"} eventKey={status} />}
    steps={isError ? [] : steps}
    showBar={isGenerating}
    footer={<>{showThinContentNote ? <p className="text-sm text-muted-foreground text-pretty">{copy.thinContent}</p> : null}{isError && onRetry ? <Button type="button" onClick={onRetry}>{messages.retry.action}</Button> : null}</>}
  />;
}
