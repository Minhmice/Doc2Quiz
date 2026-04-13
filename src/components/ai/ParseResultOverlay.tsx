"use client";

import { AlertTriangleIcon, CheckCircleIcon } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  collectTopQuestionIssues,
  extractionConfidencePercent,
} from "@/lib/review/mcqDiagnostics";
import { isMcqComplete } from "@/lib/review/validateMcq";
import type { Question } from "@/types/question";
import type { FlashcardVisionItem } from "@/types/visionParse";

export type ParseResultOverlayProps = {
  questions: Question[];
  /** Phase 21 — when set, shows flashcard-oriented summary instead of MCQ diagnostics. */
  flashcardItems?: FlashcardVisionItem[];
  onContinue: () => void;
  /** Primary CTA label (default: Continue to Review) */
  continueLabel?: string;
};

export function ParseResultOverlay({
  questions,
  flashcardItems,
  onContinue,
  continueLabel = "Continue to Review",
}: ParseResultOverlayProps) {
  const flashCount = flashcardItems?.length ?? 0;
  const flashMode = flashCount > 0;

  const questionCount = questions.length;
  const unclearCount = useMemo(
    () => questions.reduce((n, q) => n + (isMcqComplete(q) ? 0 : 1), 0),
    [questions],
  );
  const confidence = useMemo(
    () => extractionConfidencePercent(questions),
    [questions],
  );
  const issues = useMemo(
    () => collectTopQuestionIssues(questions, 8),
    [questions],
  );

  const flashAvgConfidence = useMemo(() => {
    if (!flashcardItems?.length) {
      return null;
    }
    const sum = flashcardItems.reduce((s, c) => s + c.confidence, 0);
    return Math.round((sum / flashcardItems.length) * 100);
  }, [flashcardItems]);

  const confidenceLabel =
    confidence >= 85
      ? "High"
      : confidence >= 60
        ? "Medium"
        : questionCount === 0
          ? "—"
          : "Low";

  const flashConfidenceLabel =
    flashAvgConfidence === null
      ? "—"
      : flashAvgConfidence >= 85
        ? "High"
        : flashAvgConfidence >= 60
          ? "Medium"
          : "Low";

  if (flashMode) {
    return (
      <Card className="border-emerald-500/40 bg-gradient-to-b from-emerald-500/8 via-card to-card shadow-lg">
        <CardHeader className="pb-2 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
            <CheckCircleIcon
              className="size-8 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-5 text-left sm:text-center">
          <div>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {flashCount} flashcard{flashCount === 1 ? "" : "s"} detected
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Front and back text were extracted from your document images. You
              can edit wording on the next screen.
            </p>
          </div>

          <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Parse confidence (model-reported average)
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-primary">
              {flashAvgConfidence === null ? "—" : `${flashAvgConfidence}%`}
              {flashAvgConfidence !== null ? (
                <span className="ml-2 text-base font-semibold text-foreground">
                  ({flashConfidenceLabel})
                </span>
              ) : null}
            </p>
          </div>

          <div className="flex justify-center pt-1">
            <Button size="lg" className="font-semibold" onClick={onContinue}>
              {continueLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-emerald-500/40 bg-gradient-to-b from-emerald-500/8 via-card to-card shadow-lg">
      <CardHeader className="pb-2 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckCircleIcon
            className="size-8 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-5 text-left sm:text-center">
        <div>
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {questionCount} question{questionCount === 1 ? "" : "s"} detected
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Structure scan:{" "}
            <span className="font-medium text-foreground">
              100% multiple choice
            </span>{" "}
            (four options per item)
          </p>
        </div>

        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-left text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Detected
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-foreground">
            <li>
              <span className="font-semibold tabular-nums">{questionCount}</span>{" "}
              questions
            </li>
            <li>100% multiple choice format</li>
            <li>
              <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                {unclearCount}
              </span>{" "}
              ambiguous or incomplete item
              {unclearCount === 1 ? "" : "s"}
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Extraction confidence
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary">
            {questionCount === 0 ? "—" : `${confidence}%`}
            {questionCount > 0 ? (
              <span className="ml-2 text-base font-semibold text-foreground">
                ({confidenceLabel})
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Based on how complete each stem and four options look — not a model
            self-score.
          </p>
        </div>

        {issues.length > 0 ? (
          <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-left">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden />
              Needs attention
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-amber-950 dark:text-amber-50">
              {issues.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="shrink-0 text-amber-600 dark:text-amber-400">
                    ⚠
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : questionCount > 0 ? (
          <p className="text-sm text-muted-foreground">
            No structural issues flagged — ready for review and approval.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No questions found in this pass. Try again or check the PDF.
          </p>
        )}

        <div className="flex justify-center pt-1">
          <Button size="lg" className="font-semibold" onClick={onContinue}>
            {continueLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
