"use client";

import { UnifiedInputZone } from "@/components/edit/new/import/UnifiedInputZone";
import { StudySetNewImportStepProvider } from "@/components/edit/new/import/StudySetNewImportStepContext";
import type { StudyContentKind } from "@/types/studySet";

export type StudySetCreateWizardProps = Readonly<{
  contentKind: StudyContentKind;
  workspaceId?: string;
}>;

export function StudySetCreateWizard({
  contentKind,
  workspaceId,
}: StudySetCreateWizardProps) {
  return (
    <StudySetNewImportStepProvider>
      <UnifiedInputZone
        contentKind={contentKind}
        pageHeading={contentKind === "quiz" ? "Build a practice set" : "Build a flip study set"}
        pageSubcopy="Start with a source. Doc2Quiz converts it, generates study content, and saves your set for review."
        getPostIngestHref={(identity) => `/workspace/${identity.workspaceId}`}
        workspaceId={workspaceId}
      />
    </StudySetNewImportStepProvider>
  );
}
