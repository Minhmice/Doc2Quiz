"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { PlaySession } from "@/components/play/PlaySession";
import { ensureStudySetDb, getStudySetMeta } from "@/lib/db/studySetDb";

function StudySetPlayPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = typeof params.id === "string" ? params.id : "";
  const reviewMistakesOnly = searchParams.get("review") === "mistakes";

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
        <Link href="/dashboard" className="mt-4 inline-block text-[var(--d2q-accent-hover)]">
          ← Library
        </Link>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6 space-y-1">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--d2q-text)] sm:text-3xl">
          Take quiz · {headline || "…"}
        </h1>
        {subtitle ? (
          <p className="text-sm font-medium text-[var(--d2q-muted)]">
            {subtitle}
          </p>
        ) : null}
        {sourceName ? (
          <p className="text-xs text-[var(--d2q-muted)]">Source: {sourceName}</p>
        ) : null}
        <p className="mt-1 text-sm text-[var(--d2q-muted)]">
          {reviewMistakesOnly
            ? "Reviewing questions you missed last time. Keys 1–4 pick an answer."
            : "Uses your approved bank. Keys 1–4 pick an answer."}
        </p>
      </header>
      <PlaySession studySetId={id} reviewMistakesOnly={reviewMistakesOnly} />
    </div>
  );
}

export default function StudySetPlayPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground" role="status">
          Loading…
        </p>
      }
    >
      <StudySetPlayPageInner />
    </Suspense>
  );
}
