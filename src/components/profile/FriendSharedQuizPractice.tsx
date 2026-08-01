"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { MathText } from "@/components/math/MathText";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Question = {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string | null;
};

type SharedQuiz = {
  title: string;
  questions: Question[];
};

export function FriendSharedQuizPractice({ userId, quizId }: { userId: string; quizId: string }) {
  const [quiz, setQuiz] = useState<SharedQuiz | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    fetch(`/api/friends/profile/${userId}/quizzes/${quizId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Quiz unavailable");
        const body = (await response.json()) as { data: SharedQuiz };
        setQuiz(body.data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [quizId, userId]);

  if (status === "loading") return <main className="mx-auto w-full max-w-3xl py-16 text-sm text-muted-foreground" role="status">Loading quiz…</main>;
  if (!quiz) return <main className="mx-auto w-full max-w-3xl py-16" role="alert"><h1 className="font-heading text-2xl font-bold">Quiz unavailable</h1><p className="mt-2 text-muted-foreground">This quiz is only available to accepted friends.</p></main>;
  if (quiz.questions.length === 0) return <main className="mx-auto w-full max-w-3xl py-16"><h1 className="font-heading text-2xl font-bold">{quiz.title}</h1><p className="mt-3 text-muted-foreground">No questions available for practice.</p></main>;

  const question = quiz.questions[index];
  const revealed = picked !== null;
  const isCorrect = picked === question.correctIndex;
  const restart = () => { setIndex(0); setPicked(null); setCorrect(0); setFinished(false); };
  const next = () => {
    if (picked === null) return;
    if (isCorrect) setCorrect((value) => value + 1);
    if (index + 1 === quiz.questions.length) { setFinished(true); return; }
    setIndex((value) => value + 1);
    setPicked(null);
  };

  if (finished) return <main className="mx-auto w-full max-w-2xl py-12"><Card><CardHeader><CardTitle>{quiz.title}</CardTitle><CardDescription>Practice complete. You got {correct} of {quiz.questions.length} correct.</CardDescription></CardHeader><CardContent><Button type="button" onClick={restart}>Practice again</Button></CardContent></Card></main>;

  return <main className="mx-auto w-full max-w-3xl space-y-6 pb-12"><header className="border-b border-border pb-6"><p className="font-label text-xs font-bold uppercase tracking-[0.18em] text-primary">Friend shared quiz</p><h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight">{quiz.title}</h1><p className="mt-2 text-sm text-muted-foreground">Read-only practice · Question {index + 1} of {quiz.questions.length}</p></header><Card><CardHeader><CardTitle className="text-xl leading-relaxed"><MathText source={question.prompt} /></CardTitle><CardDescription>Choose one answer.</CardDescription></CardHeader><CardContent className="space-y-3">{question.choices.map((choice, choiceIndex) => <button key={`${question.id}-${choiceIndex}`} type="button" disabled={revealed} onClick={() => setPicked(choiceIndex)} className={cn("flex w-full items-start gap-3 border p-4 text-left text-sm transition-colors disabled:cursor-default", !revealed && "hover:border-primary/50 hover:bg-muted/30", revealed && choiceIndex === question.correctIndex && "border-emerald-500 bg-emerald-500/10", revealed && choiceIndex === picked && choiceIndex !== question.correctIndex && "border-destructive bg-destructive/10")}><span className="flex size-5 shrink-0 items-center justify-center border border-current text-xs font-bold">{String.fromCharCode(65 + choiceIndex)}</span><MathText source={choice} /></button>)}{revealed ? <div className="space-y-3 border-t border-border pt-4"><p className={cn("flex items-center gap-2 text-sm font-semibold", isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>{isCorrect ? <Check className="size-4" /> : <X className="size-4" />}{isCorrect ? "Correct" : "Incorrect"}</p>{question.explanation ? <p className="text-sm leading-6 text-muted-foreground"><MathText source={question.explanation} /></p> : null}<Button type="button" onClick={next}>{index + 1 === quiz.questions.length ? "See results" : "Next question"}<ChevronRight className="size-4" /></Button></div> : null}</CardContent></Card></main>;
}
