"use client";

import { useCallback, useState } from "react";
import { UploadBox } from "@/components/upload/UploadBox";
import { RawTextViewer } from "@/components/viewer/RawTextViewer";
import { extractText } from "@/lib/pdf/extractText";
import type { PdfValidationError } from "@/lib/pdf/validatePdfFile";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasContent =
    extractedText !== null && extractedText.trim().length > 0;

  const handleValidationError = useCallback((err: PdfValidationError) => {
    setError(
      err === "type"
        ? "Please choose a PDF file."
        : "This file is too large. Maximum size is 10 MB.",
    );
    setExtractedText(null);
    setPageCount(null);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setLoading(true);
    setExtractedText(null);
    setPageCount(null);

    try {
      const result = await extractText(file);
      if (result.pageCount >= 1 && !result.text.trim()) {
        setError(
          "This PDF may be scanned. Text extraction failed.\nTry a PDF with selectable text.",
        );
        setExtractedText("");
        setPageCount(result.pageCount);
        return;
      }
      setExtractedText(result.text);
      setPageCount(result.pageCount);
    } catch {
      setError(
        "This PDF may be scanned. Text extraction failed.\nTry a PDF with selectable text.",
      );
      setExtractedText(null);
      setPageCount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Doc2Quiz
        </h1>
        <p className="mt-2 text-neutral-600">
          Upload a PDF to extract its text. Text-based PDFs only — scanned pages
          are not supported.
        </p>
      </header>

      <UploadBox
        disabled={loading}
        error={error}
        hasExtractedContent={hasContent}
        onFileSelected={handleFile}
        onValidationError={handleValidationError}
      />

      {loading ? (
        <p className="mt-4 text-sm font-medium text-teal-800">Extracting text…</p>
      ) : null}

      <RawTextViewer text={extractedText} pageCount={pageCount} />
    </main>
  );
}
