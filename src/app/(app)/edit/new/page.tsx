import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FormatSelectionCard } from "@/components/edit/new/format-selection/FormatSelectionCard";
import { FormatSelectionCardsGrid } from "@/components/edit/new/format-selection/FormatSelectionCardsGrid";
import { HowItWorksStrip } from "@/components/edit/new/format-selection/HowItWorksStrip";
import { NewStudySetFormatFooter } from "@/components/edit/new/format-selection/NewStudySetFormatFooter";
import { NewStudySetFormatHero } from "@/components/edit/new/format-selection/NewStudySetFormatHero";
import { newFlashcards, newQuiz } from "@/lib/routes/studySetPaths";

export default function NewStudySetChooserPage() {
  return (
    <div>
      <header className="mx-auto w-full max-w-[1440px] px-4 pt-8 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="group inline-flex cursor-pointer items-center gap-2 font-label text-sm font-medium tracking-widest text-chart-2 uppercase transition-colors duration-300 active:scale-95"
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden />
          <span className="border-b border-transparent transition-colors group-hover:border-chart-2">
            Back to Library
          </span>
        </Link>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[1440px] px-4 pt-8 pb-16 sm:px-6 lg:px-8">
        <NewStudySetFormatHero />
        <HowItWorksStrip />

        <FormatSelectionCardsGrid>
          <FormatSelectionCard
            href={newQuiz()}
            ariaLabel="Create a multiple-choice study set from a PDF for practice"
            title="Multiple choice"
            eyebrow="Best for testing knowledge"
            features={[
              "Multiple-choice items",
              "Four options per item",
              "Active recall testing",
            ]}
            outputHint="Output hint: ~12 MCQ items with answers"
            ctaLabel="Choose multiple choice"
            variant="quiz"
          />
          <FormatSelectionCard
            href={newFlashcards()}
            ariaLabel="Create flip study content from a PDF for quick review"
            title="Flip study"
            eyebrow="Best for quick memorization"
            features={[
              "Front & back sides",
              "Key terms & definitions",
              "Fast review sessions",
            ]}
            outputHint="Output hint: concise items for recall"
            ctaLabel="Choose flip study"
            variant="flashcards"
          />
        </FormatSelectionCardsGrid>

        <NewStudySetFormatFooter />
      </main>
    </div>
  );
}
