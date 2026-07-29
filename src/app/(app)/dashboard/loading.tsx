"use client";

import { Doc2QuizTransitionOverlay } from "@/components/layout/Doc2QuizTransitionOverlay";

export default function DashboardLoadingFallback() {
  return <Doc2QuizTransitionOverlay message="LOADING YOUR STUDY DASHBOARD..." />;
}
