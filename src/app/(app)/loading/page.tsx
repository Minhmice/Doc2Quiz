"use client";

import { useRouter } from "next/navigation";
import { Doc2QuizAnimatedLoading } from "@/legacy/loading/doc2quiz-animated-loading";

export default function AppLoadingPage() {
  const router = useRouter();

  return (
    <Doc2QuizAnimatedLoading
      documentTitle="Study_Syllabus_Exam_Prep.pdf"
      onStartPractice={() => router.push("/quiz")}
      onReviewQuestions={() => router.push("/dashboard")}
      onBack={() => router.push("/dashboard")}
    />
  );
}
