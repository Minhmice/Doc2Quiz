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
import type { Transition } from "framer-motion";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

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
      autoStart = true,
      className,
      ...props
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLSpanElement>(null);
    const text =
      typeof children === "string"
        ? children
        : typeof children === "number"
          ? String(children)
          : "";
    const [isAnimating, setIsAnimating] = useState(false);
    const isAnimatingRef = useRef(isAnimating);
    const hideEndNotifiedRef = useRef(false);
    const showEndNotifiedRef = useRef(false);

    useEffect(() => {
      isAnimatingRef.current = isAnimating;
    }, [isAnimating]);

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

    const getStaggerDelay = useCallback(
      (index: number) => {
        const total =
          splitBy === "characters"
            ? (elements as WordObject[]).reduce(
                (acc, word) =>
                  acc +
                  (typeof word === "string"
                    ? 1
                    : word.characters.length + (word.needsSpace ? 1 : 0)),
                0,
              )
            : elements.length;
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
      [elements, splitBy, staggerFrom, staggerDuration],
    );

    const startAnimation = useCallback(() => {
      hideEndNotifiedRef.current = false;
      showEndNotifiedRef.current = false;
      setIsAnimating(true);
      onStart?.();
    }, [onStart]);

    useImperativeHandle(ref, () => ({
      startAnimation,
      reset: () => {
        hideEndNotifiedRef.current = false;
        setIsAnimating(false);
      },
    }));

    useEffect(() => {
      if (autoStart) {
        startAnimation();
      }
    }, [autoStart, startAnimation]);

    const variants = {
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
    };

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

    return (
      <span
        className={cn(
          containerClassName,
          "flex flex-wrap whitespace-pre-wrap",
          splitBy === "lines" && "flex-col",
          className,
        )}
        onClick={onClick}
        ref={containerRef}
        {...props}
      >
        <span className="sr-only">{text}</span>

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
                const isSlowest = flatIndex === slowestCharFlatIndex;
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
                      animate={isAnimating ? "visible" : "hidden"}
                      variants={variants}
                      onAnimationComplete={() => {
                        if (!isSlowest) {
                          return;
                        }
                        if (isAnimatingRef.current) {
                          if (!showEndNotifiedRef.current) {
                            showEndNotifiedRef.current = true;
                            onComplete?.();
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
    );
  },
);

VerticalCutReveal.displayName = "VerticalCutReveal";

export { VerticalCutReveal };
