"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ReviewSection } from "@/components/review/ReviewSection";
import { ensureStudySetDb, getStudySetMeta } from "@/lib/client/studySetDb";
import { useStudySetProductSurfaceRedirect } from "@/hooks/useStudySetProductSurfaceRedirect";
import type { StudySetMeta } from "@/types/studySet";

export default function EditQuizReviewPage() {
  const params = useParams<{ setId?: string }>();
  const id = typeof params.setId === "string" ? params.setId : "";
  const routeReady = useStudySetProductSurfaceRedirect(id || undefined, "edit-quiz");
  const [meta, setMeta] = useState<StudySetMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);

  const loadMeta = useCallback(async () => {
    if (!id || !routeReady) return;
    setMetaLoading(true);
    try {
      await ensureStudySetDb();
      setMeta((await getStudySetMeta(id)) ?? null);
    } catch {
      setMeta(null);
    } finally {
      setMetaLoading(false);
    }
  }, [id, routeReady]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  if (!id) return null;
  if (!routeReady || metaLoading) {
    return <p className="text-sm text-muted-foreground" role="status">Loading…</p>;
  }

  return (
    <ReviewSection
      studySetId={id}
      metaTitle={meta?.title ?? null}
      metaSubtitle={meta?.subtitle ?? null}
      sourceFileLabel={meta?.sourceFileName ?? null}
    />
  );
}
