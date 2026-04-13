"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

/** ease-out curve from motion spec */
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Idle cycle length (2.4s–3.2s band) */
const IDLE_DURATION_S = 2.8;

/**
 * Idle beat: ~0–70% still, 70–82% scale + glow, 82–92% flame wiggle, 92–100% settle.
 * Values are normalized segment endpoints.
 */
const IDLE_TIMES = [0, 0.7, 0.82, 0.92, 1] as const;

export type StreakFlameChipProps = Readonly<{
  className?: string;
  /** True when pointer is anywhere on the parent streak stat card */
  isCardHovered: boolean;
}>;

export function StreakFlameChip({
  className,
  isCardHovered,
}: StreakFlameChipProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg p-3 text-[color:var(--d2q-accent)] transition-colors duration-[420ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
          isCardHovered
            ? "bg-[color:var(--d2q-accent)]/24"
            : "bg-[color:var(--d2q-accent)]/15",
          className,
        )}
      >
        <Flame className="size-6" aria-hidden />
      </div>
    );
  }

  const idleRepeat = {
    duration: IDLE_DURATION_S,
    repeat: Infinity,
    times: [...IDLE_TIMES] as number[],
    ease: EASE_OUT,
  };

  const hoverTransition = {
    duration: 0.32,
    ease: EASE_OUT,
  };

  /** Slow hover loop: gentle wiggle + slight “pop up” (y), compact amplitude. */
  const hoverFlameWiggle = {
    rotate: [-2.5, 2.5, -2.5],
    y: [0, -2.25, 0],
    transition: {
      duration: 2.55,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  };

  return (
    <motion.div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg p-3 text-[color:var(--d2q-accent)] transition-colors duration-[420ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
        isCardHovered
          ? "bg-[color:var(--d2q-accent)]/24"
          : "bg-[color:var(--d2q-accent)]/15",
        className,
      )}
      style={{ transformOrigin: "50% 55%" }}
      animate={
        isCardHovered
          ? { scale: 1.03, transition: hoverTransition }
          : {
              scale: [1, 1, 1.04, 1.015, 1],
              transition: idleRepeat,
            }
      }
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-lg bg-[color:var(--d2q-accent)]"
        style={{ filter: "blur(12px)" }}
        initial={false}
        animate={
          isCardHovered
            ? { opacity: 0.12, transition: hoverTransition }
            : {
                opacity: [0, 0, 0.16, 0.06, 0],
                transition: idleRepeat,
              }
        }
      />
      <motion.div
        className="relative flex size-6 items-center justify-center"
        style={{ transformOrigin: "50% 85%" }}
        animate={
          isCardHovered
            ? hoverFlameWiggle
            : {
                rotate: [0, 0, -3.5, 3.2, 0],
                transition: idleRepeat,
              }
        }
      >
        <Flame className="size-6" aria-hidden />
      </motion.div>
    </motion.div>
  );
}
