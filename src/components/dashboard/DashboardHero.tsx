"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { Transition } from "framer-motion";
import { Button } from "@/components/buttons/button";
import { Input } from "@/components/ui/input";
import {
  DISPLAY_NAME_MAX_LEN,
  useDisplayName,
} from "@/components/profile/DisplayNameProvider";
import {
  dashboardHeroAccentPrimaryLinkClassName,
  dashboardHeroBluePrimaryLinkClassName,
  dashboardHeroFirstSetLinkClassName,
  dashboardHeroOutlineCreateLinkClassName,
} from "@/lib/dashboard/createSetCtaLinks";
import {
  DASHBOARD_CREATE_FIRST_SET_LABEL,
  DASHBOARD_CREATE_NEW_SET_LABEL,
  DASHBOARD_HERO_PRACTICE_LABEL,
  DASHBOARD_HERO_REVIEW_LATEST_LABEL,
} from "@/lib/ui/studySetActionLabels";
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal";
import { cn } from "@/lib/utils";

/** Target wall time for intro (stagger ramp + per-glyph tween). */
const HEADLINE_OPEN_TOTAL_SEC = 2;
/** Per-glyph intro motion after its stagger delay (tween). */
const HEADLINE_INTRO_TWEEN_SEC = 0.38;
/** Stagger ramp budget so last glyph starts at ~(OPEN_TOTAL - TWEEN). */
const HEADLINE_OPEN_STAGGER_RAMP_SEC =
  HEADLINE_OPEN_TOTAL_SEC - HEADLINE_INTRO_TWEEN_SEC;

const HEADLINE_HOLD_MS = 1000;

/** Reverse vertical-cut “out” — shorter wall so the next line can appear quickly. */
const HEADLINE_EXIT_TOTAL_SEC = 0.85;
const HEADLINE_EXIT_TWEEN_SEC = 0.16;
const HEADLINE_EXIT_STAGGER_RAMP_SEC =
  HEADLINE_EXIT_TOTAL_SEC - HEADLINE_EXIT_TWEEN_SEC;

const HEADLINE_INTRO_TRANSITION: Transition = {
  type: "tween",
  duration: HEADLINE_INTRO_TWEEN_SEC,
  ease: [0.22, 1, 0.36, 1],
};

export type DashboardHeroProps = Readonly<{
  totalSets: number;
  setsNeedingEdits: number;
  setsWithApproved: number;
  resumePlayHref: string | null;
  editSetHref: string | null;
  createHref: string;
}>;

function useRotatingGreetingLine(greetingName: string) {
  const lines = useMemo(
    () => [
      `Welcome back, ${greetingName}!`,
      "Welcome back",
      "Ready to study?",
      "Build your first study set",
    ],
    [greetingName],
  );

  const [index, setIndex] = useState(0);

  const rotateToNextLine = useCallback(() => {
    setIndex((current) => {
      const len = lines.length;
      if (len <= 1) {
        return 0;
      }
      let next = Math.floor(Math.random() * len);
      while (next === current) {
        next = Math.floor(Math.random() * len);
      }
      return next;
    });
  }, [lines]);

  return { line: lines[index] ?? lines[0], rotateToNextLine };
}

function DisplayNamePromptRow() {
  const { setDisplayName, dismissPrompt, needsDisplayNamePrompt } =
    useDisplayName();
  const [nameInput, setNameInput] = useState("");

  if (!needsDisplayNamePrompt) {
    return null;
  }

  const save = () => {
    const trimmed = nameInput.trim().slice(0, DISPLAY_NAME_MAX_LEN);
    if (!trimmed) {
      return;
    }
    setDisplayName(trimmed);
    setNameInput("");
  };

  return (
    <div
      className="mt-5 border-t border-border/40 pt-5 text-center md:text-left"
      role="region"
      aria-label="Display name"
    >
      <p className="text-sm text-muted-foreground">
        What should we call you? (optional — used in greetings and your avatar
        initial.)
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <Input
          maxLength={DISPLAY_NAME_MAX_LEN}
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Your display name"
          aria-label="Display name"
          className="h-10 max-w-md sm:flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
        />
        <div className="flex shrink-0 justify-center gap-2 sm:justify-start">
          <Button type="button" variant="outline" size="sm" onClick={dismissPrompt}>
            Skip
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={!nameInput.trim()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DashboardHero({
  totalSets,
  setsNeedingEdits,
  setsWithApproved,
  resumePlayHref,
  editSetHref,
  createHref,
}: DashboardHeroProps) {
  const { displayName } = useDisplayName();
  const greetingName = displayName.trim() || "learner";
  const { line, rotateToNextLine } = useRotatingGreetingLine(greetingName);
  const isEmptyLibrary = totalSets === 0;

  const headlineStaggerDuration = useMemo(() => {
    const n = line.length;
    if (n <= 1) {
      return 0.2;
    }
    return HEADLINE_OPEN_STAGGER_RAMP_SEC / (n - 1);
  }, [line]);

  return (
    <section className="flex flex-col items-center justify-between gap-8 rounded-lg border border-border/20 bg-card p-8 shadow-sm md:flex-row">
      <div className="max-w-xl text-center md:text-left">
        <h2 className="mb-2 min-h-10 sm:min-h-12">
          <span className="inline-block w-full max-w-full md:block">
            <VerticalCutReveal
              key={line}
              splitBy="characters"
              staggerDuration={headlineStaggerDuration}
              transition={HEADLINE_INTRO_TRANSITION}
              postRevealExitReverse
              postRevealPolishDelayMs={HEADLINE_HOLD_MS}
              exitReverseDurationSeconds={HEADLINE_EXIT_TWEEN_SEC}
              exitReverseStaggerSpreadSeconds={HEADLINE_EXIT_STAGGER_RAMP_SEC}
              onExitReverseComplete={rotateToNextLine}
              className="justify-center font-heading text-3xl font-extrabold tracking-tight text-accent-foreground md:justify-start sm:text-4xl"
            >
              {line}
            </VerticalCutReveal>
          </span>
        </h2>
        <div className="mb-1 flex items-center justify-center gap-2 md:justify-start">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full bg-primary motion-reduce:animate-none",
              "animate-pulse",
            )}
            aria-hidden
          />
          <p className="text-sm font-medium text-muted-foreground sm:text-base">
            You have{" "}
            <span className="font-bold text-primary">
              {setsNeedingEdits}{" "}
              {setsNeedingEdits === 1 ? "set" : "sets"}
            </span>{" "}
            with new items ready to edit and{" "}
            <span className="font-bold text-[color:var(--d2q-blue)]">
              {setsWithApproved}{" "}
              {setsWithApproved === 1 ? "set" : "sets"}
            </span>{" "}
            ready to practice.
          </p>
        </div>
        <DisplayNamePromptRow />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 md:justify-end">
        {isEmptyLibrary ? (
          <Link
            href={createHref}
            className={cn(dashboardHeroFirstSetLinkClassName, "text-center")}
          >
            {DASHBOARD_CREATE_FIRST_SET_LABEL}
          </Link>
        ) : (
          <>
            {resumePlayHref ? (
              <Link
                href={resumePlayHref}
                className={dashboardHeroAccentPrimaryLinkClassName}
              >
                {DASHBOARD_HERO_PRACTICE_LABEL}
              </Link>
            ) : null}
            {editSetHref ? (
              <Link
                href={editSetHref}
                className={dashboardHeroBluePrimaryLinkClassName}
              >
                {DASHBOARD_HERO_REVIEW_LATEST_LABEL}
              </Link>
            ) : null}
            <Link
              href={createHref}
              className={dashboardHeroOutlineCreateLinkClassName}
            >
              {DASHBOARD_CREATE_NEW_SET_LABEL}
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
