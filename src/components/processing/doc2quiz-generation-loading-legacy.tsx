"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Zap,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  ArrowRight,
  BookOpen,
  FileText,
  Layers,
  Sparkles,
  ShieldAlert,
  Flame,
  ArrowLeft,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Types ---
export interface Doc2QuizGenerationLoadingLegacyProps {
  /** Optional callback when user clicks "Start practice" on complete */
  onStartPractice?: () => void;
  /** Optional callback when user clicks "Review questions" on complete */
  onReviewQuestions?: () => void;
  /** Optional callback when user clicks back button */
  onBack?: () => void;
  /** Title of the document being processed */
  documentTitle?: string;
  /** Initial progress percentage (0-100) */
  initialProgress?: number;
  /** Auto-start simulation */
  autoStart?: boolean;
  /** Additional custom class names */
  className?: string;
}

interface PaperItem {
  id: string;
  title: string;
  code: string;
  snippet: string;
  tag: string;
  stamp: string;
  rotation: number;
  xOffset: number;
  yOffset: number;
}

// --- Bilingual Encouragement Slogans (Rotates randomly every 1.5-2.5s) ---
const ENCOURAGEMENT_SLOGANS = [
  "LOCK THE FUCK IN.",
  "STOP SCROLLING. START GRINDING.",
  "BRO, YOU ARE NOT DONE YET.",
  "10 MORE QUESTIONS. MOVE.",
  "YOUR EXAM DOES NOT GIVE A SHIT.",
  "COOK THAT FUCKING SYLLABUS.",
  "HỌC TIẾP ĐI. ĐỪNG LƯỜI NỮA.",
  "LÀM THÊM 10 CÂU. NHANH.",
  "ĐỀ THI ĐANG CHỜ ĐẤM MÀY ĐẤY.",
  "KHÓC SAU. LOCK IN TRƯỚC.",
  "NÃO CHƯA CHẠY THÌ CHẠY LẠI.",
  "GRIND NOW. PANIC LESS LATER.",
] as const;

// --- Technical Status Sequence ---
const TECHNICAL_STATUSES = [
  { minProgress: 0, label: "Extracting text", detail: "Parsing document tree & tokenizing raw text", step: 1 },
  { minProgress: 25, label: "Finding concepts", detail: "Scanning entity graphs, formulas & definitions", step: 2 },
  { minProgress: 60, label: "Generating questions", detail: "Synthesizing distractors & question vectors", step: 3 },
  { minProgress: 85, label: "Preparing your grind", detail: "Validating difficulty curve & flashcard deck", step: 4 },
] as const;

// --- Sample Paper Deck Data ---
const PAPER_DECK: Omit<PaperItem, "id" | "rotation" | "xOffset" | "yOffset">[] = [
  {
    title: "Ch 4: Algorithm Analysis",
    code: "O(N log N) - Best Case",
    snippet: "Master theorem T(n) = aT(n/b) + f(n)...",
    tag: "HIGH PRIORITY",
    stamp: "PARSED",
  },
  {
    title: "Database Indexing & B+ Trees",
    code: "SELECT * FROM exam_panic",
    snippet: "Clustered index vs Non-clustered leaf nodes...",
    tag: "EXAM CORE",
    stamp: "KEY CONCEPT",
  },
  {
    title: "Computer Networks - OSI Model",
    code: "SYN -> SYN-ACK -> ACK",
    snippet: "Layer 4 Transport Segment vs Layer 3 Packet...",
    tag: "CRITICAL",
    stamp: "FORMULA EXTRACTED",
  },
  {
    title: "Operating Systems - Deadlocks",
    code: "Banker's Algorithm",
    snippet: "4 Necessary Conditions: Mutual Exclusion, Hold & Wait...",
    tag: "MUST KNOW",
    stamp: "EXAM FUEL",
  },
  {
    title: "Linear Algebra & Eigenvalues",
    code: "det(A - λI) = 0",
    snippet: "Characteristic equation roots & orthogonal matrix...",
    tag: "TRICKY",
    stamp: "NO SLEEP",
  },
  {
    title: "Software Eng: SOLID Principles",
    code: "Liskov Substitution",
    snippet: "Subtypes must be substitutable for base types...",
    tag: "SUMMARY",
    stamp: "SYNTAX OK",
  },
];

export function Doc2QuizGenerationLoadingLegacy({
  onStartPractice,
  onReviewQuestions,
  onBack,
  documentTitle = "CS301_Final_Exam_Review_Syllabus.pdf",
  initialProgress = 0,
  autoStart = true,
  className,
}: Doc2QuizGenerationLoadingLegacyProps) {
  // --- States ---
  const [progress, setProgress] = useState(initialProgress);
  const [isPlaying, setIsPlaying] = useState(autoStart);
  const [sloganIndex, setSloganIndex] = useState(0);
  const [reducedMotionOverride, setReducedMotionOverride] = useState<boolean | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [flashTrigger, setFlashTrigger] = useState(0);

  // Dynamic jitter states for loading percentage counter
  const [counterJitter, setCounterJitter] = useState({ size: 1, rot: 0, weight: 800, x: 0, y: 0 });

  // Flying cards stack
  const [visiblePapers, setVisiblePapers] = useState<PaperItem[]>([]);

  // System reduced motion preference
  const systemReducedMotion = useReducedMotion();
  const isReducedMotion = reducedMotionOverride ?? systemReducedMotion ?? false;

  const previousSloganRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Sound generator helper for study panic clicks/stamps
  const playPanicTone = useCallback((type: "jump" | "stamp" | "complete") => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === "jump") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === "stamp") {
        osc.type = "square";
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === "complete") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.1);
        osc.frequency.setValueAtTime(659.25, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch {
      // Audio playback failed silently
    }
  }, [soundEnabled]);

  // Encouragement Slogan Rotation
  useEffect(() => {
    let timerId: NodeJS.Timeout;

    const scheduleNextRotation = () => {
      const randomInterval = Math.floor(Math.random() * 1000) + 1500;
      timerId = setTimeout(() => {
        setSloganIndex((prev) => {
          let nextIndex: number;
          do {
            nextIndex = Math.floor(Math.random() * ENCOURAGEMENT_SLOGANS.length);
          } while (nextIndex === prev && ENCOURAGEMENT_SLOGANS.length > 1);
          previousSloganRef.current = nextIndex;
          return nextIndex;
        });
        scheduleNextRotation();
      }, randomInterval);
    };

    scheduleNextRotation();

    return () => clearTimeout(timerId);
  }, []);

  // Uneven Progress Jumps Simulation
  useEffect(() => {
    if (!isPlaying || progress >= 100) return;

    const jumpDelay = Math.floor(Math.random() * 450) + 300;

    const timer = setTimeout(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;

        const isBigLeap = Math.random() > 0.65;
        const delta = isBigLeap
          ? Math.floor(Math.random() * 16) + 10
          : Math.floor(Math.random() * 5) + 2;

        const nextProgress = Math.min(100, prev + delta);

        if (isBigLeap && !isReducedMotion) {
          setFlashTrigger((f) => f + 1);
          playPanicTone("jump");
        }

        if (!isReducedMotion) {
          setCounterJitter({
            size: Number((0.92 + Math.random() * 0.22).toFixed(2)),
            rot: Math.floor(Math.random() * 14) - 7,
            weight: [400, 600, 800, 900][Math.floor(Math.random() * 4)],
            x: Math.floor(Math.random() * 16) - 8,
            y: Math.floor(Math.random() * 12) - 6,
          });
        }

        const cardIndex = Math.floor((nextProgress / 100) * PAPER_DECK.length);
        if (cardIndex >= 0 && cardIndex < PAPER_DECK.length) {
          const rawCard = PAPER_DECK[cardIndex];
          const newCardItem: PaperItem = {
            ...rawCard,
            id: `${rawCard.stamp}-${nextProgress}-${Date.now()}`,
            rotation: Math.floor(Math.random() * 18) - 9,
            xOffset: Math.floor(Math.random() * 24) - 12,
            yOffset: Math.floor(Math.random() * 16) - 8,
          };

          setVisiblePapers((prevPapers) => {
            if (prevPapers.some((p) => p.stamp === newCardItem.stamp)) return prevPapers;
            playPanicTone("stamp");
            return [newCardItem, ...prevPapers].slice(0, 4);
          });
        }

        if (nextProgress === 100) {
          playPanicTone("complete");
        }

        return nextProgress;
      });
    }, jumpDelay);

    return () => clearTimeout(timer);
  }, [isPlaying, progress, isReducedMotion, playPanicTone]);

  const activeStatus = TECHNICAL_STATUSES.slice()
    .reverse()
    .find((s) => progress >= s.minProgress) || TECHNICAL_STATUSES[0];

  const handleReset = () => {
    setProgress(0);
    setIsPlaying(true);
    setVisiblePapers([]);
  };

  const handleSkipToComplete = () => {
    setProgress(100);
    setIsPlaying(false);
    playPanicTone("complete");
    setVisiblePapers(
      PAPER_DECK.slice(0, 4).map((rawCard, idx) => ({
        ...rawCard,
        id: `complete-${idx}`,
        rotation: (idx % 2 === 0 ? 1 : -1) * (idx * 3 + 2),
        xOffset: (idx % 2 === 0 ? 1 : -1) * (idx * 5),
        yOffset: idx * 4,
      }))
    );
  };

  return (
    <div
      className={cn(
        "relative min-h-screen w-full overflow-hidden bg-[#f7faf8] text-[#181c1b] flex flex-col justify-between select-none font-sans",
        className
      )}
    >
      <AnimatePresence>
        {flashTrigger > 0 && !isReducedMotion && (
          <motion.div
            key={`flash-${flashTrigger}`}
            initial={{ opacity: 0.25 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="pointer-events-none absolute inset-0 z-50 bg-[#ff967d]/20 mix-blend-multiply"
          />
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-0 z-0 opacity-40">
        <svg className="h-full w-full" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="study-grid-legacy" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#c0c9c3" strokeWidth="0.75" opacity="0.6" />
              <circle cx="40" cy="40" r="1.25" fill="#404945" opacity="0.4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#study-grid-legacy)" />
        </svg>
      </div>

      <header className="relative z-30 flex items-center justify-between border-b border-[#c0c9c3] bg-[#f7faf8]/90 backdrop-blur-sm px-4 py-3 md:px-8">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-lg border border-[#181c1b]/20 bg-white px-3 py-1.5 text-xs font-semibold text-[#181c1b] transition-all hover:border-[#5f0f00] hover:bg-[#ebefed]"
            >
              <ArrowLeft className="size-4 text-[#5f0f00]" />
              <span>Back</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded bg-[#5f0f00] text-white">
              <Zap className="size-4 text-[#ff967d] fill-[#ff967d]" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-[#181c1b] text-sm md:text-base">
                  Doc2Quiz Generator Engine (Legacy)
                </span>
                <span className="rounded bg-[#ff967d]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#5f0f00] border border-[#ff967d]/40 font-label">
                  PARSER
                </span>
              </div>
              <p className="max-w-[200px] truncate text-xs text-[#404945] sm:max-w-xs md:max-w-md">
                {documentTitle}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn(
              "flex size-8 md:size-9 items-center justify-center rounded-lg border transition-colors",
              soundEnabled
                ? "border-[#5f0f00] bg-[#5f0f00] text-white"
                : "border-[#c0c9c3] bg-white text-[#404945] hover:bg-[#ebefed]"
            )}
          >
            {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>

          <button
            onClick={() => setReducedMotionOverride(!isReducedMotion)}
            className={cn(
              "hidden sm:flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
              isReducedMotion
                ? "border-[#5f0f00] bg-[#5f0f00] text-white"
                : "border-[#c0c9c3] bg-white text-[#404945] hover:bg-[#ebefed]"
            )}
          >
            <Sparkles className="size-3.5" />
            <span>Motion: {isReducedMotion ? "OFF" : "ON"}</span>
          </button>

          {progress < 100 ? (
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-1.5 rounded-lg border border-[#181c1b] bg-white px-3 py-1.5 text-xs font-bold text-[#181c1b]"
            >
              {isPlaying ? <Pause className="size-3.5 text-[#5f0f00]" /> : <Play className="size-3.5 text-[#5f0f00]" />}
              <span className="hidden sm:inline">{isPlaying ? "Pause" : "Resume"}</span>
            </button>
          ) : null}

          {progress < 100 ? (
            <button
              onClick={handleSkipToComplete}
              className="flex items-center gap-1 rounded-lg border border-[#5f0f00] bg-[#5f0f00] px-3 py-1.5 text-xs font-bold text-white"
            >
              <FastForward className="size-3.5 text-[#ff967d]" />
              <span>Skip</span>
            </button>
          ) : (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-lg border border-[#181c1b] bg-white px-3 py-1.5 text-xs font-bold text-[#181c1b]"
            >
              <RotateCcw className="size-3.5 text-[#5f0f00]" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-6 md:px-8">
        <div className="w-full max-w-4xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#c0c9c3] bg-white/80 p-3.5 shadow-sm">
            <div className="flex items-center gap-2">
              <Flame className="size-5 text-[#5f0f00] animate-pulse" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#404945] font-label">
                  PANIC LEVEL
                </div>
                <div className="text-xs font-extrabold text-[#5f0f00] font-label">
                  {progress < 25 && "MODERATE"}
                  {progress >= 25 && progress < 60 && "HIGH"}
                  {progress >= 60 && progress < 85 && "CRITICAL"}
                  {progress >= 85 && progress < 100 && "MAXIMUM"}
                  {progress === 100 && "QUIZ READY"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              {TECHNICAL_STATUSES.map((st, idx) => {
                const isPassed = progress >= st.minProgress;
                const isCurrent = activeStatus.label === st.label && progress < 100;
                return (
                  <React.Fragment key={st.label}>
                    {idx > 0 && (
                      <div className={cn("h-0.5 w-3 sm:w-6", isPassed ? "bg-[#5f0f00]" : "bg-[#c0c9c3]")} />
                    )}
                    <div
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold font-label",
                        isCurrent
                          ? "bg-[#ff967d] text-[#5f0f00] ring-2 ring-[#5f0f00]"
                          : isPassed
                          ? "bg-[#5f0f00] text-white"
                          : "bg-[#ebefed] text-[#404945]"
                      )}
                    >
                      <span>0{st.step}</span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div className="relative flex min-h-[240px] flex-col items-center justify-center rounded-2xl border-2 border-[#181c1b] bg-white p-6 shadow-[6px_6px_0px_0px_#181c1b]">
            <div className="absolute -top-3.5 left-6 z-20 flex items-center gap-1.5 rounded-sm border-2 border-[#181c1b] bg-[#ff967d] px-3 py-1 text-xs font-black uppercase text-[#5f0f00] font-label">
              <ShieldAlert className="size-4" />
              <span>QUIZ GENERATION PROGRESS</span>
            </div>

            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
              <AnimatePresence>
                {visiblePapers.map((paper, index) => (
                  <motion.div
                    key={paper.id}
                    initial={{ opacity: 0, scale: 0.7, y: -50 }}
                    animate={{ opacity: 0.95, scale: 1, x: paper.xOffset, y: paper.yOffset, rotate: paper.rotation }}
                    exit={{ opacity: 0, scale: 0.8, y: 50 }}
                    className={cn(
                      "absolute z-10 w-56 rounded-xl border-2 border-[#181c1b] bg-[#f7faf8] p-3 shadow-[4px_4px_0px_0px_#181c1b]",
                      index === 0 ? "right-6 top-4" : "left-6 top-6"
                    )}
                  >
                    <div className="flex items-center justify-between border-b border-[#c0c9c3] pb-1 mb-1">
                      <span className="text-[10px] font-extrabold text-[#5f0f00] font-label">{paper.tag}</span>
                      <span className="rounded bg-[#5f0f00] px-1 text-[9px] text-white font-label">{paper.stamp}</span>
                    </div>
                    <div className="text-xs font-bold text-[#181c1b] truncate">{paper.title}</div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="relative z-20 flex flex-col items-center justify-center my-2">
              <motion.div
                animate={{ scale: counterJitter.size, rotate: counterJitter.rot, x: counterJitter.x, y: counterJitter.y }}
                className="flex items-baseline font-black text-[#5f0f00] font-label"
              >
                <span className="text-7xl sm:text-8xl font-black">{progress}</span>
                <span className="text-4xl text-[#ff967d] ml-1">%</span>
              </motion.div>
            </div>

            <div className="relative z-20 mt-2 text-center">
              <div className="inline-flex items-center gap-2 rounded-lg border-2 border-[#181c1b] bg-[#ebefed] px-3.5 py-1 text-base font-black text-[#181c1b] font-label">
                <span>{activeStatus.label}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-extrabold text-[#181c1b] font-label">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-[#5f0f00]" />
                <span>PROCESSING</span>
              </div>
              <span className="font-mono text-sm">{progress} / 100%</span>
            </div>
            <div className="relative h-5 w-full overflow-hidden rounded-lg border-2 border-[#181c1b] bg-white p-0.5">
              <div className="h-full rounded bg-[#5f0f00]" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border-2 border-[#181c1b] bg-[#5f0f00] p-4 text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={sloganIndex}
                initial={{ opacity: 0, scale: 1.2 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-lg font-black text-white font-label"
              >
                {`"${ENCOURAGEMENT_SLOGANS[sloganIndex]}"`}
              </motion.div>
            </AnimatePresence>
          </div>

          {progress === 100 && (
            <div className="rounded-2xl border-4 border-[#5f0f00] bg-[#ff967d]/15 p-6 text-center space-y-4">
              <div className="inline-block rounded-xl bg-[#5f0f00] px-6 py-2 text-3xl font-black text-white font-label">
                QUIZ READY
              </div>
              <div className="flex justify-center gap-3">
                {onStartPractice && (
                  <button onClick={onStartPractice} className="rounded-xl border-2 border-[#181c1b] bg-[#5f0f00] px-6 py-3 font-bold text-white">
                    Start practice
                  </button>
                )}
                {onReviewQuestions && (
                  <button onClick={onReviewQuestions} className="rounded-xl border-2 border-[#181c1b] bg-white px-6 py-3 font-bold text-[#181c1b]">
                    Review questions
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
