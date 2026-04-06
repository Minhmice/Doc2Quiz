"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { UploadBox } from "@/components/upload/UploadBox";
import { generateStudySetTitle } from "@/lib/ai/generateStudySetTitle";
import { createStudySet, ensureStudySetDb } from "@/lib/db/studySetDb";
import { getPdfPageCount } from "@/lib/pdf/getPdfPageCount";
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
        const pageCount = await getPdfPageCount(file);
        const naming = await generateStudySetTitle("", file.name);

        const id = await createStudySet({
          title: naming.title,
          subtitle: naming.subtitle,
          sourceFileName: file.name,
          pageCount,
          extractedText: "",
          pdfFile: file,
        });
        router.push(`/sets/${id}/source`);
      } catch {
        setError(
          "Could not open this PDF. Check the file is valid and try again.",
        );
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
          Upload a PDF. Questions are generated with AI vision (pages as images)
          on the next step — no local text extraction.
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
