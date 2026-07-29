import Link from "next/link";
import { FormatSelectionCard } from "@/components/edit/new/format-selection/FormatSelectionCard";
import { FormatSelectionCardsGrid } from "@/components/edit/new/format-selection/FormatSelectionCardsGrid";
import { HowItWorksStrip } from "@/components/edit/new/format-selection/HowItWorksStrip";
import { NewStudySetFormatFooter } from "@/components/edit/new/format-selection/NewStudySetFormatFooter";
import { NewStudySetFormatHero } from "@/components/edit/new/format-selection/NewStudySetFormatHero";
import { createFlashcard, createQuiz } from "@/lib/routes/studySetPaths";

export default function CreatePage() {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <Link href="/dashboard" className="font-label text-sm text-chart-2">Back to Library</Link>
      <NewStudySetFormatHero />
      <HowItWorksStrip />
      <FormatSelectionCardsGrid>
        <FormatSelectionCard href={createQuiz()} ariaLabel="Create a quiz" title="Multiple choice" eyebrow="Best for testing knowledge" features={["Multiple-choice items", "Four options per item", "Active recall testing"]} outputHint="Output hint: generated questions" ctaLabel="Choose multiple choice" variant="quiz" />
        <FormatSelectionCard href={createFlashcard()} ariaLabel="Create flashcards" title="Flip study" eyebrow="Best for quick memorization" features={["Front & back sides", "Key terms & definitions", "Fast review sessions"]} outputHint="Output hint: recall cards" ctaLabel="Choose flip study" variant="flashcards" />
      </FormatSelectionCardsGrid>
      <NewStudySetFormatFooter />
    </main>
  );
}
