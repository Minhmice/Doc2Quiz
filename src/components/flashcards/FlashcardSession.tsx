"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ensureStudySetDb,
  getApprovedFlashcardBank,
} from "@/lib/db/studySetDb";
import { editFlashcards } from "@/lib/routes/studySetPaths";
import type { FlashcardVisionItem } from "@/types/visionParse";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MathText } from "@/components/math/MathText";
import { FlashcardActions } from "@/components/flashcards/FlashcardActions";
import { FlashcardInteractionHints } from "@/components/flashcards/FlashcardInteractionHints";
import { Layers } from "lucide-react";

export type FlashcardSessionProps = {
  studySetId: string;
};

function shouldSkipSessionRefocus(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return true;
  }

  // Don't steal focus from interactive controls.
  return Boolean(
    target.closest(
      [
        "button",
        "a",
        "input",
        "textarea",
        "select",
        "[contenteditable='true']",
        "[role='button']",
        "[role='link']",
      ].join(","),
    ),
  );
}

export function FlashcardSession({ studySetId }: FlashcardSessionProps) {
  const router = useRouter();
  const [cards, setCards] = useState<FlashcardVisionItem[]>([]);
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
      const bank = await getApprovedFlashcardBank(studySetId);
      const list = (bank?.items ?? []).filter(
        (c) => c.front.trim().length > 0 && c.back.trim().length > 0,
      );
      setCards(list);
      setIndex(0);
      setFlipped(false);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Could not load flashcards.",
      );
      setCards([]);
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
      cards.length === 0 ||
      didAutoFocusRef.current
    ) {
      return;
    }
    didAutoFocusRef.current = true;
    requestAnimationFrame(() => {
      sessionRootRef.current?.focus();
    });
  }, [loading, loadError, cards.length]);

  const current = cards[index];
  const total = cards.length;

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(total - 1, i + 1));
  }, [total]);

  const toggleFlip = useCallback(() => {
    setFlipped((f) => {
      const next = !f;
      setFlipAnnouncement(next ? "Back" : "Front");
      return next;
    });
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (loading || loadError || cards.length === 0) {
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
        return;
      }
    },
    [loading, loadError, cards.length, toggleFlip, goPrev, goNext],
  );

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="font-label text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Loading session...
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-8 text-center">
        <h3 className="mb-2 font-headline text-lg font-bold text-destructive">
          Error Loading Session
        </h3>
        <p className="mb-6 text-sm text-muted-foreground">{loadError}</p>
        <Button onClick={reload} variant="outline" size="sm">
          Try Again
        </Button>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-12 text-center">
        <Layers className="mx-auto mb-4 h-12 w-12 text-orange-500/40" />
        <h3 className="mb-2 font-headline text-xl font-bold text-orange-600">
          No Cards Found
        </h3>
        <p className="mx-auto mb-8 max-w-md text-sm text-muted-foreground">
          You haven&apos;t approved any flashcards for this set yet. Head over to the
          editor to review and approve your generated cards.
        </p>
        <Link href={editFlashcards(studySetId)}>
          <Button variant="default" className="bg-orange-600 hover:bg-orange-700">
            Open Editor
          </Button>
        </Link>
      </div>
    );
  }

  const progressPct = Math.round(((index + 1) / total) * 100);

  return (
    <div
      ref={sessionRootRef}
      tabIndex={0}
      role="region"
      aria-label="Flashcard study"
      onPointerDownCapture={(e) => {
        if (shouldSkipSessionRefocus(e.target)) {
          return;
        }
        // Re-acquire focus so Space/Arrow hotkeys work after clicking away.
        queueMicrotask(() => sessionRootRef.current?.focus());
      }}
      onKeyDown={onKeyDown}
      className="relative flex min-h-[calc(100vh-16rem)] w-full flex-col items-center sm:py-10 lg:py-16 outline-none"
      data-quiz-play-theme="stitch"
    >
      <span className="sr-only" aria-live="polite">
        {flipAnnouncement}
      </span>

      {/* Progress Section */}
      <section className="mb-8 sm:mb-12 lg:mb-16 w-full max-w-[900px] xl:max-w-[1100px] px-4">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="font-label text-xs sm:text-sm lg:text-base font-bold tracking-tight text-[color:var(--qp-tertiary)]">
            CARD {index + 1} <span className="text-[color:var(--qp-outline-variant)]">/ {total}</span>
          </span>
          <span className="font-label text-[9px] sm:text-[10px] lg:text-xs font-bold uppercase tracking-widest text-[color:var(--qp-secondary)]/60">
            {progressPct}% COMPLETE
          </span>
        </div>
        <div className="h-1.5 sm:h-2 lg:h-3 w-full overflow-hidden rounded-full bg-[color:var(--qp-surface-container)] shadow-inner">
          <div
            className="h-full bg-[color:var(--qp-on-primary-container)] dark:bg-[color:var(--qp-primary)] transition-all duration-700 ease-out shadow-sm"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </section>

      {/* Card Canvas */}
      <div className="card-perspective h-[340px] sm:h-[480px] lg:h-[560px] xl:h-[640px] w-full max-w-[900px] xl:max-w-[1100px] px-4">
        <div
          className={cn(
            "card-inner shadow-[0_0_34px_-10px_color-mix(in_srgb,var(--qp-secondary)_42%,transparent)] dark:shadow-[0_0_42px_-10px_color-mix(in_srgb,var(--qp-secondary)_55%,transparent)] transition-all",
            flipped && "is-flipped"
          )}
          onClick={toggleFlip}
        >
          {/* FRONT */}
          <div className="card-front cursor-pointer border border-[color:var(--qp-secondary)]/20 bg-[color:var(--qp-surface-container-lowest)] p-6 sm:p-12 lg:p-16 overflow-y-auto rounded-xl">
            <div className="absolute top-4 sm:top-6 lg:top-8 left-1/2 -translate-x-1/2">
              <span className="font-label text-[8px] sm:text-[10px] lg:text-xs font-bold uppercase tracking-[0.25em] text-[color:var(--qp-secondary)]/60">
                FRONT
              </span>
            </div>
            <div className="flex h-full w-full flex-col items-center justify-center pt-8 sm:pt-4">
              <div className="flex h-full w-full items-center justify-center">
                <MathText
                  source={current.front}
                  className="font-headline px-2 sm:px-6 lg:px-10 text-center text-[clamp(1.25rem,3.1vw,3rem)] font-black leading-[1.12] sm:leading-[1.1] whitespace-pre-wrap break-words hyphens-auto [overflow-wrap:anywhere] text-[color:var(--qp-secondary)]"
                />
              </div>
            </div>
          </div>

          {/* BACK */}
          <div className="card-back cursor-pointer border border-[color:var(--qp-secondary)]/20 bg-[color:var(--qp-surface-container-lowest)] p-6 sm:p-12 lg:p-16 overflow-y-auto rounded-xl">
            <div className="absolute top-4 sm:top-6 lg:top-8 left-1/2 -translate-x-1/2">
              <span className="font-label text-[8px] sm:text-[10px] lg:text-xs font-bold uppercase tracking-[0.25em] text-[color:var(--qp-secondary)]/60">
                BACK
              </span>
            </div>
            <div className="flex h-full w-full flex-col items-center justify-center pt-8 sm:pt-0">
              <div className="w-full">
                <MathText
                  source={current.back}
                  className="font-headline mb-2 sm:mb-6 text-center text-[clamp(1.25rem,3.1vw,3rem)] font-black leading-[1.12] sm:leading-[1.1] whitespace-pre-wrap break-words hyphens-auto [overflow-wrap:anywhere] text-[color:var(--qp-secondary)]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interaction Hints */}
      <FlashcardInteractionHints />

      {/* Actions Hierarchy */}
      <FlashcardActions
        goPrev={goPrev}
        goNext={goNext}
        index={index}
        total={total}
        onDone={() => router.push("/dashboard")}
      />
    </div>
  );
}
