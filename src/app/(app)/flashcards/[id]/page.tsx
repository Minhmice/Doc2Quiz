"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { FlashcardSession } from "@/components/flashcards/FlashcardSession";
import { ensureStudySetDb, getStudySetMeta } from "@/lib/db/studySetDb";

function FlashcardsPlayPageInner() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [metaReady, setMetaReady] = useState(false);
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
      setMetaReady(true);
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
          className="mt-4 inline-block text-(--d2q-accent-hover)"
        >
          ← Library
        </Link>
      </div>
    );
  }

  if (!metaReady) {
    return (
      <p className="text-xs font-semibold text-muted-foreground" role="status">
        Loading…
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" data-quiz-play-theme="stitch">
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
