import type { ReactNode } from "react";
import { StudySetNewImportStepProvider } from "@/components/edit/new/import/StudySetNewImportStepContext";
import { QuizNewImportTechnicalBackdrop } from "./QuizNewImportTechnicalBackdrop";

type QuizNewImportWorkbenchProps = Readonly<{
  children: ReactNode;
}>;

export function QuizNewImportWorkbench({ children }: QuizNewImportWorkbenchProps) {
  return (
    <StudySetNewImportStepProvider>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground selection:bg-accent selection:text-accent-foreground">
        <QuizNewImportTechnicalBackdrop />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
          <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-background d2q-technical-grid">
            {children}
          </main>
        </div>
      </div>
    </StudySetNewImportStepProvider>
  );
}
