"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  PlaySession,
  QuizPlayNavigator,
  type QuizSessionMetrics,
} from "@/components/play/PlaySession";
import { ensureStudySetDb, getStudySetMeta } from "@/lib/db/studySetDb";
import { flashcardsPlay } from "@/lib/routes/studySetPaths";
import { cn } from "@/lib/utils";

function QuizPlayPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = typeof params.id === "string" ? params.id : "";
  const reviewMistakesOnly = searchParams.get("review") === "mistakes";

  const [headline, setHeadline] = useState("");
  const [subtitle, setSubtitle] = useState<string | undefined>();
  const [sourceName, setSourceName] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionMetrics, setSessionMetrics] = useState<QuizSessionMetrics | null>(
    null,
  );

  const loadMeta = useCallback(async () => {
    if (!id) {
      return;
    }
    setLoadError(null);
    try {
      await ensureStudySetDb();
      const meta = await getStudySetMeta(id);
      if (!meta) {
        setLoadError("Study set not found.");
        return;
      }
      setHeadline(meta.title);
      setSubtitle(meta.subtitle);
      setSourceName(meta.sourceFileName);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Failed to load study set.",
      );
    }
  }, [id]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  if (!id) {
    return null;
  }

  if (loadError) {
    return (
      <div>
        <p className="text-red-400">{loadError}</p>
        <Link href="/dashboard" className="mt-4 inline-block text-[var(--d2q-accent-hover)]">
          ← Library
        </Link>
      </div>
    );
  }

  const showSessionStrip =
    sessionMetrics &&
    (sessionMetrics.phase === "playing" ||
      sessionMetrics.phase === "finished");

  const showQuestionNavigator =
    sessionMetrics?.navigatorStatuses &&
    sessionMetrics.navigatorQuestionIds &&
    sessionMetrics.navigatorStatuses.length > 0 &&
    sessionMetrics.navigatorStatuses.length ===
      sessionMetrics.navigatorQuestionIds.length &&
    (sessionMetrics.phase === "playing" ||
      sessionMetrics.phase === "finished");

  const chromeCardClass =
    "rounded-sm border border-[color-mix(in_srgb,var(--qp-outline-variant)_18%,transparent)] bg-[color-mix(in_srgb,var(--qp-surface-container)_72%,transparent)] backdrop-blur-md shadow-[var(--qp-card-shadow)]";

  return (
    <div
      data-quiz-play-theme="stitch"
      className="relative isolate z-10 flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--qp-bg)] text-[var(--qp-on-bg)]"
    >
      <div
        className="quiz-play-stitch-surface-grid pointer-events-none absolute inset-0 z-0"
        aria-hidden
      />
      <div
        className="quiz-play-stitch-ghost-line-v pointer-events-none z-0 hidden lg:block"
        aria-hidden
      />
      <div
        className="quiz-play-stitch-ghost-line-h pointer-events-none z-0 hidden md:block"
        aria-hidden
      />
      <header className="relative shrink-0 px-4 py-4 sm:px-6 sm:py-5">
        <div className={cn(chromeCardClass, "mx-auto w-full max-w-6xl px-5 py-4 sm:px-6")}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
            <div className="min-w-0 space-y-1">
              <span className="font-label text-[10px] font-bold tracking-[0.2em] text-[var(--qp-secondary)]">
                Session
              </span>
              <h1 className="font-heading text-lg font-extrabold tracking-tight text-[var(--qp-tertiary)] sm:text-xl">
                {headline || "…"}
              </h1>
              {subtitle ? (
                <p className="text-sm font-medium leading-snug text-[var(--qp-muted)]">
                  {subtitle}
                </p>
              ) : null}
              {sourceName ? (
                <p className="text-xs text-[var(--qp-muted)]">
                  Source: {sourceName}
                </p>
              ) : null}
            </div>

            <div className="space-y-3 lg:text-right">
              <div className="space-y-1">
                <span className="font-label text-[10px] font-bold tracking-[0.2em] text-[var(--qp-secondary)]">
                  Score
                </span>
                {showSessionStrip ? (
                  <>
                    <div className="font-heading text-lg font-bold tabular-nums tracking-tight text-[var(--qp-primary)] sm:text-xl">
                      {sessionMetrics.correctCount}/{sessionMetrics.totalQuestions}
                    </div>
                    <div className="font-label text-[10px] tracking-[0.14em] text-[var(--qp-muted)]">
                      {sessionMetrics.phase === "playing"
                        ? `Q${sessionMetrics.questionIndex + 1} / ${sessionMetrics.totalQuestions}`
                        : "Complete"}
                    </div>
                  </>
                ) : (
                  <div className="font-label text-[10px] tracking-[0.14em] text-[var(--qp-muted)]">
                    Waiting for session…
                  </div>
                )}
              </div>

              {showSessionStrip ? (
                <div
                  className="h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--qp-outline-variant)_22%,transparent)]"
                  role="progressbar"
                  aria-valuenow={sessionMetrics.progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-[var(--qp-primary)] transition-[width] duration-500 ease-out"
                    style={{ width: `${sessionMetrics.progressPct}%` }}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-[color-mix(in_srgb,var(--qp-outline-variant)_14%,transparent)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-snug text-[var(--qp-muted)]">
              {reviewMistakesOnly
                ? "Reviewing questions you missed last time. Keys 1–4 pick an answer."
                : "Uses your approved bank. Keys 1–4 pick an answer."}
            </p>
            <Link
              href={flashcardsPlay(id)}
              className="shrink-0 font-heading text-sm font-bold text-[var(--qp-secondary)] underline-offset-4 hover:text-[var(--qp-primary)] hover:underline sm:text-right"
            >
              Flashcards
            </Link>
          </div>
        </div>
      </header>
      <div className="relative flex-1 px-4 pb-6 sm:px-6 sm:pb-8">
        <div className="mx-auto grid min-h-0 min-w-0 w-full max-w-6xl grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_13.5rem] lg:gap-x-8">
          <PlaySession
            studySetId={id}
            reviewMistakesOnly={reviewMistakesOnly}
            visualTheme="stitch"
            onSessionMetrics={setSessionMetrics}
          />
          {showQuestionNavigator ? (
            <QuizPlayNavigator
              questionIds={sessionMetrics.navigatorQuestionIds!}
              statuses={sessionMetrics.navigatorStatuses!}
              spanAdjacentMainRows={sessionMetrics.phase === "playing"}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function QuizPlayPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground" role="status">
          Loading…
        </p>
      }
    >
      <QuizPlayPageInner />
    </Suspense>
  );
}
