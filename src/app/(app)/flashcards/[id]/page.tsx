"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { FlashcardSession } from "@/components/flashcards/FlashcardSession";
import { useStudySetProductSurfaceRedirect } from "@/hooks/useStudySetProductSurfaceRedirect";

function FlashcardsPlayPageInner() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const routeReady = useStudySetProductSurfaceRedirect(
    id || undefined,
    "play-flashcards",
  );

  if (!id) {
    return null;
  }

  if (!routeReady) {
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
