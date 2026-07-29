import type { ReactNode } from "react";
import { StudySetNewImportStepProvider } from "@/components/edit/new/import/StudySetNewImportStepContext";
import { FlashcardsImportTechnicalGrid } from "./FlashcardsImportTechnicalGrid";

export type FlashcardsImportWorkbenchProps = {
  children: ReactNode;
};

export function FlashcardsImportWorkbench({
  children,
}: Readonly<FlashcardsImportWorkbenchProps>) {
  return (
    <StudySetNewImportStepProvider>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent text-foreground selection:bg-accent selection:text-accent-foreground">
        <FlashcardsImportTechnicalGrid />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
          <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-transparent">
            {children}
          </main>
        </div>
      </div>
    </StudySetNewImportStepProvider>
  );
}
