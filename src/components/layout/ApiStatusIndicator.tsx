"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/buttons/button";
import { pingAiAgent, type AiAgentPingResponse } from "@/lib/ai/ping";
import { setApiPingCache } from "@/lib/client/apiPingCache";
import {
  clickLevelFromCount,
  pickCheckingLine,
  pickDownLine,
  pickNotWiredLine,
  pickSuccessLine,
} from "@/lib/client/apiStatusEasterEgg";
import { cn } from "@/lib/utils";

const PILL_DEFAULT = "AI";

type ApiStatus = "idle" | "checking" | "ok" | "not_configured" | "error";

function statusFromResult(result: AiAgentPingResponse): ApiStatus {
  if (result.ok) {
    return "ok";
  }
  if (!result.configured || result.error === "ai_not_configured") {
    return "not_configured";
  }
  return "error";
}

function dotClass(status: ApiStatus): string {
  switch (status) {
    case "ok":
      return "bg-chart-2 shadow-[0_0_6px_color-mix(in_srgb,var(--chart-2)_55%,transparent)]";
    case "not_configured":
      return "bg-chart-3";
    case "error":
      return "bg-destructive";
    default:
      return "bg-muted-foreground";
  }
}

function srStatusLabel(status: ApiStatus): string {
  switch (status) {
    case "ok":
      return "AI connection online";
    case "not_configured":
      return "AI not configured";
    case "error":
      return "AI connection down";
    case "checking":
      return "Checking AI connection";
    default:
      return "AI connection unknown";
  }
}

export function ApiStatusIndicator() {
  const pathname = usePathname();
  const [status, setStatus] = useState<ApiStatus>("idle");
  const [pillText, setPillText] = useState(PILL_DEFAULT);
  const [labelKey, setLabelKey] = useState(0);
  const [dotPop, setDotPop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [userEngaged, setUserEngaged] = useState(false);

  const seqRef = useRef(0);
  const clickCountRef = useRef(0);
  const prevStatusRef = useRef<ApiStatus>("idle");
  const silentSeqRef = useRef(0);

  const setPillCopy = useCallback((text: string) => {
    setPillText(text);
    setLabelKey((k) => k + 1);
  }, []);

  const applySilentResult = useCallback((result: AiAgentPingResponse) => {
    setStatus(statusFromResult(result));
    setApiPingCache(result);
  }, []);

  const applyClickResult = useCallback(
    (result: AiAgentPingResponse, clickLevel: number) => {
      const next = statusFromResult(result);
      setStatus(next);
      setApiPingCache(result);

      if (result.ok) {
        setPillCopy(pickSuccessLine(clickLevelFromCount(clickLevel)));
        return;
      }
      if (next === "not_configured") {
        setPillCopy(pickNotWiredLine());
        return;
      }
      setPillCopy(pickDownLine());
    },
    [setPillCopy],
  );

  const runSilentPing = useCallback(async () => {
    const seq = ++silentSeqRef.current;
    const result = await pingAiAgent();
    if (seq !== silentSeqRef.current) {
      return;
    }
    applySilentResult(result);
  }, [applySilentResult]);

  const runClickCheck = useCallback(
    async (clickLevel: number) => {
      const seq = ++seqRef.current;
      setBusy(true);
      setStatus("checking");
      setPillCopy(pickCheckingLine(clickLevelFromCount(clickLevel)));

      const result = await pingAiAgent();
      if (seq !== seqRef.current) {
        return;
      }

      applyClickResult(result, clickLevel);
      setBusy(false);
    },
    [applyClickResult, setPillCopy],
  );

  useEffect(() => {
    if (pathname !== "/dashboard") {
      return;
    }
    void runSilentPing();
  }, [pathname, runSilentPing]);

  useEffect(() => {
    if (prevStatusRef.current === status || status === "checking") {
      return;
    }
    prevStatusRef.current = status;
    setDotPop(true);
    const timer = window.setTimeout(() => setDotPop(false), 160);
    return () => window.clearTimeout(timer);
  }, [status]);

  const handleClick = useCallback(() => {
    setUserEngaged(true);
    clickCountRef.current += 1;
    void runClickCheck(clickCountRef.current);
  }, [runClickCheck]);

  const isChecking = status === "checking" || busy;
  const liveRegionText = userEngaged ? pillText : srStatusLabel(status);

  return (
    <>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {liveRegionText}
      </span>
      <Button
        type="button"
        data-testid="doc2quiz-api-status-trigger"
        variant="outline"
        size="sm"
        title={
          userEngaged && status === "not_configured"
            ? "Cần AI_PROVIDER_URL và AI_PROVIDER_KEY trong .env — mở Settings"
            : userEngaged
              ? pillText
              : "Bấm để kiểm tra AI"
        }
        className={cn(
          "h-8 max-w-[12.5rem] min-h-8 shrink-0 justify-start gap-2 rounded-full px-3",
          "border-border/80 bg-background/90 dark:bg-background/15",
          "transition-colors duration-200",
          status === "ok" &&
            "border-chart-2/40 bg-chart-2/8 text-foreground dark:bg-chart-2/12",
          status === "error" && "border-destructive/35 bg-destructive/5",
          status === "not_configured" && "border-chart-3/40",
        )}
        aria-busy={isChecking}
        aria-label={`AI connection: ${liveRegionText}`}
        onClick={handleClick}
      >
        <span
          className="relative inline-flex size-3 shrink-0 items-center justify-center"
          aria-hidden
        >
          {isChecking ? (
            <Loader2 className="absolute size-3 animate-spin text-chart-2 motion-reduce:animate-none" />
          ) : null}
          <span
            className={cn(
              "size-2 shrink-0 rounded-full transition-opacity duration-150 motion-reduce:transition-none",
              dotClass(status),
              dotPop && "d2q-status-dot-pop",
              isChecking ? "opacity-0" : "opacity-100",
            )}
          />
        </span>
        <span
          key={labelKey}
          className={cn(
            "d2q-status-pill-label min-w-0 truncate text-left text-[11px] font-semibold leading-tight tracking-tight",
            !userEngaged && "text-muted-foreground",
            userEngaged && status === "ok" && "text-chart-2 dark:text-chart-2",
            userEngaged && status !== "ok" && "text-muted-foreground",
          )}
        >
          {pillText}
        </span>
      </Button>
    </>
  );
}
