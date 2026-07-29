import { Suspense } from "react";
import { StudySetCreateWizard } from "@/components/create/StudySetCreateWizard";

export default function FlashcardCreatePage() {
  return (
    <Suspense fallback={null}>
      <StudySetCreateWizard contentKind="flashcards" />
    </Suspense>
  );
}
