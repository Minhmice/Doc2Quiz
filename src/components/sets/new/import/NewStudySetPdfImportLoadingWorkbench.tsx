"use client";

import { NewStudySetPdfImportProgressChrome } from "@/components/sets/new/import/NewStudySetPdfImportProgressChrome";
import type { NewStudySetPdfImportPhase } from "@/components/sets/new/import/newStudySetPdfImportPhase";
import type { StudyContentKind } from "@/types/studySet";

export type { NewStudySetPdfImportPhase } from "@/components/sets/new/import/newStudySetPdfImportPhase";

export type NewStudySetPdfImportLoadingWorkbenchProps = {
  phase: NewStudySetPdfImportPhase;
  contentKind: StudyContentKind;
  fileName?: string | null;
};

export function NewStudySetPdfImportLoadingWorkbench(
  props: Readonly<NewStudySetPdfImportLoadingWorkbenchProps>,
) {
  const { phase, contentKind, fileName } = props;
  return (
    <NewStudySetPdfImportProgressChrome
      phase={phase}
      contentKind={contentKind}
      fileName={fileName}
      variant="standalone"
    />
  );
}
