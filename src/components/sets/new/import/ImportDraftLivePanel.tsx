"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QuestionPreviewCard } from "@/components/ai/QuestionPreviewList";
import { QuestionReviewNavigator } from "@/components/review/QuestionReviewNavigator";
import {
  getDraftQuestions,
  putDraftQuestions,
  touchStudySetMeta,
} from "@/lib/db/studySetDb";
import {
  QuizImportQuestionCardSkeleton,
  quizImportSkeletonCount,
} from "@/components/sets/new/quiz/QuizImportReviewSkeleton";
import type { Question } from "@/types/question";
import type { StudyContentKind } from "@/types/studySet";

const POLL_MS = 650;

export type ImportDraftLivePanelProps = Readonly<{
  /** When null (e.g. during ingest), only skeleton slots render. */
  studySetId: string | null;
  pageCount: number | null;
  /** When false, no IDB poll; skeleton stream still shows from `pageCount`. */
  enabled: boolean;
  contentKind: StudyContentKind;
  reduceMotion?: boolean | null;
}>;

function questionsShallowChanged(prev: Question[], next: Question[]): boolean {
  if (prev.length !== next.length) {
    return true;
  }
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i]!;
    const b = next[i]!;
    if (
      a.id !== b.id ||
      a.correctIndex !== b.correctIndex ||
      a.question !== b.question
    ) {
      return true;
    }
    const ao = a.options ?? [];
    const bo = b.options ?? [];
    if (ao.length !== bo.length) {
      return true;
    }
    for (let j = 0; j < ao.length; j++) {
      if (ao[j] !== bo[j]) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Quiz import: merged skeleton slots + live MCQ rows from IndexedDB poll.
 * Flashcard drafts stay out of scope (parent renders flashcard skeleton separately).
 */
export function ImportDraftLivePanel({
  studySetId,
  pageCount,
  enabled,
  contentKind,
  reduceMotion,
}: ImportDraftLivePanelProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(
    null,
  );
  const reduce = Boolean(reduceMotion);

  const targetSlots = useMemo(
    () => quizImportSkeletonCount(pageCount),
    [pageCount],
  );

  const visibleCount = useMemo(() => {
    if (questions.length > targetSlots) {
      return questions.length;
    }
    return Math.max(questions.length, targetSlots);
  }, [questions.length, targetSlots]);

  const refresh = useCallback(async () => {
    if (!enabled || contentKind !== "quiz" || !studySetId) {
      return;
    }
    try {
      const next = await getDraftQuestions(studySetId);
      setQuestions((prev) =>
        questionsShallowChanged(prev, next) ? next : prev,
      );
    } catch {
      /* ignore transient IDB errors during poll */
    }
  }, [contentKind, enabled, studySetId]);

  useEffect(() => {
    setQuestions([]);
  }, [studySetId]);

  useEffect(() => {
    if (questions.length === 0) {
      setActiveQuestionId(null);
      return;
    }
    setActiveQuestionId((prev) =>
      prev && questions.some((q) => q.id === prev)
        ? prev
        : questions[0]!.id,
    );
  }, [questions]);

  useEffect(() => {
    if (!enabled || contentKind !== "quiz" || !studySetId) {
      return;
    }
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [contentKind, enabled, refresh, studySetId]);

  const handleSetCorrectIndex = useCallback(
    (questionId: string, index: 0 | 1 | 2 | 3) => {
      if (!studySetId) {
        return;
      }
      setQuestions((prev) => {
        const nextList = prev.map((q) =>
          q.id === questionId ? { ...q, correctIndex: index } : q,
        );
        void (async () => {
          try {
            await putDraftQuestions(studySetId, nextList);
            await touchStudySetMeta(studySetId, {});
          } catch {
            /* keep optimistic UI; next poll may resync */
          }
        })();
        return nextList;
      });
    },
    [studySetId],
  );

  if (contentKind !== "quiz") {
    return null;
  }

  const draftList = (
    <ul className="space-y-4" aria-label="Draft questions loading">
      {questions.map((q, i) => (
        <motion.li
          key={q.id}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduce
              ? { duration: 0 }
              : {
                  /* 1s between each row by index; cap avoids very long waits on huge lists */
                  delay: Math.min(i, 30) * 1,
                  duration: 0.32,
                  ease: [0.22, 1, 0.36, 1],
                }
          }
        >
          <QuestionPreviewCard
            question={q}
            index={i}
            onSetCorrectIndex={handleSetCorrectIndex}
            variant="import"
          />
        </motion.li>
      ))}
      {Array.from(
        { length: Math.max(0, visibleCount - questions.length) },
        (_, j) => (
          <li key={`sk-${questions.length + j}`}>
            <QuizImportQuestionCardSkeleton />
          </li>
        ),
      )}
    </ul>
  );

  if (questions.length === 0) {
    return draftList;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
      <div className="min-w-0 space-y-4 lg:col-span-8">{draftList}</div>
      <aside
        className="min-h-0 lg:col-span-4"
        aria-label="Question navigator"
      >
        <div className="lg:sticky lg:top-24 lg:z-10 lg:flex lg:min-h-0 lg:max-h-[min(70vh,calc(100dvh-7rem),calc(100vh-7rem))] lg:flex-col lg:gap-0">
          <QuestionReviewNavigator
            questions={questions}
            activeQuestionId={activeQuestionId}
            className="min-w-0"
            onSelect={(id) => {
              setActiveQuestionId(id);
              queueMicrotask(() => {
                document
                  .getElementById(`review-q-${id}`)
                  ?.scrollIntoView({
                    behavior: reduce ? "auto" : "smooth",
                    block: "nearest",
                  });
              });
            }}
          />
        </div>
      </aside>
    </div>
  );
}
