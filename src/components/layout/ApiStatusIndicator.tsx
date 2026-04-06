"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AI_CONFIG_CHANGED_EVENT,
  LS_LAST_AI_REACHABILITY,
  readReachabilityFromStorage,
  runAiReachabilityCheck,
  type AiReachabilitySnapshot,
} from "@/lib/ai/aiReachability";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const FOCUS_CHECK_MIN_MS = 60_000;

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

export function ApiStatusIndicator() {
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

  const ok = reach?.ok === true;
  const label = checking ? "…" : ok ? "API OK" : "API Down";

  return (
    <TooltipProvider delay={200}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto min-h-0 shrink-0 gap-0.5 px-1 py-0 font-normal hover:bg-transparent"
              disabled={checking}
              onClick={() => void runCheck()}
            />
          }
        >
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[10px] font-medium leading-none",
              ok
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-destructive",
            )}
          >
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                ok ? "bg-emerald-500" : "bg-destructive",
              )}
              aria-hidden
            />
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          {reach ? (
            <>
              {ok ? (
                <p>
                  {reach.provider} reachable · checked{" "}
                  {formatShortTime(reach.checkedAt)}
                </p>
              ) : (
                <p>
                  Unavailable · {formatShortTime(reach.checkedAt)}
                  {reach.message ? ` — ${reach.message}` : ""}
                </p>
              )}
              <p className="mt-1 text-muted-foreground">Click to check again</p>
            </>
          ) : (
            <p>No check yet — click to probe your AI settings.</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
