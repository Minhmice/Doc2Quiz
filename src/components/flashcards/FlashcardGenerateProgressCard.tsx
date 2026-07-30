"use client";

import { useMemo } from "react";

import { LocalizedSlangLine } from "@/components/locale/LocalizedCopy";
import { useLocale } from "@/components/locale/LocaleProvider";
import {
  ConversionProgressShell,
  type ConversionStep,
} from "@/components/processing/conversion-progress";
import { Button } from "@/components/ui/button";
import {
  groupFlashcardSourcesByDocument,
  type FlashcardCanonicalSourceOption,
} from "@/lib/client/flashcardGenerateStudySet";

export type FlashcardGenerateProgressState =
  | "selecting"
  | "generating"
  | "success"
  | "error"
  | "quota_blocked";

export type FlashcardGenerateProgressCardProps = Readonly<{
  status?: FlashcardGenerateProgressState;
  /** @deprecated Prefer `status`. Kept for callers still using state naming. */
  state?: FlashcardGenerateProgressState;
  recommendedCount?: number;
  generatedCount?: number;
  detectedFormat?: string;
  errorMessage?: string;
  onRetry?: () => void;
  weekResetsAt?: string;
  /** Completed canonical versions grouped by document for explicit selection. */
  sources?: FlashcardCanonicalSourceOption[];
  selectedVersionIds?: string[];
  onSelectedVersionIdsChange?: (ids: string[]) => void;
  onGenerate?: () => void;
}>;

function formatSourceDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function FlashcardGenerateProgressCard({
  status,
  state,
  recommendedCount,
  generatedCount,
  detectedFormat,
  errorMessage,
  onRetry,
  weekResetsAt,
  sources,
  selectedVersionIds,
  onSelectedVersionIdsChange,
  onGenerate,
}: FlashcardGenerateProgressCardProps) {
  const { messages } = useLocale();
  const copy = messages.pipeline.flashcards;
  const resolvedStatus = status ?? state ?? "generating";
  const isGenerating = resolvedStatus === "generating";
  const isError = resolvedStatus === "error";
  const isSelecting = resolvedStatus === "selecting";
  const isQuotaBlocked = resolvedStatus === "quota_blocked";

  const groupedSources = useMemo(
    () => groupFlashcardSourcesByDocument(sources ?? []),
    [sources],
  );
  const selected = new Set(selectedVersionIds ?? []);

  if (isQuotaBlocked) {
    const reset = weekResetsAt
      ? new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(weekResetsAt))
      : undefined;
    return (
      <ConversionProgressShell
        error
        title={copy.fallbackError}
        subtitle={
          reset
            ? `Weekly generation quota exceeded. Resets ${reset}.`
            : "Weekly generation quota exceeded."
        }
        steps={[]}
        showBar={false}
        footer={
          onRetry ? (
            <Button type="button" onClick={onRetry}>
              {messages.retry.action}
            </Button>
          ) : undefined
        }
      />
    );
  }

  if (isSelecting && groupedSources.length > 0) {
    const toggle = (id: string) => {
      if (!onSelectedVersionIdsChange) return;
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelectedVersionIdsChange([...next]);
    };

    return (
      <ConversionProgressShell
        meta="Source selection"
        title={copy.title}
        subtitle="Choose one or more completed canonical versions. Only version IDs are sent — markdown and checksums stay on the server."
        steps={[]}
        showBar={false}
        footer={
          <div className="flex w-full flex-col gap-4">
            <div className="max-h-72 space-y-4 overflow-y-auto text-left">
              {groupedSources.map((group) => (
                <section key={group.documentId} className="space-y-2">
                  <h3 className="font-heading text-sm font-semibold tracking-tight">
                    {group.documentTitle}
                  </h3>
                  <ul className="space-y-2">
                    {group.versions.map((version) => {
                      const checked = selected.has(version.canonicalVersionId);
                      const label = `v${version.versionNumber} · ${version.provenanceLabel} · ${formatSourceDate(version.createdAt)}`;
                      return (
                        <li key={version.canonicalVersionId}>
                          <label className="flex cursor-pointer items-start gap-3 text-sm">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={checked}
                              onChange={() =>
                                toggle(version.canonicalVersionId)
                              }
                            />
                            <span className="text-pretty text-muted-foreground">
                              <span className="font-medium text-foreground">
                                Version {version.versionNumber}
                              </span>
                              <span className="block">{label}</span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
            {onGenerate ? (
              <Button
                type="button"
                disabled={selected.size < 1}
                onClick={onGenerate}
              >
                Generate flashcards
              </Button>
            ) : null}
            {selected.size < 1 ? (
              <p className="text-sm text-muted-foreground">
                Select at least one completed version to continue.
              </p>
            ) : null}
          </div>
        }
      />
    );
  }

  const showThinContentNote =
    !isError &&
    recommendedCount != null &&
    generatedCount != null &&
    generatedCount < recommendedCount;
  const steps: ConversionStep[] = Object.entries(copy.steps).map(
    ([key, label], index) => ({
      key,
      label,
      status:
        resolvedStatus === "success"
          ? "complete"
          : index === 0
            ? "complete"
            : index === 1
              ? "active"
              : "pending",
    }),
  );
  const knownFormat =
    detectedFormat && detectedFormat in copy.formats
      ? copy.formats[detectedFormat as keyof typeof copy.formats]
      : detectedFormat;
  const countSubtitle =
    !isError && (recommendedCount != null || generatedCount != null)
      ? copy.count(recommendedCount ?? "—", generatedCount ?? "—")
      : undefined;
  const formatSubtitle =
    !isError && knownFormat ? copy.format(knownFormat) : undefined;
  const subtitle = isError
    ? undefined
    : isGenerating
      ? copy.subtitle
      : [countSubtitle, formatSubtitle].filter(Boolean).join(" · ") ||
        undefined;
  const title = isError
    ? (errorMessage ?? copy.fallbackError)
    : resolvedStatus === "success" &&
        generatedCount != null &&
        recommendedCount != null
      ? copy.successCount(generatedCount, recommendedCount)
      : copy.title;

  return (
    <ConversionProgressShell
      error={isError}
      meta={
        isError
          ? undefined
          : isGenerating
            ? copy.metaGenerating
            : copy.metaComplete
      }
      title={title}
      subtitle={subtitle}
      slang={
        isError ? undefined : (
          <LocalizedSlangLine
            context={
              resolvedStatus === "success" ? "success" : "flashcardGeneration"
            }
            eventKey={resolvedStatus}
          />
        )
      }
      steps={isError ? [] : steps}
      showBar={isGenerating}
      footer={
        <>
          {showThinContentNote ? (
            <p className="text-sm text-muted-foreground text-pretty">
              {copy.thinContent}
            </p>
          ) : null}
          {isError && onRetry ? (
            <Button type="button" onClick={onRetry}>
              {messages.retry.action}
            </Button>
          ) : null}
        </>
      }
    />
  );
}
