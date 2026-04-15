"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  PlaySession,
  QuizPlayNavigator,
  type QuizSessionMetrics,
} from "@/components/quiz/QuizSession";

function QuizPlayPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = typeof params.id === "string" ? params.id : "";
  const reviewMistakesOnly = searchParams.get("review") === "mistakes";

  const [sessionMetrics, setSessionMetrics] = useState<QuizSessionMetrics | null>(
    null,
  );

  if (!id) {
    return null;
  }

  const showQuestionNavigator =
    sessionMetrics?.navigatorStatuses &&
    sessionMetrics.navigatorQuestionIds &&
    sessionMetrics.navigatorStatuses.length > 0 &&
    sessionMetrics.navigatorStatuses.length ===
      sessionMetrics.navigatorQuestionIds.length &&
    (sessionMetrics.phase === "playing" ||
      sessionMetrics.phase === "finished");

  const total = sessionMetrics?.totalQuestions ?? 0;
  const correct = sessionMetrics?.correctCount ?? 0;
  const correctPct =
    total > 0 ? Math.round((100 * correct) / total) : 0;

  return (
    <div
      data-quiz-play-theme="stitch"
      className="relative isolate z-10 flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="relative flex-1 px-3 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-8 lg:px-8">
        <section className="mx-auto mb-6 w-full max-w-7xl px-1 sm:mb-10">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="font-label text-xs font-bold uppercase tracking-[0.2em] text-(--qp-secondary)/60">
              Progress
            </span>
            <span className="font-label text-[10px] font-bold uppercase tracking-widest text-(--qp-secondary)/60">
              {correctPct}% COMPLETE
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--qp-surface-container) shadow-inner sm:h-2 lg:h-3">
            <div
              className="h-full bg-(--qp-on-primary-container) transition-all duration-500 ease-out"
              style={{ width: `${correctPct}%` }}
            />
          </div>
        </section>
        <div className="mx-auto grid min-h-0 min-w-0 w-full max-w-7xl grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_13.5rem] lg:gap-x-8 xl:grid-cols-[minmax(0,1fr)_15.5rem]">
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
      <QuizPlayPageContent />
    </Suspense>
  );
}
