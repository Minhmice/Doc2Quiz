"use client";

import { useCallback } from "react";
import { QuizNewImportWorkbench } from "@/components/sets/new/quiz/QuizNewImportWorkbench";
import { NewStudySetPdfImportFlow } from "@/app/(app)/sets/new/NewStudySetPdfImportFlow";
import { editQuiz } from "@/lib/routes/studySetPaths";

export default function NewStudySetQuizPage() {
  const getPostParseHref = useCallback((id: string) => editQuiz(id), []);

  return (
    <QuizNewImportWorkbench>
      <NewStudySetPdfImportFlow
        contentKind="quiz"
        pageHeading="Create quiz from file"
        pageSubcopy="Upload a PDF or supported document. AI will generate a draft quiz for you to review before you practice."
        getPostParseHref={getPostParseHref}
      />
    </QuizNewImportWorkbench>
  );
}
