"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PracticeAnswerRecord, PracticeSessionStatus } from "@/types/practice";
import type { Question } from "@/types/question";

const ADVANCE_MS = 500;

export function usePracticeSession() {
  const [status, setStatus] = useState<PracticeSessionStatus>("idle");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersByQuestionId, setAnswersByQuestionId] = useState<
    Record<string, PracticeAnswerRecord>
  >({});

  const questionsRef = useRef(questions);
  const currentIndexRef = useRef(currentIndex);
  const answersRef = useRef(answersByQuestionId);
  /** Browser timer id (`number`); avoid `NodeJS.Timeout` from Node typings. */
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);
  useEffect(() => {
    answersRef.current = answersByQuestionId;
  }, [answersByQuestionId]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setStatus("idle");
    setQuestions([]);
    setCurrentIndex(0);
    setAnswersByQuestionId({});
  }, [clearTimer]);

  const startSession = useCallback(
    (qs: Question[]) => {
      clearTimer();
      const copy = [...qs];
      setQuestions(copy);
      setCurrentIndex(0);
      setAnswersByQuestionId({});
      setStatus(copy.length > 0 ? "active" : "idle");
    },
    [clearTimer],
  );

  const answerChoice = useCallback(
    (choiceIndex: 0 | 1 | 2 | 3) => {
      if (status !== "active") {
        return;
      }
      const idx = currentIndexRef.current;
      const qs = questionsRef.current;
      const q = qs[idx];
      if (!q) {
        return;
      }

      const wasAnswered = answersRef.current[q.id] !== undefined;

      setAnswersByQuestionId((prev) => ({
        ...prev,
        [q.id]: { choiceIndex },
      }));

      if (wasAnswered) {
        return;
      }

      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = undefined;
        const i = currentIndexRef.current;
        const len = questionsRef.current.length;
        if (len === 0) {
          return;
        }
        if (i >= len - 1) {
          setStatus("complete");
        } else {
          setCurrentIndex(i + 1);
        }
      }, ADVANCE_MS);
    },
    [status, clearTimer],
  );

  const goPrevious = useCallback(() => {
    clearTimer();
    setCurrentIndex((i) => (i > 0 ? i - 1 : i));
  }, [clearTimer]);

  const goNext = useCallback(() => {
    clearTimer();
    setCurrentIndex((i) => {
      const max = questionsRef.current.length - 1;
      return i < max ? i + 1 : i;
    });
  }, [clearTimer]);

  const goToIndex = useCallback(
    (i: number) => {
      clearTimer();
      const max = questionsRef.current.length - 1;
      if (i >= 0 && i <= max) {
        setCurrentIndex(i);
      }
    },
    [clearTimer],
  );

  const currentQuestion = useMemo(
    () => questions[currentIndex] ?? null,
    [questions, currentIndex],
  );

  const isCurrentAnswered = useCallback(() => {
    const q = questions[currentIndex];
    if (!q) {
      return false;
    }
    return answersByQuestionId[q.id] !== undefined;
  }, [questions, currentIndex, answersByQuestionId]);

  return {
    status,
    questions,
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
  };
}
