import type { ReactNode } from "react";
import { StudySetNewImportStepProvider } from "@/components/sets/new/import/StudySetNewImportStepContext";
import { FlashcardsImportTechnicalGrid } from "./FlashcardsImportTechnicalGrid";
import { FlashcardsImportWorkbenchHeader } from "./FlashcardsImportWorkbenchHeader";

export type FlashcardsImportWorkbenchProps = {
  children: ReactNode;
  headerTitle: string;
  headerPathCue: string;
};

/**
 * Import workbench shell: technical grid, compact command header, scrollable main (Quiz example structure).
 */
export function FlashcardsImportWorkbench({
  children,
  headerTitle,
  headerPathCue,
}: Readonly<FlashcardsImportWorkbenchProps>) {
  return (
    <StudySetNewImportStepProvider>
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground selection:bg-accent/25 selection:text-accent-foreground">
        <FlashcardsImportTechnicalGrid />
        <FlashcardsImportWorkbenchHeader title={headerTitle} pathCue={headerPathCue} />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto">
          <main className="relative mx-auto flex w-full min-h-0 flex-1 flex-col bg-background d2q-technical-grid">
            {children}
          </main>
        </div>
      </div>
    </StudySetNewImportStepProvider>
  );
}
