"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AiParseSection } from "@/components/ai/AiParseSection";
import {
  ensureStudySetDb,
  getDocument,
  getStudySetMeta,
  putDocument,
  touchStudySetMeta,
} from "@/lib/db/studySetDb";
import { pdfFileFromDocument } from "@/lib/studySet/pdfFileFromDocument";
import { extractText } from "@/lib/pdf/extractText";
import type { StudySetDocumentRecord } from "@/types/studySet";

export default function StudySetSourcePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [title, setTitle] = useState("");
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [doc, setDoc] = useState<StudySetDocumentRecord | null>(null);
  const [editedText, setEditedText] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replaceBusy, setReplaceBusy] = useState(false);

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
      setTitle(meta.title);
      setPageCount(meta.pageCount ?? null);
      const d = await getDocument(id);
      if (!d) {
        setLoadError("Document record missing.");
        return;
      }
      setDoc(d);
      setEditedText(d.extractedText);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Failed to load study set.",
      );
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveText = useCallback(async () => {
    if (!id || !doc) {
      return;
    }
    setSaving(true);
    try {
      const next: StudySetDocumentRecord = {
        ...doc,
        extractedText: editedText,
      };
      await putDocument(next);
      setDoc(next);
      await touchStudySetMeta(id, {});
    } finally {
      setSaving(false);
    }
  }, [id, doc, editedText]);

  const syncBeforeParse = useCallback(async () => {
    if (!id || !doc) {
      return;
    }
    const next: StudySetDocumentRecord = {
      ...doc,
      extractedText: editedText,
    };
    await putDocument(next);
    setDoc(next);
    await touchStudySetMeta(id, {});
  }, [id, doc, editedText]);

  const handleReplacePdf = useCallback(
    async (file: File) => {
      if (!id || !doc) {
        return;
      }
      setReplaceBusy(true);
      setLoadError(null);
      try {
        const result = await extractText(file);
        const buf = await file.arrayBuffer();
        const next: StudySetDocumentRecord = {
          studySetId: id,
          extractedText: result.text,
          pdfArrayBuffer: buf,
          pdfFileName: file.name,
        };
        await putDocument(next);
        setDoc(next);
        setEditedText(result.text);
        await touchStudySetMeta(id, {
          pageCount: result.pageCount,
          sourceFileName: file.name,
        });
        setPageCount(result.pageCount);
      } catch {
        setLoadError("Could not read the replacement PDF.");
      } finally {
        setReplaceBusy(false);
      }
    },
    [id, doc],
  );

  const pdfFile = useMemo(
    () => (doc ? pdfFileFromDocument(doc) : null),
    [doc],
  );

  const textExtractionEmpty =
    pageCount !== null &&
    pageCount >= 1 &&
    editedText.trim().length === 0;

  if (!id) {
    return null;
  }

  if (loadError && !doc) {
    return (
      <div>
        <p className="text-red-400">{loadError}</p>
        <Link href="/dashboard" className="mt-4 inline-block text-[var(--d2q-accent-hover)]">
          ← Library
        </Link>
      </div>
    );
  }

  if (!doc) {
    return <p className="text-sm text-[var(--d2q-muted)]">Loading…</p>;
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--d2q-text)]">
          Source · {title}
        </h1>
        <p className="mt-1 text-sm text-[var(--d2q-muted)]">
          Edit text, replace the PDF if needed, then parse with AI below.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-3">
        <label className="cursor-pointer rounded-lg border border-[var(--d2q-border)] bg-[var(--d2q-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--d2q-text)] hover:bg-[var(--d2q-surface)]">
          Replace PDF
          <input
            type="file"
            accept="application/pdf"
            className="sr-only"
            disabled={replaceBusy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) {
                void handleReplacePdf(f);
              }
            }}
          />
        </label>
        {replaceBusy ? (
          <span className="text-sm text-[var(--d2q-accent-hover)]">Processing PDF…</span>
        ) : null}
      </div>

      {pageCount !== null && pageCount > 0 ? (
        <p className="mb-2 text-sm text-[var(--d2q-muted)]">
          {pageCount} {pageCount === 1 ? "page" : "pages"} in PDF
          {Boolean(pageCount >= 1) && editedText.trim() === "" ? (
            <span className="ml-2 font-medium text-[var(--d2q-accent-warm)]">
              — no selectable text; Parse below will use vision when
              configured.
            </span>
          ) : null}
        </p>
      ) : null}

      <div className="mt-2 space-y-2">
        <label
          htmlFor="source-edit"
          className="text-sm font-medium text-[var(--d2q-text)]"
        >
          Edit text for parsing
        </label>
        <textarea
          id="source-edit"
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          rows={12}
          className="w-full rounded-lg border border-[var(--d2q-border)] bg-[var(--d2q-bg)] p-3 font-mono text-sm text-[var(--d2q-text)] shadow-sm focus:border-[var(--d2q-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--d2q-accent)]/30"
          spellCheck={false}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveText()}
            className="cursor-pointer rounded-lg bg-[var(--d2q-text)] px-4 py-2 text-sm font-semibold text-[var(--d2q-bg)] hover:bg-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save text"}
          </button>
        </div>
      </div>

      <div className="mt-10">
        <AiParseSection
          studySetId={id}
          extractedText={editedText}
          activePdfFile={pdfFile}
          pageCount={pageCount}
          textExtractionEmpty={textExtractionEmpty}
          onBeforeParse={syncBeforeParse}
          onDraftPersisted={load}
        />
      </div>

      <p className="mt-8 text-sm text-[var(--d2q-muted)]">
        Next:{" "}
        <Link
          href={`/sets/${id}/review`}
          className="font-medium text-[var(--d2q-accent-hover)] underline-offset-2 hover:underline"
        >
          Review questions
        </Link>
      </p>
    </div>
  );
}
