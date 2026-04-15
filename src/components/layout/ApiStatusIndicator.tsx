"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  AI_CONFIG_CHANGED_EVENT,
  LS_LAST_AI_REACHABILITY,
  readReachabilityFromStorage,
  runAiReachabilityCheck,
  type AiReachabilitySnapshot,
} from "@/lib/ai/aiReachability";
import type { AiProvider } from "@/types/question";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/buttons/button";
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

function formatProviderLabel(provider: AiProvider): string {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Anthropic";
    case "custom":
      return "Custom";
  }
}

/** Hover: transform leads (~0ms delay); chrome follows after ~110ms; ~500ms each. */
const BADGE_HOVER_TRANSITION =
  "transform 500ms cubic-bezier(0.25,0.46,0.45,0.94) 0ms, background-color 500ms cubic-bezier(0.25,0.46,0.45,0.94) 110ms, border-color 500ms cubic-bezier(0.25,0.46,0.45,0.94) 110ms, box-shadow 500ms cubic-bezier(0.25,0.46,0.45,0.94) 110ms";

export function ApiStatusIndicator() {
  const reduceMotion = useReducedMotion();
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
  const hasReach = reach != null;
  const label =
    checking && !hasReach ? "Checking" : ok ? "API OK" : "API Down";

  return (
    <TooltipProvider delay={200}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              data-testid="doc2quiz-api-status-trigger"
              variant="outline"
              size="sm"
              style={
                reduceMotion ? undefined : { transition: BADGE_HOVER_TRANSITION }
              }
              className={cn(
                "h-7 min-h-7 min-w-[5.75rem] shrink-0 justify-center gap-1 rounded-full px-2.5 text-[10px] font-normal shadow-sm",
                // Keep badge distinct from `AppTopBar` chrome (bg-card/85).
                "border-border/70 bg-background/70 dark:bg-background/10",
                reduceMotion
                  ? "transition-colors duration-200 ease-out hover:border-border/65 hover:bg-muted/40 dark:hover:bg-muted/30"
                  : "motion-safe:hover:-translate-y-px motion-safe:hover:border-border/80 motion-safe:hover:bg-background/85 motion-safe:hover:shadow-md motion-safe:hover:shadow-foreground/[0.07] dark:motion-safe:hover:bg-background/15 dark:motion-safe:hover:shadow-black/25",
                "active:translate-y-0 disabled:pointer-events-none disabled:opacity-100",
                "aria-busy:cursor-wait",
              )}
              disabled={checking}
              aria-busy={checking}
              onClick={() => void runCheck()}
            />
          }
        >
          <span
            className={cn(
              "inline-flex min-w-0 items-center justify-center gap-1.5 text-[10px] font-medium leading-none",
              !hasReach
                ? "text-muted-foreground"
                : ok
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-destructive",
            )}
          >
            <span
              className="relative inline-flex size-3 shrink-0 items-center justify-center"
              aria-hidden
            >
              {checking ? (
                <Loader2 className="absolute size-3 animate-spin opacity-80 motion-reduce:animate-none" />
              ) : null}
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full transition-opacity duration-150",
                  checking ? "opacity-0" : "opacity-100",
                  !hasReach
                    ? "bg-muted-foreground"
                    : ok
                      ? "bg-emerald-500"
                      : "bg-destructive",
                )}
              />
            </span>
            <span className="min-w-[4rem] text-center tabular-nums">{label}</span>
            {checking ? (
              <span className="sr-only">Checking API connection</span>
            ) : null}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="max-w-sm min-w-[220px] flex flex-col items-stretch gap-1.5 text-left text-xs text-background"
        >
          {reach ? (
            <>
              {ok ? (
                <>
                  <p className="font-medium leading-snug text-background">
                    {formatProviderLabel(reach.provider)} reachable
                  </p>
                  <p className="text-[11px] leading-snug text-background/90">
                    Last checked {formatShortTime(reach.checkedAt)}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium leading-snug text-background">
                    Unreachable
                  </p>
                  <p className="break-words text-[11px] leading-snug text-background/90">
                    {formatShortTime(reach.checkedAt)}
                    {reach.message ? ` · ${reach.message}` : ""}
                  </p>
                </>
              )}
              <p className="border-t border-background/20 pt-1.5 text-[11px] leading-snug text-background/80">
                Click to run a fresh connection test. You can also review keys in
                Settings.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium leading-snug text-background">
                No connection check yet
              </p>
              <p className="text-[11px] leading-snug text-background/90">
                Open Settings or click here to test your AI configuration.
              </p>
            </>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
