"use client";

import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Zap, Flame, ShieldAlert, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Doc2QuizTransitionOverlayProps {
  /** Optional message override */
  message?: string;
  /** Additional custom class names */
  className?: string;
}

const TRANSITION_MESSAGES = [
  "LOCK THE FUCK IN.",
  "NEXT PAGE. MOVE.",
  "HỌC TIẾP ĐI BRO.",
  "NO REST. KEEP GRINDING.",
  "STOP SCROLLING. START COOKING.",
  "ĐỀ THI ĐANG CHỜ. TRUY CẬP NGAY.",
] as const;

const DEFAULT_SLOGAN = TRANSITION_MESSAGES[0];

export function Doc2QuizTransitionOverlay({
  message,
  className,
}: Doc2QuizTransitionOverlayProps) {
  const isReducedMotion = useReducedMotion();

  // Stable on SSR + first client paint; randomize after hydration only.
  const [selectedSlogan, setSelectedSlogan] = useState(() => message ?? DEFAULT_SLOGAN);

  useEffect(() => {
    if (message) {
      setSelectedSlogan(message);
      return;
    }
    const idx = Math.floor(Math.random() * TRANSITION_MESSAGES.length);
    setSelectedSlogan(TRANSITION_MESSAGES[idx] ?? DEFAULT_SLOGAN);
  }, [message]);

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center select-none overflow-hidden p-4",
        "bg-[#f7faf8] text-[#181c1b] backdrop-blur-md",
        "dark:bg-[#0c1a17] dark:text-[#ecfdf5]",
        className
      )}
    >
      <span className="sr-only">Loading page</span>

      {/* Background Blueprint Grid Pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-25 dark:opacity-20">
        <svg className="h-full w-full" width="100%" height="100%">
          <defs>
            <pattern id="bolder-transition-grid" width="36" height="36" patternUnits="userSpaceOnUse">
              <path d="M 36 0 L 0 0 0 36" fill="none" stroke="currentColor" strokeWidth="0.75" />
              <circle cx="36" cy="36" r="1.5" fill="currentColor" opacity="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#bolder-transition-grid)" />
        </svg>
      </div>

      {/* Animated Floating Study Note Fragments */}
      {!isReducedMotion && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
          <motion.div
            initial={{ x: -100, y: -60, rotate: -15, opacity: 0 }}
            animate={{ x: 40, y: 30, rotate: -6, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute left-8 top-12 rounded-xl border-2 border-[#181c1b] bg-white p-3 shadow-[4px_4px_0px_0px_#181c1b] dark:border-[#ecfdf5] dark:bg-[#134e4a]"
          >
            <div className="text-[10px] font-black uppercase text-[#5f0f00] dark:text-[#ff967d] font-label">SYLLABUS_V3</div>
            <div className="text-xs font-bold">O(N log N) Graph Scan</div>
          </motion.div>

          <motion.div
            initial={{ x: 100, y: 80, rotate: 15, opacity: 0 }}
            animate={{ x: -40, y: -20, rotate: 8, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            className="absolute right-12 bottom-16 rounded-xl border-2 border-[#181c1b] bg-white p-3 shadow-[4px_4px_0px_0px_#181c1b] dark:border-[#ecfdf5] dark:bg-[#134e4a]"
          >
            <div className="text-[10px] font-black uppercase text-[#5f0f00] dark:text-[#ff967d] font-label">EXAM_FUEL</div>
            <div className="text-xs font-bold">100% Lock In Mode</div>
          </motion.div>
        </div>
      )}

      {/* Multi-layer Ink Slash Sweeps Crossing Screen */}
      {!isReducedMotion && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0">
          <svg className="w-full h-64 max-w-5xl" viewBox="0 0 1000 300" fill="none" xmlns="http://www.w3.org/2000/svg">
            <motion.path
              d="M -100 240 Q 300 30, 600 150 T 1100 40"
              stroke="#ff967d"
              strokeWidth="16"
              strokeLinecap="round"
              opacity="0.75"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.45, ease: "easeInOut" }}
            />
            <motion.path
              d="M 1100 260 Q 700 60, 400 180 T -100 80"
              stroke="#5f0f00"
              strokeWidth="10"
              strokeLinecap="round"
              opacity="0.4"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, ease: "easeInOut", delay: 0.1 }}
            />
          </svg>
        </div>
      )}

      {/* Central Composition */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-6 max-w-lg w-full">
        
        {/* Pulsing Aura Card + Lightning Mark & Glitch Wordmark */}
        <motion.div
          initial={
            isReducedMotion
              ? { scale: 1 }
              : { scale: 0.8, skewX: -6, filter: "blur(6px)" }
          }
          animate={{ scale: 1, skewX: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.35, type: "spring", stiffness: 350, damping: 22 }}
          className="relative flex items-center gap-4 px-8 py-5 rounded-2xl border-4 border-[#5f0f00] bg-white shadow-[8px_8px_0px_0px_#5f0f00] dark:border-[#ff967d] dark:bg-[#134e4a] dark:shadow-[8px_8px_0px_0px_#ff967d]"
        >
          {/* Top Badge */}
          <div className="absolute -top-3.5 left-6 flex items-center gap-1.5 rounded border-2 border-[#181c1b] bg-[#ff967d] px-2.5 py-0.5 text-[10px] font-black uppercase text-[#5f0f00] font-label shadow-[2px_2px_0px_0px_#181c1b]">
            <ShieldAlert className="size-3.5" />
            <span>ROUTE_TRANSITION</span>
          </div>

          {/* Animated Lightning Icon */}
          <motion.span
            animate={
              isReducedMotion
                ? {}
                : {
                    scale: [1, 1.25, 0.95, 1.1, 1],
                    rotate: [0, -12, 8, -4, 0],
                  }
            }
            transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.8 }}
            className="flex size-14 items-center justify-center rounded-xl bg-[#5f0f00] text-white shadow-md dark:bg-[#ff967d] dark:text-[#0c1a17]"
          >
            <Zap className="size-8 fill-[#ff967d] dark:fill-[#0c1a17]" />
          </motion.span>

          {/* Wordmark with Glitch Cut Scale */}
          <div className="flex flex-col items-start">
            <span className="text-4xl sm:text-5xl font-black uppercase tracking-tighter font-label text-[#5f0f00] dark:text-[#ecfdf5] leading-none">
              Doc<span className="text-[#ff967d]">2</span>Quiz
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#404945] dark:text-[#34d399] font-label mt-1">
              SYSTEM ENGINE v3.8
            </span>
          </div>
        </motion.div>

        {/* High-Energy Indeterminate Striped Loading Bar */}
        <div className="relative h-3 w-64 sm:w-80 overflow-hidden rounded-lg border-2 border-[#181c1b] bg-white p-0.5 dark:border-[#ecfdf5] dark:bg-[#134e4a] shadow-[3px_3px_0px_0px_#181c1b]">
          <motion.div
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative h-full w-2/3 rounded bg-[#5f0f00] dark:bg-[#ff967d]"
          >
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(45deg, #ffffff 25%, transparent 25%, transparent 50%, #ffffff 50%, #ffffff 75%, transparent 75%, transparent)",
                backgroundSize: "16px 16px",
              }}
            />
          </motion.div>
        </div>

        {/* Aggressive Slogan Rubber Stamp Slam */}
        <motion.div
          initial={
            isReducedMotion
              ? { opacity: 0 }
              : { opacity: 0, scale: 1.4, rotate: -4, y: 16 }
          }
          animate={{ opacity: 1, scale: 1, rotate: -1, y: 0 }}
          transition={{ type: "spring", stiffness: 450, damping: 20, delay: 0.1 }}
          className="inline-flex items-center gap-2 rounded-xl border-3 border-[#181c1b] bg-[#5f0f00] px-5 py-2.5 text-base sm:text-lg font-black uppercase text-white font-label shadow-[5px_5px_0px_0px_#181c1b] dark:border-[#ecfdf5] dark:bg-[#ff967d] dark:text-[#0c1a17] dark:shadow-[5px_5px_0px_0px_#ecfdf5]"
        >
          <Flame className="size-5 text-[#ff967d] dark:text-[#5f0f00] animate-pulse" />
          <span>{selectedSlogan}</span>
        </motion.div>
      </div>
    </motion.div>
  );
}
