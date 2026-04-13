"use client";

import { useCallback } from "react";
import { FlashcardsImportWorkbench } from "@/components/edit/new/flashcards/FlashcardsImportWorkbench";
import { NewStudySetPdfImportFlow } from "@/app/(app)/edit/new/NewStudySetPdfImportFlow";
import { editFlashcards } from "@/lib/routes/studySetPaths";

export default function NewStudySetFlashcardsPage() {
  const getPostParseHref = useCallback((id: string) => editFlashcards(id), []);

  return (
    <FlashcardsImportWorkbench
      headerTitle="Create flashcards from file"
      headerPathCue="Deck_Import / PDF_stack"
    >
      <NewStudySetPdfImportFlow
        contentKind="flashcards"
        pageHeading="Create flashcards from file"
        pageSubcopy="Upload a PDF. AI will draft card fronts and backs for you to review before you study."
        getPostParseHref={getPostParseHref}
      />
    </FlashcardsImportWorkbench>
  );
}
