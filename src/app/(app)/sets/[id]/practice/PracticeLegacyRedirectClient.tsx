"use client";

import { useParams } from "next/navigation";
import { useStudySetProductSurfaceRedirect } from "@/hooks/useStudySetProductSurfaceRedirect";

/**
 * `/sets/[id]/practice` resolves `contentKind` and sends users to the canonical
 * play route (`/quiz/...` or `/flashcards/...`). No quiz↔flashcard conversion.
 */
export function PracticeLegacyRedirectClient() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : undefined;
  useStudySetProductSurfaceRedirect(id, "legacy-practice");

  if (!id) {
    return null;
  }

  return (
    <p className="text-sm text-muted-foreground" role="status">
      Redirecting…
    </p>
  );
}
