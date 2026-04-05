"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParseProgress } from "@/components/ai/ParseProgressContext";
import {
  AI_CONFIG_CHANGED_EVENT,
  LS_LAST_AI_REACHABILITY,
  readReachabilityFromStorage,
  runAiReachabilityCheck,
  type AiReachabilitySnapshot,
} from "@/lib/ai/aiReachability";
import { getStudySetMeta } from "@/lib/db/studySetDb";

const FOCUS_CHECK_MIN_MS = 60_000;

function phaseLabel(phase: string): string {
  if (phase === "rendering_pdf") {
    return "Rendering PDF pages…";
  }
  if (phase === "vision_pages") {
    return "Vision parse";
  }
  if (phase === "text_chunks") {
    return "Text parse";
  }
  return "Parse";
}

function formatShortTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AppStatusDock() {
  const { live } = useParseProgress();
  const [setTitle, setSetTitle] = useState<string | null>(null);
  /** null until after mount — avoid hydration mismatch (LS only exists on client). */
  const [reach, setReach] = useState<AiReachabilitySnapshot | null>(null);
  const [checking, setChecking] = useState(false);
  const lastFocusCheckRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const runCheck = useCallback(async () => {
    abortRef.current?.abort();
    const c = new AbortController();
    abortRef.current = c;
    setChecking(true);
    try {
      const s = await runAiReachabilityCheck(c.signal);
      if (!c.signal.aborted) {
        setReach(s);
      }
    } finally {
      if (abortRef.current === c) {
        abortRef.current = null;
      }
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!live?.running || !live.studySetId) {
      setSetTitle(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const meta = await getStudySetMeta(live.studySetId);
      if (!cancelled) {
        setSetTitle(meta?.title ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [live?.running, live?.studySetId]);

  useEffect(() => {
    setReach(readReachabilityFromStorage());
    void runCheck();
    return () => {
      abortRef.current?.abort();
    };
  }, [runCheck]);

  useEffect(() => {
    const onFocus = () => {
      const now = Date.now();
      if (now - lastFocusCheckRef.current < FOCUS_CHECK_MIN_MS) {
        return;
      }
      lastFocusCheckRef.current = now;
      void runCheck();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [runCheck]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) {
        return;
      }
      if (
        e.key === LS_LAST_AI_REACHABILITY ||
        e.key.startsWith("doc2quiz:ai:")
      ) {
        setReach(readReachabilityFromStorage());
        if (e.key !== LS_LAST_AI_REACHABILITY) {
          void runCheck();
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [runCheck]);

  useEffect(() => {
    const onConfig = () => {
      void runCheck();
    };
    window.addEventListener(AI_CONFIG_CHANGED_EVENT, onConfig);
    return () =>
      window.removeEventListener(AI_CONFIG_CHANGED_EVENT, onConfig);
  }, [runCheck]);

  const indeterminate =
    live?.running &&
    (live.phase === "rendering_pdf" || live.total <= 0);
  const pct =
    live?.running && !indeterminate && live.total > 0
      ? Math.min(100, Math.round((100 * live.current) / live.total))
      : null;

  return (
    <div
      className="pointer-events-auto fixed bottom-20 right-3 z-[100] flex max-w-sm flex-col gap-2 rounded-xl border border-[var(--d2q-border)] bg-[var(--d2q-surface-elevated)]/95 p-3 text-xs text-[var(--d2q-text)] shadow-xl shadow-black/40 backdrop-blur-sm sm:right-4 lg:bottom-6"
      role="status"
      aria-live="polite"
    >
      {live?.running ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 font-semibold text-[var(--d2q-text)]">
            <span>AI parse</span>
            <span className="font-normal text-[var(--d2q-muted)]">
              {setTitle ? `${setTitle.slice(0, 28)}${setTitle.length > 28 ? "…" : ""}` : "…"}
            </span>
          </div>
          <p className="text-[var(--d2q-muted)]">
            {phaseLabel(live.phase)}{" "}
            {live.phase !== "rendering_pdf" && live.total > 0
              ? `${live.current} / ${live.total}`
              : live.phase === "rendering_pdf"
                ? ""
                : ""}
          </p>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-[var(--d2q-surface)]"
            aria-hidden
          >
            {indeterminate || pct === null ? (
              <div className="h-full w-full animate-pulse bg-[var(--d2q-accent)]/50" />
            ) : (
              <div
                className="h-full bg-[var(--d2q-accent)] transition-[width] duration-300 ease-out"
                style={{ width: `${pct}%` }}
              />
            )}
          </div>
        </div>
      ) : null}

      <div
        className={`space-y-1 ${live?.running ? "border-t border-[var(--d2q-border)] pt-2" : ""}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-[var(--d2q-text)]">API</span>
          <button
            type="button"
            onClick={() => void runCheck()}
            disabled={checking}
            className="cursor-pointer rounded border border-[var(--d2q-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--d2q-muted)] hover:bg-[var(--d2q-surface)] hover:text-[var(--d2q-text)] disabled:opacity-50"
          >
            {checking ? "Checking…" : "Check again"}
          </button>
        </div>
        {!reach ? (
          <p className="text-[var(--d2q-muted)]">No check yet</p>
        ) : reach.ok ? (
          <p className="text-emerald-400">
            OK · {reach.provider} · {formatShortTime(reach.checkedAt)}
          </p>
        ) : (
          <p className="text-red-400" title={reach.message}>
            Unavailable · {formatShortTime(reach.checkedAt)}
            {reach.message ? ` — ${reach.message}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
