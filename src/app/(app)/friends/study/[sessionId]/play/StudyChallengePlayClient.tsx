"use client";

import { StudyChallengePractice } from "@/components/friends/StudyChallengePractice";
import { useLocale } from "@/components/locale/LocaleProvider";

export function StudyChallengePlayClient({ sessionId, attemptId }: { sessionId: string; attemptId: string }) {
  const { messages } = useLocale();
  if (!attemptId) return <main className="p-6">{messages.studyTogether.unavailable}</main>;
  return <StudyChallengePractice sessionId={sessionId} attemptId={attemptId} />;
}
