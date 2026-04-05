"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { UploadBox } from "@/components/upload/UploadBox";
import { createStudySet, ensureStudySetDb } from "@/lib/db/studySetDb";
import { extractText } from "@/lib/pdf/extractText";
import type { PdfValidationError } from "@/lib/pdf/validatePdfFile";

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
      try {
        await ensureStudySetDb();
        const result = await extractText(file);
        const title =
          file.name.replace(/\.pdf$/i, "").trim() || "Untitled study set";

        if (result.pageCount >= 1 && !result.text.trim()) {
          const id = await createStudySet({
            title,
            sourceFileName: file.name,
            pageCount: result.pageCount,
            extractedText: "",
            pdfFile: file,
          });
          router.push(`/sets/${id}/source`);
          return;
        }

        const id = await createStudySet({
          title,
          sourceFileName: file.name,
          pageCount: result.pageCount,
          extractedText: result.text,
          pdfFile: file,
        });
        router.push(`/sets/${id}/source`);
      } catch {
        setError(
          "Could not read this PDF. It may be scanned — you can still use vision parsing after import.",
        );
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--d2q-text)]">
        New study set
      </h1>
      <p className="mt-1 text-sm text-[var(--d2q-muted)]">
        Upload a PDF. Text is extracted locally; then use Parse to generate
        questions with AI.
      </p>

      <div className="mt-8 max-w-lg">
        <UploadBox
          disabled={loading}
          error={error}
          hasExtractedContent={false}
          onFileSelected={handleFile}
          onValidationError={handleValidationError}
        />
        {loading ? (
          <p className="mt-4 text-sm font-medium text-[var(--d2q-accent-hover)]">
            Extracting text…
          </p>
        ) : null}
      </div>
    </div>
  );
}
