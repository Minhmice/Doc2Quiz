"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AiParseSection,
  type AiParseSectionHandle,
  type ParseRunResult,
} from "@/components/ai/AiParseSection";
import { ParseProgressOverlay } from "@/components/ai/ParseProgressOverlay";
import { ParseResultOverlay } from "@/components/ai/ParseResultOverlay";
import { useParseProgress } from "@/components/ai/ParseProgressContext";
import { PdfInfoCard } from "@/components/upload/PdfInfoCard";
import { Button } from "@/components/ui/button";
import {
  ensureStudySetDb,
  getDocument,
  getStudySetMeta,
  putDocument,
  putDraftQuestions,
  touchStudySetMeta,
} from "@/lib/db/studySetDb";
import { getPdfPageCount } from "@/lib/pdf/getPdfPageCount";
import { pdfFileFromDocument } from "@/lib/studySet/pdfFileFromDocument";
import type { Question } from "@/types/question";
import type { StudySetDocumentRecord, StudySetMeta } from "@/types/studySet";

export default function StudySetSourcePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const parseRef = useRef<AiParseSectionHandle>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const { live } = useParseProgress();

  const [meta, setMeta] = useState<StudySetMeta | null>(null);
  const [doc, setDoc] = useState<StudySetDocumentRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replaceBusy, setReplaceBusy] = useState(false);
  const [autoStartKey, setAutoStartKey] = useState(0);
  const [parseResult, setParseResult] = useState<{
    questions: Question[];
  } | null>(null);

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
      setLoadError(
        e instanceof Error ? e.message : "Failed to load study set.",
      );
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const handleReplacePdf = useCallback(
    async (file: File) => {
      if (!id) {
        return;
      }
      setReplaceBusy(true);
      setLoadError(null);
      setParseResult(null);
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
      try {
        const pageCount = await getPdfPageCount(file);
        const buf = await file.arrayBuffer();
        const next: StudySetDocumentRecord = {
          studySetId: id,
          extractedText: "",
          pdfArrayBuffer: buf,
          pdfFileName: file.name,
        };
        await putDocument(next);
        await putDraftQuestions(id, []);
        setDoc(next);
        await touchStudySetMeta(id, {
          pageCount,
          sourceFileName: file.name,
        });
        const m = await getStudySetMeta(id);
        if (m) {
          setMeta(m);
        }
        setAutoStartKey((k) => k + 1);
        await load();
      } catch {
        setLoadError("Could not read the replacement PDF.");
      } finally {
        setReplaceBusy(false);
      }
    },
    [id, load],
  );

  const pdfFile = useMemo(
    () => (doc ? pdfFileFromDocument(doc) : null),
    [doc],
  );

  const parsing = Boolean(live?.running && live.studySetId === id);

  const clearRedirectTimer = useCallback(() => {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
  }, []);

  const handleParseFinished = useCallback(
    (r: ParseRunResult) => {
      clearRedirectTimer();
      if (r.ok && !r.aborted) {
        setParseResult({
          questions: r.questions,
        });
        redirectTimerRef.current = setTimeout(() => {
          router.push(`/sets/${id}/review`);
        }, 2000);
      } else {
        setParseResult(null);
      }
    },
    [clearRedirectTimer, id, router],
  );

  const handleManualParse = useCallback(() => {
    setParseResult(null);
    clearRedirectTimer();
    void (async () => {
      const r = await parseRef.current?.runParse();
      if (r) {
        handleParseFinished(r);
      }
    })();
  }, [clearRedirectTimer, handleParseFinished]);

  const handlePreviewPdf = useCallback(() => {
    if (!pdfFile) {
      return;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const url = URL.createObjectURL(pdfFile);
    previewUrlRef.current = url;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [pdfFile]);

  if (!id) {
    return null;
  }

  if (loadError && !doc) {
    return (
      <div>
        <p className="text-red-400">{loadError}</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-[var(--d2q-accent-hover)]"
        >
          ← Library
        </Link>
      </div>
    );
  }

  if (!doc || !meta) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {meta.title}
        </h1>
        {meta.subtitle ? (
          <p className="text-sm font-medium text-muted-foreground">
            {meta.subtitle}
          </p>
        ) : null}
        {meta.sourceFileName ? (
          <p className="text-xs text-muted-foreground">
            Source: {meta.sourceFileName}
          </p>
        ) : null}
      </header>

      <PdfInfoCard
        fileName={meta.sourceFileName ?? doc.pdfFileName ?? "document.pdf"}
        pageCount={meta.pageCount ?? 0}
        uploadedAt={meta.createdAt}
        onReplace={handleReplacePdf}
        replaceBusy={replaceBusy}
        onPreview={pdfFile ? handlePreviewPdf : undefined}
      />

      {loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : null}

      <AiParseSection
        ref={parseRef}
        studySetId={id}
        activePdfFile={pdfFile}
        pageCount={meta.pageCount ?? null}
        variant="embedded"
        autoStartWhenDraftEmpty
        autoStartResetKey={autoStartKey}
        onEmbeddedParseFinished={handleParseFinished}
        onDraftPersisted={load}
      />

      <ParseProgressOverlay studySetId={id} />

      {parseResult ? (
        <ParseResultOverlay
          questions={parseResult.questions}
          onContinue={() => router.push(`/sets/${id}/review`)}
        />
      ) : null}

      {!parsing && !parseResult ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-border bg-muted/20 p-10 text-center sm:p-12">
          <p className="text-lg font-medium text-foreground">
            Ready to generate questions
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            AI reads each page as an image and extracts multiple-choice
            questions. You can run again if results look off.
          </p>
          <Button
            type="button"
            size="lg"
            className="mt-2 font-semibold"
            onClick={handleManualParse}
          >
            Parse with AI
          </Button>
        </div>
      ) : null}

      {parsing ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => parseRef.current?.cancel()}
          >
            Cancel parsing (stop AI processing)
          </Button>
        </div>
      ) : null}

    </div>
  );
}
