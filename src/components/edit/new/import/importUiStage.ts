import type { LiveParseReport } from "@/components/ai/ParseProgressContext";
import type { NewStudySetPdfImportPhase } from "@/components/edit/new/import/newStudySetPdfImportPhase";
import type { StudyContentKind } from "@/types/studySet";

export type ImportUiStage = "upload" | "read" | "generate";

/** User-visible buckets; internal ingest phases map here. Live parse always maps to generate. */
export function getImportUiStage(
  importPhase: NewStudySetPdfImportPhase,
  options?: Readonly<{ liveParsing?: boolean }>,
): ImportUiStage {
  if (options?.liveParsing) {
    return "generate";
  }
  switch (importPhase) {
    case "idb":
      return "upload";
    case "pdf":
    case "persist":
      return "read";
    case "ai":
      return "generate";
  }
}

export function importUiStageIndex(stage: ImportUiStage): 0 | 1 | 2 {
  if (stage === "upload") {
    return 0;
  }
  if (stage === "read") {
    return 1;
  }
  return 2;
}

export const IMPORT_UI_STAGE_LABELS: readonly [string, string, string] = [
  "Uploading file",
  "Reading content",
  "Generating study set",
];

export function importUiHeadline(stage: ImportUiStage): string {
  switch (stage) {
    case "upload":
      return "Uploading file…";
    case "read":
      return "Reading content…";
    case "generate":
      return "Generating study set…";
  }
}

export function importUiEyebrow(stage: ImportUiStage): string {
  switch (stage) {
    case "upload":
      return "Preparing your import";
    case "read":
      return "Extracting text from your PDF";
    case "generate":
      return "AI is building your cards and questions";
  }
}

/** Progress bar fill: third of pipeline per active stage (33 / 66 / 100). */
export function importUiProgressPercent(stage: ImportUiStage): number {
  return Math.round(((importUiStageIndex(stage) + 1) / 3) * 100);
}

export function importUiLiveMessage(
  stage: ImportUiStage,
  contentKind: StudyContentKind,
): string {
  const product =
    contentKind === "flashcards" ? "Flip study set" : "Practice study set";
  switch (stage) {
    case "upload":
      return `${product} import: uploading and preparing storage.`;
    case "read":
      return `${product} import: reading PDF and saving your document.`;
    case "generate":
      return `${product} import: generating study content.`;
  }
}

export type BuildImportTechnicalDetailsArgs = Readonly<{
  importPhase: NewStudySetPdfImportPhase;
  contentKind: StudyContentKind;
  fileName?: string | null;
  /** Legacy ingest line (e.g. Stage N of M) — debug only */
  internalStageLine?: string | null;
  live?: LiveParseReport | null;
  /** Full-range ETA, e.g. ~10–30s remaining */
  etaRangeFull?: string | null;
  /** Technical headline shown during parse (debug) */
  parseDetailHeadline?: string | null;
  /** Phase label from PARSE_PHASE_MESSAGES */
  parsePhaseMessage?: string | null;
}>;

export function buildImportTechnicalDetailLines(
  args: BuildImportTechnicalDetailsArgs,
): string[] {
  const lines: string[] = [];
  lines.push(`Pipeline phase: ${args.importPhase}`);
  lines.push(`Content kind: ${args.contentKind}`);
  if (args.fileName) {
    lines.push(`File: ${args.fileName}`);
  }
  if (args.internalStageLine) {
    lines.push(`Ingest detail: ${args.internalStageLine}`);
  }
  const live = args.live;
  if (live?.running) {
    lines.push(`Parse phase: ${live.phase}`);
    if (args.parsePhaseMessage) {
      lines.push(`Phase label: ${args.parsePhaseMessage}`);
    }
    if (args.parseDetailHeadline) {
      lines.push(`Status: ${args.parseDetailHeadline}`);
    }
    if ((live.renderPageTotal ?? 0) > 0) {
      lines.push(
        `Render pages: ${live.renderPageIndex ?? 0}/${live.renderPageTotal}`,
      );
    }
    if (live.total > 0) {
      lines.push(`Step progress: ${live.current}/${live.total}`);
    }
    if ((live.extractedQuestionCount ?? 0) > 0) {
      lines.push(`Extracted items: ${live.extractedQuestionCount}`);
    }
    if (live.parseLog && live.parseLog.length > 0) {
      lines.push(`Log (latest): ${live.parseLog.slice(-5).join(" · ")}`);
    }
  }
  if (args.etaRangeFull) {
    lines.push(`ETA (range): ${args.etaRangeFull}`);
  }
  return lines;
}
