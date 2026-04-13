"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ensureStudySetDb,
  getApprovedBank,
  getStudySetMeta,
} from "@/lib/db/studySetDb";
import { editFlashcards, flashcardsPlay } from "@/lib/routes/studySetPaths";

export default function FlashcardsDonePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [headline, setHeadline] = useState("");
  const [subtitle, setSubtitle] = useState<string | undefined>();
  const [sourceName, setSourceName] = useState<string | undefined>();
  const [approvedCount, setApprovedCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
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
      const bank = await getApprovedBank(id);
      setApprovedCount(bank?.questions.length ?? 0);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Failed to load study set.",
      );
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

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
        <h1 className="font-heading text-2xl font-bold tracking-tight text-[var(--d2q-text)] sm:text-3xl">
          Deck ready · {headline || "…"}
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
          {approvedCount} approved card{approvedCount === 1 ? "" : "s"} saved
          locally.
        </p>
      </header>

      <div className="rounded-lg border border-[var(--d2q-accent)]/35 bg-[var(--d2q-accent-muted)] p-4 text-sm text-[var(--d2q-text)]">
        <p className="font-medium">
          Return to Review to edit cards, study the deck again, or open another
          set from the library.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-[var(--d2q-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--d2q-accent-hover)]"
          >
            Library
          </Link>
          <Link
            href={flashcardsPlay(id)}
            className="rounded-lg border border-[var(--d2q-border-strong)] bg-[var(--d2q-surface)] px-4 py-2 text-sm font-semibold text-[var(--d2q-text)] hover:bg-[var(--d2q-surface-elevated)]"
          >
            Study deck
          </Link>
          <Link
            href={editFlashcards(id)}
            className="rounded-lg border border-[var(--d2q-border-strong)] bg-[var(--d2q-surface)] px-4 py-2 text-sm font-semibold text-[var(--d2q-text)] hover:bg-[var(--d2q-surface-elevated)]"
          >
            Review
          </Link>
        </div>
      </div>
    </div>
  );
}
