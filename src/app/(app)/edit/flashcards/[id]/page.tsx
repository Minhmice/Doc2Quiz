"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FlashcardReviewWorkspace } from "@/components/flashcards/review/FlashcardReviewWorkspace";
import { createRandomUuid } from "@/lib/ids/createRandomUuid";
import {
  ensureStudySetDb,
  getDraftFlashcardVisionItems,
  getDraftQuestions,
  getStudySetMeta,
  putDraftFlashcardVisionItems,
} from "@/lib/db/studySetDb";
import type { FlashcardVisionItem } from "@/types/visionParse";
import type { StudySetMeta } from "@/types/studySet";

export default function EditFlashcardsReviewPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [meta, setMeta] = useState<StudySetMeta | null>(null);
  const [draft, setDraft] = useState<FlashcardVisionItem[]>([]);
  const [initialDraft, setInitialDraft] = useState<FlashcardVisionItem[]>([]);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState(() => new Set<string>());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      return;
    }
    setLoadError(null);
    try {
      await ensureStudySetDb();
      const m = await getStudySetMeta(id);
      setMeta(m ?? null);

      let next: FlashcardVisionItem[] = [];
      const vision = await getDraftFlashcardVisionItems(id);
      if (vision.length > 0) {
        next = vision.map((it) =>
          it.id ? it : { ...it, id: createRandomUuid() },
        );
      } else {
        const qs = await getDraftQuestions(id);
        if (qs.length > 0) {
          next = qs.map((q) => ({
            kind: "flashcard" as const,
            id: q.id,
            front: q.question,
            back: q.options[q.correctIndex] ?? "",
            confidence:
              typeof q.parseConfidence === "number" ? q.parseConfidence : 0.5,
            sourcePages:
              q.sourcePageIndex !== undefined && q.sourcePageIndex >= 1
                ? [q.sourcePageIndex]
                : undefined,
          }));
        }
      }
      setDraft(next);
      setInitialDraft(
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
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveDraft = useCallback(async () => {
    if (!id) {
      return;
    }
    setSaving(true);
    try {
      await putDraftFlashcardVisionItems(id, draft);
      setInitialDraft(
        draft.map((c) => ({
          ...c,
          front: c.front,
          back: c.back,
        })),
      );
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [draft, id]);

  const setFront = useCallback((cardId: string, text: string) => {
    setDirty(true);
    setDraft((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, front: text } : c)),
    );
  }, []);

  const setBack = useCallback((cardId: string, text: string) => {
    setDirty(true);
    setDraft((prev) =>
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
    setDraft((prev) => prev.filter((c) => c.id !== cardId));
  }, []);

  useEffect(() => {
    if (draft.length === 0) {
      setActiveCardId(null);
      return;
    }
    if (!activeCardId || !draft.some((c) => c.id === activeCardId)) {
      setActiveCardId(draft[0]?.id ?? null);
    }
  }, [draft, activeCardId]);

  const onApprove = useCallback((cardId: string) => {
    setApprovedIds((prev) => new Set(prev).add(cardId));
  }, []);

  if (!id) {
    return null;
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
      draft={draft}
      initialDraft={initialDraft}
      activeCardId={activeCardId}
      onActiveCardIdChange={setActiveCardId}
      approvedIds={approvedIds}
      onApprove={onApprove}
      dirty={dirty}
      saving={saving}
      onSaveAll={() => void saveDraft()}
      onFrontChange={setFront}
      onBackChange={setBack}
      onRemove={removeAt}
    />
  );
}
