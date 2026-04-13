import { redirect } from "next/navigation";
import { newQuiz } from "@/lib/routes/studySetPaths";

export default function LegacyNewStudySetQuizRedirectPage() {
  redirect(newQuiz());
}
