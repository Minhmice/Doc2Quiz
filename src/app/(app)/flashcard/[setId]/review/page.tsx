"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { FlashcardReviewWorkspace } from "@/components/flashcards/review/FlashcardReviewWorkspace";
import { FlashcardSetupWizard } from "@/components/flashcards/FlashcardSetupWizard";
import { CanonicalSourceReview } from "@/components/canonical/CanonicalSourceReview";
import { Button } from "@/components/ui/button";
import { postCanonicalize, fetchCanonicalPreview, type CanonicalPreviewData } from "@/lib/client/canonicalizeStudySet";
import { postFlashcardGenerate } from "@/lib/client/flashcardGenerateStudySet";
import { createRandomUuid } from "@/lib/ids/createRandomUuid";
import { ensureStudySetDb, getApprovedFlashcardBank, putApprovedFlashcardBankForStudySet, touchStudySetMeta } from "@/lib/client/studySetDb";
import type { FlashcardGenerateBody } from "@/lib/pipeline/flashcardSchemas";
import type { FlashcardVisionItem } from "@/types/flashcard";

export default function FlashcardReviewPage() {
  const params = useParams<{ setId: string }>();
  const studySetId = params.setId;
  const [preview, setPreview] = useState<CanonicalPreviewData | null>(null);
  const [cards, setCards] = useState<FlashcardVisionItem[]>([]);
  const [initialCards, setInitialCards] = useState<FlashcardVisionItem[]>([]);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureStudySetDb();
      const [canonical, bank] = await Promise.all([
        fetchCanonicalPreview(studySetId).catch(() => null),
        getApprovedFlashcardBank(studySetId),
      ]);
      setPreview(canonical);
      const next = bank?.items ?? [];
      setCards(next);
      setInitialCards(next.map((card) => ({ ...card })));
      setActiveCardId(next[0]?.id ?? null);
      setDirty(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load study set.");
    } finally {
      setLoading(false);
    }
  }, [studySetId]);

  useEffect(() => { void load(); }, [load]);

  const canonicalize = useCallback(async () => {
    setWorking(true);
    try {
      await postCanonicalize(studySetId);
      setPreview(await fetchCanonicalPreview(studySetId));
      toast.success("Source reviewed. Choose your flashcard options.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Canonicalization failed.");
    } finally {
      setWorking(false);
    }
  }, [studySetId]);

  const sections = useMemo(
    () => (preview?.sections ?? []).map((section) => ({ sectionKey: section.sectionKey ?? section.id, heading: section.heading })),
    [preview],
  );

  const handleGenerate = useCallback(async (body: FlashcardGenerateBody) => {
    setWorking(true);
    try {
      await postFlashcardGenerate(studySetId, body);
      await load();
      toast.success("Flashcards generated. Review and edit them below.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Flashcard generation failed.");
    } finally {
      setWorking(false);
    }
  }, [load, studySetId]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const normalized = cards.filter((card) => card.front.trim() && card.back.trim()).map((card) => ({ ...card, id: card.id || createRandomUuid() }));
      await putApprovedFlashcardBankForStudySet(studySetId, { version: 1, savedAt: new Date().toISOString(), items: normalized });
      await touchStudySetMeta(studySetId, { pipelineStage: normalized.length ? "flashcards" : "canonical" });
      setCards(normalized);
      setInitialCards(normalized.map((card) => ({ ...card })));
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [cards, studySetId]);

  if (loading) return <p className="p-8 text-sm text-muted-foreground">Loading source…</p>;
  if (error) return <p className="p-8 text-sm text-destructive">{error}</p>;

  if (cards.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-8 p-6 sm:p-10">
        <header><p className="font-label text-xs font-bold uppercase tracking-widest text-primary">Source review</p><h1 className="mt-2 font-heading text-3xl font-extrabold">Review your source before making cards</h1></header>
        {preview ? (
          <section className="space-y-4">
            <CanonicalSourceReview preview={preview} />
            <FlashcardSetupWizard sections={sections} onSubmit={(body) => void handleGenerate(body)} onCancel={() => {}} />
          </section>
        ) : (
          <section className="rounded-xl border border-border/60 bg-card p-6"><p className="mb-4 text-sm text-muted-foreground">MarkItDown has prepared the raw source. Build canonical knowledge to continue.</p><Button onClick={() => void canonicalize()} disabled={working}>{working ? "Building canonical knowledge…" : "Review canonical source"}</Button></section>
        )}
      </main>
    );
  }

  return <FlashcardReviewWorkspace studySetId={studySetId} title={preview?.studySet.title} cards={cards} initialCards={initialCards} activeCardId={activeCardId} onActiveCardIdChange={setActiveCardId} approvedIds={approvedIds} onApprove={(id) => setApprovedIds((prev) => new Set(prev).add(id))} dirty={dirty} saving={saving || working} onSaveAll={() => void save()} onFrontChange={(id, text) => { setDirty(true); setCards((prev) => prev.map((card) => card.id === id ? { ...card, front: text } : card)); }} onBackChange={(id, text) => { setDirty(true); setCards((prev) => prev.map((card) => card.id === id ? { ...card, back: text } : card)); }} onRemove={(id) => { setDirty(true); setCards((prev) => prev.filter((card) => card.id !== id)); }} />;
}
