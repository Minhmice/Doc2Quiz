"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.42,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

const itemReduced = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
};

export function FormatSelectionCardsGrid({
  children,
}: {
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const childVariants = React.useMemo(
    () => (reduceMotion ? itemReduced : item),
    [reduceMotion]
  );

  return (
    <motion.div
      className="relative z-10 grid grid-cols-1 gap-8 md:grid-cols-2"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {React.Children.map(children, (child, index) => (
        <motion.div
          key={index}
          className="min-h-0"
          variants={childVariants}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
