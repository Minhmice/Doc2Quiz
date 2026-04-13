"use client";

import { useMemo } from "react";
import { useParseProgress } from "@/components/ai/ParseProgressContext";
import { ParsingWorkbenchStatusBanner } from "@/components/ai/parsing-workbench/ParsingWorkbenchStatusBanner";
import {
  PARSE_PHASE_MESSAGES,
  ParseProgressWorkbenchPanel,
  formatEtaPrimary,
  parseProgressBannerHeadline,
} from "@/components/ai/parsing-workbench/ParseProgressWorkbenchPanel";
import {
  ImportProgressChromeStepsBody,
  importPhaseMeta,
} from "@/components/edit/new/import/NewStudySetPdfImportProgressChrome";
import type { NewStudySetPdfImportPhase } from "@/components/edit/new/import/newStudySetPdfImportPhase";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StudyContentKind } from "@/types/studySet";

export type UnifiedImportStatusCardProps = Readonly<{
  contentKind: StudyContentKind;
  fileName: string | null;
  importPhase: NewStudySetPdfImportPhase;
  ingestBusy: boolean;
  parseContext: { studySetId: string } | null;
  runAiParseOnNewPage: boolean;
  onCancelParse?: () => void;
}>;

export function UnifiedImportStatusCard({
  contentKind,
  fileName,
  importPhase,
  ingestBusy,
  parseContext,
  runAiParseOnNewPage,
  onCancelParse,
}: UnifiedImportStatusCardProps) {
  const { live } = useParseProgress();

  const liveParsing =
    Boolean(parseContext) &&
    Boolean(live?.running && live.studySetId === parseContext?.studySetId);

  const productLabel = contentKind === "flashcards" ? "Flashcards" : "Quiz";

  const banner = useMemo(() => {
    if (liveParsing && live) {
      return {
        headline: parseProgressBannerHeadline(live),
        stageEyebrow: (PARSE_PHASE_MESSAGES[live.phase] ?? "Working…").toUpperCase(),
        etaPrimary: formatEtaPrimary(live),
        onCancel: onCancelParse,
      };
    }
    if (parseContext && runAiParseOnNewPage && !ingestBusy) {
      return {
        headline: "Starting AI draft…",
        stageEyebrow: "CONNECTING TO YOUR MODEL…",
        etaPrimary: null as string | null,
        onCancel: undefined as (() => void) | undefined,
      };
    }
    if (ingestBusy && !parseContext) {
      const m = importPhaseMeta(importPhase, contentKind);
      return {
        headline: m.headline,
        stageEyebrow: m.stageLine.toUpperCase(),
        etaPrimary: null as string | null,
        onCancel: undefined as (() => void) | undefined,
      };
    }
    return null;
  }, [
    liveParsing,
    live,
    parseContext,
    runAiParseOnNewPage,
    ingestBusy,
    importPhase,
    contentKind,
    onCancelParse,
  ]);

  const stepsPhase: NewStudySetPdfImportPhase =
    parseContext && runAiParseOnNewPage && !ingestBusy && !liveParsing
      ? "ai"
      : importPhase;

  return (
    <Card className="gap-0 overflow-hidden border-border p-0 py-0 shadow-lg">
      <CardContent className="space-y-0 p-0">
        {banner ? (
          <div className="overflow-hidden rounded-t-lg border-b border-border bg-card">
            <ParsingWorkbenchStatusBanner
              headline={banner.headline}
              stageEyebrow={banner.stageEyebrow}
              etaPrimary={banner.etaPrimary}
              onCancel={banner.onCancel}
            />
            {fileName ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-chart-4/95 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-white/90 sm:px-6">
                <span className="rounded border border-white/25 bg-white/10 px-2 py-0.5">
                  {productLabel}
                </span>
                <span className="max-w-full truncate font-normal normal-case tracking-normal text-white/85">
                  {fileName}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          className={cn(
            "relative",
            liveParsing && parseContext
              ? "min-h-0"
              : "",
          )}
        >
          {liveParsing && parseContext ? (
            <ParseProgressWorkbenchPanel
              variant="embedded"
              embeddedBodyOnly
              studySetId={parseContext.studySetId}
              onCancel={onCancelParse}
            />
          ) : (
            <ImportProgressChromeStepsBody
              phase={stepsPhase}
              contentKind={contentKind}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
