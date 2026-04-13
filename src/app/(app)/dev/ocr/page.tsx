"use client";

import { useCallback } from "react";
import { NewStudySetPdfImportFlow } from "../../sets/new/NewStudySetPdfImportFlow";

export default function DevOcrLabPage() {
  const getPostCreateHref = useCallback((studySetId: string) => `/dev/ocr/${studySetId}`, []);

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
        <strong className="font-semibold">Internal OCR lab</strong> — not part of the main
        learner flow. Upload a PDF to inspect OCR runs and debug parse output.
      </header>
      <NewStudySetPdfImportFlow
        contentKind="quiz"
        titlePrefix="[Dev OCR] "
        pageHeading="OCR lab — import PDF"
        pageSubcopy="Creates a draft study set tagged for developers, then opens the OCR inspector."
        runAiParseOnNewPage={false}
        getPostCreateHref={getPostCreateHref}
      />
    </div>
  );
}
