"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import type { Transition, Variants } from "framer-motion";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type RevealPhase = "enter" | "polish" | "exitReverse" | "idle";

interface TextProps extends React.ComponentPropsWithoutRef<"span"> {
  children: React.ReactNode;
  reverse?: boolean;
  transition?: Transition;
  splitBy?: "words" | "characters" | "lines" | string;
  staggerDuration?: number;
  staggerFrom?: "first" | "last" | "center" | "random" | number;
  containerClassName?: string;
  wordLevelClassName?: string;
  elementLevelClassName?: string;
  onClick?: () => void;
  onStart?: () => void;
  onComplete?: () => void;
  /** Fires once after the slowest-to-finish character reaches `hidden` (e.g. after `reset()`). */
  onHideComplete?: () => void;
  /**
   * After intro reveal completes, run a second in-component vertical nudge (same clips).
   * Skipped when `prefers-reduced-motion` is set.
   */
  postRevealPolish?: boolean;
  /**
   * Milliseconds to stay on the final revealed pose before the polish wave starts.
   * Example: intro ends at ~0.2s and polish should run 1.8s–2s → use `1600`.
   */
  postRevealPolishDelayMs?: number;
  /**
   * Per-glyph keyframe duration for the polish variant. Wall-clock polish is roughly
   * `max(polish delays) + polishDurationSeconds`; pair with `polishStaggerSpreadSeconds` to budget the phase.
   * Default `0.5`.
   */
  polishDurationSeconds?: number;
  /**
   * When set, polish delays ramp from `0` (last glyph) to this many seconds (first glyph),
   * independent of `staggerDuration`. Omit to keep legacy `(staggerDuration * 0.38)` spacing.
   */
  polishStaggerSpreadSeconds?: number;
  /** Fires once after the post-reveal polish wave finishes (slowest glyph). */
  onPolishComplete?: () => void;
  /**
   * After intro (+ optional delay), run a reverse vertical-cut (visible → clipped off),
   * same geometry as intro but opposite direction / last-to-first stagger. If both this and
   * `postRevealPolish` are set, exit reverse wins.
   */
  postRevealExitReverse?: boolean;
  /** Per-glyph tween duration for the exit-reverse pass. */
  exitReverseDurationSeconds?: number;
  /**
   * Exit stagger ramp (last glyph starts first). Wall-clock exit ≈ this + `exitReverseDurationSeconds`.
   */
  exitReverseStaggerSpreadSeconds?: number;
  /** Fires once after the slowest glyph finishes exit-reverse. */
  onExitReverseComplete?: () => void;
  autoStart?: boolean;
}

export interface VerticalCutRevealRef {
  startAnimation: () => void;
  reset: () => void;
}

interface WordObject {
  characters: string[];
  needsSpace: boolean;
}

const POLISH_STAGGER_FACTOR = 0.38;

/** Screen-reader mirror: not a flex item (parent must not be `display:flex` on same axis). */
const VISUALLY_HIDDEN_STYLE: CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  borderWidth: 0,
};

const VerticalCutReveal = forwardRef<VerticalCutRevealRef, TextProps>(
  (
    {
      children,
      reverse = false,
      transition = {
        type: "spring",
        stiffness: 190,
        damping: 22,
      },
      splitBy = "words",
      staggerDuration = 0.2,
      staggerFrom = "first",
      containerClassName,
      wordLevelClassName,
      elementLevelClassName,
      onClick,
      onStart,
      onComplete,
      onHideComplete,
      postRevealPolish = false,
      postRevealPolishDelayMs = 0,
      polishDurationSeconds = 0.5,
      polishStaggerSpreadSeconds,
      onPolishComplete,
      postRevealExitReverse = false,
      exitReverseDurationSeconds = 0.45,
      exitReverseStaggerSpreadSeconds,
      onExitReverseComplete,
      autoStart = true,
      className,
      ...props
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLSpanElement>(null);
    const reduceMotion = useReducedMotion();
    const text =
      typeof children === "string"
        ? children
        : typeof children === "number"
          ? String(children)
          : "";
    const [isAnimating, setIsAnimating] = useState(false);
    const [phase, setPhase] = useState<RevealPhase>("enter");
    const isAnimatingRef = useRef(isAnimating);
    const hideEndNotifiedRef = useRef(false);
    const showEndNotifiedRef = useRef(false);
    const polishEndNotifiedRef = useRef(false);
    const exitReverseEndNotifiedRef = useRef(false);
    const phaseRef = useRef<RevealPhase>("enter");
    const [idleRestHidden, setIdleRestHidden] = useState(false);
    const polishDelayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

    const clearPolishDelayTimeout = useCallback(() => {
      if (polishDelayTimeoutRef.current !== null) {
        clearTimeout(polishDelayTimeoutRef.current);
        polishDelayTimeoutRef.current = null;
      }
    }, []);

    useEffect(() => {
      isAnimatingRef.current = isAnimating;
    }, [isAnimating]);

    useEffect(() => {
      phaseRef.current = phase;
    }, [phase]);

    useEffect(() => {
      clearPolishDelayTimeout();
      setPhase("enter");
      setIdleRestHidden(false);
      showEndNotifiedRef.current = false;
      polishEndNotifiedRef.current = false;
      exitReverseEndNotifiedRef.current = false;
      hideEndNotifiedRef.current = false;
    }, [clearPolishDelayTimeout, text]);

    useEffect(() => () => clearPolishDelayTimeout(), [clearPolishDelayTimeout]);

    const splitIntoCharacters = (value: string): string[] => {
      if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
        const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
        return Array.from(segmenter.segment(value), ({ segment }) => segment);
      }
      return Array.from(value);
    };

    const elements = useMemo<(string | WordObject)[]>(() => {
      const words = text.split(" ");
      if (splitBy === "characters") {
        return words.map((word, i) => ({
          characters: splitIntoCharacters(word),
          needsSpace: i !== words.length - 1,
        }));
      }
      if (splitBy === "words") {
        return text.split(" ");
      }
      if (splitBy === "lines") {
        return text.split("\n");
      }
      return text.split(splitBy);
    }, [text, splitBy]);

    const glyphTotal = useMemo(() => {
      if (splitBy === "characters") {
        return (elements as WordObject[]).reduce(
          (acc, word) =>
            acc +
            (typeof word === "string"
              ? 1
              : word.characters.length + (word.needsSpace ? 1 : 0)),
          0,
        );
      }
      return elements.length;
    }, [elements, splitBy]);

    const getStaggerDelay = useCallback(
      (index: number) => {
        const total = glyphTotal;
        if (staggerFrom === "first") {
          return index * staggerDuration;
        }
        if (staggerFrom === "last") {
          return (total - 1 - index) * staggerDuration;
        }
        if (staggerFrom === "center") {
          const center = Math.floor(total / 2);
          return Math.abs(center - index) * staggerDuration;
        }
        if (staggerFrom === "random") {
          const randomIndex = Math.floor(Math.random() * total);
          return Math.abs(randomIndex - index) * staggerDuration;
        }
        return Math.abs(staggerFrom - index) * staggerDuration;
      },
      [glyphTotal, staggerFrom, staggerDuration],
    );

    /** End wave: last glyphs move first (opposite of typical intro). */
    const getPolishStaggerDelay = useCallback(
      (index: number) => {
        const total = glyphTotal;
        if (total <= 0) {
          return 0;
        }
        if (typeof polishStaggerSpreadSeconds === "number") {
          const denom = Math.max(1, total - 1);
          return (
            ((total - 1 - index) / denom) * Math.max(0, polishStaggerSpreadSeconds)
          );
        }
        return (total - 1 - index) * staggerDuration * POLISH_STAGGER_FACTOR;
      },
      [glyphTotal, polishStaggerSpreadSeconds, staggerDuration],
    );

    const getExitReverseStaggerDelay = useCallback(
      (index: number) => {
        const total = glyphTotal;
        if (total <= 0) {
          return 0;
        }
        if (typeof exitReverseStaggerSpreadSeconds === "number") {
          const denom = Math.max(1, total - 1);
          return (
            ((total - 1 - index) / denom) *
            Math.max(0, exitReverseStaggerSpreadSeconds)
          );
        }
        return (total - 1 - index) * staggerDuration * POLISH_STAGGER_FACTOR;
      },
      [exitReverseStaggerSpreadSeconds, glyphTotal, staggerDuration],
    );

    const startAnimation = useCallback(() => {
      clearPolishDelayTimeout();
      hideEndNotifiedRef.current = false;
      showEndNotifiedRef.current = false;
      polishEndNotifiedRef.current = false;
      exitReverseEndNotifiedRef.current = false;
      setIdleRestHidden(false);
      setPhase("enter");
      setIsAnimating(true);
      onStart?.();
    }, [clearPolishDelayTimeout, onStart]);

    useImperativeHandle(
      ref,
      () => ({
        startAnimation,
        reset: () => {
          clearPolishDelayTimeout();
          hideEndNotifiedRef.current = false;
          showEndNotifiedRef.current = false;
          polishEndNotifiedRef.current = false;
          exitReverseEndNotifiedRef.current = false;
          setIdleRestHidden(false);
          setPhase("enter");
          setIsAnimating(false);
        },
      }),
      [clearPolishDelayTimeout, startAnimation],
    );

    useEffect(() => {
      if (autoStart) {
        startAnimation();
      }
    }, [autoStart, startAnimation]);

    const variants = useMemo(
      (): Variants => ({
        hidden: (i: number) => ({
          y: reverse ? "-100%" : "100%",
          transition: {
            ...transition,
            delay: ((transition?.delay as number) || 0) + getStaggerDelay(i),
          },
        }),
        visible: (i: number) => ({
          y: 0,
          transition: {
            ...transition,
            delay: ((transition?.delay as number) || 0) + getStaggerDelay(i),
          },
        }),
        polish: (i: number) => ({
          y: [0, "-0.065em", 0],
          transition: {
            duration: polishDurationSeconds,
            times: [0, 0.4, 1],
            ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
            delay:
              ((transition?.delay as number) || 0) + getPolishStaggerDelay(i),
          },
        }),
        exitReverse: (i: number) => ({
          y: reverse ? "-100%" : "100%",
          transition: {
            type: "tween",
            duration: exitReverseDurationSeconds,
            ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
            delay:
              ((transition?.delay as number) || 0) +
              getExitReverseStaggerDelay(i),
          },
        }),
        hiddenSettled: () => ({
          y: reverse ? "-100%" : "100%",
          transition: { duration: 0 },
        }),
      }),
      [
        exitReverseDurationSeconds,
        getExitReverseStaggerDelay,
        getPolishStaggerDelay,
        getStaggerDelay,
        polishDurationSeconds,
        reverse,
        transition,
      ],
    );

    const normalizedWords: WordObject[] =
      splitBy === "characters"
        ? (elements as WordObject[])
        : (elements as string[]).map((el, i) => ({
            characters: [el],
            needsSpace: i !== elements.length - 1,
          }));

    const charFlatIndices = useMemo(() => {
      const ind: number[] = [];
      normalizedWords.forEach((wordObj, wordIndex, arr) => {
        const prev = arr
          .slice(0, wordIndex)
          .reduce((s, w) => s + w.characters.length, 0);
        wordObj.characters.forEach((_, ci) => {
          ind.push(prev + ci);
        });
      });
      return ind;
    }, [normalizedWords]);

    const slowestCharFlatIndex = useMemo(() => {
      if (charFlatIndices.length === 0) {
        return -1;
      }
      return charFlatIndices.reduce(
        (best, i) =>
          getStaggerDelay(i) >= getStaggerDelay(best) ? i : best,
        charFlatIndices[0]!,
      );
    }, [charFlatIndices, getStaggerDelay]);

    const slowestPolishFlatIndex = useMemo(() => {
      if (charFlatIndices.length === 0) {
        return -1;
      }
      return charFlatIndices.reduce(
        (best, i) =>
          getPolishStaggerDelay(i) >= getPolishStaggerDelay(best) ? i : best,
        charFlatIndices[0]!,
      );
    }, [charFlatIndices, getPolishStaggerDelay]);

    const slowestExitReverseFlatIndex = useMemo(() => {
      if (charFlatIndices.length === 0) {
        return -1;
      }
      return charFlatIndices.reduce(
        (best, i) =>
          getExitReverseStaggerDelay(i) >= getExitReverseStaggerDelay(best)
            ? i
            : best,
        charFlatIndices[0]!,
      );
    }, [charFlatIndices, getExitReverseStaggerDelay]);

    const animTarget:
      | "hidden"
      | "visible"
      | "polish"
      | "exitReverse"
      | "hiddenSettled" =
      phase === "polish"
        ? "polish"
        : phase === "exitReverse"
          ? "exitReverse"
          : phase === "idle"
            ? idleRestHidden
              ? "hiddenSettled"
              : "visible"
            : isAnimating
              ? "visible"
              : "hidden";

    const polishEnabled =
      postRevealPolish &&
      !postRevealExitReverse &&
      reduceMotion !== true &&
      text.length > 0;

    const exitReverseEnabled =
      postRevealExitReverse && reduceMotion !== true && text.length > 0;

    return (
      <span
        className={cn("relative inline-block min-w-0", className)}
        onClick={onClick}
        ref={containerRef}
        {...props}
      >
        <span style={VISUALLY_HIDDEN_STYLE}>{text}</span>
        <span
          aria-hidden
          className={cn(
            containerClassName,
            "flex flex-wrap whitespace-pre-wrap",
            splitBy === "lines" && "flex-col",
          )}
        >
        {normalizedWords.map((wordObj, wordIndex, array) => {
          const previousCharsCount = array
            .slice(0, wordIndex)
            .reduce((sum, word) => sum + word.characters.length, 0);

          return (
            <span
              key={wordIndex}
              aria-hidden="true"
              className={cn("inline-flex overflow-hidden", wordLevelClassName)}
            >
              {wordObj.characters.map((char, charIndex) => {
                const flatIndex = previousCharsCount + charIndex;
                const isSlowestEnter = flatIndex === slowestCharFlatIndex;
                const isSlowestPolish = flatIndex === slowestPolishFlatIndex;
                const isSlowestExitReverse =
                  flatIndex === slowestExitReverseFlatIndex;
                return (
                  <span
                    className={cn(
                      elementLevelClassName,
                      "relative whitespace-pre-wrap",
                    )}
                    key={charIndex}
                  >
                    <motion.span
                      custom={flatIndex}
                      initial="hidden"
                      animate={animTarget}
                      variants={variants}
                      onAnimationComplete={() => {
                        const ph = phaseRef.current;
                        if (ph === "idle") {
                          return;
                        }
                        if (ph === "polish") {
                          if (!isSlowestPolish) {
                            return;
                          }
                          if (!polishEndNotifiedRef.current) {
                            polishEndNotifiedRef.current = true;
                            setIdleRestHidden(false);
                            onPolishComplete?.();
                            setPhase("idle");
                          }
                          return;
                        }
                        if (ph === "exitReverse") {
                          if (!isSlowestExitReverse) {
                            return;
                          }
                          if (!exitReverseEndNotifiedRef.current) {
                            exitReverseEndNotifiedRef.current = true;
                            setIdleRestHidden(true);
                            setPhase("idle");
                            const onExit = onExitReverseComplete;
                            if (onExit) {
                              queueMicrotask(() => {
                                onExit();
                              });
                            }
                          }
                          return;
                        }
                        if (!isSlowestEnter) {
                          return;
                        }
                        if (isAnimatingRef.current) {
                          if (!showEndNotifiedRef.current) {
                            showEndNotifiedRef.current = true;
                            onComplete?.();
                            const delayMs = Math.max(0, postRevealPolishDelayMs);
                            if (exitReverseEnabled) {
                              exitReverseEndNotifiedRef.current = false;
                              if (delayMs > 0) {
                                clearPolishDelayTimeout();
                                polishDelayTimeoutRef.current = setTimeout(
                                  () => {
                                    polishDelayTimeoutRef.current = null;
                                    setPhase("exitReverse");
                                  },
                                  delayMs,
                                );
                              } else {
                                setPhase("exitReverse");
                              }
                            } else if (polishEnabled) {
                              polishEndNotifiedRef.current = false;
                              if (delayMs > 0) {
                                clearPolishDelayTimeout();
                                polishDelayTimeoutRef.current = setTimeout(
                                  () => {
                                    polishDelayTimeoutRef.current = null;
                                    setPhase("polish");
                                  },
                                  delayMs,
                                );
                              } else {
                                setPhase("polish");
                              }
                            }
                          }
                          return;
                        }
                        if (!hideEndNotifiedRef.current) {
                          hideEndNotifiedRef.current = true;
                          onHideComplete?.();
                        }
                      }}
                      className="inline-block"
                    >
                      {char}
                    </motion.span>
                  </span>
                );
              })}
              {wordObj.needsSpace ? <span> </span> : null}
            </span>
          );
        })}
        </span>
      </span>
    );
  },
);

VerticalCutReveal.displayName = "VerticalCutReveal";

export { VerticalCutReveal };
