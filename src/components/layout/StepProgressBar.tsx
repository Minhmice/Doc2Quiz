"use client";

import Link from "next/link";
import { Fragment } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type StudyFlowStep = "source" | "review" | "play" | "done";

const STEPS: { id: StudyFlowStep; label: string; pathSuffix: string }[] = [
  { id: "source", label: "1. Source", pathSuffix: "/source" },
  { id: "review", label: "2. Review", pathSuffix: "/review" },
  { id: "play", label: "3. Quiz", pathSuffix: "/play" },
  { id: "done", label: "4. Done", pathSuffix: "/done" },
];

function currentStepFromPathname(pathname: string): StudyFlowStep {
  if (pathname.includes("/review")) {
    return "review";
  }
  if (
    pathname.includes("/play") ||
    pathname.includes("/practice") ||
    pathname.includes("/flashcards")
  ) {
    return "play";
  }
  if (pathname.includes("/done")) {
    return "done";
  }
  return "source";
}

export function StepProgressBar({ studySetId }: { studySetId: string }) {
  const pathname = usePathname();
  const currentStep = currentStepFromPathname(pathname);
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <nav
      className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-0"
      aria-label="Study set progress"
    >
      {STEPS.map((step, idx) => {
        const isCurrent = step.id === currentStep;
        const isPast = idx < currentIndex;
        const href = `/sets/${studySetId}${step.pathSuffix}`;
        const clickable = isPast || isCurrent;

        return (
          <Fragment key={step.id}>
            {idx > 0 ? (
              <div
                className={cn(
                  "mx-2 hidden h-px min-w-[1rem] flex-1 sm:block",
                  isPast ? "bg-primary" : "bg-border",
                )}
                aria-hidden
              />
            ) : null}
            {clickable ? (
              <Link
                href={href}
                className={cn(
                  "inline-flex shrink-0 items-center justify-center rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors",
                  isCurrent &&
                    "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20",
                  isPast &&
                    !isCurrent &&
                    "text-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {step.label}
              </Link>
            ) : (
              <span
                className="inline-flex shrink-0 cursor-not-allowed items-center justify-center rounded-lg px-3 py-2 text-center text-sm font-medium text-muted-foreground opacity-70"
                aria-disabled="true"
              >
                {step.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
