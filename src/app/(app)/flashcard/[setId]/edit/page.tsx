"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FlashcardReviewWorkspace } from "@/components/flashcards/review/FlashcardReviewWorkspace";
import { useStudySetProductSurfaceRedirect } from "@/hooks/useStudySetProductSurfaceRedirect";
import { createRandomUuid } from "@/lib/ids/createRandomUuid";
import { ensureStudySetDb, getApprovedFlashcardBank, getStudySetMeta, putApprovedFlashcardBankForStudySet, touchStudySetMeta } from "@/lib/client/studySetDb";
import type { FlashcardVisionItem } from "@/types/flashcard";
import type { StudySetMeta } from "@/types/studySet";
import { Skeleton } from "@/components/ui/skeleton";

function FlashcardReviewSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-10" aria-busy="true" role="status">
      <header className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-80 max-w-full" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-6 border-l-4 border-muted bg-muted/40 px-6 py-5">
          <div className="flex flex-wrap gap-8">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      </header>
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Skeleton className="h-10 w-full" />
          <div className="space-y-4 rounded-xl border border-border bg-card p-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
        <div className="space-y-3 lg:col-span-4">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function EditFlashcardsReviewPage() {
  const params = useParams<{ setId?: string }>();
  const id = typeof params.setId === "string" ? params.setId : "";
  const routeReady = useStudySetProductSurfaceRedirect(id || undefined, "edit-flashcards");
  const [meta, setMeta] = useState<StudySetMeta | null>(null);
  const [cards, setCards] = useState<FlashcardVisionItem[]>([]);
  const [initialCards, setInitialCards] = useState<FlashcardVisionItem[]>([]);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState(() => new Set<string>());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!id || !routeReady) return;
    setLoadError(null);
    setLoading(true);
    try {
      await ensureStudySetDb();
      setMeta((await getStudySetMeta(id)) ?? null);
      const approved = await getApprovedFlashcardBank(id);
      const next = approved?.items ?? [];
      setCards(next);
      setInitialCards(next.map((card) => ({ ...card })));
      setDirty(false);
      setApprovedIds(new Set());
      setActiveCardId(next[0]?.id ?? null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [id, routeReady]);

  useEffect(() => { void load(); }, [load]);

  const saveChanges = useCallback(async () => {
    if (!id) return;
    setSaving(true);
    try {
      const normalized = cards.map((card) => card.id ? card : { ...card, id: createRandomUuid() }).filter((card) => card.front.trim() && card.back.trim());
      await putApprovedFlashcardBankForStudySet(id, { version: 1, savedAt: new Date().toISOString(), items: normalized });
      await touchStudySetMeta(id, { pipelineStage: normalized.length > 0 ? "flashcards" : "input" });
      setCards(normalized);
      setInitialCards(normalized.map((card) => ({ ...card })));
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [cards, id]);

  const setFront = useCallback((cardId: string, text: string) => { setDirty(true); setCards((prev) => prev.map((card) => card.id === cardId ? { ...card, front: text } : card)); }, []);
  const setBack = useCallback((cardId: string, text: string) => { setDirty(true); setCards((prev) => prev.map((card) => card.id === cardId ? { ...card, back: text } : card)); }, []);
  const removeAt = useCallback((cardId: string) => { setDirty(true); setApprovedIds((prev) => { const next = new Set(prev); next.delete(cardId); return next; }); setCards((prev) => prev.filter((card) => card.id !== cardId)); }, []);

  useEffect(() => {
    if (cards.length === 0) setActiveCardId(null);
    else if (!activeCardId || !cards.some((card) => card.id === activeCardId)) setActiveCardId(cards[0]?.id ?? null);
  }, [activeCardId, cards]);

  if (!id) return null;
  if (!routeReady || loading) return <FlashcardReviewSkeleton />;
  if (loadError) return <div><p className="text-destructive">{loadError}</p><Link href="/dashboard" className="mt-4 inline-block text-primary">← Library</Link></div>;

  return <FlashcardReviewWorkspace studySetId={id} title={meta?.title} subtitle={meta?.subtitle} cards={cards} initialCards={initialCards} activeCardId={activeCardId} onActiveCardIdChange={setActiveCardId} approvedIds={approvedIds} onApprove={(cardId) => setApprovedIds((prev) => new Set(prev).add(cardId))} dirty={dirty} saving={saving} onSaveAll={() => void saveChanges()} onFrontChange={setFront} onBackChange={setBack} onRemove={removeAt} />;
}
