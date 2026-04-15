"use client";

import { useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FlashcardsImportWorkbench } from "@/components/edit/new/flashcards/FlashcardsImportWorkbench";
import { NewStudySetPdfImportFlow } from "@/app/(app)/edit/new/NewStudySetPdfImportFlow";
import { flashcardsPlay } from "@/lib/routes/studySetPaths";

export default function NewStudySetFlashcardsPage() {
  const getPostParseHref = useCallback((id: string) => flashcardsPlay(id), []);

  return (
    <FlashcardsImportWorkbench>
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          aria-label="Back to dashboard"
          className="group inline-flex cursor-pointer items-center gap-2 font-label text-sm font-medium tracking-widest text-chart-2 uppercase transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden />
          <span className="border-b border-transparent transition-colors group-hover:border-chart-2">
            Back
          </span>
        </Link>
      </div>
      <NewStudySetPdfImportFlow
        contentKind="flashcards"
        pageHeading="Create flashcards from file"
        pageSubcopy="Upload a PDF. AI will generate flashcards and take you straight into study mode."
        getPostParseHref={getPostParseHref}
      />
    </FlashcardsImportWorkbench>
  );
}
