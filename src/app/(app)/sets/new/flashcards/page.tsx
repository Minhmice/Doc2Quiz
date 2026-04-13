import { redirect } from "next/navigation";
import { newFlashcards } from "@/lib/routes/studySetPaths";

export default function LegacyNewStudySetFlashcardsRedirectPage() {
  redirect(newFlashcards());
}
