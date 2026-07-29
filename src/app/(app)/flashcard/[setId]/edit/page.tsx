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
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!id || !routeReady) return;
    setLoadError(null);
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
  if (!routeReady) return <p className="text-sm text-muted-foreground" role="status">Loading…</p>;
  if (loadError) return <div><p className="text-destructive">{loadError}</p><Link href="/dashboard" className="mt-4 inline-block text-primary">← Library</Link></div>;

  return <FlashcardReviewWorkspace studySetId={id} title={meta?.title} subtitle={meta?.subtitle} cards={cards} initialCards={initialCards} activeCardId={activeCardId} onActiveCardIdChange={setActiveCardId} approvedIds={approvedIds} onApprove={(cardId) => setApprovedIds((prev) => new Set(prev).add(cardId))} dirty={dirty} saving={saving} onSaveAll={() => void saveChanges()} onFrontChange={setFront} onBackChange={setBack} onRemove={removeAt} />;
}
