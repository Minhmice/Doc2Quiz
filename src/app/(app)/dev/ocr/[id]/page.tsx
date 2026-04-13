"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OcrInspector } from "@/components/ai/OcrInspector";
import { ensureStudySetDb, getDocument, getStudySetMeta } from "@/lib/db/studySetDb";
import { editQuiz } from "@/lib/routes/studySetPaths";
import { pdfFileFromDocument } from "@/lib/studySet/pdfFileFromDocument";
import type { StudySetDocumentRecord, StudySetMeta } from "@/types/studySet";

export default function DevOcrStudySetPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [meta, setMeta] = useState<StudySetMeta | null>(null);
  const [doc, setDoc] = useState<StudySetDocumentRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    if (!id) {
      return;
    }
    setLoadError(null);
    try {
      await ensureStudySetDb();
      const m = await getStudySetMeta(id);
      if (!m) {
        setLoadError("Study set not found.");
        return;
      }
      setMeta(m);
      const d = await getDocument(id);
      if (!d) {
        setLoadError("Document record missing.");
        return;
      }
      setDoc(d);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load.");
    }
    setReloadKey((k) => k + 1);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const pdfFile = useMemo(() => (doc ? pdfFileFromDocument(doc) : null), [doc]);

  if (!id) {
    return null;
  }

  if (loadError && !doc) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">{loadError}</p>
        <Link href="/dev/ocr" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
          ← OCR lab
        </Link>
      </div>
    );
  }

  if (!doc || !meta) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-heading text-xl font-bold text-foreground">
          OCR lab · {meta.title}
        </h1>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/dev/ocr" className="font-medium text-primary underline-offset-2 hover:underline">
            ← OCR lab home
          </Link>
          <Link
            href={editQuiz(id)}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Open edit (quiz)
          </Link>
        </div>
      </header>

      <OcrInspector studySetId={id} pdfFile={pdfFile} reloadKey={reloadKey} />
    </div>
  );
}
