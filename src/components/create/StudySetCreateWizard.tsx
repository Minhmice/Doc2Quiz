"use client";

import { UnifiedInputZone } from "@/components/edit/new/import/UnifiedInputZone";
import { StudySetNewImportStepProvider } from "@/components/edit/new/import/StudySetNewImportStepContext";
import { flashcardReview, quizReview } from "@/lib/routes/studySetPaths";
import type { StudyContentKind } from "@/types/studySet";

export type StudySetCreateWizardProps = Readonly<{
  contentKind: StudyContentKind;
}>;

export function StudySetCreateWizard({ contentKind }: StudySetCreateWizardProps) {
  const reviewPath = contentKind === "quiz" ? quizReview : flashcardReview;

  return (
    <StudySetNewImportStepProvider>
      <UnifiedInputZone
        contentKind={contentKind}
        pageHeading={contentKind === "quiz" ? "Build a practice set" : "Build a flip study set"}
        pageSubcopy="Start with a source. Doc2Quiz converts it, generates study content, and saves your set for review."
        getPostIngestHref={reviewPath}
      />
    </StudySetNewImportStepProvider>
  );
}
