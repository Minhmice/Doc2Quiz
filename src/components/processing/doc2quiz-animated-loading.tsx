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
export interface Doc2QuizAnimatedLoadingProps {
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

export function Doc2QuizAnimatedLoading({
  onStartPractice,
  onReviewQuestions,
  onBack,
  documentTitle = "CS301_Final_Exam_Review_Syllabus.pdf",
  initialProgress = 0,
  autoStart = true,
  className,
}: Doc2QuizAnimatedLoadingProps) {
  // --- States ---
  const [progress, setProgress] = useState(initialProgress);
  const [isPlaying, setIsPlaying] = useState(autoStart);
  const [sloganIndex, setSloganIndex] = useState(0);
  const [reducedMotionOverride, setReducedMotionOverride] = useState<boolean | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [flashTrigger, setFlashTrigger] = useState(0);

  // Dynamic jitter states for huge loading percentage counter
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
      // Audio playback failed silently (e.g. browser policy)
    }
  }, [soundEnabled]);

  // --- Encouragement Slogan Rotation (1.5s - 2.5s without immediate repetition) ---
  useEffect(() => {
    let timerId: NodeJS.Timeout;

    const scheduleNextRotation = () => {
      const randomInterval = Math.floor(Math.random() * 1000) + 1500; // 1500ms - 2500ms
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

  // --- Uneven Progress Jumps Simulation ---
  useEffect(() => {
    if (!isPlaying || progress >= 100) return;

    // Uneven timing: 300ms to 750ms between jumps
    const jumpDelay = Math.floor(Math.random() * 450) + 300;

    const timer = setTimeout(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;

        // Non-linear jump sizes: sudden big leaps (12%-25%) or small ticks (2%-5%)
        const isBigLeap = Math.random() > 0.65;
        const delta = isBigLeap
          ? Math.floor(Math.random() * 16) + 10 // 10% to 25%
          : Math.floor(Math.random() * 5) + 2; // 2% to 6%

        const nextProgress = Math.min(100, prev + delta);

        // Strobe flash on big leaps
        if (isBigLeap && !isReducedMotion) {
          setFlashTrigger((f) => f + 1);
          playPanicTone("jump");
        }

        // Trigger Jitter on Percentage Counter
        if (!isReducedMotion) {
          setCounterJitter({
            size: Number((0.92 + Math.random() * 0.22).toFixed(2)),
            rot: Math.floor(Math.random() * 14) - 7,
            weight: [400, 600, 800, 900][Math.floor(Math.random() * 4)],
            x: Math.floor(Math.random() * 16) - 8,
            y: Math.floor(Math.random() * 12) - 6,
          });
        }

        // Spawn a paper card on milestone progress shifts
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
            return [newCardItem, ...prevPapers].slice(0, 4); // Keep top 4 cards
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

  // --- Derive Active Technical Status ---
  const activeStatus = TECHNICAL_STATUSES.slice()
    .reverse()
    .find((s) => progress >= s.minProgress) || TECHNICAL_STATUSES[0];

  // Reset handler
  const handleReset = () => {
    setProgress(0);
    setIsPlaying(true);
    setVisiblePapers([]);
  };

  // Jump to 100%
  const handleSkipToComplete = () => {
    setProgress(100);
    setIsPlaying(false);
    playPanicTone("complete");
    // Fill all papers
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
      style={{
        fontFamily: "var(--font-body), system-ui, sans-serif",
      }}
    >
      {/* --- Screen Flash Overlay on Big Progress Jumps --- */}
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

      {/* --- Technical Blueprint Background Grid Pattern --- */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-40">
        <svg className="h-full w-full" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="study-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#c0c9c3" strokeWidth="0.75" opacity="0.6" />
              <circle cx="40" cy="40" r="1.25" fill="#404945" opacity="0.4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#study-grid)" />
        </svg>
      </div>

      {/* --- Panic Speed Lines (Active above 70% progress) --- */}
      {!isReducedMotion && progress >= 70 && progress < 100 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.1, 0.25, 0.1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_transparent_40%,_rgba(95,15,0,0.06)_100%)]"
        />
      )}

      {/* ========================================================================= */}
      {/* HEADER BAR (Never blocks navigation)                                    */}
      {/* ========================================================================= */}
      <header className="relative z-30 flex items-center justify-between border-b border-[#c0c9c3] bg-[#f7faf8]/90 backdrop-blur-sm px-4 py-3 md:px-8">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-lg border border-[#181c1b]/20 bg-white px-3 py-1.5 text-xs font-semibold text-[#181c1b] transition-all hover:border-[#5f0f00] hover:bg-[#ebefed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff967d]"
              aria-label="Back to previous page"
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
                  Doc2Quiz Engine
                </span>
                <span className="rounded bg-[#ff967d]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#5f0f00] border border-[#ff967d]/40 font-label">
                  PANIC_MODE_ACTIVE
                </span>
              </div>
              <p className="max-w-[200px] truncate text-xs text-[#404945] sm:max-w-xs md:max-w-md">
                {documentTitle}
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn(
              "flex size-8 md:size-9 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff967d]",
              soundEnabled
                ? "border-[#5f0f00] bg-[#5f0f00] text-white"
                : "border-[#c0c9c3] bg-white text-[#404945] hover:bg-[#ebefed]"
            )}
            title={soundEnabled ? "Mute panic sounds" : "Enable panic sounds"}
            aria-label={soundEnabled ? "Mute panic sounds" : "Enable panic sounds"}
          >
            {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>

          {/* Reduced Motion Toggle */}
          <button
            onClick={() => setReducedMotionOverride(!isReducedMotion)}
            className={cn(
              "hidden sm:flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff967d]",
              isReducedMotion
                ? "border-[#5f0f00] bg-[#5f0f00] text-white"
                : "border-[#c0c9c3] bg-white text-[#404945] hover:bg-[#ebefed]"
            )}
            title="Toggle reduced motion"
          >
            <Sparkles className="size-3.5" />
            <span>Motion: {isReducedMotion ? "OFF" : "ON"}</span>
          </button>

          {/* Pause / Play */}
          {progress < 100 && (
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-1.5 rounded-lg border border-[#181c1b] bg-white px-3 py-1.5 text-xs font-bold text-[#181c1b] transition-all hover:bg-[#ebefed] active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff967d]"
            >
              {isPlaying ? (
                <>
                  <Pause className="size-3.5 text-[#5f0f00]" />
                  <span className="hidden sm:inline">Pause</span>
                </>
              ) : (
                <>
                  <Play className="size-3.5 text-[#5f0f00]" />
                  <span className="hidden sm:inline">Resume</span>
                </>
              )}
            </button>
          )}

          {/* Re-run / Skip */}
          {progress < 100 ? (
            <button
              onClick={handleSkipToComplete}
              className="flex items-center gap-1 rounded-lg border border-[#5f0f00] bg-[#5f0f00] px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-[#841f06] active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff967d]"
              title="Skip directly to 100%"
            >
              <FastForward className="size-3.5 text-[#ff967d]" />
              <span>Skip to End</span>
            </button>
          ) : (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-lg border border-[#181c1b] bg-white px-3 py-1.5 text-xs font-bold text-[#181c1b] transition-all hover:bg-[#ebefed] active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff967d]"
            >
              <RotateCcw className="size-3.5 text-[#5f0f00]" />
              <span>Re-Grind</span>
            </button>
          )}
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAIN CANVAS - CHAOTIC STUDY PANIC ENERGY                                 */}
      {/* ========================================================================= */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-6 md:px-8">
        <div className="w-full max-w-4xl space-y-6">
          
          {/* --- TOP HUD: PANIC LEVEL & MILESTONE INDICATORS --- */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#c0c9c3] bg-white/80 p-3.5 shadow-sm backdrop-blur-sm">
            {/* Panic Meter */}
            <div className="flex items-center gap-2">
              <Flame className="size-5 text-[#5f0f00] animate-pulse" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#404945] font-label">
                  PANIC LEVEL
                </div>
                <div className="text-xs font-extrabold text-[#5f0f00] font-label">
                  {progress < 25 && "MODERATE (COFFEE 1/4)"}
                  {progress >= 25 && progress < 60 && "HIGH (SYLLABUS UNTOUCHED)"}
                  {progress >= 60 && progress < 85 && "CRITICAL (EXAM APPROACHING)"}
                  {progress >= 85 && progress < 100 && "MAXIMUM (LOCK IN NOW)"}
                  {progress === 100 && "QUIZ READY (GO COOK)"}
                </div>
              </div>
            </div>

            {/* Milestones Stepper */}
            <div className="flex items-center gap-1 sm:gap-2">
              {TECHNICAL_STATUSES.map((st, idx) => {
                const isPassed = progress >= st.minProgress;
                const isCurrent = activeStatus.label === st.label && progress < 100;

                return (
                  <React.Fragment key={st.label}>
                    {idx > 0 && (
                      <div
                        className={cn(
                          "h-0.5 w-3 sm:w-6 transition-colors duration-300",
                          isPassed ? "bg-[#5f0f00]" : "bg-[#c0c9c3]"
                        )}
                      />
                    )}
                    <div
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider font-label transition-all",
                        isCurrent
                          ? "bg-[#ff967d] text-[#5f0f00] ring-2 ring-[#5f0f00]"
                          : isPassed
                          ? "bg-[#5f0f00] text-white"
                          : "bg-[#ebefed] text-[#404945]"
                      )}
                    >
                      <span>0{st.step}</span>
                      <span className="hidden md:inline">{st.label.split(" ")[0]}</span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* ===================================================================== */}
          {/* HUGE ANIMATED LOADING PERCENTAGE & FLYING PAPERS STACK                */}
          {/* ===================================================================== */}
          <div className="relative flex min-h-[260px] md:min-h-[300px] flex-col items-center justify-center rounded-2xl border-2 border-[#181c1b] bg-white p-6 md:p-10 shadow-[6px_6px_0px_0px_#181c1b]">
            
            {/* Warning Tape Overlay Badge */}
            <div className="absolute -top-3.5 left-6 z-20 flex items-center gap-1.5 rounded-sm border-2 border-[#181c1b] bg-[#ff967d] px-3 py-1 text-xs font-black uppercase tracking-wider text-[#5f0f00] shadow-[2px_2px_0px_0px_#181c1b] font-label">
              <ShieldAlert className="size-4" />
              <span>EXAM IN 6 HOURS • DO NOT SLEEP</span>
            </div>

            {/* Dynamic Hand-Drawn SVG Marker Scribble around Counter */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-30">
              <svg width="280" height="140" viewBox="0 0 280 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M 20 70 Q 70 20, 140 30 Q 220 40, 260 70 Q 240 120, 140 115 Q 40 110, 20 70 Z"
                  stroke="#ff967d"
                  strokeWidth="6"
                  strokeDasharray="12 6"
                  fill="none"
                />
              </svg>
            </div>

            {/* Flying / Stacking Study Cards Behind / Beside Counter */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
              <AnimatePresence>
                {visiblePapers.map((paper, index) => (
                  <motion.div
                    key={paper.id}
                    initial={
                      isReducedMotion
                        ? { opacity: 0, y: 10 }
                        : { opacity: 0, scale: 0.7, y: -80, rotate: paper.rotation * 2 }
                    }
                    animate={{
                      opacity: 0.95,
                      scale: 1,
                      x: paper.xOffset + index * 6,
                      y: paper.yOffset + index * 8,
                      rotate: paper.rotation,
                    }}
                    exit={{ opacity: 0, scale: 0.8, y: 60 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className={cn(
                      "absolute z-10 w-56 md:w-64 rounded-xl border-2 border-[#181c1b] bg-[#f7faf8] p-3.5 shadow-[4px_4px_0px_0px_#181c1b]",
                      index === 0 ? "right-4 md:right-10 top-4" : "left-4 md:left-10 top-6"
                    )}
                  >
                    <div className="flex items-center justify-between border-b border-[#c0c9c3] pb-1.5 mb-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-[#5f0f00] uppercase tracking-wider font-label">
                        <FileText className="size-3.5" />
                        <span>{paper.tag}</span>
                      </div>
                      {/* Stamp on Card */}
                      <span className="rounded border border-[#5f0f00] bg-[#5f0f00] px-1.5 py-0.5 text-[9px] font-black uppercase text-white font-label rotate-[-4deg]">
                        {paper.stamp}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-[#181c1b] line-clamp-1">
                      {paper.title}
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-[#404945] bg-[#ebefed] p-1 rounded border border-[#c0c9c3]">
                      {paper.code}
                    </div>
                    <p className="mt-1.5 text-[10px] text-[#404945] line-clamp-2">
                      {paper.snippet}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* --- HUGE LOADING PERCENTAGE (Rapidly changes size, position, weight & rotation) --- */}
            <div className="relative z-20 flex flex-col items-center justify-center my-4">
              <motion.div
                animate={
                  isReducedMotion
                    ? { scale: 1, rotate: 0, x: 0, y: 0 }
                    : {
                        scale: counterJitter.size,
                        rotate: counterJitter.rot,
                        x: counterJitter.x,
                        y: counterJitter.y,
                      }
                }
                transition={{ type: "spring", stiffness: 450, damping: 25 }}
                className="flex items-baseline font-black tracking-tighter text-[#5f0f00] font-label select-none"
                style={{
                  fontWeight: counterJitter.weight,
                }}
              >
                <span className="text-7xl sm:text-8xl md:text-9xl tracking-tight leading-none drop-shadow-[4px_4px_0px_#181c1b]">
                  {progress}
                </span>
                <span className="text-4xl sm:text-5xl md:text-6xl text-[#ff967d] ml-1 font-extrabold stroke-[#181c1b]">
                  %
                </span>
              </motion.div>

              {/* Marker Underline under Percentage */}
              <div className="w-32 sm:w-48 h-2 bg-[#ff967d] rounded-full -mt-2 md:-mt-3 opacity-80" />
            </div>

            {/* --- STATUS TEXT (Glitches, slams onto screen, shakes once, then swaps) --- */}
            <div className="relative z-20 mt-2 text-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStatus.label}
                  initial={
                    isReducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 1.3, y: -12 }
                  }
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={
                    isReducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 0.8, y: 12 }
                  }
                  transition={{ type: "spring", stiffness: 500, damping: 28 }}
                  className="space-y-1"
                >
                  <div className="inline-flex items-center gap-2 rounded-lg border-2 border-[#181c1b] bg-[#ebefed] px-3.5 py-1.5 text-base md:text-lg font-black uppercase text-[#181c1b] shadow-[2px_2px_0px_0px_#181c1b] font-label">
                    <Sparkles className="size-4 text-[#5f0f00]" />
                    <span>{activeStatus.label}</span>
                  </div>
                  <p className="text-xs md:text-sm font-semibold text-[#404945]">
                    {activeStatus.detail}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* PROGRESS BAR (Fills unevenly with sudden jumps)                        */}
          {/* ===================================================================== */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-extrabold text-[#181c1b] font-label uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-[#5f0f00]" />
                <span>STUDY SYLLABUS CONVERSION</span>
              </div>
              <span className="text-[#5f0f00] tabular-nums font-mono text-sm">
                {progress} / 100%
              </span>
            </div>

            {/* Custom Uneven Progress Bar */}
            <div className="relative h-6 w-full overflow-hidden rounded-lg border-2 border-[#181c1b] bg-white p-0.5 shadow-[3px_3px_0px_0px_#181c1b]">
              <motion.div
                className="relative h-full rounded bg-[#5f0f00] transition-all duration-300"
                style={{ width: `${progress}%` }}
              >
                {/* Diagonal Stripe Pattern Overlay */}
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage:
                      "linear-gradient(45deg, #ffffff 25%, transparent 25%, transparent 50%, #ffffff 50%, #ffffff 75%, transparent 75%, transparent)",
                    backgroundSize: "20px 20px",
                  }}
                />

                {/* Coral Leading Edge Flash Bar */}
                {progress > 0 && progress < 100 && (
                  <div className="absolute right-0 top-0 bottom-0 w-3 bg-[#ff967d] shadow-[0_0_12px_#ff967d] animate-pulse" />
                )}
              </motion.div>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* AGGRESSIVE BILINGUAL ENCOURAGEMENT SLOGAN BANNER                     */}
          {/* (Rotates randomly every 1.5-2.5s without immediate repetition)         */}
          {/* ===================================================================== */}
          <div className="relative overflow-hidden rounded-xl border-2 border-[#181c1b] bg-[#5f0f00] p-4 text-center shadow-[5px_5px_0px_0px_#181c1b]">
            {/* Background Scribble Accent */}
            <div className="pointer-events-none absolute -right-6 -top-6 text-[#ff967d]/10">
              <Flame className="size-32" />
            </div>

            <div className="text-[10px] font-bold uppercase tracking-widest text-[#ff967d] font-label mb-1">
              MOTIVATIONAL STUDY THREAT
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={sloganIndex}
                initial={
                  isReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 1.25, rotate: -2, y: 10 }
                }
                animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
                exit={
                  isReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.85, rotate: 2, y: -10 }
                }
                transition={{ type: "spring", stiffness: 450, damping: 22 }}
                className="text-lg sm:text-xl md:text-2xl font-black tracking-tight text-white font-label"
              >
                {`"${ENCOURAGEMENT_SLOGANS[sloganIndex]}"`}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ===================================================================== */}
          {/* FINAL STATE STAMP & ACTION BUTTONS (Triggered when progress === 100)  */}
          {/* ===================================================================== */}
          <AnimatePresence>
            {progress === 100 && (
              <motion.div
                initial={
                  isReducedMotion
                    ? { opacity: 0, y: 20 }
                    : { opacity: 0, scale: 0.7, rotate: -8, y: 30 }
                }
                animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="rounded-2xl border-4 border-[#5f0f00] bg-[#ff967d]/15 p-6 md:p-8 text-center shadow-[8px_8px_0px_0px_#5f0f00] space-y-6 relative overflow-hidden"
              >
                {/* Large Success Stamp */}
                <div className="inline-block rounded-xl border-4 border-[#5f0f00] bg-[#5f0f00] px-6 py-2 text-3xl sm:text-4xl md:text-5xl font-black uppercase text-white tracking-wider font-label shadow-[4px_4px_0px_0px_#181c1b] rotate-[-2deg]">
                  QUIZ READY
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl md:text-2xl font-black text-[#181c1b]">
                    Enough loading. Go cook the exam.
                  </h3>
                  <p className="text-sm text-[#404945] max-w-md mx-auto">
                    Your questions, flashcards, and study deck have been generated and validated.
                  </p>
                </div>

                {/* Primary & Secondary Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    onClick={onStartPractice}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border-2 border-[#181c1b] bg-[#5f0f00] px-6 py-3.5 text-base font-extrabold text-white shadow-[4px_4px_0px_0px_#181c1b] transition-all hover:bg-[#841f06] hover:translate-y-[-2px] active:translate-y-[1px] active:shadow-[2px_2px_0px_0px_#181c1b] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ff967d]"
                  >
                    <span>Start practice</span>
                    <ArrowRight className="size-5 text-[#ff967d]" />
                  </button>

                  <button
                    onClick={onReviewQuestions}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border-2 border-[#181c1b] bg-white px-6 py-3.5 text-base font-extrabold text-[#181c1b] shadow-[4px_4px_0px_0px_#181c1b] transition-all hover:bg-[#ebefed] hover:translate-y-[-2px] active:translate-y-[1px] active:shadow-[2px_2px_0px_0px_#181c1b] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ff967d]"
                  >
                    <BookOpen className="size-5 text-[#5f0f00]" />
                    <span>Review questions</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </main>

      {/* ========================================================================= */}
      {/* FOOTER METADATA                                                           */}
      {/* ========================================================================= */}
      <footer className="relative z-20 flex flex-wrap items-center justify-between border-t border-[#c0c9c3] bg-[#f7faf8] px-4 py-2.5 text-xs text-[#404945] font-label md:px-8">
        <div className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-full bg-[#5f0f00] animate-ping" />
          <span>DOC2QUIZ HIGH-OCTANE PROCESSOR</span>
        </div>
        <div className="flex items-center gap-4">
          <span>LATENCY: 14ms</span>
          <span>ENGINE: v3.8-PROD</span>
        </div>
      </footer>
    </div>
  );
}
