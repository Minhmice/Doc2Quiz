"use client";

import { useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { QuizNewImportWorkbench } from "@/components/edit/new/quiz/QuizNewImportWorkbench";
import { NewStudySetPdfImportFlow } from "@/app/(app)/edit/new/NewStudySetPdfImportFlow";
import { quizPlay } from "@/lib/routes/studySetPaths";

export default function NewStudySetQuizPage() {
  const getPostParseHref = useCallback((id: string) => quizPlay(id), []);

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
      </div>
      <NewStudySetPdfImportFlow
        contentKind="quiz"
        pageHeading="Create quiz from file"
        pageSubcopy="Upload a PDF or supported document. AI will generate a quiz and take you straight into practice."
        getPostParseHref={getPostParseHref}
      />
    </QuizNewImportWorkbench>
  );
}
