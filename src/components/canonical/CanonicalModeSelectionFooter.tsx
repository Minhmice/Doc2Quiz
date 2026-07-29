"use client";

import Link from "next/link";

import { useLocale } from "@/components/locale/LocaleProvider";
import { Button, buttonVariants } from "@/components/ui/button";
import type { PipelineStage } from "@/types/studySet";

const HELPER_ID = "canonical-mode-helper";
const FLASHCARDS_SUBLABEL_ID = "canonical-flashcards-sublabel";

export type CanonicalModeSelectionFooterProps = Readonly<{
  onSelectQuiz: () => void;
  onSelectFlashcards?: () => void;
  disabled?: boolean;
  busy?: boolean;
  pipelineStage: PipelineStage;
  approvedCount?: number;
  approvedFlashcardCount?: number;
  editQuestionsHref?: string;
  startQuizHref?: string;
  startFlashcardsHref?: string;
}>;

function isQuizResumeStrip(
  pipelineStage: PipelineStage,
  approvedCount: number,
): boolean {
  return pipelineStage === "quiz" && approvedCount > 0;
}

function isFlashcardsResumeStrip(
  pipelineStage: PipelineStage,
  cardCount: number,
): boolean {
  return pipelineStage === "flashcards" && cardCount > 0;
}

export function CanonicalModeSelectionFooter({
  onSelectQuiz,
  onSelectFlashcards,
  disabled = false,
  busy = false,
  pipelineStage,
  approvedCount = 0,
  approvedFlashcardCount = 0,
  editQuestionsHref,
  startQuizHref,
  startFlashcardsHref,
}: CanonicalModeSelectionFooterProps) {
  const { messages } = useLocale();
  const copy = messages.workflows.mode;
  if (
    isFlashcardsResumeStrip(pipelineStage, approvedFlashcardCount) &&
    startFlashcardsHref
  ) {
    return (
      <footer
        className="rounded-xl bg-muted/30 p-4 ring-1 ring-foreground/10"
        aria-labelledby="canonical-flashcards-resume-label"
      >
        <p
          id="canonical-flashcards-resume-label"
          className="font-label text-xs font-extrabold uppercase tracking-wide text-muted-foreground"
        >
          {copy.flashcardsReady}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {copy.cardCount(approvedFlashcardCount)}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href={startFlashcardsHref}
            className={buttonVariants({ variant: "default" })}
          >
            {copy.startFlashcards}
          </Link>
        </div>
      </footer>
    );
  }

  if (
    isQuizResumeStrip(pipelineStage, approvedCount) &&
    editQuestionsHref &&
    startQuizHref
  ) {
    return (
      <footer
        className="rounded-xl bg-muted/30 p-4 ring-1 ring-foreground/10"
        aria-labelledby="canonical-resume-label"
      >
        <p
          id="canonical-resume-label"
          className="font-label text-xs font-extrabold uppercase tracking-wide text-muted-foreground"
        >
          {copy.quizReady}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {copy.questionCount(approvedCount)}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href={editQuestionsHref}
            className={buttonVariants({ variant: "default" })}
          >
            {copy.editQuestions}
          </Link>
          <Link
            href={startQuizHref}
            className={buttonVariants({ variant: "outline" })}
          >
            {copy.startQuiz}
          </Link>
        </div>
      </footer>
    );
  }

  return (
    <footer
      className="rounded-xl bg-muted/30 p-4 ring-1 ring-foreground/10"
      aria-labelledby="canonical-mode-label"
      aria-busy={busy}
    >
      <p
        id="canonical-mode-label"
        className="font-label text-xs font-extrabold uppercase tracking-wide text-muted-foreground"
      >
        {copy.learningMode}
      </p>
      <p id={HELPER_ID} className="mt-2 text-sm text-muted-foreground">
        {copy.helper}
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <div className="space-y-1">
          <Button
            type="button"
            variant="default"
            disabled={disabled || busy}
            aria-busy={busy}
            onClick={onSelectQuiz}
          >
            {busy ? copy.generating : copy.quiz}
          </Button>
          <p className="text-xs text-muted-foreground">
            {copy.quizHelp}
          </p>
        </div>
        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            disabled={disabled || busy || !onSelectFlashcards}
            aria-busy={busy}
            onClick={onSelectFlashcards}
            aria-describedby={FLASHCARDS_SUBLABEL_ID}
          >
            {copy.flashcards}
          </Button>
          <p id={FLASHCARDS_SUBLABEL_ID} className="text-xs text-muted-foreground">
            {copy.flashcardsHelp}
          </p>
        </div>
      </div>
    </footer>
  );
}
