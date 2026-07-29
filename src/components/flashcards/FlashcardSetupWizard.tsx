"use client";

import { useMemo, useState } from "react";

import { useLocale } from "@/components/locale/LocaleProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { FlashcardGenerateBody } from "@/lib/pipeline/flashcardSchemas";
import { cn } from "@/lib/utils";

export type FlashcardWizardSection = Readonly<{
  sectionKey: string;
  heading: string;
}>;

export type FlashcardSetupWizardProps = Readonly<{
  sections: FlashcardWizardSection[];
  onSubmit: (body: FlashcardGenerateBody) => void;
  onCancel: () => void;
  initialStep?: 1 | 2 | 3;
}>;

type LearningGoal = FlashcardGenerateBody["learningGoal"];
type CoverageMode = "entire_document" | "selected_sections";
type AmountMode = "recommended" | "custom";

const LEARNING_GOALS: ReadonlyArray<{
  value: LearningGoal;
  label: string;
  sublabel: string;
}> = [
  {
    value: "memorize",
    label: "Memorize",
    sublabel: "Terms, definitions, and quick facts",
  },
  {
    value: "understand",
    label: "Understand",
    sublabel: "Concepts, relationships, and explanations",
  },
  {
    value: "exam_preparation",
    label: "Exam preparation",
    sublabel: "High-yield material for test day",
  },
];

function stepCopy(step: 1 | 2 | 3): {
  eyebrow: string;
  headline: string;
  helper: string;
} {
  if (step === 1) {
    return {
      eyebrow: "Flashcard setup · Step 1 of 3",
      headline: "What's your learning goal?",
      helper:
        "This shapes how cards are written — not which topics are included.",
    };
  }
  if (step === 2) {
    return {
      eyebrow: "Flashcard setup · Step 2 of 3",
      headline: "What should the cards cover?",
      helper: "Choose the full document or specific sections.",
    };
  }
  return {
    eyebrow: "Flashcard setup · Step 3 of 3",
    headline: "How many cards do you want?",
    helper:
      "Recommended fits your document size. Custom must be between 5 and 60.",
  };
}

function buildSubmitBody(
  learningGoal: LearningGoal | null,
  coverageMode: CoverageMode,
  selectedSectionKeys: string[],
  amountMode: AmountMode,
  customCount: string,
): FlashcardGenerateBody | null {
  if (!learningGoal) {
    return null;
  }

  const coverage: FlashcardGenerateBody["coverage"] =
    coverageMode === "entire_document"
      ? "entire_document"
      : { sectionKeys: selectedSectionKeys };

  let amount: FlashcardGenerateBody["amount"] = "recommended";
  if (amountMode === "custom") {
    const count = Number.parseInt(customCount, 10);
    if (!Number.isFinite(count) || count < 5 || count > 60) {
      return null;
    }
    amount = { count };
  }

  return { learningGoal, coverage, amount };
}

export function FlashcardSetupWizard({
  sections,
  onSubmit,
  onCancel,
  initialStep = 1,
}: FlashcardSetupWizardProps) {
  const { messages } = useLocale();
  const wizard = messages.workflows.wizard;
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
  const [learningGoal, setLearningGoal] = useState<LearningGoal | null>(null);
  const [coverageMode, setCoverageMode] =
    useState<CoverageMode>("entire_document");
  const [selectedSectionKeys, setSelectedSectionKeys] = useState<string[]>([]);
  const [amountMode, setAmountMode] = useState<AmountMode>("recommended");
  const [customCount, setCustomCount] = useState("20");
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [countError, setCountError] = useState<string | null>(null);

  const copy = step === 1 ? wizard.steps.one : step === 2 ? wizard.steps.two : wizard.steps.three;
  const learningGoals = LEARNING_GOALS.map((goal) => ({ ...goal, ...wizard.goals[goal.value] }));

  const selectableSections = useMemo(
    () =>
      sections.filter(
        (section) =>
          section.sectionKey.trim().length > 0 && section.heading.trim().length > 0,
      ),
    [sections],
  );

  const customCountValid = useMemo(() => {
    if (amountMode !== "custom") {
      return true;
    }
    const count = Number.parseInt(customCount, 10);
    return Number.isFinite(count) && count >= 5 && count <= 60;
  }, [amountMode, customCount]);

  const step2Valid =
    coverageMode === "entire_document" ||
    (coverageMode === "selected_sections" && selectedSectionKeys.length > 0);

  const canContinue =
    (step === 1 && learningGoal != null) ||
    (step === 2 && step2Valid) ||
    (step === 3 && customCountValid);

  const handleBack = () => {
    if (step === 1) {
      onCancel();
      return;
    }
    setStep((s) => (s === 2 ? 1 : 2));
    setSectionError(null);
    setCountError(null);
  };

  const handleContinue = () => {
    if (step === 1) {
      if (!learningGoal) {
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (coverageMode === "selected_sections" && selectedSectionKeys.length === 0) {
        setSectionError(wizard.selectSectionError);
        return;
      }
      setSectionError(null);
      setStep(3);
      return;
    }

    if (!customCountValid) {
      setCountError(wizard.countError);
      return;
    }
    setCountError(null);

    const body = buildSubmitBody(
      learningGoal,
      coverageMode,
      selectedSectionKeys,
      amountMode,
      customCount,
    );
    if (body) {
      onSubmit(body);
    }
  };

  const toggleSection = (sectionKey: string, checked: boolean) => {
    setSelectedSectionKeys((prev) => {
      if (checked) {
        return prev.includes(sectionKey) ? prev : [...prev, sectionKey];
      }
      return prev.filter((key) => key !== sectionKey);
    });
    setSectionError(null);
  };

  return (
    <section
      className="rounded-xl bg-card/60 p-4 ring-1 ring-foreground/10 sm:p-5"
      aria-labelledby="flashcard-wizard-headline"
    >
      <p className="font-label text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
        {copy.eyebrow}
      </p>
      <h2
        id="flashcard-wizard-headline"
        className="mt-2 font-heading text-2xl font-extrabold tracking-tight"
      >
        {copy.headline}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{copy.helper}</p>

      <div className="mt-6 space-y-4">
        {step === 1 ? (
          <RadioGroup
            value={learningGoal ?? ""}
            onValueChange={(value) => setLearningGoal(value as LearningGoal)}
            className="space-y-2"
          >
            {learningGoals.map((option) => {
              const id = `flashcard-goal-${option.value}`;
              const selected = learningGoal === option.value;
              return (
                <Label
                  key={option.value}
                  htmlFor={id}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-3 ring-1 ring-transparent hover:bg-muted/40",
                    selected && "border-primary/40 ring-2 ring-primary",
                  )}
                >
                  <RadioGroupItem id={id} value={option.value} className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-extrabold text-foreground">
                      {option.label}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {option.sublabel}
                    </span>
                  </span>
                </Label>
              );
            })}
          </RadioGroup>
        ) : null}

        {step === 2 ? (
          <fieldset className="space-y-4">
            <legend className="sr-only">{wizard.coverage}</legend>
            <RadioGroup
              value={coverageMode}
              onValueChange={(value) => {
                setCoverageMode(value as CoverageMode);
                setSectionError(null);
              }}
              className="space-y-2"
            >
              {(
                [
                  { value: "entire_document", label: wizard.entireDocument },
                  { value: "selected_sections", label: wizard.selectedSections },
                ] as const
              ).map((option) => {
                const id = `flashcard-coverage-${option.value}`;
                const selected = coverageMode === option.value;
                return (
                  <Label
                    key={option.value}
                    htmlFor={id}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border/60 p-3 ring-1 ring-transparent hover:bg-muted/40",
                      selected && "border-primary/40 ring-2 ring-primary",
                    )}
                  >
                    <RadioGroupItem id={id} value={option.value} />
                    <span className="text-sm font-extrabold">{option.label}</span>
                  </Label>
                );
              })}
            </RadioGroup>

            {coverageMode === "selected_sections" ? (
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border/50 p-3">
                {selectableSections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {wizard.noSections}
                  </p>
                ) : (
                  selectableSections.map((section) => {
                    const id = `flashcard-section-${section.sectionKey}`;
                    const checked = selectedSectionKeys.includes(section.sectionKey);
                    return (
                      <Label
                        key={section.sectionKey}
                        htmlFor={id}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-muted/40"
                      >
                        <Checkbox
                          id={id}
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleSection(section.sectionKey, value === true)
                          }
                        />
                        <span className="text-sm">{section.heading}</span>
                      </Label>
                    );
                  })
                )}
                {sectionError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {sectionError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </fieldset>
        ) : null}

        {step === 3 ? (
          <fieldset className="space-y-4">
            <legend className="sr-only">{wizard.amount}</legend>
            <RadioGroup
              value={amountMode}
              onValueChange={(value) => {
                setAmountMode(value as AmountMode);
                setCountError(null);
              }}
              className="space-y-2"
            >
              {(
                [
                  { value: "recommended", label: wizard.recommended },
                  { value: "custom", label: wizard.custom },
                ] as const
              ).map((option) => {
                const id = `flashcard-amount-${option.value}`;
                const selected = amountMode === option.value;
                return (
                  <Label
                    key={option.value}
                    htmlFor={id}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border/60 p-3 ring-1 ring-transparent hover:bg-muted/40",
                      selected && "border-primary/40 ring-2 ring-primary",
                    )}
                  >
                    <RadioGroupItem id={id} value={option.value} />
                    <span className="text-sm font-extrabold">{option.label}</span>
                  </Label>
                );
              })}
            </RadioGroup>

            {amountMode === "custom" ? (
              <div className="space-y-2">
                <Label htmlFor="flashcard-custom-count" className="text-sm">
                  {wizard.cardCount}
                </Label>
                <Input
                  id="flashcard-custom-count"
                  type="number"
                  min={5}
                  max={60}
                  placeholder={wizard.countPlaceholder}
                  value={customCount}
                  onChange={(e) => {
                    setCustomCount(e.target.value);
                    setCountError(null);
                  }}
                  aria-invalid={!customCountValid}
                />
                {countError || !customCountValid ? (
                  <p className="text-sm text-destructive" role="alert">
                    {countError ?? wizard.countError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </fieldset>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={handleBack}>
          {wizard.back}
        </Button>
        {step < 3 ? (
          <Button type="button" disabled={!canContinue} onClick={handleContinue}>
            {wizard.continue}
          </Button>
        ) : (
          <Button type="button" disabled={!canContinue} onClick={handleContinue}>
            {wizard.generate}
          </Button>
        )}
      </div>
    </section>
  );
}
