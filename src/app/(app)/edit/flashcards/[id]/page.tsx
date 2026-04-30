"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FlashcardReviewWorkspace } from "@/components/flashcards/review/FlashcardReviewWorkspace";
import { useStudySetProductSurfaceRedirect } from "@/hooks/useStudySetProductSurfaceRedirect";
import { createRandomUuid } from "@/lib/ids/createRandomUuid";
import {
  ensureStudySetDb,
  getApprovedFlashcardBank,
  getStudySetMeta,
  putApprovedFlashcardBankForStudySet,
  touchStudySetMeta,
} from "@/lib/db/studySetDb";
import type { FlashcardVisionItem } from "@/types/visionParse";
import type { StudySetMeta } from "@/types/studySet";

export default function EditFlashcardsReviewPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const routeReady = useStudySetProductSurfaceRedirect(
    id || undefined,
    "edit-flashcards",
  );
  const [meta, setMeta] = useState<StudySetMeta | null>(null);
  const [cards, setCards] = useState<FlashcardVisionItem[]>([]);
  const [initialCards, setInitialCards] = useState<FlashcardVisionItem[]>([]);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState(() => new Set<string>());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!id || !routeReady) {
      return;
    }
    setLoadError(null);
    try {
      await ensureStudySetDb();
      const m = await getStudySetMeta(id);
      setMeta(m ?? null);

      const approvedFc = await getApprovedFlashcardBank(id);
      const next: FlashcardVisionItem[] = approvedFc?.items ?? [];
      setCards(next);
      setInitialCards(
        next.map((c) => ({
          ...c,
          front: c.front,
          back: c.back,
        })),
      );
      setDirty(false);
      setApprovedIds(new Set());
      setActiveCardId(next[0]?.id ?? null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load.");
    }
  }, [id, routeReady]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveChanges = useCallback(async () => {
    if (!id) {
      return;
    }
    setSaving(true);
    try {
      const normalized = cards
        .map((card) => (card.id ? card : { ...card, id: createRandomUuid() }))
        .filter(
          (c) => c.front.trim().length > 0 && c.back.trim().length > 0,
        );

      const savedAt = new Date().toISOString();
      await putApprovedFlashcardBankForStudySet(id, {
        version: 1,
        savedAt,
        items: normalized,
      });

      await touchStudySetMeta(id, {
        status: normalized.length > 0 ? "ready" : "draft",
      });

      setCards(normalized);
      setInitialCards(
        normalized.map((c) => ({
          ...c,
          front: c.front,
          back: c.back,
        })),
      );
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [cards, id]);

  const setFront = useCallback((cardId: string, text: string) => {
    setDirty(true);
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, front: text } : c)),
    );
  }, []);

  const setBack = useCallback((cardId: string, text: string) => {
    setDirty(true);
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, back: text } : c)),
    );
  }, []);

  const removeAt = useCallback((cardId: string) => {
    setDirty(true);
    setApprovedIds((ap) => {
      const n = new Set(ap);
      n.delete(cardId);
      return n;
    });
    setCards((prev) => prev.filter((c) => c.id !== cardId));
  }, []);

  useEffect(() => {
    if (cards.length === 0) {
      setActiveCardId(null);
      return;
    }
    if (!activeCardId || !cards.some((c) => c.id === activeCardId)) {
      setActiveCardId(cards[0]?.id ?? null);
    }
  }, [cards, activeCardId]);

  const onApprove = useCallback((cardId: string) => {
    setApprovedIds((prev) => new Set(prev).add(cardId));
  }, []);

  if (!id) {
    return null;
  }

  if (!routeReady) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Loading…
      </p>
    );
  }

  if (loadError) {
    return (
      <div>
        <p className="text-destructive">{loadError}</p>
        <Link href="/dashboard" className="mt-4 inline-block text-primary">
          ← Library
        </Link>
      </div>
    );
  }

  return (
    <FlashcardReviewWorkspace
      studySetId={id}
      title={meta?.title}
      subtitle={meta?.subtitle}
      cards={cards}
      initialCards={initialCards}
      activeCardId={activeCardId}
      onActiveCardIdChange={setActiveCardId}
      approvedIds={approvedIds}
      onApprove={onApprove}
      dirty={dirty}
      saving={saving}
      onSaveAll={() => void saveChanges()}
      onFrontChange={setFront}
      onBackChange={setBack}
      onRemove={removeAt}
    />
  );
}
