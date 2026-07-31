"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/locale/LocaleProvider";
import { completeStudyChallengeAttempt, loadStudyChallengeAttempt, saveStudyChallengeProgress, type ChallengePractice, type ChallengeResult } from "@/lib/client/studyTogether";

export function StudyChallengePractice({ sessionId, attemptId }: { sessionId: string; attemptId: string }) {
  const { messages } = useLocale();
  const copy = messages.studyTogether;
  const [practice, setPractice] = useState<ChallengePractice | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const startedAt = useRef(0);
  const load = useCallback(() => { setError(false); startedAt.current = Date.now(); void loadStudyChallengeAttempt(sessionId, attemptId).then((data) => { setPractice(data); setAnswers([...data.selectedIndices, ...Array(Math.max(0, data.questions.length - data.selectedIndices.length)).fill(null)]); }).catch(() => setError(true)); }, [attemptId, sessionId]);
  useEffect(load, [load]);
  const choose = useCallback((choice: number) => {
    if (!practice || busy) return;
    const next = answers.map((answer, answerIndex) => answerIndex === index ? choice : answer);
    setAnswers(next);
    setBusy(true);
    void saveStudyChallengeProgress(sessionId, attemptId, next, index).catch(() => setError(true)).finally(() => setBusy(false));
  }, [answers, attemptId, busy, index, practice, sessionId]);
  const finish = useCallback(() => {
    setBusy(true);
    void completeStudyChallengeAttempt(sessionId, attemptId, answers, Math.floor((Date.now() - startedAt.current) / 1000)).then(setResult).catch(() => setError(true)).finally(() => setBusy(false));
  }, [answers, attemptId, sessionId]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key >= "1" && event.key <= "4") choose(Number(event.key) - 1);
      if (event.key === "Enter" && answers[index] !== null) index === (practice?.questions.length ?? 0) - 1 ? finish() : setIndex((value) => value + 1);
    };
    window.addEventListener("keydown", onKey); return () => { window.removeEventListener("keydown", onKey); };
  }, [answers, choose, finish, index, practice]);
  if (error) return <main className="mx-auto max-w-2xl p-6"><p>{copy.unavailable}</p><Button className="mt-4" onClick={load}>{copy.retry}</Button></main>;
  if (!practice) return <main className="p-6" aria-live="polite">{copy.loading}</main>;
  if (result) return <main className="mx-auto max-w-2xl p-6"><h1 className="text-2xl font-semibold">{copy.results}</h1>{result.resultsVisible ? <p className="mt-4 text-lg">{result.score}/{result.questionCount} · {Math.round(result.accuracy * 100)}%</p> : <p className="mt-4 text-muted-foreground">{copy.waitingForResults}</p>}</main>;
  const question = practice.questions[index];
  return <main className="mx-auto max-w-2xl space-y-6 p-6"><header><p className="text-sm text-muted-foreground">{copy.questionProgress(index + 1, practice.questions.length)}</p><h1 className="mt-2 text-2xl font-semibold">{practice.title}</h1></header><section aria-labelledby="challenge-question"><h2 id="challenge-question" className="text-lg font-medium">{question.prompt}</h2><div className="mt-4 grid gap-3" role="radiogroup">{question.choices.map((choice, choiceIndex) => <button key={choiceIndex} role="radio" aria-checked={answers[index] === choiceIndex} className="rounded-xl border p-4 text-left focus-visible:ring-2 aria-checked:border-primary aria-checked:bg-primary/5" onClick={() => choose(choiceIndex)}><span className="mr-3 font-semibold">{choiceIndex + 1}</span>{choice}</button>)}</div></section><p className="text-sm text-muted-foreground">{copy.keyboardInstructions}</p><div className="flex justify-end"><Button disabled={answers[index] === null || busy} onClick={() => index === practice.questions.length - 1 ? finish() : setIndex(index + 1)}>{busy ? copy.saving : index === practice.questions.length - 1 ? copy.complete : messages.workflows.practice.quiz.next}</Button></div></main>;
}
