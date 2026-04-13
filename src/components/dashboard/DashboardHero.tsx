"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

const ROTATE_MS = 3000;

export type DashboardHeroProps = Readonly<{
  totalSets: number;
  setsWithDrafts: number;
  setsWithApproved: number;
  resumePlayHref: string | null;
  reviewDraftHref: string | null;
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

  useEffect(() => {
    const id = window.setInterval(() => {
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
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [lines]);

  return { line: lines[index] ?? lines[0] };
}

function DisplayNamePromptRow() {
  const { setDisplayName, dismissPrompt, needsDisplayNamePrompt } =
    useDisplayName();
  const [draft, setDraft] = useState("");

  if (!needsDisplayNamePrompt) {
    return null;
  }

  const save = () => {
    const trimmed = draft.trim().slice(0, DISPLAY_NAME_MAX_LEN);
    if (!trimmed) {
      return;
    }
    setDisplayName(trimmed);
    setDraft("");
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
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
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
          <Button type="button" size="sm" onClick={save} disabled={!draft.trim()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DashboardHero({
  totalSets,
  setsWithDrafts,
  setsWithApproved,
  resumePlayHref,
  reviewDraftHref,
  createHref,
}: DashboardHeroProps) {
  const { displayName } = useDisplayName();
  const greetingName = displayName.trim() || "learner";
  const { line } = useRotatingGreetingLine(greetingName);
  const isEmptyLibrary = totalSets === 0;

  return (
    <section className="flex flex-col items-center justify-between gap-8 rounded-lg border border-border/20 bg-card p-8 shadow-sm md:flex-row">
      <div className="max-w-xl text-center md:text-left">
        <h2 className="mb-2 min-h-10 font-heading text-3xl font-extrabold tracking-tight text-accent-foreground sm:min-h-12 sm:text-4xl">
          <span className="block">{line}</span>
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
              {setsWithDrafts}{" "}
              {setsWithDrafts === 1 ? "set" : "sets"}
            </span>{" "}
            with drafts to review and{" "}
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
            Create your first set
          </Link>
        ) : (
          <>
            {resumePlayHref ? (
              <Link
                href={resumePlayHref}
                className={dashboardHeroAccentPrimaryLinkClassName}
              >
                Resume latest
              </Link>
            ) : null}
            {reviewDraftHref ? (
              <Link
                href={reviewDraftHref}
                className={dashboardHeroBluePrimaryLinkClassName}
              >
                Review draft
              </Link>
            ) : null}
            <Link
              href={createHref}
              className={dashboardHeroOutlineCreateLinkClassName}
            >
              Create new set
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
