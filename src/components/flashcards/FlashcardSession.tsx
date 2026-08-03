"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ensureStudySetDb,
  getApprovedFlashcardBank,
} from "@/lib/client/studySetDb";
import { flashcardResults, flashcardReview } from "@/lib/routes/studySetPaths";
import type { FlashcardVisionItem } from "@/types/flashcard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MathText } from "@/components/math/MathText";
import { FlashcardActions } from "@/components/flashcards/FlashcardActions";
import { FlashcardInteractionHints } from "@/components/flashcards/FlashcardInteractionHints";
import { Layers } from "lucide-react";
import { useLocale } from "@/components/locale/LocaleProvider";
import { LocalizedSlangLine } from "@/components/locale/LocalizedCopy";
import { startStudySession, saveStudySession, completeStudySession, listUnfinishedStudySessions } from "@/lib/client/activityTracking";
import type { StudySession } from "@/types/studySession";

export type FlashcardSessionProps = {
  studySetId: string;
  practice?: "standard" | "mistakes";
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

export function FlashcardSession({ studySetId, practice = "standard" }: FlashcardSessionProps) {
  const router = useRouter();
  const { locale, messages } = useLocale();
  const copy = messages.workflows.practice.flashcards;
  const common = messages.workflows.practice.common;
  const formatNumber = useCallback((value: number) => new Intl.NumberFormat(locale).format(value), [locale]);
  const [cards, setCards] = useState<FlashcardVisionItem[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sessionRootRef = useRef<HTMLDivElement>(null);
  const didAutoFocusRef = useRef(false);
  const [flipAnnouncement, setFlipAnnouncement] = useState("");
  const [durableSession, setDurableSession] = useState<StudySession | null>(null);

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
      const unfinished = (await listUnfinishedStudySessions()).find((session) => session.studySetId === studySetId && session.mode === "flashcard" && session.practice === practice);
      const session = unfinished ?? await startStudySession({ studySetId, mode: "flashcard", practice, itemIds: list.map((card) => card.id).filter((id): id is string => Boolean(id)), currentItemId: list[0]?.id ?? null, nextItemId: list[0]?.id ?? null, interaction: { mode: "flashcard", cards: {} } });
      setDurableSession(session);
      if (session?.currentItemId) { const restored = list.findIndex((card) => card.id === session.currentItemId); if (restored >= 0) setIndex(restored); }
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Could not load study content.",
      );
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [studySetId, practice]);

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
    const nextIndex = Math.min(total - 1, index + 1);
    if (durableSession && current) { const cardsState = durableSession.interaction.mode === "flashcard" && current.id ? { ...durableSession.interaction.cards, [current.id]: { known: flipped, rating: flipped ? "good" as const : "again" as const } } : {}; void saveStudySession(durableSession, { currentItemId: cards[nextIndex]?.id ?? null, nextItemId: cards[nextIndex]?.id ?? null, interaction: { mode: "flashcard", cards: cardsState } }).then(({ session }) => { if (session) setDurableSession(session); }); }
    setIndex(nextIndex);
  }, [total, index, durableSession, current, flipped, cards]);

  const toggleFlip = useCallback(() => {
    setFlipped((f) => {
      const next = !f;
      setFlipAnnouncement(next ? copy.back : copy.front);
      return next;
    });
  }, [copy.back, copy.front]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (loading || loadError || cards.length === 0) {
        return;
      }
      if (e.key === "Enter" || e.key === " " || e.code === "Space") {
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
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6" aria-busy="true" role="status">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-2 w-full" />
        <div className="flex min-h-80 items-center justify-center rounded-2xl border border-border bg-card p-8">
          <div className="w-full max-w-xl space-y-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-4/5" />
          </div>
        </div>
        <div className="flex justify-center gap-3">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <Alert variant="destructive" className="max-w-lg">
        <AlertTitle>{copy.loadErrorTitle}</AlertTitle>
        <AlertDescription className="space-y-4">
          <p>{loadError}</p>
          <Button onClick={reload} variant="outline" size="sm">
            {common.tryAgain}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (cards.length === 0) {
    return (
      <Alert className="max-w-lg">
        <Layers className="size-5" aria-hidden />
        <AlertTitle>{copy.emptyTitle}</AlertTitle>
        <AlertDescription className="space-y-4">
          <p>{copy.emptyDescription}</p>
          <LocalizedSlangLine context="empty" eventKey={`flashcards-empty:${studySetId}`} />
          <Link
            href={flashcardReview(studySetId)}
            className="text-sm font-extrabold text-chart-2 underline-offset-2 hover:underline"
          >
            {copy.backToPreview}
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  const progressPct = Math.round(((index + 1) / total) * 100);

  return (
    <div
      ref={sessionRootRef}
      tabIndex={0}
      role="region"
      aria-label={copy.sessionRegion}
      aria-describedby="flashcard-session-shortcuts"
      aria-keyshortcuts="Enter Space ArrowLeft ArrowRight"
      onPointerDownCapture={(e) => {
        if (shouldSkipSessionRefocus(e.target)) {
          return;
        }
        // Re-acquire focus so Space/Arrow hotkeys work after clicking away.
        queueMicrotask(() => sessionRootRef.current?.focus());
      }}
      onKeyDown={onKeyDown}
      className="relative flex min-h-[calc(100dvh-8rem)] w-full flex-col items-center overflow-x-hidden px-1 pb-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--qp-primary)] sm:min-h-[calc(100dvh-10rem)] sm:py-10 lg:min-h-[calc(100dvh-12rem)] lg:py-16"
      data-quiz-play-theme="stitch"
    >
      <span id="flashcard-session-shortcuts" className="sr-only">
        {copy.flipCard}: Enter / Space. {copy.navigate}: ArrowLeft / ArrowRight.
      </span>
      <span className="sr-only" aria-live="polite">
        {flipAnnouncement}
      </span>

      {/* Progress Section */}
      <section className="mb-5 w-full max-w-[900px] px-2 sm:mb-12 sm:px-4 lg:mb-16 xl:max-w-[1100px]">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="font-label text-xs sm:text-sm lg:text-base font-bold tracking-tight text-[color:var(--qp-tertiary)]">
            {copy.itemProgress(formatNumber(index + 1), formatNumber(total))}
          </span>
          <span className="font-label text-[9px] sm:text-[10px] lg:text-xs font-bold uppercase tracking-widest text-[color:var(--qp-secondary)]/60">
            {common.completePercent(formatNumber(progressPct))}
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
      <div className="card-perspective h-[clamp(12rem,calc(100dvh-18rem),640px)] min-h-[12rem] w-full max-w-[900px] px-2 sm:h-[480px] sm:min-h-0 sm:px-4 lg:h-[560px] xl:max-w-[1100px]">
        <div
          className={cn(
            "card-inner shadow-[0_0_34px_-10px_color-mix(in_srgb,var(--qp-secondary)_42%,transparent)] transition-all dark:shadow-[0_0_42px_-10px_color-mix(in_srgb,var(--qp-secondary)_55%,transparent)]",
            flipped && "is-flipped"
          )}
          onClick={toggleFlip}
        >
          {/* FRONT */}
          <div className="card-front cursor-pointer border border-[color:var(--qp-secondary)]/20 bg-[color:var(--qp-surface-container-lowest)] p-4 sm:p-12 lg:p-16 overflow-y-auto rounded-xl">
            <div className="absolute top-4 sm:top-6 lg:top-8 left-1/2 -translate-x-1/2">
              <span className="font-label text-[8px] sm:text-[10px] lg:text-xs font-bold uppercase tracking-[0.25em] text-[color:var(--qp-secondary)]/60">
                {copy.front}
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
          <div className="card-back cursor-pointer border border-[color:var(--qp-secondary)]/20 bg-[color:var(--qp-surface-container-lowest)] p-4 sm:p-12 lg:p-16 overflow-y-auto rounded-xl">
            <div className="absolute top-4 sm:top-6 lg:top-8 left-1/2 -translate-x-1/2">
              <span className="font-label text-[8px] sm:text-[10px] lg:text-xs font-bold uppercase tracking-[0.25em] text-[color:var(--qp-secondary)]/60">
                {copy.back}
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
          onDone={() => { if (durableSession) void completeStudySession({ ...durableSession, nextItemId: null }); router.push(flashcardResults(studySetId)); }}
      />
    </div>
  );
}
