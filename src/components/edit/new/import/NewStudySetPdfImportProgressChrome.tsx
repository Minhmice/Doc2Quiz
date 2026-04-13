"use client";

import type { LucideIcon } from "lucide-react";
import {
  CheckIcon,
  FileTextIcon,
  HardDriveIcon,
  Loader2Icon,
  SaveIcon,
  Wand2Icon,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { StudyContentKind } from "@/types/studySet";
import type { NewStudySetPdfImportPhase } from "@/components/edit/new/import/newStudySetPdfImportPhase";
import { cn } from "@/lib/utils";

const BAR_EASE = [0.22, 1, 0.36, 1] as const;

type PhaseMeta = {
  headline: string;
  stageLine: string;
  liveMessage: string;
};

const PHASE_ORDER_INGEST: readonly NewStudySetPdfImportPhase[] = [
  "idb",
  "pdf",
  "persist",
] as const;

const PHASE_ORDER_WITH_AI: readonly NewStudySetPdfImportPhase[] = [
  "idb",
  "pdf",
  "persist",
  "ai",
] as const;

export function importPhaseMeta(
  phase: NewStudySetPdfImportPhase,
  contentKind: StudyContentKind,
): PhaseMeta {
  const product =
    contentKind === "flashcards" ? "Flashcard set" : "Quiz set";
  switch (phase) {
    case "idb":
      return {
        headline: "Preparing storage…",
        stageLine: "Stage 1 of 3 — On-device storage",
        liveMessage: `${product} import: preparing on-device storage.`,
      };
    case "pdf":
      return {
        headline: "Reading PDF…",
        stageLine: "Stage 2 of 3 — PDF processing",
        liveMessage: `${product} import: reading PDF and extracting text.`,
      };
    case "persist":
      return {
        headline: "Saving study set…",
        stageLine: "Stage 3 of 3 — Saving",
        liveMessage: `${product} import: saving study set.`,
      };
    case "ai":
      return {
        headline: "Drafting with AI…",
        stageLine: "Stage 4 of 4 — AI draft",
        liveMessage: `${product} import: AI is drafting questions from your document.`,
      };
  }
}

function phaseOrderFor(phase: NewStudySetPdfImportPhase) {
  return phase === "ai" ? PHASE_ORDER_WITH_AI : PHASE_ORDER_INGEST;
}

function phaseIndex(phase: NewStudySetPdfImportPhase): number {
  const order = phaseOrderFor(phase);
  return order.indexOf(phase);
}

export type NewStudySetPdfImportProgressChromeProps = Readonly<{
  phase: NewStudySetPdfImportPhase;
  contentKind: StudyContentKind;
  fileName?: string | null;
  /**
   * `standalone` — outer card shell (legacy full-width workbench).
   * `embedded` — inner chrome only; parent supplies border/radius.
   */
  variant?: "standalone" | "embedded";
  /** Optional override for the primary headline (e.g. “Starting AI draft…”). */
  headlineOverride?: string | null;
  /** Optional override for the stage line under the headline. */
  stageLineOverride?: string | null;
}>;

export function NewStudySetPdfImportProgressChrome({
  phase,
  contentKind,
  fileName,
  variant = "standalone",
  headlineOverride,
  stageLineOverride,
}: NewStudySetPdfImportProgressChromeProps) {
  const reduceMotion = useReducedMotion();
  const baseMeta = importPhaseMeta(phase, contentKind);
  const meta = {
    headline: headlineOverride ?? baseMeta.headline,
    stageLine: stageLineOverride ?? baseMeta.stageLine,
    liveMessage: baseMeta.liveMessage,
  };
  const active = phaseIndex(phase);
  const productLabel = contentKind === "flashcards" ? "Flashcards" : "Quiz";
  const order = phaseOrderFor(phase);
  const stageCount = order.length;
  const progressUnit = (active + 1) / stageCount;
  const progressPercent = Math.round(progressUnit * 100);
  const showFourStepRow = phase === "ai";

  const inner = (
    <>
      <div
        className="d2q-technical-grid border-b border-border bg-muted/30 px-4 py-5 sm:px-6"
        role="region"
        aria-labelledby="new-import-loading-heading"
      >
        <div className="flex flex-col gap-4 border-l-[6px] border-d2q-accent bg-chart-4 px-4 py-3 text-white shadow-md sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-d2q-accent motion-safe:animate-pulse">
              <Loader2Icon
                className="size-5 text-chart-4 motion-safe:animate-spin motion-reduce:animate-none"
                aria-hidden
              />
            </div>
            <div className="min-w-0">
              <h2
                id="new-import-loading-heading"
                className="font-heading text-base font-bold leading-tight tracking-tight sm:text-lg"
              >
                {meta.headline}
              </h2>
              <p className="font-label mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/65">
                {meta.stageLine}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-white/15 pt-3 font-label text-[10px] font-bold uppercase tracking-widest text-white/90 sm:border-t-0 sm:pt-0">
            <span className="rounded border border-white/25 bg-white/10 px-2 py-1">
              {productLabel}
            </span>
            {fileName ? (
              <span className="max-w-full truncate text-[10px] font-normal normal-case tracking-normal text-white/85">
                {fileName}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mx-auto mt-5 max-w-2xl space-y-4 px-1 pb-5 sm:px-4">
          <p id="new-import-live" className="sr-only" aria-live="polite" aria-atomic="true">
            {meta.liveMessage}
          </p>

          <div
            className="h-3 w-full overflow-hidden rounded-full bg-secondary p-0.5"
            role="progressbar"
            aria-busy="true"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-valuetext={meta.headline}
            aria-label="Import progress"
          >
            <div className="relative h-full w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className="absolute inset-y-0 left-0 h-full w-full origin-left rounded-full bg-chart-2/85 d2q-progress-stripes motion-reduce:animate-none"
                aria-hidden
                initial={reduceMotion ? false : { scaleX: 0 }}
                animate={{ scaleX: progressUnit }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : {
                        duration: 0.38,
                        ease: BAR_EASE,
                      }
                }
              />
            </div>
          </div>

          <div
            role="list"
            className="flex flex-wrap items-center justify-center gap-3 sm:gap-6"
          >
            <StepItem
              label="Storage"
              state={active > 0 ? "done" : active === 0 ? "current" : "upcoming"}
              icon={HardDriveIcon}
            />
            <StepItem
              label="PDF"
              state={active > 1 ? "done" : active === 1 ? "current" : "upcoming"}
              icon={FileTextIcon}
            />
            <StepItem
              label="Save"
              state={active > 2 ? "done" : active === 2 ? "current" : "upcoming"}
              icon={SaveIcon}
            />
            {showFourStepRow ? (
              <StepItem
                label="AI draft"
                state={active > 3 ? "done" : active === 3 ? "current" : "upcoming"}
                icon={Wand2Icon}
              />
            ) : null}
          </div>

          <div className="rounded-md border border-border bg-background/80 px-3 py-2 text-center">
            <p className="text-xs text-muted-foreground">
              This step runs entirely in your browser. Large PDFs can take a little longer.
            </p>
          </div>
        </div>
      </div>
    </>
  );

  if (variant === "embedded") {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-t-lg border-b border-border bg-card",
        )}
        aria-busy="true"
      >
        {inner}
      </div>
    );
  }

  return (
    <div
      aria-busy="true"
      className="w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg"
    >
      {inner}
    </div>
  );
}

/** Ingest / “starting AI” step row + bar + note (no top green strip). Used inside `UnifiedImportStatusCard`. */
export function ImportProgressChromeStepsBody({
  phase,
  contentKind,
}: Readonly<{
  phase: NewStudySetPdfImportPhase;
  contentKind: StudyContentKind;
}>) {
  const reduceMotion = useReducedMotion();
  const meta = importPhaseMeta(phase, contentKind);
  const active = phaseIndex(phase);
  const order = phaseOrderFor(phase);
  const stageCount = order.length;
  const progressUnit = (active + 1) / stageCount;
  const progressPercent = Math.round(progressUnit * 100);
  const showFourStepRow = phase === "ai";

  return (
    <div className="border-b border-border bg-muted/20 px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-4 px-1 sm:px-2">
        <p id="new-import-live" className="sr-only" aria-live="polite" aria-atomic="true">
          {meta.liveMessage}
        </p>

        <div
          className="h-3 w-full overflow-hidden rounded-full bg-secondary p-0.5"
          role="progressbar"
          aria-busy="true"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
          aria-valuetext={meta.headline}
          aria-label="Import progress"
        >
          <div className="relative h-full w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="absolute inset-y-0 left-0 h-full w-full origin-left rounded-full bg-chart-2/85 d2q-progress-stripes motion-reduce:animate-none"
              aria-hidden
              initial={reduceMotion ? false : { scaleX: 0 }}
              animate={{ scaleX: progressUnit }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      duration: 0.38,
                      ease: BAR_EASE,
                    }
              }
            />
          </div>
        </div>

        <div
          role="list"
          className="flex flex-wrap items-center justify-center gap-3 sm:gap-6"
        >
          <StepItem
            label="Storage"
            state={active > 0 ? "done" : active === 0 ? "current" : "upcoming"}
            icon={HardDriveIcon}
          />
          <StepItem
            label="PDF"
            state={active > 1 ? "done" : active === 1 ? "current" : "upcoming"}
            icon={FileTextIcon}
          />
          <StepItem
            label="Save"
            state={active > 2 ? "done" : active === 2 ? "current" : "upcoming"}
            icon={SaveIcon}
          />
          {showFourStepRow ? (
            <StepItem
              label="AI draft"
              state={active > 3 ? "done" : active === 3 ? "current" : "upcoming"}
              icon={Wand2Icon}
            />
          ) : null}
        </div>

        <div className="rounded-md border border-border bg-background/80 px-3 py-2 text-center">
          <p className="text-xs text-muted-foreground">
            This step runs entirely in your browser. Large PDFs can take a little longer.
          </p>
        </div>
      </div>
    </div>
  );
}

type StepState = "done" | "current" | "upcoming";

type StepItemProps = {
  label: string;
  state: StepState;
  icon: LucideIcon;
};

function StepItem(props: Readonly<StepItemProps>) {
  const { label, state, icon: Icon } = props;
  const isDone = state === "done";
  const isCurrent = state === "current";

  return (
    <div role="listitem" className="flex items-center gap-2">
      <span
        className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${
          isDone
            ? "bg-chart-2 text-white shadow-[0_0_10px_color-mix(in_srgb,var(--chart-2)_35%,transparent)]"
            : isCurrent
              ? "border-2 border-d2q-accent bg-background text-chart-4 ring-4 ring-d2q-accent/15"
              : "border-2 border-muted-foreground/25 text-muted-foreground opacity-50"
        }`}
        aria-current={isCurrent ? "step" : undefined}
      >
        {isDone ? <CheckIcon className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
      </span>
      <span
        className={`font-label text-[10px] font-bold uppercase tracking-widest ${
          isCurrent ? "text-chart-4" : isDone ? "text-chart-2" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
