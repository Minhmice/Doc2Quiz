"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Lucide `chart-line` paths — line stroke motion matches Animate UI chart-line icon. */
const PATH_AXES = "M3 3v16a2 2 0 0 0 2 2h16";
const PATH_LINE = "m19 9-5 5-4-4-3 3";

const easeInOut: [number, number, number, number] = [0.42, 0, 0.58, 1];

const lineVariantsAnimated = {
  rest: {
    opacity: 1,
    pathLength: 1,
    pathOffset: 0,
    transition: { duration: 0.35, ease: easeInOut },
  },
  hover: {
    opacity: [0, 1],
    pathLength: [0, 1],
    pathOffset: [1, 0],
    transition: {
      duration: 0.8,
      ease: easeInOut,
      opacity: { duration: 0.02, ease: easeInOut },
    },
  },
};

const lineVariantsStatic = {
  rest: { opacity: 1, pathLength: 1, pathOffset: 0 },
  hover: { opacity: 1, pathLength: 1, pathOffset: 0 },
};

export type AnimateUIChartLineIconProps = Readonly<{
  className?: string;
  disableAnimation?: boolean;
}>;

export function AnimateUIChartLineIcon({
  className,
  disableAnimation = false,
}: AnimateUIChartLineIconProps) {
  const lineVariants = disableAnimation
    ? lineVariantsStatic
    : lineVariantsAnimated;

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      variants={{ rest: {}, hover: {} }}
      className={cn("size-6 shrink-0", className)}
      aria-hidden
    >
      <path d={PATH_AXES} />
      <motion.path d={PATH_LINE} variants={lineVariants} />
    </motion.svg>
  );
}
