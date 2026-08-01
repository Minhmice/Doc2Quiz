"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GlobalNavigationLoadingScreenProps {
  /** Optional custom text or message override */
  message?: string;
  /** Additional custom class names */
  className?: string;
}

// Random aggressive study messages (Rotates every 1–2 seconds, no immediate repeats)
const TRANSITION_SLOGANS = [
  "LOCK THE FUCK IN.",
  "MOVE. THE GRIND IS WAITING.",
  "LÀM TIẾP ĐI. ĐỪNG LƯỜI.",
  "STOP SCROLLING. START COOKING.",
  "HỌC ĐI BRO.",
  "10 CÂU NỮA. NHANH.",
] as const;

export function GlobalNavigationLoadingScreen({
  message,
  className,
}: GlobalNavigationLoadingScreenProps) {
  const [sloganIndex, setSloganIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const isReducedMotion = useReducedMotion();
  const previousIndexRef = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Rotate slogan every 1000ms - 2000ms without consecutive repetition
  useEffect(() => {
    let timer: NodeJS.Timeout;

    const scheduleNextSlogan = () => {
      const delay = Math.floor(Math.random() * 1000) + 1000; // 1s to 2s
      timer = setTimeout(() => {
        setSloganIndex((prev) => {
          let nextIndex: number;
          do {
            nextIndex = Math.floor(Math.random() * TRANSITION_SLOGANS.length);
          } while (nextIndex === prev && TRANSITION_SLOGANS.length > 1);
          previousIndexRef.current = nextIndex;
          return nextIndex;
        });
        scheduleNextSlogan();
      }, delay);
    };

    scheduleNextSlogan();

    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return null;
  }

  const currentSlogan = message || TRANSITION_SLOGANS[sloganIndex];

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={
        isReducedMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.96 }
      }
      animate={{ opacity: 1, scale: 1 }}
      exit={
        isReducedMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 1.04, filter: "blur(4px)" }
      }
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center select-none overflow-hidden p-4",
        "bg-[#f7faf8]/90 text-[#181c1b] backdrop-blur-md",
        "dark:bg-[#0c1a17]/90 dark:text-[#ecfdf5]",
        className
      )}
    >
      {/* Screen Reader Only Notification */}
      <span className="sr-only">Loading page</span>

      {/* Blueprint Grid Background Pattern */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-20 dark:opacity-15">
        <svg className="h-full w-full" width="100%" height="100%">
          <defs>
            <pattern id="global-loading-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="0.75" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#global-loading-grid)" />
        </svg>
      </div>

      {/* Main Composition Box */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-6 max-w-lg w-full">
        
        {/* Oversized Wordmark + Lightning Icon */}
        <div className="relative flex flex-col items-center justify-center">
          
          {/* Card Slice / Background Card */}
          <div className="absolute -inset-4 rounded-2xl border-2 border-[#5f0f00] bg-white/80 dark:border-[#ff967d] dark:bg-[#134e4a]/80 shadow-[6px_6px_0px_0px_#5f0f00] dark:shadow-[6px_6px_0px_0px_#ff967d] rotate-[-1deg]" />

          <div className="relative z-10 flex items-center gap-3 px-6 py-4">
            <motion.span
              animate={
                isReducedMotion
                  ? {}
                  : {
                      rotate: [0, -6, 6, -3, 0],
                      scale: [1, 1.1, 0.95, 1],
                    }
              }
              transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1.2 }}
              className="flex size-12 items-center justify-center rounded-xl bg-[#5f0f00] text-white shadow-md dark:bg-[#ff967d] dark:text-[#0c1a17]"
            >
              <Zap className="size-7 fill-current" />
            </motion.span>

            <span className="text-4xl sm:text-5xl font-black tracking-tighter uppercase font-label text-[#5f0f00] dark:text-[#ecfdf5]">
              Doc<span className="text-[#ff967d] dark:text-[#34d399]">2</span>Quiz
            </span>
          </div>

          {/* Marker Stroke Line Under Wordmark */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative z-10 w-48 sm:w-64 h-2 bg-[#ff967d] dark:bg-[#34d399] rounded-full -mt-1 shadow-sm"
          />
        </div>

        {/* Indeterminate Indication Bar */}
        <div className="relative h-2 w-56 sm:w-72 overflow-hidden rounded-full border-2 border-[#181c1b] dark:border-[#ecfdf5] bg-white dark:bg-[#134e4a]">
          <motion.div
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              duration: 1.1,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="h-full w-1/2 rounded-full bg-[#5f0f00] dark:bg-[#ff967d]"
          />
        </div>

        {/* Text Slam Aggressive Bilingual Message */}
        <div className="relative min-h-[3rem] flex items-center justify-center px-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlogan}
              initial={
                isReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 1.25, y: 12, rotate: -1 }
              }
              animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
              exit={
                isReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.85, y: -12, rotate: 1 }
              }
              transition={{ type: "spring", stiffness: 480, damping: 24 }}
              className="inline-block rounded-xl border-2 border-[#181c1b] bg-[#5f0f00] dark:border-[#ecfdf5] dark:bg-[#34d399] px-5 py-2.5 text-lg sm:text-xl font-black uppercase text-white dark:text-[#0c1a17] font-label shadow-[4px_4px_0px_0px_#181c1b] dark:shadow-[4px_4px_0px_0px_#ecfdf5]"
            >
              {currentSlogan}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Secondary Status Stamp */}
        <div className="text-xs font-bold uppercase tracking-widest text-[#404945] dark:text-[#34d399] font-label">
          SWITCHING SYLLABUS CANVAS • LOCK IN
        </div>
      </div>
    </motion.div>
  );
}
