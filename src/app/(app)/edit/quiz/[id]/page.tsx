"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ReviewSection } from "@/components/review/ReviewSection";
import { ensureStudySetDb, getStudySetMeta } from "@/lib/db/studySetDb";
import { editFlashcards } from "@/lib/routes/studySetPaths";
import type { StudySetMeta } from "@/types/studySet";

export default function EditQuizReviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [meta, setMeta] = useState<StudySetMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);

  const loadMeta = useCallback(async () => {
    if (!id) {
      return;
    }
    setMetaLoading(true);
    try {
      await ensureStudySetDb();
      const m = await getStudySetMeta(id);
      setMeta(m ?? null);
    } catch {
      setMeta(null);
    } finally {
      setMetaLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (!id || metaLoading || !meta) {
      return;
    }
    if (meta.contentKind === "flashcards") {
      router.replace(editFlashcards(id));
    }
  }, [id, meta, metaLoading, router]);

  if (!id) {
    return null;
  }

  if (metaLoading) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Loading…
      </p>
    );
  }

  if (meta?.contentKind === "flashcards") {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Opening flashcard review…
      </p>
    );
  }

  return (
    <div className="w-full max-w-6xl">
      <ReviewSection
        studySetId={id}
        metaTitle={meta?.title ?? null}
        metaSubtitle={meta?.subtitle ?? null}
        sourceFileLabel={meta?.sourceFileName ?? null}
      />
    </div>
  );
}
