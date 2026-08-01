"use client";

import { useRouter } from "next/navigation";
import { Doc2QuizAnimatedLoading } from "@/legacy/loading/doc2quiz-animated-loading";

export default function LoadingDemoPage() {
  const router = useRouter();

  return (
    <Doc2QuizAnimatedLoading
      documentTitle="CS402_Advanced_Distributed_Systems_Final.pdf"
      onStartPractice={() => {
        alert("Practice session started! Good luck on your exam.");
        router.push("/dashboard");
      }}
      onReviewQuestions={() => {
        alert("Navigating to question review.");
        router.push("/dashboard");
      }}
      onBack={() => {
        router.push("/dashboard");
      }}
    />
  );
}
