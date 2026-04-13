"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Layers } from "@/components/animate-ui/icons/layers";
import { AnimateUIChartLineIcon } from "@/components/dashboard/AnimateUIChartLineIcon";
import { StreakFlameChip } from "@/components/dashboard/StreakFlameChip";

export type DashboardStatsRowProps = Readonly<{
  totalSets: number;
  streakDays: number;
  streakRingPercent: number;
  weeklyQuestions: number;
}>;

const statCardParentVariants = {
  rest: {},
  hover: {},
} as const;

/** Shared stat card chrome: subtle lift + border/bg on hover (motion-safe). */
const statCardHoverClass =
  "rounded-lg border border-border/30 bg-card transition-[transform,box-shadow,border-color,background-color] duration-[420ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] " +
  "hover:-translate-y-px hover:border-border/55 hover:bg-muted/10 hover:shadow-md hover:shadow-foreground/[0.06] " +
  "dark:hover:shadow-black/20 motion-reduce:transition-[border-color,background-color] motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none";

function Ring({ percent }: Readonly<{ percent: number }>) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - percent / 100);
  return (
    <div
      className="relative size-10 shrink-0"
      aria-label={`Last 7 days activity about ${percent} percent`}
    >
      <svg className="size-full -rotate-90" viewBox="0 0 40 40" aria-hidden>
        <circle
          className="text-muted"
          cx="20"
          cy="20"
          fill="transparent"
          r={r}
          stroke="currentColor"
          strokeWidth="4"
        />
        <circle
          className="text-[color:var(--d2q-accent)]"
          cx="20"
          cy="20"
          fill="transparent"
          r={r}
          stroke="currentColor"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="4"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-label text-[8px] font-bold text-foreground">
        {percent}%
      </span>
    </div>
  );
}

export function DashboardStatsRow({
  totalSets,
  streakDays,
  streakRingPercent,
  weeklyQuestions,
}: DashboardStatsRowProps) {
  const reduceMotion = useReducedMotion();
  const hoverEnabled = reduceMotion !== true;
  const [streakCardHovered, setStreakCardHovered] = useState(false);

  return (
    <section
      id="dashboard-stats"
      className="grid grid-cols-1 gap-4 md:grid-cols-3"
      aria-label="Study stats"
    >
      <div
        className={`flex items-center gap-4 p-4 ${statCardHoverClass}`}
      >
        <div className="rounded-lg bg-[color:var(--d2q-blue)]/10 p-3 text-[color:var(--d2q-blue)]">
          <Layers animateOnHover={hoverEnabled} size={24} aria-hidden />
        </div>
        <div>
          <p className="font-label text-[10px] tracking-widest text-muted-foreground">
            Total assets
          </p>
          <p className="text-2xl font-black leading-none tracking-tight text-accent-foreground">
            {totalSets}{" "}
            <span className="text-xs font-bold text-[color:var(--d2q-blue)]">
              Sets
            </span>
          </p>
        </div>
      </div>
      <motion.div
        className={`group/streak flex items-center justify-between gap-4 p-4 ${statCardHoverClass}`}
        variants={statCardParentVariants}
        initial="rest"
        animate="rest"
        whileHover={hoverEnabled ? "hover" : undefined}
        onMouseEnter={() => setStreakCardHovered(true)}
        onMouseLeave={() => setStreakCardHovered(false)}
      >
        <div className="flex min-w-0 items-center gap-4 transition-colors duration-[420ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)]">
          <StreakFlameChip isCardHovered={streakCardHovered} />
          <div className="min-w-0">
            <p className="font-label text-[10px] tracking-widest text-muted-foreground transition-colors duration-[420ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover/streak:text-[color:var(--d2q-accent)]/80">
              Current streak
            </p>
            <p className="text-2xl font-black leading-none tracking-tight text-[color:var(--d2q-accent)] opacity-95 transition-opacity duration-[420ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover/streak:opacity-100">
              {streakDays} {streakDays === 1 ? "day" : "days"}
            </p>
          </div>
        </div>
        <Ring percent={streakRingPercent} />
      </motion.div>
      <motion.div
        className={`flex items-center gap-4 p-4 ${statCardHoverClass}`}
        variants={statCardParentVariants}
        initial="rest"
        animate="rest"
        whileHover={hoverEnabled ? "hover" : undefined}
      >
        <div className="rounded-lg bg-accent-foreground/10 p-3 text-accent-foreground">
          <AnimateUIChartLineIcon disableAnimation={!hoverEnabled} />
        </div>
        <div>
          <p className="font-label text-[10px] tracking-widest text-muted-foreground">
            Weekly activity
          </p>
          <p className="text-lg font-bold leading-none text-accent-foreground">
            {weeklyQuestions}{" "}
            <span className="text-[10px] font-medium text-[color:var(--d2q-blue)]">
              Qs this week
            </span>
          </p>
        </div>
      </motion.div>
    </section>
  );
}
