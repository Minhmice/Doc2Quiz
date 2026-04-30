"use client";

import { useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { QuizNewImportWorkbench } from "@/components/edit/new/quiz/QuizNewImportWorkbench";
import { ImportStepTabStrip } from "@/components/edit/new/import/StudySetNewImportStepContext";
import { NewStudySetPdfImportFlowDynamic } from "@/components/edit/new/NewStudySetPdfImportFlowDynamic";
import { editQuiz } from "@/lib/routes/studySetPaths";

export default function NewStudySetQuizPage() {
  const getPostParseHref = useCallback((id: string) => editQuiz(id), []);

  return (
    <QuizNewImportWorkbench>
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
        <div className="mt-4 max-w-xl border-t border-border/40 pt-4">
          <ImportStepTabStrip />
        </div>
      </div>
      <NewStudySetPdfImportFlowDynamic
        contentKind="quiz"
        pageHeading="Create study set from file"
        pageSubcopy="Upload a PDF. We will create practice questions you can review before studying."
        getPostParseHref={getPostParseHref}
      />
    </QuizNewImportWorkbench>
  );
}
