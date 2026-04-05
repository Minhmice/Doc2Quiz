"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ensureStudySetDb,
  getApprovedBank,
  getStudySetMeta,
} from "@/lib/db/studySetDb";

export default function StudySetDonePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [headline, setHeadline] = useState("");
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
      setHeadline(meta.sourceFileName ?? meta.title);
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
      <header className="mb-6">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--d2q-text)]">
          Done · {headline || "…"}
        </h1>
        <p className="mt-1 text-sm text-[var(--d2q-muted)]">
          Study set ready. {approvedCount} approved question
          {approvedCount === 1 ? "" : "s"} saved locally.
        </p>
      </header>

      <div className="rounded-lg border border-[var(--d2q-accent)]/35 bg-[var(--d2q-accent-muted)] p-4 text-sm text-[var(--d2q-text)]">
        <p className="font-medium">
          You can return to Review to edit questions, or open another set from
          the library.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-[var(--d2q-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--d2q-accent-hover)]"
          >
            Library
          </Link>
          <Link
            href={`/sets/${id}/review`}
            className="rounded-lg border border-[var(--d2q-border-strong)] bg-[var(--d2q-surface)] px-4 py-2 text-sm font-semibold text-[var(--d2q-text)] hover:bg-[var(--d2q-surface-elevated)]"
          >
            Review
          </Link>
        </div>
      </div>
    </div>
  );
}
