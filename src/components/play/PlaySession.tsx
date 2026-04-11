"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ensureStudySetDb,
  getApprovedBank,
  getMediaBlob,
} from "@/lib/db/studySetDb";
import { isMcqComplete } from "@/lib/review/validateMcq";
import {
  getMistakeQuestionIds,
  recordQuizCompletion,
} from "@/lib/studySet/activityTracking";
import type { Question } from "@/types/question";
import { Button, buttonVariants } from "@/components/ui/button";
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

const LABELS = ["A", "B", "C", "D"] as const;

function ResultRow({
  index,
  stem,
  missed,
}: {
  index: number;
  stem: string;
  missed: boolean;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2">
      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
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

function MediaImage({ mediaId }: { mediaId: string }) {
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
  return (
    // eslint-disable-next-line @next/next/no-img-element -- object URL from IndexedDB blob
    <img
      src={url}
      alt=""
      className="mt-1 max-h-48 max-w-full rounded border border-border object-contain"
    />
  );
}

export type PlaySessionProps = {
  studySetId: string;
  /** When true, only questions from the last wrong-answer session are loaded. */
  reviewMistakesOnly?: boolean;
};

export function PlaySession({
  studySetId,
  reviewMistakesOnly = false,
}: PlaySessionProps) {
  const [playable, setPlayable] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<0 | 1 | 2 | 3 | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const sessionRecordedRef = useRef(false);
  const wrongIdsRef = useRef<Set<string>>(new Set());

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
        e instanceof Error ? e.message : "Could not load question bank.",
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

  const handlePick = useCallback(
    (choice: 0 | 1 | 2 | 3) => {
      if (!current) {
        return;
      }
      setPicked(choice);
      const ok = choice === current.correctIndex;
      if (!ok) {
        wrongIdsRef.current.add(current.id);
      }
      toast[ok ? "success" : "error"](
        ok ? "Correct!" : "Incorrect — check the highlighted answer.",
        { duration: 2200 },
      );
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

  const goNext = useCallback(() => {
    if (picked === null || current === undefined) {
      return;
    }
    if (picked === current.correctIndex) {
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
      if (e.key === "Enter" || e.key === " ") {
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
      <p className="text-sm text-muted-foreground" role="status">
        Loading…
      </p>
    );
  }

  if (loadError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    );
  }

  if (playable.length === 0) {
    if (reviewMistakesOnly) {
      return (
        <Alert className="border-border" role="status">
          <AlertTitle>No missed questions to review</AlertTitle>
          <AlertDescription>
            Finish a quiz with at least one incorrect answer to populate review
            mistakes, or take the full quiz instead.
          </AlertDescription>
          <Link
            href={`/sets/${studySetId}/play`}
            className={cn(
              buttonVariants({ variant: "default" }),
              "mt-3 inline-flex w-fit",
            )}
          >
            Take full quiz
          </Link>
        </Alert>
      );
    }
    return (
      <Alert
        className="border-orange-500/40 bg-orange-950/30 text-amber-100"
        role="status"
      >
        <AlertTitle className="text-amber-200">
          No approved questions for a quiz yet.
        </AlertTitle>
        <AlertDescription className="text-amber-100/90">
          Approve complete MCQs on Review first (stem, four options, correct
          answer).
        </AlertDescription>
        <Link
          href={`/sets/${studySetId}/review`}
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
    const total = playable.length;
    const wrongCount = total - correctCount;
    const pct =
      total > 0 ? Math.round((100 * correctCount) / total) : 0;
    const breakdownScroll = total > 8;

    return (
      <Card className="shadow-lg">
        <CardHeader className="space-y-3">
          <CardTitle id="quiz-results-title">Session complete</CardTitle>
          <div
            className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-bold tabular-nums tracking-tight text-[32px] leading-[1.1]"
            aria-live="polite"
          >
            <span className="text-emerald-500">{pct}%</span>
            <span
              className="text-muted-foreground font-semibold text-xl"
              aria-hidden
            >
              ·
            </span>
            <span className="text-foreground">
              {correctCount} / {total} correct
            </span>
          </div>
          <CardDescription>
            {wrongCount > 0
              ? `${wrongCount} to review`
              : "All correct — nothing to drill."}
          </CardDescription>
        </CardHeader>

        <Separator />

        <CardContent className="pt-6">
          <section
            role="region"
            aria-labelledby="quiz-results-title"
            className="space-y-3"
          >
            <h3 className="text-xs font-semibold text-muted-foreground">
              Question review
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
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </CardContent>

        <CardFooter className="flex flex-wrap gap-3">
          {wrongCount > 0 ? (
            <Link
              href={`/sets/${studySetId}/play?review=mistakes`}
              className={cn(buttonVariants({ variant: "default" }))}
            >
              Drill mistakes
            </Link>
          ) : (
            <Button
              type="button"
              disabled
              title="You did not miss any questions in this session."
            >
              Drill mistakes
            </Button>
          )}
          <Button type="button" variant="outline" onClick={restart}>
            Quiz again
          </Button>
          <Link
            href="/dashboard"
            aria-label="Open library"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Open library
          </Link>
        </CardFooter>
      </Card>
    );
  }

  const progressPct =
    playable.length > 0
      ? Math.min(100, Math.round((100 * index) / playable.length))
      : 0;

  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-3 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Question {index + 1} of {playable.length}
          </p>
          <Badge variant="secondary" className="tabular-nums">
            Score {correctCount}/{playable.length}
          </Badge>
        </div>
        <Progress value={progressPct} />
      </CardHeader>
      <CardContent className="space-y-4">
        <MathText
          source={current.question}
          className="text-base font-medium leading-snug text-card-foreground"
        />
        {current.questionImageId ? (
          <div className="mt-2">
            <MediaImage mediaId={current.questionImageId} />
          </div>
        ) : null}

        <div
          className="mt-2 flex flex-col gap-2"
          role="group"
          aria-label="Answer choices"
        >
          {current.options.map((opt, idx) => {
            const i = idx as 0 | 1 | 2 | 3;
            const isPicked = picked === i;
            const isCorrect = i === current.correctIndex;
            let rowClass =
              "rounded-lg border px-3 py-2 text-left text-sm transition-colors";
            if (!revealed) {
              rowClass +=
                " border-border bg-secondary hover:bg-muted text-foreground";
            } else if (isCorrect) {
              rowClass +=
                " border-emerald-500/60 bg-emerald-950/40 text-foreground ring-1 ring-emerald-500/50";
            } else if (isPicked) {
              rowClass +=
                " border-red-400/50 bg-red-950/40 text-foreground";
            } else {
              rowClass +=
                " border-border bg-background text-muted-foreground";
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={revealed}
                onClick={() => handlePick(i)}
                className={`flex w-full cursor-pointer items-start gap-3 ${rowClass} ${revealed ? "cursor-default" : ""}`}
              >
                <span
                  className={`inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded text-xs font-bold ${
                    revealed && isCorrect
                      ? "bg-emerald-600 text-white"
                      : revealed && isPicked
                        ? "bg-red-600 text-white"
                        : "bg-secondary text-foreground ring-1 ring-border"
                  }`}
                >
                  {LABELS[idx]}
                </span>
                <span className="min-w-0 flex-1 pt-0.5 leading-snug">
                  <MathText source={opt} className="leading-snug" />
                  {current.optionImageIds?.[i] ? (
                    <MediaImage mediaId={current.optionImageIds[i]!} />
                  ) : null}
                </span>
              </button>
            );
          })}
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
              {index + 1 >= playable.length ? "See results" : "Next"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
