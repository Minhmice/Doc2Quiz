"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ReviewSection } from "@/components/review/ReviewSection";
import { ensureStudySetDb, getStudySetMeta } from "@/lib/db/studySetDb";
import type { StudySetMeta } from "@/types/studySet";

export default function StudySetReviewPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [meta, setMeta] = useState<StudySetMeta | null>(null);

  const loadMeta = useCallback(async () => {
    if (!id) {
      return;
    }
    try {
      await ensureStudySetDb();
      const m = await getStudySetMeta(id);
      setMeta(m ?? null);
    } catch {
      setMeta(null);
    }
  }, [id]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  if (!id) {
    return null;
  }

  return (
    <div>
      <header className="mb-6 space-y-1">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Review
          {meta?.title ? (
            <>
              {" "}
              · <span className="text-foreground">{meta.title}</span>
            </>
          ) : null}
        </h1>
        {meta?.subtitle ? (
          <p className="text-sm font-medium text-muted-foreground">
            {meta.subtitle}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Edit AI-parsed questions, then press Done to save the bank and return
          to the library.
        </p>
      </header>

      <ReviewSection studySetId={id} />

      <p className="mt-6 text-sm text-muted-foreground">
        <Link
          href={`/sets/${id}/source`}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          ← Back to Source
        </Link>
      </p>
    </div>
  );
}
