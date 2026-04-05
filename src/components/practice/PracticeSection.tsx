"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Question } from "@/types/question";
import { usePracticeSession } from "@/hooks/usePracticeSession";
import { QuestionMap } from "@/components/practice/QuestionMap";
import { PracticeQuestionView } from "@/components/practice/PracticeQuestionView";

export type PracticeSectionProps = {
  questions: Question[];
  sessionKey: number;
  onClose: () => void;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return true;
  }
  return target.isContentEditable;
}

export function PracticeSection({
  questions,
  sessionKey,
  onClose,
}: PracticeSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevStatusRef = useRef<string>("idle");

  const {
    status,
    currentIndex,
    currentQuestion,
    answersByQuestionId,
    startSession,
    reset,
    answerChoice,
    goPrevious,
    goNext,
    goToIndex,
    isCurrentAnswered,
  } = usePracticeSession();

  useEffect(() => {
    reset();
    if (questions.length > 0) {
      startSession(questions);
    }
  }, [sessionKey, questions, reset, startSession]);

  useEffect(() => {
    if (status === "active" && prevStatusRef.current !== "active") {
      const id = requestAnimationFrame(() => {
        containerRef.current?.focus();
      });
      prevStatusRef.current = status;
      return () => cancelAnimationFrame(id);
    }
    prevStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (status !== "active") {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) {
        return;
      }
      if (e.key === "1" || e.key === "2" || e.key === "3" || e.key === "4") {
        e.preventDefault();
        answerChoice((Number(e.key) - 1) as 0 | 1 | 2 | 3);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrevious();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, answerChoice, goPrevious, goNext]);

  const answeredIndices = useMemo(() => {
    const set = new Set<number>();
    questions.forEach((q, i) => {
      if (answersByQuestionId[q.id]) {
        set.add(i);
      }
    });
    return set;
  }, [questions, answersByQuestionId]);

  if (questions.length === 0) {
    return null;
  }

  const total = questions.length;
  const atStart = currentIndex <= 0;
  const atEnd = currentIndex >= total - 1;

  const selectedChoice = currentQuestion
    ? (answersByQuestionId[currentQuestion.id]?.choiceIndex ?? null)
    : null;

  const showFeedback = isCurrentAnswered();

  return (
    <div
      ref={containerRef}
      role="region"
      tabIndex={0}
      className="mt-10 border-t border-neutral-200 pt-10 outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 focus-visible:ring-offset-2"
      aria-labelledby="practice-heading"
    >
      <h2
        id="practice-heading"
        className="text-lg font-semibold tracking-tight text-neutral-900"
      >
        Practice
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        Keys <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1">1</kbd>–
        <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1">4</kbd> answer;
        <kbd className="ml-1 rounded border border-neutral-300 bg-neutral-100 px-1">←</kbd>
        <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1">→</kbd> move
        between questions.
      </p>

      {status === "complete" ? (
        <div
          className="mt-6 rounded-lg border border-teal-200 bg-teal-50/80 p-4 text-sm text-teal-950"
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold">Session complete</p>
          <p className="mt-2">
            Detailed scoring and a &quot;drill mistakes&quot; loop will arrive in the next
            step. For now, you can close this session or start again from the review section.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 cursor-pointer rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-teal-800"
          >
            Done
          </button>
        </div>
      ) : currentQuestion ? (
        <>
          <QuestionMap
            total={total}
            currentIndex={currentIndex}
            answeredIndices={answeredIndices}
            onSelectIndex={goToIndex}
          />
          <PracticeQuestionView
            question={currentQuestion}
            selectedChoice={selectedChoice}
            showFeedback={showFeedback}
            correctIndex={currentQuestion.correctIndex}
            onChoose={answerChoice}
          />
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={goPrevious}
              disabled={atStart}
              className="cursor-pointer rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors duration-200 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={atEnd}
              className="cursor-pointer rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors duration-200 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
