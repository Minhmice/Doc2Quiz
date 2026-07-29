"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Three user-facing import phases (text → review). */
export type StudySetNewImportStep = "upload" | "read" | "generate";

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

/** For text import flows when used only inside a workbench with provider. */
export function useStudySetNewImportStepOptional() {
  return React.useContext(StudySetNewImportStepContext);
}

const tabTransition = (reduceMotion: boolean | null) =>
  reduceMotion
    ? { duration: 0 }
    : { duration: TAB_DURATION_S, ease: TAB_EASE };

const PHASE_LABELS: Record<StudySetNewImportStep, string> = {
  upload: "Add source",
  read: "Convert",
  generate: "Review",
};

export function ImportStepTabStrip({ className }: { className?: string }) {
  const { step } = useStudySetNewImportStep();
  const reduceMotion = useReducedMotion();
  const idx = step === "upload" ? 0 : step === "read" ? 1 : 2;
  const t = tabTransition(reduceMotion);

  return (
    <div
      className={cn(
        "flex w-full min-w-[220px] max-w-xl flex-col gap-1",
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
        <div className="grid w-full grid-cols-3 text-center font-label text-[10px] font-bold uppercase tracking-widest sm:text-[11px]">
          {(["upload", "read", "generate"] as const).map((key, i) => {
            const isActive = idx === i;
            const isComplete = i < idx;

            return (
              <motion.span
                key={key}
                role="tab"
                aria-selected={isActive}
                data-active={isActive ? "true" : "false"}
                className={cn(
                  "d2q-import-phase px-0.5 py-1.5 leading-tight sm:px-1",
                  isActive && "font-extrabold text-primary",
                  isComplete && !isActive && "text-foreground/80",
                  !isActive && !isComplete && "text-muted-foreground",
                )}
                animate={
                  isActive
                    ? { opacity: 1, y: 0, scale: 1 }
                    : { opacity: isComplete ? 0.85 : 0.6, y: 1, scale: 1 }
                }
                whileHover={
                  reduceMotion || isActive
                    ? undefined
                    : { opacity: 1, y: 0, scale: 1.03 }
                }
                transition={t}
              >
                {PHASE_LABELS[key]}
              </motion.span>
            );
          })}
        </div>
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-border/60"
          aria-hidden
        />
        <motion.div
          className="pointer-events-none absolute bottom-0 left-0 w-1/3 rounded-full bg-primary shadow-[0_0_12px_0_color-mix(in_srgb,var(--primary)_35%,transparent)]"
          aria-hidden
          style={{ height: 3 }}
          initial={false}
          animate={{ x: `${idx * 100}%` }}
          transition={t}
        />
      </div>
    </div>
  );
}
