import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FormatSelectionCard } from "@/components/sets/new/format-selection/FormatSelectionCard";
import { FormatSelectionCardsGrid } from "@/components/sets/new/format-selection/FormatSelectionCardsGrid";
import { HowItWorksStrip } from "@/components/sets/new/format-selection/HowItWorksStrip";
import { NewStudySetFormatFooter } from "@/components/sets/new/format-selection/NewStudySetFormatFooter";
import { NewStudySetFormatHero } from "@/components/sets/new/format-selection/NewStudySetFormatHero";
import { newFlashcards, newQuiz } from "@/lib/routes/studySetPaths";

export default function NewStudySetChooserPage() {
  return (
    <div className="d2q-blueprint-grid min-h-screen bg-background text-foreground selection:bg-accent">
      <div
        className="pointer-events-none fixed top-0 left-0 hidden h-screen w-1 bg-chart-2/20 lg:block"
        aria-hidden
      />

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
            ariaLabel="Create quiz: multiple-choice questions for practice from a PDF"
            title="Create Quiz"
            eyebrow="Best for testing knowledge"
            features={[
              "Multiple-choice questions",
              "4 options per question",
              "Active recall testing",
            ]}
            outputHint="Output Hint: 12 MCQ questions with answers"
            ctaLabel="Choose Quiz"
            variant="quiz"
          />
          <FormatSelectionCard
            href={newFlashcards()}
            ariaLabel="Create flashcards: flip cards for quick review from a PDF"
            title="Create Flashcards"
            eyebrow="Best for quick memorization"
            features={[
              "Front & back study cards",
              "Key terms & definitions",
              "Fast review sessions",
            ]}
            outputHint="Output Hint: Concise card deck for recall"
            ctaLabel="Choose Flashcards"
            variant="flashcards"
          />
        </FormatSelectionCardsGrid>

        <NewStudySetFormatFooter />
      </main>
    </div>
  );
}
