"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Question } from "@/types/question";
import {
  deleteMedia,
  ensureStudySetDb,
  getApprovedBank,
  putApprovedBankForStudySet,
  touchStudySetMeta,
} from "@/lib/db/studySetDb";
import { countUncertainMappings } from "@/lib/learning";
import { allMcqsComplete, isMcqComplete } from "@/lib/review/validateMcq";
import { newRoot } from "@/lib/routes/studySetPaths";
import { QuestionReviewNavigator } from "@/components/review/QuestionReviewNavigator";
import { ReviewList } from "@/components/review/ReviewList";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export type ReviewSectionProps = {
  studySetId: string;
  /** Bump to force a reload from IndexedDB (e.g. after external bank writes). */
  reloadKey?: number;
  metaTitle?: string | null;
  metaSubtitle?: string | null;
  sourceFileLabel?: string | null;
};

const APPROVE_ERROR = "Some questions are incomplete. Please fix before saving.";

export function ReviewSection({
  studySetId,
  reloadKey = 0,
  metaTitle,
  metaSubtitle,
  sourceFileLabel,
}: ReviewSectionProps) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const initialTotalRef = useRef(0);
  /** After navigator click / open edit, ignore scroll-spy briefly so smooth scroll can finish. */
  const scrollSpyLockUntilRef = useRef(0);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await ensureStudySetDb();
      const approved = await getApprovedBank(studySetId);
      const list = approved?.questions ?? [];
      setQuestions(list);
      if (list.length > 0) {
        initialTotalRef.current = list.length;
      }
    } finally {
      setLoading(false);
    }
    setEditingId(null);
    setApproveError(null);
  }, [studySetId]);

  useEffect(() => {
    void reload();
  }, [studySetId, reloadKey, reload]);

  useEffect(() => {
    if (questions.length === 0) {
      setActiveQuestionId(null);
      return;
    }
    setActiveQuestionId((prev) => {
      if (prev && questions.some((q) => q.id === prev)) {
        return prev;
      }
      return questions[0]?.id ?? null;
    });
  }, [questions]);

  const scrollQuestionCardIntoView = useCallback((id: string) => {
    requestAnimationFrame(() => {
      document.getElementById(`review-q-${id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, []);

  useEffect(() => {
    if (loading || questions.length === 0) {
      return;
    }
    const main = document.querySelector("main");
    if (!main) {
      return;
    }
    const threshold = Array.from({ length: 21 }, (_, i) => i / 20);
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < scrollSpyLockUntilRef.current) {
          return;
        }
        let bestId: string | null = null;
        let bestRatio = -1;
        for (const e of entries) {
          if (!e.isIntersecting) {
            continue;
          }
          const el = e.target;
          if (!(el instanceof HTMLElement) || !el.id.startsWith("review-q-")) {
            continue;
          }
          if (e.intersectionRatio > bestRatio) {
            bestRatio = e.intersectionRatio;
            bestId = el.id.slice("review-q-".length);
          }
        }
        if (bestId != null && bestRatio > 0) {
          setActiveQuestionId((prev) => (prev === bestId ? prev : bestId));
        }
      },
      {
        root: main,
        rootMargin: "-40% 0px -50% 0px",
        threshold,
      },
    );

    let cancelled = false;
    const observeAll = () => {
      if (cancelled) {
        return;
      }
      for (const q of questions) {
        const el = document.getElementById(`review-q-${q.id}`);
        if (el) {
          observer.observe(el);
        }
      }
    };

    const raf0 = requestAnimationFrame(() => {
      requestAnimationFrame(observeAll);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf0);
      observer.disconnect();
    };
  }, [loading, questions]);

  const handleNavigatorSelect = useCallback(
    (id: string) => {
      scrollSpyLockUntilRef.current = Date.now() + 750;
      setActiveQuestionId(id);
      scrollQuestionCardIntoView(id);
    },
    [scrollQuestionCardIntoView],
  );

  const handleEditRequest = useCallback(
    (id: string) => {
      scrollSpyLockUntilRef.current = Date.now() + 750;
      setEditingId(id);
      setActiveQuestionId(id);
      scrollQuestionCardIntoView(id);
    },
    [scrollQuestionCardIntoView],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleSaveEdit = useCallback(
    async (_id: string, next: Question) => {
      setQuestions((prev) => {
        const nextList = prev.map((q) => (q.id === next.id ? next : q));
        void putApprovedBankForStudySet(studySetId, {
          version: 1,
          savedAt: new Date().toISOString(),
          questions: nextList,
        });
        void touchStudySetMeta(studySetId, {});
        return nextList;
      });
      setEditingId(null);
      setApproveError(null);
    },
    [studySetId],
  );

  const handleSetCorrectIndex = useCallback(
    (qid: string, index: 0 | 1 | 2 | 3) => {
      setApproveError(null);
      setQuestions((prev) => {
        const nextList = prev.map((q) =>
          q.id === qid ? { ...q, correctIndex: index } : q,
        );
        void putApprovedBankForStudySet(studySetId, {
          version: 1,
          savedAt: new Date().toISOString(),
          questions: nextList,
        });
        void touchStudySetMeta(studySetId, {});
        return nextList;
      });
    },
    [studySetId],
  );

  const handleDelete = useCallback(
    (qid: string) => {
      setQuestions((prev) => {
        const removed = prev.find((q) => q.id === qid);
        if (removed) {
          void (async () => {
            try {
              if (removed.questionImageId) {
                await deleteMedia(removed.questionImageId);
              }
              const oi = removed.optionImageIds;
              if (oi) {
                for (const mid of oi) {
                  if (mid) {
                    await deleteMedia(mid);
                  }
                }
              }
            } catch {
              /* ignore */
            }
          })();
        }
        const nextList = prev.filter((q) => q.id !== qid);
        void putApprovedBankForStudySet(studySetId, {
          version: 1,
          savedAt: new Date().toISOString(),
          questions: nextList,
        });
        void touchStudySetMeta(studySetId, {});
        return nextList;
      });
      setEditingId((e) => (e === qid ? null : e));
      setApproveError(null);
    },
    [studySetId],
  );

  const saveApprovedBank = useCallback(async () => {
    if (questions.length === 0) {
      return false;
    }
    if (!allMcqsComplete(questions)) {
      setApproveError(APPROVE_ERROR);
      return false;
    }
    const payload = {
      version: 1 as const,
      savedAt: new Date().toISOString(),
      questions,
    };
    try {
      await putApprovedBankForStudySet(studySetId, payload);
      await touchStudySetMeta(studySetId, { status: "ready" });
      return true;
    } catch {
      setApproveError(APPROVE_ERROR);
      return false;
    }
  }, [questions, studySetId]);

  const handleDone = useCallback(async () => {
    setApproveError(null);
    const ok = await saveApprovedBank();
    if (ok) {
      router.push("/dashboard");
    }
  }, [router, saveApprovedBank]);

  const removed = Math.max(0, initialTotalRef.current - questions.length);
  const uncertainMappingCount = countUncertainMappings(questions);
  const incompleteCount = questions.filter((q) => !isMcqComplete(q)).length;
  const canApprove = questions.length > 0 && allMcqsComplete(questions);
  const navigatorNeedsScroll = questions.length > 72;

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="relative pb-10">
      <section aria-labelledby="review-heading" className="space-y-6">
        <header className="space-y-2">
          <p className="font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Study set
            {sourceFileLabel ? (
              <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground/90">
                · {sourceFileLabel}
              </span>
            ) : null}
          </p>
          <h1
            id="review-heading"
            className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
          >
            Edit questions
            {metaTitle ? (
              <>
                {" "}
                <span className="text-foreground">· {metaTitle}</span>
              </>
            ) : null}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {metaSubtitle ??
              "Edits save automatically. When every question is a complete MCQ, use Done in the sidebar to save and return to your library."}
          </p>
        </header>

        {questions.length > 0 ? (
          <div className="rounded-sm border border-border/50 bg-muted/20 p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex flex-wrap gap-8 sm:gap-10">
                <div>
                  <p className="font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Total
                  </p>
                  <p className="font-heading text-xl font-bold text-foreground tabular-nums">
                    {questions.length}
                  </p>
                </div>
                <div>
                  <p className="font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Incomplete
                  </p>
                  <p
                    className={`font-heading text-xl font-bold tabular-nums ${
                      incompleteCount > 0 ? "text-chart-4" : "text-secondary"
                    }`}
                  >
                    {incompleteCount}
                  </p>
                </div>
                <div>
                  <p className="font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Removed
                  </p>
                  <p className="font-heading text-xl font-bold text-muted-foreground tabular-nums">
                    {removed}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {uncertainMappingCount > 0 ? (
          <Alert className="border-amber-500/50 bg-amber-50/80 text-amber-950 dark:bg-amber-950/20 dark:text-amber-50">
            <AlertTitle>Page mapping needs a look</AlertTitle>
            <AlertDescription>
              {uncertainMappingCount} question
              {uncertainMappingCount === 1 ? "" : "s"} have uncertain or missing
              page mapping. Check each question below.
            </AlertDescription>
          </Alert>
        ) : null}

        {approveError ? (
          <Alert variant="destructive">
            <AlertTitle>Cannot save</AlertTitle>
            <AlertDescription>{approveError}</AlertDescription>
          </Alert>
        ) : null}

        {questions.length === 0 ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              No questions yet. Complete import and AI parse when you{" "}
              <Link
                href={newRoot()}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                create a study set
              </Link>{" "}
              to generate a question bank.
            </p>
            <p>
              <Link
                href="/dashboard"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                ← Back to library
              </Link>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
            <div className="min-w-0 space-y-4 lg:col-span-8">
              <ReviewList
                studySetId={studySetId}
                questions={questions}
                editingId={editingId}
                onEditRequest={handleEditRequest}
                onCancelEdit={handleCancelEdit}
                onSaveEdit={handleSaveEdit}
                onDelete={handleDelete}
                onSetCorrectIndex={handleSetCorrectIndex}
              />
            </div>
            <aside
              className="min-h-0 lg:col-span-4 lg:self-stretch"
              aria-label="Question navigator and finish"
            >
              <div className="lg:sticky lg:top-6 lg:z-10">
                <QuestionReviewNavigator
                  questions={questions}
                  activeQuestionId={activeQuestionId}
                  onSelect={handleNavigatorSelect}
                  className="min-w-0"
                  scrollable={navigatorNeedsScroll}
                  finish={{
                    statusLine:
                      incompleteCount > 0
                        ? `${incompleteCount} incomplete — fix all MCQs to finish`
                        : "All questions complete — ready to finalize",
                    canApprove,
                    onDone: () => void handleDone(),
                  }}
                />
              </div>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
