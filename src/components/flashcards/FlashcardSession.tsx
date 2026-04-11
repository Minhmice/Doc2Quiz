"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ensureStudySetDb,
  getApprovedBank,
  getMediaBlob,
} from "@/lib/db/studySetDb";
import { isMcqComplete } from "@/lib/review/validateMcq";
import type { Question } from "@/types/question";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { MathText } from "@/components/math/MathText";

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
      <span className="text-xs font-semibold text-muted-foreground">
        Loading image…
      </span>
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

export type FlashcardSessionProps = {
  studySetId: string;
};

export function FlashcardSession({ studySetId }: FlashcardSessionProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sessionRootRef = useRef<HTMLDivElement>(null);
  const didAutoFocusRef = useRef(false);
  const [flipAnnouncement, setFlipAnnouncement] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    didAutoFocusRef.current = false;
    try {
      await ensureStudySetDb();
      const bank = await getApprovedBank(studySetId);
      const list = (bank?.questions ?? []).filter(isMcqComplete);
      setQuestions(list);
      setIndex(0);
      setFlipped(false);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Could not load flashcards.",
      );
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [studySetId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setFlipped(false);
  }, [index]);

  useEffect(() => {
    if (
      loading ||
      loadError ||
      questions.length === 0 ||
      didAutoFocusRef.current
    ) {
      return;
    }
    didAutoFocusRef.current = true;
    requestAnimationFrame(() => {
      sessionRootRef.current?.focus();
    });
  }, [loading, loadError, questions.length]);

  const current = questions[index];
  const total = questions.length;

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(total - 1, i + 1));
  }, [total]);

  const toggleFlip = useCallback(() => {
    setFlipped((f) => {
      const next = !f;
      setFlipAnnouncement(next ? "Answer" : "Question");
      return next;
    });
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (loading || loadError || questions.length === 0) {
        return;
      }
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        toggleFlip();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    },
    [loading, loadError, questions.length, toggleFlip, goPrev, goNext],
  );

  if (loading) {
    return (
      <p
        className="text-xs font-semibold text-muted-foreground"
        role="status"
      >
        Loading…
      </p>
    );
  }

  if (loadError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Could not load flashcards. {loadError}
        </AlertDescription>
        <Link
          href="/dashboard"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "mt-3 inline-flex w-fit",
          )}
        >
          ← Library
        </Link>
      </Alert>
    );
  }

  if (questions.length === 0) {
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
            "mt-2 inline-flex h-auto px-0 text-amber-200",
          )}
        >
          Go to Review
        </Link>
      </Alert>
    );
  }

  const correctIndex = current.correctIndex;
  const backText = current.options[correctIndex];
  const backImageId = current.optionImageIds?.[correctIndex];

  return (
    <div
      ref={sessionRootRef}
      tabIndex={0}
      role="region"
      aria-label="Flashcard study"
      aria-busy={loading}
      onKeyDown={onKeyDown}
      className={cn(
        "rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span className="sr-only" aria-live="polite">
        {flipAnnouncement}
      </span>
      {total > 0 ? (
        <p className="mb-3 text-xs font-semibold tabular-nums text-muted-foreground">
          Card {index + 1} of {total}
        </p>
      ) : null}
      <Card className="shadow-lg">
        <CardContent className="min-h-[12rem] space-y-4">
          {!flipped ? (
            <>
              <MathText
                source={current.question}
                className="text-base leading-normal text-card-foreground"
              />
              {current.questionImageId ? (
                <MediaImage mediaId={current.questionImageId} />
              ) : null}
            </>
          ) : (
            <>
              <MathText
                source={backText}
                className="text-base leading-normal text-card-foreground"
              />
              {backImageId ? <MediaImage mediaId={backImageId} /> : null}
            </>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={goPrev}
            disabled={index <= 0}
          >
            Previous card
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={goNext}
            disabled={index >= total - 1}
          >
            Next card
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
