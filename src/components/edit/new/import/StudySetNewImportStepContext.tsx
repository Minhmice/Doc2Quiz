"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export type StudySetNewImportStep = "upload" | "ingest";

const TAB_EASE = [0.22, 1, 0.36, 1] as const;
const TAB_DURATION_S = 0.22;

type StudySetNewImportStepContextValue = Readonly<{
  step: StudySetNewImportStep;
  setStep: (step: StudySetNewImportStep) => void;
}>;

const StudySetNewImportStepContext =
  React.createContext<StudySetNewImportStepContextValue | null>(null);

export function StudySetNewImportStepProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [step, setStep] = React.useState<StudySetNewImportStep>("upload");

  const value = React.useMemo(
    () => ({
      step,
      setStep,
    }),
    [step]
  );

  return (
    <StudySetNewImportStepContext.Provider value={value}>
      {children}
    </StudySetNewImportStepContext.Provider>
  );
}

export function useStudySetNewImportStep(): StudySetNewImportStepContextValue {
  const ctx = React.useContext(StudySetNewImportStepContext);
  if (!ctx) {
    throw new Error(
      "useStudySetNewImportStep must be used within StudySetNewImportStepProvider"
    );
  }
  return ctx;
}

/** For `NewStudySetPdfImportFlow` when used only inside a workbench with provider. */
export function useStudySetNewImportStepOptional() {
  return React.useContext(StudySetNewImportStepContext);
}

const tabTransition = (reduceMotion: boolean | null) =>
  reduceMotion
    ? { duration: 0 }
    : { duration: TAB_DURATION_S, ease: TAB_EASE };

export function ImportStepTabStrip({ className }: { className?: string }) {
  const { step } = useStudySetNewImportStep();
  const reduceMotion = useReducedMotion();
  const isIngest = step === "ingest";
  const t = tabTransition(reduceMotion);

  return (
    <div
      className={cn(
        "flex w-full min-w-[180px] max-w-[220px] flex-col gap-1 sm:max-w-xs",
        className
      )}
    >
      <span className="font-label text-[10px] font-bold text-muted-foreground">
        Progress
      </span>
      <div
        className="relative w-full"
        role="tablist"
        aria-label="Import progress"
      >
        <div className="grid w-full grid-cols-2 text-center font-label text-[11px] font-bold uppercase tracking-widest text-accent-foreground sm:text-xs">
          <motion.span
            role="tab"
            aria-selected={!isIngest}
            className="py-1.5"
            animate={
              !isIngest
                ? { opacity: 1, y: 0 }
                : { opacity: 0.6, y: 2 }
            }
            transition={t}
          >
            Upload
          </motion.span>
          <motion.span
            role="tab"
            aria-selected={isIngest}
            className="py-1.5"
            animate={
              isIngest
                ? { opacity: 1, y: 0 }
                : { opacity: 0.6, y: 2 }
            }
            transition={t}
          >
            Next step
          </motion.span>
        </div>
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-border/60"
          aria-hidden
        />
        <motion.div
          className="pointer-events-none absolute bottom-0 left-0 w-1/2 rounded-full bg-primary"
          aria-hidden
          style={{ height: 2 }}
          initial={false}
          animate={{ x: isIngest ? "100%" : "0%" }}
          transition={t}
        />
      </div>
    </div>
  );
}
