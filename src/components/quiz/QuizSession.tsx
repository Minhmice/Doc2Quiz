"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ensureStudySetDb,
  getApprovedBank,
  getMediaBlob,
} from "@/lib/db/studySetDb";
import { editQuiz, quizPlay } from "@/lib/routes/studySetPaths";
import { isMcqComplete } from "@/lib/review/validateMcq";
import {
  getMistakeQuestionIds,
  recordQuizCompletion,
} from "@/lib/sets/activityTracking";
import type { Question } from "@/types/question";
import { Button, buttonVariants } from "@/components/buttons/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MathText } from "@/components/math/MathText";
import { QuizInteractionHints } from "@/components/quiz/QuizInteractionHints";

const LABELS = ["A", "B", "C", "D"] as const;

export type QuizNavCellStatus =
  | "upcoming"
  | "current"
  | "correct"
  | "incorrect";

function questionNavStatuses(
  playable: Question[],
  index: number,
  finished: boolean,
  wrongIds: Set<string>,
): QuizNavCellStatus[] {
  return playable.map((q, i) => {
    if (finished) {
      return wrongIds.has(q.id) ? "incorrect" : "correct";
    }
    if (i < index) {
      return wrongIds.has(q.id) ? "incorrect" : "correct";
    }
    if (i === index) {
      return "current";
    }
    return "upcoming";
  });
}

const quizNavCardClass =
  "rounded-sm border border-[color-mix(in_srgb,var(--qp-outline-variant)_22%,transparent)] bg-[var(--qp-surface-container-lowest)] p-4 shadow-[var(--qp-card-shadow)]";

const quizPlayStitchCardClass =
  "w-full min-w-0 overflow-hidden rounded-sm border border-[color-mix(in_srgb,var(--qp-outline-variant)_16%,transparent)] bg-[color-mix(in_srgb,var(--qp-surface-container-lowest)_94%,white)] px-6 py-6 shadow-[var(--qp-card-shadow)] md:px-10 md:py-8";

export function QuizPlayNavigator({
  questionIds,
  statuses,
  /** When true, sidebar spans both main-column rows (stem + choices). Omit when main column is a single block (e.g. results). */
  spanAdjacentMainRows = false,
}: {
  questionIds: string[];
  statuses: QuizNavCellStatus[];
  spanAdjacentMainRows?: boolean;
}) {
  const count = statuses.length;
  return (
    <aside
      className={cn(
        "min-w-0 w-full shrink-0 self-start lg:sticky lg:top-3 lg:z-[1] lg:col-start-2 lg:row-start-1 lg:w-56 lg:min-w-[13.5rem] lg:max-w-none",
        spanAdjacentMainRows && "lg:row-span-2",
      )}
      aria-label="Question map"
    >
      <div className={cn(quizNavCardClass, "space-y-4")}>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-heading text-sm font-bold tracking-tight text-[var(--qp-tertiary)]">
            Questions
          </h3>
          <span className="font-label text-[10px] font-bold tracking-[0.12em] text-[var(--qp-muted)]">
            {count} items
          </span>
        </div>
        <div
          className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-4"
          role="list"
        >
          {statuses.map((status, i) => (
            <div
              key={questionIds[i] ?? `q-${i}`}
              role="listitem"
              aria-label={`Question ${i + 1}, ${status}`}
              aria-current={status === "current" ? "step" : undefined}
              className={cn(
                "flex aspect-square items-center justify-center rounded-sm text-sm font-bold tabular-nums transition-colors",
                status === "upcoming" &&
                  "border border-[color-mix(in_srgb,var(--qp-outline-variant)_40%,transparent)] text-[var(--qp-muted)]",
                status === "current" &&
                  "border-2 border-[var(--qp-primary)] bg-[color-mix(in_srgb,var(--qp-primary)_10%,transparent)] text-[var(--qp-primary)]",
                status === "correct" &&
                  "border border-[color-mix(in_srgb,var(--qp-secondary)_45%,transparent)] bg-[color-mix(in_srgb,var(--qp-secondary-container)_35%,var(--qp-surface-container-lowest))] text-[var(--qp-on-secondary-container)]",
                status === "incorrect" &&
                  "border border-red-500/45 bg-red-950/20 text-red-900 dark:text-red-200",
              )}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function ResultRow({
  index,
  stem,
  missed,
  visualTheme = "default",
}: {
  index: number;
  stem: string;
  missed: boolean;
  visualTheme?: "default" | "stitch";
}) {
  const stitch = visualTheme === "stitch";
  return (
    <div
      className={cn(
        "flex min-h-11 items-center gap-3 px-3 py-2",
        stitch
          ? "rounded-sm border border-[color-mix(in_srgb,var(--qp-outline-variant)_35%,transparent)] bg-[var(--qp-surface-container-low)]"
          : "rounded-lg border border-border bg-secondary/40",
      )}
    >
      <span
        className={cn(
          "shrink-0 text-xs font-semibold tabular-nums",
          stitch ? "text-[var(--qp-secondary)]" : "text-muted-foreground",
        )}
      >
        Q{index}
      </span>
      <div className="min-w-0 flex-1 line-clamp-2 text-base leading-normal text-foreground">
        <MathText source={stem} className="text-base leading-normal" />
      </div>
      <Badge
        variant="secondary"
        className={
          missed
            ? "shrink-0 border border-red-400/50 bg-red-950/40 text-foreground"
            : "shrink-0 border border-emerald-500/50 bg-emerald-950/40 text-foreground"
        }
      >
        {missed ? "Incorrect" : "Correct"}
      </Badge>
    </div>
  );
}

function MediaImage({
  mediaId,
  visualTheme = "default",
}: {
  mediaId: string;
  visualTheme?: "default" | "stitch";
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        await ensureStudySetDb();
        const blob = await getMediaBlob(mediaId);
        if (!blob || revoked) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        if (revoked) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setUrl(objectUrl);
      } catch {
        if (!revoked) {
          setUrl(null);
        }
      }
    })();
    return () => {
      revoked = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [mediaId]);

  if (!url) {
    return (
      <span className="text-xs text-muted-foreground">Loading image…</span>
    );
  }
  const stitch = visualTheme === "stitch";
  return (
    // eslint-disable-next-line @next/next/no-img-element -- object URL from IndexedDB blob
    <img
      src={url}
      alt=""
      className={cn(
        "mt-1 max-h-48 max-w-full object-contain",
        stitch
          ? "rounded-sm border border-[color-mix(in_srgb,var(--qp-outline-variant)_25%,transparent)]"
          : "rounded border border-border",
      )}
    />
  );
}

export type QuizSessionMetrics = {
  phase: "loading" | "error" | "empty" | "playing" | "finished";
  questionIndex: number;
  totalQuestions: number;
  correctCount: number;
  progressPct: number;
  /** Populated when the session has questions and is playing or finished (for page-level navigator). */
  navigatorQuestionIds?: string[];
  navigatorStatuses?: QuizNavCellStatus[];
};

export type PlaySessionProps = {
  studySetId: string;
  /** When true, only questions from the last wrong-answer session are loaded. */
  reviewMistakesOnly?: boolean;
  /** Mint blueprint chrome for `/quiz/[id]` only. */
  visualTheme?: "default" | "stitch";
  /** Live session strip (progress/score) for parent header when `visualTheme="stitch"`. */
  onSessionMetrics?: (metrics: QuizSessionMetrics | null) => void;
};

export function PlaySession({
  studySetId,
  reviewMistakesOnly = false,
  visualTheme = "default",
  onSessionMetrics,
}: PlaySessionProps) {
  const router = useRouter();
  const stitch = visualTheme === "stitch";
  const [playable, setPlayable] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<0 | 1 | 2 | 3 | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const sessionRecordedRef = useRef(false);
  const wrongIdsRef = useRef<Set<string>>(new Set());
  const didRedirectRef = useRef(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    sessionRecordedRef.current = false;
    wrongIdsRef.current = new Set();
    try {
      await ensureStudySetDb();
      const bank = await getApprovedBank(studySetId);
      let list = (bank?.questions ?? []).filter(isMcqComplete);
      if (reviewMistakesOnly) {
        const mistakeIds = await getMistakeQuestionIds(studySetId);
        const allow = new Set(mistakeIds);
        list = list.filter((q) => allow.has(q.id));
      }
      setPlayable(list);
      setIndex(0);
      setPicked(null);
      setCorrectCount(0);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Could not load study content.",
      );
      setPlayable([]);
    } finally {
      setLoading(false);
    }
  }, [studySetId, reviewMistakesOnly]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const current = playable[index];
  const finished = playable.length > 0 && index >= playable.length;
  const revealed = picked !== null;

  useEffect(() => {
    if (!onSessionMetrics) {
      return;
    }
    if (loading) {
      onSessionMetrics({
        phase: "loading",
        questionIndex: 0,
        totalQuestions: 0,
        correctCount: 0,
        progressPct: 0,
      });
      return;
    }
    if (loadError) {
      onSessionMetrics({
        phase: "error",
        questionIndex: 0,
        totalQuestions: 0,
        correctCount: 0,
        progressPct: 0,
      });
      return;
    }
    if (playable.length === 0) {
      onSessionMetrics({
        phase: "empty",
        questionIndex: 0,
        totalQuestions: 0,
        correctCount: 0,
        progressPct: 0,
      });
      return;
    }
    if (finished) {
      onSessionMetrics({
        phase: "finished",
        questionIndex: playable.length,
        totalQuestions: playable.length,
        correctCount,
        progressPct: 100,
        navigatorQuestionIds: playable.map((q) => q.id),
        navigatorStatuses: questionNavStatuses(
          playable,
          index,
          true,
          wrongIdsRef.current,
        ),
      });
      return;
    }
    const progressPct =
      playable.length > 0
        ? Math.min(100, Math.round((100 * index) / playable.length))
        : 0;
    onSessionMetrics({
      phase: "playing",
      questionIndex: index,
      totalQuestions: playable.length,
      correctCount,
      progressPct,
      navigatorQuestionIds: playable.map((q) => q.id),
      navigatorStatuses: questionNavStatuses(
        playable,
        index,
        false,
        wrongIdsRef.current,
      ),
    });
  }, [
    onSessionMetrics,
    loading,
    loadError,
    playable,
    index,
    finished,
    correctCount,
  ]);

  useEffect(() => {
    if (!onSessionMetrics) {
      return;
    }
    return () => {
      onSessionMetrics(null);
    };
  }, [onSessionMetrics]);

  const handlePick = useCallback(
    (choice: 0 | 1 | 2 | 3) => {
      if (!current) {
        return;
      }
      setPicked(choice);
    },
    [current],
  );

  useEffect(() => {
    if (!finished || playable.length === 0 || sessionRecordedRef.current) {
      return;
    }
    sessionRecordedRef.current = true;
    void recordQuizCompletion({
      studySetId,
      totalQuestions: playable.length,
      correctCount,
      wrongQuestionIds: [...wrongIdsRef.current],
    });
  }, [finished, playable.length, correctCount, studySetId]);

  useEffect(() => {
    if (!stitch || !finished || didRedirectRef.current) {
      return;
    }
    didRedirectRef.current = true;
    router.push(`/quiz/${studySetId}/done`);
  }, [router, stitch, finished, studySetId]);

  const goNext = useCallback(() => {
    if (picked === null || current === undefined) {
      return;
    }
    if (picked !== current.correctIndex) {
      wrongIdsRef.current.add(current.id);
    } else {
      setCorrectCount((c) => c + 1);
    }
    setPicked(null);
    setIndex((i) => i + 1);
  }, [picked, current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished || loading || loadError) {
        return;
      }
      if (!current) {
        return;
      }
      if (!revealed) {
        if (e.key >= "1" && e.key <= "4") {
          e.preventDefault();
          const choice = (Number.parseInt(e.key, 10) - 1) as 0 | 1 | 2 | 3;
          handlePick(choice);
        }
        return;
      }
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, loading, loadError, current, revealed, goNext, handlePick]);

  const restart = () => {
    sessionRecordedRef.current = false;
    wrongIdsRef.current = new Set();
    setIndex(0);
    setPicked(null);
    setCorrectCount(0);
  };

  if (loading) {
    return (
      <p
        className={cn(
          "text-sm text-muted-foreground",
          stitch &&
            "font-label text-[10px] tracking-[0.18em] text-[var(--qp-muted)]",
        )}
        role="status"
      >
        Loading…
      </p>
    );
  }

  if (loadError) {
    return (
      <Alert
        variant="destructive"
        role="alert"
        className={cn(stitch && "rounded-sm border-destructive/40")}
      >
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    );
  }

  if (playable.length === 0) {
    if (reviewMistakesOnly) {
      return (
        <Alert
          className={cn(
            "border-border",
            stitch &&
              "rounded-sm border-[color-mix(in_srgb,var(--qp-outline-variant)_35%,transparent)] bg-[var(--qp-surface-container-low)] text-[var(--qp-on-bg)]",
          )}
          role="status"
        >
          <AlertTitle>No missed items to review</AlertTitle>
          <AlertDescription>
            Finish a practice session with at least one incorrect answer to
            populate review mistakes, or start the full session instead.
          </AlertDescription>
          <Link
            href={quizPlay(studySetId)}
            className={cn(
              buttonVariants({ variant: "default" }),
              "mt-3 inline-flex w-fit",
            )}
          >
            Open full practice
          </Link>
        </Alert>
      );
    }
    return (
      <Alert
        className={cn(
          "border-orange-500/40 bg-orange-950/30 text-amber-100",
          stitch &&
            "rounded-sm border-[color-mix(in_srgb,var(--qp-outline-variant)_40%,hsl(32deg_95%_45%))] bg-[color-mix(in_srgb,var(--qp-surface-container-low)_88%,hsl(32deg_90%_92%))] text-[var(--qp-on-bg)]",
        )}
        role="status"
      >
        <AlertTitle
          className={cn(!stitch && "text-amber-200", stitch && "text-[var(--qp-primary-container)]")}
        >
          No approved items for practice yet.
        </AlertTitle>
        <AlertDescription
          className={cn(!stitch && "text-amber-100/90", stitch && "text-[var(--qp-muted)]")}
        >
          Approve complete MCQs on Review first (stem, four options, correct
          answer).
        </AlertDescription>
        <Link
          href={editQuiz(studySetId)}
          className={cn(
            buttonVariants({ variant: "link" }),
            "mt-2 inline-flex h-auto px-0",
          )}
        >
          Go to Review
        </Link>
      </Alert>
    );
  }

  if (finished) {
    if (stitch) {
      return (
        <div
          className={cn(
            quizPlayStitchCardClass,
            "flex min-h-0 flex-col gap-6 lg:col-start-1 lg:row-start-1",
          )}
          role="status"
          aria-live="polite"
        >
          <div className="space-y-2">
            <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--qp-secondary)]">
              Session complete
            </p>
            <p className="text-sm text-[var(--qp-muted)]">
              Preparing results…
            </p>
          </div>
        </div>
      );
    }

    const total = playable.length;
    const wrongCount = total - correctCount;
    const pct =
      total > 0 ? Math.round((100 * correctCount) / total) : 0;
    const breakdownScroll = total > 8;

    const resultsCardClass = stitch
      ? "overflow-hidden rounded-sm bg-[var(--qp-surface-container-lowest)] shadow-[var(--qp-card-shadow)] ring-0 lg:col-start-1 lg:row-start-1"
      : "shadow-lg";

    const primaryCtaClass = stitch
      ? cn(
          buttonVariants({ variant: "default" }),
          "rounded-sm bg-[var(--qp-primary)] font-heading text-xs font-bold uppercase tracking-wide text-[var(--qp-primary-foreground)] shadow-none hover:bg-[var(--qp-primary-container)]",
        )
      : cn(buttonVariants({ variant: "default" }));

    const outlineCtaClass = stitch
      ? cn(
          buttonVariants({ variant: "outline" }),
          "rounded-sm border-[color-mix(in_srgb,var(--qp-outline-variant)_45%,transparent)] bg-transparent font-heading text-xs font-bold uppercase tracking-wide text-[var(--qp-secondary)] hover:bg-[var(--qp-surface-container-low)]",
        )
      : cn(buttonVariants({ variant: "outline" }));

    const resultsCard = (
      <Card className={cn(resultsCardClass)}>
        <CardHeader
          className={cn(
            "space-y-3",
            stitch && "border-b border-[color-mix(in_srgb,var(--qp-outline-variant)_18%,transparent)] bg-[color-mix(in_srgb,var(--qp-surface-container)_55%,transparent)] px-6 py-6 backdrop-blur-md sm:px-8",
          )}
        >
          <CardTitle
            id="quiz-results-title"
            className={cn(
              stitch &&
                "font-heading text-lg font-extrabold tracking-tight text-[var(--qp-tertiary)] sm:text-xl",
            )}
          >
            Session complete
          </CardTitle>
          <div
            className={cn(
              "flex flex-wrap items-baseline gap-x-2 gap-y-1 font-bold tabular-nums tracking-tight text-[32px] leading-[1.1]",
              stitch && "font-heading",
            )}
            aria-live="polite"
          >
            <span
              className={cn(
                stitch ? "text-[var(--qp-secondary)]" : "text-emerald-500",
              )}
            >
              {pct}%
            </span>
            <span
              className={cn(
                "font-semibold text-xl",
                stitch ? "text-[var(--qp-muted)]" : "text-muted-foreground",
              )}
              aria-hidden
            >
              ·
            </span>
            <span
              className={cn(
                stitch ? "text-[var(--qp-on-bg)]" : "text-foreground",
              )}
            >
              {correctCount} / {total} correct
            </span>
          </div>
          <CardDescription
            className={cn(stitch && "text-[var(--qp-muted)]")}
          >
            {wrongCount > 0
              ? `${wrongCount} to review`
              : "All correct — nothing to drill."}
          </CardDescription>
        </CardHeader>

        {stitch ? (
          <div className="h-px bg-[color-mix(in_srgb,var(--qp-outline-variant)_15%,transparent)]" />
        ) : (
          <Separator />
        )}

        <CardContent className={cn("pt-6", stitch && "px-6 sm:px-8")}>
          <section
            role="region"
            aria-labelledby="quiz-results-title"
            className="space-y-3"
          >
            <h3
              className={cn(
                "text-xs font-semibold text-muted-foreground",
                stitch &&
                  "font-label text-[10px] tracking-[0.16em] text-[var(--qp-secondary)]",
              )}
            >
              Item review
            </h3>
            {breakdownScroll ? (
              <ScrollArea className="h-[min(22.5rem,50vh)] pr-3">
                <ul role="list" className="space-y-2">
                  {playable.map((q, i) => {
                    const missed = wrongIdsRef.current.has(q.id);
                    return (
                      <li key={q.id} role="listitem">
                        <ResultRow
                          index={i + 1}
                          stem={q.question}
                          missed={missed}
                          visualTheme={visualTheme}
                        />
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            ) : (
              <ul role="list" className="space-y-2">
                {playable.map((q, i) => {
                  const missed = wrongIdsRef.current.has(q.id);
                  return (
                    <li key={q.id} role="listitem">
                      <ResultRow
                        index={i + 1}
                        stem={q.question}
                        missed={missed}
                        visualTheme={visualTheme}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </CardContent>

        <CardFooter
          className={cn(
            "flex flex-wrap gap-3",
            stitch &&
              "border-t border-[color-mix(in_srgb,var(--qp-outline-variant)_15%,transparent)] bg-[color-mix(in_srgb,var(--qp-surface-container-lowest)_92%,var(--qp-surface-container-low))] px-6 py-5 sm:px-8",
          )}
        >
          {wrongCount > 0 ? (
            <Link
              href={`${quizPlay(studySetId)}?review=mistakes`}
              className={primaryCtaClass}
            >
              Drill mistakes
            </Link>
          ) : (
            <Button
              type="button"
              disabled
              title="You did not miss any items in this session."
              className={cn(stitch && "rounded-sm font-heading text-xs uppercase")}
            >
              Drill mistakes
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className={outlineCtaClass}
            onClick={restart}
          >
            Practice again
          </Button>
          <Link
            href="/dashboard"
            aria-label="Open library"
            className={outlineCtaClass}
          >
            Open library
          </Link>
        </CardFooter>
      </Card>
    );

    return resultsCard;
  }

  const progressPct =
    playable.length > 0
      ? Math.min(100, Math.round((100 * index) / playable.length))
      : 0;

  const choiceButtons = (opts: {
    gap: string;
    rowRounded: "rounded-lg" | "rounded-sm";
    letterSize: "sm" | "md";
    layout?: "list" | "grid2";
  }) => {
    const letterH = opts.letterSize === "md" ? "h-8 min-w-8" : "h-7 min-w-7";
    const layout = opts.layout ?? "list";
    return (
      <div
        className={cn(
          layout === "list" && "flex flex-col",
          layout === "list" && opts.gap,
          layout === "grid2" &&
            "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3",
        )}
        role="group"
        aria-label="Answer choices"
      >
        {current.options.map((opt, idx) => {
          const i = idx as 0 | 1 | 2 | 3;
          const isPicked = picked === i;
          let rowClass = cn(
            "flex w-full cursor-pointer gap-4 border px-4 py-4 text-left text-sm transition-colors",
            layout === "grid2"
              ? "min-h-[5.25rem] items-center"
              : "items-start",
            opts.rowRounded,
            revealed && "cursor-default",
          );
          if (stitch) {
            rowClass = cn(
              rowClass,
              "border-[color-mix(in_srgb,var(--qp-outline-variant)_32%,transparent)] bg-[var(--qp-surface-container-low)] text-[var(--qp-on-bg)] hover:bg-[var(--qp-surface-container)]",
              isPicked &&
                "border-[color-mix(in_srgb,var(--qp-primary)_55%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--qp-primary)_25%,transparent)]",
            );
          } else {
            rowClass = cn(
              rowClass,
              "border-border bg-secondary hover:bg-muted text-foreground",
              isPicked && "ring-1 ring-foreground/10",
            );
          }

          const letterClass = cn(
            "inline-flex shrink-0 items-center justify-center font-bold",
            letterH,
            opts.rowRounded,
            stitch
              ? "font-label text-sm tracking-normal"
              : "text-xs ring-1 ring-border",
            isPicked
              ? stitch
                ? "border-0 bg-[var(--qp-primary)] text-[var(--qp-primary-foreground)]"
                : "bg-foreground text-background"
              : stitch
                ? "border border-[color-mix(in_srgb,var(--qp-outline-variant)_45%,transparent)] bg-[var(--qp-surface-container-lowest)] text-[var(--qp-secondary)]"
                : "bg-secondary text-foreground",
          );

          return (
            <button
              key={idx}
              type="button"
              disabled={revealed}
              onClick={() => handlePick(i)}
              className={rowClass}
            >
              <span className={letterClass}>{LABELS[idx]}</span>
              <span
                className={cn(
                  "min-w-0 flex-1 leading-snug",
                  layout === "list" && "pt-0.5",
                  layout === "grid2" && "line-clamp-4",
                )}
              >
                <MathText
                  source={opt}
                  className={cn(
                    "leading-snug",
                    stitch && "font-medium text-[var(--qp-on-bg)]",
                  )}
                />
                {current.optionImageIds?.[i] ? (
                  <MediaImage
                    mediaId={current.optionImageIds[i]!}
                    visualTheme={visualTheme}
                  />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  if (stitch) {
    return (
      <div
        className={cn(
          quizPlayStitchCardClass,
          "flex min-h-0 flex-col gap-6 lg:col-start-1 lg:row-start-1",
        )}
      >
        <div className="space-y-4">
          <MathText
            source={current.question}
            className="font-heading text-lg font-bold leading-tight tracking-tight text-(--qp-tertiary) sm:text-xl md:text-2xl lg:text-[28px]"
          />
          {current.questionImageId ? (
            <div className="overflow-hidden rounded-sm border border-[color-mix(in_srgb,var(--qp-outline-variant)_14%,transparent)] bg-[color-mix(in_srgb,var(--qp-surface-container-low)_28%,white)] p-3">
              <MediaImage
                mediaId={current.questionImageId}
                visualTheme={visualTheme}
              />
            </div>
          ) : null}
        </div>

        <div className="h-px bg-[color-mix(in_srgb,var(--qp-outline-variant)_14%,transparent)]" />

        <div className="space-y-4">
          {choiceButtons({
            gap: "gap-3",
            rowRounded: "rounded-sm",
            letterSize: "md",
            layout: "grid2",
          })}

          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <QuizInteractionHints
                items={[
                  { key: "1–4", label: "Choose" },
                  { key: "← →", label: "Navigation" },
                ]}
                className="mt-0 px-0 justify-start"
              />
            </div>

            {revealed ? (
              <Button
                type="button"
                onClick={goNext}
                className="rounded-sm bg-[var(--qp-primary)] px-6 py-3 font-heading text-xs font-bold uppercase tracking-wide text-[var(--qp-primary-foreground)] shadow-none hover:bg-[var(--qp-primary-container)]"
              >
                {index + 1 >= playable.length ? "See results →" : "Next →"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden shadow-lg">
      <CardHeader className="space-y-3 border-b border-border/70 bg-muted/20 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">
            Question {index + 1} of {playable.length}
          </p>
          <Badge variant="secondary" className="tabular-nums">
            Score {correctCount}/{playable.length}
          </Badge>
        </div>
        <Progress value={progressPct} />
      </CardHeader>
      <CardContent className="space-y-4 px-4 py-6 sm:px-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Question
          </p>
          <MathText
            source={current.question}
            className="text-base font-medium leading-snug text-card-foreground"
          />
        </div>
        {current.questionImageId ? (
          <div className="mt-2">
            <MediaImage mediaId={current.questionImageId} />
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Choices
          </p>
          {choiceButtons({ gap: "gap-2", rowRounded: "rounded-lg", letterSize: "sm" })}
        </div>

        <p className="text-xs text-muted-foreground">
          Keys{" "}
          <kbd className="rounded bg-muted px-1 text-foreground">1</kbd>–
          <kbd className="rounded bg-muted px-1 text-foreground">4</kbd>{" "}
          choose; when revealed,{" "}
          <kbd className="rounded bg-muted px-1 text-foreground">Enter</kbd>{" "}
          continues.
        </p>

        {revealed ? (
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={goNext}>
              {index + 1 >= playable.length ? "See results →" : "Next →"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
