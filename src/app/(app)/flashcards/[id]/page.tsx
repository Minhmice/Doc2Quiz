"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { FlashcardSession } from "@/components/flashcards/FlashcardSession";
import { ensureStudySetDb, getStudySetMeta } from "@/lib/db/studySetDb";
import { editFlashcards, quizPlay } from "@/lib/routes/studySetPaths";

function FlashcardsPlayPageInner() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [headline, setHeadline] = useState("");
  const [subtitle, setSubtitle] = useState<string | undefined>();
  const [sourceName, setSourceName] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadMeta = useCallback(async () => {
    if (!id) {
      return;
    }
    setLoadError(null);
    try {
      await ensureStudySetDb();
      const meta = await getStudySetMeta(id);
      if (!meta) {
        setLoadError("Study set not found.");
        return;
      }
      setHeadline(meta.title);
      setSubtitle(meta.subtitle);
      setSourceName(meta.sourceFileName);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Failed to load study set.",
      );
    }
  }, [id]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  if (!id) {
    return null;
  }

  if (loadError) {
    return (
      <div>
        <p className="text-red-400">{loadError}</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-[var(--d2q-accent-hover)]"
        >
          ← Library
        </Link>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6 space-y-1">
        <h1 className="font-heading text-xl font-semibold tracking-tight text-[var(--d2q-text)] sm:text-3xl">
          Flashcards · {headline || "…"}
        </h1>
        {subtitle ? (
          <p className="text-sm font-medium text-[var(--d2q-muted)]">
            {subtitle}
          </p>
        ) : null}
        {sourceName ? (
          <p className="text-xs text-[var(--d2q-muted)]">Source: {sourceName}</p>
        ) : null}
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          Space flips the card. Left arrow and right arrow move between cards.
        </p>
        <div className="mt-2 flex flex-wrap gap-4">
          <Link
            href={quizPlay(id)}
            className="text-base font-medium text-[var(--d2q-accent-hover)] hover:underline"
          >
            Take quiz
          </Link>
          <Link
            href={editFlashcards(id)}
            className="text-base font-medium text-[var(--d2q-accent-hover)] hover:underline"
          >
            Review cards
          </Link>
        </div>
      </header>
      <FlashcardSession studySetId={id} />
    </div>
  );
}

export default function FlashcardsPlayPage() {
  return (
    <Suspense
      fallback={
        <p
          className="text-xs font-semibold text-muted-foreground"
          role="status"
        >
          Loading…
        </p>
      }
    >
      <FlashcardsPlayPageInner />
    </Suspense>
  );
}
