"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { UploadBox } from "@/components/upload/UploadBox";
import { generateStudySetTitle } from "@/lib/ai/generateStudySetTitle";
import { createStudySet, ensureStudySetDb } from "@/lib/db/studySetDb";
import {
  fileSummary,
  normalizeUnknownError,
  pipelineLog,
} from "@/lib/logging/pipelineLogger";
import { extractPdfText } from "@/lib/pdf/extractPdfText";
import { getPdfPageCount } from "@/lib/pdf/getPdfPageCount";
import type { PdfValidationError } from "@/lib/pdf/validatePdfFile";

type NewImportPhase = "idb" | "pdf" | "persist";

function userMessageForImportFailure(phase: NewImportPhase): string {
  if (phase === "idb") {
    return "Could not access on-device storage. Check that this site can use storage, then try again.";
  }
  if (phase === "persist") {
    return "Could not save your study set. The PDF was read, but saving failed—try again or free up browser storage.";
  }
  return "Could not open this PDF. Check the file is valid and try again.";
}

export default function NewStudySetPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleValidationError = useCallback((err: PdfValidationError) => {
    setError(
      err === "type"
        ? "Please choose a PDF file."
        : "This file is too large. Maximum size is 10 MB.",
    );
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setLoading(true);
      let phase: NewImportPhase = "idb";
      pipelineLog("STUDY_SET", "new-import", "info", "new study set: file handling start", {
        ...fileSummary(file),
      });
      try {
        pipelineLog("IDB", "ensure", "info", "ensureStudySetDb (new import)", {});
        await ensureStudySetDb();

        phase = "pdf";
        pipelineLog("PDF", "page-count", "info", "new import: getPdfPageCount start", {
          ...fileSummary(file),
        });
        const pageCount = await getPdfPageCount(file);
        pipelineLog("PDF", "page-count", "info", "new import: getPdfPageCount success", {
          ...fileSummary(file),
          pageCount,
        });

        pipelineLog("PDF", "extract-text", "info", "new import: extractPdfText start", {
          ...fileSummary(file),
          pageCount,
        });
        const extractedText = await extractPdfText(file);
        pipelineLog("PDF", "extract-text", "info", "new import: extractPdfText finished", {
          ...fileSummary(file),
          pageCount,
          extractedCharCount: extractedText.length,
        });

        const naming = await generateStudySetTitle(extractedText, file.name);

        phase = "persist";
        pipelineLog("STUDY_SET", "new-import", "info", "new import: createStudySet start", {
          ...fileSummary(file),
          pageCount,
          title: naming.title,
        });
        const id = await createStudySet({
          title: naming.title,
          subtitle: naming.subtitle,
          sourceFileName: file.name,
          pageCount,
          extractedText,
          pdfFile: file,
        });
        pipelineLog("STUDY_SET", "new-import", "info", "new import complete; navigating", {
          studySetId: id,
          ...fileSummary(file),
        });
        router.push(`/sets/${id}/source`);
      } catch (raw) {
        const norm = normalizeUnknownError(raw);
        const cause = raw instanceof Error && raw.cause ? normalizeUnknownError(raw.cause) : undefined;
        pipelineLog("STUDY_SET", "new-import", "error", "new study set pipeline failed", {
          phase,
          userFacingBucket:
            phase === "persist"
              ? "study_set_save"
              : phase === "idb"
                ? "indexeddb"
                : "pdf_open",
          ...fileSummary(file),
          ...norm,
          cause,
          raw,
        });
        setError(userMessageForImportFailure(phase));
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-6 sm:px-6 sm:py-8 lg:max-w-7xl lg:px-8">
      <header className="w-full max-w-3xl text-center lg:max-w-4xl">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          New study set
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base">
          Upload a PDF. Text is extracted locally for titles and storage; on the
          next step, questions are generated with AI vision (pages as images).
        </p>
      </header>

      <div className="mt-8 w-full max-w-3xl sm:mt-10 lg:max-w-4xl xl:max-w-5xl">
        <UploadBox
          disabled={loading}
          error={error}
          hasExtractedContent={false}
          onFileSelected={handleFile}
          onValidationError={handleValidationError}
        />
        {loading ? (
          <div className="mt-4 space-y-1 text-center sm:text-left">
            <p className="text-sm font-medium text-primary">Opening PDF…</p>
            <p className="text-xs text-muted-foreground">
              Preparing study set…
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
