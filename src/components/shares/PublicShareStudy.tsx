"use client";

import { useCallback, useMemo, useState } from "react";

import { MathText } from "@/components/math/MathText";
import { useLocale } from "@/components/locale/LocaleProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { enqueueAnonymousQuizAttempt } from "@/lib/client/anonymousQuizAttempts";
import { cn } from "@/lib/utils";
import type {
  PublicShareDto,
  PublicShareFlashcardTarget,
  PublicShareQuizTarget,
  PublicShareWorkspaceTarget,
} from "@/lib/server/shares/publicShare";

const CHOICE_LABELS = ["A", "B", "C", "D"] as const;

type PublicShareStudyProps = {
  share: PublicShareDto;
};

export function PublicShareUnavailable() {
  const { messages } = useLocale();
  const copy = messages.collaboration.unavailable;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}

function PublicShareWorkspaceView({ target }: { target: PublicShareWorkspaceTarget }) {
  const { messages } = useLocale();
  const copy = messages.collaboration.publicShare;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="space-y-6">
        <header className="space-y-2">
          <Badge variant="secondary">{copy.readOnlyBadge}</Badge>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{target.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.workspaceDescription}</p>
          <p className="text-xs text-muted-foreground">{copy.privacyNotice}</p>
        </header>
        <section aria-label={copy.outputsHeading} className="space-y-3">
          <h2 className="font-label text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {copy.outputsHeading}
          </h2>
          {target.outputs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{copy.emptyWorkspace}</p>
          ) : (
            <ul className="space-y-2">
              {target.outputs.map((output) => (
                <li
                  key={output.id}
                  className="rounded-md border border-border bg-card px-4 py-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{output.title}</span>
                    <Badge variant="outline">
                      {output.kind === "quiz" ? copy.quizKind : copy.flashcardKind}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function PublicShareQuizStudy({
  shareId,
  target,
}: {
  shareId: string;
  target: PublicShareQuizTarget;
}) {
  const { locale, messages } = useLocale();
  const copy = messages.collaboration.publicShare;
  const formatNumber = useCallback(
    (value: number) => new Intl.NumberFormat(locale).format(value),
    [locale],
  );
  const questions = target.questions;
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [answers, setAnswers] = useState<{ questionId: string; selectedIndex: number }[]>([]);
  const [imported, setImported] = useState(false);

  const current = questions[index];
  const revealed = picked !== null;
  const answerCorrect = revealed && current ? picked === current.correctIndex : false;

  const restart = () => {
    setIndex(0);
    setPicked(null);
    setCorrectCount(0);
    setFinished(false);
    setAnswers([]);
    setImported(false);
  };

  const goNext = () => {
    if (index + 1 >= questions.length) {
      if (!imported && answers.length > 0) {
        enqueueAnonymousQuizAttempt({
          shareId,
          outputId: target.outputId,
          completedAt: new Date().toISOString(),
          correctCount,
          totalQuestions: questions.length,
          answers,
        });
        setImported(true);
      }
      setFinished(true);
      return;
    }
    setIndex((value) => value + 1);
    setPicked(null);
  };

  if (questions.length === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <p className="text-sm text-muted-foreground">{copy.emptyStudy}</p>
      </main>
    );
  }

  if (finished) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{copy.sessionComplete}</CardTitle>
            <CardDescription>
              {messages.collaboration.publicShare.scoreSummary(correctCount, questions.length)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={restart}>
              {copy.restart}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="space-y-6">
        <header className="space-y-2">
          <Badge variant="secondary">{copy.studyOnlyBadge}</Badge>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{target.title}</h1>
          <p className="text-xs text-muted-foreground">{copy.privacyNotice}</p>
          <p className="text-sm text-muted-foreground">
            {copy.questionProgress(formatNumber(index + 1), formatNumber(questions.length))}
          </p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <MathText source={current.prompt} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{copy.chooseAnswer}</p>
            <div className="grid gap-2">
              {current.choices.map((choice, choiceIndex) => {
                const selected = picked === choiceIndex;
                const isCorrect = choiceIndex === current.correctIndex;
                return (
                  <button
                    key={`${current.id}-${choiceIndex}`}
                    type="button"
                    disabled={revealed}
                    onClick={() => {
                      setPicked(choiceIndex);
                      setAnswers((existing) => {
                        const withoutCurrent = existing.filter(
                          (entry) => entry.questionId !== current.id,
                        );
                        return [...withoutCurrent, { questionId: current.id, selectedIndex: choiceIndex }];
                      });
                      if (choiceIndex === current.correctIndex) {
                        setCorrectCount((value) => value + 1);
                      }
                    }}
                    className={cn(
                      "rounded-md border px-4 py-3 text-left text-sm transition-colors",
                      !revealed && "hover:bg-muted/60",
                      revealed && selected && isCorrect && "border-emerald-500 bg-emerald-500/10",
                      revealed && selected && !isCorrect && "border-destructive bg-destructive/10",
                      revealed && !selected && isCorrect && "border-emerald-500/60",
                    )}
                  >
                    <span className="mr-2 font-semibold">{CHOICE_LABELS[choiceIndex] ?? "?"}.</span>
                    <MathText source={choice} />
                  </button>
                );
              })}
            </div>
            {revealed ? (
              <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4 text-sm">
                <p className="font-medium">
                  {answerCorrect ? copy.correct : copy.incorrect}
                </p>
                {current.explanation ? (
                  <p className="text-muted-foreground">
                    <MathText source={current.explanation} />
                  </p>
                ) : null}
                <Button type="button" onClick={goNext}>
                  {index + 1 >= questions.length ? copy.seeResults : copy.next}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function PublicShareFlashcardStudy({ target }: { target: PublicShareFlashcardTarget }) {
  const { locale, messages } = useLocale();
  const copy = messages.collaboration.publicShare;
  const formatNumber = useCallback(
    (value: number) => new Intl.NumberFormat(locale).format(value),
    [locale],
  );
  const cards = target.cards;
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);

  const current = cards[index];

  const restart = () => {
    setIndex(0);
    setFlipped(false);
    setFinished(false);
  };

  if (cards.length === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <p className="text-sm text-muted-foreground">{copy.emptyStudy}</p>
      </main>
    );
  }

  if (finished) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{copy.sessionComplete}</CardTitle>
            <CardDescription>{copy.flashcardComplete}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={restart}>
              {copy.restart}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="space-y-6">
        <header className="space-y-2">
          <Badge variant="secondary">{copy.studyOnlyBadge}</Badge>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{target.title}</h1>
          <p className="text-xs text-muted-foreground">{copy.privacyNotice}</p>
          <p className="text-sm text-muted-foreground">
            {copy.cardProgress(formatNumber(index + 1), formatNumber(cards.length))}
          </p>
        </header>
        <button
          type="button"
          onClick={() => setFlipped((value) => !value)}
          className="flex min-h-56 w-full items-center justify-center rounded-xl border border-border bg-card p-8 text-center text-lg shadow-sm transition-colors hover:bg-muted/40"
          aria-pressed={flipped}
        >
          <MathText source={flipped ? current.back : current.front} />
        </button>
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={index === 0}
            onClick={() => {
              setIndex((value) => Math.max(0, value - 1));
              setFlipped(false);
            }}
          >
            {copy.previous}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setFlipped((value) => !value)}>
            {copy.flipCard}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (index + 1 >= cards.length) {
                setFinished(true);
                return;
              }
              setIndex((value) => value + 1);
              setFlipped(false);
            }}
          >
            {index + 1 >= cards.length ? copy.seeResults : copy.next}
          </Button>
        </div>
      </div>
    </main>
  );
}

export function PublicShareStudy({ share }: PublicShareStudyProps) {
  const body = useMemo(() => {
    switch (share.target.kind) {
      case "workspace":
        return <PublicShareWorkspaceView target={share.target} />;
      case "quiz":
        return <PublicShareQuizStudy shareId={share.shareId} target={share.target} />;
      case "flashcard":
        return <PublicShareFlashcardStudy target={share.target} />;
      default:
        return <PublicShareUnavailable />;
    }
  }, [share]);

  return body;
}
