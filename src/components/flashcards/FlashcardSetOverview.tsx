"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getApprovedFlashcardBank, getStudySetMeta, ensureStudySetDb } from "@/lib/client/studySetDb";
import { flashcardEdit, flashcardPlay, flashcardReview } from "@/lib/routes/studySetPaths";

function FlashcardOverviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" role="status">
      <Skeleton className="h-10 w-72 max-w-full" />
      <Skeleton className="h-5 w-56" />
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-lg" />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-28" />
        ))}
      </div>
    </div>
  );
}

export function FlashcardSetOverview({ studySetId }: { studySetId: string }) {
  const [title, setTitle] = useState("Flashcards");
  const [fronts, setFronts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await ensureStudySetDb();
      const [meta, bank] = await Promise.all([getStudySetMeta(studySetId), getApprovedFlashcardBank(studySetId)]);
      setTitle(meta?.title ?? "Flashcards");
      setFronts((bank?.items ?? []).slice(0, 3).map((card) => card.front));
      setLoading(false);
    })();
  }, [studySetId]);

  if (loading) return <FlashcardOverviewSkeleton />;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-extrabold">{title}</h1>
      <p className="text-muted-foreground">Flashcards · {fronts.length} preview items</p>
      <div className="space-y-2">
        {fronts.map((front, index) => (
          <div key={index} className="line-clamp-2 rounded-lg border border-border bg-card p-4">{front}</div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Link className="rounded-md bg-primary px-4 py-2 text-primary-foreground" href={flashcardPlay(studySetId)}>Start studying</Link>
        <Link className="rounded-md border border-border px-4 py-2" href={flashcardReview(studySetId)}>Review</Link>
        <Link className="rounded-md border border-border px-4 py-2" href={flashcardEdit(studySetId)}>Edit</Link>
      </div>
    </div>
  );
}
