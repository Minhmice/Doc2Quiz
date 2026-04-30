"use client";

import { useMemo } from "react";
import { useParseProgress } from "@/components/ai/ParseProgressContext";
import { ParsingWorkbenchStatusBanner } from "@/components/ai/parsing-workbench/ParsingWorkbenchStatusBanner";
import {
  PARSE_PHASE_MESSAGES,
  ParseProgressWorkbenchPanel,
  formatEtaPrimary,
  formatEtaRangeFull,
  parseProgressBannerHeadline,
} from "@/components/ai/parsing-workbench/ParseProgressWorkbenchPanel";
import {
  ImportFlowTechnicalDetails,
} from "@/components/edit/new/import/ImportFlowTechnicalDetails";
import {
  ImportProgressChromeStepsBody,
  ImportUiThreeStepStrip,
  importPhaseMeta,
} from "@/components/edit/new/import/NewStudySetPdfImportProgressChrome";
import {
  buildImportTechnicalDetailLines,
  getImportUiStage,
  importUiEyebrow,
  importUiHeadline,
} from "@/components/edit/new/import/importUiStage";
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
  /** Appended under Technical details (e.g. direct-upload byte progress). */
  extraTechnicalDetailLines?: readonly string[];
}>;

export function UnifiedImportStatusCard({
  contentKind,
  fileName,
  importPhase,
  ingestBusy,
  parseContext,
  runAiParseOnNewPage,
  onCancelParse,
  extraTechnicalDetailLines,
}: UnifiedImportStatusCardProps) {
  const { live } = useParseProgress();

  const liveParsing =
    Boolean(parseContext) &&
    Boolean(live?.running && live.studySetId === parseContext?.studySetId);

  const productLabel = contentKind === "flashcards" ? "Flip study" : "Practice";

  const banner = useMemo(() => {
    if (liveParsing && live) {
      return {
        headline: importUiHeadline("generate"),
        stageEyebrow: importUiEyebrow("generate").toUpperCase(),
        etaPrimary: formatEtaPrimary(live),
        onCancel: onCancelParse,
      };
    }
    if (parseContext && runAiParseOnNewPage && !ingestBusy) {
      return {
        headline: importUiHeadline("generate"),
        stageEyebrow: "STARTING GENERATION…",
        etaPrimary: null as string | null,
        onCancel: undefined as (() => void) | undefined,
      };
    }
    if (ingestBusy && !parseContext) {
      const stage = getImportUiStage(importPhase, { liveParsing: false });
      return {
        headline: importUiHeadline(stage),
        stageEyebrow: importUiEyebrow(stage).toUpperCase(),
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
    onCancelParse,
  ]);

  const stepsPhase: NewStudySetPdfImportPhase =
    parseContext && runAiParseOnNewPage && !ingestBusy && !liveParsing
      ? "ai"
      : importPhase;

  const liveTechnicalLines = useMemo(() => {
    if (!liveParsing || !live) {
      return [];
    }
    return [
      ...buildImportTechnicalDetailLines({
        importPhase,
        contentKind,
        fileName,
        internalStageLine: importPhaseMeta(importPhase, contentKind).stageLine,
        live,
        etaRangeFull: formatEtaRangeFull(live),
        parseDetailHeadline: parseProgressBannerHeadline(live),
        parsePhaseMessage: PARSE_PHASE_MESSAGES[live.phase],
      }),
      ...(extraTechnicalDetailLines ?? []),
    ];
  }, [
    liveParsing,
    live,
    importPhase,
    contentKind,
    fileName,
    extraTechnicalDetailLines,
  ]);

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
            <>
              <div className="border-b border-border bg-muted/15 px-4 py-4 sm:px-6">
                <ImportUiThreeStepStrip stage="generate" />
                <ImportFlowTechnicalDetails
                  lines={liveTechnicalLines}
                  className="mt-4 rounded-md border border-border bg-muted/30 px-3 py-2"
                />
              </div>
              <ParseProgressWorkbenchPanel
                variant="embedded"
                embeddedBodyOnly
                simplifiedImportFlow
                studySetId={parseContext.studySetId}
                onCancel={onCancelParse}
              />
            </>
          ) : (
            <ImportProgressChromeStepsBody
              phase={stepsPhase}
              contentKind={contentKind}
              fileName={fileName}
              extraTechnicalDetailLines={extraTechnicalDetailLines}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
