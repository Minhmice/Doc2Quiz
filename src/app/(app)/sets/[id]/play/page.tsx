"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PlaySession } from "@/components/play/PlaySession";
import { ensureStudySetDb, getStudySetMeta } from "@/lib/db/studySetDb";

export default function StudySetPlayPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [headline, setHeadline] = useState("");
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
      setHeadline(meta.sourceFileName ?? meta.title);
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
      <header className="mb-6">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--d2q-text)]">
          Take quiz · {headline || "…"}
        </h1>
        <p className="mt-1 text-sm text-[var(--d2q-muted)]">
          Uses your approved bank. Keys 1–4 pick an answer.
        </p>
      </header>
      <PlaySession studySetId={id} />
    </div>
  );
}
