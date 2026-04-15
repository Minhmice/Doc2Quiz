"use client";

import { useEffect, useRef, useState } from "react";
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

/** Shared stat card chrome: subtle lift + border/bg on hover (motion-safe). */
const statCardHoverClass =
  "rounded-lg border border-border/40 bg-card transition-[transform,box-shadow,border-color,background-color] duration-[280ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] " +
  "hover:-translate-y-1 hover:border-border/80 hover:shadow-xl hover:shadow-foreground/[0.04] " +
  "dark:hover:shadow-black/40 motion-reduce:transition-[border-color,background-color] motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none";

const statCardInnerTransitionClass =
  "transition-colors duration-[280ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)]";
const statCardStreakValueTransitionClass =
  "transition-opacity duration-[280ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)]";

function useRafCountUp(
  to: number,
  {
    durationMs,
    reduceMotion,
    round = true,
  }: Readonly<{ durationMs: number; reduceMotion: boolean; round?: boolean }>,
) {
  const [value, setValue] = useState(() => (reduceMotion ? to : 0));
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduceMotion) {
      setValue(to);
      return;
    }

    const from = 0;
    const start = performance.now();

    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      // Ease-out cubic: snappy but not jarring for 800–1000ms.
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      setValue(round ? Math.round(next) : next);

      if (t < 1) {
        rafIdRef.current = requestAnimationFrame(tick);
      } else {
        rafIdRef.current = null;
      }
    };

    setValue(from);
    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = null;
    };
  }, [durationMs, reduceMotion, round, to]);

  return value;
}

function Ring({
  percent,
  reduceMotion,
}: Readonly<{ percent: number; reduceMotion: boolean }>) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const safePercent = Math.max(0, Math.min(100, percent));
  const animatedPercent = useRafCountUp(safePercent, {
    durationMs: 1400,
    reduceMotion,
    round: true,
  });
  const offset = c * (1 - animatedPercent / 100);

  return (
    <div
      className="relative size-10 shrink-0"
      aria-label={`Last 7 days activity about ${animatedPercent} percent`}
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
        {animatedPercent}%
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
  const reduceMotionBool = reduceMotion === true;
  const hoverEnabled = !reduceMotionBool;
  const [streakCardHovered, setStreakCardHovered] = useState(false);

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    show: {
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 30,
        mass: 1.05,
      },
    },
  } as const;

  const animatedTotalSets = useRafCountUp(totalSets, {
    durationMs: 1600,
    reduceMotion: reduceMotionBool,
    round: true,
  });
  const animatedStreakDays = useRafCountUp(streakDays, {
    durationMs: 1600,
    reduceMotion: reduceMotionBool,
    round: true,
  });
  const animatedWeeklyQuestions = useRafCountUp(weeklyQuestions, {
    durationMs: 1600,
    reduceMotion: reduceMotionBool,
    round: true,
  });

  return (
    <motion.section
      id="dashboard-stats"
      className="grid grid-cols-1 gap-4 md:grid-cols-3"
      aria-label="Study stats"
      initial={reduceMotionBool ? false : "hidden"}
      animate={reduceMotionBool ? undefined : "show"}
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: 0.14,
            delayChildren: 0.09,
          },
        },
      }}
    >
      <motion.div
        variants={itemVariants}
        className={`flex items-center gap-4 p-4 ${statCardHoverClass}`}
      >
        <div className="rounded-lg bg-[color:var(--d2q-blue)]/10 p-3 text-[color:var(--d2q-blue)]">
          <Layers animateOnHover={hoverEnabled} size={24} aria-hidden />
        </div>
        <div>
          <p className="font-label text-[10px] font-bold tracking-widest text-muted-foreground">
            Total assets
          </p>
          <p className="text-2xl font-black leading-none tracking-tight text-accent-foreground">
            {animatedTotalSets}{" "}
            <span className="text-xs font-bold text-[color:var(--d2q-blue)]">
              Sets
            </span>
          </p>
        </div>
      </motion.div>
      <motion.div
        variants={itemVariants}
        className={`group/streak flex items-center justify-between gap-4 p-4 ${statCardHoverClass}`}
        onMouseEnter={() => setStreakCardHovered(true)}
        onMouseLeave={() => setStreakCardHovered(false)}
      >
        <div className={`flex min-w-0 items-center gap-4 ${statCardInnerTransitionClass}`}>
          <StreakFlameChip isCardHovered={streakCardHovered} />
          <div className="min-w-0">
            <p
              className={`font-label text-[10px] font-bold tracking-widest text-muted-foreground ${statCardInnerTransitionClass} group-hover/streak:text-[color:var(--d2q-accent)]/80`}
            >
              Current streak
            </p>
            <p
              className={`text-2xl font-black leading-none tracking-tight text-[color:var(--d2q-accent)] opacity-95 ${statCardStreakValueTransitionClass} group-hover/streak:opacity-100`}
            >
              {animatedStreakDays}{" "}
              {animatedStreakDays === 1 ? "day" : "days"}
            </p>
          </div>
        </div>
        <Ring percent={streakRingPercent} reduceMotion={reduceMotionBool} />
      </motion.div>
      <motion.div
        variants={itemVariants}
        className={`flex items-center gap-4 p-4 ${statCardHoverClass}`}
      >
        <div className="rounded-lg bg-accent-foreground/10 p-3 text-accent-foreground">
          <AnimateUIChartLineIcon disableAnimation={!hoverEnabled} />
        </div>
        <div>
          <p className="font-label text-[10px] font-bold tracking-widest text-muted-foreground">
            Weekly activity
          </p>
          <p className="text-lg font-bold leading-none text-accent-foreground">
            {animatedWeeklyQuestions}{" "}
            <span className="text-[10px] font-medium text-[color:var(--d2q-blue)]">
              Qs this week
            </span>
          </p>
        </div>
      </motion.div>
    </motion.section>
  );
}
