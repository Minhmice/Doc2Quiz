"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/client/supabase";
import type { Question } from "@/types/question";
import {
  ensureStudySetDb,
  getApprovedBank,
  putApprovedBankForStudySet,
  touchStudySetMeta,
} from "@/lib/client/studySetDb";
import { countUncertainMappings } from "@/lib/learning";
import { allMcqsComplete, isMcqComplete } from "@/lib/review/validateMcq";
import { quizReview } from "@/lib/routes/studySetPaths";
import { postQuizGenerate } from "@/lib/client/quizGenerateStudySet";
import { postCanonicalize } from "@/lib/client/canonicalizeStudySet";
import { useLocale } from "@/components/locale/LocaleProvider";
import { QuestionReviewNavigator } from "@/components/review/QuestionReviewNavigator";
import { ReviewList } from "@/components/review/ReviewList";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { CanonicalSourceReview } from "@/components/canonical/CanonicalSourceReview";
import { fetchCanonicalPreview, type CanonicalPreviewData } from "@/lib/client/canonicalizeStudySet";

export type ReviewSectionProps = {
  studySetId: string;
  /** Bump to force a reload from IndexedDB (e.g. after external bank writes). */
  reloadKey?: number;
  metaTitle?: string | null;
  metaSubtitle?: string | null;
  sourceFileLabel?: string | null;
};

export function ReviewSection({
  studySetId,
  reloadKey = 0,
  metaTitle,
  metaSubtitle,
  sourceFileLabel,
}: ReviewSectionProps) {
  const router = useRouter();
  const { messages } = useLocale();
  const copy = messages.workflows.review;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sourcePreview, setSourcePreview] = useState<CanonicalPreviewData | null>(null);
  const [generating, setGenerating] = useState(false);
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

      const canonical = await fetchCanonicalPreview(studySetId).catch(() => null);
      setSourcePreview(canonical);
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

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      await postCanonicalize(studySetId);
      await postQuizGenerate(studySetId);
      toast.success("Quiz generated. Loading your questions…");
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }, [reload, studySetId]);

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
      toast.success(copy.questionRemoved);
    },
    [copy.questionRemoved, studySetId],
  );

  const saveApprovedBank = useCallback(async () => {
    if (questions.length === 0) {
      return false;
    }
    if (!allMcqsComplete(questions)) {
      setApproveError(copy.approveError);
      return false;
    }
    const payload = {
      version: 1 as const,
      savedAt: new Date().toISOString(),
      questions,
    };
    try {
      await putApprovedBankForStudySet(studySetId, payload);
      return true;
    } catch {
      setApproveError(copy.approveError);
      return false;
    }
  }, [copy.approveError, questions, studySetId]);

  const handleDone = useCallback(async () => {
    setApproveError(null);
    const ok = await saveApprovedBank();
    if (ok) {
      router.push(`/quiz/${studySetId}`);
    }
  }, [router, saveApprovedBank, studySetId]);

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
            {copy.studySet}
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
            {copy.editQuestions}
            {metaTitle ? (
              <>
                {" "}
                <span className="text-foreground">· {metaTitle}</span>
              </>
            ) : null}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {metaSubtitle ??
              copy.quizHelp}
          </p>
        </header>

        {questions.length > 0 ? (
          <div className="rounded-sm border border-border/50 bg-muted/20 p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex flex-wrap gap-8 sm:gap-10">
                <div>
                  <p className="font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {copy.total}
                  </p>
                  <p className="font-heading text-xl font-bold text-foreground tabular-nums">
                    {questions.length}
                  </p>
                </div>
                <div>
                  <p className="font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {copy.incomplete}
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
                    {copy.removed}
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
            <AlertTitle>{copy.mappingTitle}</AlertTitle>
            <AlertDescription>
              {copy.mappingDescription(uncertainMappingCount)}
            </AlertDescription>
          </Alert>
        ) : null}

        {approveError ? (
          <Alert variant="destructive">
            <AlertTitle>{copy.cannotSave}</AlertTitle>
            <AlertDescription>{approveError}</AlertDescription>
          </Alert>
        ) : null}

        {questions.length === 0 ? (
          sourcePreview ? (
            <CanonicalSourceReview
              preview={sourcePreview}
              action={
                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={generating}
                  className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {generating ? "Generating…" : "Canonicalize and generate quiz"}
                </button>
              }
            />
          ) : (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              {copy.noQuestions}
            </p>
            <p>
              <Link
                href={quizReview(studySetId)}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {copy.backToPreview}
              </Link>
            </p>
          </div>
          )
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
              aria-label={copy.navigatorLabel}
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
                        ? copy.incompleteStatus(incompleteCount)
                        : copy.readyStatus,
                    canApprove,
                    onDone: () => void handleDone(),
                    backToLibraryHref: "/dashboard",
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
