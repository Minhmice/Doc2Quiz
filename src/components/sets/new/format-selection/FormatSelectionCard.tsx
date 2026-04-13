"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle, ClipboardCheck, Info, Layers } from "lucide-react";
import { InteractiveTiltSurface } from "@/components/ui/card-7";

export type FormatSelectionCardProps = Readonly<{
  href: string;
  ariaLabel: string;
  title: string;
  eyebrow: string;
  features: readonly string[];
  outputHint: string;
  ctaLabel: string;
  variant: "quiz" | "flashcards";
}>;

function QuizPreview() {
  return (
    <div className="flex h-20 w-32 flex-col gap-1.5 rounded border border-border/20 bg-card/80 p-2 shadow-sm">
      <div className="h-1.5 w-full rounded-full bg-border/30" />
      <div className="mb-1 h-1.5 w-3/4 rounded-full bg-border/30" />
      <div className="flex items-center gap-1.5">
        <div className="size-2.5 rounded-full border border-chart-2" />
        <div className="h-1 w-8 rounded-full bg-chart-2/20" />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="size-2.5 rounded-full border border-border/40" />
        <div className="h-1 w-10 rounded-full bg-border/10" />
      </div>
    </div>
  );
}

function FlashcardsPreview() {
  return (
    <div className="flex h-20 w-32 gap-2 overflow-hidden">
      <div className="flex min-w-[80px] flex-col items-center justify-center rounded-sm border border-border/20 bg-card/80 p-2 shadow-sm">
        <div className="mb-1 h-1.5 w-8 rounded-full bg-border/40" />
        <div className="h-1.5 w-6 rounded-full bg-border/20" />
      </div>
      <div className="min-w-[80px] translate-y-2 rounded-sm border border-border/10 bg-card/50" />
    </div>
  );
}

export function FormatSelectionCard({
  href,
  ariaLabel,
  title,
  eyebrow,
  features,
  outputHint,
  ctaLabel,
  variant,
}: FormatSelectionCardProps) {
  const Icon = variant === "quiz" ? ClipboardCheck : Layers;

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="group relative block h-full min-h-[320px] cursor-pointer outline-none ring-offset-background transition-[box-shadow] duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <InteractiveTiltSurface className="h-full">
        <div className="relative flex h-full min-h-[inherit] flex-col overflow-hidden border border-border/10 bg-muted p-8 transition-[border-color,background-color,box-shadow] duration-300 group-hover:border-chart-2/20 group-hover:bg-secondary group-hover:shadow-lg">
          <div className="mb-6 flex items-start justify-between">
            <div className="flex size-12 items-center justify-center rounded-sm bg-accent">
              <Icon className="size-7 text-accent-foreground" strokeWidth={1.75} />
            </div>
            {variant === "quiz" ? <QuizPreview /> : <FlashcardsPreview />}
          </div>

          <h2 className="mb-1 font-heading text-2xl font-bold text-accent-foreground">
            {title}
          </h2>
          <p className="mb-4 font-label text-sm font-medium tracking-wider text-chart-2">
            {eyebrow}
          </p>

          <ul className="mb-8 space-y-3">
            {features.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 text-sm text-muted-foreground"
              >
                <CheckCircle
                  className="size-4 shrink-0 text-primary"
                  aria-hidden
                />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-auto">
            <div className="mb-4 flex items-center gap-2 font-label text-[10px] uppercase tracking-widest text-border">
              <Info className="size-3.5 shrink-0" aria-hidden />
              {outputHint}
            </div>
            <span className="flex w-full items-center justify-between bg-primary px-6 py-4 font-heading text-base font-bold text-primary-foreground shadow-sm transition-all duration-300 group-hover:bg-[var(--d2q-accent-hover)] group-hover:pr-7 group-hover:shadow-md">
              {ctaLabel}
              <ArrowRight
                className="size-5 shrink-0 transition-transform duration-300 ease-out group-hover:translate-x-1"
                aria-hidden
              />
            </span>
          </div>

          <div
            className="pointer-events-none absolute top-0 right-0 size-24 -translate-y-12 translate-x-12 rotate-45 bg-chart-2/5"
            aria-hidden
          />
        </div>
      </InteractiveTiltSurface>
    </Link>
  );
}
